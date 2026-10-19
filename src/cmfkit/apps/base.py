"""Base class and runner for host-side watch apps."""

from __future__ import annotations

import asyncio
import contextlib
import logging

from ..protocol import opcodes as ops
from ..protocol.frame import Message
from ..session import Session
from .surfaces import Screen

log = logging.getLogger(__name__)

# MUSIC_BUTTON payload byte -> logical button. Unconfirmed on hardware; run
# `cmfkit listen` and press the watch's media controls to verify, then override
# with WatchApp.button_map.
DEFAULT_BUTTON_MAP = {0x01: "play", 0x02: "pause", 0x03: "next", 0x04: "prev", 0x05: "vol_up", 0x06: "vol_down"}


class WatchApp:
    """Subclass this to build an app.

    Override :meth:`start`, :meth:`on_button` and/or :meth:`tick`. Draw with
    ``self.screen``. Buttons arrive as ``"play"``, ``"pause"``, ``"next"``,
    ``"prev"``, ``"vol_up"``, ``"vol_down"`` or ``"find_phone"``.
    """

    name = "app"
    description = ""
    tick_interval: float | None = 1.0
    button_map: dict[int, str] = DEFAULT_BUTTON_MAP

    def __init__(self, screen: Screen, args: list[str]) -> None:
        self.screen = screen
        self.args = args
        self.running = True

    async def start(self) -> None:
        pass

    async def on_button(self, button: str) -> None:
        pass

    async def tick(self) -> None:
        pass

    async def stop(self) -> None:
        pass

    def exit(self) -> None:
        self.running = False


class AppRunner:
    def __init__(self, session: Session, app_cls: type[WatchApp], args: list[str]) -> None:
        self.session = session
        self.app = app_cls(Screen(session), args)
        self._events: asyncio.Queue[str] = asyncio.Queue()
        session.on_message(self._on_message)

    def _on_message(self, msg: Message) -> None:
        if msg.op == ops.MUSIC_BUTTON and msg.payload:
            code = msg.payload[0]
            self._events.put_nowait(self.app.button_map.get(code, f"raw:{code:02x}"))
        elif msg.op == ops.FIND_PHONE:
            self._events.put_nowait("find_phone")

    def inject(self, button: str) -> None:
        self._events.put_nowait(button)

    async def run(self, duration: float | None = None) -> None:
        app = self.app
        await app.start()
        loop = asyncio.get_running_loop()
        deadline = loop.time() + duration if duration else None
        next_tick = loop.time()
        try:
            while app.running:
                now = loop.time()
                if deadline and now >= deadline:
                    break
                if app.tick_interval and now >= next_tick:
                    await app.tick()
                    next_tick = now + app.tick_interval
                wait = (next_tick - now) if app.tick_interval else 0.5
                with contextlib.suppress(TimeoutError):
                    button = await asyncio.wait_for(self._events.get(), max(wait, 0.01))
                    log.info("button: %s", button)
                    await app.on_button(button)
        finally:
            await app.stop()
