import argparse
import base64 as b64
import json
import os
import re
import shutil
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from app import __version__
from app.services import paths

WORDS = {
    "document": "read and change the open document",
    "files-read": "open files you choose",
    "files-write": "save files where you choose",
    "network": "reach the internet",
    "models": "use local models",
    "native-code": "run native code (not supported by API 1 hosts)",
}

ROUTES = {
    "apps": ("GET", "/api/runapp"),
    "run_status": ("GET", "/api/runapp/projects/{id}"),
    "run": ("POST", "/api/runapp/projects/{id}"),
    "stop": ("DELETE", "/api/runapp/projects/{id}"),
    "open_app": ("POST", "/api/runapp/apps/{product}/open"),
    "publish": ("POST", "/api/publish/{id}"),
    "send": ("POST", "/api/publish/{id}/send"),
    "submit": ("POST", "/api/publish/{id}/registry"),
}

MODULES = {
    "check": "validate",
    "new": "templates",
    "preview": "preview",
    "package": "package",
    "run": "runapp",
    "publish": "publish",
}

REF_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"'#?]+)""", re.I)


class OpError(Exception):
    def __init__(self, message: str, data: Any = None, code: int = 1) -> None:
        super().__init__(message)
        self.message = message
        self.data = data
        self.code = code


class EngineError(OpError):
    def __init__(self, status: int, message: str, body: Any = None) -> None:
        super().__init__(message, body, 3 if status >= 500 or status == 0 else 1)
        self.status = status


def q(text: str) -> str:
    return urllib.parse.quote(str(text), safe="")


def qpath(text: str) -> str:
    return urllib.parse.quote(str(text).strip("/"), safe="/")


def _detail(body: Any, status: int) -> str:
    if isinstance(body, dict):
        detail = body.get("detail")
        if isinstance(detail, str):
            return detail
        if isinstance(detail, list):
            parts = []
            for item in detail:
                if isinstance(item, dict):
                    where = ".".join(str(x) for x in item.get("loc", []) if x != "body")
                    parts.append(f"{where}: {item.get('msg')}" if where else str(item.get("msg")))
            if parts:
                return "; ".join(parts)
    return f"the engine answered {status}"


async def _asgi_call(app, method: str, path: str, query: str, body: bytes):
    import anyio

    done = anyio.Event()
    state = {"sent": False, "status": 0, "headers": [], "chunks": []}

    async def receive():
        if not state["sent"]:
            state["sent"] = True
            return {"type": "http.request", "body": body, "more_body": False}
        await done.wait()
        return {"type": "http.disconnect"}

    async def send(message):
        if message["type"] == "http.response.start":
            state["status"] = message["status"]
            state["headers"] = message.get("headers", [])
        elif message["type"] == "http.response.body":
            state["chunks"].append(message.get("body", b""))
            if not message.get("more_body"):
                done.set()

    headers = [(b"host", b"127.0.0.1:8640"), (b"user-agent", f"formext-cli/{__version__}".encode())]
    if body:
        headers += [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": urllib.parse.unquote(path),
        "raw_path": path.encode(),
        "query_string": query.encode(),
        "root_path": "",
        "headers": headers,
        "client": ("127.0.0.1", 0),
        "server": ("127.0.0.1", 8640),
        "state": {},
    }
    try:
        await app(scope, receive, send)
    except Exception as exc:
        if not state["status"]:
            raise EngineError(500, f"the engine failed: {type(exc).__name__}: {exc}") from exc
    finally:
        done.set()
    return state["status"], {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in state["headers"]}, b"".join(state["chunks"])


class Engine:
    def __init__(self, url: str | None = None, mode: str = "auto") -> None:
        self.explicit = (url or os.environ.get("FORMEXT_URL") or "").rstrip("/")
        self.mode = "http" if self.explicit and mode == "auto" else mode
        self.url = self.explicit
        self.app = None
        self.checked = 0.0
        self._health: dict | None = None
        self._lock = threading.RLock()
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def _http(self, method: str, url: str, data: bytes | None, timeout: float):
        headers = {"Accept": "application/json", "User-Agent": f"formext-cli/{__version__}"}
        if data:
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data or None, method=method, headers=headers)
        try:
            with self.opener.open(req, timeout=timeout) as res:
                return res.status, {k.lower(): v for k, v in res.headers.items()}, res.read()
        except urllib.error.HTTPError as err:
            return err.code, {k.lower(): v for k, v in err.headers.items()}, err.read()

    def _probe(self, base: str) -> dict | None:
        try:
            status, _, payload = self._http("GET", f"{base}/api/health", None, 1.5)
            info = json.loads(payload) if status == 200 else None
        except (OSError, ValueError):
            return None
        return info if isinstance(info, dict) and info.get("app") == "formext" else None

    def _candidates(self) -> list[str]:
        out = []
        try:
            info = json.loads((paths.home() / "engine.port").read_text(encoding="utf-8"))
            out.append(f"http://127.0.0.1:{int(info['port'])}")
        except (OSError, ValueError, KeyError, TypeError):
            pass
        port = os.environ.get("FORMEXT_PORT", "8640") or "8640"
        if port != "0":
            out.append(f"http://127.0.0.1:{port}")
        return list(dict.fromkeys(out))

    def _same_home(self, info: dict) -> bool:
        try:
            return Path(str(info.get("home", ""))).resolve() == paths.home().resolve()
        except OSError:
            return False

    def connect(self) -> None:
        with self._lock:
            self._connect()

    def _connect(self) -> None:
        if self.mode == "http":
            if not self.url:
                for base in self._candidates():
                    if self._probe(base):
                        self.url = base
                        break
                if not self.url:
                    raise EngineError(0, "no form.ext engine is answering; start it with ./formext boot, or drop --engine to run in-process")
            return
        if self.mode == "auto" and (self.app is None or time.time() - self.checked > 5):
            self.checked = time.time()
            found = None
            for base in self._candidates():
                info = self._probe(base)
                if info and self._same_home(info):
                    found = base
                    break
            if found:
                if found != self.url:
                    self._health = None
                self.url = found
                return
            if self.url:
                self._health = None
            self.url = ""
        if self.app is None:
            os.environ.setdefault("FORMEXT_WATCH", "0")
            from app.main import app as engine_app

            self.app = engine_app

    def describe(self) -> dict:
        self.connect()
        if self.url:
            return {"mode": "http", "url": self.url, "note": "talking to the running form.ext engine; its window sees every change live"}
        return {"mode": "in-process", "url": None, "note": "no engine with this data folder is running, so the engine's routes run inside this process; open form.ext to see the projects"}

    def send(self, method: str, path: str, body: Any = None, query: dict | None = None, timeout: float = 300) -> tuple[int, dict, bytes]:
        self.connect()
        qs = urllib.parse.urlencode({k: (str(v).lower() if isinstance(v, bool) else v) for k, v in (query or {}).items() if v is not None and v != ""})
        data = json.dumps(body).encode("utf-8") if body is not None else b""
        if self.url:
            try:
                return self._http(method, f"{self.url}{path}{'?' + qs if qs else ''}", data, timeout)
            except OSError as exc:
                raise EngineError(0, f"the engine at {self.url} stopped answering ({exc})") from exc
        import anyio

        return anyio.run(_asgi_call, self.app, method, path, qs, data)

    def call(self, method: str, path: str, body: Any = None, query: dict | None = None, raw: bool = False) -> Any:
        status, headers, payload = self.send(method, path, body, query)
        if status >= 400:
            try:
                parsed = json.loads(payload) if payload else None
            except ValueError:
                parsed = None
            raise EngineError(status, _detail(parsed, status), parsed)
        if raw:
            return payload
        if not payload:
            return None
        try:
            return json.loads(payload)
        except ValueError:
            return payload.decode("utf-8", "replace")

    def get(self, path: str, **query) -> Any:
        return self.call("GET", path, query=query)

    def post(self, path: str, body: Any = None) -> Any:
        return self.call("POST", path, {} if body is None else body)

    def health(self) -> dict:
        if self._health is None:
            self._health = self.get("/api/health")
        return self._health

    def has(self, router: str) -> bool:
        return router in (self.health().get("routers") or [])


