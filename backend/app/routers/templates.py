from fastapi import APIRouter, Body

from app.services import templates

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("")
def list_templates():
    return templates.catalogue()


@router.get("/examples")
def list_examples():
    return {"examples": templates.examples()}


@router.post("/examples/{example}")
def create_example(example: str, body: dict | None = Body(None)):
    return templates.create_example(example, (body or {}).get("name"))


@router.post("/create")
def create_project(body: dict = Body(...)):
    return templates.create(str(body.get("product", "")), str(body.get("starter", "")), str(body.get("name", "")), body.get("description"))


@router.get("/{product}/{starter}")
def starter_detail(product: str, starter: str):
    return templates.detail(product, starter)
