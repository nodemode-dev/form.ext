"""Host sources: the source code of the Form app an extension is made for, kept beside the projects so an agent writes against
the real host instead of from memory. Each Form app's public repository is shallow-cloned into the data folder (`sources/<key>/`),
or downloaded as an archive when git is not installed, and is read-only here: listed, read and searched, never edited or built.
The same store keeps the family's other repositories an extension author needs: FormPortal and the Form Extension Registry."""

import fnmatch
import http.client
import json
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path, PurePosixPath

from app.services import paths, settings
from app.services.bus import bus
from app.services.workspace import NotFound, WorkspaceError, workspace

BASE = "https://github.com/nodemode-dev"
FAMILY: list[tuple[str, str, str, str]] = [
    ("formvis", "FormVis", "formvis", "host"),
    ("formcut", "FormCut", "formcut", "host"),
    ("formwav", "FormWav", "formwav", "host"),
    ("formpdf", "FormPDF", "formpdf", "host"),
    ("formdeck", "FormDeck", "formdeck", "host"),
    ("formlit", "FormLit", "formlit", "host"),
    ("formmd", "Form.md", "form.md", "host"),
    ("formencoder", "FormEncoder", "formencoder", "host"),
    ("formvfx", "FormVFX", "formvfx", "host"),
    ("formmcp", "FormMCP", "formMCP", "host"),
    ("formtray", "FormTray", "formtray", "host"),
    ("formskills", "FormSkills", "formskills", "host"),
    ("formportal", "FormPortal", "formportal", "family"),
    ("registry", "Form Extension Registry", "form.ext-registry", "family"),
]
BY_KEY = {row[0]: row for row in FAMILY}
ALIASES = {row[2].lower(): row[0] for row in FAMILY} | {"form-md": "formmd", "form.ext-registry": "registry", "formext-registry": "registry"}
SKIP_DIRS = {".git", "node_modules", "target", "dist", "build", "__pycache__", "venv", ".venv", ".next", ".turbo"}
BINARY = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".icns", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".mov", ".zip", ".gz", ".formpkg", ".wasm", ".pdf", ".bin", ".exe", ".dll", ".dylib", ".so", ".lock"}
DOCS = ("CLAUDE.md", "AGENTS.md", "README.md", "docs/EXTENSIONS.md", ".docs/wiki/Extensions.md", ".docs/wiki/Architecture.md", "docs/MANUAL.md", "SUBMITTING.md", "POLICY.md")
HOST_NAMES = {"host-bridge.ts", "formext_host.py", "formext.go", "extensions.rs", "extensions.ts", "extensions.go", "extensions.py", "docops.ts"}
HOST_SKIP = {"demo", "demos", "docs", ".docs", "assets", "examples", "contract"}
MAX_ARCHIVE = 600 * 1024 * 1024
MAX_UNPACKED = 4 * 1024 * 1024 * 1024
MAX_PATTERN = 200
MAX_LINE = 2000
MAX_READ = 2 * 1024 * 1024
MAX_SEARCH_FILE = 1536 * 1024
SEARCH_SECONDS = 20
RETRY_AFTER = 600
GIT_TIMEOUT = 900

_locks: dict[str, threading.Lock] = {}
_guard = threading.Lock()
_state: dict[str, dict] = {}


class SourceError(WorkspaceError):
    status = 502


def root() -> Path:
    return paths.sub("sources")


def _lock(key: str) -> threading.Lock:
    with _guard:
        return _locks.setdefault(key, threading.Lock())


def resolve(key: str) -> str:
    """A source key from what a caller names: a product id, a repository name, or a project id (then its host app)."""
    name = str(key or "").strip()
    low = name.lower()
    if low in BY_KEY:
        return low
    if low in ALIASES:
        return ALIASES[low]
    if name and workspace.exists(name):
        product = str(workspace.manifest(name).get("product") or "")
        if product in BY_KEY:
            return product
        raise NotFound(f"the project {name} names the host app {product or '(none)'}, which has no source here")
    raise NotFound(f"{name or '(nothing)'} is not a Form app, formportal, registry or a project id; the sources are: {', '.join(BY_KEY)}")


def url(key: str) -> str:
    base = str(os.environ.get("FORMEXT_SOURCES_BASE") or settings.value("sources.base") or BASE).strip()
    if not base.startswith(("https://", "http://", "file://")):
        raise WorkspaceError("the setting sources.base must be an https://, http:// or file:// address")
    return f"{base.rstrip('/')}/{BY_KEY[key][2]}"