@dataclass
class Param:
    name: str
    type: str = "string"
    help: str = ""
    required: bool = False
    positional: bool = False
    enum: list[str] | None = None
    default: Any = None
    flag: str | None = None
    cli: bool = True
    items: str | None = None


@dataclass
class Op:
    name: str
    title: str
    help: str
    run: Callable[..., Any]
    params: list[Param] = field(default_factory=list)
    read_only: bool = True
    destructive: bool = False
    mcp: bool = True
    cli: bool = True
    say: Callable[[Any], str] | None = None


def _project(eng: Engine, pid: str, touch: bool = False) -> dict:
    if not pid:
        raise OpError("name the project (its id; `projects` lists them)")
    return eng.get(f"/api/projects/{q(pid)}", touch=touch)


def _prefix(project: dict) -> str:
    prefix = project.get("package_prefix")
    return "package" if prefix is None else str(prefix)


def _manifest_rel(project: dict) -> str:
    prefix = _prefix(project)
    return f"{prefix}/manifest.json" if prefix else "manifest.json"


def _row(p: dict) -> dict:
    return {k: p.get(k) for k in ("id", "name", "product", "version", "dir", "package_prefix", "linked", "manifest_error", "modified")}


def _builds(eng: Engine, pid: str) -> list[dict]:
    return eng.get(f"/api/projects/{q(pid)}/builds").get("builds", [])


def _sha(eng: Engine, pid: str, sha: str | None) -> str:
    builds = _builds(eng, pid)
    if not builds:
        raise OpError(f"{pid} has no builds yet; run package first")
    if not sha:
        return builds[0]["sha256"]
    found = [b["sha256"] for b in builds if b["sha256"].startswith(sha.lower())]
    if len(found) != 1:
        raise OpError(f"no single build of {pid} starts with {sha}" if not found else f"{sha} matches {len(found)} builds; give more of the SHA-256")
    return found[0]


def _need(eng: Engine, module: str, what: str, route: tuple[str, str]) -> None:
    if not eng.has(module):
        raise OpError(f"{what} is not in this engine yet (backend/app/routers/{module}.py is missing); this command calls {route[0]} {route[1]}")


def _route(key: str, **fill) -> tuple[str, str]:
    method, template = ROUTES[key]
    return method, template.format(**{k: q(v) for k, v in fill.items()})


def op_status(eng: Engine) -> dict:
    info = eng.describe()
    health = eng.health()
    routers = health.get("routers") or []
    projects = eng.get("/api/projects").get("projects", [])
    modules = {name: router in routers for name, router in MODULES.items()}
    missing = [name for name, ok in modules.items() if not ok]
    return {
        "engine": {**info, "version": health.get("version"), "api": health.get("api"), "pid": health.get("pid")},
        "home": health.get("home"),
        "contract": health.get("contract"),
        "modules": modules,
        "router_errors": health.get("router_errors") or {},
        "projects": len(projects),
        "recent": [_row(p) for p in projects[:5]],
        "next": "templates, then new" if not projects else "validate, preview, package" + ("" if not missing else f" (not in this engine yet: {', '.join(missing)})"),
    }


def _docs_topics() -> dict[str, Path]:
    contract = paths.contract_dir()
    topics = {
        "contract": contract / "CONTRACT.md",
        "sdk": contract / "sdk" / "formext.ts",
        "schema": contract / "schema" / "package.schema.json",
        "example": contract / "examples" / "hello",
    }
    apps = paths.docs_dir() / "apps"
    if apps.is_dir():
        for page in sorted(apps.glob("*.md")):
            topics[page.stem] = page
    return topics


