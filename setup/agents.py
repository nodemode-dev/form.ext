#!/usr/bin/env python3
"""./formext agents: making extensions in plain language with Claude Code, Codex, Cursor and Antigravity.

  install [--user] [--dry-run] [claude|codex|cursor|antigravity ...]
                            set the four up for this user account (all by default; --user says so): the formext MCP server
                            (./formext mcp at this folder's absolute path), the formMCP hub when it is installed, and every skill
                            that teaches an agent (the skillsets for changing form.ext's own code stay in the repository); files
                            are backed up before changing and running it again changes nothing. Antigravity gets the MCP servers
                            only, in ~/.gemini/config/mcp_config.json; a server of the same name that form.ext did not write is
                            left alone
  status                    what this computer has: the four clients, which servers and skills each one has, and formMCP
  sync [--check]            regenerate the formext-harness tool reference and agents/manifest.json from the MCP catalogue, mirror every skill under
                            .claude/skills to .agents/skills and check the skill files against the upload gates; --check changes
                            nothing and exits 1 when anything drifted or fails (for CI)
"""

import ast
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.services import agents as hub  # noqa: E402

SKILLS = ROOT / ".claude" / "skills"
MIRRORS = ROOT / ".agents" / "skills"
LAUNCH = str(ROOT / "formext") if (ROOT / "formext").is_file() else os.environ.get("FORMEXT_LAUNCHER") or os.environ.get("APPIMAGE") or str(ROOT / "formext")
HOSTS = ROOT / ".claude" / "skills" / "HOSTS.md"
EMOJI = re.compile("[" + "-".join(chr(c) for c in (0x1F000, 0x1FAFF)) + chr(0x2600) + "-" + chr(0x27BF) + chr(0x2B00) + "-" + chr(0x2BFF) + chr(0xFE0F) + chr(0x200D) + "]")
CLIENTS = ("claude", "codex", "cursor", "antigravity")


def skill_names() -> list[str]:
    return sorted(p.name for p in SKILLS.iterdir() if (p / "SKILL.md").is_file()) if SKILLS.is_dir() else []


def user_skills() -> list[str]:
    return [n for n in skill_names() if not n.endswith("-skillset")]


def copied() -> set[str]:
    return set(re.findall(r"^\| `([a-z0-9-]+)` \|", HOSTS.read_text(encoding="utf-8"), re.M)) if HOSTS.is_file() else set()


def servers() -> dict:
    """The MCP servers to register: name to [command, args], formext first, formMCP when it is installed."""
    out = {"formext": [LAUNCH, ["mcp"]]}
    found = hub.formmcp_command()
    if found:
        out[hub.HUB] = [found[0], found[1:]]
    return out


def tools_reference() -> str:
    from app.cli import tools_markdown
    return tools_markdown()


REGISTRY_NAME = "form.ext"
DOCK = {"present": True, "positions": ["bottom"], "tabs": ["shell", "claude", "codex", "cursor", "antigravity", "chat"]}
DOCK_DIR = ROOT / "frontend" / "src" / "dock"
DOCK_VERSION = "2.2.1"
MANIFEST = ROOT / "agents" / "manifest.json"
LOOKUP = ROOT / "backend" / "app" / "services" / "agent_lookup.py"
LOOKUP_HASHES = {"1.0.0": "252ea9bb9419d4990f174f91914f09800497bc69e98f849f5643bbf4217cc3f3", "1.0.1": "62667f9b68b7d101e1896ce617240424e33b7e498c560bc79d45f0ab26c77d51"}
OVERRIDES = {"claude": ("FORMEXT_CLAUDE_BIN",)}


def lookup_problems() -> list[str]:
    import hashlib

    rel = LOOKUP.relative_to(ROOT).as_posix()
    try:
        raw = LOOKUP.read_bytes()
    except OSError:
        return [f"{rel}: missing (the shared finder for the agent programs)"]
    said = re.search(rb'^VERSION = "([^"\r\n]+)"\r?$', raw, re.M)
    version = said.group(1).decode("ascii", "replace") if said else "unknown"
    if LOOKUP_HASHES.get(version) != hashlib.sha256(raw).hexdigest():
        return [f"{rel}: does not match the hash recorded for version {version} (the shared finder changes only as a whole new version)"]
    return []


