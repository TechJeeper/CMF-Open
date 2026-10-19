"""Drawing surfaces available to host-side apps.

The stock firmware has no third-party app runtime, so a cmfkit app runs on the
phone/PC and renders into firmware screens that accept arbitrary text:

* ``status``  - the music card: two silent, in-place lines (64 B each). Best "app screen".
* ``card``    - a notification: title (20 B) + body (128 B), buzzes the wrist.
* ``ticker``  - the weather widget's city name (32 B), visible on the weather tile/face.
* ``menu``    - the contacts list: up to 20 scrollable rows (32 B name + 25 B detail).
"""

from __future__ import annotations

from ..protocol import payloads as pl
from ..session import Session


class Screen:
    def __init__(self, session: Session) -> None:
        self._s = session
        self._last: dict[str, object] = {}

    def _changed(self, key: str, value: object) -> bool:
        if self._last.get(key) == value:
            return False
        self._last[key] = value
        return True

    async def status(self, line1: str, line2: str = "", playing: bool = True) -> None:
        state = pl.MUSIC_PLAYING if playing else pl.MUSIC_PAUSED
        if self._changed("status", (line1, line2, state)):
            await self._s.set_music(line1, line2, state)

    async def card(self, title: str, body: str = "") -> None:
        await self._s.notify(title, body)

    async def ticker(self, text: str, temp_c: int = 20) -> None:
        if self._changed("ticker", (text, temp_c)):
            await self._s.set_weather(text, temp_c)

    async def menu(self, rows: list[tuple[str, str]] | list[str]) -> None:
        entries = [pl.Contact(*r) if isinstance(r, tuple) else pl.Contact(r) for r in rows]
        if self._changed("menu", entries):
            await self._s.set_contacts(entries)

    async def buzz(self) -> None:
        try:
            await self._s.shell("AT SETMOTOR=1", timeout=2)
        except TimeoutError:
            pass  # SET* commands often execute without echoing OK
