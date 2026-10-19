"""Example third-party app: a lap stopwatch.

Run it against the simulator:

    cmfkit --sim run examples/stopwatch_app.py

or against a real watch:

    cmfkit run examples/stopwatch_app.py
"""

import time

from cmfkit.apps.base import WatchApp


class Stopwatch(WatchApp):
    name = "stopwatch"
    description = "play/pause starts and stops, next records a lap, prev resets"
    tick_interval = 1.0

    async def start(self) -> None:
        self.elapsed = 0.0
        self.started_at: float | None = None
        self.laps: list[float] = []
        await self.render()

    def now(self) -> float:
        running = time.monotonic() - self.started_at if self.started_at else 0.0
        return self.elapsed + running

    @staticmethod
    def fmt(seconds: float) -> str:
        m, s = divmod(int(seconds), 60)
        return f"{m:02d}:{s:02d}"

    async def render(self) -> None:
        state = "running" if self.started_at else "stopped"
        await self.screen.status(f"Stopwatch {self.fmt(self.now())}", f"{state} - {len(self.laps)} laps")

    async def on_button(self, button: str) -> None:
        if button in ("play", "pause"):
            if self.started_at:
                self.elapsed = self.now()
                self.started_at = None
            else:
                self.started_at = time.monotonic()
        elif button == "next" and self.started_at:
            self.laps.append(self.now())
            await self.screen.menu([(f"Lap {i + 1}", self.fmt(t)) for i, t in enumerate(self.laps)])
            await self.screen.card(f"Lap {len(self.laps)}", self.fmt(self.laps[-1]))
        elif button == "prev":
            self.elapsed, self.started_at, self.laps = 0.0, None, []
        await self.render()

    async def tick(self) -> None:
        if self.started_at:
            await self.render()
