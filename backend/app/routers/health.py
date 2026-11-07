import os
import sys
import time

from fastapi import APIRouter, Request

from app import __version__
from app.services import paths
from app.services.bus import bus

router = APIRouter(tags=["health"])
STARTED = time.time()


@router.get("/api/health")
def health(request: Request):
    state = request.app.state
    return {
        "ok": True,
        "app": "formext",
        "version": __version__,
        "api": "1",
        "pid": os.getpid(),
        "python": sys.version.split()[0],
        "frozen": paths.frozen(),
        "home": str(paths.home()),
        "contract": str(paths.contract_dir()),
        "uptime": round(time.time() - STARTED, 1),
        "live_clients": bus.clients(),
        "routers": getattr(state, "routers", []),
        "router_errors": getattr(state, "router_errors", {}),
        "frontend": str(paths.frontend_dist() or ""),
    }
