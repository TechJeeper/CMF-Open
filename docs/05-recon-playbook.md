# 5. Recon playbook

Techniques for extending the reverse engineering yourself. Most need only a phone.

## Pull firmware and watchfaces from Nothing X

The app downloads OTA images and watchfaces before pushing them. On a **rooted**
Android phone:

```
/data/data/com.nothing.smartcenter/app_flutter/ota/                     # OTA image (hash name, no extension)
/data/data/com.nothing.smartcenter/app_flutter/dial/market/dial_file/   # watchface_<hash>.bin
/data/data/com.nothing.smartcenter/app_flutter/epo/lto/                 # GNSS assistance data
```

Tip: delay accepting an update so the image stays cached. Without root, the community
found the download URLs by hooking the app (below) and fetching them directly.

## Make Nothing X log everything (Frida)

The app routes its logging through `com.nothing.log.Logger`. Forcing `isCanLogger` and
`isDebug` to return `true` turns on file and `adb logcat` output, which includes
network requests such as OTA URLs:

```js
Java.perform(() => {
  const L = Java.use("com.nothing.log.Logger");
  L.isCanLogger.overloads.forEach(o => o.implementation = function () { return true; });
  L.isDebug.overloads.forEach(o => o.implementation = function () { return true; });
});
```

```bash
frida -U -f com.nothing.smartcenter -l logger.js
```

Credit: technique from
[ambraglow's write-up](https://ambraglow.org/blog/nothing-x/a-look-into-the-nothing-x-smartwatch-app/).
The author asked that their own code not be forked or fed to LLMs, so cmfkit contains
none of it. The snippet above is an independent illustration of the published idea.

## Capture BLE traffic

1. Enable Developer options, then **Enable Bluetooth HCI snoop log**. Toggle Bluetooth
   off and on.
2. Do the thing you want to learn (sync, set a watchface, run an update).
3. Get the log: `adb bugreport bug.zip` and look in `FS/data/misc/bluetooth/logs/`,
   or `adb pull /data/misc/bluetooth/logs/btsnoop_hci.log` on rooted or some stock
   devices.
4. Decode it:

```bash
cmfkit snoop btsnoop_hci.log --headers-only        # opcode sequence (always cleartext)
cmfkit snoop btsnoop_hci.log --authkey <32 hex>    # decrypt payloads too
```

The auth key ("K1") is in the official app's database on a rooted phone. Or pair with
cmfkit first (`cmfkit pair` prints it) and then re-pair the official app. Note that
re-pairing creates a new key.

## Talk to the factory AT shell

```bash
cmfkit at GETVERSION
cmfkit at GETSN
cmfkit at GETBATLV       # battery in mV
cmfkit at GETGSENSOR     # raw accelerometer
cmfkit at GETNTCTEMP     # board thermistor
cmfkit at SETMOTOR=1     # vibrate
```

The shell needs no authentication; that's also how `AT GETSECRET` makes vendor-free
pairing possible. To find more commands, search `app.bin` for `AT ` strings
(`cmfkit fw scan` lists them).

## Find the watch's button codes

```bash
cmfkit listen    # press play/pause/next/prev on the watch's music screen
```

If the codes differ from `DEFAULT_BUTTON_MAP` in `src/cmfkit/apps/base.py`, update the
map (or override `button_map` in your app) and send a PR.

## Static analysis of app.bin

* Load as raw Arm Thumb (Cortex-M) at the XIP base `0x10000000`. The community found
  the watchface parser at `0x100db35c` on the Pro 2.
* Strings are unobfuscated. Good anchors: `WFManager`, `ux2sys`, `AT GET`, `ota`, panel
  driver names.
* Zephyr 2.7 and LVGL sources are public, so FLIRT/BinDiff signatures built from an
  SDK build of `cmf_hello` will label most of the RTOS and the UI library.