def lookup():
    import importlib.util

    spec = importlib.util.spec_from_file_location("formext_agent_lookup", LOOKUP)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def claude_program(home: Path):
    finder = lookup()
    found = finder.check(finder.find("claude", override_vars=OVERRIDES["claude"], home=home))
    return finder, found


def dock_problems(folder: Path = DOCK_DIR) -> list[str]:
    import hashlib

    listing = folder / "MANIFEST.json"
    if not listing.is_file():
        return ["frontend/src/dock/MANIFEST.json is missing"]
    manifest = json.loads(listing.read_text(encoding="utf-8"))
    problems = [] if manifest.get("version") == DOCK_VERSION else [f"frontend/src/dock/MANIFEST.json names module {manifest.get('version')}, expected {DOCK_VERSION}"]
    wanted = manifest.get("files", {})
    found = {p.name: p for p in folder.iterdir() if p.is_file() and p.name != "MANIFEST.json"}
    for name in sorted(set(wanted) | set(found)):
        if name not in found:
            problems.append(f"frontend/src/dock/{name} is missing")
        elif name not in wanted:
            problems.append(f"frontend/src/dock/{name} is extra")
        elif hashlib.sha256(found[name].read_bytes()).hexdigest() != wanted[name]:
            problems.append(f"frontend/src/dock/{name} differs from MANIFEST.json")
    for name, path in sorted(found.items()):
        if path.suffix != ".ts":
            continue
        for target in re.findall(r"""(?:from|import)\s*\(?\s*['"]([^'"]+)['"]""", path.read_text(encoding="utf-8")):
            if not (target.startswith("./") and "/" not in target[2:]) and not target.startswith("@xterm/"):
                problems.append(f"frontend/src/dock/{name} imports {target} from outside the dock folder")
    return problems


def agent_manifest() -> str:
    from app.cli import OPS
    from app.mcp import Server
    tools = [op for op in OPS if op.mcp]
    transports = []
    route = ROOT / "backend" / "app" / "routers" / "mcp.py"
    calls = [d for n in ast.walk(ast.parse(route.read_text(encoding="utf-8"))) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) for d in n.decorator_list if isinstance(d, ast.Call)] if route.is_file() else []
    if any(isinstance(d.func, ast.Attribute) and d.func.attr == "post" and d.args and isinstance(d.args[0], ast.Constant) and d.args[0].value == "/mcp" for d in calls):
        transports.append("http")
    if callable(getattr(Server, "serve", None)):
        transports.append("stdio")
    own = [n for n in skill_names() if n not in copied()]
    skills = [{"name": n, "sub_skills": sorted(p.name for p in (SKILLS / n / "sub-skills").iterdir() if (p / "SUB-SKILL.md").is_file()) if (SKILLS / n / "sub-skills").is_dir() else []} for n in own]
    doc = {
        "format": "form-agent-manifest",
        "version": 1,
        "app": REGISTRY_NAME,
        "mcp": {
            "tools": [op.name for op in tools],
            "read_only": [op.name for op in tools if op.read_only],
            "approval_gated": [op.name for op in tools if not op.read_only],
            "transports": transports,
        },
        "skills": skills,
        "dock": DOCK,
        "extensions": None,
    }
    return json.dumps(doc, indent=2) + "\n"


def skill_problems() -> list[str]:
    bad = []
    verbatim = copied()
    for p in sorted(SKILLS.rglob("*")):
        if not p.is_file() or p.suffix not in (".md", ".json"):
            continue
        top = p.relative_to(SKILLS).parts[0]
        if top in verbatim or p.name == "HOSTS.md":
            continue
        rel, text = str(p.relative_to(ROOT)), p.read_text(encoding="utf-8")
        if chr(0x2014) in text:
            bad.append(f"{rel}: contains U+2014")
        if EMOJI.search(text):
            bad.append(f"{rel}: contains an emoji")
        if p.suffix == ".md" and re.search(r"</?[A-Za-z][A-Za-z0-9_.:-]*>", text):
            bad.append(f"{rel}: tag-shaped text in markdown (write [name], not angle brackets)")
        if p.name in ("SKILL.md", "SUB-SKILL.md"):
            head = re.match(r"---\n(.*?)\n---\n", text, re.S)
            fields = dict(re.findall(r"^(name|description): *(.*)$", head.group(1), re.M)) if head else {}
            if not fields.get("name") or not fields.get("description"):
                bad.append(f"{rel}: front matter needs a name and a description")
                continue
            if len(fields["name"]) > 64:
                bad.append(f"{rel}: name over 64 characters")
            if len(fields["description"]) > 1024:
                bad.append(f"{rel}: description over 1024 characters")
            if re.search(r"</?[A-Za-z][^>]*>", fields["name"] + fields["description"]):
                bad.append(f"{rel}: an XML tag in the front matter")
            if ": " in fields["description"] and fields["description"][:1] not in ("'", '"'):
                bad.append(f"{rel}: a colon and space in an unquoted description is not valid YAML")
    return bad