def op_docs(eng: Engine, topic: str = "list") -> dict:
    topics = _docs_topics()
    if topic in ("", "list"):
        return {"topics": [{"topic": k, "path": str(v)} for k, v in topics.items() if v.exists()], "note": "contract is the binding spec; a product id gives that app's extension API (document snapshot, ops, events)"}
    target = topics.get(topic)
    if target is None or not target.exists():
        raise OpError(f"there is no docs topic {topic!r}; topics: {', '.join(k for k, v in topics.items() if v.exists())}")
    if target.is_dir():
        files = {}
        for item in sorted(target.rglob("*")):
            if item.is_file() and item.stat().st_size < 64 * 1024:
                files[item.relative_to(target).as_posix()] = item.read_text(encoding="utf-8", errors="replace")
        return {"topic": topic, "path": str(target), "files": files}
    return {"topic": topic, "path": str(target), "text": target.read_text(encoding="utf-8", errors="replace")}


def op_templates(eng: Engine, product: str | None = None) -> dict:
    data = eng.get("/api/templates")
    products = data.get("products", [])
    if product:
        products = [p for p in products if p.get("id") == product]
        if not products:
            raise OpError(f"{product} is not a host app; products: {', '.join(p['id'] for p in data.get('products', []))}")
    return {
        "starters": data.get("starters", []),
        "products": [{"id": p.get("id"), "name": p.get("name"), "docs": p.get("docs"), "starters": [{"starter": s.get("starter"), "id": s.get("id"), "title": s.get("title"), "summary": s.get("summary"), "permissions": s.get("permissions")} for s in p.get("starters", [])]} for p in products],
        "examples": [e.get("id") for e in data.get("examples", [])],
    }


def op_new(eng: Engine, name: str = "", product: str = "", starter: str = "panel", description: str | None = None, example: str | None = None) -> dict:
    if example:
        project = eng.post(f"/api/templates/examples/{q(example)}", {"name": name or None})
    else:
        if not product:
            raise OpError("name the host app (product), for example formcut; templates lists them")
        if not name:
            raise OpError("give the extension a name")
        project = eng.post("/api/templates/create", {"product": product, "starter": starter or "panel", "name": name, "description": description})
    project = project.get("project", project) if isinstance(project, dict) else project
    files = eng.get(f"/api/projects/{q(project['id'])}/files")
    return {"project": _row(project), "manifest": project.get("manifest"), "files": [f["path"] for f in files.get("files", [])], "next": "edit the files (file_write), then validate and preview"}


def op_projects(eng: Engine) -> dict:
    return {"projects": [_row(p) for p in eng.get("/api/projects").get("projects", [])]}


def op_project(eng: Engine, id: str) -> dict:
    project = _project(eng, id)
    files = eng.get(f"/api/projects/{q(id)}/files")
    return {"project": _row(project), "manifest": project.get("manifest"), "files": files.get("files", [])}


def op_import(eng: Engine, path: str, link: bool = False, name: str | None = None) -> dict:
    folder = Path(path).expanduser()
    if folder.suffix.lower() == ".formpkg":
        _need(eng, "library", "Importing a .formpkg", ("POST", "/api/library/import"))
        result = eng.post("/api/library/import", {"path": str(folder.resolve()), "name": name})
        project = result.get("project") if isinstance(result.get("project"), dict) else result
        return {"project": _row(project), "manifest": project.get("manifest"), "report": result.get("report")}
    project = eng.post("/api/projects/import", {"path": str(folder.resolve()), "link": bool(link), "name": name})
    project = project.get("project", project)
    return {"project": _row(project), "manifest": project.get("manifest")}


def op_inspect(eng: Engine, path: str) -> dict:
    _need(eng, "library", "Inspecting a package", ("POST", "/api/library/inspect"))
    return eng.post("/api/library/inspect", {"path": str(Path(path).expanduser().resolve())})


def op_files(eng: Engine, id: str) -> dict:
    data = eng.get(f"/api/projects/{q(id)}/files")
    return {"id": id, "package_prefix": data.get("package_prefix"), "files": data.get("files", [])}


def op_read(eng: Engine, id: str, path: str) -> dict:
    data = eng.get(f"/api/projects/{q(id)}/files/{qpath(path)}")
    return {k: data.get(k) for k in ("path", "size", "modified", "encoding", "text", "base64") if k in data}


def op_write(eng: Engine, id: str, path: str, text: str | None = None, base64: str | None = None, source: str | None = None) -> dict:
    if source:
        raw = Path(source).expanduser().read_bytes()
        try:
            body = {"text": raw.decode("utf-8")}
        except UnicodeDecodeError:
            body = {"base64": b64.b64encode(raw).decode("ascii")}
    elif base64 is not None:
        body = {"base64": base64}
    elif text is not None:
        body = {"text": text}
    else:
        raise OpError("give the content: text, base64, or (command line) --from a local file")
    result = eng.call("PUT", f"/api/projects/{q(id)}/files/{qpath(path)}", body)
    return result if isinstance(result, dict) else {"path": path, "written": True}


def op_delete(eng: Engine, id: str, path: str) -> dict:
    result = eng.call("DELETE", f"/api/projects/{q(id)}/files/{qpath(path)}")
    return result if isinstance(result, dict) else {"path": path, "deleted": True}


def op_move(eng: Engine, id: str, source: str, target: str) -> dict:
    return eng.post(f"/api/projects/{q(id)}/move", {"from": source, "to": target})


def _merge(base: Any, patch: Any) -> Any:
    if not isinstance(patch, dict) or not isinstance(base, dict):
        return patch
    out = dict(base)
    for key, value in patch.items():
        if value is None:
            out.pop(key, None)
        else:
            out[key] = _merge(out.get(key), value)
    return out


def op_manifest(eng: Engine, id: str, set: Any = None) -> dict:
    project = _project(eng, id)
    rel = _manifest_rel(project)
    if set is None:
        return {"path": rel, "manifest": project.get("manifest"), "manifest_error": project.get("manifest_error")}
    if isinstance(set, str):
        try:
            set = json.loads(set)
        except ValueError as exc:
            raise OpError(f"the manifest patch is not JSON: {exc}") from exc
    if not isinstance(set, dict):
        raise OpError("the manifest patch must be a JSON object (a merge patch: null removes a key)")
    current = eng.get(f"/api/projects/{q(id)}/files/{qpath(rel)}")
    try:
        manifest = json.loads(current.get("text") or "{}")
    except ValueError as exc:
        raise OpError(f"{rel} is not valid JSON now ({exc}); fix it with file_write first") from exc
    merged = _merge(manifest, set)
    eng.call("PUT", f"/api/projects/{q(id)}/files/{qpath(rel)}", {"text": json.dumps(merged, indent=2, ensure_ascii=False) + "\n"})
    return {"path": rel, "manifest": merged}


