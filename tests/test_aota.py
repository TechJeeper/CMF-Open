import struct

import pytest

from cmfkit.firmware import aota

MANIFEST = b"""<?xml version="1.0" encoding="utf-8"?>
<ota_firmware>
  <firmware_version>
    <version_code>0x10000049</version_code>
    <version_res>0x0</version_res>
    <version_name>1.0.0.73</version_name>
    <board_name>ats3089c_cmf</board_name>
  </firmware_version>
</ota_firmware>
"""


def _image() -> aota.AotaImage:
    return aota.AotaImage(
        aota.Version("1.0.0.73", "ats3089c_cmf", code=0x10000049, build_time="2026-07-01"),
        aota.Version(),
        [aota.OtaFile("ota.xml", MANIFEST), aota.OtaFile("app.bin", bytes(range(256)) * 9)],
    )


def test_pack_parse_roundtrip_and_layout():
    blob = aota.pack(_image())
    assert blob[:4] == b"AOTA"
    assert blob[0x400:0x405] == b"<?xml"  # first file starts right after the 1 KiB header
    assert len(blob) % 512 == 0
    img = aota.parse(blob)
    assert img.problems == []
    assert img.version.board == "ats3089c_cmf" and img.version.code == 0x10000049
    assert [f.name for f in img.files] == ["ota.xml", "app.bin"]
    assert img.file("app.bin").data == bytes(range(256)) * 9
    (code,) = struct.unpack_from("<I", blob, 0x84)
    assert code == 0x10000049


def test_corruption_is_detected():
    blob = bytearray(aota.pack(_image()))
    blob[0x600] ^= 0xFF
    problems = aota.parse(bytes(blob)).problems
    assert "data CRC mismatch" in problems and any("app.bin" in p or "ota.xml" in p for p in problems)


def test_version_bump_updates_header_and_manifest(tmp_path):
    img = aota.parse(aota.pack(_image()))
    aota.extract(img, tmp_path)
    rebuilt = aota.load_dir(tmp_path)
    bumped = aota.parse(aota.pack(aota.with_version_code(rebuilt, rebuilt.version.code + 1)))
    assert bumped.problems == []
    assert bumped.version.code == 0x1000004A
    assert b"<version_code>0x1000004a</version_code>" in bumped.file("ota.xml").data


def test_rejects_non_aota():
    with pytest.raises(aota.AotaError):
        aota.parse(b"\x00" * 2048)
