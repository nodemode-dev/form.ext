"""Every test file imports this first, so no test can start a real agent program: the home folder, the data folder, PATH and the
login shell are a scratch folder's, the finder's system folders are empty, and claude, codex, cursor-agent, agent and agy on PATH
are stand-ins that write one line per start. The line printed when the run ends says how often they were started."""

import atexit
import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAMES = ("claude", "codex", "cursor-agent", "agent", "agy")
LOOKUP_VARS = ("NPM_CONFIG_PREFIX", "npm_config_prefix", "PNPM_HOME", "VOLTA_HOME", "BUN_INSTALL", "NVM_SYMLINK")
SHELL = """#!/bin/sh
script=""
while [ $# -gt 0 ]; do
  case "$1" in -c) shift; script="$1" ;; esac
  shift
done
if [ -n "$script" ]; then exec /bin/sh -c "$script"; fi
exec /bin/sh
"""
SANDBOX = Path(tempfile.mkdtemp(prefix="formext-tests-"))
CALLS = SANDBOX / "agent-calls.log"


def calls() -> list[str]:
    try:
        return CALLS.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []


def _finish() -> None:
    started = calls()
    shutil.rmtree(SANDBOX, ignore_errors=True)
    print(f"agent program stand-ins started {len(started)} time(s): " + (", ".join(sorted(set(started))) or "none"), file=sys.stderr)


for _name in ("home", "data", "bin", "shell"):
    (SANDBOX / _name).mkdir()
os.environ["HOME"] = os.environ["USERPROFILE"] = str(SANDBOX / "home")
os.environ["FORMEXT_HOME"] = str(SANDBOX / "data")
for _key in [k for k in os.environ if k in LOOKUP_VARS or (k.startswith("FORMEXT_") and k.endswith("_BIN"))]:
    os.environ.pop(_key)
if os.name != "nt":
    for _name in NAMES:
        (SANDBOX / "bin" / _name).write_text(f'#!/bin/sh\necho "{_name} $*" >> "{CALLS}"\nif [ "$1" = "--version" ]; then echo "0.0.0 (stand-in)"; exit 0; fi\nexit 1\n', encoding="utf-8")
        (SANDBOX / "bin" / _name).chmod(0o755)
    (SANDBOX / "shell" / "sh").write_text(SHELL, encoding="utf-8")
    (SANDBOX / "shell" / "sh").chmod(0o755)
    os.environ["SHELL"] = str(SANDBOX / "shell" / "sh")
    os.environ["PATH"] = os.pathsep.join([str(SANDBOX / "bin"), "/usr/bin", "/bin", "/usr/sbin", "/sbin"])
sys.path.insert(0, str(ROOT / "backend"))
from app.services import agent_lookup  # noqa: E402

agent_lookup.system_folders = lambda platform=None: []
atexit.register(_finish)
