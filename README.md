# cmfkit: develop and sideload software for the CMF Watch 3 Pro

The CMF Watch 3 Pro (by Nothing) has no app store and no SDK. This repo collects what
it actually runs, from research of the firmware, the official app, and the vendor
SDK. It also ships a toolkit for every practical way to get your own software onto it:

1. **Host-side apps**, working today. Write a Python `WatchApp`; it draws onto the
   watch's music, notification, weather, and contacts screens and reacts to the
   watch's buttons. Includes a Pomodoro timer, turn-by-turn navigation, a shell-output
   ticker, a checklist, and a stopwatch.
2. **Custom watchfaces**, working today. Turn any image into a watchface and install it
   over Bluetooth.
3. **Custom firmware**, ready to research. Includes a Zephyr + LVGL app for the
   watch's exact SoC (Actions ATS3089C), tools that read and repack the watch's `AOTA`
   firmware container, and a capture decoder for working out the last unknown step.

Everything talks to the watch through an independent implementation of the
reverse-engineered BLE protocol. That includes pairing through the factory AT shell,
so no Nothing account or cloud key is needed. A built-in **simulated watch** lets you
develop and test with no hardware.

> **Status.** The protocol code follows the community's on-device-verified Watch Pro 2
> spec, which Gadgetbridge uses unchanged for the Watch 3 Pro. cmfkit has been tested
> end-to-end against its simulator but **not yet against a physical Watch 3 Pro**. The
> unverified details are listed in [docs/02-ble-protocol.md](docs/02-ble-protocol.md).

## Findings at a glance

| | |
|---|---|
| SoC | Actions Technology **ATS3089C** (202 MHz Arm MCU + DSP, 2.5D GPU, 8 MB PSRAM) |
| OS | **Zephyr RTOS** 2.7-based Actions SDK, **LVGL** UI, one monolithic `app.bin` with no app loader |
| Display | 466 × 466 round AMOLED, RGB565 |
| Phone link | BLE GATT: framed commands with AES-128-CBC, a plain-text factory **AT shell**, and a bulk-data channel |
| Pairing | `AT GETSECRET` → SHA-256 challenge → per-session AES key |
| Firmware updates | Actions **AOTA** container, CRC32 only; must match `board_name` and increase `version_code`. The SoC *can* enforce RSA-2048 signed boot images, and `cmfkit fw info` reports whether a stock OTA does |
| Vendor SDK | Public: [lvgl/lv_port_actions_technology](https://github.com/lvgl/lv_port_actions_technology), with an `ats3089c_dev_watch` board |

Details: [hardware & OS](docs/01-hardware-and-os.md) ·
[BLE protocol](docs/02-ble-protocol.md) ·
[**sideloading paths**](docs/03-sideloading-paths.md) ·
[custom firmware](docs/04-custom-firmware.md) ·
[recon playbook](docs/05-recon-playbook.md) ·
[writing apps](docs/06-app-development.md)

## Install

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/). For real hardware you also
need a Bluetooth LE adapter (BlueZ on Linux, or macOS/Windows via
[bleak](https://github.com/hbldh/bleak)).

```bash
uv sync
uv run cmfkit --help
```

## Try it without a watch

`--sim` swaps Bluetooth for the in-process simulated watch, which prints what the real
screen would show:

```bash
uv run cmfkit --sim info
uv run cmfkit --sim notify "Hello" "from cmfkit"
uv run cmfkit --sim run pomodoro 25 5        # type play / next / prev + Enter to press buttons
uv run cmfkit --sim run navigate
uv run cmfkit --sim run examples/stopwatch_app.py
uv run cmfkit watchface build photo.jpg -o face.bin --preview face.png
uv run cmfkit --sim watchface install face.bin
```

## Use a real watch

Disconnect the Nothing X app first, since the watch serves one phone session at a time.

```bash
uv run cmfkit scan                     # find "CMF Watch 3 Pro-XXXX"
uv run cmfkit pair                     # reads the secret over the AT shell, stores the key
uv run cmfkit info                     # firmware, serial, battery
uv run cmfkit listen                   # print button codes as you press the watch's media controls
uv run cmfkit run checklist items.txt
uv run cmfkit watchface install photo.jpg --style 2 --color F800
uv run cmfkit at GETBATLV              # raw factory shell
```

Add `--address AA:BB:...` to pick a specific watch, and `-v`/`-vv` to log every frame.

## Firmware research tools

```bash
uv run cmfkit fw info ota.bin                 # AOTA header, files, CRCs, and whether boot images are signed
uv run cmfkit fw extract ota.bin out/         # unpack ota.xml, app.bin, ...
uv run cmfkit fw scan out/app.bin             # Zephyr/LVGL/SoC markers, panel & touch driver names, AT commands
uv run cmfkit fw pack out/ --bump -o new.bin  # repack with CRCs fixed and version_code + 1
uv run cmfkit fw replace ota.bin app.bin my_app.bin -o new.bin  # swap one file, fix ota.xml, bump version
uv run cmfkit snoop btsnoop_hci.log --authkey <hex>   # decode an Android HCI capture of Nothing X
firmware/cmf_hello/setup.sh                   # assemble the Zephyr/LVGL demo inside the Actions SDK (builds to app.bin)
```

Read [docs/04-custom-firmware.md](docs/04-custom-firmware.md) before flashing
anything. A bad image can brick the watch.

## Layout

```
src/cmfkit/
  protocol/   frame codec, crypto, opcodes, payload builders
  transport/  BLE (bleak) and the simulated watch
  session.py  pairing, login, commands, watchface upload
  apps/       WatchApp runtime, screen surfaces, built-in apps
  watchface/  photo watchface encoder/decoder
  firmware/   AOTA container, LZMA/file-swap and boot-image signature tools, triage scanner
  capture/    btsnoop HCI log decoder
firmware/cmf_hello/   custom Zephyr + LVGL firmware app (Actions SDK, ats3089c)
examples/             third-party style app
docs/                 research write-ups
tests/                pytest suite (runs entirely on the simulator)
```

## Development

```bash
uv run pytest
uv run ruff check . && uv run ruff format --check .
```

## Credits and prior work

* [joshuapassos/CMF-Watch-Pro-2-BLE-Protocol](https://github.com/joshuapassos/CMF-Watch-Pro-2-BLE-Protocol):
  the protocol and watchface specification that cmfkit implements.
* [Gadgetbridge](https://gadgetbridge.org/gadgets/wearables/nothing/): the open
  companion app with CMF support; it confirmed the Watch 3 Pro shares the Pro 2 protocol.
* [ambraglow](https://ambraglow.org/blog/nothing-x/a-look-into-the-nothing-x-smartwatch-app/)
  (Nothing X / OTA research) and
  [whatotter](https://github.com/whatotter/cmf-watch-firmware) (Watch Pro 2 firmware
  dump). Their findings are cited; none of their code is included.
* [lvgl/lv_port_actions_technology](https://github.com/lvgl/lv_port_actions_technology):
  the Apache-2.0 Actions SDK that `firmware/cmf_hello` builds on.

Not affiliated with Nothing or CMF. Use at your own risk.
