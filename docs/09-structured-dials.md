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

## Beyond Structured Dials

For truly custom apps (arbitrary code on the watch), the paths are:

1. **Custom firmware** — Actions SDK with `ats3089c_dev_watch` board target exists,
   but flashing risks permanent brick (no recovery mode). RapidZapper halted work
   on this for safety reasons.

2. **Widget hijacking** — Push data via weather city string, music track/artist,
   or contacts list. These fields accept arbitrary text and display on existing
   widgets. Proven working but limited.

3. **MicroEJ VEE Wear** — Actions Technology partnered with MicroEJ for Java-based
   app deployment on ATS3085S/E. Unknown if applicable to CMF's ATS3089C.

## References

- [CMF Watch Pro 2 BLE Protocol](https://github.com/joshuapassos/CMF-Watch-Pro-2-BLE-Protocol)
- [fmc_go Protocol Docs](https://github.com/freethinkel/fmc_go/blob/main/docs/cmf-protocol.md)
- [Actions Technology LVGL Port](https://explore.market.dev/ecosystems/c/projects/lv_port_actions_technology)
- [CMF Firmware Parser](https://github.com/ambraglow/cmfparser)
