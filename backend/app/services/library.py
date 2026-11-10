from __future__ import annotations

import difflib
import hashlib
import importlib
import io
import json
import os
import re
import stat
import tempfile
import time
import zipfile
from pathlib import Path, PurePosixPath

from app.services import paths
from app.services.bus import bus
from app.services.package import packages
from app.services.registry import registry
from app.services.validate import validate_folder
from app.services.workspace import NotFound, WorkspaceError, safe_join, workspace

paths.use_contract()
formpkg = importlib.import_module("formpkg")

MAX_BYTES = formpkg.MAX_BYTES
MAX_FILES = formpkg.MAX_FILES
MAX_FILE_UNPACKED = 50 * 1024 * 1024
MAX_UNPACKED = 200 * 1024 * 1024
MAX_RATIO = 200
TEXT_TYPES = {".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt", ".md", ".cube"}
DIFF_LINES = 4000
IMPORT_RECORD = "import.json"
WORKING = "current"

PERMISSION_WORDS = {
    "document": "Read and change the open document",
    "files-read": "Open files you choose",
    "files-write": "Save files where you choose",
    "network": "Reach the internet",
    "models": "Use local models",
    "native-code": "Run native code",
}

SHA_RE = re.compile(r"^[0-9a-f]{64}\Z")


class Refused(WorkspaceError):
    status = 422

    def __init__(self, message: str, report: dict | None = None) -> None:
        super().__init__(message)
        self.report = report


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else (many or one + 's')}"


def _entry_problem(info: zipfile.ZipInfo) -> str | None:
    name = info.filename
    if not name or "\x00" in name:
        return "the entry has no usable name"
    if "\\" in name:
        return "the path uses a backslash; package paths use /"
    if name.startswith("/") or re.match(r"^[A-Za-z]:", name):
        return "absolute paths are not allowed"
    parts = PurePosixPath(name.rstrip("/")).parts
    if any(p == ".." for p in parts):
        return "the path climbs out of the package (it has a .. segment)"
    if any(p in ("", ".") for p in name.rstrip("/").split("/")):
        return "the path has an empty or . segment"
    mode = (info.external_attr >> 16) & 0xFFFF
    if info.create_system == 3 and stat.S_ISLNK(mode):
        return "symlinks are not allowed"
    if info.flag_bits & 0x1:
        return "the entry is encrypted"
    if info.is_dir():
        return None
    if len(name) > 200:
        return "the path is longer than 200 characters"
    if PurePosixPath(name).suffix.lower() not in formpkg.TYPES:
        return f"the file type {PurePosixPath(name).suffix or '(none)'} is not allowed"
    if info.file_size > MAX_FILE_UNPACKED:
        return f"the file unpacks to {info.file_size} bytes; form.ext takes at most {MAX_FILE_UNPACKED}"
    if info.compress_size and info.file_size / info.compress_size > MAX_RATIO and info.file_size > 1024 * 1024:
        return "the file is packed suspiciously tightly (a zip bomb?)"
    return None


def _determinism(infos: list[zipfile.ZipInfo]) -> dict:
    names = [i.filename for i in infos if not i.is_dir()]
    notes = []
    if names != sorted(names):
        notes.append("entries are not sorted by path")
    if any(i.date_time != (1980, 1, 1, 0, 0, 0) for i in infos):
        notes.append("timestamps are not 1980-01-01 00:00:00")
    if any(((i.external_attr >> 16) & 0o777) not in (0, 0o644) for i in infos if not i.is_dir()):
        notes.append("file modes are not 0644")
    if any(i.compress_type != zipfile.ZIP_DEFLATED for i in infos if not i.is_dir()):
        notes.append("not every entry is deflated")
    if any(i.is_dir() for i in infos):
        notes.append("the zip holds folder entries")
    return {"kit_layout": not notes, "notes": notes}


