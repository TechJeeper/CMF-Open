"""Static triage of OTA firmware blobs pulled from the Nothing X app cache.

Finds embedded XZ streams (decompressing them if asked), XML manifests, ELF
images and identifying strings (Zephyr, LVGL, SoC and version markers). This is
a first-pass recon tool, not a full unpacker of the Actions container format.
"""

from __future__ import annotations

import lzma
import re
from dataclasses import dataclass, field
from pathlib import Path

XZ_MAGIC = b"\xfd7zXZ\x00"
ELF_MAGIC = b"\x7fELF"
MARKERS = [
    rb"Zephyr[^\x00]{0,40}",
    rb"zephyr[^\x00]{0,40}",
    rb"LVGL[^\x00]{0,40}",
    rb"lv_[a-z_]{3,30}",
    rb"ATS30[0-9]{2}[A-Z]?",
    rb"ATS3089C",
    rb"[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+",
    rb"AT [A-Z]{4,16}",
    rb"(?:fatfs|sdfs|nvram|ota|bootloader)[a-z_]{0,20}",
]


@dataclass
class Region:
    kind: str
    offset: int
    length: int
    note: str = ""
    data: bytes | None = field(default=None, repr=False)


@dataclass
class Report:
    path: Path
    size: int
    regions: list[Region]
    markers: dict[str, list[int]]


def _xz_streams(blob: bytes, keep: bool) -> list[Region]:
    out = []
    pos = blob.find(XZ_MAGIC)
    while pos >= 0:
        dec = lzma.LZMADecompressor(format=lzma.FORMAT_XZ)
        try:
            data = dec.decompress(blob[pos:])
            consumed = len(blob) - pos - len(dec.unused_data)
            note = f"-> {len(data)} bytes" + (" (truncated)" if not dec.eof else "")
            out.append(Region("xz", pos, consumed, note, data if keep else None))
            nxt = pos + max(consumed, 1)
        except lzma.LZMAError as exc:
            out.append(Region("xz?", pos, 0, f"invalid: {exc}"))
            nxt = pos + 1
        pos = blob.find(XZ_MAGIC, nxt)
    return out


def _xml(blob: bytes) -> list[Region]:
    out = []
    for m in re.finditer(rb"<\?xml.{0,8192}?</[A-Za-z_]+>\s*(?=[\x00\xff]|$)", blob, re.S):
        out.append(Region("xml", m.start(), m.end() - m.start(), m.group()[:120].decode("latin1"), m.group()))
    return out


def _elf(blob: bytes) -> list[Region]:
    return [Region("elf", m.start(), 0, "ELF header") for m in re.finditer(re.escape(ELF_MAGIC), blob)]


def _markers(blob: bytes) -> dict[str, list[int]]:
    found: dict[str, list[int]] = {}
    for pattern in MARKERS:
        for m in re.finditer(pattern, blob):
            text = m.group().decode("latin1").strip()
            found.setdefault(text, []).append(m.start())
    return found


def scan(path: str | Path, keep: bool = False, recurse: bool = True) -> Report:
    path = Path(path)
    blob = path.read_bytes()
    regions = _xz_streams(blob, keep or recurse) + _xml(blob) + _elf(blob)
    markers = _markers(blob)
    if recurse:
        for r in regions:
            if r.kind == "xz" and r.data:
                for text, offs in _markers(r.data).items():
                    markers.setdefault(text, []).extend(-1 for _ in offs)
    regions.sort(key=lambda r: r.offset)
    return Report(path, len(blob), regions, markers)


def extract(report: Report, out_dir: str | Path) -> list[Path]:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for r in report.regions:
        if r.data:
            dest = out / f"{r.offset:08x}.{r.kind}.bin"
            dest.write_bytes(r.data)
            written.append(dest)
    return written


def format_report(report: Report, max_markers: int = 40) -> str:
    lines = [f"{report.path}  ({report.size} bytes)", "", "Regions:"]
    if not report.regions:
        lines.append("  (none found - the image may be encrypted or use another container)")
    for r in report.regions:
        lines.append(f"  0x{r.offset:08x}  {r.kind:<4} len={r.length:<9} {r.note}")
    lines += ["", "Markers (count, first offset; -1 = inside a decompressed stream):"]
    ranked = sorted(report.markers.items(), key=lambda kv: -len(kv[1]))[:max_markers]
    for text, offs in ranked:
        lines.append(f"  {len(offs):>5}  {offs[0]:>10}  {text}")
    return "\n".join(lines)
