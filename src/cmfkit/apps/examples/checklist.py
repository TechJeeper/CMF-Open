from __future__ import annotations

from pathlib import Path

from ..base import WatchApp


class Checklist(WatchApp):
    """A checklist. All items appear in the contacts list; the music card shows the
    current item. Play ticks it off, next/prev move the cursor.

    Args: optional path to a text file with one item per line.
    """

    name = "checklist"
    description = "tick items off with the media buttons"
    tick_interval = None

    async def start(self) -> None:
        if self.args:
            items = [ln.strip() for ln in Path(self.args[0]).read_text().splitlines() if ln.strip()]
        else:
            items = ["Passport", "Charger", "Headphones", "Water bottle", "Keys"]
        self.items = items[:20]
        self.done = [False] * len(self.items)
        self.cursor = 0
        await self.render()

    async def render(self) -> None:
        rows = [("[x] " if d else "[ ] ") + item for item, d in zip(self.items, self.done, strict=True)]
        await self.screen.menu(rows)
        left = self.done.count(False)
        mark = "done" if self.done[self.cursor] else "todo"
        await self.screen.status(self.items[self.cursor], f"{mark} - {left} left")

    async def on_button(self, button: str) -> None:
        if button in ("play", "pause"):
            self.done[self.cursor] = not self.done[self.cursor]
            if all(self.done):
                await self.screen.card("Checklist", "All items done!")
        elif button == "next":
            self.cursor = (self.cursor + 1) % len(self.items)
        elif button == "prev":
            self.cursor = (self.cursor - 1) % len(self.items)
        await self.render()
