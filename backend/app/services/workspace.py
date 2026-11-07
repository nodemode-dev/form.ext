import json
import os
import re
import shutil
import threading
import time
from pathlib import Path, PurePosixPath

from app.services import paths, settings
from app.services.bus import bus

PRODUCTS = ["formvis", "formcut", "formwav", "formpdf", "formdeck", "formlit", "formmd", "formencoder", "formvfx", "formmcp", "formtray", "formskills", "formportal"]
PACKAGE = "package"
MANIFEST = "manifest.json"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}$")
HIDDEN = {".git", ".formext", "node_modules", "__pycache__", ".DS_Store", "Thumbs.db", ".venv", "venv"}
MAX_FILE = 50 * 1024 * 1024
MAX_IMPORT_FILES = 5000


class WorkspaceError(Exception):
    status = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFound(WorkspaceError):
    status = 404


class Unsafe(WorkspaceError):
    status = 400


class Conflict(WorkspaceError):
    status = 409


def slug(text: str) -> str:
    out = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    out = out[:48].strip("-")
    if len(out) < 2:
        out = (out + "-extension").strip("-")
    return out


def clean_rel(rel: str) -> str:
    if not isinstance(rel, str) or not rel or "\x00" in rel:
        raise Unsafe("invalid path")
    text = rel.replace("\\", "/")
    if text.startswith("/") or re.match(r"^[A-Za-z]:", text):
        raise Unsafe("absolute paths are not allowed")
    parts = [p for p in PurePosixPath(text).parts if p not in ("", ".")]
    if not parts or any(p == ".." for p in parts):
        raise Unsafe("path leaves the project")
    if len("/".join(parts)) > 400:
        raise Unsafe("path is too long")
    return "/".join(parts)


def safe_join(root: Path, rel: str, must_exist: bool = False) -> Path:
    clean = clean_rel(rel)
    base = root.resolve()
    current = base
    for part in clean.split("/"):
        current = current / part
        if current.is_symlink():
            raise Unsafe("symbolic links are not followed")
    resolved = current.resolve()
    if resolved != base and base not in resolved.parents:
        raise Unsafe("path leaves the project")
    if must_exist and not current.exists():
        raise NotFound(f"no such file: {clean}")
    return current


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


