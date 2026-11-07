from __future__ import annotations

import importlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from app.services import paths, settings
from app.services.bus import bus
from app.services.workspace import NotFound, WorkspaceError, workspace

paths.use_contract()
formext_host = importlib.import_module("formext_host")

APPS: list[tuple[str, str]] = [
    ("formvis", "FormVis"),
    ("formcut", "FormCut"),
    ("formwav", "FormWav"),
    ("formpdf", "FormPDF"),
    ("formdeck", "FormDeck"),
    ("formlit", "FormLit"),
    ("formmd", "Form.md"),
    ("formencoder", "FormEncoder"),
    ("formvfx", "FormVFX"),
    ("formmcp", "FormMCP"),
    ("formtray", "FormTray"),
    ("formskills", "FormSkills"),
    ("formportal", "FormPortal"),
]
NAMES = dict(APPS)
CHANNELS = ("stable", "beta", "nightly")
DEV_FORMAT = "formext-dev-extensions"
ENABLED_FORMAT = "formportal-enabled-extensions"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}$")
CLI_TIMEOUT = 90


class PortalError(WorkspaceError):
    status = 422


def app_name(product: str) -> str:
    return NAMES.get(product, product)


def _product(product: str) -> str:
    if product not in NAMES:
        raise NotFound(f"unknown product: {product}")
    return product


def root() -> dict:
    env = os.environ.get("FORMPORTAL_ROOT", "").strip()
    chosen = str(settings.value("formportal_root") or "").strip()
    if env:
        folder, source = Path(env), "FORMPORTAL_ROOT"
    elif chosen:
        folder, source = Path(os.path.expanduser(chosen)), "settings"
    else:
        folder, source = formext_host.portal_root(), "default"
    return {"path": str(folder), "source": source, "exists": folder.is_dir()}


def root_dir() -> Path:
    return Path(root()["path"])


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, ValueError):
        return False


def _mtime(path: Path) -> float | None:
    try:
        return path.stat().st_mtime
    except OSError:
        return None


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.formext-tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def _executable(path: Path) -> bool:
    return path.is_file() and os.access(path, os.X_OK)


def _find_target(folder: Path, product: str, depth: int = 0) -> Path | None:
    try:
        entries = sorted(folder.iterdir())
    except OSError:
        return None
    if len(entries) == 1 and entries[0].is_dir() and entries[0].suffix != ".app" and depth < 8:
        return _find_target(entries[0], product, depth + 1)
    if sys.platform == "darwin":
        return next((p for p in entries if p.suffix == ".app"), None)
    if os.name == "nt":
        exes = [p for p in entries if p.suffix.lower() == ".exe"]
        return next((p for p in exes if product in p.stem.lower()), exes[0] if exes else None)
    return next((p for p in entries if p.suffix == ".AppImage"), None) or next((p for p in entries if _executable(p)), None)


def _deep_find(folder: Path, product: str, depth: int = 5) -> Path | None:
    found: list[Path] = []
    stack = [(folder, 0)]
    while stack:
        at, level = stack.pop()
        try:
            entries = list(at.iterdir())
        except OSError:
            continue
        for path in entries:
            if sys.platform == "darwin" and path.suffix == ".app":
                found.append(path)
                continue
            if path.is_dir():
                if level < depth:
                    stack.append((path, level + 1))
                continue
            runnable = path.suffix.lower() == ".exe" if os.name == "nt" else _executable(path)
            if runnable and "uninstall" not in path.name.lower():
                found.append(path)
    found.sort()
    stem = lambda p: p.stem.lower()
    return next((p for p in found if stem(p) == product), None) or next((p for p in found if product in stem(p)), None) or next((p for p in found if p.parent.name == "bin"), None)


def launch_target(install_path: str, product: str) -> Path | None:
    folder = Path(install_path)
    if not folder.exists():
        return None
    if folder.is_file():
        return folder
    return _find_target(folder, product) or _deep_find(folder, product)


