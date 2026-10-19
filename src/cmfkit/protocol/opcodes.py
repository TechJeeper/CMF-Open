"""Opcode table for the CMF Watch Pro 2 / Watch 3 Pro command channel.

An opcode is the ``(cmd1, cmd2)`` pair carried in every frame header. Values come
from the community protocol write-up for the Watch Pro 2 (firmware 1.0.0.73),
which Gadgetbridge confirms is shared by the Watch 3 Pro.
"""

from __future__ import annotations

from typing import NamedTuple


class Op(NamedTuple):
    cmd1: int
    cmd2: int

    def __str__(self) -> str:
        return f"{self.cmd1:04X}:{self.cmd2:04X}"


# Session / device
TIME = Op(0xFFFF, 0x8004)
FIRMWARE_VERSION_GET = Op(0xFFFF, 0x8006)
FIRMWARE_VERSION_RET = Op(0xFFFF, 0x0006)
SERIAL_NUMBER_GET = Op(0x00DE, 0x0002)
SERIAL_NUMBER_RET = Op(0x00DE, 0x0001)
BATTERY = Op(0x005C, 0x0001)
FACTORY_RESET = Op(0x009A, 0x0001)
DEVICE_REBOOT = Op(0xFFFF, 0x9080)

# Auth
AUTH_PAIR_REQUEST = Op(0xFFFF, 0x8047)
AUTH_PAIR_REPLY = Op(0xFFFF, 0x0048)
AUTH_PHONE_NAME = Op(0xFFFF, 0x8049)
AUTH_WATCH_MAC = Op(0xFFFF, 0x0049)
AUTH_NONCE_REQUEST = Op(0xFFFF, 0x804B)
AUTH_NONCE_REPLY = Op(0xFFFF, 0x004C)
AUTH_CONFIRM_REQUEST = Op(0xFFFF, 0x804D)
AUTH_CONFIRM_REPLY = Op(0xFFFF, 0x0004)
AUTH_FAILED = Op(0xFFFF, 0xA061)

# Notifications / find
APP_NOTIFICATION = Op(0x0065, 0x0001)
APP_NOTIFICATION_ACK = Op(0x0065, 0x0003)
FIND_PHONE = Op(0x005B, 0x0001)
FIND_WATCH = Op(0x005D, 0x0001)
FIND_WATCH_ACK = Op(0x005D, 0x0003)

# Music (doubles as the only watch -> phone button input channel)
MUSIC_INFO_SET = Op(0xFFFF, 0x905C)
MUSIC_INFO_ACK = Op(0xFFFF, 0xA05C)
MUSIC_BUTTON = Op(0xFFFF, 0xA05D)

# Contacts / weather
CONTACTS_SET = Op(0x00D5, 0x0001)
CONTACTS_ACK = Op(0x00D5, 0x0003)
WEATHER_SET = Op(0xFFFF, 0x906B)

# Watchface transfer
DIAL_COMMAND_SET = Op(0xFFFF, 0x9055)
DIAL_COMMAND_RET = Op(0xFFFF, 0xA055)
WF_INIT1_REQUEST = Op(0xFFFF, 0x8052)
WF_INIT1_REPLY = Op(0xFFFF, 0x0052)
WF_INIT2_PHOTO_REQUEST = Op(0xFFFF, 0x9063)
WF_INIT2_PHOTO_REPLY = Op(0xFFFF, 0xA063)
WF_CHUNK_REQUEST = Op(0xFFFF, 0xA064)
WF_CHUNK_WRITE = Op(0xFFFF, 0x9064)
WF_FINISH_REQUEST = Op(0xFFFF, 0xA065)
WF_FINISH_ACK = Op(0xFFFF, 0x9065)

# Firmware OTA (mapped from the official app; never field-tested by the community)
FW_INIT1_REQUEST = Op(0xFFFF, 0x9052)
FW_INIT2_REQUEST = Op(0xFFFF, 0x9040)
FW_CHUNK_REQUEST = Op(0xFFFF, 0xA042)
FW_CHUNK_WRITE = Op(0xFFFF, 0x9042)

# Opcodes that are never AES-encrypted, even after a key is established.
PLAINTEXT_OPS: frozenset[Op] = frozenset(
    {
        AUTH_PAIR_REQUEST,
        AUTH_PAIR_REPLY,
        WF_CHUNK_WRITE,
        FW_CHUNK_WRITE,
        Op(0xFFFF, 0x905F),  # AGPS chunk write
    }
)

NAMES: dict[Op, str] = {value: name for name, value in globals().items() if isinstance(value, Op)}


def name_of(op: Op) -> str:
    return NAMES.get(op, str(op))
