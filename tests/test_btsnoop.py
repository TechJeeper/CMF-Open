import struct

from cmfkit.capture import btsnoop
from cmfkit.session import Session
from cmfkit.transport.base import Channel
from cmfkit.transport.sim import SimWatch

HANDLES = {Channel.COMMAND: (0x0010, 0x000E), Channel.SHELL: (0x0020, 0x001E), Channel.DATA: (0x0030, 0x002E)}


class RecordingSim(SimWatch):
    """Simulated watch that records its traffic as btsnoop H4 records."""

    def __init__(self) -> None:
        super().__init__()
        self.records: list[tuple[bool, int, bytes]] = []

    async def write(self, channel, data):
        self.records.append((True, HANDLES[channel][0], data))
        await super().write(channel, data)

    def _notify(self, channel, data):
        self.records.append((False, HANDLES[channel][1], data))
        super()._notify(channel, data)

    def to_btsnoop(self) -> bytes:
        out = bytearray(btsnoop.BTSNOOP_MAGIC + struct.pack(">II", 1, 1002))
        for i, (outgoing, handle, value) in enumerate(self.records):
            att = bytes([btsnoop.ATT_WRITE_CMD if outgoing else btsnoop.ATT_NOTIFY]) + struct.pack("<H", handle) + value
            l2 = struct.pack("<HH", len(att), btsnoop.ATT_CID) + att
            acl = b"\x02" + struct.pack("<HH", 0x0040 | 0x2000, len(l2)) + l2
            ts = btsnoop.EPOCH_DELTA_US + i * 1000
            out += struct.pack(">IIIIq", len(acl), len(acl), 0 if outgoing else 1, 0, ts) + acl
        return bytes(out)


async def test_decode_simulated_capture(tmp_path):
    watch = RecordingSim()
    await watch.connect()
    s = Session(watch, timeout=2)
    authkey = await s.pair()
    await s.notify("Captured", "hello snoop")
    await s.battery()
    log = tmp_path / "btsnoop_hci.log"
    log.write_bytes(watch.to_btsnoop())

    headers = list(btsnoop.decode_log(log))
    assert any("AT    AT GETSECRET" in line for line in headers)
    assert any("AUTH_PAIR_REQUEST" in line for line in headers)
    assert any("APP_NOTIFICATION" in line and "<encrypted" in line for line in headers)

    decrypted = "\n".join(btsnoop.decode_log(log, authkey))
    assert b"hello snoop".hex() in decrypted
    assert "BATTERY" in decrypted and "5700" in decrypted  # 87 % (0x57), not charging
