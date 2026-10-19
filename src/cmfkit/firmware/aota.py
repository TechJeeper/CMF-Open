"""Actions ``AOTA`` OTA container: parse, verify, extract and repack.

Layout follows the C structs in the Actions SDK's ``framework/ota/libota/ota_image.c``
(Apache-2.0), which is what the on-device updater actually reads::

    0x000  hdr       magic 'AOTA' | header_crc | hdr_ver u16 | hdr_size u16 | file_cnt u16 |
                     flag u16 | dir_off u16 | data_off u16 | data_size u32 | data_crc u32
    0x040  new_ver   version_name[32] | board_name[32] | hw_ver[4] | version_code u32 | rsv[8] | build_time[16]
    0x0a0  old_ver   same layout, only used by patch (delta) images
    0x200  dir[16]   filename[12] | rsv[4] | offset u32 | length u32 | rsv[4] | crc32 u32
    0x400  data      files, each padded to 512 bytes

Integrity is CRC32 only: header CRC over [8, 0x400), data CRC over
[data_off, data_size), and a CRC per file. The SDK updater accepts an image when
``board_name`` matches the running firmware and ``version_code`` is higher.
"""

from __future__ import annotations

import re
import struct
import zlib
from dataclasses import dataclass, field, replace
from pathlib import Path

MAGIC = b"AOTA"
HDR = struct.Struct("<4sIHHHHHHII")
VER = struct.Struct("<32s32s4sI8s16s")
DIR_ENTRY = struct.Struct("<12s4xII4xI")
HEADER_SIZE = 0x400
DIR_OFFSET = 0x200
NEW_VER_OFFSET = 0x40
OLD_VER_OFFSET = 0xA0
MAX_FILES = 16
ALIGN = 512


class AotaError(ValueError):
    pass


def _crc(data: bytes) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF


def _cstr(raw: bytes) -> str:
    return raw.split(b"\x00", 1)[0].decode("utf-8", "replace")


def _pad(n: int) -> int:
    return (-n) % ALIGN


@dataclass
class Version:
    name: str = ""
    board: str = ""
    hardware: bytes = b"\x00" * 4
    code: int = 0
    build_time: str = ""

    @classmethod
    def unpack(cls, raw: bytes) -> Version:
        name, board, hw, code, _, built = VER.unpack(raw[: VER.size])
        return cls(_cstr(name), _cstr(board), hw, code, _cstr(built))

    def pack(self) -> bytes:
        return VER.pack(
            self.name.encode()[:32], self.board.encode()[:32], self.hardware, self.code, b"", self.build_time.encode()
        ).ljust(0x60, b"\x00")


@dataclass
class OtaFile:
    name: str
    data: bytes
    crc_ok: bool = True


@dataclass
class AotaImage:
    version: Version
    old_version: Version
    files: list[OtaFile]
    header_version: int = 0x0100
    flag: int = 0
    problems: list[str] = field(default_factory=list)

    def file(self, name: str) -> OtaFile | None:
        return next((f for f in self.files if f.name == name), None)


def is_aota(blob: bytes) -> bool:
    return blob[:4] == MAGIC


def parse(blob: bytes) -> AotaImage:
    if not is_aota(blob):
        raise AotaError("not an AOTA image (missing 'AOTA' magic)")
    if len(blob) < HEADER_SIZE:
        raise AotaError("truncated header")
    _, head_crc, hdr_ver, _hdr_size, count, flag, dir_off, data_off, data_size, data_crc = HDR.unpack_from(blob)
    problems = []
    if _crc(blob[8:HEADER_SIZE]) != head_crc:
        problems.append("header CRC mismatch")
    if data_size > len(blob):
        problems.append(f"data_size 0x{data_size:x} beyond end of file")
    elif _crc(blob[data_off:data_size]) != data_crc:
        problems.append("data CRC mismatch")
    files = []
    for i in range(min(count, MAX_FILES)):
        raw_name, offset, length, crc = DIR_ENTRY.unpack_from(blob, dir_off + i * DIR_ENTRY.size)
        if not raw_name[0]:
            continue
        data = blob[offset : offset + length]
        ok = _crc(data) == crc and len(data) == length
        if not ok:
            problems.append(f"{_cstr(raw_name)}: CRC mismatch")
        files.append(OtaFile(_cstr(raw_name), data, ok))
    return AotaImage(
        Version.unpack(blob[NEW_VER_OFFSET:]),
        Version.unpack(blob[OLD_VER_OFFSET:]),
        files,
        hdr_ver,
        flag,
        problems,
    )


