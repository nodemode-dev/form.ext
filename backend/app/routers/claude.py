"""Claude Code in the Studio's Chat tab: status, start, send, stop and the answer to a permission question over HTTP, and the
agent's messages over a WebSocket (the log so far, then live). The same local-origin rule as the terminals."""

import asyncio
import json

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.routers.terminal import LOCAL, origin_ok, release_socket, server_port, take_socket
from app.services import claude_code, terminal

router = APIRouter(prefix="/api/claude", tags=["agent"])


class StartBody(BaseModel):
    mode: str = Field("ask", max_length=20)
    fresh: bool = False
    project: str | None = Field(None, max_length=80)


class SendBody(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)


class AnswerBody(BaseModel):
    id: str = Field(max_length=200)
    allow: bool


@router.get("/status", dependencies=LOCAL)
def status(fresh: bool = False, project: str | None = None) -> dict:
    return claude_code.info(fresh=fresh) | claude_code.AGENT.describe() | {"modes": list(claude_code.MODES), "folder": claude_code.project_folder(project)}


@router.post("/start", dependencies=LOCAL)
def start(body: StartBody, request: Request) -> dict:
    try:
        return claude_code.start(body.mode, body.fresh, server_port(request), body.project)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except LookupError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/send", dependencies=LOCAL)
def send(body: SendBody) -> dict:
    try:
        claude_code.send(body.text)
    except LookupError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return claude_code.AGENT.describe()


@router.post("/stop", dependencies=LOCAL)
def stop() -> dict:
    return claude_code.stop()


@router.post("/permission", dependencies=LOCAL)
def permission(body: AnswerBody) -> dict:
    if not claude_code.answer(body.id, body.allow):
        raise HTTPException(status_code=404, detail="That question is no longer waiting.")
    return {"ok": True}


@router.websocket("/stream")
async def stream(ws: WebSocket) -> None:
    if not origin_ok(ws.headers.get("origin"), ws.headers.get("host")):
        await ws.close(code=4403)
        return
    if not take_socket():
        await ws.close(code=4429)
        return
    terminal.bind(asyncio.get_running_loop())
    await ws.accept()
    queue: asyncio.Queue = asyncio.Queue()
    claude_code.AGENT.subscribers.add(queue)

    async def outbound() -> None:
        await ws.send_text(json.dumps({"type": "state", **claude_code.AGENT.describe()}))
        for msg in claude_code.backlog():
            await ws.send_text(json.dumps(msg))
        while True:
            await ws.send_text(json.dumps(await queue.get()))

    sender = asyncio.create_task(outbound())
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        release_socket()
        sender.cancel()
        claude_code.AGENT.subscribers.discard(queue)
