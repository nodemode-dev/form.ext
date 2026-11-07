from fastapi import APIRouter

from app.services import validate
from app.services.bus import bus
from app.services.workspace import workspace

router = APIRouter(tags=["validate"])


@router.post("/api/projects/{pid}/validate")
def validate_project(pid: str):
    result = validate.validate_folder(workspace.package_dir(pid), workspace.package_prefix(pid))
    result["project"] = pid
    bus.emit("validate.done", {"id": pid, "ok": result["ok"], "counts": result["counts"], "checked_at": result["checked_at"]})
    return result


@router.get("/api/validate/rules")
def validate_rules():
    return {"rules": validate.rules()}
