import json
from pathlib import Path

from app.services import paths, settings
from app.services.workspace import NotFound, WorkspaceError, safe_join, slug, workspace

HOSTS = [
    ("formvis", "FormVis", "formvis"),
    ("formcut", "FormCut", "formcut"),
    ("formwav", "FormWav", "formwav"),
    ("formpdf", "FormPDF", "formpdf"),
    ("formdeck", "FormDeck", "formdeck"),
    ("formlit", "FormLit", "formlit"),
    ("formmd", "Form.md", "form.md"),
    ("formencoder", "FormEncoder", "formencoder"),
    ("formvfx", "FormVFX", "formvfx"),
    ("formmcp", "FormMCP", "formMCP"),
    ("formtray", "FormTray", "formtray"),
    ("formskills", "FormSkills", "formskills"),
]
STARTERS = [
    ("panel", "Panel", "A panel that reads the open document, follows its events and changes it."),
    ("command", "Command", "A command that runs without a panel, changes the document in one step and finishes."),
    ("panel-commands", "Panel with commands", "A panel, a command that opens it, and a headless command that shares its code."),
]
META = "template.json"
SHARED = "_shared"
NAMED = (".html", ".htm", ".md")
MAX_NAME = 64


def root() -> Path:
    return paths.templates_dir()


def _names() -> dict[str, str]:
    return {pid: name for pid, name, _ in HOSTS}


def _folder(product: str, starter: str) -> Path:
    if product not in _names():
        raise NotFound(f"no templates for {product}")
    if starter not in {s for s, _, _ in STARTERS}:
        raise NotFound(f"no starter named {starter}")
    folder = root() / product / starter
    if not (folder / "manifest.json").is_file():
        raise NotFound(f"the {starter} starter for {product} is missing")
    return folder


def _read_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _files(folder: Path) -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    for item in sorted(folder.rglob("*")):
        if item.is_symlink() or not item.is_file():
            continue
        rel = item.relative_to(folder).as_posix()
        if rel == META or rel.startswith(".") or "/." in rel:
            continue
        out[rel] = item.read_bytes()
    shared = root() / SHARED
    if shared.is_dir():
        for item in sorted(shared.rglob("*")):
            if item.is_file() and not item.is_symlink():
                out[item.relative_to(shared).as_posix()] = item.read_bytes()
    return out


def _docs(product: str) -> str | None:
    page = paths.docs_dir() / "apps" / f"{product}.md"
    return f"docs/apps/{product}.md" if page.is_file() else None


def _summary(product: str, starter: str, title: str, blurb: str) -> dict:
    folder = _folder(product, starter)
    meta = _read_json(folder / META)
    manifest = _read_json(folder / "manifest.json")
    contributes = manifest.get("contributes") if isinstance(manifest.get("contributes"), dict) else {}
    return {
        "product": product,
        "starter": starter,
        "title": meta.get("title") or title,
        "name": meta.get("name") or manifest.get("name") or "",
        "summary": meta.get("summary") or blurb,
        "uses": meta.get("uses") or [],
        "description": manifest.get("description", ""),
        "permissions": manifest.get("permissions", []),
        "panels": contributes.get("panels", []),
        "commands": contributes.get("commands", []),
        "id": manifest.get("id", ""),
    }


def catalogue() -> dict:
    products = []
    for pid, name, repo in HOSTS:
        starters = []
        for sid, title, blurb in STARTERS:
            try:
                starters.append(_summary(pid, sid, title, blurb))
            except WorkspaceError:
                continue
        products.append({"id": pid, "name": name, "repo": repo, "docs": _docs(pid), "starters": starters})
    return {
        "starters": [{"id": s, "title": t, "summary": b} for s, t, b in STARTERS],
        "products": products,
        "examples": examples(),
    }


def detail(product: str, starter: str) -> dict:
    title, blurb = next(((t, b) for s, t, b in STARTERS if s == starter), ("", ""))
    info = _summary(product, starter, title, blurb)
    files = []
    for rel, data in _files(_folder(product, starter)).items():
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            text = None
        files.append({"path": rel, "size": len(data), "text": text})
    info["files"] = files
    info["product_name"] = _names()[product]
    info["docs"] = _docs(product)
    return info


def _clean_name(name: str) -> str:
    name = " ".join(str(name or "").split())
    if not name:
        raise WorkspaceError("a project needs a name")
    if len(name) > MAX_NAME:
        raise WorkspaceError(f"the name is longer than {MAX_NAME} characters")
    return name


