from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

API = "1"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}\Z")
LOCAL_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}\Z")
VERSION_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+\Z")
TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".wasm": "application/wasm",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".webm": "video/webm",
    ".mp4": "video/mp4",
    ".cube": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
}
PERMISSIONS = {"document", "files-read", "files-write", "network", "models", "native-code", "fcite.addon"}
SERVICES = {
    "formcite": {
        "app": "FormCite",
        "port_file": "engine.json",
        "data_env": "FORMCITE_DATA_DIR",
        "data_dir": "~/FormCite",
        "port": 8330,
        "prefix": "/api/cite/v1",
        "methods": {
            "search": ("GET", "/search", ("q", "limit", "offset")),
            "get": ("GET", "/items/{id}", ("as",)),
            "cite": ("POST", "/cite", None),
            "bibliography": ("POST", "/bibliography", None),
            "add": ("POST", "/items/from-identifier", None),
            "import": ("POST", "/import", None),
        },
    },
}


class ServiceError(Exception):
    def __init__(self, code: int, message: str):
        super().__init__(message)
        self.code = code


class FamilyService:
    def __init__(self, service: str, host: str, name: str, port: int | None = None, token: str = ""):
        if service not in SERVICES:
            raise ServiceError(-32602, f"{service} is not a family service")
        self.spec = SERVICES[service]
        self.host, self.name, self.token = host, name, token
        self.port = int(port or self.discover() or self.spec["port"])

    def discover(self) -> int | None:
        raw = os.environ.get(self.spec["data_env"], "").strip()
        for folder in [Path(raw).expanduser()] * bool(raw) + [Path(self.spec["data_dir"]).expanduser()]:
            try:
                found = json.loads((folder / self.spec["port_file"]).read_text("utf-8")).get("port")
            except (OSError, ValueError, AttributeError):
                continue
            if type(found) is int and 0 < found < 65536:
                return found
        return None

    def _http(self, method: str, path: str, body: dict | None = None, headers: dict | None = None) -> tuple[int, dict]:
        import http.client
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=30)
        data = json.dumps(body).encode() if body is not None else None
        h = {"content-type": "application/json", **(headers or {})}
        try:
            conn.request(method, self.spec["prefix"] + path, body=data, headers=h)
            res = conn.getresponse()
            raw = res.read()
        except OSError:
            raise ServiceError(-32003, f"{self.spec['app']} is not running on this computer")
        finally:
            conn.close()
        try:
            return res.status, json.loads(raw or b"null")
        except ValueError:
            return res.status, {"detail": raw.decode("utf-8", "replace")[:200]}

    def pair(self, scope: str = "read") -> dict:
        status, out = self._http("POST", "/pair", {"host": self.host, "name": self.name, "scope": scope})
        if status >= 400:
            raise ServiceError(-32004, str(out.get("detail", status)))
        return out

    def collect(self, request_id: str, secret: str) -> str:
        status, out = self._http("GET", f"/pair/{request_id}", headers={"X-FormCite-Pair-Secret": secret})
        if status >= 400:
            raise ServiceError(-32004, str(out.get("detail", status)))
        if out.get("token"):
            self.token = out["token"]
        return str(out.get("status", ""))

    def call(self, method: str, params: dict | None = None):
        spec = self.spec["methods"].get(method)
        if not spec:
            raise ServiceError(-32602, f"{self.spec['app']} does not accept {method}")
        if not self.token:
            raise ServiceError(-32003, f"{self.spec['app']} has not approved this app yet")
        verb, path, query = spec
        params = dict(params or {})
        if "{id}" in path:
            from urllib.parse import quote
            path = path.replace("{id}", quote(str(params.pop("id", "")), safe=""))
        body = None
        if verb == "GET":
            from urllib.parse import urlencode
            q = {k: params[k] for k in (query or ()) if params.get(k) is not None}
            path += ("?" + urlencode(q)) if q else ""
        else:
            body = params
        status, out = self._http(verb, path, body, {"authorization": f"Bearer {self.token}"})
        if status >= 400:
            detail = out.get("detail") if isinstance(out, dict) else None
            raise ServiceError(-32004, str(detail or f"{self.spec['app']} answered {status}"))
        return out


