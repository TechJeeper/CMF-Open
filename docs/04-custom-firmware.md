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
| Signature check? | The OTA container has CRC32 only. **Boot images can be signed**: the SoC has optional RSA-2048-PSS secure boot (`CONFIG_SOC_SIGN_ENABLE`, see [below](#secure-boot-check)). The community's firmware RE reports no signature | Medium: `cmfkit fw info` on a stock OTA settles it |
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
uv venv --python 3.10 .zenv && source .zenv/bin/activate      # Zephyr 2.7 scripts predate 3.12
SDK=third_party/lv_port_actions_technology
firmware/cmf_hello/setup.sh "$SDK"       # clones the SDK (~1 GB) and assembles app_demo/cmf_hello
uv pip install west -r "$SDK/action_technology_sdk/zephyr/scripts/requirements-base.txt"
source firmware/toolchain-shim.sh        # distro GCC as Zephyr's gnuarmemb toolchain (see script)
cd "$SDK/action_technology_sdk/zephyr"
printf 'BOARD=ats3089c_dev_watch\nAPPLICATION=app_demo\nSUB_APP=cmf_hello\nAPP_CONF=\n' > .build_config
./build.sh                               # or ./build.sh -n to pick interactively
```

`.build_config` skips the SDK's interactive board/app menus. The SDK targets Zephyr
2.7, Armv8-M (`-mcpu=cortex-m33`), and hard-float. With Ubuntu 24.04's GCC 13.2 the
whole tree (802 objects) compiles and links. The shim exists only because Debian keeps
newlib in `/usr/lib/arm-none-eabi`. Without it, the link fails with "uses VFP register
arguments" against the soft-float `libm.a`.

The build writes these files to `application/app_demo/cmf_hello/outdir/ats3089c_dev_watch/`:

| File | What it is |
|---|---|
| `_firmware/bin/app.bin` | The app image (≈830 KB, `ACTH` header, runs from XIP `0x10000000`). This is the only file you replace |
| `_firmware/bin/mbrec.bin`, `recovery.bin` | Dev-board bootloader and recovery. **Never** ship these to the watch |
| `_firmware/*_raw.bin` | Full flash image for SWD (`jflash.bat`, `go.jlink`) |

On containers without `/etc/mtab`, run `sudo ln -sf /proc/self/mounts /etc/mtab` first, or
packaging aborts. The final Windows `.fw` step needs `python2`, but you don't need it:
cmfkit builds the OTA itself (step 4).

The first build targets the **dev board**. Before it can work on the watch, add a board
variant (for example `cmf_watch3pro`) with the panel, touch, and pinmux from step 2.

### 4. Package

Swap your `app.bin` into the stock OTA. Leave everything else alone, so the stock
bootloader, recovery, and resources stay in place. Those are what make a bad app
recoverable.

```bash
cmfkit fw replace stock_ota.bin app.bin path/to/_firmware/bin/app.bin -o cmf_hello_ota.bin
```

`fw replace` keeps `board_name`, bumps `version_code` in both the header and `ota.xml`, and
rewrites the CRCs. It also updates the file's `<partition>` entry in `ota.xml`:
`file_size` gets the stored size, `orig_size` the raw size, and `checksum` the CRC32 of
the raw file, matching the SDK's newer `zephyr/tools/build_ota_image.py`.

If the stock file is LZMA-wrapped, the replacement gets the same wrapping: 32 KiB blocks,
each with the header `'LZMA' | 0x10 | xz_len | raw_len` followed by an XZ stream. Use
`--compress lzma|raw` to override.

### Secure boot check

Every boot file starts with an `ACTH` header (`image_head_t`). After the body come a
*protected* TLV area, covered by the signature, and then a TLV area that holds the
signature itself. A secure-boot build does three things:

* It stores the RSA public key as a `PUBKEY` (0x02) / `PUBKEY_BROM` (0x10) TLV in
  `mbrec.bin`'s protected area.
* It appends an `RSA2048_PSS` (0x08) TLV to every image and sets `flags = 0x4`.
* Its bootloader rejects an `app.bin` whose signature doesn't verify against that key.

The SDK's `ats3085s_dev_watch_sign` board shows the format. `fw info` and `fw replace`
report it for every image in an OTA, unwrapping LZMA first:

```
  boot images:
    mbrec.bin    image 'mbrec' run 0x2ff70039 body 0xeb4  unsigned
    app.bin      image 'b' run 0x100168b9 body 0xc9a4c  unsigned
  -> no signatures: the bootloader will run a self-built app.bin
```

If the stock CMF images say **SIGNED**, OTA sideloading of custom firmware is closed. The
key is CMF's, and `mbrec` is itself signed for the boot ROM (`PUBKEY_BROM`, almost
certainly anchored in eFuse), so swapping keys won't help. In that case, stick to host apps and watchfaces (paths A and B), or use SWD
on a unit where `mbrec` can be rewritten.

Flash encryption is a separate, independent option. The SDK supports an eFuse-keyed
mode (`enable_encryption`, `encrypt.bin`). If it is on, the plaintext raw image from
SWD won't run even with signatures off. `fw scan` on an SWD flash dump shows it: an
encrypted dump has no readable strings past the boot area.

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
