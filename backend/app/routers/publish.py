from fastapi import APIRouter, Body

from app.services import publish

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


@router.post("/{pid}/registry/reveal")
def reveal_registry(pid: str):
    return publish.reveal_registry(pid)


@router.post("/{pid}/reveal")
def reveal(pid: str):
    return publish.reveal(pid)
