import asyncio
import hmac
import json
import os
import secrets

from fastapi import HTTPException, Request

HEADER = "x-formext-window-key"
STDOUT_ENV = "FORMEXT_WINDOW_KEY_STDOUT"
LINE = "formext-window-key: "
ADDRESS = "formext-engine: "
INPROCESS = "formext.inprocess"
REFUSED = "Only the form.ext window can do this"
HELLO_WAIT = 10.0
READS = ("GET", "HEAD", "OPTIONS")
OPEN = ("/mcp", "/api/window/key")
KEY = secrets.token_urlsafe(32)
STATE = {"claimed": False, "secondClaim": False}


def stdout_mode() -> bool:
    return os.environ.get(STDOUT_ENV) == "1"


def announce() -> None:
    if stdout_mode():
        print(LINE + KEY, flush=True)


def valid(value) -> bool:
    return isinstance(value, str) and bool(value) and hmac.compare_digest(value.encode("utf-8"), KEY.encode("utf-8"))


def require(request: Request) -> None:
    if not (request.scope.get(INPROCESS) is True or valid(request.headers.get(HEADER))):
        raise HTTPException(403, REFUSED)


def claim() -> str | None:
    if STATE["claimed"]:
        STATE["secondClaim"] = True
        return None
    STATE["claimed"] = True
    return KEY


async def admit(ws) -> bool:
    try:
        first = json.loads(await asyncio.wait_for(ws.receive_text(), HELLO_WAIT))
    except Exception:
        return False
    return isinstance(first, dict) and first.get("type") == "window" and valid(first.get("key"))


class WindowKeyGuard:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or scope.get("method") in READS or str(scope.get("path", "")) in OPEN or scope.get(INPROCESS) is True:
            await self.app(scope, receive, send)
            return
        given = next((v.decode("latin-1") for k, v in scope.get("headers", []) if k.decode("latin-1").lower() == HEADER), None)
        if valid(given):
            await self.app(scope, receive, send)
            return
        body = json.dumps({"detail": REFUSED}).encode("utf-8")
        await send({"type": "http.response.start", "status": 403, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})