def op_validate(eng: Engine, id: str) -> dict:
    result = eng.post(f"/api/projects/{q(id)}/validate")
    return {k: result.get(k) for k in ("project", "ok", "counts", "problems", "files", "bytes", "checked_at") if k in result}


def op_rules(eng: Engine) -> dict:
    return eng.get("/api/validate/rules")


def op_preview(eng: Engine, id: str, product: str | None = None, app_version: str | None = None) -> dict:
    snap = eng.get(f"/api/preview/{q(id)}", product=product, app_version=app_version)
    record = snap.get("record") or {}
    out: dict[str, Any] = {
        "project": id,
        "product": snap.get("product"),
        "state": record.get("state"),
        "reason": record.get("reason") or None,
        "extension": {k: record.get(k) for k in ("id", "name", "version", "kind", "description")},
        "permissions": [{"id": p, "words": WORDS.get(p, p)} for p in record.get("permissions") or []],
        "panels": record.get("panels") or [],
        "commands": record.get("commands") or [],
        "frame": None,
        "assets": [],
        "missing": [],
    }
    if record.get("state") == "ready" and record.get("entryUi"):
        base = str(record.get("base") or "")
        src = base + record["entryUi"]
        status, headers, payload = eng.send("GET", src)
        out["frame"] = {
            "src": src,
            "sandbox": "allow-scripts",
            "status": status,
            "content_type": headers.get("content-type"),
            "csp": headers.get("content-security-policy"),
            "headers_ok": all(h in headers for h in ("x-content-type-options", "cache-control", "cross-origin-resource-policy", "access-control-allow-origin")),
        }
        html = payload.decode("utf-8", "replace") if status == 200 else ""
        entry_url = urllib.parse.urljoin("http://x" + base, record["entryUi"])
        seen = []
        for ref in REF_RE.findall(html):
            if re.match(r"^[a-z][a-z0-9+.-]*:|^//", ref, re.I) or ref in seen:
                continue
            seen.append(ref)
            target = urllib.parse.urlsplit(urllib.parse.urljoin(entry_url, ref)).path
            st, _, _ = eng.send("HEAD", target)
            out["assets"].append({"ref": ref, "status": st})
            if st != 200:
                out["missing"].append(ref)
        if re.search(r"<script(?![^>]*\bsrc=)[^>]*>\s*\S", html, re.I):
            out["inline_script"] = "the entry page has an inline script element; the contract's CSP blocks it, so move it into a .js file"
    out["open"] = "the Preview pane in form.ext runs it in the simulated host with the event injector and call log"
    return out


def _say_preview(d: dict) -> str:
    lines = [f"{d['extension'].get('name')} {d['extension'].get('version')} for {d['product']}: {d['state']}" + (f" ({d['reason']})" if d.get("reason") else "")]
    if d.get("frame"):
        f = d["frame"]
        lines.append(f"frame  {f['src']}  {f['status']} {f['content_type']}  headers {'ok' if f['headers_ok'] else 'MISSING'}")
    for p in d["permissions"]:
        lines.append(f"asks   {p['id']}: {p['words']}")
    for p in d["panels"]:
        lines.append(f"panel  {p['id']} ({p.get('location')}): {p['title']}")
    for c in d["commands"]:
        lines.append(f"cmd    {c['id']}: {c['title']}" + (f" (opens {c['panel']})" if c.get("panel") else " (headless)"))
    for a in d["assets"]:
        lines.append(f"asset  {a['ref']}  {a['status']}")
    if d.get("inline_script"):
        lines.append(f"note   {d['inline_script']}")
    return "\n".join(lines)


def _brief_build(b: dict) -> dict:
    keep = ("sha256", "bytes", "file", "id", "name", "product", "version", "fresh", "path", "built_at", "last_built_at", "times_built", "check", "signatures", "warnings")
    out = {k: b.get(k) for k in keep if k in b}
    if "entries" in b:
        out["files"] = len(b["entries"])
    return out


def op_package(eng: Engine, id: str, reproduce: bool = False, out: str | None = None, anyway: bool = False) -> dict:
    try:
        build = eng.post(f"/api/projects/{q(id)}/package", {"anyway": True} if anyway else {})
    except EngineError as err:
        check = err.data.get("check") if isinstance(err.data, dict) else None
        if check:
            raise OpError(err.message, {"problems": [p for p in check.get("problems", []) if p.get("severity") == "error"]}) from err
        raise
    result: dict[str, Any] = {"build": _brief_build(build)}
    if reproduce:
        result["reproduce"] = eng.post(f"/api/projects/{q(id)}/package/reproduce")
    if out:
        data = eng.call("GET", f"/api/projects/{q(id)}/builds/{q(build['sha256'])}/file", raw=True)
        target = Path(out).expanduser()
        if target.is_dir() or out.endswith(("/", os.sep)):
            target.mkdir(parents=True, exist_ok=True)
            target = target / (build.get("file") or f"{build['id']}-{build['version']}.formpkg")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        result["saved"] = str(target.resolve())
    return result


def _say_package(d: dict) -> str:
    b = d["build"]
    lines = [f"{b.get('file')}  {b.get('bytes')} bytes  sha256 {b.get('sha256')}" + ("" if b.get("fresh", True) else "  (same as an earlier build)")]
    for w in b.get("warnings") or []:
        lines.append(f"warning {w.get('file')}:{w.get('line') or ''} {w.get('rule')}: {w.get('message')}")
    if "reproduce" in d:
        r = d["reproduce"]
        lines.append(f"reproducible: {r.get('ok', r.get('reproducible'))}")
    if d.get("saved"):
        lines.append(f"saved {d['saved']}")
    return "\n".join(lines)


