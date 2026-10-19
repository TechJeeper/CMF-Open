# 1. Hardware and OS

What the CMF Watch 3 Pro actually is, assembled from teardown-free sources: OTA
firmware analysis by the community, the official app, the Actions vendor SDK, and
public spec sheets.

## Summary

| | |
|---|---|
| Model | CMF by Nothing Watch 3 Pro, model **D399** (July 2025). Same platform as the Watch Pro 2 |
| SoC | **Actions Technology ATS3089C**, Bluetooth dual-mode watch SoC |
| CPU / DSP | Arm MCU @ 202 MHz that Actions markets as "MStar". The vendor SDK compiles for it with **`-mcpu=cortex-m33 -mfpu=fpv5-sp-d16 -mfloat-abi=hard`** (Armv8-M Mainline with a single-precision FPU; SoC series "Leopard"). Plus a 202 MHz DSP |
| GPU | 2D/2.5D (VGLite-compatible) with JPEG decode |
| RAM | 1168 KB SRAM + 8 MB PSRAM (on package) |
| Flash | 4 MB DTR SPI NOR on package, plus external NAND (the spec sheet says 256 MB storage) |
| Display | 1.43" round AMOLED, **466 × 466**, RGB565 framebuffer (434 312 bytes) |
| Radio | Bluetooth 5.3 BLE + Classic (calls/A2DP), dual-band L1+L5 GNSS |
| Sensors | PPG (HR/SpO2), accelerometer, gyroscope, ambient light |
| Other | Mic, speaker, linear vibration motor, crown key. No Wi-Fi, NFC, LTE, or USB data |
| OS | **Zephyr RTOS** (the Actions SDK is Zephyr 2.7) with an **LVGL** UI and Actions' framework (SDFS resource FS, FatFS, NVRAM properties) |

## Evidence trail

* **SoC and OS.** Unpacked Watch Pro 2 and Watch 3 Pro OTA images contain
  `ATS3089C`, Zephyr, and LVGL strings and an unobfuscated `app.bin`.
  ([ambraglow/cmfparser](https://github.com/ambraglow/cmfparser),
  [whatotter/cmf-watch-firmware](https://github.com/whatotter/cmf-watch-firmware))
* **Vendor SDK match.** The public
  [lvgl/lv_port_actions_technology](https://github.com/lvgl/lv_port_actions_technology)
  repo ships the Actions Zephyr SDK with an **`ats3089c_dev_watch`** board. Its
  template sets `CONFIG_UI_MEM_BLOCK_SIZE=434312`, which is 466 × 466 × 2. That's the
  same raw size as the watch's own photo-watchface framebuffer, so the CMF firmware is
  almost certainly built from this SDK lineage.
* **OTA container.** The SDK's OTA format (`AOTA`) has a 1 KiB header, a file directory
  at `0x200`, and the first file (`ota.xml`) at `0x400`. The Watch Pro 2 dump write-up
  found an XML manifest at `0x400` and filename-like text at `0x200`, which matches.
  See [04-custom-firmware.md](04-custom-firmware.md).
* **Conflicting report.** One Gadgetbridge issue comment claims a Jieli AC7012 running
  "WeWear". Every firmware-level analysis and the vendor SDK match point to Actions
  ATS3089C + Zephyr, so cmfkit treats that comment as a misidentification. Check it
  against your own OTA image with `cmfkit fw scan`.

## How the stock firmware is organised

* **One monolithic image.** All "apps" (workouts, timer, weather, factory test, ...) are
  compiled into `app.bin`. **There is no dynamic app loader and no app store.** That's
  why "sideloading" needs either a host-side runtime (path A) or new firmware (path C).
  See [03-sideloading-paths.md](03-sideloading-paths.md).
* **Resources** (images, fonts, styles) live in SDFS/RES packs. Watchfaces are
  data-driven binaries interpreted by the firmware's `WFManager`, not code.
* **Hidden factory test app.** In Settings, tap the firmware version repeatedly.
* **AT shell over BLE.** A plain-text factory shell (`AT GETSECRET`, `GETVERSION`,
  `GETBATLV`, `GETGSENSOR`, `SETMOTOR=1`, ...) is exposed on its own GATT
  characteristic. That's how cmfkit pairs without the vendor cloud.
* **Firmware-gated features.** ChatGPT voice, blood pressure, and NFC/Alipay UIs exist
  in firmware but are switched off by SKU/region flags in NVRAM/eFuse.

## Debug hardware

The Actions SDK documents SWD over the **UART0** pins (SWDIO ↔ UART0 RX, SWCLK ↔
UART0 TX) and ships J-Link device definitions for ATS30xx. The stock firmware has UART
strings (`uart0..2`), so test pads are likely on the PCB. Reaching them means opening
the watch, which voids the IP68 rating.
