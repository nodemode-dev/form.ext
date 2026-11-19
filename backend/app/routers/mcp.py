import json
import threading

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool

from app.routers.terminal import origin_ok, server_port
from app.services import terminal

router = APIRouter(tags=["mcp"])
_servers: dict = {}
_lock = threading.Lock()


def _server(port: int):
    from app.cli import Engine
    from app.mcp import Server

    with _lock:
        if "server" not in _servers:
            _servers["server"] = Server(Engine(terminal.engine_url(port), "inside"), None)
        return _servers["server"]


def _answer(server, message):
    if isinstance(message, list):
        return [a for a in (server.handle(m) for m in message) if a]
    return server.handle(message)


@router.post("/mcp", include_in_schema=False)
async def mcp(request: Request) -> Response:
    if not origin_ok(request.headers.get("origin"), request.headers.get("host")):
        raise HTTPException(403, "Only programs on this computer may use form.ext's tools.")
    if (request.headers.get("content-type") or "").split(";")[0].strip().lower() != "application/json":
        raise HTTPException(415, "Send JSON-RPC as application/json.")
    try:
        message = json.loads(await request.body())
    except ValueError:
        return JSONResponse({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
    answer = await run_in_threadpool(_answer, _server(server_port(request)), message)
    if not answer:
        return Response(status_code=202)
    return JSONResponse(answer)
