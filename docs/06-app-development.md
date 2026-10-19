# 6. Writing a host-side app

A cmfkit app is a Python class. It runs on your computer (or a phone with Python via
Termux/BlueZ) while connected to the watch. Read
[03-sideloading-paths.md](03-sideloading-paths.md) first for what the watch can show.

## Skeleton

```python
from cmfkit.apps.base import WatchApp


class Hello(WatchApp):
    name = "hello"
    tick_interval = 5.0  # seconds between tick() calls; None disables ticking

    async def start(self):
        self.count = 0
        await self.screen.status("Hello watch", "press next")

    async def on_button(self, button):  # play pause next prev vol_up vol_down find_phone
        if button == "next":
            self.count += 1
            await self.screen.status(f"Pressed {self.count}x", "cmfkit")
            if self.count == 5:
                await self.screen.card("Milestone", "Five presses!")

    async def tick(self):
        pass
```

```bash
cmfkit --sim run hello.py           # simulated watch; type next/play/... + Enter
cmfkit run hello.py                 # real watch over BLE
cmfkit run hello.py:Hello extra args   # pick a class, pass args (self.args)
```

`self.screen` API:

| Call | Shows up as | Budget |
|---|---|---|
| `await status(line1, line2="", playing=True)` | Music screen | 64 B per line, updates in place silently |
| `await card(title, body="")` | Notification + vibration | 20 B title, 128 B body |
| `await ticker(text, temp_c=20)` | Weather tile city name | 32 B |
| `await menu([(name, detail), ...])` | Contacts list | 20 rows, 32 B + 25 B |
| `await buzz()` | Vibration | n/a |

Text is UTF-8 and truncated by bytes. Unchanged `status`/`ticker`/`menu` calls are
deduplicated, so you can call them every tick without spamming the radio.

## Built-in examples

| App | Shows | Buttons |
|---|---|---|
| `pomodoro [focus_min] [break_min]` | Countdown on the music card, cards at phase changes | play/pause toggle, next skips, prev restarts |
| `navigate [route.txt]` | Turn-by-turn steps (`instruction\|distance` per line) | next/prev |
| `ticker [--every N] <shell command>` | Command output on the weather tile and music card | next refreshes |
| `checklist [items.txt]` | Items in the contacts list, cursor on the music card | play ticks, next/prev move |
| `examples/stopwatch_app.py` | Lap stopwatch (a third-party-style app file) | play/pause, next = lap, prev = reset |

## Testing

`SimWatch` records everything the app displays in `watch.state`, so apps are
unit-testable:

```python
from cmfkit.apps.base import AppRunner
from cmfkit.session import Session
from cmfkit.transport.sim import SimWatch

watch = SimWatch()
await watch.connect()
session = Session(watch)
await session.pair()
runner = AppRunner(session, Hello, [])
# run runner.run(...) in a task, then watch.press("next") and assert on watch.state.music
```

See `tests/test_sim_session.py::test_app_receives_watch_buttons`.

## Real-watch notes

* Disconnect Nothing X first, or turn off its Bluetooth access. The watch serves one
  phone session at a time.
* The first `cmfkit` command pairs automatically using the AT secret and stores the key
  in `~/.config/cmfkit/devices.json`. Later runs reconnect with that key.
* On Linux, BlueZ must allow a large MTU (the default is fine with BlueZ 5.50+). An MTU
  of 23 is rejected because encrypted frames can't fit.
