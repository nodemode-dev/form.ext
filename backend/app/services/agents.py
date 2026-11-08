"""What an agent needs to make extensions here: the formext MCP server's launcher, and formMCP, the family hub that reaches every
installed Form app's own tools, when it is installed. Standard library only, so setup/agents.py can use it too."""

import os
import shutil
import sys
from pathlib import Path

from app.services import paths

HUB = "formmcp"
CANDIDATES = (
    ".local/bin/formmcp",
    ".cargo/bin/formmcp",
    "Applications/formMCP.app/Contents/MacOS/formmcp",
)
SYSTEM = (
    "/Applications/formMCP.app/Contents/MacOS/formmcp",
    "/usr/local/bin/formmcp",
    "/opt/homebrew/bin/formmcp",
    "/usr/bin/formmcp",
)


def formext_command() -> list[str]:
    if paths.frozen():
        return [sys.executable, "mcp"]
    return [str(paths.repo_root() / "formext"), "mcp"]


def formmcp_command() -> list[str] | None:
    """formMCP's launcher on this computer, or None when it is not installed: FORMMCP_BIN, then the path, the usual install
    folders, and a formmcp checkout beside this one."""
    found = os.environ.get("FORMMCP_BIN") or shutil.which("formmcp")
    if found and os.path.isfile(found):
        return [found, "mcp"]
    home = Path.home()
    sibling = paths.repo_root().parent / "formmcp" / "formmcp"
    for p in [home / c for c in CANDIDATES] + [Path(s) for s in SYSTEM] + [sibling]:
        if p.is_file() and os.access(p, os.X_OK):
            return [str(p), "mcp"]
    return None


def mcp_servers(url: str | None = None) -> dict:
    """The MCP servers an agent started by the Studio gets: formext (aimed at this engine when url is given) and formMCP when it is installed."""
    cmd = formext_command()
    formext: dict = {"type": "stdio", "command": cmd[0], "args": cmd[1:]}
    if url:
        formext["env"] = {"FORMEXT_URL": url}
    servers = {"formext": formext}
    hub = formmcp_command()
    if hub:
        servers[HUB] = {"type": "stdio", "command": hub[0], "args": hub[1:]}
    return servers
