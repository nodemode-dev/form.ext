"""The agent programs the Studio can run in a terminal tab: Claude Code (services/claude_code.py), Codex, Cursor's agent and
Antigravity (agy), each found by the family's finder (services/agent_lookup.py). One status answer for all four, and the launch of
the last three. Such a tab gets its own tab token in the child's environment (FORMEXT_INAPP_TOKEN, with FORMEXT_URL and
FORMEXT_MCP_URL beside it), never on a command line, and the token stops counting when the tab closes. Antigravity reads its MCP
servers from a file, so its tab runs in form.ext's own folder inside the data folder and gets the entry formext_tab there, taken
out again when the tab closes. A plain Terminal tab gets none."""

import json
import os
import secrets
import time
from pathlib import Path

from app.services import agent_lookup, claude_code, consent, paths, terminal

TOKEN_VAR = "FORMEXT_INAPP_TOKEN"
PROGRAMS = {
    "codex": {"bin": "codex", "title": "Codex", "install": "npm install -g @openai/codex"},
    "cursor": {"bin": "cursor-agent", "title": "Cursor", "install": "curl https://cursor.com/install -fsS | bash"},
    "antigravity": {"bin": "agy", "title": "Antigravity", "install": agent_lookup.install("antigravity")},
}
TABS = ("codex", "cursor", "antigravity")
TAB_HEADER = "X-Formext-Inapp"
_cache: dict = {"at": 0.0, "value": None}


def find(kind: str) -> str | None:
    return claude_code.located(kind).path


def tab_folder(kind: str) -> Path:
    """The working folder of a program that reads its MCP servers from a file in its workspace (Antigravity): form.ext's own,
    inside the data folder, so a tab's token is never written into a folder of the person's extension project."""
    folder = paths.home() / "agent-tabs" / kind
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _mcp_file(folder: Path) -> Path:
    return folder / ".agents" / "mcp_config.json"


def _servers(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8") or "{}") if path.exists() else {}
    if not isinstance(data, dict) or not isinstance(data.get("mcpServers", {}), dict):
        raise OSError(f"{path} is not an MCP servers file form.ext can read, so it was left alone")
    return data


def _replace(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_name(path.name + f".part-{os.getpid()}")
    with os.fdopen(os.open(part, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w", encoding="utf-8") as f:
        f.write(json.dumps(data, indent=2) + "\n")
    os.replace(part, path)


def write_tab_entry(folder: Path, port: int, token: str) -> None:
    """The tab's own entry, formext_tab, in [folder]/.agents/mcp_config.json: the engine's address and the tab's token. Every
    other entry and key in the file is kept; the file is replaced whole and is the user's alone."""
    path = _mcp_file(folder)
    data = _servers(path)
    data.setdefault("mcpServers", {})[claude_code.TAB_SERVER] = {"serverUrl": terminal.engine_url(port) + "/mcp", "headers": {TAB_HEADER: token}}
    _replace(path, data)


def remove_tab_entry(folder: Path, token: str) -> None:
    """Takes the tab's entry out when the tab closes, only while it still carries this tab's token; nothing else is touched."""
    path = _mcp_file(folder)
    try:
        data = _servers(path)
        entry = data.get("mcpServers", {}).get(claude_code.TAB_SERVER)
        if not isinstance(entry, dict) or (entry.get("headers") or {}).get(TAB_HEADER) != token:
            return
        del data["mcpServers"][claude_code.TAB_SERVER]
        _replace(path, data)
    except (OSError, ValueError):
        return


def status(fresh: bool = False) -> dict:
    if not fresh and _cache["value"] is not None and time.time() - _cache["at"] < 60:
        return _cache["value"]
    out = {"claude": {"title": "Claude Code"} | {k: v for k, v in claude_code.info(fresh=fresh).items() if k != "formmcp"}}
    for kind, p in PROGRAMS.items():
        found = claude_code.located(kind, fresh)
        out[kind] = agent_lookup.answer(found, p["install"], claude_code.OTHERWISE) | {"signedIn": None, "install": p["install"], "title": p["title"]}
    _cache["value"], _cache["at"] = out, time.time()
    return out


def open_terminal(kind: str, port: int, cols: int = 100, rows: int = 30, project: str | None = None) -> dict:
    if kind not in TABS:
        raise ValueError(f"There is no agent program called {kind}.")
    p = PROGRAMS[kind]
    found = claude_code.usable(kind)
    if found.state != "runs":
        raise LookupError(claude_code.said(found))
    path = found.path
    own = tab_folder(kind) if kind == "antigravity" else None
    folder = str(own) if own else claude_code.project_folder(project)
    argv = agent_lookup.start_argv([path])
    token = secrets.token_urlsafe(32)
    env = claude_code.terminal_env(port, path, {TOKEN_VAR: token, "FORMEXT_MCP_URL": terminal.engine_url(port) + "/mcp"})
    consent.open_tab(token, "")
    try:
        if own:
            write_tab_entry(own, port, token)
        session = terminal.open_session(folder, cols, rows, p["title"], argv, env, kind)
    except BaseException:
        consent.close_tab(token)
        if own:
            remove_tab_entry(own, token)
        raise
    session.on_close.append(lambda: consent.close_tab(token))
    if own:
        session.on_close.append(lambda: remove_tab_entry(own, token))
    return session.describe()
