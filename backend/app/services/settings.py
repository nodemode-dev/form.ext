import copy
import json
import os
import threading
from typing import Any

from app.services import paths
from app.services.bus import bus

DEFAULTS: dict[str, Any] = {
    "theme": "dark",
    "author": "",
    "publisher": "",
    "licence": "Apache-2.0",
    "default_product": "formvis",
    "formportal_root": "",
    "formportal_cli": "",
    "editor": {"font_size": 13, "tab_size": 2, "wrap": False},
    "preview": {"theme": "dark", "consent": "ask"},
}

_lock = threading.Lock()


def _merge(base: dict, patch: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


def _read() -> dict:
    try:
        data = json.loads(paths.settings_file().read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _write(data: dict) -> None:
    target = paths.settings_file()
    tmp = target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    os.replace(tmp, target)


def get() -> dict:
    with _lock:
        return _merge(DEFAULTS, _read())


def value(key: str, default: Any = None) -> Any:
    current: Any = get()
    for part in key.split("."):
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current


def update(patch: dict) -> dict:
    if not isinstance(patch, dict):
        raise ValueError("settings must be an object")
    with _lock:
        stored = _merge(_read(), patch)
        stored = {k: v for k, v in stored.items() if v is not None}
        _write(stored)
        merged = _merge(DEFAULTS, stored)
    bus.emit("settings.changed", merged)
    return merged