def _readme(product: str, starter: str, name: str, info: dict) -> str:
    lines = [
        f"# {name}",
        "",
        info.get("description") or info.get("summary", ""),
        "",
        f"Made with form.ext from the {info['title'].lower()} starter for {_names()[product]}.",
        "",
        "## Files",
        "",
        "- `package/` is the extension itself, what `.formpkg` holds: `manifest.json` and `ui/`.",
        "- `package/ui/app.js` is the extension's code; `formext.js` is the contract's client and `kit.js` small helpers.",
        "",
        "## What it uses",
        "",
    ]
    lines += [f"- `{u}`" for u in info.get("uses", [])]
    lines += [
        "",
        "## Next",
        "",
        "Open Preview to run it against a simulated app, Check before you package, and Run in App to load it in the real app.",
        f"The {_names()[product]} extension API is in Docs.",
        "",
    ]
    return "\n".join(lines)


def render(product: str, starter: str, name: str, pid: str, description: str | None = None) -> dict[str, bytes]:
    folder = _folder(product, starter)
    meta = _read_json(folder / META)
    info = _summary(product, starter, meta.get("title", ""), "")
    original = info["name"]
    files = _files(folder)
    manifest = json.loads(files["manifest.json"].decode("utf-8"))
    manifest["id"] = pid
    manifest["name"] = name
    manifest["author"] = settings.value("author") or manifest.get("author") or "me"
    manifest["licence"] = settings.value("licence") or manifest.get("licence") or "Apache-2.0"
    if description:
        manifest["description"] = description.strip()[:400]
    contributes = manifest.get("contributes") or {}
    for key in ("panels", "commands"):
        for item in contributes.get(key, []):
            if isinstance(item, dict) and item.get("title") == original:
                item["title"] = name
    out: dict[str, bytes] = {}
    for rel, data in files.items():
        if rel == "manifest.json":
            data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
        elif original and rel.lower().endswith(NAMED):
            data = data.decode("utf-8").replace(original, name).encode("utf-8")
        out[f"package/{rel}"] = data
    if description:
        info["description"] = description
    out["README.md"] = _readme(product, starter, name, info).encode("utf-8")
    return out


def create(product: str, starter: str, name: str, description: str | None = None) -> dict:
    name = _clean_name(name)
    _folder(product, starter)
    guess = slug(name)
    taken = workspace.exists(guess)
    files = render(product, starter, name, guess, description)
    project = workspace.create(name, product, files)
    pid = project["id"]
    if taken or pid != guess:
        rel = f"{project.get('package_prefix') or 'package'}/manifest.json"
        manifest = json.loads(workspace.read(pid, rel).decode("utf-8"))
        manifest["id"] = pid
        workspace.write(pid, rel, (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
        project = workspace.get(pid)
    project["template"] = {"product": product, "starter": starter}
    return project


def _examples_dir() -> Path:
    return paths.contract_dir() / "examples"


def examples() -> list[dict]:
    out = []
    base = _examples_dir()
    if not base.is_dir():
        return out
    for folder in sorted(p for p in base.iterdir() if p.is_dir()):
        manifest = _read_json(folder / "manifest.json")
        if not manifest:
            continue
        out.append({
            "id": folder.name,
            "name": manifest.get("name") or folder.name,
            "product": manifest.get("product", ""),
            "description": manifest.get("description", ""),
            "permissions": manifest.get("permissions", []),
        })
    return out


def create_example(example: str, name: str | None = None) -> dict:
    base = _examples_dir()
    folder = safe_join(base, example)
    if not (folder / "manifest.json").is_file():
        raise NotFound(f"no example named {example}")
    manifest = _read_json(folder / "manifest.json")
    title = _clean_name(name or manifest.get("name") or example)
    files: dict[str, bytes] = {}
    for item in sorted(folder.rglob("*")):
        if item.is_file() and not item.is_symlink():
            files[f"package/{item.relative_to(folder).as_posix()}"] = item.read_bytes()
    guess = slug(title)
    manifest["id"] = guess
    manifest["name"] = title
    files["package/manifest.json"] = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    project = workspace.create(title, manifest.get("product") or "formvis", files)
    if project["id"] != guess:
        manifest["id"] = project["id"]
        workspace.write(project["id"], "package/manifest.json", (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
        project = workspace.get(project["id"])
    project["example"] = example
    return project
