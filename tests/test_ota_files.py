import zlib

import pytest

from cmfkit.firmware import aota, ota_files

MANIFEST = b"""<?xml version='1.0' encoding='UTF-8'?>
<ota_firmware>
\t<firmware_version>
\t\t<version_code>0x10000049</version_code>
\t\t<board_name>ats3089c_cmf</board_name>
\t</firmware_version>
<partitions>
\t<partitionsNum>2</partitionsNum>
\t<partition>
\t\t<type>BOOT</type>
\t\t<file_name>mbrec.bin</file_name>
\t\t<file_size>0x4</file_size>
\t\t<orig_size>0x4</orig_size>
\t\t<checksum>0x1</checksum>
\t</partition>
\t<partition>
\t\t<type>SYSTEM</type>
\t\t<file_name>app.bin</file_name>
\t\t<file_size>0x0</file_size>
\t\t<orig_size>0x0</orig_size>
\t\t<checksum>0x0</checksum>
\t</partition>
\t</partitions>
</ota_firmware>
"""


def _image(app: bytes) -> aota.AotaImage:
    return aota.AotaImage(
        aota.Version("1.0.0.73", "ats3089c_cmf", code=0x10000049),
        aota.Version(),
        [aota.OtaFile("ota.xml", MANIFEST), aota.OtaFile("mbrec.bin", b"boot"), aota.OtaFile("app.bin", app)],
    )


def test_lzma_roundtrip_uses_32k_blocks():
    raw = bytes(range(256)) * 300
    wrapped = ota_files.lzma_wrap(raw)
    assert ota_files.is_lzma(wrapped)
    assert wrapped.count(b"LZMA") >= 3  # 76800 bytes / 32 KiB
    assert ota_files.lzma_unwrap(wrapped) == raw


@pytest.mark.parametrize("compressed", [False, True])
def test_replace_keeps_wrapping_and_fixes_manifest(compressed):
    stock = b"old firmware" * 50
    img = _image(ota_files.lzma_wrap(stock) if compressed else stock)
    new = b"cmf_hello" * 1000
    blob = aota.pack(ota_files.replace_file(img, "app.bin", new))
    out = aota.parse(blob)
    assert out.problems == []
    app = out.file("app.bin")
    assert ota_files.is_lzma(app.data) is compressed
    assert ota_files.raw_contents(app) == new
    xml = out.file("ota.xml").data.decode()
    app_part = xml[xml.index("<file_name>app.bin") :]
    assert f"<file_size>0x{len(app.data):x}</file_size>" in app_part
    assert f"<orig_size>0x{len(new):x}</orig_size>" in app_part
    assert f"<checksum>0x{zlib.crc32(new):x}</checksum>" in app_part
    assert "<checksum>0x1</checksum>" in xml  # other partitions untouched


def test_replace_unknown_file():
    with pytest.raises(aota.AotaError):
        ota_files.replace_file(_image(b"x"), "nope.bin", b"y")
