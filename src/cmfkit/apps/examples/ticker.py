from __future__ import annotations

import asyncio
import shlex

from ..base import WatchApp


class Ticker(WatchApp):
    """Mirror the output of a shell command onto the weather widget and music card.

    Args: a shell command (default: ``date +%H:%M:%S``) and an optional
    ``--every N`` refresh period in seconds.
    """

    name = "ticker"
    description = "show a shell command's output on the watch"

    async def start(self) -> None:
        args = list(self.args)
        if "--every" in args:
            i = args.index("--every")
            self.tick_interval = float(args[i + 1])
            del args[i : i + 2]
        else:
            self.tick_interval = 5.0
        self.command = " ".join(args) or "date +%H:%M:%S"

    async def tick(self) -> None:
        proc = await asyncio.create_subprocess_shell(
            self.command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
        )
        out, _ = await proc.communicate()
        lines = [ln.strip() for ln in out.decode(errors="replace").splitlines() if ln.strip()] or ["(no output)"]
        await self.screen.ticker(lines[0])
        await self.screen.status(lines[0], lines[1] if len(lines) > 1 else shlex.split(self.command)[0])

    async def on_button(self, button: str) -> None:
        if button == "next":
            await self.tick()
