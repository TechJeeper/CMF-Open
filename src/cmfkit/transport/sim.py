"""An in-process simulated CMF Watch 3 Pro.

It plays the watch side of the protocol (AT shell, pairing, encrypted session,
notifications, music, weather, contacts, photo watchface transfer) so that
cmfkit and host apps can be developed and tested without hardware.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import Callable
from dataclasses import dataclass, field

from ..protocol import crypto, frame
from ..protocol import opcodes as ops
from ..protocol import payloads as pl
from ..protocol.opcodes import Op
from ..watchface import photo
from .base import Channel, NotifyHandler

CHUNK = 4096

# Raw MUSIC_BUTTON codes the simulator emits; the real mapping is unconfirmed.
BUTTONS = {"play": 0x01, "pause": 0x02, "next": 0x03, "prev": 0x04, "vol_up": 0x05, "vol_down": 0x06}


@dataclass
class WatchState:
    notifications: list[tuple[str, str]] = field(default_factory=list)
    music: tuple[str, str] = ("", "")
    weather_city: str = ""
    contacts: list[pl.Contact] = field(default_factory=list)
    dials: list[int] = field(default_factory=lambda: [273, 274, 275, 300, 340])
    active_dial: photo.PhotoDial | None = None
    vibrations: int = 0


class SimWatch:
    def __init__(self, secret: bytes | None = None, on_event: Callable[[str], None] | None = None) -> None:
        self.name = "CMF Watch 3 Pro-SIM0"
        self.secret = secret or os.urandom(16)
        self.state = WatchState()
        self.firmware = bytes([1, 0, 0, 77])
        self.serial = "CI0SIMULATOR0001"
        self.battery = 87
        self.on_event = on_event or (lambda _msg: None)
        self._authkey: bytes | None = None
        self._key: bytes | None = None
        self._handler: NotifyHandler | None = None
        self._cmd = frame.FrameDecoder(plaintext_crc_on_wire=True)
        self._data = frame.FrameDecoder(plaintext_crc_on_wire=True)
        self._time_synced = False
        self._rnd1: bytes | None = None
        self._upload: bytearray | None = None
        self._upload_size = 0
        self._next_offset = 0

    # -- Transport interface -------------------------------------------------

    @property
    def mtu(self) -> int:
        return 247

    def set_notify_handler(self, handler: NotifyHandler) -> None:
        self._handler = handler

    async def connect(self) -> None:
        self._set_key(self._authkey)
        self._time_synced = False
        self.on_event("connected")

    async def disconnect(self) -> None:
        self.on_event("disconnected")

    async def write(self, channel: Channel, data: bytes) -> None:
        await asyncio.sleep(0)
        if channel is Channel.SHELL:
            self._shell(data.decode().strip())
            return
        decoder = self._cmd if channel is Channel.COMMAND else self._data
        decoder.key = self._key
        for msg in decoder.feed(data):
            self._dispatch(msg)

    # -- helpers --------------------------------------------------------------

    def _notify(self, channel: Channel, data: bytes) -> None:
        if self._handler:
            asyncio.get_running_loop().call_soon(self._handler, channel, data)

    def _reply(self, op: Op, payload: bytes = b"") -> None:
        for chunk in frame.encode(op, payload, self._key, self.mtu, omit_plaintext_crc=True):
            self._notify(Channel.COMMAND, chunk)

    def _set_key(self, key: bytes | None) -> None:
        self._key = key
        self._cmd.key = key

    def press(self, button: str) -> None:
        """Simulate the wearer pressing a media control on the watch."""
        self._reply(ops.MUSIC_BUTTON, bytes([BUTTONS[button]]))

    def _shell(self, line: str) -> None:
        cmd = line.removeprefix("AT").strip().upper()
        if cmd == "GETSECRET":
            out = f"GETSECRET:{self.secret.hex().upper()},OK"
        elif cmd == "GETVERSION":
            out = f"GETVERSION:{'.'.join(map(str, self.firmware))},OK"
        elif cmd == "GETSN":
            out = f"GETSN:{self.serial},OK"
        elif cmd == "GETBATLV":
            out = "GETBATLV:3921mv,OK"
        elif cmd.startswith("SETMOTOR"):
            self.state.vibrations += 1
            self.on_event("bzzz (motor)")
            out = "SETMOTOR,OK"
        else:
            out = f"{cmd},ERROR"
        self._notify(Channel.SHELL, out.encode())

    # -- command dispatch -----------------------------------------------------

    def _dispatch(self, msg: frame.Message) -> None:
        op, p = msg.op, msg.payload
        if op == ops.AUTH_PAIR_REQUEST:
            rnd1, signed1 = p[:16], p[16:48]
            if signed1 != crypto.sign(rnd1, self.secret):
                self._reply(ops.AUTH_FAILED)
                return
            rnd2 = os.urandom(16)
            self._reply(ops.AUTH_PAIR_REPLY, rnd2 + crypto.sign(rnd2, self.secret))
            self._authkey = crypto.derive_authkey(rnd1, rnd2, self.secret)
            self._set_key(self._authkey)
        elif op == ops.AUTH_PHONE_NAME:
            self._reply(ops.AUTH_WATCH_MAC, bytes.fromhex("D0C0FFEE5485"))
        elif op == ops.AUTH_NONCE_REQUEST:
            nonce = os.urandom(16)
            self._reply(ops.AUTH_NONCE_REPLY, nonce)
            assert self._authkey is not None
            self._set_key(crypto.derive_session_key(nonce, self._authkey))
        elif op == ops.AUTH_CONFIRM_REQUEST:
            self._reply(ops.AUTH_CONFIRM_REPLY, b"\x01")
            self.on_event("authenticated")
        elif op == ops.TIME:
            self._time_synced = True
        elif not self._time_synced and op in (ops.BATTERY, ops.SERIAL_NUMBER_GET):
            return  # mirrors the real watch: silent until TIME is sent
        elif op == ops.FIRMWARE_VERSION_GET:
            self._reply(ops.FIRMWARE_VERSION_RET, self.firmware)
        elif op == ops.SERIAL_NUMBER_GET:
            self._reply(ops.SERIAL_NUMBER_RET, bytes([len(self.serial)]) + self.serial.encode())
        elif op == ops.BATTERY:
            self._reply(ops.BATTERY, bytes([self.battery, 0]))
        elif op == ops.APP_NOTIFICATION:
            _, title, body = pl.parse_notification(p)
            self.state.notifications.append((title, body))
            self.state.vibrations += 1
            self.on_event(f"notification  [{title}] {body}")
            self._reply(ops.APP_NOTIFICATION_ACK)
        elif op == ops.FIND_WATCH:
            self.state.vibrations += 1
            self.on_event("ringing (find watch)")
            self._reply(ops.FIND_WATCH_ACK)
        elif op == ops.MUSIC_INFO_SET:
            _, track, artist = pl.parse_music_info(p)
            self.state.music = (track, artist)
            self.on_event(f"music card    {track} / {artist}")
            self._reply(ops.MUSIC_INFO_ACK)
        elif op == ops.WEATHER_SET:
            self.state.weather_city = pl.parse_weather_city(p)
            self.on_event(f"weather city  {self.state.weather_city}")
        elif op == ops.CONTACTS_SET:
            self.state.contacts = pl.parse_contacts(p)
            self.on_event("contacts      " + " | ".join(c.name for c in self.state.contacts))
            self._reply(ops.CONTACTS_ACK)
        elif op == ops.WF_INIT1_REQUEST:
            self._reply(ops.WF_INIT1_REPLY, b"\x01")
        elif op == ops.WF_INIT2_PHOTO_REQUEST:
            self._upload_size = int.from_bytes(p[1:5], "big")
            self._upload = bytearray()
            self._next_offset = 0
            self._reply(ops.WF_INIT2_PHOTO_REPLY, b"\x01")
            self._request_chunk()
        elif op == ops.WF_CHUNK_WRITE and self._upload is not None:
            self._upload.extend(p)
            if len(self._upload) >= self._next_offset:
                self._request_chunk()

    def _request_chunk(self) -> None:
        assert self._upload is not None
        offset = len(self._upload)
        if offset >= self._upload_size:
            self._finish_upload()
            return
        length = min(CHUNK, self._upload_size - offset)
        self._next_offset = offset + length
        progress = offset * 100 // self._upload_size
        self._reply(ops.WF_CHUNK_REQUEST, pl.build_chunk_request(offset, length, progress))

    def _finish_upload(self) -> None:
        blob = bytes(self._upload or b"")
        self._upload = None
        try:
            self.state.active_dial = photo.parse(blob)
        except (photo.DialFormatError, ValueError) as exc:
            self.on_event(f"watchface rejected: {exc}")
            self._reply(ops.WF_FINISH_REQUEST, b"\x0a")
            return
        self.state.dials.append(0xFFFFFFFF)
        self.on_event(f"watchface installed ({len(blob)} bytes)")
        self._reply(ops.WF_FINISH_REQUEST, b"\x01")