def portal_root() -> Path:
    env = os.environ.get("FORMPORTAL_ROOT", "").strip()
    if env:
        return Path(env)
    home = Path.home()
    if sys.platform == "darwin":
        support = home / "Library" / "Application Support"
        new, old = support / "studio.formai.portal", support / "dev.formai.portal"
        return old if old.is_dir() and not new.exists() else new
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA")
        return (Path(base) if base else home / "AppData" / "Local") / "FormPortal"
    base = os.environ.get("XDG_DATA_HOME")
    return (Path(base) if base else home / ".local" / "share") / "formportal"


def version_tuple(v: str) -> tuple[int, ...]:
    try:
        return tuple(int(p) for p in v.split(".")[:3])
    except ValueError:
        return (0, 0, 0)


@dataclass
class Extension:
    id: str
    version: str
    source: str
    path: Path
    name: str = ""
    kind: str = ""
    description: str = ""
    permissions: list[str] = field(default_factory=list)
    services: list[str] = field(default_factory=list)
    entry_ui: str = ""
    panels: list[dict] = field(default_factory=list)
    commands: list[dict] = field(default_factory=list)
    state: str = "ready"
    reason: str = ""

    def public(self, base: str) -> dict:
        return {
            "id": self.id,
            "name": self.name or self.id,
            "version": self.version,
            "kind": self.kind,
            "source": self.source,
            "description": self.description,
            "permissions": self.permissions,
            "services": self.services,
            "base": f"{base}/{self.id}/{self.version}/",
            "entryUi": self.entry_ui,
            "panels": self.panels,
            "commands": self.commands,
            "path": str(self.path) if self.source == "development" else None,
            "state": self.state,
            "reason": self.reason,
        }


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _safe_rel(rel: str) -> bool:
    return bool(rel) and not rel.startswith("/") and "\\" not in rel and ".." not in rel.split("/") and len(rel) <= 200


def check(ext: Extension, product: str, app_version: str, app_name: str) -> Extension:
    def refuse(reason: str) -> Extension:
        ext.state, ext.reason = "refused", reason
        return ext

    manifest = _read_json(ext.path / "manifest.json")
    if not isinstance(manifest, dict):
        return refuse("its manifest.json is missing or not valid JSON")
    if manifest.get("format") != "formai-package" or manifest.get("format_version") != 1:
        return refuse("it is not a formai package")
    ext.name = str(manifest.get("name") or ext.id)[:80]
    ext.kind = str(manifest.get("kind") or "")
    ext.description = str(manifest.get("description") or "")[:400]
    if ext.source == "development" and VERSION_RE.match(str(manifest.get("version", ""))):
        ext.version = str(manifest["version"])
    if manifest.get("id") != ext.id:
        return refuse(f"its manifest says {manifest.get('id')!r}, not {ext.id!r}")
    if manifest.get("product") != product:
        return refuse(f"it is made for {manifest.get('product')}, not {app_name}")
    if str(manifest.get("version", "")) != ext.version and ext.source != "development":
        return refuse(f"its manifest says version {manifest.get('version')}, FormPortal says {ext.version}")
    ext.version = str(manifest.get("version") or ext.version)
    if not VERSION_RE.match(ext.version):
        return refuse("its version is not x.y.z")
    if manifest.get("api") != API:
        return refuse(f"it needs extension API {manifest.get('api')}; this {app_name} offers API {API}")
    if manifest.get("native"):
        return refuse(f"native extensions are not supported by {app_name}")
    perms = manifest.get("permissions") or []
    if not isinstance(perms, list) or any(p not in PERMISSIONS for p in perms):
        return refuse("it asks for a permission that does not exist")
    ext.permissions = list(dict.fromkeys(perms))
    services = manifest.get("services") or []
    if not isinstance(services, list) or any(s not in SERVICES for s in services):
        return refuse("it asks for a family service that is not in the catalog")
    if services and "fcite.addon" not in ext.permissions:
        return refuse("it names family services without the fcite.addon permission")
    ext.services = list(dict.fromkeys(services))
    minimum = manifest.get("minimum_app")
    if minimum and version_tuple(str(minimum)) > version_tuple(app_version):
        return refuse(f"it needs {app_name} {minimum} or newer")
    entry_obj = manifest.get("entry") if isinstance(manifest.get("entry"), dict) else {}
    entry = entry_obj.get("ui", "")
    if not isinstance(entry, str):
        return refuse("its entry.ui is not a path inside the package")
    contributes = manifest.get("contributes") if isinstance(manifest.get("contributes"), dict) else {}
    panels = [p for p in contributes.get("panels") or [] if isinstance(p, dict) and LOCAL_RE.match(str(p.get("id", ""))) and p.get("title")]
    commands = [c for c in contributes.get("commands") or [] if isinstance(c, dict) and LOCAL_RE.match(str(c.get("id", ""))) and c.get("title")]
    if (panels or commands) and not entry:
        return refuse("it contributes panels or commands but has no entry.ui")
    if entry:
        if not _safe_rel(entry):
            return refuse("its entry.ui is not a path inside the package")
        target = (ext.path / entry).resolve()
        if entry.rsplit("/", 1)[-1] in ("", ".") or not target.is_file() or ext.path.resolve() not in target.parents:
            return refuse(f"its entry.ui {entry} is not in the package")
    ext.entry_ui = entry
    ext.panels = [{"id": p["id"], "title": str(p["title"])[:60], "location": p.get("location", "dock") if p.get("location") in ("dock", "dialog") else "dock"} for p in panels]
    ext.commands = [{"id": c["id"], "title": str(c["title"])[:80], **({"panel": c["panel"]} if c.get("panel") else {})} for c in commands]
    return ext


