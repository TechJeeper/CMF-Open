# Native Apps on CMF Watch — The Path Forward

## TL;DR

**Native apps on CMF Watch ARE possible.** The firmware uses:
- **No digital signatures** — checksum-only integrity
- **Zephyr RTOS** — which supports dynamic app loading via LLEXT
- **Safe bootloader** — falls back on bad OTA (non-bricking)

Custom firmware has been **successfully flashed** on CMF Watch Pro Gen 1 (September 2026).

## Current State of the Art

### What's Been Proven

| Milestone | Status | Who |
|-----------|--------|-----|
| Firmware OTA format reversed | ✅ Done | ambraglow, coatti29 |
| Custom firmware flashed (Gen 1) | ✅ Done | coatti29 |
| Watchface format fully decoded | ✅ Done | joshuapassos, freethinkel |
| Structured dials with live data | ✅ Done | Community |
| Dynamic app loading (LLEXT) | ✅ Done (ZSWatch) | jakkra |
| LLEXT on CMF Watch | 🔬 Research | TBD |

### Firmware Architecture

```
firmware.bin (AOTA package)
├── TEMP.bin (AOTA)
│   ├── app.bin (ACTH) ← Zephyr + LVGL, ARM Cortex-M Thumb
│   └── sdfs.bin       ← RF/mic calibration
├── res.bin            ← Watchfaces, fonts, icons, strings
├── fonts.bin          ← Unicode font (~5 MB)
├── res_b.bin          ← Boot/poweroff animations
└── AGPS data
```

**Integrity:** Nested CRC32/checksum only — no RSA/ECDSA signatures.

**Version gate:** OTA only applies if `new_version > current_version`.

## The LLEXT Path

Zephyr's **LLEXT** (Linkable Loadable Extensions) enables runtime app loading:

```c
// Load an app from filesystem
struct llext_loader loader = LLEXT_FS_LOADER("/apps/myapp.llext");
struct llext *ext;
llext_load(&loader, "myapp", &ext, NULL);

// Find and call the entry point
void (*entry)(void) = llext_find_sym(ext, "app_entry");
entry();

// Unload when done
llext_unload(&ext);
```

### How ZSWatch Does It

1. Apps compiled as position-independent `.llext` ELF shared objects
2. Stored in LittleFS at `/lvgl_lfs/apps/`
3. Loaded at boot or hot-loaded at runtime
4. Apps call `app_entry()` which registers with app manager
5. Upload new apps over BLE/USB without rebooting

### Requirements for CMF Watch

To enable LLEXT on CMF Watch, the firmware needs:

1. **LLEXT subsystem enabled** in Kconfig
2. **Symbol table exported** for app APIs (LVGL, k_sleep, sensors, etc.)
3. **Filesystem access** for storing `.llext` files
4. **BLE/USB upload handler** for receiving apps

## Implementation Roadmap

### Phase 1: Custom Firmware Foundation

**Goal:** Build and flash minimal custom firmware

1. Obtain firmware dump (OTA URL or rooted device)
2. Use cmfparser to extract components
3. Modify app.bin (e.g., change version string)
4. Fix all checksums in the chain
5. Flash via Gadgetbridge (re-enable OTA code)
6. Verify watch boots custom build

**Risk:** Low — bootloader falls back on failure

### Phase 2: Enable LLEXT

**Goal:** Add dynamic app loading to firmware

1. Obtain Actions SDK (`lv_port_actions_technology`)
2. Enable LLEXT in Kconfig:
   ```
   CONFIG_LLEXT=y
   CONFIG_LLEXT_TYPE_ELF_RELOCATABLE=y
   ```
3. Export required symbols via `EXPORT_SYMBOL()`:
   - LVGL: `lv_obj_create`, `lv_label_set_text`, etc.
   - Zephyr: `k_sleep`, `k_thread_create`, etc.
   - CMF: sensor APIs, BLE APIs
4. Add app loader service (scan `/apps/`, load on boot)
5. Add BLE handler for app upload

### Phase 3: Extension Development Kit (EDK)

**Goal:** Let developers build apps without full SDK

Zephyr's EDK generates a standalone package containing:
- Exported headers
- Symbol tables
- Compiler flags
- Linker scripts

Developers can compile `.llext` apps with just:
```bash
arm-none-eabi-gcc -shared -fPIC -o myapp.llext myapp.c -I edk/include
```

### Phase 4: Web-Based Development

**Goal:** Write, compile, deploy from browser

ZSWatch has a working prototype:
1. Monaco editor (VS Code engine) in browser
2. Backend API with ARM cross-compiler
3. Web Bluetooth for app upload
4. Live deployment without cables

## App API Design

### Minimal App Structure

```c
#include <zephyr/kernel.h>
#include <lvgl.h>
#include "cmf_app.h"

static lv_obj_t *screen;

void app_entry(void) {
    // Register with app manager
    cmf_app_register("My App", "1.0", app_start, app_stop);
}

void app_start(void) {
    screen = lv_obj_create(lv_scr_act());
    lv_obj_t *label = lv_label_create(screen);
    lv_label_set_text(label, "Hello from native app!");
}

void app_stop(void) {
    lv_obj_del(screen);
}
```

### Available APIs (Proposed)

| Category | APIs |
|----------|------|
| **UI** | LVGL (lv_obj_*, lv_label_*, lv_img_*, etc.) |
| **System** | k_sleep, k_timer, k_work |
| **Sensors** | Heart rate, accelerometer, GPS |
| **BLE** | Send notifications, receive data |
| **Storage** | Key-value store, filesystem |

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Bricking | Bootloader fallback; test on spare watch first |
| ABI changes | Version the EDK; check compatibility at load |
| Flash exhaustion | Limit app count; report space in UI |
| Power drain | XIP for code; internal flash for callbacks |

## Get Involved

### Resources

- [cmfparser](https://github.com/ambraglow/cmfparser) — OTA unpacker
- [CMF-Watch-Pro-2-BLE-Protocol](https://github.com/joshuapassos/CMF-Watch-Pro-2-BLE-Protocol)
- [lv_port_actions_technology](https://github.com/lvgl/lv_port_actions_technology) — Actions SDK
- [ZSWatch LLEXT PR](https://github.com/ZSWatch/ZSWatch/pull/526) — Reference implementation
- [Zephyr LLEXT docs](https://docs.zephyrproject.org/latest/services/llext/)

### Community

- **r/CMFTech** — Reddit community
- **r/Gadgetbridge** — Gadgetbridge community
- **Nothing Community** — Official forums

### What You Can Do

1. **Get a spare watch** — Don't test on your daily driver
2. **Dump your firmware** — Share OTA files for analysis
3. **Learn the SDK** — Try building hello_world for ATS3089C
4. **Document findings** — Every bit of RE helps

## Timeline

This is a community effort. No promises on dates, but the technical path is clear:

1. ✅ Firmware format understood
2. ✅ Custom firmware proven on Gen 1
3. 🔬 LLEXT integration (research phase)
4. 📋 EDK creation (future)
5. 📋 Web editor (future)

**The door is open. Let's walk through it.**
