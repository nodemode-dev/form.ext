import itertools
import json
import shutil
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import stand_ins  # noqa: E402,F401

ROOT = Path(__file__).resolve().parent.parent.parent
HELLO = ROOT / "contract" / "examples" / "hello"
_counter = itertools.count(1)


@pytest.fixture(autouse=True)
def _no_source_pulls(monkeypatch):
    monkeypatch.setenv("FORMEXT_SOURCES_AUTO", "0")


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services import window_key

    return TestClient(app, headers={window_key.HEADER: window_key.KEY})


@pytest.fixture
def hello(tmp_path):
    folder = tmp_path / "pkg"
    shutil.copytree(HELLO, folder)
    return folder


@pytest.fixture
def edit():
    def change(folder, fn):
        path = Path(folder) / "manifest.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        fn(data)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return data

    return change


@pytest.fixture
def unique():
    def make(stem="lane validate"):
        return f"{stem} {next(_counter)} {id(make) % 100000}"

    return make


@pytest.fixture
def project(client, unique):
    def make(product="formvis", starter="panel", name=None):
        r = client.post("/api/templates/create", json={"product": product, "starter": starter, "name": name or unique()})
        assert r.status_code == 200, r.text
        return r.json()

    return make
