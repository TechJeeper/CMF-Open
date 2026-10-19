"""Photo (custom background) watchface container.

Layout, all little-endian::

    6c 8d c4 a5            magic
    12 00 00 00            constant
    00 * 8
    lenFull u32            length of the FULL block (dims + len + payload)
    FULL:  dims u32 | len u32 | LZ4(RGB565)   full-screen image
    THUMB: dims u32 | len u32 | LZ4(RGB565)   picker thumbnail
    6c 8d c4 a5            trailer

``dims`` packs ``colorFormat | width << 10 | height << 21`` (format 4 = RGB565).
The firmware draws its own digital clock on top of the image.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from pathlib import Path

import lz4.block
from PIL import Image, ImageDraw

MAGIC = bytes.fromhex("6c8dc4a5")
CF_RGB565 = 4
SCREEN = 466  # Watch 3 Pro: 1.43" 466x466 round AMOLED
THUMB = 270


class DialFormatError(ValueError):
    pass


def dims_word(width: int, height: int, cf: int = CF_RGB565) -> int:
    return (cf & 0x1F) | (width & 0x7FF) << 10 | (height & 0x7FF) << 21


def split_dims(word: int) -> tuple[int, int, int]:
    return word & 0x1F, (word >> 10) & 0x7FF, (word >> 21) & 0x7FF


def to_rgb565(img: Image.Image, round_mask: bool = True) -> bytes:
    rgb = img.convert("RGB")
    w, h = rgb.size
    if round_mask:
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, w - 1, h - 1), fill=255)
        black = Image.new("RGB", (w, h))
        rgb = Image.composite(rgb, black, mask)
    out = bytearray(w * h * 2)
    for i, (r, g, b) in enumerate(rgb.get_flattened_data()):
        struct.pack_into("<H", out, i * 2, (r >> 3) << 11 | (g >> 2) << 5 | (b >> 3))
    return bytes(out)


def from_rgb565(raw: bytes, width: int, height: int) -> Image.Image:
    img = Image.new("RGB", (width, height))
    px = []
    for (v,) in struct.iter_unpack("<H", raw):
        px.append((((v >> 11) & 0x1F) << 3, ((v >> 5) & 0x3F) << 2, (v & 0x1F) << 3))
    img.putdata(px)
    return img


def _fit(img: Image.Image, size: int) -> Image.Image:
    w, h = img.size
    side = min(w, h)
    img = img.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
    return img.resize((size, size), Image.LANCZOS)


def _block(img: Image.Image) -> bytes:
    w, h = img.size
    packed = lz4.block.compress(to_rgb565(img), mode="high_compression", store_size=False)
    return struct.pack("<II", dims_word(w, h), len(packed)) + packed


def build(img: Image.Image, screen: int = SCREEN, thumb: int = THUMB) -> bytes:
    full = _block(_fit(img, screen))
    small = _block(_fit(img, thumb))
    return MAGIC + struct.pack("<I", 0x12) + bytes(8) + struct.pack("<I", len(full)) + full + small + MAGIC


def build_from_file(path: str | Path, **kw) -> bytes:
    with Image.open(path) as img:
        return build(img, **kw)


@dataclass
class PhotoDial:
    full: Image.Image
    thumb: Image.Image


def parse(blob: bytes) -> PhotoDial:
    if len(blob) < 32 or blob[:4] != MAGIC or blob[-4:] != MAGIC:
        raise DialFormatError("missing photo dial magic")
    (len_full,) = struct.unpack_from("<I", blob, 16)
    images = []
    pos = 20
    for expected_end in (20 + len_full, len(blob) - 4):
        word, n = struct.unpack_from("<II", blob, pos)
        cf, w, h = split_dims(word)
        if cf != CF_RGB565:
            raise DialFormatError(f"unsupported color format {cf}")
        if pos + 8 + n != expected_end:
            raise DialFormatError("block length does not match container layout")
        raw = lz4.block.decompress(blob[pos + 8 : pos + 8 + n], uncompressed_size=w * h * 2)
        images.append(from_rgb565(raw, w, h))
        pos += 8 + n
    return PhotoDial(*images)
