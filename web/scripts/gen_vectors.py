"""Generate cross-language test vectors from the Python cmfkit implementation.

    uv run python web/scripts/gen_vectors.py > web/src/lib/__fixtures__/vectors.json
"""

import json

from PIL import Image

from cmfkit.protocol import crypto, frame
from cmfkit.protocol import opcodes as ops
from cmfkit.protocol import payloads as pl
from cmfkit.watchface import photo

KEY = bytes(range(16))
RND1, RND2, SECRET, NONCE = (bytes([i] * 16) for i in (1, 2, 3, 4))

img = Image.new("RGB", (40, 40))
for x in range(40):
    for y in range(40):
        img.putpixel((x, y), (x * 6, y * 6, 128))

music = pl.music_info("Focus 24:59", "Pomodoro - 0 done", pl.MUSIC_PAUSED)
vectors = {
    "key": KEY.hex(),
    "authkey": crypto.derive_authkey(RND1, RND2, SECRET).hex(),
    "sessionKey": crypto.derive_session_key(NONCE, KEY).hex(),
    "sign": crypto.sign(RND1, SECRET).hex(),
    "crc": crypto.crc32_le(b"cmfkit").hex(),
    "notification": pl.notification("Hi", "from cmfkit ✓", when=1_700_000_000).hex(),
    "music": music.hex(),
    "weather": pl.weather("Lisbon", 21).hex(),
    "contacts": pl.contacts([pl.Contact("Lap 1", "00:42"), pl.Contact("Ä long name " * 4, "x")]).hex(),
    "timeSync": pl.time_sync(1_700_000_000, 3600).hex(),
    "photoInit": pl.photo_dial_init(12345, 2, 56, 77, 0xF800).hex(),
    "musicFrames": [f.hex() for f in frame.encode(ops.MUSIC_INFO_SET, music, KEY, mtu=64)],
    "plainFrames": [f.hex() for f in frame.encode(ops.WF_CHUNK_WRITE, bytes(range(200)), KEY, mtu=64)],
    "watchFrames": [f.hex() for f in frame.encode(ops.AUTH_PAIR_REPLY, bytes(48), None, omit_plaintext_crc=True)],
    "dial": photo.build(img, screen=40, thumb=20).hex(),
}
print(json.dumps(vectors, indent=1))
