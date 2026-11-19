"""The agent programs the Studio can run in a terminal tab: Claude Code (services/claude_code.py), Codex and Cursor's agent. One status
answer for all three, and the launch of the last two. A Codex or Cursor tab gets its own tab token in the child's environment
(FORMEXT_INAPP_TOKEN, with FORMEXT_URL and FORMEXT_MCP_URL beside it), never on a command line, and the token stops counting when the
tab closes. A plain Terminal tab gets none."""

import os
import secrets
import shlex
import shutil
import subprocess
import time

from app.services import claude_code, consent, terminal

TOKEN_VAR = "FORMEXT_INAPP_TOKEN"
PROGRAMS = {
    "codex": {"bin": "codex", "title": "Codex", "install": "npm install -g @openai/codex"},
    "cursor": {"bin": "cursor-agent", "title": "Cursor", "install": "curl https://cursor.com/install -fsS | bash"},
}
_cache: dict = {"at": 0.0, "value": None}


def find(kind: str) -> str | None:
    binary = PROGRAMS[kind]["bin"]
    found = shutil.which(binary, path=terminal.base_env().get("PATH"))
    if found or os.name == "nt":
        return found
    try:
        out = subprocess.run(terminal.login_shell() + ["-c", f"command -v {shlex.quote(binary)}"], capture_output=True, text=True, timeout=10,
                             env=claude_code.child_env(), stdin=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        return None
    lines = out.stdout.strip().splitlines()[-1:] if out.returncode == 0 else []
    return lines[0] if lines and os.path.isabs(lines[0]) and os.access(lines[0], os.X_OK) else None


def version(path: str) -> str | None:
    try:
        out = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=10, env=claude_code.child_env(), stdin=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        return None
    words = (out.stdout.strip().splitlines() or [""])[0].split()
    return next((w[:40] for w in words if any(c.isdigit() for c in w)), None)


def status(fresh: bool = False) -> dict:
    if not fresh and _cache["value"] is not None and time.time() - _cache["at"] < 60:
        return _cache["value"]
    found = claude_code.info(fresh=fresh)
    out = {"claude": {"title": "Claude Code", "installed": found["installed"], "path": found["path"], "version": found["version"], "signedIn": found["signedIn"], "install": found["install"]}}
    for kind, p in PROGRAMS.items():
        path = find(kind)
        out[kind] = {"title": p["title"], "installed": path is not None, "path": path, "version": version(path) if path else None, "signedIn": None, "install": p["install"]}
    _cache["value"], _cache["at"] = out, time.time()
    return out


def open_terminal(kind: str, port: int, cols: int = 100, rows: int = 30, project: str | None = None) -> dict:
    if kind not in PROGRAMS:
        raise ValueError(f"There is no agent program called {kind}.")
    p = PROGRAMS[kind]
    path = find(kind)
    if path is None:
        raise LookupError(f"{p['title']} is not installed. Install it with: {p['install']}")
    folder = claude_code.project_folder(project)
    argv = [path] if os.name == "nt" else terminal.login_shell() + ["-c", "exec " + shlex.quote(path)]
    token = secrets.token_urlsafe(32)
    env = terminal.base_env(port) | {TOKEN_VAR: token, "FORMEXT_MCP_URL": terminal.engine_url(port) + "/mcp"}
    consent.open_tab(token, "")
    try:
        session = terminal.open_session(folder, cols, rows, p["title"], argv, env, kind)
    except BaseException:
        consent.close_tab(token)
        raise
    session.on_close.append(lambda: consent.close_tab(token))
    return session.describe()