def _summary(manifest: dict) -> dict:
    contributes = manifest.get("contributes") if isinstance(manifest.get("contributes"), dict) else {}
    entry = manifest.get("entry") if isinstance(manifest.get("entry"), dict) else {}
    perms = manifest.get("permissions") if isinstance(manifest.get("permissions"), list) else []
    return {
        "id": manifest.get("id"),
        "name": manifest.get("name"),
        "product": manifest.get("product"),
        "kind": manifest.get("kind"),
        "version": manifest.get("version"),
        "author": manifest.get("author"),
        "licence": manifest.get("licence"),
        "api": manifest.get("api"),
        "native": manifest.get("native"),
        "minimum_app": manifest.get("minimum_app"),
        "description": manifest.get("description") or "",
        "homepage": manifest.get("homepage") or "",
        "entry": entry.get("ui") if isinstance(entry.get("ui"), str) else None,
        "panels": [p for p in contributes.get("panels") or [] if isinstance(p, dict)],
        "commands": [c for c in contributes.get("commands") or [] if isinstance(c, dict)],
        "permissions": [{"id": str(p), "words": PERMISSION_WORDS.get(str(p), "a permission API 1 does not know")} for p in perms],
    }


def _write_tree(root: Path, files: dict[str, bytes]) -> None:
    for rel, data in files.items():
        target = safe_join(root, rel)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)


def _rebuild(folder: Path) -> dict:
    with tempfile.TemporaryDirectory(prefix="formext-rebuild-") as tmp:
        try:
            _target, digest, size, _m = formpkg.build(folder, Path(tmp))
        except SystemExit as e:
            return {"ok": False, "sha256": None, "bytes": None, "reason": str(e.code or "refused").replace("refused:\n  ", "").replace("\n  ", "; ")}
    return {"ok": True, "sha256": digest, "bytes": size, "reason": ""}


def _known(digest: str) -> list[dict]:
    out = []
    try:
        root = paths.builds_dir()
        for project in root.iterdir():
            if (project / digest / "build.json").is_file():
                out.append({"kind": "build", "project": project.name})
    except OSError:
        pass
    for p in workspace.projects():
        rec = _import_record(p["id"])
        if rec and rec.get("sha256") == digest:
            out.append({"kind": "import", "project": p["id"], "name": p["name"]})
    return out


def _import_record(pid: str) -> dict | None:
    try:
        data = json.loads(workspace.read(pid, IMPORT_RECORD).decode("utf-8"))
        return data if isinstance(data, dict) else None
    except (WorkspaceError, ValueError, UnicodeDecodeError):
        return None


