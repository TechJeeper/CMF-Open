"""Crypto primitives used by the command channel.

* AES-128-CBC with PKCS7 padding and a fixed IV.
* CRC32 (zlib/IEEE) appended little-endian to every chunk before encryption.
* SHA-256 based key derivation for the long-lived auth key and per-connection
  session key.
"""

from __future__ import annotations

import hashlib
import zlib

from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

AES_IV = bytes.fromhex("5051525354555657606162636465665A")


def crc32_le(data: bytes) -> bytes:
    return (zlib.crc32(data) & 0xFFFFFFFF).to_bytes(4, "little")


def sha256(*parts: bytes) -> bytes:
    h = hashlib.sha256()
    for part in parts:
        h.update(part)
    return h.digest()


def derive_authkey(rnd1: bytes, rnd2: bytes, secret: bytes) -> bytes:
    return sha256(rnd1, rnd2, secret)[:16]


def derive_session_key(nonce: bytes, authkey: bytes) -> bytes:
    return sha256(nonce, authkey)[:16]


def sign(rnd: bytes, secret: bytes) -> bytes:
    return sha256(rnd, secret)


def aes_encrypt(key: bytes, plaintext: bytes) -> bytes:
    padder = padding.PKCS7(128).padder()
    padded = padder.update(plaintext) + padder.finalize()
    enc = Cipher(algorithms.AES(key), modes.CBC(AES_IV)).encryptor()
    return enc.update(padded) + enc.finalize()


def aes_decrypt(key: bytes, ciphertext: bytes) -> bytes:
    dec = Cipher(algorithms.AES(key), modes.CBC(AES_IV)).decryptor()
    padded = dec.update(ciphertext) + dec.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    return unpadder.update(padded) + unpadder.finalize()
