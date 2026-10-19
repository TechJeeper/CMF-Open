from __future__ import annotations

import time

from ..base import WatchApp


class Pomodoro(WatchApp):
    """Focus timer on the music card. Play/pause toggles, next skips the phase."""

    name = "pomodoro"
    description = "25/5 focus timer; play/pause to toggle, next to skip"

    PHASES = [("Focus", 25 * 60), ("Break", 5 * 60)]

    async def start(self) -> None:
        if self.args:
            focus = int(self.args[0]) * 60
            rest = int(self.args[1]) * 60 if len(self.args) > 1 else self.PHASES[1][1]
            self.PHASES = [("Focus", focus), ("Break", rest)]
        self.phase = 0
        self.remaining = float(self.PHASES[0][1])
        self.paused = True
        self.rounds = 0
        self._last = time.monotonic()
        await self.render()

    async def render(self) -> None:
        label, _ = self.PHASES[self.phase]
        mins, secs = divmod(int(self.remaining), 60)
        state = "paused" if self.paused else f"{self.rounds} done"
        await self.screen.status(f"{label} {mins:02d}:{secs:02d}", f"Pomodoro - {state}", playing=not self.paused)

    async def advance(self) -> None:
        if self.phase == 0:
            self.rounds += 1
        self.phase = (self.phase + 1) % len(self.PHASES)
        label, length = self.PHASES[self.phase]
        self.remaining = float(length)
        await self.screen.card("Pomodoro", f"{label} time - {length // 60} min")

    async def on_button(self, button: str) -> None:
        if button in ("play", "pause"):
            self.paused = not self.paused
        elif button == "next":
            await self.advance()
        elif button == "prev":
            self.remaining = float(self.PHASES[self.phase][1])
        await self.render()

    async def tick(self) -> None:
        now = time.monotonic()
        if not self.paused:
            self.remaining -= now - self._last
            if self.remaining <= 0:
                await self.advance()
        self._last = now
        await self.render()
