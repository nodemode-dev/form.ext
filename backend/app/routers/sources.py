from fastapi import APIRouter, Body

from app.services import family, sources

router = APIRouter(prefix="/api/sources", tags=["sources"])


@router.get("")
def list_sources():
    return sources.catalogue()


@router.get("/family")
def family_map():
    return family.overview()


@router.get("/{key}")
def source_status(key: str):
    return sources.status(key)


@router.post("/{key}/pull")
def pull_source(key: str, body: dict | None = Body(None)):
    b = body or {}
    if b.get("wait") is False:
        return sources.pull_async(key, bool(b.get("update")))
    return sources.pull(key, bool(b.get("update")))


@router.delete("/{key}")
def remove_source(key: str):
    return sources.remove(key)


@router.get("/{key}/skills")
def app_skills(key: str, checkout: bool = False):
    return family.skills(key, checkout=checkout)


@router.post("/{key}/skills")
def install_skills(key: str, body: dict | None = Body(None)):
    b = body or {}
    return family.skills(key, install=True, project=b.get("project") or None, checkout=bool(b.get("checkout")))


@router.get("/{key}/files")
def source_files(key: str, under: str = "", glob: str = "", limit: int = 2000):
    return sources.files(key, under, glob, limit)


@router.get("/{key}/file")
def source_file(key: str, path: str, start: int = 1, lines: int = 400):
    return sources.read(key, path, start, lines)


@router.get("/{key}/search")
def source_search(key: str, q: str, glob: str = "", regex: bool = False, case: bool = False, limit: int = 60):
    return sources.search(key, q, glob, regex, case, limit)
