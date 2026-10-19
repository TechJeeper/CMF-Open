# Structured Dials — Persistent Watchfaces with Live Data

The CMF Watch 3 Pro firmware natively supports **structured dials**: full watchfaces with
analog hands, live data widgets, and progress arcs — all rendered **on the watch** without
needing a phone connection. This is the path to "real" persistent apps.

## What's possible today

| Feature | How it works |
|---------|--------------|
| **Analog hands** | Hour/minute/second rotation, rendered by firmware |
| **Live heart rate** | Bound to PPG sensor, updates in real-time |
| **Step count** | Today's steps from accelerometer |
| **Battery %** | Live battery level |
| **Calories burned** | Activity calories |
| **Weather temperature** | From last WEATHER_SET push |
| **Date/time digits** | Multiple formats, firmware-drawn |
| **Progress arcs** | Fill based on value (HR range, goal %) |
| **Goal progress** | Steps/distance/calories vs targets |

## File format (TLV scene graph)

```
36-byte header ‖ TLV widget tree ‖ LZ4-compressed image resources ‖ 36-byte footer
```

### Header

| Offset | Size | Field |
|--------|------|-------|
| 0x00 | 4 | CRC32 of TLV tree |
| 0x04 | 4 | Version (0x00000001) |
| 0x08 | 16 | Dial name (NUL-terminated) |
| 0x18 | 4 | Total size - 36 |
| 0x1c | 4 | Resource section length |
| 0x20 | 12 | ID/hash words |

### TLV Tags

| Tag | Type | Contents |
|-----|------|----------|
| `0x20` | Scene | Root container |
| `0x21` | Screen | Main display (466×466) |
| `0x22` | Screen | Always-on display (AOD) |
| `0x30` | Static | Background image |
| `0x60` | Number | Digit display with data source |
| `0x68` | Group | Container for related widgets |
| `0x70` | Pointer | Rotating hand (hour/min/sec) |
| `0x80` | Arc | Progress arc with value binding |
| `0x81` | Arc | Sector-clipped progress ring |

### Data Source IDs

The firmware's getter table (142 entries at `0x101f371c`) provides these bindings:

| ID | Data | Max | Notes |
|----|------|-----|-------|
| `0x07` | Hour (24h) | 24 | |
| `0x0b` | Minute | 60 | |
| `0x0f` | Second | 60 | |
| `0x0e` | Hour hand angle | 60 | (h%12)*5 + m/12 |
| `0x0a` | Minute hand angle | 60 | m + s/60 |
| `0x72` | Second hand angle | 60 | |
| `0x13` | AM/PM | 2 | Image index |
| `0x16` | Month | 12 | Image index |
| `0x17` | Day of month | 31 | |
| `0x18` | Weekday | 7 | Image index |
| `0x19` | Heart rate | 220 | Live BPM from PPG |
| `0x1b` | Battery % | 100 | |
| `0x24` | Temperature | varies | Weather |
| `0x36` | Steps | 100000 | Today's count |
| `0x25-27` | Goal % | 100 | Steps/dist/cal progress |

### Progress Arc Parameters

Arcs use `0x5a`/`0x5b` child tags with:
- `min(i32)`, `max(i32)` — value range
- `startAngle(i16)`, `endAngle(i16)` — in 0.1° units, 0° = 3 o'clock
- `width(u16)`, `radius(u16)` — arc dimensions

Known ranges:
- HR: min=40, max=220
- Temperature: min=-5, max=41
- Goals: min=0, max=100 (percentage)

## Image Resources

Images are LVGL v8 format with LZ4 block compression:
- RGB565 (cf=4)
- RGB565 + 8-bit alpha (cf=5)
- 4-bit alpha mask (cf=13)
- BGRA8888 (cf=24)

Display: 466×466 round, center (233, 233), radius 233.

## Upload Protocol

Structured dials use `9075` (REPLACE mode), not `9063` (photo APPEND):

1. `8052` INIT_1 → `0052` reply
2. `9075` INIT_2 with `old_id` (must exist in dial list) → `A075` reply
3. Chunked transfer via `9064`/`A064`
4. `A065` finish → `9065` result

