"""The ``0xF5`` frame format used on the command and data characteristics.

Layout (header integers big-endian)::

    F5 | chunkLen u16 | cmd1 u16 | chunkCount u16 | chunkIndex u16 | cmd2 u16 | chunk

Each chunk body is ``piece || CRC32_LE(piece)``. Encrypted opcodes AES-encrypt
that whole body. Plaintext frames sent by the watch advertise the CRC in
``chunkLen`` but omit it on the wire; :class:`FrameDecoder` handles both forms.
"""

from __future__ import annotations

import struct
from collections.abc import Iterator
from dataclasses import dataclass, field

from . import crypto
from .opcodes import PLAINTEXT_OPS, Op

MAGIC = 0xF5
HEADER = struct.Struct(">BHHHHH")
HEADER_LEN = HEADER.size  # 11


class FrameError(ValueError):
    pass


@dataclass(frozen=True)
class Message:
    op: Op
    payload: bytes


def is_encrypted(op: Op, key: bytes | None) -> bool:
    return key is not None and op not in PLAINTEXT_OPS


def chunk_capacity(mtu: int, encrypted: bool) -> int:
    """Max payload bytes per chunk so one frame fits one BLE write."""
    max_write = mtu - 3
    if encrypted:
        cap = ((max_write - HEADER_LEN) // 16) * 16 - 4 - 1
    else:
        cap = max_write - HEADER_LEN - 4 - 2
    if cap < 1:
        raise FrameError(f"MTU {mtu} is too small; negotiate a larger MTU first")
    return cap


def encode(op: Op, payload: bytes, key: bytes | None, mtu: int = 247, omit_plaintext_crc: bool = False) -> list[bytes]:
    """Encode ``payload`` as one or more frames, each meant for a single BLE write.

    ``omit_plaintext_crc`` reproduces the watch's own encoding (used by the simulator).
    """
    encrypted = is_encrypted(op, key)
    cap = chunk_capacity(mtu, encrypted)
    pieces = [payload[i : i + cap] for i in range(0, len(payload), cap)] or [b""]
    frames = []
    for index, piece in enumerate(pieces, start=1):
        body = piece + crypto.crc32_le(piece)
        if encrypted:
            assert key is not None
            body = crypto.aes_encrypt(key, body)
        header = HEADER.pack(MAGIC, len(body), op.cmd1, len(pieces), index, op.cmd2)
        if omit_plaintext_crc and not encrypted:
            body = piece
        frames.append(header + body)
    return frames


@dataclass
class FrameDecoder:
    """Reassembles frames from a raw notification byte stream into messages.

    ``plaintext_crc_on_wire`` describes the sender: the real watch omits the CRC
    on plaintext frames (False); cmfkit's encoder always sends it (True).
    """

    plaintext_crc_on_wire: bool = False
    key: bytes | None = None
    _buf: bytearray = field(default_factory=bytearray)
    _partial: dict[Op, list[bytes]] = field(default_factory=dict)

    def feed(self, data: bytes) -> Iterator[Message]:
        self._buf.extend(data)
        while True:
            start = self._buf.find(MAGIC)
            if start < 0:
                self._buf.clear()
                return
            del self._buf[:start]
            if len(self._buf) < HEADER_LEN:
                return
            _, chunk_len, cmd1, count, index, cmd2 = HEADER.unpack_from(self._buf)
            op = Op(cmd1, cmd2)
            encrypted = is_encrypted(op, self.key)
            wire_len = chunk_len
            if not encrypted and not self.plaintext_crc_on_wire:
                wire_len = max(chunk_len - 4, 0)
            if len(self._buf) < HEADER_LEN + wire_len:
                return
            body = bytes(self._buf[HEADER_LEN : HEADER_LEN + wire_len])
            del self._buf[: HEADER_LEN + wire_len]
            piece = self._open(body, encrypted)
            if count <= 1:
                yield Message(op, piece)
                continue
            parts = self._partial.setdefault(op, [])
            if index == 1:
                parts.clear()
            parts.append(piece)
            if index == count:
                yield Message(op, b"".join(parts))
                del self._partial[op]

    def _open(self, body: bytes, encrypted: bool) -> bytes:
        if encrypted:
            assert self.key is not None
            try:
                body = crypto.aes_decrypt(self.key, body)
            except ValueError as exc:
                raise FrameError("AES decryption failed (wrong key?)") from exc
        elif not self.plaintext_crc_on_wire:
            return body
        if len(body) < 4:
            raise FrameError("chunk shorter than its CRC")
        piece, crc = body[:-4], body[-4:]
        if crypto.crc32_le(piece) != crc:
            raise FrameError("CRC mismatch")
        return piece