def _files(folder: Path) -> dict:
    return {str(p.relative_to(folder)): p.read_bytes() for p in sorted(folder.rglob("*")) if p.is_file()}


def sync(check: bool) -> int:
    drift = []
    ref = SKILLS / "formext-harness" / "references" / "tools.md"
    want = tools_reference()
    if not ref.exists() or ref.read_text(encoding="utf-8") != want:
        drift.append(str(ref.relative_to(ROOT)))
        if not check:
            ref.parent.mkdir(parents=True, exist_ok=True)
            ref.write_text(want, encoding="utf-8")
    manifest = agent_manifest()
    if not MANIFEST.exists() or MANIFEST.read_text(encoding="utf-8") != manifest:
        drift.append(str(MANIFEST.relative_to(ROOT)))
        if not check:
            MANIFEST.parent.mkdir(parents=True, exist_ok=True)
            MANIFEST.write_text(manifest, encoding="utf-8")
    names = skill_names()
    for name in names:
        mirror = MIRRORS / name
        if not mirror.exists() or _files(mirror) != _files(SKILLS / name):
            drift.append(str(mirror.relative_to(ROOT)))
            if not check:
                shutil.rmtree(mirror, ignore_errors=True)
                shutil.copytree(SKILLS / name, mirror)
    if MIRRORS.is_dir():
        for stale in sorted(p for p in MIRRORS.iterdir() if p.is_dir() and p.name not in names):
            drift.append(str(stale.relative_to(ROOT)) + " (removed skill)")
            if not check:
                shutil.rmtree(stale, ignore_errors=True)
    problems = skill_problems() + ["dock module: " + p for p in dock_problems()] + lookup_problems()
    if check:
        print("agents: in step" if not drift else "agents: drifted: " + ", ".join(drift) + " (run ./formext agents sync)")
        for line in problems:
            print("agents: " + line)
        return 1 if drift or problems else 0
    print("agents: " + ("updated " + ", ".join(drift) if drift else "already in step"))
    for line in problems:
        print("agents: " + line)
    return 1 if problems else 0


def _backup(path: Path, dry: bool) -> None:
    if path.exists() and not dry:
        shutil.copy2(path, path.with_name(path.name + f".bak-{time.strftime('%Y%m%d-%H%M%S')}"))


def _copy_skills(root: Path, dry: bool, said: list) -> None:
    for name in user_skills():
        to = root / name
        if to.exists() and _files(to) == _files(SKILLS / name):
            said.append(f"  skill {name} already at {to}")
            continue
        said.append(f"  skill {name} -> {to}")
        if not dry:
            shutil.rmtree(to, ignore_errors=True)
            to.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(SKILLS / name, to)


def _hub_note(said: list) -> None:
    if hub.HUB not in servers():
        said.append("  formMCP is not installed here, so only the formext server is set; install formMCP (https://github.com/nodemode-dev/formmcp) and run this again to reach every Form app's own tools")


