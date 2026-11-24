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
    gh = tmp_path / "gh-stand-in"
    gh.write_text("#!/bin/sh\nexit 1\n", encoding="utf-8")
    gh.chmod(0o755)
    portal = tmp_path / "portal"
    portal.mkdir()
    monkeypatch.setenv("FORMEXT_HOME", str(folder))
    monkeypatch.setenv("FORMEXT_WATCH", "0")
    monkeypatch.setenv("FORMEXT_SOURCES_AUTO", "0")
    monkeypatch.setenv("FORMEXT_GH_BIN", str(gh))
    monkeypatch.setenv("FORMPORTAL_ROOT", str(portal))
    monkeypatch.delenv("FORMEXT_WINDOW_KEY_STDOUT", raising=False)
    return folder


@pytest.fixture
def client(home):
    return TestClient(app, headers={window_key.HEADER: window_key.KEY}, raise_server_exceptions=False)


@pytest.fixture
def outsider(home):
    return TestClient(app, raise_server_exceptions=False)