def installs() -> dict:
    base = root_dir()
    state = _read_json(base / "installed.json")
    out: dict[str, list[dict]] = {}
    error = ""
    if state is False:
        error = "FormPortal's installed.json cannot be read"
    rows = state.get("installs") if isinstance(state, dict) else []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict) or not isinstance(row.get("current"), dict):
            continue
        product = str(row.get("product", ""))
        current = row["current"]
        path = str(current.get("path", ""))
        target = launch_target(path, product) if path else None
        previous = row.get("previous") if isinstance(row.get("previous"), dict) else None
        out.setdefault(product, []).append({
            "channel": str(row.get("channel", "stable")),
            "version": str(current.get("version", "")),
            "path": path,
            "installed_at": current.get("installed_at"),
            "present": bool(path) and Path(path).exists(),
            "target": str(target) if target else None,
            "previous": str(previous.get("version", "")) if previous else None,
        })
    for rows_of in out.values():
        rows_of.sort(key=lambda r: CHANNELS.index(r["channel"]) if r["channel"] in CHANNELS else 9)
    return {"installs": out, "error": error, "mtime": _mtime(base / "installed.json")}


def _ext_dir(product: str) -> Path:
    return root_dir() / "extensions" / _product(product)


def dev_file(product: str) -> Path:
    return _ext_dir(product) / "dev.json"


def _empty_dev(product: str) -> dict:
    return {"format": DEV_FORMAT, "format_version": 1, "product": product, "extensions": []}


def dev_problems(data, product: str) -> list[str]:
    errs: list[str] = []
    if not isinstance(data, dict):
        return ["dev.json is not an object"]
    for key in ("format", "format_version", "product", "extensions"):
        if key not in data:
            errs.append(f"{key} is required")
    if "format" in data and data.get("format") != DEV_FORMAT:
        errs.append(f'format must be "{DEV_FORMAT}"')
    if "format_version" in data and (type(data.get("format_version")) is not int or data.get("format_version") != 1):
        errs.append("format_version must be 1")
    if "product" in data and data.get("product") != product:
        errs.append(f'product must be "{product}"')
    rows = data.get("extensions")
    if "extensions" in data and not isinstance(rows, list):
        errs.append("extensions must be an array")
    for i, row in enumerate(rows if isinstance(rows, list) else []):
        if not isinstance(row, dict):
            errs.append(f"extensions[{i}] must be an object")
            continue
        if not isinstance(row.get("id"), str) or not ID_RE.match(row["id"]):
            errs.append(f"extensions[{i}].id must match ^[a-z0-9][a-z0-9-]{{1,63}}$")
        if not isinstance(row.get("path"), str) or not row["path"]:
            errs.append(f"extensions[{i}].path must be a non-empty string")
        if "added" in row and not isinstance(row["added"], str):
            errs.append(f"extensions[{i}].added must be a string")
    return errs


def read_dev(product: str) -> dict:
    target = dev_file(product)
    data = _read_json(target)
    out = {"product": product, "file": str(target), "exists": target.is_file(), "mtime": _mtime(target), "problems": [], "dev": _empty_dev(product)}
    if data is None:
        return out
    if data is False:
        out["problems"] = ["dev.json is not valid JSON"]
        return out
    out["problems"] = dev_problems(data, product)
    if isinstance(data, dict):
        rows = [r for r in data.get("extensions") or [] if isinstance(r, dict)] if isinstance(data.get("extensions"), list) else []
        out["dev"] = {**data, "extensions": rows}
    return out


