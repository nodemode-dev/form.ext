from fastapi import APIRouter, Body, HTTPException, Request

from app.services import consent, settings, window_key

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _window(request: Request) -> None:
    if not window_key.valid(request.headers.get(window_key.HEADER)):
        raise HTTPException(403, window_key.REFUSED)


@router.get("/requests")
def list_requests(request: Request) -> dict:
    _window(request)
    return {"access": consent.access(), "requests": consent.pending(), "sealReset": bool(settings.get().get("agentAccessReset"))}


@router.post("/requests/{request_id}")
def answer_request(request: Request, request_id: str, body: dict = Body(...)) -> dict:
    _window(request)
    if not consent.answer(request_id, str(body.get("answer") or "")):
        raise HTTPException(404, "That request was already answered or has expired")
    return {"ok": True, "access": consent.access()}
