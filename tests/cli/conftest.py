import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND = ROOT / "backend"
PY = sys.executable


def env_for(home, **more):
    env = {k: v for k, v in os.environ.items() if not k.startswith("FORMEXT_")}
    env.update(FORMEXT_HOME=str(home), FORMEXT_PORT="0", HOME=str(Path(home).parent), PYTHONUNBUFFERED="1", FORMEXT_WATCH="0", **more)
    return env


def make_home(base, access=None):
    home = Path(base) / "home"
    home.mkdir(parents=True, exist_ok=True)
    if access:
        (home / "settings.json").write_text(json.dumps({"agent_access": access}), encoding="utf-8")
    return home


def run(home, args, cwd=BACKEND, stdin=None):
    return subprocess.run([PY, *args], cwd=str(cwd), env=env_for(home), input=stdin, capture_output=True, text=True, timeout=50)


def cli(home, *args):
    return run(home, ["-m", "app.cli", "--local", *args])


def cli_json(home, *args):
    done = cli(home, *args, "--json")
    return done.returncode, json.loads(done.stdout)


def mcp_lines(home, lines):
    done = run(home, ["-m", "app.mcp", "--local"], stdin="".join(line + "\n" for line in lines))
    assert done.returncode == 0, done.stderr
    return [json.loads(line) for line in done.stdout.splitlines() if line.strip()]


def rpc(mid, method, params=None):
    msg = {"jsonrpc": "2.0", "id": mid, "method": method}
    if params is not None:
        msg["params"] = params
    return json.dumps(msg)


def call(mid, name, arguments=None):
    return rpc(mid, "tools/call", {"name": name, "arguments": arguments or {}})


@pytest.fixture(scope="module")
def allowed_home(tmp_path_factory):
    return make_home(tmp_path_factory.mktemp("allowed"), "allowed")


@pytest.fixture(scope="module")
def ask_home(tmp_path_factory):
    return make_home(tmp_path_factory.mktemp("ask"))
