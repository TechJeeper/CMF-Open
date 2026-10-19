from __future__ import annotations

from pathlib import Path

from ..base import WatchApp

DEMO_ROUTE = [
    "Head north on Main St|200 m",
    "Turn right onto Oak Ave|450 m",
    "Keep left at the fork|1.2 km",
    "Turn left onto Station Rd|300 m",
    "Arrive at destination|",
]


class Navigate(WatchApp):
    """Turn-by-turn directions. Each step buzzes as a card; next/prev step through.

    Args: optional path to a text file with one ``instruction|distance`` per line.
    """

    name = "navigate"
    description = "turn-by-turn steps from a file; next/prev to move"
    tick_interval = None

    async def start(self) -> None:
        lines = Path(self.args[0]).read_text().splitlines() if self.args else DEMO_ROUTE
        self.steps = [tuple((ln.split("|", 1) + [""])[:2]) for ln in lines if ln.strip()]
        self.index = 0
        await self.show()

    async def show(self) -> None:
        text, dist = self.steps[self.index]
        n = f"{self.index + 1}/{len(self.steps)}"
        await self.screen.status(text, f"{dist}  ({n})" if dist else n)
        await self.screen.card(dist or "Arrived", text)

    async def on_button(self, button: str) -> None:
        if button == "next" and self.index < len(self.steps) - 1:
            self.index += 1
        elif button == "prev" and self.index > 0:
            self.index -= 1
        else:
            return
        await self.show()
