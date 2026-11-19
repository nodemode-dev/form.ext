"""What outside agents are doing, for the window to mirror in a read-only tab: each tools/call that reaches /mcp without one of the
Studio's own tab tokens is kept here (who, which tool, which project, when, and how it ended) and sent to the windows attached to
/api/agents/stream. Arguments and results are not kept: a line says which tool ran, never what was written."""

import asyncio
import secrets
import threading
import time
from collections import deque

from app.services import terminal

KEEP = 300
_lock = threading.Lock()
_log: deque[dict] = deque(maxlen=KEEP)
subscribers: set[asyncio.Queue] = set()


def _deliver(msg: dict) -> None:
    for q in list(subscribers):
        if q.qsize() < 2000:
            q.put_nowait(msg)


def _publish(msg: dict) -> None:
    with _lock:
        _log.append(msg)
    terminal.call_in_loop(_deliver, msg)


def backlog() -> list[dict]:
    with _lock:
        return list(_log)


def began(agent: str, params) -> str:
    from app.cli import BY_NAME

    params = params if isinstance(params, dict) else {}
    name = "".join(c for c in str(params.get("name") or "") if c.isprintable())[:80]
    op = BY_NAME.get(name)
    known = op is not None and op.mcp
    args = params.get("arguments") if isinstance(params.get("arguments"), dict) else {}
    project = "".join(c for c in str(args.get("id") or "") if c.isprintable())[:80] if known else ""
    title = op.title if known else ""
    call = secrets.token_urlsafe(9)
    line = f"{agent or 'An outside agent'}: {title or name} ({name})" + (f" in the project {project}" if project else "")
    _publish({"type": "call", "id": call, "agent": agent, "tool": name, "title": title, "project": project, "readOnly": bool(known and op.read_only), "at": time.time(), "line": line})
    return call


def ended(call: str, answer) -> None:
    result = answer.get("result") if isinstance(answer, dict) else None
    ok = isinstance(result, dict) and not result.get("isError")
    _publish({"type": "done", "id": call, "ok": ok, "at": time.time(), "line": "done" if ok else "refused or failed"})