def op_builds(eng: Engine, id: str) -> dict:
    return {"project": id, "builds": [_brief_build(b) for b in _builds(eng, id)]}


def op_keys(eng: Engine, action: str = "list", id: str | None = None, name: str | None = None, url: str | None = None, passphrase: str | None = None) -> dict:
    if action == "list":
        return eng.get("/api/keys")
    if not id:
        raise OpError("name the key (its id, for example nodemode)")
    if action == "create":
        return eng.post("/api/keys", {"id": id, "name": name or id, "url": url or "", "passphrase": passphrase or ""})
    if action == "export":
        return eng.get(f"/api/keys/{q(id)}/public")
    raise OpError("action is list, create or export")


def op_sign(eng: Engine, id: str, key: str, sha: str | None = None, passphrase: str | None = None) -> dict:
    digest = _sha(eng, id, sha)
    return eng.post(f"/api/projects/{q(id)}/builds/{q(digest)}/sign", {"key": key, "passphrase": passphrase or ""})


def op_verify(eng: Engine, id: str, sha: str | None = None) -> dict:
    digest = _sha(eng, id, sha)
    return eng.post(f"/api/projects/{q(id)}/builds/{q(digest)}/verify", {})


def op_entry(eng: Engine, id: str, sha: str | None = None, url: str | None = None, publisher: str | None = None) -> dict:
    digest = _sha(eng, id, sha)
    return eng.get(f"/api/projects/{q(id)}/builds/{q(digest)}/entry", url=url, publisher=publisher)


def op_apps(eng: Engine) -> dict:
    route = _route("apps")
    _need(eng, "runapp", "Run in App", route)
    data = eng.call(*route)
    apps = []
    for a in data.get("apps", []):
        apps.append({
            "product": a.get("product"),
            "name": a.get("name"),
            "installed": bool(a.get("installs")),
            "version": a.get("version"),
            "launchable": a.get("launchable"),
            "dev": [{"id": r.get("id"), "path": r.get("path"), "project": (r.get("project") or {}).get("id") if isinstance(r.get("project"), dict) else r.get("project"), "state": (r.get("host") or {}).get("state"), "reason": (r.get("host") or {}).get("reason") or None} for r in (a.get("dev") or {}).get("extensions", [])],
            "extensions": len(a.get("extensions") or []),
        })
    return {"root": data.get("root"), "formportal_cli": data.get("cli"), "state_error": data.get("state_error"), "apps": apps}


def _say_apps(d: dict) -> str:
    root = d.get("root") or {}
    lines = [f"FormPortal folder {root.get('path')} ({root.get('source')}{'' if root.get('exists') else ', not there yet'})"]
    for a in d["apps"]:
        lines.append(f"{a['product']:12} {'installed ' + str(a['version'] or '') if a['installed'] else 'not installed':22} {len(a['dev'])} dev, {a['extensions']} installed extensions")
        for r in a["dev"]:
            lines.append(f"  dev {r['id']}: {r['state']}" + (f" ({r['reason']})" if r.get("reason") else "") + f"  {r['path']}")
    return "\n".join(lines)


def op_run_in_app(eng: Engine, id: str, remove: bool = False, status: bool = False, open: bool = False) -> dict:
    key = "run_status" if status else "stop" if remove else "run"
    route = _route(key, id=id)
    _need(eng, "runapp", "Run in App", route)
    result = eng.call(route[0], route[1], {} if key == "run" else None)
    if open and not remove:
        product = (result.get("product") if isinstance(result, dict) else None) or _project(eng, id).get("product")
        result = {**result, "opened": eng.call(*_route("open_app", product=product), {})}
    return result


def _say_run(d: dict) -> str:
    host = d.get("host") or {}
    app = d.get("app") or {}
    lines = [f"{d.get('id')} in {(d.get('dev') or {}).get('file')}: {'listed' if d.get('listed') else 'not listed'}"]
    if host:
        lines.append(f"the host would say: {host.get('state')}" + (f" ({host.get('reason')})" if host.get("reason") else ""))
    lines.append(f"{app.get('name') or d.get('product')}: " + (f"installed {app.get('version') or ''}" if app.get("installs") else "not installed by FormPortal on this computer"))
    if d.get("other_path"):
        lines.append(f"dev.json lists this id at another folder: {d['other_path']}")
    if d.get("opened"):
        lines.append(f"opened {d['opened'].get('opened')}")
    return "\n".join(lines)


def op_publish(eng: Engine, id: str, url: str | None = None, publisher: str | None = None, passphrase: str | None = None, unsigned: bool = False, formportal: bool = False) -> dict:
    route = _route("publish", id=id)
    _need(eng, "publish", "Publish", route)
    body = {"url": url or "", "publisher": publisher or "", "passphrase": passphrase or "", "sign": not unsigned}
    result = eng.call(route[0], route[1], body)
    if formportal:
        result = {**result, "formportal": eng.call(*_route("send", id=id), {})}
    return result


def _say_publish(d: dict) -> str:
    lines = [f"submission {d.get('folder')}", f"package {d.get('package')}  {d.get('bytes')} bytes  sha256 {d.get('sha256')}", f"url {d.get('url')}" + ("  (the default formai.studio address)" if d.get("url_default") else ""), f"signed by {d.get('signed_by') or 'nobody (no publisher key)'}"]
    if "formportal" in d:
        lines.append(f"FormPortal: {json.dumps(d['formportal'])}")
    return "\n".join(lines)


def op_submit(eng: Engine, id: str, checkout: str | None = None) -> dict:
    route = _route("submit", id=id)
    _need(eng, "publish", "Submit to Registry", route)
    if checkout:
        folder = Path(checkout).expanduser().resolve()
        if not (folder / "tools" / "check.py").is_file():
            raise OpError(f"{folder} is not a form.ext-registry checkout (it has no tools/check.py)")
        eng.call("PUT", "/api/settings", {"registry": {"checkout": str(folder)}})
    return eng.call(route[0], route[1], {})


