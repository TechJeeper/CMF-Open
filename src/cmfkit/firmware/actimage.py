"""Actions boot image header (``image_head_t``) and its TLV trailers.

Every bootable file (``mbrec.bin``, ``app.bin``, ``recovery.bin``, ``ota_app.bin``) starts with::

    0x00 magic0 'ACTH' | magic1 'HTCA' | load_addr | name[8] | run_addr | img_size |
         img_chksum | hdr_chksum | hdr_size u16 | ptlv_size u16 | tlv_size u16 | version u16 | flags u32

The protected TLV area (``ptlv``) follows the body and is covered by the signature; ``mbrec``
keeps the RSA public key there. The unprotected TLV area follows it and carries the
RSA-2048-PSS signature. With ``CONFIG_SOC_SIGN_ENABLE`` the bootloader refuses an app whose
signature does not verify against mbrec's key, so a stock image with these TLVs means
self-built firmware will not boot unless the key slot is empty or replaceable.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field

MAGIC = (0x48544341, 0x41435448)
HEAD = struct.Struct("<III8sIIIIHHHHI")
TLV_INFO = struct.Struct("<HH")
TLV_MAGIC = 0x5935
PTLV_MAGIC = 0x593A
FLAG_SIGNED = 0x04
TLV_NAMES = {0x01: "KEYHASH", 0x02: "PUBKEY", 0x04: "SHA256", 0x08: "RSA2048_PSS", 0x10: "PUBKEY_BROM"}


@dataclass
class ActImage:
    name: str
    load_addr: int
    run_addr: int
    img_size: int
    hdr_size: int
    ptlv_size: int
    tlv_size: int
    version: int
    flags: int
    protected: dict[int, bytes] = field(default_factory=dict)
    tlvs: dict[int, bytes] = field(default_factory=dict)

    @property
    def signed(self) -> bool:
        return 0x08 in self.tlvs

    @property
    def carries_key(self) -> bool:
        return bool({0x02, 0x10} & (self.protected.keys() | self.tlvs.keys()))


def is_actimage(blob: bytes) -> bool:
    return len(blob) >= HEAD.size and struct.unpack_from("<II", blob) == MAGIC


def _tlvs(blob: bytes, start: int, magic: int) -> dict[int, bytes]:
    if start + TLV_INFO.size > len(blob):
        return {}
    got, total = TLV_INFO.unpack_from(blob, start)
    if got != magic:
        return {}
    out, pos, end = {}, start + TLV_INFO.size, min(start + total, len(blob))
    while pos + TLV_INFO.size <= end:
        kind, length = TLV_INFO.unpack_from(blob, pos)
        out[kind] = blob[pos + TLV_INFO.size : pos + TLV_INFO.size + length]
        pos += TLV_INFO.size + length
    return out


def parse(blob: bytes) -> ActImage | None:
    if not is_actimage(blob):
        return None
    _, _, load, name, run, size, _, _, hdr, ptlv, tlv, ver, flags = HEAD.unpack_from(blob)
    body_end = hdr + size
    return ActImage(
        name.split(b"\x00", 1)[0].decode("ascii", "replace"),
        load, run, size, hdr, ptlv, tlv, ver, flags,
        _tlvs(blob, body_end, PTLV_MAGIC) if ptlv else {},
        _tlvs(blob, body_end + ptlv, TLV_MAGIC),
    )  # fmt: skip


def describe(img: ActImage) -> str:
    parts = [f"image {img.name!r} run 0x{img.run_addr:08x} body 0x{img.img_size:x}"]
    if img.signed:
        parts.append(f"SIGNED (RSA2048-PSS, {len(img.tlvs[0x08])} B)")
    elif img.flags & FLAG_SIGNED or img.tlv_size >= 0x800:
        parts.append("signature slot reserved but empty")
    else:
        parts.append("unsigned")
    if img.carries_key:
        parts.append("carries public key -> secure boot enabled")
    return "  ".join(parts)
