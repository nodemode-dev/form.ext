import asyncio
import json

from fastapi import APIRouter, Body, HTTPException, Request, WebSocket, WebSocketDisconnect

from app.routers.terminal import origin_ok, release_socket, take_socket
from app.services import agent_feed, agent_programs, consent, settings, terminal, window_key

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _window(request: Request) -> None:
    if not window_key.valid(request.headers.get(window_key.HEADER)):
        raise HTTPException(403, window_key.REFUSED)


@router.get("/requests")
def list_requests(request: Request) -> dict:
    _window(request)
    return {"access": consent.access(), "requests": consent.pending(), "sealReset": bool(settings.get().get("agentAccessReset"))}


@router.post("/requests/{request_id}")
def answer_request(request: Request, request_id: str, body: dict = Body(...)) -> dict:
    _window(request)
    if not consent.answer(request_id, str(body.get("answer") or "")):
        raise HTTPException(404, "That request was already answered or has expired")
    return {"ok": True, "access": consent.access()}


@router.get("/status")
def programs(request: Request, fresh: bool = False) -> dict:
    _window(request)
    return agent_programs.status(fresh=fresh)


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
    if not await window_key.admit(ws):
        release_socket()
        await ws.close(code=4403)
        return
    queue: asyncio.Queue = asyncio.Queue()
    agent_feed.subscribers.add(queue)

    async def outbound() -> None:
        await ws.send_text(json.dumps({"type": "hello", "access": consent.access()}))
        for msg in agent_feed.backlog():
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
        agent_feed.subscribers.discard(queue)