def _say_submit(d: dict) -> str:
    c = d.get("checks") or {}
    lines = [f"registry folder {d.get('folder')}", f"files {', '.join(d.get('files') or [])}"]
    if d.get("made"):
        lines.append(f"written by form.ext (edit them): {', '.join(d['made'])}")
    if not d.get("screenshot"):
        lines.append(f"screenshot slot: add {d.get('screenshot_slot')} to the folder")
    lines += [f"checks by {c.get('tool')}: {'passed' if c.get('ok') else 'FAILED'}", c.get("note") or "", c.get("report") or "", "", "then, in a terminal:"]
    for step in d.get("commands") or []:
        lines.append(f"# {step['say']}\n{step['run']}")
    return "\n".join(lines)


def _say_validate(d: dict) -> str:
    counts = d.get("counts") or {}
    lines = [("ok" if d.get("ok") else "problems") + f": {counts.get('error', 0)} errors, {counts.get('warning', 0)} warnings, {counts.get('info', 0)} notes ({d.get('files')} files, {d.get('bytes')} bytes)"]
    for p in d.get("problems") or []:
        where = p.get("path") or p.get("file") or ""
        if p.get("line"):
            where += f":{p['line']}"
        lines.append(f"{p.get('severity', ''):8} {where}  {p.get('rule')}: {p.get('message')}" + (f"\n         fix: {p['fix']}" if p.get("fix") else ""))
    return "\n".join(lines)


def _say_projects(d: dict) -> str:
    rows = d.get("projects") or []
    if not rows:
        return "no projects yet (new makes one)"
    return "\n".join(f"{p['id']:28} {str(p.get('product') or ''):12} {str(p.get('version') or ''):8} {p.get('name')}" for p in rows)


def _say_status(d: dict) -> str:
    e = d["engine"]
    lines = [
        f"form.ext engine {e.get('version')} (API {e.get('api')}), {e['mode']}" + (f" at {e['url']}" if e.get("url") else ""),
        f"data   {d['home']}",
        "modules " + "  ".join(f"{k} {'yes' if v else 'no'}" for k, v in d["modules"].items()),
        f"projects {d['projects']}",
    ]
    for name, err in (d.get("router_errors") or {}).items():
        lines.append(f"router {name} failed: {err}")
    lines.append(f"next   {d['next']}")
    return "\n".join(lines)


def _say_new(d: dict) -> str:
    p = d["project"]
    return f"made {p['id']} ({p['product']}) in {p['dir']}\n" + "\n".join(f"  {f}" for f in d["files"])


def _say_read(d: dict) -> str:
    return d.get("text") if d.get("encoding") == "utf-8" else f"{d.get('path')}: {d.get('size')} bytes of binary (use --json for base64)"


def _say_templates(d: dict) -> str:
    lines = ["starters: " + ", ".join(s["id"] for s in d["starters"])]
    for p in d["products"]:
        lines.append(f"{p['id']:12} {p['name']:12} {p.get('docs') or 'no API page bundled'}")
        for s in p["starters"]:
            lines.append(f"  {s['starter']:15} {s['title']}: {s['summary']}")
    if d.get("examples"):
        lines.append("examples: " + ", ".join(d["examples"]))
    return "\n".join(lines)


def _repo_root() -> Path:
    return paths.repo_root()


def tools_markdown() -> str:
    lines = [
        "# formext MCP tools",
        "",
        "Generated by `./formext cli agents-sync` from `backend/app/cli.py`; do not edit by hand. Each tool has the same command on the command line: `./formext cli [command] --help` (the command is the tool name with dashes).",
        "",
        "## Contents",
        "",
        "The table lists every tool; a section per tool follows with its arguments.",
        "",
        "| Tool | Command | Kind | What it does |",
        "| --- | --- | --- | --- |",
    ]
    for op in OPS:
        if not op.mcp:
            continue
        kind = "read" if op.read_only else ("changes, destructive" if op.destructive else "changes")
        lines.append(f"| `{op.name}` | `{op.name.replace('_', '-')}` | {kind} | {op.help} |")
    for op in OPS:
        if not op.mcp:
            continue
        lines += ["", f"## {op.name}", "", op.help, ""]
        if op.params:
            lines += ["| Argument | Type | Required | Meaning |", "| --- | --- | --- | --- |"]
            for p in op.params:
                if p.name == "source":
                    continue
                kind = p.type + (f" ({', '.join(p.enum)})" if p.enum else "")
                lines.append(f"| `{p.name}` | {kind} | {'yes' if p.required else 'no'} | {p.help}{f' Default {p.default}.' if p.default not in (None, False, '') else ''} |")
        else:
            lines.append("No arguments.")
    return "\n".join(lines) + "\n"


def op_agents_sync(eng: Engine) -> dict:
    root = _repo_root()
    skill = root / ".claude" / "skills" / "formext-harness"
    if not (skill / "SKILL.md").is_file():
        raise OpError(f"{skill} is missing; agents-sync runs in a source checkout")
    target = skill / "references" / "tools.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(tools_markdown(), encoding="utf-8")
    mirror = root / ".agents" / "skills" / "formext-harness"
    if mirror.exists():
        shutil.rmtree(mirror)
    shutil.copytree(skill, mirror)
    return {"tools_md": str(target), "mirror": str(mirror), "tools": sum(1 for op in OPS if op.mcp)}


P_ID = Param("id", help="The project id (projects lists them).", required=True, positional=True)
P_PATH = Param("path", help="A path relative to the project folder, such as package/ui/app.js (files gives package_prefix).", required=True, positional=True)
P_SHA = Param("sha", help="The build's SHA-256 or a unique prefix of it; the latest build when left out.")

