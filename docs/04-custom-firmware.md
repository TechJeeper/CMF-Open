# 4. Custom firmware (path C)

> **Read this first.** Nobody has published a custom firmware booting on a Watch 3 Pro
> yet. Everything below is a researched plan with tooling, not a proven one-click flow.
> A wrong image can leave the watch dead with no recovery short of opening it and using
> SWD. Practise on a second watch.

## What is known

| Question | Answer | Confidence |
|---|---|---|
| Which SDK? | Actions Zephyr 2.7 SDK in [lvgl/lv_port_actions_technology](https://github.com/lvgl/lv_port_actions_technology), board `ats3089c_dev_watch` | High: same SoC, framebuffer size, Zephyr/LVGL/SDFS stack |
| OTA container | Actions `AOTA` (see below) | High: matches published dump offsets; verify with `cmfkit fw info` on a real CMF OTA |
| Signature check? | None in the SDK updater (CRC32 only). The community's firmware RE reports no signature either | Medium: CMF could have added one. Look for `sign`/`rsa`/`ecdsa` near the OTA code in `app.bin` |
| Update gates | `board_name` must equal the running firmware's; `version_code` must be higher | High (SDK `ota_upgrade.c`) |
| BLE transfer opcodes | `FFFF:9052` init1, `9040` init2 (version bytes), watch-driven `A042` chunk requests, `9042` plaintext chunks, `9041` finish | Medium: mapped from the official APK, never field-tested |
| Board specifics (panel, touch, PMIC, pins) | **Unknown.** Must come from the stock image | n/a |

## The AOTA container

```
0x000 hdr      'AOTA' | header_crc | hdr_ver | hdr_size | file_cnt | flag | dir_off | data_off | data_size | data_crc
0x040 new_ver  version_name[32] | board_name[32] | hw_ver[4] | version_code u32 | rsv[8] | build_time[16]
0x0a0 old_ver  (delta/patch images only)
0x200 dir[16]  filename[12] | rsv[4] | offset | length | rsv[4] | crc32
0x400 data     ota.xml first, then images, each padded to 512 B
```

`header_crc` covers `[8, 0x400)`, `data_crc` covers `[data_off, data_size)`, and each
file has its own CRC32. cmfkit's implementation follows the **C structs the device
reads**. The SDK's own `build_ota_image.py` writes the version block at stale offsets,
so a header built with it shows `version_code 0`; the updater uses `ota.xml`.
cmfkit's tools were cross-checked against that script in both directions.

```bash
cmfkit fw info stock_ota.bin              # header, files, CRC status
cmfkit fw extract stock_ota.bin stock/    # ota.xml, app.bin, res, ... + _aota.txt metadata
cmfkit fw pack stock/ --bump -o mod.bin   # repack, version_code + 1 (header and ota.xml)
```

## Step-by-step plan

### 1. Get a stock OTA image

See [05-recon-playbook.md](05-recon-playbook.md). With a rooted phone, Nothing X caches
it under `/data/data/com.nothing.smartcenter/app_flutter/ota/` (the file has a hash
name and no `.bin` extension).

### 2. Fingerprint the board

```bash
cmfkit fw extract stock_ota.bin stock/
cmfkit fw scan stock/app.bin        # Zephyr/LVGL versions, panel + touch driver names, AT commands
```

The scan looks for every display/touch driver the Actions SDK ships (`icna3310b`,
`rm690b0`, `sh8601z0`, `co5300`, `cst816s`, `ft3168`, ...). A hit tells you which
driver to enable. Also diff the stock `ota.xml` partition table against the SDK
board's `firmware.xml`, and pull the board name from `fw info`; the image must carry
the **same `board_name`**.

Then map GPIOs (panel reset/TE, touch IRQ, motor, PPG, GNSS UART) by finding the
pinmux tables in `app.bin` (IDA/Ghidra, Arm Thumb, base `0x10000000` XIP per community
disassembly). Compare against `zephyr/boards/arm/ats3089c_dev_watch/board.c` to spot the
layout.

### 3. Build the app

```bash
sudo apt install gcc-arm-none-eabi cmake ninja-build device-tree-compiler
pip install pyelftools pyyaml   # plus anything the SDK's scripts/requirements*.txt asks for
firmware/cmf_hello/setup.sh     # clones the SDK and assembles app_demo/cmf_hello
cd third_party/lv_port_actions_technology/action_technology_sdk/zephyr
source zephyr-env.sh
export ZEPHYR_TOOLCHAIN_VARIANT=gnuarmemb GNUARMEMB_TOOLCHAIN_PATH=/usr
./build.sh -n                   # board ats3089c_dev_watch -> app_demo -> cmf_hello
```

The first build targets the **dev board**. Before it can work on the watch, add a board
variant (for example `cmf_watch3pro`) with the panel, touch, and pinmux from step 2.

### 4. Package

Repack the SDK's output into AOTA with the stock `board_name` and a higher
`version_code`. Start from the stock image's file list: replace only `app.bin` and keep
the bootloader, recovery, and resources untouched. Keeping the stock bootloader and
recovery is what makes a bad app recoverable.

### 5. Transfer, in order of risk

1. **Capture an official update first** (`cmfkit snoop btsnoop_hci.log --authkey ...`).
   This pins down the exact `9052`/`9040` payloads and chunk cadence, so you can
   replay the official image with cmfkit before trying a custom one.
2. **Replay the stock image** (unmodified, but repacked by cmfkit with `--bump`). If the
   watch accepts it, your packer and transfer are correct and there's no signature.
3. **Flash the modified `app.bin`.** Do this only after step 2 succeeds.
4. **SWD fallback.** Open the watch, wire J-Link to the UART0 pads (SWDIO ↔ RX, SWCLK ↔
   TX, GND), install the SDK's `tools/JLinkDevices/Actions` definitions, then
   `west flash -r jlink`. This is also the unbrick path.

cmfkit deliberately has no "flash firmware" command until steps 1 and 2 have been done
on real hardware.

## Recovery notes

* The SDK keeps a separate `recovery.bin` and an A/B-style OTA flow
  (`ota_breakpoint`, `ota_upgrade`). If CMF kept this, a failed app image falls back to
  recovery mode. Don't overwrite the bootloader or recovery partitions.
* `FACTORY_RESET (009A:0001)` works over BLE and fixes bad settings, but not bad
  firmware.
* Last resort: SWD + J-Link, as above.
