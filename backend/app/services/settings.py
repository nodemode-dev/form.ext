import copy
import json
import os
import threading
from typing import Any

from app.services import paths, seal
from app.services.bus import bus

DEFAULTS: dict[str, Any] = {
    "theme": "dark",
    "author": "",
    "publisher": "",
    "licence": "Apache-2.0",
    "default_product": "formvis",
    "formportal_root": "",
    "formportal_cli": "",
    "agent_access": "",
    "editor": {"font_size": 13, "tab_size": 2, "wrap": False},
    "preview": {"theme": "dark", "consent": "ask"},
    "registry": {
        "url": "https://github.com/nodemode-dev/form.ext-registry/releases/download/index/extensions.json",
        "checkout": "",
        "developer": False,
    },
    "sources": {"auto": True, "base": "", "local": {}},
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
        return seal.effective(_merge(DEFAULTS, _read()))


def value(key: str, default: Any = None) -> Any:
    current: Any = get()
    for part in key.split("."):
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current


def update(patch: dict, window: bool = False) -> dict:
    if not isinstance(patch, dict):
        raise ValueError("settings must be an object")
    patch = {k: v for k, v in patch.items() if k not in (seal.FIELD, "sealBroken", "agentAccessReset") and (window or k != "agent_access")}
    if patch.get("agent_access") not in (None, "", "ask", "allowed", "blocked"):
        raise ValueError("agent_access is ask, allowed or blocked")
    with _lock:
        current = _read()
        stored = _merge(current, patch)
        stored = {k: v for k, v in stored.items() if v is not None}
        if window:
            broken = seal.effective(_merge(DEFAULTS, current)).get("sealBroken")
            stored = {k: ("" if broken and k in seal.SEALED and k not in patch else v) for k, v in stored.items() if k != seal.FIELD}
            mark = seal.sign(_merge(DEFAULTS, stored)).get(seal.FIELD)
            if mark:
                stored[seal.FIELD] = mark
        _write(stored)
        merged = seal.effective(_merge(DEFAULTS, stored))
    bus.emit("settings.changed", merged)
    return merged
