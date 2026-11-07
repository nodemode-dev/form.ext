from __future__ import annotations

import json
import os
import shlex
import shutil
import time
from pathlib import Path

from app.services import paths, portal, registry, settings
from app.services.bus import bus
from app.services.keys import keys
from app.services.package import DEFAULT_URL, packages
from app.services.validate import schema_errors, validate_folder
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
        "registry": {
            "submission": registry_submission(pid),
            "folder": str(registry_root() / "extensions" / str(manifest.get("id", "id"))),
            "checkout": str(registry_checkout() or ""),
            "repo": registry.REPO,
        },
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


SKIP_ROOT = {"import.json", "dist", "build"}
SCREENSHOT_NAMES = ("docs/screenshot.png", "docs/screenshot.jpg", "docs/screenshot.webp", "screenshot.png", "screenshot.jpg", "screenshot.webp")


def registry_root() -> Path:
    return submissions_dir() / "registry"


def registry_checkout() -> Path | None:
    configured = settings.value("registry.checkout")
    if not isinstance(configured, str) or not configured.strip():
        return None
    return Path(configured.strip()).expanduser()


def _registry_readme(m: dict) -> str:
    perms = [p for p in m.get("permissions") or [] if isinstance(p, str)]
    app = portal.app_name(str(m.get("product") or ""))
    name = m.get("name") or m["id"]
    lines = [f"# {name}", "", m.get("description") or name, "", f"![{name} in {app}](docs/screenshot.png)", "", f"{name} is an extension for {app}, made with form.ext. It runs in {app}'s sandboxed extension panel under the Form Extension Contract (API 1), and FormPortal installs it from the Form Extension Registry once the owners merge it.", "", "## Permissions", ""]
    lines += [f"- `{p}`: {PLAIN.get(p, p)}. Why: say here what the extension does with it." for p in perms] or ["- None: it asks for no permission."]
    lines += ["", "## Using it", "", f"Open {app}, then the Extensions panel, and choose {name}.", ""]
    return "\n".join(lines)


def _registry_licence(m: dict) -> str:
    year = time.strftime("%Y")
    return f"SPDX-License-Identifier: {m.get('licence') or 'NOASSERTION'}\n\nCopyright {year} {m.get('author') or 'the author'}\n\nReplace this file with the full text of the {m.get('licence') or 'chosen'} licence before the pull request.\n"


def _registry_changelog(m: dict) -> str:
    return f"# Changelog\n\n## {m['version']}\n\n- {m.get('description') or 'First version.'}\n"


def _registry_tree(pid: str, manifest: dict) -> tuple[dict[str, Path], list[str]]:
    root = workspace.dir(pid)
    prefix = workspace.package_prefix(pid)
    files: dict[str, Path] = {}
    for row in workspace.list_files(pid):
        rel = row["path"]
        top = rel.split("/", 1)[0]
        if prefix and rel.startswith(prefix + "/"):
            files["package/" + rel[len(prefix) + 1:]] = root / rel
        elif not prefix:
            files["package/" + rel] = root / rel
        elif top not in SKIP_ROOT:
            files[rel] = root / rel
    made = []
    for name in ("README.md", "LICENSE", "CHANGELOG.md"):
        if not any(k == name or (name == "LICENSE" and k in ("LICENSE.md", "LICENSE.txt", "LICENCE")) for k in files):
            made.append(name)
    return files, made


