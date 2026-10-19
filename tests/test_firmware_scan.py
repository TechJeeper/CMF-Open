import lzma

from cmfkit.firmware import scan


def test_finds_and_extracts_xz_streams(tmp_path):
    inner = b"\x00Zephyr OS build v3.4\x00lv_obj_create\x00ATS3089C\x00"
    blob = (
        b"HEADER 1.0.0.77"
        + b"\xff" * 64
        + b'<?xml version="1.0"?><info><board>x</board></info>'
        + b"\x00" * 16
        + lzma.compress(inner, format=lzma.FORMAT_XZ)
        + b"\xff" * 32
    )
    fw = tmp_path / "ota.bin"
    fw.write_bytes(blob)
    report = scan.scan(fw, keep=True)
    kinds = [r.kind for r in report.regions]
    assert "xz" in kinds and "xml" in kinds
    assert "ATS3089C" in report.markers and "1.0.0.77" in report.markers
    written = scan.extract(report, tmp_path / "out")
    assert any(p.read_bytes() == inner for p in written)
    assert "Regions:" in scan.format_report(report)