def write_dev(product: str, data: dict) -> dict:
    product = _product(product)
    errs = dev_problems(data, product)
    if errs:
        raise PortalError("dev.json would not follow the contract: " + "; ".join(errs))
    clean = {"format": DEV_FORMAT, "format_version": 1, "product": product, "extensions": []}
    seen: set[str] = set()
    for row in data["extensions"]:
        if row["id"] in seen:
            raise PortalError(f"dev.json lists {row['id']} twice")
        seen.add(row["id"])
        item = {"id": row["id"], "path": row["path"]}
        if "added" in row:
            item["added"] = row["added"]
        clean["extensions"].append(item)
    _write_json(dev_file(product), clean)
    bus.emit("runapp.changed", {"product": product, "kind": "dev"})
    return read_dev(product)


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def dev_add(product: str, ext_id: str, path: str) -> dict:
    product = _product(product)
    if not ID_RE.match(ext_id or ""):
        raise PortalError("the extension id must match ^[a-z0-9][a-z0-9-]{1,63}$ (set it in the manifest)")
    folder = Path(path).expanduser().resolve()
    if not (folder / "manifest.json").is_file():
        raise PortalError(f"{folder} has no manifest.json")
    current = read_dev(product)
    if current["problems"] and current["exists"]:
        raise PortalError(f"{current['file']} does not follow the contract ({'; '.join(current['problems'])}); fix or remove it first")
    rows = [r for r in current["dev"]["extensions"] if r.get("id") != ext_id]
    rows.append({"id": ext_id, "path": str(folder), "added": _now()})
    return write_dev(product, {**_empty_dev(product), "extensions": rows})


def dev_remove(product: str, ext_id: str) -> dict:
    product = _product(product)
    current = read_dev(product)
    rows = current["dev"]["extensions"]
    kept = [r for r in rows if r.get("id") != ext_id]
    if len(kept) == len(rows):
        raise NotFound(f"{ext_id} is not in {app_name(product)}'s dev.json")
    return write_dev(product, {**_empty_dev(product), "extensions": kept})


def reload(product: str) -> dict:
    current = read_dev(product)
    if not current["exists"]:
        raise NotFound(f"{app_name(product)} has no dev.json yet")
    if current["problems"]:
        raise PortalError("dev.json does not follow the contract: " + "; ".join(current["problems"]))
    return write_dev(product, current["dev"])


def _enabled(product: str) -> dict:
    target = _ext_dir(product) / "enabled.json"
    data = _read_json(target)
    rows = []
    if isinstance(data, dict) and data.get("format") == ENABLED_FORMAT and isinstance(data.get("extensions"), list):
        rows = [{"id": str(r.get("id", "")), "version": str(r.get("version", "")), "source": str(r.get("source", "catalogue")), "path": str(r.get("path", ""))} for r in data["extensions"] if isinstance(r, dict)]
    return {"file": str(target), "exists": target.is_file(), "mtime": _mtime(target), "extensions": rows, "readable": data is not False}


def _installed_extensions() -> dict[str, list[dict]]:
    data = _read_json(root_dir() / "extensions" / "installed.json")
    out: dict[str, list[dict]] = {}
    rows = data.get("extensions") if isinstance(data, dict) else []
    for r in rows if isinstance(rows, list) else []:
        if isinstance(r, dict):
            out.setdefault(str(r.get("product", "")), []).append({
                "id": str(r.get("id", "")),
                "name": str(r.get("name", "")),
                "version": str(r.get("version", "")),
                "source": str(r.get("source", "")),
                "enabled": bool(r.get("enabled")),
                "signed_by": r.get("signed_by"),
            })
    return out


def _projects_by_path() -> dict[str, dict]:
    out = {}
    for p in workspace.projects():
        try:
            out[str(Path(p["package_dir"]).resolve())] = {"id": p["id"], "name": p["name"]}
        except OSError:
            continue
    return out


def app_version(product: str, found: dict | None = None) -> str:
    rows = (found or installs())["installs"].get(product) or []
    return rows[0]["version"] if rows and rows[0]["version"] else ""


def host_view(product: str, ext_id: str, folder: Path, version: str = "") -> dict:
    ext = formext_host.Extension(id=ext_id, version="0.0.0", source="development", path=Path(folder))
    used = version or "999.0.0"
    formext_host.check(ext, product, used, app_name(product))
    return {"state": ext.state, "reason": ext.reason, "name": ext.name, "version": ext.version, "panels": ext.panels, "commands": ext.commands, "permissions": ext.permissions, "app_version": version or None}