class Workspace:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._own_writes: dict[str, float] = {}

    def _index(self) -> dict:
        data = _read_json(paths.index_file())
        if not isinstance(data, dict):
            data = {}
        data.setdefault("linked", {})
        data.setdefault("recent", [])
        data.setdefault("meta", {})
        return data

    def _save_index(self, data: dict) -> None:
        target = paths.index_file()
        tmp = target.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
        os.replace(tmp, target)

    def _linked(self) -> dict[str, str]:
        return dict(self._index().get("linked", {}))

    def _ids(self) -> list[str]:
        ids = [p.name for p in paths.projects_dir().iterdir() if p.is_dir() and not p.is_symlink() and ID_RE.match(p.name)]
        for pid, folder in self._linked().items():
            if pid not in ids and Path(folder).is_dir():
                ids.append(pid)
        return ids

    def _unique_id(self, base: str) -> str:
        taken = set(self._ids()) | set(self._linked())
        candidate = slug(base)
        n = 2
        while candidate in taken or (paths.projects_dir() / candidate).exists():
            candidate = f"{slug(base)[:44]}-{n}"
            n += 1
        return candidate

    def exists(self, pid: str) -> bool:
        try:
            self.dir(pid)
            return True
        except WorkspaceError:
            return False

    def dir(self, pid: str) -> Path:
        if not isinstance(pid, str) or not ID_RE.match(pid):
            raise NotFound("no such project")
        linked = self._linked().get(pid)
        if linked:
            folder = Path(linked)
            if folder.is_dir():
                return folder.resolve()
            raise NotFound(f"the folder of {pid} is gone: {linked}")
        folder = paths.projects_dir() / pid
        if folder.is_dir() and not folder.is_symlink():
            return folder.resolve()
        raise NotFound(f"no such project: {pid}")

    def package_prefix(self, pid: str) -> str:
        root = self.dir(pid)
        if (root / PACKAGE / MANIFEST).is_file() or not (root / MANIFEST).is_file():
            return PACKAGE
        return ""

    def package_dir(self, pid: str) -> Path:
        prefix = self.package_prefix(pid)
        root = self.dir(pid)
        return root / prefix if prefix else root

    def manifest(self, pid: str) -> dict:
        data = _read_json(self.package_dir(pid) / MANIFEST)
        return data if isinstance(data, dict) else {}

    def get(self, pid: str) -> dict:
        root = self.dir(pid)
        prefix = self.package_prefix(pid)
        manifest_path = (root / prefix / MANIFEST) if prefix else root / MANIFEST
        raw = None
        error = None
        if manifest_path.is_file():
            try:
                raw = json.loads(manifest_path.read_text(encoding="utf-8"))
                if not isinstance(raw, dict):
                    error = "manifest.json is not an object"
                    raw = None
            except ValueError as exc:
                error = f"manifest.json is not valid JSON: {exc}"
            except OSError as exc:
                error = str(exc)
        else:
            error = "manifest.json is missing"
        manifest = raw or {}
        index = self._index()
        meta = index["meta"].get(pid, {})
        linked = pid in index["linked"]
        try:
            modified = max((p.stat().st_mtime for p in self._walk(root)), default=root.stat().st_mtime)
        except OSError:
            modified = time.time()
        return {
            "id": pid,
            "name": manifest.get("name") or meta.get("name") or pid,
            "product": manifest.get("product") or meta.get("product") or "",
            "version": manifest.get("version") or "",
            "dir": str(root),
            "package_dir": str(root / prefix) if prefix else str(root),
            "package_prefix": prefix,
            "manifest": manifest,
            "manifest_error": error,
            "linked": linked,
            "created": meta.get("created"),
            "opened": meta.get("opened"),
            "modified": modified,
        }

    def projects(self) -> list[dict]:
        out = []
        for pid in self._ids():
            try:
                out.append(self.get(pid))
            except WorkspaceError:
                continue
        out.sort(key=lambda p: p.get("modified") or 0, reverse=True)
        return out

    def recent(self, limit: int = 12) -> list[dict]:
        out = []
        for pid in self._index()["recent"]:
            try:
                out.append(self.get(pid))
            except WorkspaceError:
                continue
            if len(out) >= limit:
                break
        return out

    def touch(self, pid: str) -> None:
        self.dir(pid)
        with self._lock:
            index = self._index()
            index["recent"] = [pid] + [r for r in index["recent"] if r != pid][:49]
            index["meta"].setdefault(pid, {})["opened"] = time.time()
            self._save_index(index)

    def _record(self, pid: str, name: str, product: str, linked: str | None = None) -> None:
        with self._lock:
            index = self._index()
            index["meta"][pid] = {"name": name, "product": product, "created": time.time(), "opened": time.time()}
            if linked:
                index["linked"][pid] = linked
            index["recent"] = [pid] + [r for r in index["recent"] if r != pid][:49]
            self._save_index(index)

    def _starter_manifest(self, pid: str, name: str, product: str) -> dict:
        return {
            "format": "formai-package",
            "format_version": 1,
            "id": pid,
            "name": name,
            "product": product,
            "kind": "script-plugin",
            "version": "0.1.0",
            "author": settings.value("author") or "me",
            "licence": settings.value("licence") or "Apache-2.0",
            "native": False,
            "permissions": [],
            "api": "1",
            "description": "",
        }

    def create(self, name: str, product: str, files: dict[str, bytes] | None = None) -> dict:
        name = (name or "").strip()
        if not name:
            raise WorkspaceError("a project needs a name")
        if product not in PRODUCTS:
            raise WorkspaceError(f"unknown product: {product}")
        files = dict(files or {})
        if files and not any(clean_rel(k).startswith(PACKAGE + "/") for k in files):
            files = {f"{PACKAGE}/{clean_rel(k)}": v for k, v in files.items()}
        with self._lock:
            pid = self._unique_id(name)
            root = paths.projects_dir() / pid
            staging = paths.projects_dir() / f".new-{pid}-{os.getpid()}"
            shutil.rmtree(staging, ignore_errors=True)
            staging.mkdir(parents=True)
            try:
                for rel, data in files.items():
                    target = safe_join(staging, rel)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data if isinstance(data, bytes) else str(data).encode("utf-8"))
                manifest_path = staging / PACKAGE / MANIFEST
                if not manifest_path.is_file():
                    manifest_path.parent.mkdir(parents=True, exist_ok=True)
                    manifest_path.write_text(json.dumps(self._starter_manifest(pid, name, product), indent=2) + "\n", encoding="utf-8")
                os.replace(staging, root)
            except Exception:
                shutil.rmtree(staging, ignore_errors=True)
                raise
            self._record(pid, name, product)
        project = self.get(pid)
        bus.emit("project.created", {"id": pid, "project": project})
        return project

    def import_folder(self, path: str, link: bool = False, name: str | None = None) -> dict:
        source = Path(os.path.expanduser(str(path or ""))).resolve()
        if not source.is_dir():
            raise NotFound(f"no such folder: {path}")
        if (source / PACKAGE / MANIFEST).is_file():
            package_root, layout = source / PACKAGE, "project"
        elif (source / MANIFEST).is_file():
            package_root, layout = source, "package"
        else:
            raise WorkspaceError("the folder has no manifest.json (at its root or in package/)")
        manifest = _read_json(package_root / MANIFEST)
        if not isinstance(manifest, dict):
            raise WorkspaceError("manifest.json is not valid JSON")
        title = name or manifest.get("name") or source.name
        product = manifest.get("product") or ""
        with self._lock:
            for pid, folder in self._linked().items():
                if link and Path(folder).resolve() == source:
                    self.touch(pid)
                    return self.get(pid)
            pid = self._unique_id(manifest.get("id") or title)
            if link:
                self._record(pid, title, product, linked=str(source))
                watcher.refresh()
            else:
                root = paths.projects_dir() / pid
                target = root if layout == "project" else root / PACKAGE
                count = 0
                for item in source.rglob("*"):
                    count += 1
                    if count > MAX_IMPORT_FILES:
                        raise WorkspaceError("the folder holds too many files to import")
                shutil.copytree(source, target, symlinks=True, ignore=shutil.ignore_patterns(*HIDDEN))
                for item in list(root.rglob("*")):
                    if item.is_symlink():
                        item.unlink()
                self._record(pid, title, product)
        project = self.get(pid)
        bus.emit("project.created", {"id": pid, "project": project})
        return project

    def remove(self, pid: str) -> dict:
        root = self.dir(pid)
        with self._lock:
            index = self._index()
            if pid in index["linked"]:
                index["linked"].pop(pid, None)
                result = {"id": pid, "removed": "link", "dir": str(root)}
                watcher.refresh()
            else:
                dest = paths.trash_dir() / f"{pid}-{int(time.time())}"
                shutil.move(str(root), str(dest))
                result = {"id": pid, "removed": "trash", "dir": str(dest)}
            index["meta"].pop(pid, None)
            index["recent"] = [r for r in index["recent"] if r != pid]
            self._save_index(index)
        bus.emit("project.deleted", {"id": pid})
        return result

    def _walk(self, root: Path):
        for current, dirs, names in os.walk(root, followlinks=False):
            dirs[:] = sorted(d for d in dirs if d not in HIDDEN and not os.path.islink(os.path.join(current, d)))
            for n in sorted(names):
                if n in HIDDEN:
                    continue
                p = Path(current) / n
                if p.is_symlink() or not p.is_file():
                    continue
                yield p

    def list_files(self, pid: str) -> list[dict]:
        root = self.dir(pid)
        prefix = self.package_prefix(pid)
        out = []
        for p in self._walk(root):
            rel = p.relative_to(root).as_posix()
            st = p.stat()
            in_package = (not prefix) or rel.startswith(prefix + "/")
            out.append({"path": rel, "size": st.st_size, "modified": st.st_mtime, "package": in_package})
        return out

    def path(self, pid: str, rel: str, must_exist: bool = False) -> Path:
        return safe_join(self.dir(pid), rel, must_exist=must_exist)

    def read(self, pid: str, rel: str) -> bytes:
        target = self.path(pid, rel, must_exist=True)
        if not target.is_file():
            raise NotFound(f"not a file: {clean_rel(rel)}")
        return target.read_bytes()

    def _changed(self, pid: str, rels: list[str], kind: str) -> None:
        now = time.time()
        root = str(self.dir(pid))
        for rel in rels:
            self._own_writes[os.path.join(root, *rel.split("/"))] = now
        prefix = self.package_prefix(pid)
        manifest_rel = f"{prefix}/{MANIFEST}" if prefix else MANIFEST
        data = {"id": pid, "paths": rels, "kind": kind, "source": "engine"}
        if manifest_rel in rels:
            data["manifest"] = self.manifest(pid)
        bus.emit("project.changed", data)

    def owns_change(self, full: str, window: float = 2.0) -> bool:
        at = self._own_writes.get(full)
        if at is None:
            return False
        if time.time() - at > window:
            self._own_writes.pop(full, None)
            return False
        return True

    def write(self, pid: str, rel: str, data: bytes) -> dict:
        clean = clean_rel(rel)
        if len(data) > MAX_FILE:
            raise WorkspaceError("the file is larger than 50 MB")
        target = self.path(pid, clean)
        if target.exists() and not target.is_file():
            raise Conflict(f"a folder is at {clean}")
        target.parent.mkdir(parents=True, exist_ok=True)
        self.path(pid, clean)
        tmp = target.with_name(f".{target.name}.formext-tmp")
        tmp.write_bytes(data)
        os.replace(tmp, target)
        self._changed(pid, [clean], "write")
        st = target.stat()
        return {"path": clean, "size": st.st_size, "modified": st.st_mtime}

    def delete(self, pid: str, rel: str) -> dict:
        clean = clean_rel(rel)
        target = self.path(pid, clean, must_exist=True)
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()
        self._changed(pid, [clean], "delete")
        return {"path": clean, "deleted": True}

    def move(self, pid: str, src: str, dst: str) -> dict:
        a, b = clean_rel(src), clean_rel(dst)
        source = self.path(pid, a, must_exist=True)
        target = self.path(pid, b)
        if target.exists():
            raise Conflict(f"{b} already exists")
        target.parent.mkdir(parents=True, exist_ok=True)
        os.replace(source, target)
        self._changed(pid, [a, b], "move")
        return {"from": a, "to": b}

    def watch_roots(self) -> dict[str, str]:
        roots = {str(paths.projects_dir().resolve()): ""}
        for pid, folder in self._linked().items():
            if Path(folder).is_dir():
                roots[str(Path(folder).resolve())] = pid
        return roots

    def owner_of(self, full: str) -> tuple[str, str] | None:
        target = Path(full)
        projects = paths.projects_dir().resolve()
        for pid, folder in self._linked().items():
            base = Path(folder).resolve()
            if target == base or base in target.parents:
                return pid, target.relative_to(base).as_posix()
        if projects in target.parents:
            rel = target.relative_to(projects).parts
            if rel and ID_RE.match(rel[0]) and len(rel) > 1:
                return rel[0], "/".join(rel[1:])
        return None


