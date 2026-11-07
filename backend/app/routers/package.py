from fastapi import APIRouter, Body
from fastapi.responses import FileResponse, JSONResponse

from app.services.keys import keys
from app.services.package import Refused, packages

router = APIRouter(tags=["package"])


def _refused(e: Refused) -> JSONResponse:
    body: dict = {"detail": e.message}
    if e.check is not None:
        body["check"] = e.check
    return JSONResponse(body, status_code=e.status)


@router.post("/api/projects/{pid}/package")
def build_package(pid: str, body: dict = Body(default={})):
    try:
        return packages.build(pid, bool((body or {}).get("anyway")))
    except Refused as e:
        return _refused(e)


@router.post("/api/projects/{pid}/package/reproduce")
def reproduce_package(pid: str):
    try:
        return packages.reproduce(pid)
    except Refused as e:
        return _refused(e)


@router.get("/api/projects/{pid}/builds")
def list_builds(pid: str):
    return {"project": pid, "builds": packages.list(pid)}


@router.get("/api/projects/{pid}/builds/{sha}")
def get_build(pid: str, sha: str):
    return packages.get(pid, sha)


@router.get("/api/projects/{pid}/builds/{sha}/file")
def build_file(pid: str, sha: str):
    target = packages.file(pid, sha)
    return FileResponse(target, media_type="application/zip", filename=target.name, headers={"Cache-Control": "no-store"})


@router.delete("/api/projects/{pid}/builds/{sha}")
def remove_build(pid: str, sha: str):
    return packages.remove(pid, sha)


@router.post("/api/projects/{pid}/builds/{sha}/sign")
def sign_build(pid: str, sha: str, body: dict = Body(default={})):
    try:
        return packages.sign(pid, sha, str(body.get("key", "")), str(body.get("passphrase") or ""))
    except Refused as e:
        return _refused(e)


@router.post("/api/projects/{pid}/builds/{sha}/verify")
def verify_build(pid: str, sha: str, body: dict = Body(default={})):
    publishers = body.get("publishers") if isinstance(body.get("publishers"), list) else None
    return packages.verify(pid, sha, publishers)


@router.get("/api/projects/{pid}/builds/{sha}/entry")
def build_entry(pid: str, sha: str, url: str = "", publisher: str = ""):
    return packages.entry(pid, sha, url, publisher)


@router.get("/api/keys")
def list_keys():
    return {"keys": keys.list()}


@router.post("/api/keys")
def create_key(body: dict = Body(...)):
    return keys.create(str(body.get("id", "")), str(body.get("name", "")), str(body.get("url") or ""), str(body.get("passphrase") or ""))


@router.get("/api/keys/{kid}")
def get_key(kid: str):
    return keys.get(kid)


@router.get("/api/keys/{kid}/public")
def export_key(kid: str):
    return keys.export(kid)


@router.delete("/api/keys/{kid}")
def remove_key(kid: str):
    return keys.remove(kid)