def _commands(manifest: dict, folder: Path, update: bool) -> list[dict]:
    eid, version, name = manifest["id"], manifest["version"], manifest.get("name") or manifest["id"]
    branch = f"{'update' if update else 'add'}-{eid}-{version}"
    title = f"{'Update' if update else 'Add'} {name} {version}"
    body = f"{title}: {str(manifest.get('description') or name).rstrip('.')}. For {portal.app_name(str(manifest.get('product') or ''))}. Made and checked with form.ext."
    return [
        {"say": "Fork the registry and clone your fork (once).", "run": f"gh repo fork {registry.REPO} --clone --remote"},
        {"say": "Go into the clone and start a branch from the registry's main.", "run": "cd form.ext-registry && git fetch upstream && git switch -c " + shlex.quote(branch) + " upstream/main"},
        {"say": "Copy the extension folder in.", "run": f"rm -rf extensions/{eid} && mkdir -p extensions && cp -R {shlex.quote(str(folder))} extensions/{eid}"},
        {"say": "Run the registry's checks, as CI will.", "run": f"python3 tools/check.py extensions/{eid}"},
        {"say": "Commit it.", "run": f"git add extensions/{eid} && git commit -m {shlex.quote(('feat(' + eid + '): ' + ('version ' + version if update else 'add ' + name + ' ' + version)))}"},
        {"say": "Push the branch to your fork.", "run": f"git push -u origin {shlex.quote(branch)}"},
        {"say": "Open the pull request; @nodemode-ai and @gbarnai review it.", "run": f"gh pr create --repo {registry.REPO} --base main --title {shlex.quote(title)} --body {shlex.quote(body)}"},
    ]


def _own_checks(folder: Path, manifest: dict) -> dict:
    problems: list[dict] = []
    package_dir = folder / "package"
    check = validate_folder(package_dir)
    for p in check["problems"]:
        if p["severity"] == "error":
            problems.append({"level": "error", "where": f"package/{p['file']}" + (f":{p['line']}" if p.get("line") else ""), "message": p["message"]})
    if manifest.get("api") != "1":
        problems.append({"level": "error", "where": "package/manifest.json", "message": 'api must be "1"'})
    if manifest.get("native") is not False:
        problems.append({"level": "error", "where": "package/manifest.json", "message": "native must be false"})
    for name in ("README.md", "CHANGELOG.md"):
        if not (folder / name).is_file():
            problems.append({"level": "error", "where": name, "message": f"{name} is missing"})
    if not any((folder / n).is_file() for n in ("LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE")):
        problems.append({"level": "error", "where": "LICENSE", "message": "LICENSE is missing"})
    if not any((folder / n).is_file() for n in SCREENSHOT_NAMES):
        problems.append({"level": "error", "where": "docs/screenshot.png", "message": "a screenshot is missing: add docs/screenshot.png (the extension in its app)"})
    errors = [p for p in problems if p["level"] == "error"]
    lines = [f"form.ext Check on extensions/{manifest['id']}: {'passed' if not errors else f'{len(errors)} problem' + ('s' if len(errors) != 1 else '')}"]
    lines += [f"  {p['level']}: {p['where']}: {p['message']}" for p in problems]
    return {"by": "formext", "tool": "form.ext Check", "ok": not errors, "problems": problems, "report": "\n".join(lines), "note": "The registry's tools/check.py was not run: set registry.checkout to a local clone of nodemode-dev/form.ext-registry to run the same checks CI runs. form.ext ran its own Check, the kit's package rules and the metadata files instead."}


def _registry_checks(root: Path, folder: Path, manifest: dict) -> dict:
    checkout = registry_checkout()
    script = checkout / "tools" / "check.py" if checkout else None
    if not script or not script.is_file():
        out = _own_checks(folder, manifest)
        if checkout:
            out["note"] = f"No tools/check.py in {checkout}, so form.ext ran its own Check instead of the registry's."
        return out
    return _run_registry_check(checkout, script, root, folder, manifest)


