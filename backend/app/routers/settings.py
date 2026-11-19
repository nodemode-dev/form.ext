from fastapi import APIRouter, Body, Request

from app.services import paths, settings, window_key

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def get_settings():
    return {**settings.get(), "home": str(paths.home())}


@router.put("")
def put_settings(request: Request, body: dict = Body(...)):
    patch = {k: v for k, v in body.items() if k not in ("home", "seal", "sealBroken")}
    return {**settings.update(patch, window=window_key.valid(request.headers.get(window_key.HEADER))), "home": str(paths.home())}
