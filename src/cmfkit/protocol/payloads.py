"""Builders and parsers for command payloads.

Strings are UTF-8, byte-truncated to the field size and zero-padded, which
mirrors how the firmware reads them.
"""

from __future__ import annotations

import struct
import time
from dataclasses import dataclass

POLL = b"\xa5"  # generic "request" byte used by most GET-style commands

NOTIFICATION_TITLE_MAX = 20
NOTIFICATION_BODY_MAX = 128
WEATHER_CITY_MAX = 32
MUSIC_FIELD_MAX = 64
CONTACT_NAME_MAX = 32
CONTACT_PHONE_MAX = 25
CONTACTS_MAX = 20

ICONS = {"whatsapp": 8, "telegram": 12, "instagram": 18, "gmail": 27, "generic": 0xFF}


def fixed(text: str, size: int) -> bytes:
    raw = text.encode("utf-8")[:size]
    return raw.ljust(size, b"\x00")


def clip(text: str, size: int) -> bytes:
    return text.encode("utf-8")[:size]


def time_sync(now: float | None = None, utc_offset_s: int | None = None) -> bytes:
    now = time.time() if now is None else now
    if utc_offset_s is None:
        utc_offset_s = time.localtime(now).tm_gmtoff
    return struct.pack(">ii", int(now), utc_offset_s * 1000)


def notification(title: str, body: str, icon: int = ICONS["generic"], when: int | None = None) -> bytes:
    when = int(time.time()) if when is None else when
    t = clip(title, NOTIFICATION_TITLE_MAX)
    b = clip(body, NOTIFICATION_BODY_MAX)
    return bytes([icon & 0xFF, 0]) + struct.pack(">I", when) + bytes([len(t)]) + t + b


def parse_notification(payload: bytes) -> tuple[int, str, str]:
    icon = payload[0]
    tlen = payload[6]
    title = payload[7 : 7 + tlen].decode("utf-8", "replace")
    body = payload[7 + tlen :].decode("utf-8", "replace")
    return icon, title, body


MUSIC_STOPPED, MUSIC_PAUSED, MUSIC_PLAYING = 0, 1, 2


def music_info(track: str, artist: str, state: int = MUSIC_PLAYING, volume: int = 8, volume_max: int = 16) -> bytes:
    return bytes([state, volume, volume_max]) + fixed(track, MUSIC_FIELD_MAX) + fixed(artist, MUSIC_FIELD_MAX)


def parse_music_info(payload: bytes) -> tuple[int, str, str]:
    track = payload[3:67].rstrip(b"\x00").decode("utf-8", "replace")
    artist = payload[67:131].rstrip(b"\x00").decode("utf-8", "replace")
    return payload[0], track, artist


@dataclass(frozen=True)
class Contact:
    name: str
    phone: str = ""


def contacts(entries: list[Contact]) -> bytes:
    return b"".join(fixed(c.name, CONTACT_NAME_MAX) + fixed(c.phone, CONTACT_PHONE_MAX) for c in entries[:CONTACTS_MAX])


def parse_contacts(payload: bytes) -> list[Contact]:
    out = []
    for i in range(0, len(payload) - 56, 57):
        name = payload[i : i + 32].rstrip(b"\x00").decode("utf-8", "replace")
        phone = payload[i + 32 : i + 57].rstrip(b"\x00").decode("utf-8", "replace")
        out.append(Contact(name, phone))
    return out


def _temp(celsius: int) -> int:
    return (celsius + 100) & 0xFF


def weather(
    city: str, temp_c: int = 20, low_c: int | None = None, high_c: int | None = None, condition: int = 1
) -> bytes:
    """WEATHER_SET (FFFF:906B), 199 bytes.

    Only the city string and the temperature encoding are confirmed; the rest of
    each 9-byte day record is a best guess (condition, current, low, high).
    """
    low_c = temp_c - 3 if low_c is None else low_c
    high_c = temp_c + 3 if high_c is None else high_c
    day = bytes([condition, _temp(temp_c), _temp(low_c), _temp(high_c)]).ljust(9, b"\x00")
    days = day * 7
    hours = bytes([condition, _temp(temp_c)]) * 24
    sun = struct.pack("<II", 6 * 3600, 18 * 3600) * 7
    payload = days + hours + fixed(city, WEATHER_CITY_MAX) + sun
    assert len(payload) == 199
    return payload


def parse_weather_city(payload: bytes) -> str:
    return payload[111:143].rstrip(b"\x00").decode("utf-8", "replace")


def parse_battery(payload: bytes) -> tuple[int, bool]:
    return payload[0], bool(payload[1]) if len(payload) > 1 else False


def parse_serial(payload: bytes) -> str:
    n = payload[0]
    return payload[1 : 1 + n].decode("ascii", "replace")


def parse_firmware_version(payload: bytes) -> str:
    if len(payload) >= 4:
        return ".".join(str(b) for b in payload[:4])
    return payload.hex()


def photo_dial_init(size: int, style: int = 0, x: int = 56, y: int = 77, color565: int = 0xFFFF) -> bytes:
    """INIT2 header for a photo watchface upload (FFFF:9063)."""
    return (
        b"\x01"
        + struct.pack(">I", size)
        + b"\xff\xff\xff\xff"
        + b"\x01\x01\x01"
        + struct.pack(">HHHH", style, x, y, color565)
        + b"\xff" * 8
    )


def chunk_request(payload: bytes) -> tuple[int, int]:
    """Parse a DATA_CHUNK_REQUEST: offset u32 BE, length u32 BE (+ optional progress byte)."""
    return struct.unpack_from(">II", payload)


def build_chunk_request(offset: int, length: int, progress: int = 0) -> bytes:
    return struct.pack(">IIB", offset, length, progress)
