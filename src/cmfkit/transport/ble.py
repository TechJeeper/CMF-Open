"""Real Bluetooth LE transport built on bleak (Linux/BlueZ, macOS, Windows)."""

from __future__ import annotations

from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice

from .base import Channel, NotifyHandler

NAME_PREFIX = "CMF Watch"

WRITE_UUIDS = {
    Channel.COMMAND: "0000fff2-0000-1000-8000-00805f9b34fb",
    Channel.SHELL: "77d4ff01-2fe2-2334-0d35-9ccd078f529c",
    Channel.DATA: "02f00000-0000-0000-0000-00000000ffe1",
}
NOTIFY_UUIDS = {
    Channel.COMMAND: "0000fff1-0000-1000-8000-00805f9b34fb",
    Channel.SHELL: "77d4ff02-2fe2-2334-0d35-9ccd078f529c",
    Channel.DATA: "02f00000-0000-0000-0000-00000000ffe2",
}


async def scan(timeout: float = 8.0) -> list[BLEDevice]:
    devices = await BleakScanner.discover(timeout=timeout)
    return [d for d in devices if (d.name or "").startswith(NAME_PREFIX)]


class BleTransport:
    def __init__(self, address: str) -> None:
        self.name = address
        self._address = address
        self._client: BleakClient | None = None
        self._handler: NotifyHandler | None = None

    @property
    def mtu(self) -> int:
        return self._client.mtu_size if self._client else 23

    def set_notify_handler(self, handler: NotifyHandler) -> None:
        self._handler = handler

    async def connect(self) -> None:
        self._client = BleakClient(self._address)
        await self._client.connect()
        if hasattr(self._client, "_backend") and hasattr(self._client._backend, "_acquire_mtu"):
            await self._client._backend._acquire_mtu()  # BlueZ needs this to report the real MTU
        available = {c.uuid for s in self._client.services for c in s.characteristics}
        for channel, uuid in NOTIFY_UUIDS.items():
            if uuid in available:
                await self._client.start_notify(uuid, self._make_callback(channel))

    def _make_callback(self, channel: Channel):
        def callback(_char, data: bytearray) -> None:
            if self._handler:
                self._handler(channel, bytes(data))

        return callback

    async def disconnect(self) -> None:
        if self._client:
            await self._client.disconnect()
            self._client = None

    async def write(self, channel: Channel, data: bytes) -> None:
        if not self._client:
            raise RuntimeError("not connected")
        await self._client.write_gatt_char(WRITE_UUIDS[channel], data, response=False)
