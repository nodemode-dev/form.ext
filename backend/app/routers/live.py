import asyncio
import json
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import __version__
from app.services import consent, window_key
from app.services.bus import bus

router = APIRouter(tags=["live"])


@router.websocket("/api/live")
async def live(ws: WebSocket):
    await ws.accept()
    bus.attach(asyncio.get_running_loop())
    queue = bus.subscribe()
    await ws.send_json({"name": "hello", "data": {"app": "formext", "version": __version__}, "at": time.time()})

    async def pump_out():
        while True:
            message = await queue.get()
            await ws.send_json(message)

    window = {"on": False}

    async def pump_in():
        while True:
            text = await ws.receive_text()
            if text.strip() in ("ping", '{"name":"ping"}'):
                await ws.send_json({"name": "pong", "data": None, "at": time.time()})
                continue
            try:
                hello = json.loads(text)
            except ValueError:
                continue
            if not isinstance(hello, dict) or hello.get("type") != "window":
                continue
            if not window_key.valid(hello.get("key")):
                await ws.send_json({"name": "window.refused", "data": None, "at": time.time()})
                continue
            if not window["on"]:
                window["on"] = True
                consent.window_opened()
            await ws.send_json({"name": "window.admitted", "data": None, "at": time.time()})

    sender = asyncio.create_task(pump_out())
    receiver = asyncio.create_task(pump_in())
    try:
        await asyncio.wait({sender, receiver}, return_when=asyncio.FIRST_COMPLETED)
    except WebSocketDisconnect:
        pass
    finally:
        for task in (sender, receiver):
            task.cancel()
        bus.unsubscribe(queue)
        if window["on"]:
            consent.window_closed()