def read_package(data: bytes) -> tuple[dict, dict[str, bytes]]:
    errors: list[dict] = []
    warnings: list[dict] = []
    files: dict[str, bytes] = {}
    listing: list[dict] = []
    digest = _sha(data)
    head = {"sha256": digest, "bytes": len(data)}
    if len(data) > MAX_BYTES:
        errors.append({"file": "", "message": f"the package is {len(data)} bytes; at most {MAX_BYTES} (20 MB)"})
        return {**head, "errors": errors, "warnings": warnings, "files": [], "manifest": None}, {}
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
        infos = z.infolist()
    except (zipfile.BadZipFile, ValueError, OSError) as e:
        errors.append({"file": "", "message": f"this is not a zip file ({e})"})
        return {**head, "errors": errors, "warnings": warnings, "files": [], "manifest": None}, {}
    with z:
        seen: dict[str, str] = {}
        real = [i for i in infos if not i.is_dir()]
        if len(real) > MAX_FILES:
            errors.append({"file": "", "message": f"{len(real)} files; at most {MAX_FILES}"})
        total = 0
        for info in infos:
            name = info.filename
            problem = _entry_problem(info)
            row = {"path": name, "size": info.file_size, "packed": info.compress_size, "sha256": None, "type": PurePosixPath(name).suffix.lower(), "text": PurePosixPath(name).suffix.lower() in TEXT_TYPES, "ok": problem is None}
            if info.is_dir() and not problem:
                continue
            if problem:
                row["problem"] = problem
                errors.append({"file": name, "message": problem})
                listing.append(row)
                continue
            folded = name.lower()
            if folded in seen:
                row["ok"] = False
                row["problem"] = "the same path appears twice (or differs only in letter case)"
                errors.append({"file": name, "message": row["problem"]})
                listing.append(row)
                continue
            seen[folded] = name
            total += info.file_size
            if total > MAX_UNPACKED:
                errors.append({"file": name, "message": f"the package unpacks to more than {MAX_UNPACKED // (1024 * 1024)} MB"})
                break
            try:
                with z.open(info) as fh:
                    body = fh.read(MAX_FILE_UNPACKED + 1)
            except (zipfile.BadZipFile, OSError, RuntimeError, NotImplementedError, EOFError) as e:
                row["ok"] = False
                row["problem"] = f"the entry cannot be read ({e})"
                errors.append({"file": name, "message": row["problem"]})
                listing.append(row)
                continue
            if len(body) != info.file_size:
                row["ok"] = False
                row["problem"] = "the entry's real size differs from what the zip says"
                errors.append({"file": name, "message": row["problem"]})
                listing.append(row)
                continue
            row["sha256"] = _sha(body)
            files[name] = body
            listing.append(row)
        layout = _determinism(infos)
    listing.sort(key=lambda r: r["path"])
    manifest = None
    if "manifest.json" not in files:
        nested = [n for n in files if n.endswith("/manifest.json")]
        hint = f" (found {nested[0]}; the manifest must be at the root, with no enclosing folder)" if nested else ""
        errors.append({"file": "manifest.json", "message": "there is no manifest.json at the root of the package" + hint})
    else:
        try:
            parsed = json.loads(files["manifest.json"].decode("utf-8"))
            if isinstance(parsed, dict):
                manifest = parsed
            else:
                errors.append({"file": "manifest.json", "message": "manifest.json must hold one JSON object"})
        except (ValueError, UnicodeDecodeError) as e:
            errors.append({"file": "manifest.json", "message": f"manifest.json is not valid JSON ({e})"})
    if not layout["kit_layout"]:
        warnings.append({"file": "", "message": "not laid out as the kit's formpkg build writes it: " + "; ".join(layout["notes"]) + ". It still installs; the SHA-256 will differ from a rebuild."})
    report = {**head, "errors": errors, "warnings": warnings, "files": listing, "manifest": manifest, "layout": layout}
    return report, files


def inspect_bytes(data: bytes, name: str = "") -> dict:
    started = time.time()
    report, files = read_package(data)
    report["name"] = os.path.basename(name or "") or None
    report["summary"] = _summary(report["manifest"]) if report["manifest"] else None
    report["check"] = None
    report["rebuild"] = None
    if files and report["manifest"] is not None:
        with tempfile.TemporaryDirectory(prefix="formext-inspect-") as tmp:
            folder = Path(tmp) / "package"
            folder.mkdir()
            unpacked = True
            try:
                _write_tree(folder, files)
            except WorkspaceError as e:
                report["errors"].append({"file": "", "message": f"the package cannot be unpacked safely ({e.message})"})
                unpacked = False
            if unpacked:
                kit, _m = _kit_problems(folder)
                seen = {e["message"] for e in report["errors"]}
                for msg in kit:
                    file, _, text = msg.partition(": ")
                    if text and f"{text}" not in seen:
                        report["errors"].append({"file": file, "message": text, "kit": True})
                check = validate_folder(folder)
                report["check"] = {"ok": check["ok"], "counts": check["counts"], "problems": check["problems"]}
                report["rebuild"] = _rebuild(folder)
                if report["rebuild"]["ok"]:
                    report["rebuild"]["same"] = report["rebuild"]["sha256"] == report["sha256"]
    report["known"] = _known(report["sha256"])
    report["ok"] = not report["errors"]
    report["can_import"] = report["manifest"] is not None and not any(not e.get("kit") for e in report["errors"])
    report["kit_refuses"] = any(e.get("kit") for e in report["errors"])
    report["product"] = (report["manifest"] or {}).get("product")
    report["ms"] = round((time.time() - started) * 1000)
    return report


