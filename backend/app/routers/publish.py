from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from app.services import publish, registry_pr

router = APIRouter(prefix="/api/publish", tags=["publish"])


@router.get("/{pid}")
def status(pid: str):
    return publish.status(pid)


@router.post("/{pid}")
def prepare(pid: str, body: dict | None = Body(None)):
    b = body or {}
    return publish.prepare(pid, str(b.get("url") or ""), str(b.get("publisher") or ""), str(b.get("passphrase") or ""), b.get("sign", True) is not False)


@router.post("/{pid}/send")
def send(pid: str):
    return publish.send(pid)


@router.post("/{pid}/registry")
def submit(pid: str):
    return publish.submit(pid)


@router.get("/{pid}/registry/pull-request")
def pull_request_ready(pid: str):
    return registry_pr.readiness()


@router.post("/{pid}/registry/pull-request")
def pull_request(pid: str):
    try:
        return registry_pr.open_pull_request(pid)
    except registry_pr.Needs as exc:
        return JSONResponse({"detail": exc.message, "needs": exc.needs}, status_code=exc.status)


@router.post("/{pid}/registry/reveal")
def reveal_registry(pid: str):
    return publish.reveal_registry(pid)


@router.post("/{pid}/reveal")
def reveal(pid: str):
    return publish.reveal(pid)
