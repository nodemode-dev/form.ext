from fastapi import APIRouter, Body, Request
from fastapi.responses import JSONResponse

from app.services import library
from app.services.library import Refused
from app.services.workspace import WorkspaceError

router = APIRouter(prefix="/api/library", tags=["library"])


def _refused(e: Refused) -> JSONResponse:
    body: dict = {"detail": e.message}
    if e.report is not None:
        body["report"] = e.report
    return JSONResponse(body, status_code=e.status)


def _flag(value) -> bool:
    return str(value).lower() in ("1", "true", "yes", "on")


async def _body(request: Request) -> tuple[bytes | None, dict]:
    kind = request.headers.get("content-type", "")
    if "json" in kind:
        try:
            data = await request.json()
        except ValueError:
            raise WorkspaceError("the request body is not valid JSON") from None
        return None, data if isinstance(data, dict) else {}
    limit = library.MAX_BYTES
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise Refused(f"the file is {declared} bytes; a package is at most {limit} (20 MB)")
    chunks = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            raise Refused(f"the file is over {limit} bytes; a package is at most 20 MB")
        chunks.append(chunk)
    return b"".join(chunks), {}


@router.get("/examples")
def list_examples():
    return library.examples()


@router.get("/examples/{key}")
def inspect_example(key: str):
    return library.inspect_example(key)


@router.post("/examples/{key}/import")
def import_example(key: str, body: dict | None = Body(None)):
    body = body or {}
    try:
        return library.import_example(key, body.get("name"), _flag(body.get("anyway")))
    except Refused as e:
        return _refused(e)


@router.post("/inspect")
async def inspect(request: Request, name: str = ""):
    try:
        data, args = await _body(request)
        if data is None:
            return library.inspect_path(str(args.get("path", "")))
        if not data:
            raise WorkspaceError("the upload is empty")
        out = library.inspect_bytes(data, name)
        out["source"] = {"kind": "upload", "name": name or None}
        return out
    except Refused as e:
        return _refused(e)


@router.post("/import")
async def import_package(request: Request, name: str = "", project: str = "", anyway: str = ""):
    try:
        data, args = await _body(request)
        if data is None:
            return library.import_path(str(args.get("path", "")), args.get("name"), _flag(args.get("anyway")))
        if not data:
            raise WorkspaceError("the upload is empty")
        return library.import_bytes(data, name, project or None, {"kind": "upload", "name": name or None}, _flag(anyway))
    except Refused as e:
        return _refused(e)


@router.get("/builds/{pid}/{sha}")
def inspect_build(pid: str, sha: str):
    return library.inspect_build(pid, sha)


@router.post("/builds/{pid}/{sha}/import")
def import_build(pid: str, sha: str, body: dict | None = Body(None)):
    body = body or {}
    try:
        return library.import_build(pid, sha, body.get("name"), _flag(body.get("anyway")))
    except Refused as e:
        return _refused(e)


@router.get("/compare/{pid}")
def compare(pid: str, a: str, b: str = library.WORKING):
    return library.compare(pid, a, b)


@router.get("/compare/{pid}/file")
def compare_file(pid: str, a: str, path: str, b: str = library.WORKING, context: int = 3):
    return library.compare_file(pid, a, b, path, context)