def _kit_problems(folder: Path) -> tuple[list[str], dict]:
    try:
        errs, m = formpkg.problems(folder)
    except (AttributeError, TypeError, KeyError) as e:
        return [f"manifest.json: the manifest is malformed ({e})"], {}
    errs += formpkg.files_of(folder)[1]
    return errs, m


def _read_path(path: str) -> tuple[bytes, str]:
    source = Path(os.path.expanduser(str(path or "").strip()))
    if not str(path or "").strip():
        raise WorkspaceError("give the path of a .formpkg file")
    if source.is_symlink():
        raise WorkspaceError("that path is a symbolic link; give the file itself")
    if not source.is_file():
        raise NotFound(f"no such file: {path}")
    size = source.stat().st_size
    if size > MAX_BYTES:
        raise Refused(f"the file is {size} bytes; a package is at most {MAX_BYTES} (20 MB)")
    return source.read_bytes(), source.name


def inspect_path(path: str) -> dict:
    data, name = _read_path(path)
    out = inspect_bytes(data, name)
    out["source"] = {"kind": "path", "path": str(Path(os.path.expanduser(path)).resolve())}
    return out


def inspect_build(pid: str, sha: str) -> dict:
    target = packages.file(pid, sha)
    out = inspect_bytes(target.read_bytes(), target.name)
    out["source"] = {"kind": "build", "project": pid, "sha256": sha}
    return out


def import_bytes(data: bytes, name: str = "", project_name: str | None = None, source: dict | None = None, anyway: bool = False) -> dict:
    report = inspect_bytes(data, name)
    if not report["can_import"]:
        blocking = [e for e in report["errors"] if not e.get("kit")]
        first = blocking[0]["message"] if blocking else "the package has no readable manifest.json"
        raise Refused(f"Not imported: the package is unsafe or unreadable ({first}{'' if len(blocking) < 2 else f', and {_plural(len(blocking) - 1, 'more problem')}'}).", report)
    if report["kit_refuses"] and not anyway:
        kit = [e for e in report["errors"] if e.get("kit")]
        raise Refused(f"The kit refuses this package ({_plural(len(kit), 'problem')}, first: {kit[0]['message']}). Import it anyway to fix it in form.ext.", report)
    _rep, files = read_package(data)
    manifest = report["manifest"]
    product = manifest.get("product")
    title = (project_name or "").strip() or str(manifest.get("name") or manifest.get("id") or "Imported extension")
    record = {
        "format": "formext-import",
        "format_version": 1,
        "sha256": report["sha256"],
        "bytes": report["bytes"],
        "file": report.get("name"),
        "id": manifest.get("id"),
        "version": manifest.get("version"),
        "imported_at": time.time(),
        "source": source or {"kind": "upload"},
    }
    tree = {f"package/{rel}": body for rel, body in files.items()}
    tree[IMPORT_RECORD] = (json.dumps(record, indent=2) + "\n").encode("utf-8")
    project = workspace.create(title, product, tree)
    bus.emit("library.imported", {"id": project["id"], "sha256": report["sha256"], "package": manifest.get("id"), "version": manifest.get("version")})
    return {"project": project, "report": report, "record": record}


def import_path(path: str, project_name: str | None = None, anyway: bool = False) -> dict:
    data, name = _read_path(path)
    return import_bytes(data, name, project_name, {"kind": "path", "path": str(Path(os.path.expanduser(path)).resolve())}, anyway)


def import_build(pid: str, sha: str, project_name: str | None = None, anyway: bool = False) -> dict:
    target = packages.file(pid, sha)
    return import_bytes(target.read_bytes(), target.name, project_name, {"kind": "build", "project": pid, "sha256": sha}, anyway)


def _imported_by_sha() -> dict[str, list[str]]:
    imported: dict[str, list[str]] = {}
    for p in workspace.projects():
        rec = _import_record(p["id"])
        if rec and rec.get("sha256"):
            imported.setdefault(rec["sha256"], []).append(p["id"])
    return imported


def registry_shelf(refresh: bool = False) -> dict:
    return registry.shelf(refresh, _imported_by_sha())


def _registry_file(eid: str, entry: dict) -> str:
    return f"{eid}-{entry.get('version')}.formpkg"