def resolve(product: str, app_version: str, app_name: str, root: Path | None = None) -> list[Extension]:
    folder = (root or portal_root()) / "extensions" / product
    found: dict[str, Extension] = {}
    enabled = _read_json(folder / "enabled.json")
    if isinstance(enabled, dict) and enabled.get("format") == "formportal-enabled-extensions":
        for row in enabled.get("extensions") or []:
            if not isinstance(row, dict) or not ID_RE.match(str(row.get("id", ""))):
                continue
            source = "sideload" if row.get("source") == "sideload" else "catalogue"
            ext = Extension(id=row["id"], version=str(row.get("version", "")), source=source, path=Path(str(row.get("path", ""))))
            found[ext.id] = check(ext, product, app_version, app_name)
    dev = _read_json(folder / "dev.json")
    if isinstance(dev, dict) and dev.get("format") == "formext-dev-extensions":
        for row in dev.get("extensions") or []:
            if not isinstance(row, dict) or not ID_RE.match(str(row.get("id", ""))):
                continue
            ext = Extension(id=row["id"], version="0.0.0", source="development", path=Path(str(row.get("path", ""))))
            found[ext.id] = check(ext, product, app_version, app_name)
    return sorted(found.values(), key=lambda e: (e.name or e.id).lower())


def stamp(product: str, root: Path | None = None) -> tuple[float, float]:
    folder = (root or portal_root()) / "extensions" / product
    out = []
    for name in ("enabled.json", "dev.json"):
        try:
            out.append((folder / name).stat().st_mtime)
        except OSError:
            out.append(0.0)
    return out[0], out[1]


def csp_for(base: str = "") -> str:
    src = base if base.startswith(("http://", "https://", "formext://")) else "'self'"
    return (
        f"default-src 'none'; script-src {src} 'wasm-unsafe-eval'; style-src {src} 'unsafe-inline'; "
        f"img-src {src} data: blob:; media-src {src} data: blob:; font-src {src}; connect-src 'none'; "
        "frame-src 'none'; form-action 'none'; base-uri 'none'"
    )


def file_for(extensions: list[Extension], ext_id: str, version: str, rel: str) -> tuple[Path, str] | None:
    ext = next((e for e in extensions if e.id == ext_id and e.version == version and e.state == "ready"), None)
    if ext is None or not _safe_rel(rel):
        return None
    suffix = Path(rel).suffix.lower()
    if suffix not in TYPES:
        return None
    root = ext.path.resolve()
    candidate = ext.path / rel
    try:
        if candidate.is_symlink() or any(p.is_symlink() for p in candidate.parents if root in p.resolve().parents or p.resolve() == root):
            return None
        target = candidate.resolve(strict=True)
    except OSError:
        return None
    if root not in target.parents or not target.is_file():
        return None
    return target, TYPES[suffix]


def headers_for(content_type: str, base: str) -> dict[str, str]:
    h = {"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Cross-Origin-Resource-Policy": "cross-origin", "Access-Control-Allow-Origin": "*"}
    if content_type.startswith("text/html"):
        h["Content-Security-Policy"] = csp_for(base)
    return h
