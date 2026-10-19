"""Payload-level helpers for AOTA images: LZMA block wrapping and manifest-consistent file swaps.

The SDK's ``zephyr/tools/build_ota_image.py`` can store a partition file as a run of
independently compressed blocks, each ``magic 'LZMA' | hdr_size | xz_len | raw_len`` (u32 LE)
followed by an XZ stream of up to 32 KiB of raw data. Every ``<partition>`` in ``ota.xml``
records ``file_size`` (stored bytes), ``orig_size`` (raw bytes) and ``checksum`` (CRC32 of the
raw file), so swapping a file must rewrite that entry too.
"""

from __future__ import annotations

import lzma
import re
import struct
import zlib
from dataclasses import replace

from . import actimage
from .aota import AotaError, AotaImage, OtaFile

LZMA_MAGIC = 0x414D5A4C
LZMA_HDR = struct.Struct("<IIII")
LZMA_BLOCK = 0x8000


def is_lzma(data: bytes) -> bool:
    return len(data) >= LZMA_HDR.size and LZMA_HDR.unpack_from(data)[0] == LZMA_MAGIC


def lzma_wrap(raw: bytes, block: int = LZMA_BLOCK) -> bytes:
    out = bytearray()
    for i in range(0, len(raw), block):
        chunk = raw[i : i + block]
        xz = lzma.compress(chunk)
        out += LZMA_HDR.pack(LZMA_MAGIC, LZMA_HDR.size, len(xz), len(chunk)) + xz
    return bytes(out)


def lzma_unwrap(data: bytes) -> bytes:
    out = bytearray()
    pos = 0
    while pos + LZMA_HDR.size <= len(data):
        magic, hdr_size, xz_len, raw_len = LZMA_HDR.unpack_from(data, pos)
        if magic != LZMA_MAGIC:
            break
        start = pos + hdr_size
        chunk = lzma.decompress(data[start : start + xz_len])
        if len(chunk) != raw_len:
            raise AotaError(f"LZMA block at 0x{pos:x}: expected {raw_len} bytes, got {len(chunk)}")
        out += chunk
        pos = start + xz_len
    return bytes(out)


def raw_contents(f: OtaFile) -> bytes:
    return lzma_unwrap(f.data) if is_lzma(f.data) else f.data


def boot_images(img: AotaImage) -> dict[str, actimage.ActImage]:
    found = {}
    for f in img.files:
        try:
            parsed = actimage.parse(raw_contents(f))
        except (lzma.LZMAError, AotaError):
            continue
        if parsed:
            found[f.name] = parsed
    return found


def security_report(img: AotaImage) -> str:
    images = boot_images(img)
    if not images:
        return "  boot images: none recognised"
    lines = ["  boot images:"] + [f"    {name:<12} {actimage.describe(i)}" for name, i in images.items()]
    if any(i.signed or i.carries_key for i in images.values()):
        lines.append("  -> secure boot is on: a self-built app.bin needs the vendor key (see docs/04)")
    else:
        lines.append("  -> no signatures: the bootloader will run a self-built app.bin")
    return "\n".join(lines)


def _set_partition(xml: bytes, name: str, file_size: int, orig_size: int, crc: int) -> tuple[bytes, bool]:
    text = xml.decode("utf-8", "replace")
    pattern = rf"<partition>(?:(?!</partition>).)*?<file_name>\s*{re.escape(name)}\s*</file_name>.*?</partition>"
    m = re.search(pattern, text, re.S)
    if not m:
        return xml, False
    block = m.group()
    for tag, value in (("file_size", file_size), ("orig_size", orig_size), ("checksum", crc)):
        block = re.sub(rf"(<{tag}>)\s*[^<]*(</{tag}>)", rf"\g<1>0x{value:x}\g<2>", block, count=1)
    return (text[: m.start()] + block + text[m.end() :]).encode(), True


def replace_file(img: AotaImage, name: str, raw: bytes, compress: bool | None = None) -> AotaImage:
    """Swap ``name`` for ``raw``; ``compress=None`` keeps the existing file's LZMA wrapping."""
    old = img.file(name)
    if old is None:
        raise AotaError(f"{name!r} is not in this image (have: {', '.join(f.name for f in img.files)})")
    if compress is None:
        compress = is_lzma(old.data)
    stored = lzma_wrap(raw) if compress else raw
    crc = zlib.crc32(raw) & 0xFFFFFFFF
    files = []
    for f in img.files:
        if f.name == name:
            files.append(OtaFile(name, stored))
        elif f.name == "ota.xml":
            xml, _ = _set_partition(f.data, name, len(stored), len(raw), crc)
            files.append(replace(f, data=xml))
        else:
            files.append(f)
    return replace(img, files=files, problems=[])
