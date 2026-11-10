import base64
import mimetypes

from fastapi import APIRouter, Body, Request
from fastapi.responses import Response

from app.services import sources
from app.services.workspace import WorkspaceError, clean_rel, workspace

router = APIRouter(prefix="/api/projects", tags=["projects"])

TEXT_TYPES = {".html", ".js", ".mjs", ".ts", ".css", ".json", ".svg", ".txt", ".md", ".cube", ".py", ".toml", ".yml", ".yaml", ".xml", ".csv", ".gitignore", ".sh"}


def _decode_files(raw: dict | None) -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    for rel, value in (raw or {}).items():
        if isinstance(value, str):
            out[rel] = value.encode("utf-8")
        elif isinstance(value, dict) and "base64" in value:
            out[rel] = base64.b64decode(value["base64"])
        elif isinstance(value, dict) and "text" in value:
            out[rel] = str(value["text"]).encode("utf-8")
        else:
            raise WorkspaceError(f"file {rel} needs text or base64")
    return out


def _is_text(rel: str, data: bytes) -> bool:
    suffix = "." + rel.rsplit(".", 1)[-1].lower() if "." in rel else ""
    if suffix in TEXT_TYPES or rel.rsplit("/", 1)[-1] in ("LICENSE", "README", "NOTICE"):
        try:
            data.decode("utf-8")
            return True
        except UnicodeDecodeError:
            return False
    if b"\x00" in data[:8192]:
        return False
    try:
        data.decode("utf-8")
        return len(data) < 2 * 1024 * 1024
    except UnicodeDecodeError:
        return False


@router.get("")
def list_projects():
    return {"projects": workspace.projects()}


@router.get("/recent")
def recent_projects(limit: int = 12):
    return {"projects": workspace.recent(limit)}


@router.post("")
def create_project(body: dict = Body(...)):
    if body.get("import") or body.get("path"):
        return workspace.import_folder(body.get("import") or body.get("path"), link=bool(body.get("link")), name=body.get("name"))
    return workspace.create(body.get("name", ""), body.get("product", ""), _decode_files(body.get("files")))


@router.post("/import")
def import_project(body: dict = Body(...)):
    return workspace.import_folder(body.get("path", ""), link=bool(body.get("link")), name=body.get("name"))


@router.get("/{pid}")
def get_project(pid: str, touch: bool = True):
    project = workspace.get(pid)
    if touch:
        workspace.touch(pid)
        sources.auto(str(project.get("product") or ""))
    return project


@router.delete("/{pid}")
def remove_project(pid: str):
    return workspace.remove(pid)


@router.get("/{pid}/files")
def list_files(pid: str):
    return {"id": pid, "package_prefix": workspace.package_prefix(pid), "files": workspace.list_files(pid)}


@router.post("/{pid}/move")
def move_file(pid: str, body: dict = Body(...)):
    return workspace.move(pid, body.get("from", ""), body.get("to", ""))


@router.get("/{pid}/files/{rel:path}")
def read_file(pid: str, rel: str, raw: bool = False):
    clean = clean_rel(rel)
    data = workspace.read(pid, clean)
    if raw:
        kind = mimetypes.guess_type(clean)[0] or "application/octet-stream"
        return Response(data, media_type=kind, headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})
    target = workspace.path(pid, clean)
    info = {"path": clean, "size": len(data), "modified": target.stat().st_mtime}
    if _is_text(clean, data):
        info.update(encoding="utf-8", text=data.decode("utf-8"))
    else:
        info.update(encoding="base64", base64=base64.b64encode(data).decode("ascii"))
    return info


@router.put("/{pid}/files/{rel:path}")
async def write_file(pid: str, rel: str, request: Request, raw: bool = False):
    body = await request.body()
    if raw:
        data = body
    else:
        try:
            payload = await request.json()
        except ValueError:
            raise WorkspaceError("send JSON with text or base64, or use ?raw=1")
        if isinstance(payload, dict) and "text" in payload:
            data = str(payload["text"]).encode("utf-8")
        elif isinstance(payload, dict) and "base64" in payload:
            data = base64.b64decode(payload["base64"])
        else:
            raise WorkspaceError("send JSON with text or base64, or use ?raw=1")
    return workspace.write(pid, rel, data)


@router.delete("/{pid}/files/{rel:path}")
def delete_file(pid: str, rel: str):
    return workspace.delete(pid, rel)