OPS: list[Op] = [
    Op("status", "Status", "The engine (running window or in-process), the data folder, which modules are in this engine, and the projects.", op_status, say=_say_status),
    Op("docs", "Docs", "The Form Extension Contract, the SDK, the package schema, the hello example, or one app's extension API page (topic is a product id). Read the app's page before writing code for it.", op_docs, [Param("topic", help="contract, sdk, schema, example, a product id such as formcut, or list.", positional=True, default="list")], say=lambda d: d.get("text") or "\n".join(f"{t['topic']:12} {t['path']}" for t in d.get("topics", [])) or json.dumps(d.get("files"), indent=1)),
    Op("templates", "Templates", "The twelve host apps, the starters each one has (panel, command, panel-commands) and the kit examples.", op_templates, [Param("product", help="Only this host app.", positional=True)], say=_say_templates),
    Op("new", "New extension", "Make a new extension project from a starter for one host app (or copy a kit example). The starter already works: it reads the app's document and runs a real command.", op_new, [
        Param("name", help="The extension's name, such as Beat Markers; the project id is its slug.", positional=True),
        Param("product", help="The host app id, such as formcut (templates lists them).", flag="--app"),
        Param("starter", help="panel, command or panel-commands.", enum=["panel", "command", "panel-commands"], default="panel"),
        Param("description", help="One sentence for manifest.json."),
        Param("example", help="Copy this kit example (such as hello) instead of a starter."),
    ], read_only=False, say=_say_new),
    Op("projects", "Projects", "Every project in form.ext's data folder and every linked folder, newest change first.", op_projects, say=_say_projects),
    Op("project", "Project", "One project: its folder, manifest and files.", op_project, [P_ID]),
    Op("import", "Open folder or package", "Open an extension folder as a project (copied into the data folder, or linked in place with link: true so edits land in that folder), or import a .formpkg file into a new project after the kit's checks.", op_import, [
        Param("path", help="An absolute path: a folder holding manifest.json (or package/manifest.json), or a .formpkg file.", required=True, positional=True),
        Param("link", "boolean", "Open the folder in place instead of copying it (folders only)."),
        Param("name", help="A project name when the manifest has none."),
    ], read_only=False),
    Op("inspect", "Inspect package", "Inspect any .formpkg without importing it: manifest, files with hashes, permissions, and the kit's checks.", op_inspect, [Param("path", help="An absolute path to a .formpkg file.", required=True, positional=True)]),
    Op("files", "Files", "A project's files with sizes, and package_prefix (the folder that holds manifest.json, usually package).", op_files, [P_ID], say=lambda d: "\n".join(f"{f['size']:>9}  {f['path']}" for f in d["files"])),
    Op("read", "Read file", "Read one project file (text, or base64 for binary files).", op_read, [P_ID, P_PATH], say=_say_read),
    Op("write", "Write file", "Write one project file (creates folders). Give text for text files or base64 for binary ones. Writes are atomic and the window shows them live.", op_write, [
        P_ID, P_PATH,
        Param("text", help="The whole new content of a text file."),
        Param("base64", help="The whole new content of a binary file, base64."),
        Param("source", help="A local file to copy in.", flag="--from"),
    ], read_only=False, say=lambda d: f"wrote {d.get('path')} ({d.get('size', '?')} bytes)"),
    Op("delete", "Delete file", "Delete one file or folder of a project.", op_delete, [P_ID, P_PATH], read_only=False, destructive=True, say=lambda d: f"deleted {d.get('path')}"),
    Op("move", "Move file", "Rename or move a file inside a project.", op_move, [P_ID, Param("source", help="The current path.", required=True, positional=True), Param("target", help="The new path.", required=True, positional=True)], read_only=False),
    Op("manifest", "Manifest", "Read the project's manifest.json, or change it with a JSON merge patch (set; null removes a key). Keep api \"1\", native false and the id unchanged.", op_manifest, [P_ID, Param("set", "object", "A JSON merge patch, such as {\"permissions\": [\"document\"], \"description\": \"...\"}.")], read_only=False, say=lambda d: json.dumps(d.get("manifest"), indent=2)),
    Op("validate", "Check", "Check the project against the contract's schema and package rules and lint it (inline script the CSP blocks, fetch or XMLHttpRequest or WebSocket, eval, oversized files, missing entry, permissions used but not declared or declared but unused). Each problem has file, line, rule and fix.", op_validate, [P_ID], say=_say_validate),
    Op("rules", "Check rules", "Every rule the check applies, with its severity and what it means.", op_rules, say=lambda d: "\n".join(f"{r.get('id', r.get('rule'))}: {r.get('title', r.get('summary', ''))}" for r in d.get("rules", []))),
    Op("preview", "Preview snapshot", "What a host would load: the host check (ready or refused with the reason), the sandboxed frame address and its contract headers and CSP, the permissions in the consent dialog's words, the panels and commands, and whether every file the entry page references is served.", op_preview, [
        P_ID,
        Param("product", help="Preview as this app (defaults to the manifest's product)."),
        Param("app_version", help="The app version to check minimum_app against (default 9.99.9).", flag="--app-version"),
    ], say=_say_preview),
    Op("package", "Package", "Check, then build the deterministic .formpkg (sorted entries, fixed timestamps), with SHA-256 and size. Refused on contract errors (every host would refuse the package) and, unless anyway, on code errors. reproduce also rebuilds it with the kit's own formpkg command and compares the SHA-256; out saves a copy.", op_package, [
        P_ID,
        Param("reproduce", "boolean", "Also run the reproducibility check."),
        Param("out", help="Save the .formpkg to this file or folder."),
        Param("anyway", "boolean", "Package despite code errors (never despite contract errors). Say so to the person."),
    ], read_only=False, say=_say_package),
    Op("builds", "Builds", "Every build of a project, newest first, with SHA-256, size and signatures.", op_builds, [P_ID], say=lambda d: "\n".join(f"{b['sha256'][:16]}  {b.get('version')}  {b.get('bytes')} bytes  {len(b.get('signatures') or [])} signatures" for b in d["builds"]) or "no builds yet"),
    Op("keys", "Publisher keys", "List, create or export (public part only) the Ed25519 publisher keys kept in form.ext's data folder.", op_keys, [
        Param("action", help="list, create or export.", enum=["list", "create", "export"], default="list", positional=True),
        Param("id", help="The key id (the publisher id in the index), such as nodemode.", positional=True),
        Param("name", help="The publisher's display name (create)."),
        Param("url", help="The publisher's https address (create)."),
        Param("passphrase", help="Encrypt the private key with this passphrase (create)."),
    ], read_only=False),
    Op("sign", "Sign", "Sign a build with a publisher key (Ed25519 over the package bytes) and verify the signature.", op_sign, [P_ID, Param("key", help="The key id.", required=True), P_SHA, Param("passphrase", help="The key's passphrase, when it has one.")], read_only=False),
    Op("verify", "Verify", "Verify a build's signatures against the publisher keys.", op_verify, [P_ID, P_SHA]),
    Op("entry", "Index entry", "The formai-extensions index entry for a build (with its signature when signed).", op_entry, [P_ID, P_SHA, Param("url", help="The https address the package will be served from."), Param("publisher", help="Use this publisher's signature.")]),
    Op("apps", "Installed apps", "FormPortal's folder, the Form apps it has installed on this computer, and the development extensions each app loads from dev.json (with what the host would say about each).", op_apps, say=_say_apps),
    Op("run_in_app", "Run in App", "Add the project's package folder to FormPortal's dev.json for its app, so the real app loads it live as a development extension and picks up every save. remove takes it out again, status only reports, open also opens the app.", op_run_in_app, [
        P_ID,
        Param("remove", "boolean", "Take the project out of dev.json."),
        Param("status", "boolean", "Only report whether it is listed and what the host would say."),
        Param("open", "boolean", "Open the app afterwards (when FormPortal installed it)."),
    ], read_only=False, say=_say_run),
    Op("publish", "Publish", "Build, sign with the publisher key (unless unsigned) and make the submission folder for formai.studio: the .formpkg, entry.json, a one-package extensions.json and a README. formportal also sends the package to FormPortal to install.", op_publish, [
        P_ID,
        Param("url", help="The https address the package will be served from (default: its formai.studio address)."),
        Param("publisher", help="The publisher key to sign with (default: the settings' publisher or the only key)."),
        Param("passphrase", help="The key's passphrase, when it has one."),
        Param("unsigned", "boolean", "Do not sign."),
        Param("formportal", "boolean", "Also send the package to FormPortal to install."),
    ], read_only=False, say=_say_publish),
    Op("submit", "Submit to Registry", "Write the project into a folder in form.ext-registry's layout (extensions/<id>/ with package/, the source, package.json when there is one, README.md, LICENSE, CHANGELOG.md and a screenshot slot), run the registry's tools/check.py on it when a local registry checkout is set (else form.ext's own Check, and it says which ran), and give the git and gh commands that fork nodemode-dev/form.ext-registry, add the folder and open the pull request. It never pushes anything itself.", op_submit, [
        P_ID,
        Param("checkout", help="A local clone of nodemode-dev/form.ext-registry whose tools/check.py runs on the folder (saved as the setting registry.checkout)."),
    ], read_only=False, say=_say_submit),
    Op("agents_sync", "Sync agent files", "Regenerate the harness skill's references/tools.md from this table and mirror the harness skill into .agents/skills.", op_agents_sync, mcp=False, read_only=False),
]