def _local(key: str) -> Path | None:
    configured = settings.value(f"sources.local.{key}")
    if isinstance(configured, str) and configured.strip():
        folder = Path(configured.strip()).expanduser()
        if folder.is_dir():
            return folder
    return None


def folder(key: str) -> Path:
    return _local(key) or _managed(key)


def _managed(key: str) -> Path:
    return root() / BY_KEY[key][2]


def _meta_file(key: str) -> Path:
    meta = root() / ".meta"
    meta.mkdir(parents=True, exist_ok=True)
    return meta / f"{key}.json"


def _meta(key: str) -> dict:
    try:
        data = json.loads(_meta_file(key).read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def present(key: str) -> bool:
    local = _local(key)
    if local is not None:
        return True
    return _managed(key).is_dir() and _meta_file(key).is_file()


def git() -> str | None:
    return os.environ.get("FORMEXT_GIT_BIN") or shutil.which("git")


def _run(args: list[str], cwd: Path | None = None, timeout: int = GIT_TIMEOUT) -> subprocess.CompletedProcess:
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0", GIT_LFS_SKIP_SMUDGE="1", GCM_INTERACTIVE="never")
    flags = 0x08000000 if os.name == "nt" else 0
    return subprocess.run(args, cwd=str(cwd) if cwd else None, capture_output=True, text=True, timeout=timeout, env=env, stdin=subprocess.DEVNULL, creationflags=flags)


def _tail(text: str, lines: int = 6) -> str:
    kept = [ln for ln in (text or "").strip().splitlines() if ln.strip()]
    return " | ".join(kept[-lines:])


def _head(target: Path) -> dict:
    exe = git()
    if not exe or not (target / ".git").exists():
        return {}
    try:
        out = _run([exe, "log", "-1", "--format=%H%n%cI%n%s"], cwd=target, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return {}
    parts = out.stdout.strip().split("\n", 2) if out.returncode == 0 else []
    if len(parts) < 3:
        return {}
    return {"commit": parts[0], "committed_at": parts[1], "subject": parts[2]}


def _licence(target: Path) -> str | None:
    for name in ("LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE"):
        try:
            head = (target / name).read_text(encoding="utf-8", errors="replace")[:1600]
        except OSError:
            continue
        if "GNU AFFERO GENERAL PUBLIC LICENSE" in head:
            return "AGPL-3.0"
        if "GNU LESSER GENERAL PUBLIC LICENSE" in head:
            return "LGPL-3.0"
        if "GNU GENERAL PUBLIC LICENSE" in head:
            return "GPL-3.0" if "Version 3" in head else "GPL-2.0"
        if "Apache License" in head:
            return "Apache-2.0"
        if "MIT License" in head or "Permission is hereby granted, free of charge" in head:
            return "MIT"
        if "Mozilla Public License" in head:
            return "MPL-2.0"
        return "see " + name
    return None


def _walk(target: Path, under: str = ""):
    start = target / under if under else target
    for here, dirs, names in os.walk(start):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        base = Path(here)
        for name in sorted(names):
            item = base / name
            if item.is_symlink():
                continue
            yield item, item.relative_to(target).as_posix()


def _landmarks(target: Path) -> dict:
    host: list[str] = []
    count = 0
    size = 0
    for item, rel in _walk(target):
        count += 1
        try:
            size += item.stat().st_size
        except OSError:
            continue
        parts = rel.split("/")
        if parts[0] in HOST_SKIP or len(host) >= 40:
            continue
        if item.name in HOST_NAMES or "formext" in parts[:-1] or "ext" in parts[:-1] and item.name.startswith(("extensions", "host-bridge")):
            host.append(rel)
    skills_dir = target / ".claude" / "skills"
    skills = sorted(p.name for p in skills_dir.iterdir() if (p / "SKILL.md").is_file()) if skills_dir.is_dir() else []
    return {
        "docs": [d for d in DOCS if (target / d).is_file()],
        "extension_host": host,
        "skills": skills,
        "licence": _licence(target),
        "files": count,
        "bytes": size,
    }


def _note(licence: str | None) -> str:
    text = "Read the source to learn the app's real commands, document fields and events; an extension still reaches the app only through the SDK."
    if licence and "GPL" in licence:
        text += f" The source is {licence}: copying its code into an extension puts the extension under {licence}, so write your own code against what you read."
    return text


def status(key: str) -> dict:
    key = resolve(key)
    _, name, repo, kind = BY_KEY[key]
    local = _local(key)
    target = folder(key)
    here = present(key)
    meta = _meta(key) if local is None else {}
    live = _state.get(key) or {}
    state = "pulling" if live.get("state") == "pulling" else "ready" if here else "failed" if live.get("state") == "failed" else "absent"
    out: dict = {
        "key": key,
        "name": name,
        "repository": f"nodemode-dev/{repo}",
        "url": url(key),
        "kind": kind,
        "state": state,
        "dir": str(target) if here else None,
        "method": "local" if local is not None else meta.get("method"),
        "pulled_at": meta.get("pulled_at"),
    }
    if state == "failed":
        out["error"] = live.get("error")
    if here:
        head = _head(target) or {k: meta.get(k) for k in ("commit", "committed_at", "subject") if meta.get(k)}
        out.update(head)
        marks = meta.get("landmarks") if isinstance(meta.get("landmarks"), dict) else _landmarks(target)
        out.update(marks)
        out["note"] = _note(marks.get("licence"))
    return out


def catalogue() -> dict:
    return {
        "dir": str(root()),
        "git": git() is not None,
        "auto": settings.value("sources.auto", True) is not False,
        "sources": [status(row[0]) for row in FAMILY],
    }


def _clone(key: str, staging: Path) -> dict:
    exe = git()
    out = _run([exe, "clone", "--depth", "1", "--no-tags", "--", url(key) + ".git", str(staging)])
    if out.returncode != 0:
        raise SourceError(f"git could not clone {url(key)} ({_tail(out.stderr) or 'no message'}); check the internet connection and try again")
    return {"method": "git", **_head(staging)}


def _download(key: str, staging: Path) -> dict:
    address = f"{url(key)}/archive/HEAD.tar.gz"
    request = urllib.request.Request(address, headers={"User-Agent": "formext-sources", "Accept": "application/gzip"})
    with tempfile.NamedTemporaryFile(prefix="formext-src-", suffix=".tar.gz", dir=str(root()), delete=False) as tmp:
        archive = Path(tmp.name)
        try:
            with urllib.request.urlopen(request, timeout=120) as res:
                got = 0
                while True:
                    chunk = res.read(1024 * 256)
                    if not chunk:
                        break
                    got += len(chunk)
                    if got > MAX_ARCHIVE:
                        raise SourceError(f"the archive of {url(key)} is larger than {MAX_ARCHIVE // (1024 * 1024)} MB; install git to clone it instead")
                    tmp.write(chunk)
        except SourceError:
            tmp.close()
            archive.unlink(missing_ok=True)
            raise
        except (urllib.error.URLError, http.client.HTTPException, OSError, TimeoutError) as exc:
            tmp.close()
            archive.unlink(missing_ok=True)
            raise SourceError(f"{address} could not be downloaded ({exc}); check the internet connection, or install git") from exc
    unpack = staging.with_name(staging.name + "-x")
    shutil.rmtree(unpack, ignore_errors=True)
    try:
        with tarfile.open(archive, "r:gz") as tar:
            commit = str(tar.pax_headers.get("comment") or "")
            if sum(m.size for m in tar.getmembers()) > MAX_UNPACKED:
                raise SourceError(f"the archive of {url(key)} unpacks to more than {MAX_UNPACKED // (1024 * 1024)} MB; install git to clone it instead")
            tar.extractall(unpack, filter="data")
        tops = [p for p in unpack.iterdir() if p.is_dir()]
        if len(tops) != 1:
            raise SourceError(f"the archive of {url(key)} does not hold one folder")
        os.replace(tops[0], staging)
    except (tarfile.TarError, OSError) as exc:
        raise SourceError(f"the archive of {url(key)} could not be unpacked ({exc})") from exc
    finally:
        archive.unlink(missing_ok=True)
        shutil.rmtree(unpack, ignore_errors=True)
    return {"method": "archive", "commit": commit if re.fullmatch(r"[0-9a-f]{40}", commit) else None}


def _refresh(key: str, target: Path) -> dict | None:
    exe = git()
    if not exe or not (target / ".git").exists():
        return None
    fetched = _run([exe, "fetch", "--depth", "1", "--no-tags", "origin", "HEAD"], cwd=target)
    if fetched.returncode != 0:
        raise SourceError(f"git could not fetch {url(key)} ({_tail(fetched.stderr) or 'no message'}); the copy from the last pull is still here")
    moved = _run([exe, "reset", "--hard", "FETCH_HEAD"], cwd=target, timeout=300)
    if moved.returncode != 0:
        return None
    return {"method": "git", **_head(target)}


def _sweep() -> None:
    for item in root().iterdir():
        try:
            stale = time.time() - item.stat().st_mtime > 3600
        except OSError:
            continue
        if stale and item.name.startswith(".new-"):
            shutil.rmtree(item, ignore_errors=True)
        elif stale and item.name.startswith("formext-src-"):
            item.unlink(missing_ok=True)


def pull(key: str, update: bool = False) -> dict:
    """Bring a source into the data folder (a no-op when it is already there, unless update), and answer its status."""
    key = resolve(key)
    if _local(key) is not None:
        return status(key)
    with _lock(key):
        if present(key) and not update:
            return status(key)
        _state[key] = {"state": "pulling", "at": time.time()}
        bus.emit("source.changed", {"key": key, "state": "pulling"})
        target = _managed(key)
        staging = root() / f".new-{key}-{os.getpid()}-{threading.get_ident()}"
        try:
            _sweep()
            info = _refresh(key, target) if update and present(key) else None
            if info is None:
                shutil.rmtree(staging, ignore_errors=True)
                info = _clone(key, staging) if git() else _download(key, staging)
                old = root() / f".new-{key}-old-{os.getpid()}"
                shutil.rmtree(old, ignore_errors=True)
                if target.exists():
                    os.replace(target, old)
                try:
                    os.replace(staging, target)
                except OSError:
                    if old.exists() and not target.exists():
                        os.replace(old, target)
                    raise
                _drop(old)
            info.update({"key": key, "url": url(key), "pulled_at": time.time(), "landmarks": _landmarks(target)})
            tmp = _meta_file(key).with_suffix(".json.tmp")
            tmp.write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
            os.replace(tmp, _meta_file(key))
        except Exception as exc:
            _drop(staging)
            message = exc.message if isinstance(exc, WorkspaceError) else f"{type(exc).__name__}: {exc}"
            _state[key] = {"state": "failed", "error": message, "at": time.time()}
            bus.emit("source.changed", {"key": key, "state": "failed", "error": message})
            if isinstance(exc, WorkspaceError):
                raise
            raise SourceError(f"the source of {BY_KEY[key][1]} could not be pulled ({message})") from exc
        _state.pop(key, None)
        bus.emit("source.changed", {"key": key, "state": "ready", "commit": info.get("commit")})
        return status(key)


def _drop(target: Path) -> None:
    def writable(func, path, _exc):
        try:
            os.chmod(path, 0o700)
            func(path)
        except OSError:
            pass

    if target.exists():
        shutil.rmtree(target, onerror=writable)


def pull_async(key: str, update: bool = False) -> dict:
    key = resolve(key)
    live = _state.get(key) or {}
    if live.get("state") == "pulling" or _local(key) is not None or (present(key) and not update):
        return status(key)

    def run() -> None:
        try:
            pull(key, update)
        except WorkspaceError:
            pass
        finally:
            if (_state.get(key) or {}).get("state") == "pulling":
                _state.pop(key, None)

    _state[key] = {"state": "pulling", "at": time.time()}
    threading.Thread(target=run, name=f"formext-source-{key}", daemon=True).start()
    return status(key)


def auto(product: str) -> None:
    """Start pulling a host app's source in the background when a project for it is made or opened: once, quietly, and not again
    for a while after a failure. Turned off by the setting sources.auto."""
    if product not in BY_KEY or settings.value("sources.auto", True) is False or os.environ.get("FORMEXT_SOURCES_AUTO") == "0":
        return
    live = _state.get(product) or {}
    if present(product) or live.get("state") == "pulling" or (live.get("state") == "failed" and time.time() - live.get("at", 0) < RETRY_AFTER):
        return
    pull_async(product)


def remove(key: str) -> dict:
    key = resolve(key)
    if _local(key) is not None:
        raise WorkspaceError(f"{folder(key)} is your own folder (the setting sources.local.{key}); form.ext does not delete it")
    with _lock(key):
        _drop(_managed(key))
        _meta_file(key).unlink(missing_ok=True)
        _state.pop(key, None)
    bus.emit("source.changed", {"key": key, "state": "absent"})
    return status(key)


def _ready(key: str) -> tuple[str, Path]:
    key = resolve(key)
    if not present(key):
        raise NotFound(f"the source of {BY_KEY[key][1]} is not here yet; pull it first (source {key})")
    return key, folder(key)


def _inside(target: Path, rel: str) -> Path:
    text = str(rel or "").replace("\\", "/").strip("/")
    pure = PurePosixPath(text)
    if not text or pure.is_absolute() or ".." in pure.parts or ".git" in pure.parts or "\x00" in text or re.match(r"^[A-Za-z]:", text):
        raise WorkspaceError(f"{rel!r} is not a path inside the source")
    base = target.resolve()
    found = (base / text).resolve()
    if found != base and base not in found.parents:
        raise WorkspaceError(f"{rel!r} leads outside the source")
    return found


def files(key: str, under: str = "", glob: str = "", limit: int = 2000) -> dict:
    key, target = _ready(key)
    sub = ""
    if under:
        start = _inside(target, under)
        if not start.is_dir():
            raise NotFound(f"there is no folder {under} in the source of {BY_KEY[key][1]}")
        sub = start.relative_to(target.resolve()).as_posix()
    cap = max(1, min(int(limit or 2000), 20000))
    rows: list[dict] = []
    total = 0
    for item, rel in _walk(target, sub):
        if glob and not fnmatch.fnmatch(rel, glob) and not fnmatch.fnmatch(item.name, glob):
            continue
        total += 1
        if len(rows) < cap:
            try:
                rows.append({"path": rel, "size": item.stat().st_size})
            except OSError:
                continue
    return {"source": key, "dir": str(target), "under": sub, "glob": glob or None, "files": rows, "total": total, "truncated": total > len(rows)}


def read(key: str, path: str, start: int = 1, lines: int = 400) -> dict:
    key, target = _ready(key)
    found = _inside(target, path)
    if not found.is_file():
        raise NotFound(f"there is no file {path} in the source of {BY_KEY[key][1]}; source_files lists them")
    size = found.stat().st_size
    rel = found.relative_to(target.resolve()).as_posix()
    if size > MAX_READ:
        raise WorkspaceError(f"{rel} is {size} bytes, more than this reads at once; search it with source_search instead")
    try:
        raw = found.read_bytes()
    except OSError as exc:
        raise WorkspaceError(f"{rel} could not be read ({exc.strerror or exc})") from exc
    if b"\x00" in raw[:8192]:
        return {"source": key, "path": rel, "abs": str(found), "size": size, "binary": True}
    rows = raw.decode("utf-8", errors="replace").splitlines()
    first = max(1, int(start or 1))
    count = max(1, min(int(lines or 400), 2000))
    chunk = rows[first - 1:first - 1 + count]
    return {"source": key, "path": rel, "abs": str(found), "size": size, "start": first, "end": first + len(chunk) - 1, "total_lines": len(rows), "text": "\n".join(chunk)}


def search(key: str, query: str, glob: str = "", regex: bool = False, case: bool = False, limit: int = 60) -> dict:
    key, target = _ready(key)
    if not str(query or "").strip():
        raise WorkspaceError("give the words to search for")
    if regex and len(query) > MAX_PATTERN:
        raise WorkspaceError(f"the pattern is longer than {MAX_PATTERN} characters; search for a shorter one")
    if regex and re.search(r"\)[+*]|[+*]\)[+*{]", query):
        raise WorkspaceError("the pattern repeats a group that itself repeats, which can take forever; write it without the nested repeat")
    try:
        pattern = re.compile(query if regex else re.escape(query), 0 if case else re.IGNORECASE)
    except re.error as exc:
        raise WorkspaceError(f"the pattern is not a valid regular expression ({exc})") from exc
    cap = max(1, min(int(limit or 60), 500))
    hits: list[dict] = []
    scanned = 0
    began = time.time()
    stopped = None
    for item, rel in _walk(target):
        if glob and not fnmatch.fnmatch(rel, glob) and not fnmatch.fnmatch(item.name, glob):
            continue
        if item.suffix.lower() in BINARY:
            continue
        if time.time() - began > SEARCH_SECONDS:
            stopped = "time"
            break
        try:
            if item.stat().st_size > MAX_SEARCH_FILE:
                continue
            raw = item.read_bytes()
        except OSError:
            continue
        if b"\x00" in raw[:4096]:
            continue
        scanned += 1
        for number, line in enumerate(raw.decode("utf-8", errors="replace").splitlines(), 1):
            if pattern.search(line[:MAX_LINE]):
                hits.append({"path": rel, "line": number, "text": line.strip()[:240]})
                if len(hits) >= cap:
                    stopped = "limit"
                    break
        if stopped:
            break
    return {"source": key, "query": query, "glob": glob or None, "matches": hits, "files_scanned": scanned, "truncated": stopped is not None, "stopped": stopped}


def host_dir(product: str) -> Path | None:
    """The folder of a host app's source when it is here, for an agent's extra directory; never pulls."""
    if product in BY_KEY and present(product):
        return folder(product)
    return None


def project_source(pid: str | None) -> tuple[str, Path] | None:
    if not pid:
        return None
    try:
        product = str(workspace.manifest(pid).get("product") or "")
    except WorkspaceError:
        return None
    found = host_dir(product)
    return (product, found) if found else None
