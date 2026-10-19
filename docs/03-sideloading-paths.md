# 3. Ways to get your own software onto the watch

The stock firmware has **no third-party app runtime**: every app is compiled into one
image. So "sideloading an app" can mean one of four things. They're listed from safest
to most powerful.

| Path | What runs where | Status | Brick risk |
|---|---|---|---|
| **A. Host-side apps** (`cmfkit run`) | Logic on phone/PC; the watch shows it on its own screens and sends button presses back | **Works today** (protocol verified on Pro 2 by the community; Pro 3 shares it per Gadgetbridge) | None |
| **B. Custom watchfaces** (`cmfkit watchface`) | Data interpreted by the firmware's watchface engine | **Works today** for photo dials; structured dials are proven by the community | Low (bad structured dials can soft-brick) |
| **C. Custom firmware** (`firmware/cmf_hello`, `cmfkit fw`) | Your Zephyr + LVGL code is the whole OS | Toolchain, container format, and packer are ready. **Never flashed to a real Watch 3 Pro yet** | **High** |
| **D. Real sideloadable apps** | Custom firmware (path C) with a loader/interpreter; apps pushed over BLE | Design only (below) | Same as C |

## A. Host-side apps

A `WatchApp` runs in cmfkit on your computer or phone. It draws into the four
firmware screens that accept arbitrary text, and it receives input from the watch's
media controls:

| Surface | Firmware feature reused | Capacity | Notes |
|---|---|---|---|
| `screen.status(l1, l2)` | Music player card | 2 × 64 bytes | Updates silently in place. Best general-purpose "app screen" |
| `screen.card(title, body)` | Notification | 20 + 128 bytes | Buzzes the wrist; kept in the notification list |
| `screen.ticker(text)` | Weather city name | 32 bytes | Shows on the weather tile and weather complications |
| `screen.menu(rows)` | Contacts list | 20 rows × (32 + 25 bytes) | Scrollable list |
| `screen.buzz()` | `AT SETMOTOR=1` | n/a | Haptic ping |
| **Input** `on_button()` | `MUSIC_BUTTON` events | play/pause/next/prev/volume | Plus `find_phone` from the watch's "find phone" tile |

This is the same trick community members used to show football scores in the weather
widget. cmfkit turns it into an app model with a simulator. See
[06-app-development.md](06-app-development.md) for Python apps. The same model in
JavaScript is distributed through the web app store, which handles install, sideloading
and updates from the browser. See [07-web-app-store.md](07-web-app-store.md).

**Limits.** These are text-only fixed layouts. The phone or PC must stay connected, and
cmfkit replaces the Nothing X app while it's connected (only one BLE central can own the
session). The button codes are inferred, so confirm them on your watch with
`cmfkit listen`.

## B. Watchfaces

`cmfkit watchface build photo.jpg` produces the photo-dial container (466² RGB565 + a
270² thumbnail, LZ4). `cmfkit watchface install` uploads it with the same chunked
transfer the official app uses. The firmware draws its own clock on top.

Structured dials (sprites, hands, live complications) are data-driven TLV scenes. They
were fully decoded by
[joshuapassos/CMF-Watch-Pro-2-BLE-Protocol](https://github.com/joshuapassos/CMF-Watch-Pro-2-BLE-Protocol).
Complications bind to firmware getter IDs (HR, steps, battery, ...), so a watchface can
look like a dashboard app, but it can't run code.

## C. Custom firmware

The Actions SDK in
[lvgl/lv_port_actions_technology](https://github.com/lvgl/lv_port_actions_technology)
supports the exact SoC (`ats3089c_dev_watch`). cmfkit adds:

* `firmware/cmf_hello`: a minimal LVGL app (clock, arc, crown counter) assembled on
  top of the SDK template.
* `cmfkit fw info/extract/pack`: reads and writes the **AOTA** OTA container. Its only
  integrity checks are CRC32s; the SDK's on-device updater checks no signatures. The
  tools can repack with a bumped `version_code`, which the updater requires.
* `cmfkit snoop`: decodes an Android HCI capture of an official update, to pin down the
  last unverified step (the BLE firmware-transfer init payloads).

Full procedure, the unknowns, and recovery are in
[04-custom-firmware.md](04-custom-firmware.md).

## D. Design for real sideloadable apps

Once path C boots, real app sideloading is a firmware feature you add yourself. It's
not a hack against stock:

1. **Runtime.** Embed a small interpreter in the custom firmware: JerryScript,
   MicroPython, Berry, or Lua. Bind it to LVGL plus a sensors/BLE API. The SoC's 8 MB
   PSRAM is plenty. Zephyr 2.7 predates LLEXT, so native-code loading would need a
   hand-rolled position-independent loader; an interpreter is the pragmatic choice.
2. **Storage.** Keep apps as files on the FatFS/NAND volume the SDK already mounts.
3. **Transport.** Reuse the existing bulk-transfer state machine (init → watch-driven
   chunk requests → finish) on a new opcode, so `cmfkit` can push `app.js` the same way
   it pushes watchfaces.
4. **Launcher.** An LVGL list of installed apps, opened from the crown.

This keeps the stock BLE protocol (so Gadgetbridge/cmfkit health sync keeps working)
while adding an app store that you control.