BY_NAME = {op.name: op for op in OPS}


def run_op(eng: Engine, name: str, args: dict) -> Any:
    op = BY_NAME.get(name)
    if op is None:
        raise OpError(f"there is no {name}")
    known = {p.name for p in op.params}
    clean = {k: v for k, v in (args or {}).items() if k in known and v is not None}
    missing = [p.name for p in op.params if p.required and p.name not in clean]
    if missing:
        raise OpError(f"{name} needs {', '.join(missing)}")
    for p in op.params:
        if p.enum and p.name in clean and clean[p.name] not in p.enum:
            raise OpError(f"{p.name} is one of {', '.join(p.enum)}")
    return op.run(eng, **clean)


def _parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--json", action="store_true", default=argparse.SUPPRESS, help="print the answer as JSON")
    common.add_argument("--engine", metavar="URL", default=argparse.SUPPRESS, help="talk to the engine at URL (default: a running engine with this data folder, else in-process)")
    common.add_argument("--local", action="store_true", default=argparse.SUPPRESS, help="always run the engine's routes in-process")
    parser = argparse.ArgumentParser(prog="formext cli", description="The form.ext command line: make, check, preview, package, sign, run and publish Form extensions.", parents=[common])
    parser.add_argument("--version", action="version", version=f"formext {__version__}")
    subs = parser.add_subparsers(dest="command", metavar="command")
    for op in OPS:
        if not op.cli:
            continue
        sp = subs.add_parser(op.name.replace("_", "-"), help=op.help, description=op.help, parents=[common])
        for p in op.params:
            if p.type == "boolean":
                sp.add_argument(p.flag or f"--{p.name.replace('_', '-')}", dest=p.name, action="store_true", help=p.help)
            elif p.positional:
                sp.add_argument(p.name, nargs=None if p.required else "?", default=p.default, help=p.help, choices=p.enum)
            else:
                sp.add_argument(p.flag or f"--{p.name.replace('_', '-')}", dest=p.name, default=p.default, help=p.help, choices=p.enum, required=p.required)
    return parser


def _print(op: Op, data: Any, as_json: bool) -> None:
    if as_json or op.say is None:
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print(op.say(data))


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(sys.argv[1:] if argv is None else argv)
    as_json = getattr(args, "json", False)
    if not args.command:
        _parser().print_help()
        return 2
    op = BY_NAME[args.command.replace("-", "_")]
    eng = Engine(getattr(args, "engine", None), "local" if getattr(args, "local", False) else "auto")
    values = {p.name: getattr(args, p.name, None) for p in op.params}
    try:
        data = run_op(eng, op.name, values)
    except OpError as err:
        if as_json:
            print(json.dumps({"error": err.message, "data": err.data}, indent=2, ensure_ascii=False))
        else:
            print(f"formext: {err.message}", file=sys.stderr)
            problems = err.data.get("problems") if isinstance(err.data, dict) else None
            for p in problems or []:
                print(f"  {p.get('path') or p.get('file')}:{p.get('line') or ''} {p.get('rule')}: {p.get('message')}", file=sys.stderr)
        return err.code
    try:
        _print(op, data, as_json)
    except BrokenPipeError:
        sys.stderr.close()
        return 0
    if op.name == "validate" and not data.get("ok"):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
