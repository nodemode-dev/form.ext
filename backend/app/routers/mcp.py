import json
import secrets
import threading
from urllib.parse import unquote

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool

from app.routers.terminal import origin_ok, server_port
from app.services import agent_feed, consent, terminal

router = APIRouter(tags=["mcp"])
SESSIONS_KEPT = 200
_sessions: dict[str, str] = {}
_servers: dict = {}
_lock = threading.Lock()


def _server(port: int):
    from app.cli import Engine
    from app.mcp import Server

    with _lock:
        if "server" not in _servers:
            _servers["server"] = Server(Engine(terminal.engine_url(port), "inside"), None)
        return _servers["server"]


def _handle(server, message):
    watched = isinstance(message, dict) and message.get("method") == "tools/call" and message.get("id") is not None and not consent.own_tab()
    call = agent_feed.began(consent.agent(), message.get("params")) if watched else None
    answer = server.handle(message)
    if call:
        agent_feed.ended(call, answer)
    return answer


def _answer(server, message, tab_token=None, agent=""):
    mark, named = consent.from_tab(tab_token), consent.from_agent(agent)
    try:
        if isinstance(message, list):
            return [a for a in (_handle(server, m) for m in message) if a]
        return _handle(server, message)
    finally:
        consent.end_agent(named)
        consent.end_tab(mark)


def _tab_token(request: Request) -> str | None:
    given = request.headers.get("x-formext-inapp")
    if given:
        return given
    kind, _, value = (request.headers.get("authorization") or "").partition(" ")
    return value.strip() if kind.lower() == "bearer" and value.strip() else None


def _caller(request: Request, message) -> tuple[str, str | None]:
    given = request.headers.get("x-formext-agent")
    if given:
        return consent.clean_name(unquote(given)), None
    if isinstance(message, dict) and message.get("method") == "initialize":
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        info = params.get("clientInfo") if isinstance(params.get("clientInfo"), dict) else {}
        name, session = consent.clean_name(info.get("name")), secrets.token_urlsafe(18)
        with _lock:
            _sessions[session] = name
            for old in list(_sessions)[:-SESSIONS_KEPT]:
                del _sessions[old]
        return name, session
    with _lock:
        return _sessions.get(request.headers.get("mcp-session-id") or "", ""), None


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
    agent, session = _caller(request, message)
    answer = await run_in_threadpool(_answer, _server(server_port(request)), message, _tab_token(request), agent)
    if not answer:
        return Response(status_code=202)
    return JSONResponse(answer, headers={"Mcp-Session-Id": session} if session else None)
