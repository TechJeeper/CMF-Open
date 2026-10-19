"""Persist per-watch auth keys in ``~/.config/cmfkit/devices.json``."""

from __future__ import annotations

import json
import os
from pathlib import Path


def _path() -> Path:
    base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return base / "cmfkit" / "devices.json"


def load_all() -> dict[str, str]:
    p = _path()
    return json.loads(p.read_text()) if p.exists() else {}


def get(address: str) -> bytes | None:
    hexkey = load_all().get(address)
    return bytes.fromhex(hexkey) if hexkey else None


def put(address: str, authkey: bytes) -> Path:
    p = _path()
    p.parent.mkdir(parents=True, exist_ok=True)
    data = load_all()
    data[address] = authkey.hex()
    p.write_text(json.dumps(data, indent=2))
    p.chmod(0o600)
    return p
