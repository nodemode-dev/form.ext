from fastapi import APIRouter, HTTPException

from app.services import window_key

router = APIRouter(prefix="/api/window", tags=["window"])


@router.post("/key")
def claim_window_key() -> dict:
    if window_key.stdout_mode():
        raise HTTPException(404, "Not Found")
    key = window_key.claim()
    if key is None:
        raise HTTPException(409, "Another window already holds this engine's window key; use that window, or restart form.ext")
    return {"key": key}


@router.get("")
def window_state() -> dict:
    return {"packaged": window_key.stdout_mode(), "claimed": window_key.STATE["claimed"], "secondClaim": window_key.STATE["secondClaim"]}
