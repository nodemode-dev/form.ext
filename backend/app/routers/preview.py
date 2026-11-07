import base64
import ipaddress
import socket
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

import formext_host
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.services.workspace import workspace

router = APIRouter(tags=["preview"])

FETCH_CAP = 50 * 1024 * 1024
FETCH_TIMEOUT = 30


def _ext_id(pid: str, manifest: dict) -> str:
    mid = str(manifest.get("id") or "")
    return mid if formext_host.ID_RE.match(mid) else pid


@router.get("/api/preview/{pid}")
def preview_record(pid: str, product: str | None = None, app: str | None = None, app_version: str | None = None):
    package = workspace.package_dir(pid)
    manifest = workspace.manifest(pid)
    target = product or str(manifest.get("product") or "")
    ext = formext_host.Extension(id=_ext_id(pid, manifest), version="0.0.0", source="development", path=package)
    formext_host.check(ext, target, app_version or "9.99.9", app or target)
    return {"project": pid, "product": target, "record": ext.public(f"/api/preview/{pid}/files"), "manifest": manifest, "csp": formext_host.csp_for("")}


@router.api_route("/api/preview/{pid}/files/{ext_id}/{version}/{rel:path}", methods=["GET", "HEAD"], include_in_schema=False)
def preview_file(pid: str, ext_id: str, version: str, rel: str, request: Request):
    try:
        package = workspace.package_dir(pid)
        manifest = workspace.manifest(pid)
    except Exception:
        return Response(status_code=404, headers={"Cache-Control": "no-store"})
    ext = formext_host.Extension(id=_ext_id(pid, manifest), version=str(manifest.get("version") or ""), source="development", path=package)
    found = formext_host.file_for([ext], ext_id, version, rel)
    if found is None:
        return Response(status_code=404, headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})
    target, content_type = found
    headers = formext_host.headers_for(content_type, "")
    if request.method == "HEAD":
        headers["Content-Length"] = str(target.stat().st_size)
        return Response(status_code=200, headers=headers, media_type=content_type)
    return FileResponse(Path(target), media_type=content_type, headers=headers)


class FetchBody(BaseModel):
    url: str
    method: str | None = "GET"
    headers: dict[str, str] | None = None
    body: str | None = None


def _public_host(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
    except OSError:
        return False
    for info in infos:
        addr = ipaddress.ip_address(info[4][0])
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved or addr.is_multicast or addr.is_unspecified:
            return False
    return bool(infos)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


@router.post("/api/preview/fetch")
def preview_fetch(req: FetchBody):
    parts = urlsplit(req.url)
    if parts.scheme != "https" or not parts.hostname:
        raise HTTPException(400, "only https:// addresses")
    if not _public_host(parts.hostname):
        raise HTTPException(403, f"{parts.hostname} is on this computer or the local network")
    method = (req.method or "GET").upper()
    if method not in ("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"):
        raise HTTPException(400, f"{method} is not an HTTP method")
    data = base64.b64decode(req.body) if req.body else None
    headers = {k: v for k, v in (req.headers or {}).items() if k.lower() not in ("host", "cookie", "content-length")}
    request = urllib.request.Request(req.url, data=data, method=method, headers=headers)
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        res = opener.open(request, timeout=FETCH_TIMEOUT)
    except urllib.error.HTTPError as err:
        res = err
    except (urllib.error.URLError, OSError, ValueError) as err:
        raise HTTPException(502, f"could not reach {parts.hostname}: {getattr(err, 'reason', err)}")
    try:
        body = res.read(FETCH_CAP + 1)
    finally:
        res.close()
    if len(body) > FETCH_CAP:
        raise HTTPException(413, "the answer is larger than 50 MB")
    return {"status": res.status if hasattr(res, "status") else res.code, "headers": {k.lower(): v for k, v in res.headers.items()}, "body": base64.b64encode(body).decode("ascii")}
