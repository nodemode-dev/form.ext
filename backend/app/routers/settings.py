from fastapi import APIRouter, Body

from app.services import paths, settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def get_settings():
    return {**settings.get(), "home": str(paths.home())}


@router.put("")
def put_settings(body: dict = Body(...)):
    patch = {k: v for k, v in body.items() if k != "home"}
    return {**settings.update(patch), "home": str(paths.home())}