workspace = Workspace()


class Watcher:
    def __init__(self, ws: Workspace) -> None:
        self.ws = ws
        self._stop = threading.Event()
        self._restart = threading.Event()
        self._thread: threading.Thread | None = None
        self.roots: list[str] = []

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="formext-watch", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._restart.set()

    def refresh(self) -> None:
        self._restart.set()

    def _run(self) -> None:
        try:
            from watchfiles import watch
        except ImportError:
            return
        while not self._stop.is_set():
            self._restart.clear()
            self.roots = list(self.ws.watch_roots())
            stop = threading.Event()

            def relay() -> None:
                self._restart.wait()
                stop.set()

            threading.Thread(target=relay, daemon=True).start()
            try:
                for changes in watch(*self.roots, stop_event=stop, debounce=300, step=100, yield_on_timeout=False, raise_interrupt=False):
                    self._dispatch(changes)
            except Exception:
                if self._stop.wait(2):
                    return

    def _dispatch(self, changes) -> None:
        grouped: dict[str, set[str]] = {}
        for _change, full in changes:
            if self.ws.owns_change(full):
                continue
            owner = self.ws.owner_of(full)
            if not owner:
                continue
            pid, rel = owner
            parts = rel.split("/")
            if any(p in HIDDEN for p in parts) or parts[-1].endswith(".formext-tmp") or parts[0].startswith(".new-"):
                continue
            grouped.setdefault(pid, set()).add(rel)
        for pid, rels in grouped.items():
            try:
                prefix = self.ws.package_prefix(pid)
            except WorkspaceError:
                bus.emit("project.deleted", {"id": pid})
                continue
            data = {"id": pid, "paths": sorted(rels), "kind": "disk", "source": "disk"}
            manifest_rel = f"{prefix}/{MANIFEST}" if prefix else MANIFEST
            if manifest_rel in rels:
                data["manifest"] = self.ws.manifest(pid)
            bus.emit("project.changed", data)


watcher = Watcher(workspace)
