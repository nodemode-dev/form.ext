import base64
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest

TESTS = Path(__file__).resolve().parent.parent
if str(TESTS) not in sys.path:
    sys.path.insert(0, str(TESTS))

import stand_ins  # noqa: E402,F401
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import registry_pr, window_key  # noqa: E402

PNG = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 32).decode("ascii")
GH = """#!/bin/sh
echo "$*" >> "{log}"
case "$1 $2" in
  "api user") if [ -f "{signed}" ]; then echo '{{"login":"tester","id":7,"name":"Tess Ter"}}'; exit 0; fi; exit 1 ;;
  "api repos/"*) echo "nodemode-dev/form.ext-registry"; exit 0 ;;
  "auth git-credential") exit 0 ;;
  "pr list") echo "[]"; exit 0 ;;
  "pr create") echo "https://example.invalid/registry/pull/1"; exit 0 ;;
esac
exit 1
"""


class Gh:
    def __init__(self, folder: Path) -> None:
        self.log = folder / "gh-calls.log"
        self.signed = folder / "gh-signed-in"
        self.program = folder / "gh"
        self.program.write_text(GH.format(log=self.log, signed=self.signed), encoding="utf-8")
        self.program.chmod(0o755)

    def sign_in(self) -> None:
        self.signed.write_text("yes", encoding="utf-8")

    def calls(self) -> list[str]:
        try:
            return self.log.read_text(encoding="utf-8").splitlines()
        except OSError:
            return []


@pytest.fixture(scope="session")
def client():
    with TestClient(app, headers={window_key.HEADER: window_key.KEY}) as c:
        yield c


@pytest.fixture(autouse=True)
def offline(monkeypatch, tmp_path, client):
    box = tmp_path / "offline"
    box.mkdir()
    gh = Gh(box)
    monkeypatch.setenv("FORMEXT_SOURCES_BASE", (box / "remotes").as_uri())
    monkeypatch.setenv("FORMEXT_SOURCES_AUTO", "0")
    monkeypatch.setenv("FORMEXT_REGISTRY_URL", (box / "index" / "extensions.json").as_uri())
    monkeypatch.setenv("FORMEXT_GH_BIN", str(gh.program))
    monkeypatch.delenv("FORMEXT_REGISTRY_FORK_URL", raising=False)
    registry_pr._ready["at"] = 0.0
    yield gh
    registry_pr._ready["at"] = 0.0
    client.delete("/api/sources/registry")


@pytest.fixture
def gh(offline):
    return offline


@pytest.fixture
def remotes(tmp_path):
    folder = tmp_path / "offline" / "remotes"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def git(*args, cwd):
    out = subprocess.run(["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "init.defaultBranch=main", *args], cwd=str(cwd), capture_output=True, text=True, timeout=60, env=dict(os.environ, GIT_TERMINAL_PROMPT="0"))
    assert out.returncode == 0, out.stderr
    return out.stdout.strip()


def make_remote(remotes: Path, repo: str, files: dict) -> str:
    work = remotes / f"work-{repo}"
    work.mkdir()
    git("init", "-q", cwd=work)
    for rel, text in files.items():
        target = work / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
    git("add", "-A", cwd=work)
    git("commit", "-q", "-m", "first", cwd=work)
    git("branch", "-M", "main", cwd=work)
    git("clone", "-q", "--bare", str(work), str(remotes / f"{repo}.git"), cwd=remotes)
    return git("rev-parse", "HEAD", cwd=work)


def manifest(pid: str, name: str, product: str = "formvis", **more) -> str:
    data = {"format": "formai-package", "format_version": 1, "id": pid, "name": name, "product": product, "kind": "script-plugin", "version": "0.1.0", "author": "me", "licence": "Apache-2.0", "native": False, "permissions": [], "api": "1", "description": ""}
    data.update(more)
    return json.dumps(data, indent=2) + "\n"


@pytest.fixture
def make_project(client):
    def make(product: str = "formvis", files: dict | None = None, **fields) -> dict:
        name = "Pub " + uuid.uuid4().hex[:10]
        pid = name.lower().replace(" ", "-")
        body = {"name": name, "product": product}
        if files is not None or fields:
            body["files"] = {"package/manifest.json": manifest(pid, name, product, **fields), **(files or {})}
        res = client.post("/api/projects", json=body)
        assert res.status_code == 200, res.text
        return res.json()

    return make


@pytest.fixture
def setting(client):
    done = []

    def put(group: str, patch: dict) -> None:
        res = client.put("/api/settings", json={group: patch})
        assert res.status_code == 200, res.text
        done.append((group, patch))

    yield put

    def blank(node):
        return {k: blank(v) for k, v in node.items()} if isinstance(node, dict) else ""

    for group, patch in done:
        client.put("/api/settings", json={group: blank(patch)})