def inspect_registry(eid: str) -> dict:
    body, entry, source = registry.package(eid)
    out = inspect_bytes(body, _registry_file(eid, entry))
    out["source"] = source
    return out


def import_registry(eid: str, project_name: str | None = None, anyway: bool = False) -> dict:
    body, entry, source = registry.package(eid)
    return import_bytes(body, _registry_file(eid, entry), project_name, source, anyway)


def _flatten(value, prefix: str = "") -> dict[str, object]:
    out: dict[str, object] = {}
    if isinstance(value, dict) and value:
        for k in sorted(value):
            out.update(_flatten(value[k], f"{prefix}.{k}" if prefix else str(k)))
    elif isinstance(value, list) and value and all(isinstance(v, dict) and "id" in v for v in value):
        for v in value:
            out.update(_flatten(v, f"{prefix}[{v.get('id')}]"))
    elif isinstance(value, list) and value and all(isinstance(v, (str, int, float, bool)) for v in value):
        out[prefix] = list(value)
    elif isinstance(value, list) and value:
        for i, v in enumerate(value):
            out.update(_flatten(v, f"{prefix}[{i}]"))
    else:
        out[prefix] = value
    return out


def _side_build(pid: str, sha: str) -> dict:
    record = packages.get(pid, sha)
    target = packages.file(pid, sha)
    with zipfile.ZipFile(target) as z:
        files = {i.filename: z.read(i.filename) for i in z.infolist() if not i.is_dir()}
    when = record.get("built_at")
    return {"kind": "build", "sha256": sha, "bytes": record.get("bytes"), "version": record.get("version"), "built_at": when, "label": f"{record.get('version')} build {sha[:10]}", "manifest": record.get("manifest") or {}, "files": files}


