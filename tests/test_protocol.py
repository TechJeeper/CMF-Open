import os

import pytest

from cmfkit.protocol import crypto, frame
from cmfkit.protocol import opcodes as ops
from cmfkit.protocol import payloads as pl


def test_header_is_eleven_bytes_big_endian():
    (f,) = frame.encode(ops.TIME, b"\x01\x02", key=None)
    assert f[0] == 0xF5
    assert f[1:3] == (2 + 4).to_bytes(2, "big")
    assert f[3:5] == b"\xff\xff" and f[9:11] == b"\x80\x04"
    assert f[5:7] == b"\x00\x01" and f[7:9] == b"\x00\x01"
    assert len(f) == 11 + 6


@pytest.mark.parametrize("size", [0, 1, 200, 5000])
def test_encrypted_roundtrip_multi_chunk(size):
    key = os.urandom(16)
    payload = os.urandom(size)
    frames = frame.encode(ops.APP_NOTIFICATION, payload, key, mtu=100)
    assert all(len(f) <= 97 for f in frames)
    assert all((len(f) - 11) % 16 == 0 for f in frames)
    dec = frame.FrameDecoder(plaintext_crc_on_wire=True, key=key)
    msgs = list(dec.feed(b"".join(frames)))
    assert msgs == [frame.Message(ops.APP_NOTIFICATION, payload)]


def test_plaintext_ops_stay_plaintext_with_key():
    key = os.urandom(16)
    (f,) = frame.encode(ops.AUTH_PAIR_REQUEST, b"abc", key)
    assert f[11:14] == b"abc"


def test_watch_style_plaintext_omits_crc_but_counts_it():
    (f,) = frame.encode(ops.AUTH_PAIR_REPLY, b"x" * 48, None, omit_plaintext_crc=True)
    assert int.from_bytes(f[1:3], "big") == 52 and len(f) == 11 + 48
    msgs = list(frame.FrameDecoder().feed(f))
    assert msgs[0].payload == b"x" * 48


def test_decoder_handles_split_writes_and_garbage():
    key = os.urandom(16)
    frames = b"".join(frame.encode(ops.BATTERY, b"\x40\x01", key))
    dec = frame.FrameDecoder(plaintext_crc_on_wire=True, key=key)
    out = list(dec.feed(b"\x00\x13" + frames[:5])) + list(dec.feed(frames[5:]))
    assert out == [frame.Message(ops.BATTERY, b"\x40\x01")]


def test_bad_crc_rejected():
    (f,) = frame.encode(ops.TIME, b"hello", None)
    broken = f[:-1] + bytes([f[-1] ^ 1])
    with pytest.raises(frame.FrameError):
        list(frame.FrameDecoder(plaintext_crc_on_wire=True).feed(broken))


def test_key_derivation_shapes():
    a = crypto.derive_authkey(b"1" * 16, b"2" * 16, b"s" * 16)
    s = crypto.derive_session_key(b"n" * 16, a)
    assert len(a) == len(s) == 16 and a != s
    assert crypto.aes_decrypt(s, crypto.aes_encrypt(s, b"data")) == b"data"


def test_payload_layouts():
    n = pl.notification("T" * 40, "B", icon=8, when=0x01020304)
    assert n[:7] == bytes([8, 0, 1, 2, 3, 4, 20]) and pl.parse_notification(n)[1] == "T" * 20
    assert len(pl.music_info("a", "b")) == 131
    w = pl.weather("Hello world")
    assert len(w) == 199 and pl.parse_weather_city(w) == "Hello world"
    assert len(pl.contacts([pl.Contact("x")] * 25)) == 20 * 57
    assert len(pl.time_sync(0, 3600)) == 8 and pl.time_sync(0, 3600)[4:] == (3600000).to_bytes(4, "big")
    assert len(pl.photo_dial_init(1234)) == 1 + 4 + 4 + 3 + 8 + 8
