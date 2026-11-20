"""The agent programs the Studio can run in a terminal tab: Claude Code (services/claude_code.py), Codex, Cursor's agent and
Antigravity (agy), each found by the family's finder (services/agent_lookup.py). One status answer for all four, and the launch of
Codex and Cursor. A Codex or Cursor tab gets its own tab token in the child's environment (FORMEXT_INAPP_TOKEN, with FORMEXT_URL and
FORMEXT_MCP_URL beside it), never on a command line, and the token stops counting when the tab closes. A plain Terminal tab gets none."""

import secrets
import time

from app.services import agent_lookup, claude_code, consent, terminal

TOKEN_VAR = "FORMEXT_INAPP_TOKEN"
PROGRAMS = {
    "codex": {"bin": "codex", "title": "Codex", "install": "npm install -g @openai/codex"},
    "cursor": {"bin": "cursor-agent", "title": "Cursor", "install": "curl https://cursor.com/install -fsS | bash"},
    "antigravity": {"bin": "agy", "title": "Antigravity", "install": agent_lookup.install("antigravity")},
}
TABS = ("codex", "cursor")
_cache: dict = {"at": 0.0, "value": None}


def find(kind: str) -> str | None:
    return claude_code.located(kind).path


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
    folder = claude_code.project_folder(project)
    argv = agent_lookup.start_argv([path])
    token = secrets.token_urlsafe(32)
    env = claude_code.terminal_env(port, path, {TOKEN_VAR: token, "FORMEXT_MCP_URL": terminal.engine_url(port) + "/mcp"})
    consent.open_tab(token, "")
    try:
        session = terminal.open_session(folder, cols, rows, p["title"], argv, env, kind)
    except BaseException:
        consent.close_tab(token)
        raise
    session.on_close.append(lambda: consent.close_tab(token))
    return session.describe()
