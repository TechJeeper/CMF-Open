import struct

from cmfkit.firmware import actimage, aota, ota_files


def _tlv_area(magic: int, entries: dict[int, bytes]) -> bytes:
    body = b"".join(struct.pack("<HH", k, len(v)) + v for k, v in entries.items())
    return struct.pack("<HH", magic, len(body) + 4) + body


def _boot_image(name: bytes, protected: dict[int, bytes] | None = None, sig: bytes | None = None) -> bytes:
    body = b"\x5a" * 0x300
    ptlv = _tlv_area(actimage.PTLV_MAGIC, protected) if protected else b""
    tlv = _tlv_area(actimage.TLV_MAGIC, {0x08: sig}) if sig else b""
    head = actimage.HEAD.pack(*actimage.MAGIC, 0x10000000, name, 0x10000201, len(body), 0, 0,
                              actimage.HEAD.size, len(ptlv), 0x800 if sig else 0, 0, 4 if sig else 0)  # fmt: skip
    return head + body + ptlv + tlv


def test_unsigned_and_signed_images():
    plain = actimage.parse(_boot_image(b"app"))
    assert plain and not plain.signed and not plain.carries_key
    assert "unsigned" in actimage.describe(plain)

    mbrec = actimage.parse(_boot_image(b"mbrec", {0x02: b"k" * 516}, b"s" * 256))
    assert mbrec.signed and mbrec.carries_key and mbrec.name == "mbrec"
    assert len(mbrec.tlvs[0x08]) == 256 and len(mbrec.protected[0x02]) == 516
    assert actimage.parse(b"not an image" * 10) is None


def test_security_report_sees_through_lzma():
    signed = _boot_image(b"app", sig=b"s" * 256)
    img = aota.AotaImage(
        aota.Version(board="b"), aota.Version(), [aota.OtaFile("app.bin", ota_files.lzma_wrap(signed))]
    )
    assert ota_files.boot_images(img)["app.bin"].signed
    assert "secure boot is on" in ota_files.security_report(img)

    img.files[0] = aota.OtaFile("app.bin", _boot_image(b"app"))
    assert "will run a self-built" in ota_files.security_report(img)