To install a new structured dial, first delete an existing one via `9055` (dial list
management), then upload with REPLACE targeting the freed slot.

## Existing Tools

- **[fmc_go](https://github.com/freethinkel/fmc_go)** — Go CLI: decompile/compile watchfaces
- **[FMC Editor](https://fmc.freethinkel.dev/)** — Browser-based visual editor
- **[bin2lvgl](https://github.com/fbiego/esp32-lvgl-watchface)** — Convert to LVGL C code

## Roadmap for CMF-Open

### Phase 1: Structured Dial Viewer
- Parse `.bin` files in the browser
- Render preview with simulated data
- Display widget tree and data bindings

### Phase 2: Dial Editor
- Visual drag-and-drop widget placement
- Data source picker (HR, steps, battery, etc.)
- Hand pivot editor for analog clocks
- Export to valid `.bin`

### Phase 3: Dial Compiler
- TypeScript TLV encoder
- LZ4 compression for images
- CRC32 header generation
- Upload via existing BLE transport

### Phase 4: Template Library
- Pre-built dial templates with live data
- "Smart" faces: HR monitor, fitness tracker, minimal analog
- One-click install of structured dials

## Limitations

- **No custom logic** — widgets are data-bound, not programmable
- **Fixed data sources** — limited to firmware's 142 getters
- **No network** — can't fetch external data after install
- **Replace mode** — must delete existing dial to install new one

## Beyond Structured Dials — Native Apps ARE Possible!

### Custom Firmware: PROVEN (September 2026)

**u/coatti29 successfully flashed custom firmware on CMF Watch Pro Gen 1:**

> "There is **no digital signature** — integrity is checksum-only. I modified the
> firmware, fixed the checksums, and successfully flashed a modified build over
> Bluetooth. The watch now boots a version that doesn't exist officially."

Key findings:
- **No cryptographic signing** — just CRC32/checksum validation
- Bootloader **safely falls back** if OTA fails (non-bricking)
- Must bump version number higher than current
- Same approach should work on Gen 2/3 (ATS3089C)

Tools:
- [cmfparser](https://github.com/ambraglow/cmfparser) — Unpack OTA firmware
- Gadgetbridge — Has firmware flash code (disabled but functional)

### Zephyr LLEXT — Dynamic App Loading

The CMF Watch runs **Zephyr RTOS**, which supports **LLEXT** (Linkable Loadable
Extensions) — runtime loading of precompiled ELF modules:

```
Apps compiled as .llext ELF → Uploaded over BLE → Loaded at runtime → No reboot
```

**ZSWatch project** has a working implementation:
- Apps stored in LittleFS at `/lvgl_lfs/apps/`
- Hot-loaded via `zsw_llext_app_manager_load_app()`
- XIP streaming to external flash (minimal RAM usage)
- Web-based code editor that compiles and deploys over Web Bluetooth!

### Path to Native CMF Watch Apps

| Phase | Goal | Status |
|-------|------|--------|
| 1 | Build custom firmware with LLEXT enabled | Research |
| 2 | Export symbol table for LVGL/BLE/sensors | Research |
| 3 | Create Extension Development Kit (EDK) | Future |
| 4 | Web editor: write C → compile → deploy over BLE | Future |

### Key Community Members

- **u/coatti29** — Custom firmware on WP1
- **ambraglow** — cmfparser, OTA reversing
- **freethinkel** — fmc_go watchface tools
- **jakkra** (ZSWatch) — LLEXT app runtime

### Widget Hijacking (Working Today)

Push arbitrary text to existing data fields:
- Weather city string (`WEATHER_SET_1`)
- Music track/artist fields
- Contacts list (20 × name + number)

These display on existing widgets — useful for quick data display.

## References

- [CMF Watch Pro 2 BLE Protocol](https://github.com/joshuapassos/CMF-Watch-Pro-2-BLE-Protocol)
- [fmc_go Protocol Docs](https://github.com/freethinkel/fmc_go/blob/main/docs/cmf-protocol.md)
- [Actions Technology LVGL Port](https://explore.market.dev/ecosystems/c/projects/lv_port_actions_technology)
- [CMF Firmware Parser](https://github.com/ambraglow/cmfparser)
