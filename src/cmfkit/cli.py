"""cmfkit command line."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import logging
import sys
from collections.abc import AsyncIterator
from pathlib import Path

from . import keystore
from .apps.base import AppRunner
from .apps.registry import BUILTIN, load
from .capture import btsnoop
from .firmware import aota
from .firmware import scan as fwscan
from .protocol import opcodes as ops
from .protocol import payloads as pl
from .session import Session
from .transport.sim import BUTTONS, SimWatch
from .watchface import photo


def _sim_event(msg: str) -> None:
    print(f"  [watch] {msg}", flush=True)


@contextlib.asynccontextmanager
async def connect(args: argparse.Namespace, need_auth: bool = True) -> AsyncIterator[Session]:
    if args.sim:
        transport = SimWatch(on_event=_sim_event)
        address = "SIM"
    else:
        from .transport.ble import BleTransport, scan

        address = args.address
        if not address:
            found = await scan()
            if not found:
                sys.exit("No CMF watch found. Unpair it from the Nothing X app's BLE connection, or pass --address.")
            address = found[0].address
            print(f"Using {found[0].name} ({address})")
        transport = BleTransport(address)
    await transport.connect()
    session = Session(transport)
    try:
        if need_auth:
            key = keystore.get(address) if not args.sim else None
            if key:
                await session.login(key)
            else:
                authkey = await session.pair()
                if not args.sim:
                    print(f"Paired; auth key saved to {keystore.put(address, authkey)}")
        yield session
    finally:
        await transport.disconnect()


async def cmd_scan(args: argparse.Namespace) -> None:
    from .transport.ble import scan

    for d in await scan(args.timeout):
        print(f"{d.address}  {d.name}")


async def cmd_pair(args: argparse.Namespace) -> None:
    async with connect(args, need_auth=False) as s:
        authkey = await s.pair(bytes.fromhex(args.secret) if args.secret else None)
        if not args.sim:
            keystore.put(s.transport.name, authkey)
        print(f"Paired. Auth key: {authkey.hex()}")


async def cmd_info(args: argparse.Namespace) -> None:
    async with connect(args) as s:
        level, charging = await s.battery()
        print(f"Firmware: {await s.firmware_version()}")
        print(f"Serial:   {await s.serial_number()}")
        print(f"Battery:  {level}%{' (charging)' if charging else ''}")


async def cmd_notify(args: argparse.Namespace) -> None:
    async with connect(args) as s:
        await s.notify(args.title, args.body, pl.ICONS.get(args.icon, pl.ICONS["generic"]))
        await asyncio.sleep(0.3)


async def cmd_find(args: argparse.Namespace) -> None:
    async with connect(args) as s:
        await s.find_watch()
        await asyncio.sleep(0.3)


async def cmd_at(args: argparse.Namespace) -> None:
    async with connect(args, need_auth=False) as s:
        print(await s.shell(" ".join(args.command)))


async def cmd_listen(args: argparse.Namespace) -> None:
    async with connect(args) as s:
        s.on_message(lambda m: print(f"{ops.name_of(m.op):<24} {m.payload.hex()}", flush=True))
        print("Listening for watch events (Ctrl-C to stop). Press the media controls on the watch.")
        if args.sim:
            for button in BUTTONS:
                s.transport.press(button)  # type: ignore[attr-defined]
            await asyncio.sleep(0.5)
            return
        await asyncio.Event().wait()


def cmd_watchface_build(args: argparse.Namespace) -> None:
    blob = photo.build_from_file(args.image)
    Path(args.output).write_bytes(blob)
    print(f"Wrote {args.output} ({len(blob)} bytes)")
    if args.preview:
        photo.parse(blob).full.save(args.preview)
        print(f"Preview (as the watch will decode it): {args.preview}")


async def cmd_watchface_install(args: argparse.Namespace) -> None:
    path = Path(args.file)
    blob = path.read_bytes() if path.suffix == ".bin" else photo.build_from_file(path)
    photo.parse(blob)
    async with connect(args) as s:

        def progress(done: int, total: int) -> None:
            print(f"\r  uploading {done * 100 // total:3d}%", end="", flush=True)

        ok = await s.upload_photo_dial(blob, args.style, args.x, args.y, int(args.color, 16), progress)
        print()
        print("Watchface installed and activated." if ok else "Watch stored the face but did not activate it (0a).")


async def cmd_run(args: argparse.Namespace) -> None:
    app_cls = load(args.app)
    async with connect(args) as s:
        runner = AppRunner(s, app_cls, args.app_args)
        if args.sim:
            print(f"Simulator: type {', '.join(BUTTONS)} or find_phone + Enter to press watch buttons; 'q' quits.")
            task = asyncio.create_task(_sim_keyboard(s.transport, runner))  # type: ignore[arg-type]
        try:
            await runner.run(args.duration)
        finally:
            if args.sim:
                task.cancel()


async def _sim_keyboard(watch: SimWatch, runner: AppRunner) -> None:
    loop = asyncio.get_running_loop()
    while True:
        line = (await loop.run_in_executor(None, sys.stdin.readline)).strip()
        if line in ("q", "quit") or not line and sys.stdin.closed:
            runner.app.exit()
            return
        if line in BUTTONS:
            watch.press(line)
        elif line == "find_phone":
            runner.inject("find_phone")
        elif line:
            print(f"  unknown button {line!r}")


def cmd_apps(_args: argparse.Namespace) -> None:
    for name, cls in BUILTIN.items():
        print(f"{name:<10} {cls.description}")


def cmd_fw_scan(args: argparse.Namespace) -> None:
    head = Path(args.file).read_bytes()[: aota.HEADER_SIZE]
    if aota.is_aota(head):
        print(aota.describe(aota.parse(Path(args.file).read_bytes())) + "\n")
    report = fwscan.scan(args.file, keep=bool(args.extract))
    print(fwscan.format_report(report))
    if args.extract:
        for p in fwscan.extract(report, args.extract):
            print(f"extracted {p}")


def cmd_aota_info(args: argparse.Namespace) -> None:
    print(aota.describe(aota.parse(Path(args.file).read_bytes())))


def cmd_aota_extract(args: argparse.Namespace) -> None:
    img = aota.parse(Path(args.file).read_bytes())
    print(aota.describe(img))
    for p in aota.extract(img, args.out):
        print(f"extracted {p}")


def cmd_aota_pack(args: argparse.Namespace) -> None:
    img = aota.load_dir(args.dir)
    if args.bump:
        img = aota.with_version_code(img, aota.current_version_code(img) + 1)
    if args.version_code is not None:
        img = aota.with_version_code(img, int(args.version_code, 0))
    blob = aota.pack(img)
    Path(args.output).write_bytes(blob)
    print(aota.describe(aota.parse(blob)))
    print(f"Wrote {args.output} ({len(blob)} bytes)")


def cmd_snoop(args: argparse.Namespace) -> None:
    authkey = bytes.fromhex(args.authkey) if args.authkey else None
    for line in btsnoop.decode_log(args.file, authkey, show_payload=not args.headers_only):
        print(line)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="cmfkit", description="Toolkit for the CMF Watch 3 Pro (and Watch Pro 2).")
    p.add_argument("--sim", action="store_true", help="talk to the built-in simulated watch instead of BLE")
    p.add_argument("--address", help="BLE address of the watch (default: first CMF watch found)")
    p.add_argument("-v", "--verbose", action="count", default=0)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("scan", help="list nearby CMF watches")
    s.add_argument("--timeout", type=float, default=8.0)
    s.set_defaults(func=cmd_scan)

    s = sub.add_parser("pair", help="pair via the AT shell secret and store the auth key")
    s.add_argument("--secret", help="32-hex device secret (default: read with AT GETSECRET)")
    s.set_defaults(func=cmd_pair)

    sub.add_parser("info", help="firmware, serial and battery").set_defaults(func=cmd_info)
    sub.add_parser("find", help="make the watch ring").set_defaults(func=cmd_find)

    s = sub.add_parser("notify", help="push a notification")
    s.add_argument("title")
    s.add_argument("body", nargs="?", default="")
    s.add_argument("--icon", default="generic", choices=sorted(pl.ICONS))
    s.set_defaults(func=cmd_notify)

    s = sub.add_parser("at", help="send a raw AT command on the factory shell (e.g. GETVERSION)")
    s.add_argument("command", nargs="+")
    s.set_defaults(func=cmd_at)

    sub.add_parser("listen", help="print unsolicited watch events (find button codes)").set_defaults(func=cmd_listen)

    wf = sub.add_parser("watchface", help="build or install photo watchfaces").add_subparsers(dest="wf", required=True)
    s = wf.add_parser("build", help="convert an image into a watchface .bin (offline)")
    s.add_argument("image")
    s.add_argument("-o", "--output", default="watchface.bin")
    s.add_argument("--preview", help="also write a PNG decoded back from the .bin")
    s.set_defaults(func=cmd_watchface_build)
    s = wf.add_parser("install", help="upload an image or .bin to the watch")
    s.add_argument("file")
    s.add_argument("--style", type=int, default=0, help="built-in clock style 0-4")
    s.add_argument("--x", type=int, default=56)
    s.add_argument("--y", type=int, default=77)
    s.add_argument("--color", default="FFFF", help="clock color as RGB565 hex")
    s.set_defaults(func=cmd_watchface_install)

    sub.add_parser("apps", help="list built-in apps").set_defaults(func=cmd_apps)
    s = sub.add_parser("run", help="run a host-side app (built-in name or file.py[:Class])")
    s.add_argument("app")
    s.add_argument("app_args", nargs=argparse.REMAINDER)
    s.add_argument("--duration", type=float, help="stop after N seconds")
    s.set_defaults(func=cmd_run)

    fw = sub.add_parser("fw", help="firmware analysis").add_subparsers(dest="fw", required=True)
    s = fw.add_parser("scan", help="triage an OTA image: XZ streams, manifests, markers")
    s.add_argument("file")
    s.add_argument("--extract", metavar="DIR", help="write decompressed streams to DIR")
    s.set_defaults(func=cmd_fw_scan)
    s = fw.add_parser("info", help="show an AOTA image's header, files and CRC status")
    s.add_argument("file")
    s.set_defaults(func=cmd_aota_info)
    s = fw.add_parser("extract", help="unpack an AOTA image into a directory")
    s.add_argument("file")
    s.add_argument("out")
    s.set_defaults(func=cmd_aota_extract)
    s = fw.add_parser("pack", help="repack a directory from 'fw extract' into an AOTA image")
    s.add_argument("dir")
    s.add_argument("-o", "--output", default="ota_custom.bin")
    s.add_argument("--bump", action="store_true", help="increment version_code (the updater rejects equal/older)")
    s.add_argument("--version-code", help="set an explicit version_code (e.g. 0x10000050)")
    s.set_defaults(func=cmd_aota_pack)

    s = sub.add_parser("snoop", help="decode CMF frames from an Android btsnoop_hci.log capture")
    s.add_argument("file")
    s.add_argument("--authkey", help="32-hex auth key to decrypt payloads (from a rooted phone or `cmfkit pair`)")
    s.add_argument("--headers-only", action="store_true")
    s.set_defaults(func=cmd_snoop)
    return p


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=[logging.WARNING, logging.INFO, logging.DEBUG][min(args.verbose, 2)])
    result = args.func(args)
    if asyncio.iscoroutine(result):
        try:
            asyncio.run(result)
        except KeyboardInterrupt:
            pass
