import secrets
import threading
import time

from app.services.bus import bus

MODES = ("ask", "allowed", "blocked")
WAIT = 120.0
BLOCKED = "Outside agents are blocked in form.ext's Settings, Agents, so this call was refused. Tell the person where to change it and stop; do not retry."
DENIED = "The person did not allow this in the form.ext window, so it was refused. Do not retry unless they ask you to."
NO_WINDOW = "form.ext asks the person before an outside agent changes anything, and no form.ext window is open to ask. Ask them to open form.ext, or to choose Allowed in Settings, Agents."
TIMED_OUT = "Nobody answered in the form.ext window in time, so this call was refused. Ask the person to look at the form.ext window, then retry."

_lock = threading.Lock()
_pending: dict[str, dict] = {}
_windows = {"count": 0}


def access() -> str:
    from app.services import settings

    mode = settings.get().get("agent_access")
    return mode if mode in MODES else "ask"


def window_opened() -> None:
    with _lock:
        _windows["count"] += 1


def window_closed() -> None:
    with _lock:
        _windows["count"] = max(0, _windows["count"] - 1)


def windows() -> int:
    with _lock:
        return _windows["count"]


def pending() -> list[dict]:
    with _lock:
        items = sorted(_pending.values(), key=lambda r: r["at"])
        return [{k: r[k] for k in ("id", "tool", "title", "project", "at")} for r in items if r["answer"] is None]


def answer(request_id: str, choice: str) -> bool:
    from app.services import settings

    if choice not in ("deny", "once", "always"):
        raise ValueError("answer is deny, once or always")
    with _lock:
        item = _pending.get(request_id)
        if item is None or item["answer"] is not None:
            return False
        item["answer"] = choice
    if choice == "always":
        settings.update({"agent_access": "allowed"}, window=True)
    item["done"].set()
    bus.emit("agents.answered", {"id": request_id})
    return True


def check(tool: str, title: str, args: dict) -> str | None:
    mode = access()
    if mode == "allowed":
        return None
    if mode == "blocked":
        return BLOCKED
    if windows() < 1:
        return NO_WINDOW
    item = {"id": secrets.token_urlsafe(12), "tool": tool, "title": title, "project": str(args.get("id") or ""), "at": time.time(), "answer": None, "done": threading.Event()}
    with _lock:
        _pending[item["id"]] = item
    bus.emit("agents.ask", None)
    try:
        item["done"].wait(WAIT)
    finally:
        with _lock:
            _pending.pop(item["id"], None)
        if item["answer"] is None:
            bus.emit("agents.answered", {"id": item["id"]})
    if item["answer"] in ("once", "always"):
        return None
    return DENIED if item["answer"] == "deny" else TIMED_OUT
