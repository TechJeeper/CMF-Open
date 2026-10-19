# 2. BLE protocol (as implemented by cmfkit)

The protocol was reverse-engineered on the Watch Pro 2 (firmware 1.0.0.73) and
published in
[joshuapassos/CMF-Watch-Pro-2-BLE-Protocol](https://github.com/joshuapassos/CMF-Watch-Pro-2-BLE-Protocol).
Gadgetbridge drives the Watch 3 Pro with the same code
([issue #5596](https://codeberg.org/Freeyourgadget/Gadgetbridge/issues/5596)). cmfkit is
an independent Python implementation of that specification.

## GATT

| Channel | Service | Write | Notify |
|---|---|---|---|
| Command (framed, encrypted) | `0000fff0-0000-1000-8000-00805f9b34fb` | `0000fff2-…` | `0000fff1-…` |
| AT shell (plain text) | `77d4e67c-2fe2-2334-0d35-9ccd078f529c` | `77d4ff01-…` | `77d4ff02-…` |
| Bulk data (watchface/AGPS) | `02f00000-0000-0000-0000-00000000ffe0` | `…ffe1` | `…ffe2` |
| Firmware | `02f00000-0000-0000-0000-00000000fe00` | `…ff01` | `…ff02` |

The watch advertises as `CMF Watch 3 Pro-XXXX`. Web Bluetooth only grants access to
services listed up front in `optionalServices`, so the web app needs these exact
service UUIDs. They match Gadgetbridge's `CmfWatchProSupport`.

## Frames: `src/cmfkit/protocol/frame.py`

```
F5 | chunkLen u16 | cmd1 u16 | chunkCount u16 | chunkIndex u16 | cmd2 u16 | chunk     (header big-endian)
chunk = AES-128-CBC/PKCS7( piece || CRC32_LE(piece) )   with fixed IV 5051525354555657606162636465665A
```

* `(cmd1, cmd2)` is the opcode. Replies usually flip `0x80xx`/`0x90xx` to
  `0x00xx`/`0xA0xx`. Feature opcodes use `cmd2` = `1` SET, `2` GET, `3` ACK.
* Pair request/reply and bulk chunk writes are always plaintext.
* Quirk: plaintext frames **from the watch** count the CRC in `chunkLen` but don't
  send it.

## Pairing without the vendor cloud: `src/cmfkit/session.py`

```
AT GETSECRET                          -> GETSECRET:<16-byte secret hex>,OK
AUTH_PAIR_REQUEST  rnd1 || SHA256(rnd1||secret)           (plaintext)
AUTH_PAIR_REPLY    rnd2 || SHA256(rnd2||secret)           (plaintext, verified)
authkey    = SHA256(rnd1||rnd2||secret)[:16]               (persist this)
AUTH_PHONE_NAME / AUTH_WATCH_MAC, AUTH_NONCE_REQUEST/REPLY (encrypted with authkey)
sessionKey = SHA256(nonce||authkey)[:16]
AUTH_CONFIRM_REQUEST/REPLY                                 (encrypted with sessionKey)
TIME                                                       (mandatory before any query)
```

On a fresh pairing the watch shows a confirmation prompt after `AUTH_PAIR_REPLY`. It only
answers `AUTH_PHONE_NAME` with `AUTH_WATCH_MAC` once the user accepts it on the watch. If
nobody does, the phone sees a silent timeout, not `AUTH_FAILED`, so clients should wait
generously (the web app waits 60 s) and tell the user to check the watch.

## Commands cmfkit uses

| Feature | Opcode | Payload |
|---|---|---|
| Time | `FFFF:8004` | `epoch i32 BE, utcOffsetMs i32 BE` |
| Firmware / serial / battery | `FFFF:8006`, `00DE:0002`, `005C:0001` | `A5` poll |
| Notification | `0065:0001` | `icon, 0, when u32 BE, titleLen, title(≤20), body(≤128)` |
| Music card | `FFFF:905C` | `state, vol, volMax, track[64], artist[64]` |
| Media buttons (watch → phone) | `FFFF:A05D` | 1 byte code (mapping unconfirmed) |
| Weather | `FFFF:906B` | 199 B; city[32] at offset 111; temps `(°C+100)&0xFF` |
| Contacts | `00D5:0001` | N × (name[32], phone[25]), N ≤ 20 |
| Find watch | `005D:0001` | `01` |
| Photo watchface | on the **data** service: `8052` → `9063` → watch `A064(offset,len)` / phone `9064` chunks → `A065` result → `9065` | header in `payloads.photo_dial_init`; `0052` init-1 reply may arrive on the command notify characteristic |

## What's not verified on a Watch 3 Pro

* Byte-exact behaviour on the Pro 3. Everything is documented on a Pro 2;
  Gadgetbridge users report the Pro 2 code paths work on the Pro 3.
* Whether the phone must include the CRC on plaintext frames it sends. cmfkit sends
  it, matching the documented chunk-size formula.
* The `MUSIC_BUTTON` code map, and the non-city fields of the weather record.
* Firmware OTA over BLE (mapped from the APK only).

The simulator (`src/cmfkit/transport/sim.py`) implements the watch side of everything
above, so these assumptions are consistent and testable, but **the simulator is not
proof of hardware behaviour.**
