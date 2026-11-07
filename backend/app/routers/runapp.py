from fastapi import APIRouter, Body

from app.services import portal
from app.services.package import packages

router = APIRouter(prefix="/api/runapp", tags=["runapp"])


@router.get("")
def overview():
    return portal.overview()


@router.get("/root")
def root():
    return portal.root()


@router.get("/projects/{pid}")
def project_status(pid: str):
    return portal.project_status(pid)


@router.post("/projects/{pid}")
def run_project(pid: str):
    return portal.run_project(pid)


@router.delete("/projects/{pid}")
def stop_project(pid: str):
    return portal.stop_project(pid)


@router.post("/projects/{pid}/install")
def install_project(pid: str):
    build = packages.build(pid)
    return {**portal.send(build["path"]), "sha256": build["sha256"], "bytes": build["bytes"]}


@router.post("/send")
def send(body: dict = Body(...)):
    return portal.send(str(body.get("path", "")))


@router.get("/apps/{product}/dev")
def get_dev(product: str):
    return portal.read_dev(product)


@router.put("/apps/{product}/dev")
def put_dev(product: str, body: dict = Body(...)):
    return portal.write_dev(product, body)


@router.delete("/apps/{product}/dev/{ext_id}")
def remove_dev(product: str, ext_id: str):
    return portal.dev_remove(product, ext_id)


@router.post("/apps/{product}/reload")
def reload(product: str):
    return portal.reload(product)


@router.post("/apps/{product}/open")
def open_app(product: str, body: dict | None = Body(None)):
    return portal.open_app(product, str((body or {}).get("channel") or ""))


@router.post("/apps/{product}/manage")
def manage(product: str):
    return portal.manage(product)