def _run_registry_check(checkout: Path, script: Path, root: Path, folder: Path, manifest: dict) -> dict:
    import contextlib
    import importlib.util
    import io
    import sys
    from types import SimpleNamespace

    added = [str(checkout / "tools"), str(checkout / "contract" / "tools")]
    for p in added:
        if p not in sys.path:
            sys.path.insert(0, p)
    spec = importlib.util.spec_from_file_location("formext_registry_check", script)
    if spec is None or spec.loader is None:
        raise WorkspaceError(f"{script} cannot be imported")
    module = importlib.util.module_from_spec(spec)
    buf = io.StringIO()
    url = registry.index_url()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        try:
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
            probe = module.Result("published index")
            published = module.published_index(None if url == registry.DEFAULT_URL else url, probe)
            blocked, _ = module.registry.load_blocklist()
            args = SimpleNamespace(skip_npm=False)
            result = module.check_extension(folder, args, published, None, True, blocked)
        except (SystemExit, AttributeError, TypeError) as e:
            raise WorkspaceError(f"the registry's tools/check.py in {checkout} could not run on the folder ({e})") from None
    lines = [f"Form Extension Registry checks ({script})"] + [f"note: {n}" for n in probe.notes]
    lines += ["", f"{result.name}: {'FAILED' if result.errors else 'passed'}"]
    lines += [f"  ok    {p}" for p in result.passed] + [f"  error {e}" for e in result.errors] + [f"  note  {n}" for n in result.notes]
    noise = buf.getvalue().strip()
    if noise:
        lines += ["", noise]
    problems = [{"level": "error", "where": result.name, "message": e} for e in result.errors]
    return {"by": "registry", "tool": str(script), "ok": not result.errors, "problems": problems, "report": "\n".join(lines), "note": f"The registry's own tools/check.py from {checkout} ran on the folder (imported, nothing vendored), as CI runs it on a pull request."}


def submit(pid: str) -> dict:
    manifest = workspace.manifest(pid)
    eid = manifest.get("id")
    version = manifest.get("version")
    if not isinstance(eid, str) or not isinstance(version, str):
        raise WorkspaceError("the manifest needs an id and a version before it goes to the registry")
    files, made = _registry_tree(pid, manifest)
    root = registry_root()
    folder = root / "extensions" / eid
    staging = root / "extensions" / f".{eid}-{os.getpid()}"
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True)
    try:
        for rel, source in sorted(files.items()):
            target = staging / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        writers = {"README.md": _registry_readme, "LICENSE": _registry_licence, "CHANGELOG.md": _registry_changelog}
        for name in made:
            (staging / name).write_text(writers[name](manifest), encoding="utf-8")
        old = root / "extensions" / f".{eid}-old-{os.getpid()}"
        if folder.exists():
            os.replace(folder, old)
        os.replace(staging, folder)
        shutil.rmtree(old, ignore_errors=True)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    screenshot = next((n for n in SCREENSHOT_NAMES if (folder / n).is_file()), None)
    checks = _registry_checks(root, folder, manifest)
    try:
        listed = {e["id"]: e for e in registry.registry.shelf()["extensions"]}
    except WorkspaceError:
        listed = {}
    update = eid in listed
    record = {
        "format": "formext-registry-submission",
        "format_version": 1,
        "project": pid,
        "id": eid,
        "version": version,
        "folder": str(folder),
        "root": str(root),
        "files": sorted(p.relative_to(folder).as_posix() for p in folder.rglob("*") if p.is_file()),
        "made": made,
        "screenshot": screenshot,
        "screenshot_slot": "docs/screenshot.png",
        "checks": checks,
        "update": update,
        "published_version": listed.get(eid, {}).get("version"),
        "commands": _commands(manifest, folder, update),
        "prepared_at": time.time(),
    }
    (root / f"{eid}.submission.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    bus.emit("publish.registry", {"id": pid, "folder": str(folder), "ok": checks["ok"], "by": checks["by"]})
    return record


def registry_submission(pid: str) -> dict | None:
    try:
        eid = workspace.manifest(pid).get("id")
    except WorkspaceError:
        return None
    if not isinstance(eid, str):
        return None
    try:
        data = json.loads((registry_root() / f"{eid}.submission.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if data.get("project") == pid else None


def reveal_registry(pid: str) -> dict:
    sub = registry_submission(pid)
    if not sub:
        raise NotFound("submit to the registry first")
    portal.open_with_system(sub["folder"])
    return {"opened": sub["folder"]}
