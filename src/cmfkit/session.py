"""An authenticated, encrypted session with one watch."""

from __future__ import annotations

import asyncio
import logging
import os
import re
from collections.abc import Callable

from .protocol import crypto, frame
from .protocol import opcodes as ops
from .protocol import payloads as pl
from .protocol.opcodes import Op
from .transport.base import Channel, Transport

log = logging.getLogger(__name__)

MessageHandler = Callable[[frame.Message], None]


class AuthError(RuntimeError):
    pass


class Session:
    def __init__(self, transport: Transport, model: str = "CMF Watch 3 Pro", timeout: float = 8.0) -> None:
        self.transport = transport
        self.model = model
        self.timeout = timeout
        self.authkey: bytes | None = None
        self._key: bytes | None = None
        self._decoder = frame.FrameDecoder()
        self._waiters: list[tuple[set[Op], asyncio.Future[frame.Message]]] = []
        self._shell_waiter: asyncio.Future[str] | None = None
        self._shell_buf = ""
        self._listeners: list[MessageHandler] = []
        transport.set_notify_handler(self._on_notify)

    # -- plumbing -----------------------------------------------------------

    def _set_key(self, key: bytes | None) -> None:
        self._key = key
        self._decoder.key = key

    def on_message(self, handler: MessageHandler) -> None:
        """Subscribe to unsolicited watch -> phone messages (e.g. MUSIC_BUTTON)."""
        self._listeners.append(handler)

    def _on_notify(self, channel: Channel, data: bytes) -> None:
        if channel is Channel.SHELL:
            self._shell_buf += data.decode("utf-8", "replace")
            if self._shell_waiter and not self._shell_waiter.done() and re.search(r"(OK|ERROR)\s*$", self._shell_buf):
                self._shell_waiter.set_result(self._shell_buf.strip())
                self._shell_buf = ""
            return
        try:
            messages = list(self._decoder.feed(data))
        except frame.FrameError as exc:
            log.warning("dropping bad frame: %s", exc)
            return
        for msg in messages:
            log.debug("<- %s %s", ops.name_of(msg.op), msg.payload.hex())
            for wanted, fut in list(self._waiters):
                if msg.op in wanted and not fut.done():
                    fut.set_result(msg)
                    self._waiters.remove((wanted, fut))
                    break
            else:
                for listener in self._listeners:
                    listener(msg)

    def _expect(self, *wanted: Op) -> asyncio.Future[frame.Message]:
        fut: asyncio.Future[frame.Message] = asyncio.get_running_loop().create_future()
        self._waiters.append((set(wanted), fut))
        return fut

    async def send(self, op: Op, payload: bytes = b"", channel: Channel = Channel.COMMAND) -> None:
        log.debug("-> %s %s", ops.name_of(op), payload.hex())
        for chunk in frame.encode(op, payload, self._key, self.transport.mtu):
            await self.transport.write(channel, chunk)

    async def request(self, op: Op, payload: bytes, *reply: Op, timeout: float | None = None) -> frame.Message:
        fut = self._expect(*reply)
        await self.send(op, payload)
        try:
            return await asyncio.wait_for(fut, timeout or self.timeout)
        except TimeoutError as exc:
            raise TimeoutError(f"no {'/'.join(ops.name_of(r) for r in reply)} reply to {ops.name_of(op)}") from exc

    async def shell(self, command: str, timeout: float | None = None) -> str:
        """Send a plain-text AT command on the factory shell channel."""
        self._shell_waiter = asyncio.get_running_loop().create_future()
        self._shell_buf = ""
        line = command if command.upper().startswith("AT") else f"AT {command}"
        await self.transport.write(Channel.SHELL, (line + "\r\n").encode())
        return await asyncio.wait_for(self._shell_waiter, timeout or self.timeout)

    # -- auth ---------------------------------------------------------------

    async def pair(self, secret: bytes | None = None) -> bytes:
        """First-time pairing. Returns the auth key, which should be persisted."""
        if secret is None:
            reply = await self.shell("AT GETSECRET")
            match = re.search(r"GETSECRET:([0-9A-Fa-f]{32})", reply)
            if not match:
                raise AuthError(f"unexpected GETSECRET reply: {reply!r}")
            secret = bytes.fromhex(match.group(1))
        self._set_key(None)
        rnd1 = os.urandom(16)
        msg = await self.request(
            ops.AUTH_PAIR_REQUEST, rnd1 + crypto.sign(rnd1, secret), ops.AUTH_PAIR_REPLY, ops.AUTH_FAILED
        )
        if msg.op == ops.AUTH_FAILED or len(msg.payload) < 48:
            raise AuthError("watch rejected pairing request")
        rnd2, signed2 = msg.payload[:16], msg.payload[16:48]
        if signed2 != crypto.sign(rnd2, secret):
            raise AuthError("watch signature mismatch (wrong secret?)")
        authkey = crypto.derive_authkey(rnd1, rnd2, secret)
        # The watch now shows a pairing prompt and only answers once the user accepts it.
        log.warning("accept the pairing request on the watch screen")
        await self.login(authkey, hello_timeout=60.0)
        return authkey

    async def login(self, authkey: bytes, hello_timeout: float | None = None) -> None:
        """Reconnect handshake using a previously stored auth key."""
        self.authkey = authkey
        self._set_key(authkey)
        await self.request(
            ops.AUTH_PHONE_NAME,
            b"\xa5" + self.model.encode(),
            ops.AUTH_WATCH_MAC,
            ops.AUTH_FAILED,
            timeout=hello_timeout,
        )
        nonce = await self.request(ops.AUTH_NONCE_REQUEST, pl.POLL, ops.AUTH_NONCE_REPLY, ops.AUTH_FAILED)
        if nonce.op == ops.AUTH_FAILED:
            raise AuthError("watch rejected auth key")
        self._set_key(crypto.derive_session_key(nonce.payload, authkey))
        confirm = await self.request(ops.AUTH_CONFIRM_REQUEST, pl.POLL, ops.AUTH_CONFIRM_REPLY, ops.AUTH_FAILED)
        if confirm.op == ops.AUTH_FAILED:
            raise AuthError("session confirmation failed")
        # The watch ignores data queries until it has been told the time.
        await self.send(ops.TIME, pl.time_sync())

    # -- high-level commands --------------------------------------------------

    async def firmware_version(self) -> str:
        msg = await self.request(ops.FIRMWARE_VERSION_GET, pl.POLL, ops.FIRMWARE_VERSION_RET)
        return pl.parse_firmware_version(msg.payload)

    async def serial_number(self) -> str:
        msg = await self.request(ops.SERIAL_NUMBER_GET, pl.POLL, ops.SERIAL_NUMBER_RET)
        return pl.parse_serial(msg.payload)

    async def battery(self) -> tuple[int, bool]:
        msg = await self.request(ops.BATTERY, pl.POLL, ops.BATTERY)
        return pl.parse_battery(msg.payload)

    async def notify(self, title: str, body: str, icon: int = pl.ICONS["generic"]) -> None:
        await self.send(ops.APP_NOTIFICATION, pl.notification(title, body, icon))

    async def find_watch(self) -> None:
        await self.send(ops.FIND_WATCH, b"\x01")

    async def set_music(self, track: str, artist: str, state: int = pl.MUSIC_PLAYING) -> None:
        await self.send(ops.MUSIC_INFO_SET, pl.music_info(track, artist, state))

    async def set_weather(self, city: str, temp_c: int = 20) -> None:
        await self.send(ops.WEATHER_SET, pl.weather(city, temp_c))

    async def set_contacts(self, entries: list[pl.Contact]) -> None:
        await self.send(ops.CONTACTS_SET, pl.contacts(entries))

    async def upload_photo_dial(
        self,
        blob: bytes,
        style: int = 0,
        x: int = 56,
        y: int = 77,
        color565: int = 0xFFFF,
        progress: Callable[[int, int], None] | None = None,
    ) -> bool:
        """Upload a photo watchface container. Returns True if the watch activated it."""
        init1 = await self.request(ops.WF_INIT1_REQUEST, pl.POLL, ops.WF_INIT1_REPLY)
        if not init1.payload or init1.payload[0] != 1:
            raise RuntimeError(f"watch refused watchface transfer: {init1.payload.hex()}")
        chunk_or_finish = self._expect(ops.WF_CHUNK_REQUEST, ops.WF_FINISH_REQUEST)
        init2 = await self.request(
            ops.WF_INIT2_PHOTO_REQUEST, pl.photo_dial_init(len(blob), style, x, y, color565), ops.WF_INIT2_PHOTO_REPLY
        )
        if not init2.payload or init2.payload[0] != 1:
            raise RuntimeError(f"watch rejected watchface header: {init2.payload.hex()}")
        while True:
            msg = await asyncio.wait_for(chunk_or_finish, self.timeout * 4)
            if msg.op == ops.WF_FINISH_REQUEST:
                await self.send(ops.WF_FINISH_ACK, pl.POLL)
                return bool(msg.payload) and msg.payload[0] == 1
            offset, length = pl.chunk_request(msg.payload)
            chunk_or_finish = self._expect(ops.WF_CHUNK_REQUEST, ops.WF_FINISH_REQUEST)
            await self.send(ops.WF_CHUNK_WRITE, blob[offset : offset + length], channel=Channel.DATA)
            if progress:
                progress(min(offset + length, len(blob)), len(blob))
