import sys
from pathlib import Path

import pytest

TESTS = Path(__file__).resolve().parent.parent
if str(TESTS) not in sys.path:
    sys.path.insert(0, str(TESTS))

import stand_ins  # noqa: E402,F401

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import window_key  # noqa: E402


@pytest.fixture
def home(tmp_path, monkeypatch):
    folder = tmp_path / "data"
    folder.mkdir()
    monkeypatch.setenv("FORMEXT_HOME", str(folder))
    monkeypatch.setenv("FORMEXT_WATCH", "0")
    return folder


@pytest.fixture
def client(home):
    return TestClient(app, headers={window_key.HEADER: window_key.KEY}, raise_server_exceptions=False)


@pytest.fixture
def outsider(home):
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def project(client):
    made = client.post("/api/projects", json={"name": "Grain Tool", "product": "formvis"})
    assert made.status_code == 200, made.text
    return made.json()
