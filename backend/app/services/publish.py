from __future__ import annotations

import json
import os
import shutil
import time
from pathlib import Path

from app.services import paths, portal, settings
from app.services.bus import bus
from app.services.keys import keys
from app.services.package import DEFAULT_URL, packages
from app.services.validate import schema_errors
from app.services.workspace import NotFound, WorkspaceError, workspace

PLAIN = {
    "document": "read and change the open document",
    "files-read": "open files you choose",
    "files-write": "save files where you choose",
    "network": "reach the internet",
    "models": "use local models",
    "native-code": "run native code",
}
SITE = "https://formai.studio/extensions/"
EXT_PREFIX = "package.schema.json#/$defs/"


def _schema(name: str) -> dict:
    return json.loads((paths.contract_dir() / "schema" / name).read_text(encoding="utf-8"))


def _index_schema() -> dict:
    index = _schema("extensions.schema.json")
    package = _schema("package.schema.json")
    defs = index.setdefault("$defs", {})
    for key, value in (package.get("$defs") or {}).items():
        defs[f"pkg-{key}"] = value

    def local(node):
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith(EXT_PREFIX):
                node = {**node, "$ref": f"#/$defs/pkg-{ref[len(EXT_PREFIX):]}"}
            return {k: local(v) for k, v in node.items()}
        if isinstance(node, list):
            return [local(v) for v in node]
        return node

    return local(index)


def index_problems(index: dict) -> list[str]:
    schema = _index_schema()
    found = [message.replace("manifest", "index", 1) if message.startswith("manifest") else message for _path, message in schema_errors(schema, schema, index)]
    for i, entry in enumerate(index.get("packages") or []):
        if isinstance(entry, dict) and entry.get("native") is True and "signature" not in entry:
            found.append(f"packages[{i}].signature is required for a native package")
        sig = entry.get("signature") if isinstance(entry, dict) else None
        if isinstance(sig, dict) and not any(p.get("id") == sig.get("publisher") for p in index.get("publishers") or [] if isinstance(p, dict)):
            found.append(f"packages[{i}] is signed by {sig.get('publisher')}, which publishers does not list")
    return found


def submissions_dir() -> Path:
    return paths.sub("submissions")


def _folder(manifest: dict) -> Path:
    return submissions_dir() / f"{manifest['id']}-{manifest['version']}"


def _pick_key(kid: str) -> dict | None:
    listed = keys.list()
    if kid:
        return next((k for k in listed if k["id"] == kid), None) or keys.get(kid)
    preferred = str(settings.value("publisher") or "")
    return next((k for k in listed if k["id"] == preferred), None) or (listed[-1] if listed else None)


def _readme(entry: dict, publishers: list[dict], package_name: str) -> str:
    perms = entry.get("permissions") or []
    lines = [
        f"# {entry['name']} {entry['version']}",
        "",
        entry.get("description") or "",
        "",
        "A Form extension submitted to formai.studio, made with form.ext.",
        "",
        "| Field | Value |",
        "|---|---|",
        f"| Id | `{entry['id']}` |",
        f"| App | {portal.app_name(entry['product'])} (`{entry['product']}`) |",
        f"| Kind | `{entry['kind']}` |",
        f"| Version | {entry['version']} |",
        f"| Author | {entry['author']} |",
        f"| Licence | {entry['licence']} |",
        f"| Extension API | {entry.get('api', 'not stated')} |",
        f"| Minimum app version | {entry.get('minimum_app', 'any')} |",
        f"| Package | `{package_name}` |",
        f"| Size | {entry['bytes']} bytes |",
        f"| SHA-256 | `{entry['sha256']}` |",
        f"| Address in the index | {entry['url']} |",
        "",
        "## What it may do",
        "",
    ]
    lines += [f"- `{p}`: {PLAIN.get(p, p)}" for p in perms] or ["- Nothing beyond its own panel: it asks for no permission."]
    lines += ["", "## Signature", ""]
    sig = entry.get("signature")
    if sig:
        pub = next((p for p in publishers if p.get("id") == sig.get("publisher")), {})
        lines += [
            f"Signed with Ed25519 by `{sig['publisher']}` ({pub.get('name', sig['publisher'])}). The signature is over the package file's exact bytes.",
            "",
            f"Public key (base64): `{pub.get('public_key', '')}`",
        ]
    else:
        lines += ["Not signed. FormPortal installs it as a script extension; a publisher key in form.ext's Package pane signs the next submission."]
    lines += [
        "",
        "## Files in this folder",
        "",
        f"- `{package_name}`: the deterministic package; the same source always gives the same SHA-256.",
        "- `entry.json`: the package's entry for the `packages` list of `extensions.json`.",
        "- `extensions.json`: a one-package index (with its publisher when signed) that passes `extensions.schema.json`, for trying the entry with FormPortal or a local copy of the site.",
        "- `README.md`: this file.",
        "- `submission.json`: form.ext's own record of the submission (project, build, when it was prepared); the site does not need it.",
        "",
        "## Submitting",
        "",
        f"Send the folder to formai.studio ({SITE}). The site serves the package at the address above and adds `entry.json` to its extension index; FormPortal then lists it for {portal.app_name(entry['product'])} and checks the SHA-256{' and the signature' if sig else ''} before it installs it.",
        "",
    ]
    return "\n".join(lines)


