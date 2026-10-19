from __future__ import annotations

import enum
from collections.abc import Callable
from typing import Protocol


class Channel(enum.Enum):
    COMMAND = "command"
    SHELL = "shell"
    DATA = "data"


NotifyHandler = Callable[[Channel, bytes], None]


class Transport(Protocol):
    """A link to one watch. Implemented by real BLE and by the simulator."""

    name: str

    @property
    def mtu(self) -> int: ...

    async def connect(self) -> None: ...

    async def disconnect(self) -> None: ...

    async def write(self, channel: Channel, data: bytes) -> None: ...

    def set_notify_handler(self, handler: NotifyHandler) -> None: ...