def overview() -> dict:
    found = installs()
    owned = _installed_extensions()
    by_path = _projects_by_path()
    apps = []
    for product, name in APPS:
        dev = read_dev(product)
        version = app_version(product, found)
        dev_rows = []
        for row in dev["dev"]["extensions"]:
            path = str(row.get("path", ""))
            try:
                key = str(Path(path).resolve())
            except OSError:
                key = path
            view = host_view(product, str(row.get("id", "")), Path(path), version) if path else {"state": "refused", "reason": "no path"}
            dev_rows.append({"id": row.get("id"), "path": path, "added": row.get("added"), "project": by_path.get(key), "host": view})
        enabled = _enabled(product)
        apps.append({
            "product": product,
            "name": name,
            "installs": found["installs"].get(product, []),
            "version": version or None,
            "launchable": any(i["target"] for i in found["installs"].get(product, [])),
            "dev": {"file": dev["file"], "exists": dev["exists"], "mtime": dev["mtime"], "problems": dev["problems"], "extensions": dev_rows},
            "enabled": enabled,
            "extensions": owned.get(product, []),
        })
    return {"root": root(), "state_error": found["error"], "state_mtime": found["mtime"], "cli": cli_info(found), "apps": apps, "checked_at": time.time()}


def project_status(pid: str) -> dict:
    project = workspace.get(pid)
    product = project["product"]
    manifest = project["manifest"]
    ext_id = str(manifest.get("id") or "")
    folder = Path(project["package_dir"]).resolve()
    out = {"project": pid, "product": product, "id": ext_id, "package_dir": str(folder), "listed": False, "entry": None, "other_path": None, "host": None, "app": None}
    if product not in NAMES:
        return out
    found = installs()
    dev = read_dev(product)
    for row in dev["dev"]["extensions"]:
        if row.get("id") == ext_id:
            same = str(Path(str(row.get("path", ""))).expanduser().resolve()) == str(folder)
            out["listed"] = same
            out["entry"] = row
            if not same:
                out["other_path"] = row.get("path")
    version = app_version(product, found)
    out["host"] = host_view(product, ext_id or "missing-id", folder, version)
    out["app"] = {"name": app_name(product), "version": version or None, "installs": found["installs"].get(product, []), "launchable": any(i["target"] for i in found["installs"].get(product, []))}
    out["dev"] = {"file": dev["file"], "exists": dev["exists"], "mtime": dev["mtime"], "problems": dev["problems"], "count": len(dev["dev"]["extensions"])}
    return out


def run_project(pid: str) -> dict:
    project = workspace.get(pid)
    product = project["product"]
    if product not in NAMES:
        raise PortalError("set the manifest's product to a Form app first")
    if project["manifest_error"]:
        raise PortalError(project["manifest_error"])
    dev_add(product, str(project["manifest"].get("id") or ""), project["package_dir"])
    status = project_status(pid)
    bus.emit("runapp.running", {"id": pid, "product": product, "state": status["host"]["state"] if status["host"] else None})
    return status


def stop_project(pid: str) -> dict:
    project = workspace.get(pid)
    dev_remove(project["product"], str(project["manifest"].get("id") or ""))
    return project_status(pid)