def install_claude(home: Path, dry: bool, said: list) -> None:
    said.append("Claude Code:")
    finder, found = claude_program(home)
    claude = found.path if found.state == "runs" else None
    if claude:
        env = finder.child_env(claude, home=home)
        for name, (cmd, args) in servers().items():
            have = finder.run([claude, "mcp", "get", name], env, 60)
            if have.returncode == 0 and cmd in have.stdout:
                said.append(f"  MCP server {name} already set (user scope)")
                continue
            said.append(f"  claude mcp add --scope user {name} -- {cmd} {' '.join(args)}")
            if not dry:
                if have.returncode == 0:
                    finder.run([claude, "mcp", "remove", name, "--scope", "user"], env, 60)
                finder.run([claude, "mcp", "add", "--scope", "user", name, "--", cmd, *args], env, 60).check_returncode()
    else:
        said.append(f"  {finder.sentence(found, finder.install('claude'))} Once it runs: claude mcp add --scope user formext -- {LAUNCH} mcp")
    _hub_note(said)
    _copy_skills(home / ".claude" / "skills", dry, said)


def install_codex(home: Path, dry: bool, said: list) -> None:
    said.append("Codex:")
    cfg = Path(os.environ.get("CODEX_HOME", home / ".codex")) / "config.toml"
    text = cfg.read_text(encoding="utf-8") if cfg.exists() else ""
    new = text
    for name, (cmd, args) in servers().items():
        block = f'[mcp_servers.{name}]\ncommand = "{cmd}"\nargs = [{", ".join(json.dumps(a) for a in args)}]\nstartup_timeout_sec = 90\ntool_timeout_sec = 600\n'
        found = re.search(r"(?ms)^\[mcp_servers\." + re.escape(name) + r"\]\n.*?(?=^\[|\Z)", new)
        if found and found.group(0).strip() == block.strip():
            said.append(f"  MCP server {name} already in {cfg}")
            continue
        said.append(f"  MCP server {name} -> {cfg}")
        new = new[:found.start()] + block + "\n" + new[found.end():] if found else (new.rstrip("\n") + "\n\n" if new.strip() else "") + block
    if new != text and not dry:
        _backup(cfg, dry)
        cfg.parent.mkdir(parents=True, exist_ok=True)
        cfg.write_text(new, encoding="utf-8")
    _hub_note(said)
    _copy_skills(home / ".agents" / "skills", dry, said)


def install_cursor(home: Path, dry: bool, said: list) -> None:
    said.append("Cursor:")
    cfg = home / ".cursor" / "mcp.json"
    raw = cfg.read_text(encoding="utf-8") if cfg.exists() else ""
    data = json.loads(raw) if raw.strip() else {}
    changed = False
    for name, (cmd, args) in servers().items():
        entry = {"command": cmd, "args": args}
        if data.get("mcpServers", {}).get(name) == entry:
            said.append(f"  MCP server {name} already in {cfg}")
            continue
        said.append(f"  MCP server {name} -> {cfg}")
        data.setdefault("mcpServers", {})[name] = entry
        changed = True
    if changed and not dry:
        _backup(cfg, dry)
        cfg.parent.mkdir(parents=True, exist_ok=True)
        cfg.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    _hub_note(said)
    _copy_skills(home / ".agents" / "skills", dry, said)


def antigravity_files(home: Path) -> tuple[Path, Path]:
    return home / ".gemini" / "config" / "mcp_config.json", home / ".gemini" / "antigravity-cli" / "mcp_config.json"


def install_antigravity(home: Path, dry: bool, said: list) -> None:
    said.append("Antigravity:")
    cfg, older = antigravity_files(home)
    if older.exists() and not cfg.exists():
        said.append(f"  an older file was seen at {older} and left alone; the documented file is {cfg}")
    try:
        data = json.loads(cfg.read_text(encoding="utf-8") or "{}") if cfg.exists() else {}
    except ValueError:
        data = None
    if not isinstance(data, dict) or not isinstance(data.get("mcpServers", {}), dict):
        said.append(f"  {cfg} is not an MCP servers file form.ext can read; left alone")
        return
    changed = False
    for name, (cmd, args) in servers().items():
        entry = {"command": cmd, "args": args}
        have = data.get("mcpServers", {}).get(name)
        if have == entry:
            said.append(f"  MCP server {name} already in {cfg}")
        elif have is not None and not (isinstance(have, dict) and have.get("args") == args and Path(str(have.get("command") or "")).name == Path(cmd).name):
            said.append(f"  {cfg} has a server named {name} that form.ext did not write; left alone")
        else:
            said.append(f"  MCP server {name} -> {cfg}")
            data.setdefault("mcpServers", {})[name] = entry
            changed = True
    if changed and not dry:
        _backup(cfg, dry)
        cfg.parent.mkdir(parents=True, exist_ok=True)
        part = cfg.with_name(cfg.name + f".part-{os.getpid()}")
        part.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        os.replace(part, cfg)
    _hub_note(said)
    said.append("  skills: Antigravity gets the MCP servers only")