def _side_working(pid: str) -> dict:
    folder = workspace.package_dir(pid)
    found, _errs = formpkg.files_of(folder)
    files = {p.relative_to(folder).as_posix(): p.read_bytes() for p in found}
    try:
        manifest = json.loads(files.get("manifest.json", b"{}").decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        manifest = {}
    if not isinstance(manifest, dict):
        manifest = {}
    return {"kind": "working", "sha256": None, "bytes": sum(len(v) for v in files.values()), "version": manifest.get("version"), "built_at": None, "label": "the project's files now", "manifest": manifest, "files": files}


def _side(pid: str, ref: str) -> dict:
    if ref == WORKING:
        return _side_working(pid)
    if not isinstance(ref, str) or not SHA_RE.match(ref):
        raise NotFound("choose a build or the current files")
    return _side_build(pid, ref)


def _public_side(side: dict) -> dict:
    return {k: v for k, v in side.items() if k not in ("files", "manifest")}


def _line_counts(a: bytes, b: bytes) -> dict | None:
    try:
        left = a.decode("utf-8").splitlines()
        right = b.decode("utf-8").splitlines()
    except UnicodeDecodeError:
        return None
    added = removed = 0
    for line in difflib.unified_diff(left, right, lineterm="", n=0):
        if line.startswith("+++") or line.startswith("---"):
            continue
        if line.startswith("+"):
            added += 1
        elif line.startswith("-"):
            removed += 1
    return {"added": added, "removed": removed}


def compare(pid: str, a: str, b: str) -> dict:
    workspace.dir(pid)
    left, right = _side(pid, a), _side(pid, b)
    ma, mb = _flatten(left["manifest"]), _flatten(right["manifest"])
    manifest_changes = []
    for key in sorted(set(ma) | set(mb)):
        if key not in ma:
            manifest_changes.append({"path": key, "change": "added", "before": None, "after": mb[key]})
        elif key not in mb:
            manifest_changes.append({"path": key, "change": "removed", "before": ma[key], "after": None})
        elif ma[key] != mb[key]:
            manifest_changes.append({"path": key, "change": "changed", "before": ma[key], "after": mb[key]})
    pa = [p for p in left["manifest"].get("permissions") or [] if isinstance(p, str)]
    pb = [p for p in right["manifest"].get("permissions") or [] if isinstance(p, str)]
    perms = {
        "added": [{"id": p, "words": PERMISSION_WORDS.get(p, p)} for p in pb if p not in pa],
        "removed": [{"id": p, "words": PERMISSION_WORDS.get(p, p)} for p in pa if p not in pb],
        "kept": [{"id": p, "words": PERMISSION_WORDS.get(p, p)} for p in pb if p in pa],
    }
    files = []
    counts = {"added": 0, "removed": 0, "changed": 0, "same": 0}
    for path in sorted(set(left["files"]) | set(right["files"])):
        x, y = left["files"].get(path), right["files"].get(path)
        if x is None:
            change = "added"
        elif y is None:
            change = "removed"
        elif _sha(x) != _sha(y):
            change = "changed"
        else:
            change = "same"
        counts[change] += 1
        row = {"path": path, "change": change, "before": len(x) if x is not None else None, "after": len(y) if y is not None else None, "text": PurePosixPath(path).suffix.lower() in TEXT_TYPES}
        if change == "changed" and row["text"]:
            row["lines"] = _line_counts(x, y)
        elif change in ("added", "removed") and row["text"]:
            body = y if x is None else x
            try:
                n = len(body.decode("utf-8").splitlines())
                row["lines"] = {"added": n, "removed": 0} if x is None else {"added": 0, "removed": n}
            except UnicodeDecodeError:
                pass
        files.append(row)
    va, vb = left["manifest"].get("version"), right["manifest"].get("version")
    return {
        "project": pid,
        "a": _public_side(left),
        "b": _public_side(right),
        "identical": not manifest_changes and counts["added"] == counts["removed"] == counts["changed"] == 0,
        "version": {"before": va, "after": vb, "changed": va != vb},
        "permissions": perms,
        "consent_again": bool(perms["added"]) or va != vb,
        "manifest": manifest_changes,
        "files": files,
        "counts": counts,
    }


def compare_file(pid: str, a: str, b: str, rel: str, context: int = 3) -> dict:
    workspace.dir(pid)
    left, right = _side(pid, a), _side(pid, b)
    x, y = left["files"].get(rel), right["files"].get(rel)
    if x is None and y is None:
        raise NotFound(f"neither side has {rel}")
    if PurePosixPath(rel).suffix.lower() not in TEXT_TYPES:
        return {"path": rel, "text": False, "hunks": [], "before": len(x) if x is not None else None, "after": len(y) if y is not None else None}
    try:
        la = (x or b"").decode("utf-8").splitlines()
        lb = (y or b"").decode("utf-8").splitlines()
    except UnicodeDecodeError:
        return {"path": rel, "text": False, "hunks": [], "before": len(x or b""), "after": len(y or b"")}
    hunks = []
    total = 0
    truncated = False
    matcher = difflib.SequenceMatcher(None, la, lb, autojunk=False)
    for group in matcher.get_grouped_opcodes(max(0, min(int(context), 20))):
        first, last = group[0], group[-1]
        hunk = {"a_start": first[1] + 1, "a_lines": last[2] - first[1], "b_start": first[3] + 1, "b_lines": last[4] - first[3], "lines": []}
        for tag, i1, i2, j1, j2 in group:
            if tag == "equal":
                for k in range(i1, i2):
                    hunk["lines"].append({"t": " ", "a": k + 1, "b": j1 + (k - i1) + 1, "s": la[k]})
                continue
            if tag in ("replace", "delete"):
                for k in range(i1, i2):
                    hunk["lines"].append({"t": "-", "a": k + 1, "b": None, "s": la[k]})
            if tag in ("replace", "insert"):
                for k in range(j1, j2):
                    hunk["lines"].append({"t": "+", "a": None, "b": k + 1, "s": lb[k]})
        total += len(hunk["lines"])
        hunks.append(hunk)
        if total > DIFF_LINES:
            truncated = True
            break
    return {"path": rel, "text": True, "hunks": hunks, "truncated": truncated, "before": len(x) if x is not None else None, "after": len(y) if y is not None else None}
