import asyncio
import importlib
import logging
import os
import pkgutil
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from app import __version__, routers
from app.services import paths
from app.services.bus import bus
from app.services.workspace import WorkspaceError, watcher

log = logging.getLogger("formext")
CORE = ("health", "settings", "projects", "live")
ORIGINS = [
    "http://localhost:5640",
    "http://127.0.0.1:5640",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
]

paths.use_contract()


@asynccontextmanager
async def lifespan(app: FastAPI):
    bus.attach(asyncio.get_running_loop())
    if os.environ.get("FORMEXT_WATCH", "1") != "0":
        watcher.start()
    bus.emit("engine.started", {"version": __version__})
    try:
        yield
    finally:
        watcher.stop()


app = FastAPI(title="form.ext engine", version=__version__, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(WorkspaceError)
async def workspace_error(_request: Request, exc: WorkspaceError):
    return JSONResponse({"detail": exc.message}, status_code=exc.status)


@app.exception_handler(ValueError)
async def value_error(_request: Request, exc: ValueError):
    return JSONResponse({"detail": str(exc)}, status_code=400)


def include_routers(target: FastAPI) -> None:
    names = [m.name for m in pkgutil.iter_modules(routers.__path__) if not m.name.startswith("_")]
    ordered = [n for n in CORE if n in names] + sorted(n for n in names if n not in CORE)
    loaded: list[str] = []
    errors: dict[str, str] = {}
    for name in ordered:
        try:
            module = importlib.import_module(f"app.routers.{name}")
        except Exception as exc:
            errors[name] = f"{type(exc).__name__}: {exc}"
            log.error("router %s failed to import\n%s", name, traceback.format_exc())
            continue
        router = getattr(module, "router", None)
        if router is None:
            continue
        target.include_router(router)
        loaded.append(name)
    target.state.routers = loaded
    target.state.router_errors = errors


include_routers(app)

DIST = paths.frontend_dist()

if DIST is not None:
    dist_root = DIST.resolve()

    @app.get("/{rel:path}", include_in_schema=False)
    def frontend(rel: str):
        if rel == "api" or rel.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        target = (dist_root / rel).resolve() if rel else dist_root / "index.html"
        if rel and (dist_root in target.parents) and target.is_file():
            headers = {"Cache-Control": "public, max-age=31536000, immutable"} if rel.startswith("assets/") else {"Cache-Control": "no-cache"}
            return FileResponse(target, headers=headers)
        index = dist_root / "index.html"
        if index.is_file():
            return FileResponse(index, headers={"Cache-Control": "no-cache"})
        return Response(status_code=404)