def _installed_skills(root: Path) -> int:
    return sum(1 for n in user_skills() if (root / n).is_dir() and _files(root / n) == _files(SKILLS / n))


def status() -> int:
    home = Path(os.environ.get("HOME", str(Path.home())))
    want = servers()
    found = hub.formmcp_command()
    print(f"form.ext at {ROOT}")
    print(f"formMCP: {' '.join(found) if found else 'not installed (the family hub that reaches every installed Form app; https://github.com/nodemode-dev/formmcp)'}")
    print(f"skills in this repository: {len(user_skills())} for agents ({len(skill_names())} with the skillsets)")
    finder, program = claude_program(home)
    claude = program.path if program.state == "runs" else None
    print("Claude Code:")
    print(f"  program: {claude or finder.sentence(program, finder.install('claude'))}")
    for name in want:
        if claude:
            got = finder.run([claude, "mcp", "get", name], finder.child_env(claude, home=home), 60)
            print(f"  MCP {name}: {'set (user scope)' if got.returncode == 0 else 'not set'}")
        else:
            print(f"  MCP {name}: unknown without the claude command")
    print(f"  skills in ~/.claude/skills: {_installed_skills(home / '.claude' / 'skills')} of {len(user_skills())} current")
    cfg = Path(os.environ.get("CODEX_HOME", home / ".codex")) / "config.toml"
    text = cfg.read_text(encoding="utf-8") if cfg.exists() else ""
    print("Codex:")
    for name in want:
        print(f"  MCP {name}: {'set' if f'[mcp_servers.{name}]' in text else 'not set'} in {cfg}")
    print(f"  skills in ~/.agents/skills: {_installed_skills(home / '.agents' / 'skills')} of {len(user_skills())} current")
    cur = home / ".cursor" / "mcp.json"
    data = json.loads(cur.read_text(encoding="utf-8")) if cur.exists() and cur.read_text(encoding="utf-8").strip() else {}
    print("Cursor:")
    for name in want:
        print(f"  MCP {name}: {'set' if name in data.get('mcpServers', {}) else 'not set'} in {cur}")
    print("  skills: Cursor reads ~/.agents/skills, counted above")
    gem = antigravity_files(home)[0]
    try:
        held = json.loads(gem.read_text(encoding="utf-8") or "{}").get("mcpServers", {}) if gem.exists() else {}
    except (ValueError, AttributeError):
        held = {}
    print("Antigravity:")
    for name in want:
        print(f"  MCP {name}: {'set' if isinstance(held, dict) and name in held else 'not set'} in {gem}")
    print("This repository's own configuration (.mcp.json, .codex/config.toml, .cursor/mcp.json) is used when an agent starts in this folder.")
    return 0


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else "install"
    rest = argv[1:]
    if cmd == "sync":
        return sync("--check" in rest)
    if cmd == "status":
        return status()
    if cmd == "install":
        dry = "--dry-run" in rest
        unknown = [a for a in rest if a.startswith("--") and a not in ("--user", "--dry-run")]
        if unknown:
            print(f"agents: unknown option {', '.join(unknown)} (--user or --dry-run)", file=sys.stderr)
            return 2
        which = [a for a in rest if not a.startswith("--")] or list(CLIENTS)
        bad = [w for w in which if w not in CLIENTS]
        if bad:
            print(f"agents: unknown client {', '.join(bad)} (claude, codex, cursor or antigravity)", file=sys.stderr)
            return 2
        home, said = Path(os.environ.get("HOME", str(Path.home()))), []
        for w in which:
            {"claude": install_claude, "codex": install_codex, "cursor": install_cursor, "antigravity": install_antigravity}[w](home, dry, said)
        print(("Would do (dry run):\n" if dry else "") + "\n".join(said))
        if not dry:
            print("\nRestart the clients. Then ask for an extension, for example: make a FormWav extension that lists the session's markers.")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
