"""Resolve an app by built-in name or by ``path/to/file.py:ClassName``."""

from __future__ import annotations

import importlib.util
import inspect
from pathlib import Path

from .base import WatchApp
from .examples.checklist import Checklist
from .examples.navigate import Navigate
from .examples.pomodoro import Pomodoro
from .examples.ticker import Ticker

BUILTIN: dict[str, type[WatchApp]] = {cls.name: cls for cls in (Pomodoro, Navigate, Ticker, Checklist)}


def load(spec: str) -> type[WatchApp]:
    if spec in BUILTIN:
        return BUILTIN[spec]
    path_str, _, cls_name = spec.partition(":")
    path = Path(path_str)
    if not path.is_file():
        raise ValueError(f"unknown app {spec!r}; built-ins: {', '.join(BUILTIN)}")
    module_spec = importlib.util.spec_from_file_location(path.stem, path)
    assert module_spec and module_spec.loader
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    candidates = [
        obj
        for name, obj in inspect.getmembers(module, inspect.isclass)
        if issubclass(obj, WatchApp) and obj is not WatchApp and (not cls_name or name == cls_name)
    ]
    if not candidates:
        raise ValueError(f"no WatchApp subclass found in {path}")
    return candidates[0]
