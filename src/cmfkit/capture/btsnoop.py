"""Decode CMF watch traffic from an Android ``btsnoop_hci.log``.

Enable *Developer options -> Enable Bluetooth HCI snoop log*, use the Nothing X
app, then pull the log (``adb bugreport`` or ``/data/misc/bluetooth/logs``).
Frame headers are always cleartext, so the opcode sequence is visible without
keys; pass the auth key to also decrypt payloads (the session key is derived
from the nonce seen in the capture).
"""

from __future__ import annotations

import struct
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from ..protocol import crypto, frame
from ..protocol import opcodes as ops
from ..protocol.opcodes import PLAINTEXT_OPS, Op

BTSNOOP_MAGIC = b"btsnoop\x00"
EPOCH_DELTA_US = 0x00DCDDB30F2F8000  # btsnoop epoch (year 0) -> unix epoch
ATT_CID = 0x0004
ATT_WRITE_REQ, ATT_WRITE_CMD, ATT_NOTIFY, ATT_INDICATE = 0x12, 0x52, 0x1B, 0x1D


@dataclass
class AttValue:
    ts_us: int
    outgoing: bool  # phone -> watch
    handle: int
    value: bytes


def read_att(path: str | Path) -> Iterator[AttValue]:
    data = Path(path).read_bytes()
    if data[:8] != BTSNOOP_MAGIC:
        raise ValueError("not a btsnoop file")
    _version, datalink = struct.unpack_from(">II", data, 8)
    pos = 16
    partial: dict[int, tuple[bytearray, int, int, bool]] = {}
    while pos + 24 <= len(data):
        _orig, incl, flags, _drops, ts = struct.unpack_from(">IIIIq", data, pos)
        pkt = data[pos + 24 : pos + 24 + incl]
        pos += 24 + incl
        if datalink == 1002:  # H4: leading packet-type byte
            if not pkt or pkt[0] != 0x02:
                continue
            pkt = pkt[1:]
        elif datalink != 1001 or flags & 0x02:  # 1001 = raw HCI; flag bit1 = command/event
            continue
        if len(pkt) < 4:
            continue
        handle_flags, acl_len = struct.unpack_from("<HH", pkt)
        conn, boundary = handle_flags & 0x0FFF, (handle_flags >> 12) & 0x3
        body = pkt[4 : 4 + acl_len]
        outgoing = not (flags & 0x01)
        if boundary in (0x00, 0x02):
            if len(body) < 4:
                continue
            l2_len, cid = struct.unpack_from("<HH", body)
            partial[conn] = (bytearray(body[4:]), l2_len, cid, outgoing)
        elif conn in partial:
            partial[conn][0].extend(body)
        else:
            continue
        buf, l2_len, cid, direction = partial[conn]
        if len(buf) < l2_len:
            continue
        del partial[conn]
        if cid != ATT_CID or not buf:
            continue
        opcode = buf[0]
        if opcode in (ATT_WRITE_REQ, ATT_WRITE_CMD, ATT_NOTIFY, ATT_INDICATE) and len(buf) >= 3:
            (att_handle,) = struct.unpack_from("<H", buf, 1)
            yield AttValue(ts - EPOCH_DELTA_US, direction, att_handle, bytes(buf[3:l2_len]))


@dataclass
class RawFrame:
    op: Op
    index: int
    count: int
    body: bytes
    encrypted: bool


class _Stream:
    """Frame splitter tolerant of both plaintext CRC conventions."""

    def __init__(self) -> None:
        self.buf = bytearray()

    def feed(self, data: bytes) -> Iterator[RawFrame]:
        self.buf.extend(data)
        while True:
            start = self.buf.find(frame.MAGIC)
            if start < 0:
                self.buf.clear()
                return
            del self.buf[:start]
            if len(self.buf) < frame.HEADER_LEN:
                return
            _, n, cmd1, count, index, cmd2 = frame.HEADER.unpack_from(self.buf)
            op = Op(cmd1, cmd2)
            encrypted = op not in PLAINTEXT_OPS
            if encrypted:
                size = n
            else:
                avail = len(self.buf) - frame.HEADER_LEN
                short = n - 4
                nxt = frame.HEADER_LEN + short
                size = short if avail == short or (avail > short and self.buf[nxt] == frame.MAGIC) else n
            if len(self.buf) < frame.HEADER_LEN + size:
                return
            body = bytes(self.buf[frame.HEADER_LEN : frame.HEADER_LEN + size])
            del self.buf[: frame.HEADER_LEN + size]
            if not encrypted and size == n and len(body) >= 4 and crypto.crc32_le(body[:-4]) == body[-4:]:
                body = body[:-4]
            yield RawFrame(op, index, count, body, encrypted)


def decode_log(path: str | Path, authkey: bytes | None = None, show_payload: bool = True) -> Iterator[str]:
    streams: dict[tuple[bool, int], _Stream] = {}
    key: bytes | None = None
    t0: int | None = None
    for att in read_att(path):
        t0 = att.ts_us if t0 is None else t0
        stamp = f"{(att.ts_us - t0) / 1e6:9.3f}s {'->' if att.outgoing else '<-'} h{att.handle:04x}"
        if att.value[:1] != bytes([frame.MAGIC]) and all(32 <= b < 127 or b in (10, 13) for b in att.value):
            yield f"{stamp} AT    {att.value.decode().strip()}"
            continue
        stream = streams.setdefault((att.outgoing, att.handle), _Stream())
        for rf in stream.feed(att.value):
            name = ops.name_of(rf.op)
            text = ""
            if show_payload:
                payload = rf.body
                if rf.encrypted:
                    if rf.op == ops.AUTH_PHONE_NAME and authkey:
                        key = authkey
                    try:
                        payload = crypto.aes_decrypt(key, rf.body)[:-4] if key else None
                    except ValueError:
                        payload = None
                    if payload is not None and rf.op == ops.AUTH_NONCE_REPLY and authkey:
                        key = crypto.derive_session_key(payload, authkey)
                text = payload.hex() if payload is not None else f"<encrypted {len(rf.body)} B>"
            chunk = f" [{rf.index}/{rf.count}]" if rf.count > 1 else ""
            yield f"{stamp} {name:<26}{chunk} {text}"