def _spawn(args: list[str], cwd: str | None = None) -> int:
    kwargs: dict = {"cwd": cwd, "stdin": subprocess.DEVNULL, "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if os.name == "nt":
        kwargs["creationflags"] = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    else:
        kwargs["start_new_session"] = True
    proc = subprocess.Popen(args, env=_child_env(), **kwargs)
    threading.Thread(target=proc.wait, daemon=True).start()
    return proc.pid


def _child_env() -> dict:
    env = dict(os.environ)
    env["FORMPORTAL_ROOT"] = str(root_dir())
    return env


def open_with_system(target: str) -> int:
    if sys.platform == "darwin":
        return _spawn(["open", target])
    if os.name == "nt":
        os.startfile(target)
        return 0
    opener = shutil.which("xdg-open") or shutil.which("gio")
    if not opener:
        raise PortalError("this computer has no xdg-open to open it with")
    return _spawn([opener, target] if opener.endswith("xdg-open") else [opener, "open", target])


def _launch(target: Path, extra: list[str] | None = None) -> int:
    if sys.platform == "darwin":
        return _spawn(["open", str(target)] + (["--args", *extra] if extra else []))
    return _spawn([str(target), *(extra or [])], cwd=str(target.parent))


def open_app(product: str, channel: str = "") -> dict:
    product = _product(product)
    rows = installs()["installs"].get(product, [])
    row = next((r for r in rows if r["channel"] == channel), None) if channel else next((r for r in rows if r["target"]), None)
    if not row:
        raise NotFound(f"FormPortal has not installed {app_name(product)}{f' ({channel})' if channel else ''} on this computer")
    if not row["target"]:
        raise PortalError(f"nothing to open in {row['path']}")
    pid = _launch(Path(row["target"]))
    bus.emit("runapp.opened", {"product": product, "channel": row["channel"], "pid": pid})
    return {"product": product, "channel": row["channel"], "opened": row["target"], "pid": pid}


def manage(product: str) -> dict:
    product = _product(product)
    url = f"formai://extensions?product={product}"
    open_with_system(url)
    return {"opened": url}


def cli_info(found: dict | None = None) -> dict:
    chosen = str(settings.value("formportal_cli") or os.environ.get("FORMPORTAL_CLI", "")).strip()
    if chosen:
        path = Path(os.path.expanduser(chosen))
        if _executable(path):
            command = [str(path)] if "cli" in path.name else [str(path), "cli"]
            return {"found": True, "command": command, "source": "settings" if settings.value("formportal_cli") else "FORMPORTAL_CLI"}
    direct = shutil.which("formportal-cli")
    if direct:
        return {"found": True, "command": [direct], "source": "PATH"}
    runner = shutil.which("formportal")
    if runner:
        return {"found": True, "command": [runner, "cli"], "source": "PATH"}
    for row in (found or installs())["installs"].get("formportal", []):
        if row["present"]:
            folder = Path(row["path"])
            names = ("formportal-cli.exe",) if os.name == "nt" else ("formportal-cli",)
            hits = [p for n in names for p in ([folder] if folder.is_file() else folder.rglob(n)) if p.name in names and _executable(p)]
            if hits:
                return {"found": True, "command": [str(sorted(hits)[0])], "source": "FormPortal install"}
    return {"found": False, "command": [], "source": ""}


def _portal_target(found: dict) -> Path | None:
    rows = found["installs"].get("formportal", [])
    row = next((r for r in rows if r["target"]), None)
    return Path(row["target"]) if row else None


def send(package: str) -> dict:
    target = Path(package).expanduser().resolve()
    if not target.is_file() or target.suffix.lower() != ".formpkg":
        raise NotFound(f"no .formpkg at {package}")
    found = installs()
    cli = cli_info(found)
    tried = ""
    if cli["found"]:
        args = [*cli["command"], "extension-install", "--path", str(target)]
        try:
            proc = subprocess.run(args, capture_output=True, text=True, timeout=CLI_TIMEOUT, env=_child_env(), stdin=subprocess.DEVNULL)
            text = (proc.stdout or "").strip()
            if proc.returncode == 0:
                try:
                    answer = json.loads(text)
                except ValueError:
                    answer = {"output": text}
                out = {"method": "cli", "command": " ".join(args), "package": str(target), "answer": answer, "installed": answer.get("installed") if isinstance(answer, dict) else None, "note": answer.get("note") if isinstance(answer, dict) else None}
                bus.emit("runapp.sent", {"package": str(target), "method": "cli"})
                return out
            reason = (proc.stderr or text or f"exit {proc.returncode}").strip().splitlines()
            tried = reason[-1] if reason else f"exit {proc.returncode}"
            if "refused" in tried.lower() or "signature" in tried.lower() or "policy" in tried.lower():
                raise PortalError(f"FormPortal refused the package: {tried}")
        except subprocess.TimeoutExpired:
            tried = f"the FormPortal command line gave no answer in {CLI_TIMEOUT} s"
        except OSError as exc:
            tried = str(exc)
    portal = _portal_target(found)
    if portal:
        pid = _launch(portal, [str(target)])
        method, opened = "app", str(portal)
    else:
        pid = open_with_system(str(target))
        method, opened = "system", "the system's handler for .formpkg"
    bus.emit("runapp.sent", {"package": str(target), "method": method})
    return {"method": method, "package": str(target), "opened": opened, "pid": pid, "cli_error": tried or None}
