"""The Form family as form.ext sees it: every app an extension can be made for, with its API page, starters, skills and source,
and the three neighbours an agent works with: formMCP (the hub that reaches every installed app's own tools), FormSkills (the
family's released skills, through formskills-cli) and FormPortal (installs the apps and their extensions)."""

import json
import os
import shutil
import subprocess
from pathlib import Path

from app.services import agents, paths, settings, sources
from app.services.workspace import NotFound, WorkspaceError, workspace

FORMSKILLS_IDS = {"formdeck": "formslide", "formportal": "formai"}
NO_SKILLS = {"formtray", "formskills", "registry"}
CLI_NAME = "formskills-cli"
CLI_TIMEOUT = 120


def formskills_cli() -> str | None:
    found = os.environ.get("FORMSKILLS_BIN") or shutil.which(CLI_NAME)
    if found and os.path.isfile(found):
        return found
    suffix = ".exe" if os.name == "nt" else ""
    home = Path.home()
    sibling = paths.repo_root().parent / "formskills" / "target" / "release" / (CLI_NAME + suffix)
    for p in (home / ".local" / "bin" / (CLI_NAME + suffix), home / ".cargo" / "bin" / (CLI_NAME + suffix), sibling):
        if p.is_file() and os.access(p, os.X_OK):
            return str(p)
    return None


def _skills_root() -> Path | None:
    folder = paths.repo_root() / ".claude" / "skills"
    return folder if not paths.frozen() and folder.is_dir() else None


def _described(folder: Path) -> list[dict]:
    out = []
    if not folder.is_dir():
        return out
    for item in sorted(folder.iterdir()):
        page = item / "SKILL.md"
        if not page.is_file():
            continue
        description = ""
        for line in page.read_text(encoding="utf-8", errors="replace").splitlines()[1:40]:
            if line.startswith("description:"):
                description = line.split(":", 1)[1].strip().strip('"')
                break
            if line.strip() == "---":
                break
        out.append({"name": item.name, "description": description[:400], "path": str(page)})
    return out


def _here(key: str) -> list[dict]:
    root = _skills_root()
    if root is None:
        return []
    return [s for s in _described(root) if s["name"].split("-", 1)[0] == key]


def _run_cli(args: list[str], dev: bool = False) -> dict:
    cli = formskills_cli()
    if not cli:
        raise NotFound("formskills-cli is not on this computer; FormSkills (https://github.com/nodemode-dev/formskills) ships it")
    env = dict(os.environ)
    if dev:
        env["FORMSKILLS_DEV"] = "1"
        env["FORMSKILLS_DEV_ROOTS"] = str(sources.root())
    flags = 0x08000000 if os.name == "nt" else 0
    try:
        out = subprocess.run([cli, *args], capture_output=True, text=True, timeout=CLI_TIMEOUT, env=env, stdin=subprocess.DEVNULL, creationflags=flags)
    except (OSError, subprocess.SubprocessError) as exc:
        raise WorkspaceError(f"formskills-cli did not run ({exc})") from exc
    try:
        data = json.loads(out.stdout) if out.stdout.strip() else None
    except ValueError:
        data = out.stdout.strip()
    if out.returncode != 0:
        said = (out.stderr or "").strip() or (data if isinstance(data, str) else json.dumps(data))
        raise WorkspaceError(f"formskills-cli {' '.join(args[:2])} answered {out.returncode}: {said[-600:]}")
    return {"command": [CLI_NAME, *args], "answer": data}


def skills(key: str, install: bool = False, project: str | None = None, checkout: bool = False) -> dict:
    """The skills that teach an agent one Form app: the ones bundled here, the ones in the app's pulled source, and its released
    skills through formskills-cli. install puts the released ones into Claude Code's skills folder (for the person, or one project)."""
    key = sources.resolve(key)
    name = sources.BY_KEY[key][1]
    out: dict = {"app": key, "name": name, "here": _here(key), "source": [], "released": None}
    found = sources.host_dir(key)
    if found:
        out["source"] = _described(found / ".claude" / "skills")
    if key in NO_SKILLS:
        out["note"] = f"{name} ships no skill of its own; read its API page (docs) and its source instead."
    cli = formskills_cli()
    out["formskills"] = {"installed": cli is not None, "cli": cli}
    fid = FORMSKILLS_IDS.get(key, key)
    if cli and key not in NO_SKILLS:
        try:
            out["released"] = _run_cli(["skills", fid], dev=checkout)
            answer = out["released"].get("answer")
            if not checkout and found and isinstance(answer, dict) and not answer.get("skills"):
                out["released"]["note"] = answer.get("catalogue") or "FormSkills has no release of this app's skills yet"
                out["from_checkout"] = _run_cli(["skills", fid], dev=True)
        except WorkspaceError as exc:
            out["released"] = {"error": exc.message}
    if install:
        if key in NO_SKILLS:
            raise WorkspaceError(out["note"])
        args = ["install", fid, "--to", "claude"]
        if project:
            args += ["--project", str(workspace.dir(project))]
        out["installed"] = _run_cli(args, dev=checkout)
    if not out["here"] and not out["source"] and not out["released"] and "note" not in out:
        out["note"] = f"No skill for {name} is on this computer yet: pull its source (source {key}) and read the skills in its .claude/skills folder."
    return out


def _source_brief(key: str) -> dict:
    if not sources.present(key):
        return {"state": "absent"}
    row = sources.status(key)
    return {"state": row["state"], "dir": row.get("dir"), "commit": (row.get("commit") or "")[:12] or None, "licence": row.get("licence")}


def overview() -> dict:
    docs = paths.docs_dir() / "apps"
    templates = paths.templates_dir()
    apps = []
    for key, name, repo, kind in sources.FAMILY:
        apps.append({
            "id": key,
            "name": name,
            "repository": f"nodemode-dev/{repo}",
            "kind": kind,
            "api_page": key if (docs / f"{key}.md").is_file() else None,
            "starters": (templates / key).is_dir(),
            "skills": [s["name"] for s in _here(key)],
            "source": _source_brief(key),
        })
    hub = agents.formmcp_command()
    cli = formskills_cli()
    try:
        from app.services import portal

        portal_root = portal.root()
    except Exception as exc:
        portal_root = {"error": f"{type(exc).__name__}: {exc}"}
    return {
        "apps": apps,
        "formmcp": {
            "installed": hub is not None,
            "command": hub,
            "use": "the formmcp server's family_apps, suggest_app, app_tools and call_app reach every installed Form app's own tools; an extension is tested live with them",
        },
        "formskills": {
            "installed": cli is not None,
            "cli": cli,
            "use": "the skills tool lists and installs an app's released skills through formskills-cli; without it the skills come from the app's pulled source",
        },
        "formportal": {"root": portal_root, "use": "installs the apps and their extensions; run_in_app writes its dev.json"},
        "registry": {
            "repository": "nodemode-dev/form.ext-registry",
            "index": settings.value("registry.url"),
            "source": _source_brief("registry"),
            "use": "submit prepares the registry folder and runs the registry's own checks; with pull_request it opens the pull request",
        },
        "sources_dir": str(sources.root()),
    }