def _latest_submission(pid: str) -> dict | None:
    manifest = workspace.manifest(pid)
    if not manifest.get("id") or not manifest.get("version"):
        return None
    folder = submissions_dir() / f"{manifest['id']}-{manifest['version']}"
    record = folder / "submission.json"
    if not record.is_file():
        return None
    try:
        data = json.loads(record.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    data["folder"] = str(folder)
    data["files"] = sorted(p.name for p in folder.iterdir() if p.is_file() and not p.name.startswith("."))
    data["stale"] = _source_changed(pid, data)
    return data


def _source_changed(pid: str, data: dict) -> bool:
    try:
        built = packages.list(pid)
    except WorkspaceError:
        return False
    latest = built[0]["sha256"] if built else None
    return bool(latest and latest != data.get("sha256"))


def status(pid: str) -> dict:
    project = workspace.get(pid)
    manifest = project["manifest"]
    default = DEFAULT_URL.format(id=manifest.get("id", "id"), version=manifest.get("version", "0.0.0"))
    return {
        "project": pid,
        "manifest": {k: manifest.get(k) for k in ("id", "name", "product", "version", "kind", "author", "licence", "permissions", "description", "minimum_app", "api", "native", "homepage", "support")},
        "default_url": default,
        "keys": keys.list(),
        "publisher": settings.value("publisher") or "",
        "submission": _latest_submission(pid),
        "submissions_dir": str(submissions_dir()),
    }


def prepare(pid: str, url: str = "", publisher: str = "", passphrase: str = "", sign: bool = True) -> dict:
    build = packages.build(pid)
    sha = build["sha256"]
    signed_by = ""
    key = _pick_key(publisher) if sign else None
    if key:
        already = any(s.get("publisher") == key["id"] for s in build.get("signatures") or [])
        if not already:
            packages.sign(pid, sha, key["id"], passphrase)
        signed_by = key["id"]
    made = packages.entry(pid, sha, url, signed_by)
    entry = made["entry"]
    publishers = made["publishers"]
    if not signed_by:
        entry.pop("signature", None)
        publishers = []
    manifest = packages.get(pid, sha)["manifest"]
    index = {
        "format": "formai-extensions",
        "format_version": 1,
        "name": f"{entry['name']} (submission)",
        "description": f"One package submitted from form.ext for {portal.app_name(entry['product'])}.",
        "publishers": publishers,
        "packages": [entry],
    }
    problems = index_problems(index)
    if problems:
        raise WorkspaceError("the index entry would not pass extensions.schema.json: " + "; ".join(problems))
    source = packages.file(pid, sha)
    folder = _folder(manifest)
    staging = submissions_dir() / f".{folder.name}-{os.getpid()}"
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True)
    try:
        shutil.copy2(source, staging / source.name)
        (staging / "entry.json").write_text(json.dumps(entry, indent=2) + "\n", encoding="utf-8")
        (staging / "extensions.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
        (staging / "README.md").write_text(_readme(entry, publishers, source.name), encoding="utf-8")
        record = {
            "format": "formext-submission",
            "format_version": 1,
            "project": pid,
            "id": entry["id"],
            "version": entry["version"],
            "product": entry["product"],
            "sha256": sha,
            "bytes": entry["bytes"],
            "package": source.name,
            "url": entry["url"],
            "url_default": made["url_default"],
            "signed_by": signed_by or None,
            "prepared_at": time.time(),
            "entry": entry,
            "publishers": publishers,
        }
        (staging / "submission.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        old = submissions_dir() / f".{folder.name}-old-{os.getpid()}"
        if folder.exists():
            os.replace(folder, old)
        os.replace(staging, folder)
        shutil.rmtree(old, ignore_errors=True)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    bus.emit("publish.ready", {"id": pid, "sha256": sha, "folder": str(folder), "signed_by": signed_by or None})
    out = _latest_submission(pid) or {**record, "folder": str(folder)}
    out["warnings"] = build.get("warnings", [])
    out["fresh"] = build.get("fresh", False)
    return out


def _submission_or_fail(pid: str) -> dict:
    sub = _latest_submission(pid)
    if not sub:
        raise NotFound("prepare a submission first")
    return sub


def send(pid: str) -> dict:
    sub = _submission_or_fail(pid)
    return portal.send(str(Path(sub["folder"]) / sub["package"]))


def reveal(pid: str) -> dict:
    sub = _submission_or_fail(pid)
    portal.open_with_system(sub["folder"])
    return {"opened": sub["folder"]}
