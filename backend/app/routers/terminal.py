"""The Studio's terminals: open, list, resize, restart and close engine PTYs over HTTP, and attach one over a WebSocket.
Output goes to the window as text frames; a binary frame carries a JSON control message (exit), so shell output can never be
mistaken for one. Only this computer's window may open a shell: a request whose Host or Origin is not this computer is
refused, because a WebSocket is not covered by CORS."""

import asyncio
import json
import os
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.services import claude_code, terminal

LOOPBACK = {"localhost", "127.0.0.1", "::1", "tauri.localhost"}
MAX_SOCKETS = 24


def _loopback(netloc: str | None) -> bool:
    return bool(netloc) and (urlparse(f"//{netloc}").hostname or "") in LOOPBACK


def origin_ok(origin: str | None, host: str | None) -> bool:
    if not _loopback(host):
        return False
    if not origin:
        return True
    parsed = urlparse(origin)
    return parsed.scheme in ("http", "https", "tauri") and (parsed.hostname or "") in LOOPBACK


def require_local(request: Request) -> None:
    if not origin_ok(request.headers.get("origin"), request.headers.get("host")):
        raise HTTPException(status_code=403, detail="Only the form.ext window on this computer may use the terminals.")


async def bound(request: Request) -> None:
    require_local(request)
    terminal.bind(asyncio.get_running_loop())


_sockets = 0


def take_socket() -> bool:
    global _sockets
    if _sockets >= MAX_SOCKETS:
        return False
    _sockets += 1
    return True


def release_socket() -> None:
    global _sockets
    _sockets = max(0, _sockets - 1)


def server_port(request: Request) -> int:
    server = request.scope.get("server")
    return server[1] if server and server[1] else int(os.environ.get("FORMEXT_PORT") or 8640)


router = APIRouter(prefix="/api/terminal", tags=["terminal"])
LOCAL = [Depends(bound)]


class OpenBody(BaseModel):
    cols: int = Field(100, ge=10, le=500)
    rows: int = Field(30, ge=4, le=200)
    title: str | None = Field(None, max_length=60)
    project: str | None = Field(None, max_length=80)


class SizeBody(BaseModel):
    cols: int = Field(ge=10, le=500)
    rows: int = Field(ge=4, le=200)


class ClaudeBody(BaseModel):
    prompt: str | None = Field(None, max_length=100_000)
    resume: str | None = Field(None, max_length=200)
    cols: int | None = None
    rows: int | None = None
    fresh: bool = False
    project: str | None = Field(None, max_length=80)


def _session(sid: str) -> terminal.Session:
    try:
        return terminal.get(sid)
    except KeyError:
        raise HTTPException(status_code=404, detail="There is no such terminal.")


@router.get("", dependencies=LOCAL)
def list_terminals() -> dict:
    return {"terminals": terminal.listing(), "cwd": str(terminal.workroot())}


@router.post("", dependencies=LOCAL)
def open_terminal(body: OpenBody) -> dict:
    try:
        return terminal.open_session(claude_code.project_folder(body.project), cols=body.cols, rows=body.rows, title=body.title).describe()
    except (OSError, FileNotFoundError) as exc:
        raise HTTPException(status_code=500, detail=f"The shell could not start: {exc}")


@router.post("/claude", dependencies=LOCAL)
def open_claude(body: ClaudeBody, request: Request) -> dict:
    try:
        return claude_code.open_terminal(server_port(request), body.prompt, body.resume, min(max(body.cols or 100, 10), 500), min(max(body.rows or 30, 4), 200), body.fresh, body.project)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Claude Code could not start: {exc}")


@router.post("/{sid}/resize", dependencies=LOCAL)
def resize_terminal(sid: str, body: SizeBody) -> dict:
    _session(sid)
    terminal.resize(sid, body.cols, body.rows)
    return {"ok": True}


@router.post("/{sid}/restart", dependencies=LOCAL)
def restart_terminal(sid: str) -> dict:
    _session(sid)
    return terminal.restart(sid).describe()


@router.delete("/{sid}", dependencies=LOCAL)
def close_terminal(sid: str) -> dict:
    terminal.close(sid)
    return {"ok": True}


@router.websocket("/{sid}/stream")
async def attach(ws: WebSocket, sid: str) -> None:
    if not origin_ok(ws.headers.get("origin"), ws.headers.get("host")):
        await ws.close(code=4403)
        return
    if not take_socket():
        await ws.close(code=4429)
        return
    terminal.bind(asyncio.get_running_loop())
    await ws.accept()
    try:
        session = terminal.get(sid)
    except KeyError:
        release_socket()
        await ws.close(code=4404)
        return
    queue: asyncio.Queue = asyncio.Queue()
    session.subscribers.add(queue)

    async def outbound() -> None:
        backlog = session.scrollback()
        if backlog:
            await ws.send_text(backlog)
        if not session.alive:
            await ws.send_bytes(json.dumps({"type": "exit"}).encode())
        while True:
            text = await queue.get()
            if text is None:
                await ws.send_bytes(json.dumps({"type": "exit"}).encode())
                continue
            await ws.send_text(text)

    sender = asyncio.create_task(outbound())
    try:
        while True:
            try:
                msg = json.loads(await ws.receive_text())
            except ValueError:
                continue
            if not isinstance(msg, dict):
                continue
            if msg.get("type") == "input" and session.alive:
                terminal.write(sid, str(msg.get("data", "")))
            elif msg.get("type") == "resize":
                try:
                    terminal.resize(sid, int(msg.get("cols", 80)), int(msg.get("rows", 24)))
                except (TypeError, ValueError):
                    continue
    except WebSocketDisconnect:
        pass
    finally:
        release_socket()
        sender.cancel()
        session.subscribers.discard(queue)