def pack(img: AotaImage) -> bytes:
    if len(img.files) > MAX_FILES:
        raise AotaError(f"at most {MAX_FILES} files fit in an AOTA directory")
    dir_data = bytearray()
    body = bytearray()
    offset = HEADER_SIZE
    for f in img.files:
        name = f.name.encode()
        if len(name) > 12:
            raise AotaError(f"file name {f.name!r} longer than 12 bytes")
        dir_data += DIR_ENTRY.pack(name, offset, len(f.data), _crc(f.data))
        body += f.data + bytes(_pad(len(f.data)))
        offset += len(f.data) + _pad(len(f.data))
    head = bytearray(HEADER_SIZE)
    HDR.pack_into(head, 0, MAGIC, 0, img.header_version, HEADER_SIZE, len(img.files), img.flag,
                  DIR_OFFSET, HEADER_SIZE, offset, _crc(bytes(body)))  # fmt: skip
    head[NEW_VER_OFFSET : NEW_VER_OFFSET + 0x60] = img.version.pack()
    if img.old_version.code or img.old_version.name:
        head[OLD_VER_OFFSET : OLD_VER_OFFSET + 0x60] = img.old_version.pack()
    head[DIR_OFFSET : DIR_OFFSET + len(dir_data)] = dir_data
    struct.pack_into("<I", head, 4, _crc(bytes(head[8:])))
    return bytes(head) + bytes(body)


def _bump_manifest(xml: bytes, code: int) -> bytes:
    """Rewrite <version_code> inside <firmware_version> of ota.xml."""
    text = xml.decode("utf-8", "replace")
    section = re.search(r"<firmware_version>.*?</firmware_version>", text, re.S)
    if not section:
        return xml
    new_section = re.sub(
        r"(<version_code>)\s*[^<]*(</version_code>)", rf"\g<1>0x{code:x}\g<2>", section.group(), count=1
    )
    return (text[: section.start()] + new_section + text[section.end() :]).encode()


def manifest_version_code(img: AotaImage) -> int | None:
    xml = img.file("ota.xml")
    if not xml:
        return None
    m = re.search(r"<firmware_version>.*?<version_code>\s*([^<\s]+)", xml.data.decode("utf-8", "replace"), re.S)
    return int(m.group(1), 0) if m else None


def current_version_code(img: AotaImage) -> int:
    """The updater compares against the manifest; the SDK's Python packer leaves the header field stale."""
    return max(img.version.code, manifest_version_code(img) or 0)


def with_version_code(img: AotaImage, code: int) -> AotaImage:
    files = [replace(f, data=_bump_manifest(f.data, code)) if f.name == "ota.xml" else f for f in img.files]
    return replace(img, version=replace(img.version, code=code), files=files)


def extract(img: AotaImage, out_dir: str | Path) -> list[Path]:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for f in img.files:
        p = out / f.name
        p.write_bytes(f.data)
        paths.append(p)
    meta = out / "_aota.txt"
    v, o = img.version, img.old_version
    meta.write_text(
        f"version_name={v.name}\nboard_name={v.board}\nhardware={v.hardware.hex()}\n"
        f"version_code=0x{v.code:x}\nbuild_time={v.build_time}\n"
        f"old_version_name={o.name}\nold_version_code=0x{o.code:x}\n"
        f"header_version=0x{img.header_version:x}\nflag=0x{img.flag:x}\n"
        f"files={','.join(f.name for f in img.files)}\n"
    )
    return paths


def load_dir(src: str | Path) -> AotaImage:
    """Rebuild an image from a directory produced by :func:`extract`."""
    src = Path(src)
    meta = dict(line.split("=", 1) for line in (src / "_aota.txt").read_text().splitlines() if "=" in line)
    names = [n for n in meta.get("files", "").split(",") if n]
    files = [OtaFile(n, (src / n).read_bytes()) for n in names]
    version = Version(
        meta.get("version_name", ""), meta.get("board_name", ""),
        bytes.fromhex(meta.get("hardware", "00000000")), int(meta.get("version_code", "0"), 0),
        meta.get("build_time", ""),
    )  # fmt: skip
    old = Version(meta.get("old_version_name", ""), version.board, code=int(meta.get("old_version_code", "0"), 0))
    return AotaImage(version, old, files, int(meta.get("header_version", "0x100"), 0), int(meta.get("flag", "0"), 0))


def describe(img: AotaImage) -> str:
    v = img.version
    lines = [
        f"AOTA image  header v0x{img.header_version:x}  flag 0x{img.flag:x}",
        f"  version   {v.name!r}  code 0x{v.code:x}  board {v.board!r}  built {v.build_time!r}",
    ]
    manifest_code = manifest_version_code(img)
    if manifest_code is not None and manifest_code != v.code:
        lines.append(f"  ota.xml   version_code 0x{manifest_code:x} (differs from header)")
    if img.old_version.code:
        lines.append(f"  patch from code 0x{img.old_version.code:x} ({img.old_version.name!r})")
    lines.append(f"  files ({len(img.files)}):")
    for f in img.files:
        lines.append(f"    {f.name:<12} {len(f.data):>9} bytes  crc {'ok' if f.crc_ok else 'BAD'}")
    lines.append("  integrity: " + ("; ".join(img.problems) if img.problems else "all CRCs valid"))
    return "\n".join(lines)
