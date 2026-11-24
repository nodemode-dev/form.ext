import re

import pytest
from fastapi.routing import APIRoute

from app.main import app
from app.services import window_key

REFUSED = "Only the form.ext window can do this"
NEVER_CALLED = ("/send", "/registry/pull-request")
READS = {"GET", "HEAD", "OPTIONS"}


def _walk(routes, prefix=""):
    for route in routes:
        inner = getattr(route, "original_router", None)
        if inner is not None:
            context = getattr(route, "include_context", None)
            extra = context.get("prefix", "") if isinstance(context, dict) else getattr(context, "prefix", "")
            yield from _walk(inner.routes, prefix + (extra or ""))
        elif isinstance(route, APIRoute):
            yield prefix + route.path, route.methods


def _writes():
    out = []
    for path, methods in _walk(app.routes):
        for method in sorted(methods - READS):
            if path in ("/mcp", "/api/window/key"):
                continue
            if method == "POST" and path.endswith(NEVER_CALLED):
                continue
            out.append((method, re.sub(r"\{[^}]+\}", "probe", path)))
    return out


WRITES = _writes()


def test_the_sweep_covers_every_write_route_the_api_schema_lists():
    listed = {(m.upper(), re.sub(r"\{[^}]+\}", "probe", p)) for p, ops in app.openapi()["paths"].items() for m in ops if m.upper() not in READS}
    listed = {(m, p) for m, p in listed if p not in ("/mcp", "/api/window/key") and not (m == "POST" and p.endswith(NEVER_CALLED))}
    assert len(listed) >= 40
    assert listed <= set(WRITES)


@pytest.mark.parametrize("method,path", WRITES, ids=[f"{m} {p}" for m, p in WRITES])
def test_every_write_route_refuses_a_request_without_the_window_key(outsider, method, path):
    reply = outsider.request(method, path, json={})
    assert reply.status_code == 403
    assert reply.json() == {"detail": REFUSED}


@pytest.mark.parametrize("method,path", WRITES[:12], ids=[f"{m} {p}" for m, p in WRITES[:12]])
def test_a_wrong_window_key_is_refused_like_a_missing_one(outsider, method, path):
    reply = outsider.request(method, path, json={}, headers={window_key.HEADER: window_key.KEY[:-1] + ("A" if window_key.KEY[-1] != "A" else "B")})
    assert reply.status_code == 403
    assert reply.json()["detail"] == REFUSED


def test_an_empty_window_key_header_is_refused(outsider):
    reply = outsider.post("/api/keys", json={"id": "acme", "name": "Acme"}, headers={window_key.HEADER: ""})
    assert reply.status_code == 403
    assert reply.json()["detail"] == REFUSED


def test_a_refused_create_leaves_no_key_behind(outsider, client):
    outsider.post("/api/keys", json={"id": "sneaky", "name": "Sneaky"})
    assert [k["id"] for k in client.get("/api/keys").json()["keys"]] == []


def test_reading_health_needs_no_window_key(outsider):
    reply = outsider.get("/api/health")
    assert reply.status_code == 200
    assert reply.json()["ok"] is True
    assert reply.json()["app"] == "formext"


def test_reading_the_key_list_needs_no_window_key(outsider):
    assert outsider.get("/api/keys").json() == {"keys": []}


def test_the_window_key_header_lets_a_write_through(client):
    reply = client.post("/api/keys", json={"id": "acme", "name": "Acme"})
    assert reply.status_code == 200
    assert reply.json()["id"] == "acme"


def test_valid_accepts_only_the_exact_key():
    assert window_key.valid(window_key.KEY) is True
    assert window_key.valid(window_key.KEY + "x") is False
    assert window_key.valid(window_key.KEY.upper() if window_key.KEY.upper() != window_key.KEY else window_key.KEY.lower()) is False
    assert window_key.valid("") is False
    assert window_key.valid(None) is False
    assert window_key.valid(123) is False


def test_the_window_key_is_long_and_url_safe():
    assert len(window_key.KEY) >= 40
    assert re.fullmatch(r"[A-Za-z0-9_-]+", window_key.KEY)


def test_the_first_window_claims_the_key_and_it_opens_writes(outsider, monkeypatch):
    monkeypatch.setattr(window_key, "STATE", {"claimed": False, "secondClaim": False})
    claimed = outsider.post("/api/window/key")
    assert claimed.status_code == 200
    key = claimed.json()["key"]
    made = outsider.post("/api/keys", json={"id": "first-window", "name": "First"}, headers={window_key.HEADER: key})
    assert made.status_code == 200
    assert made.json()["id"] == "first-window"


def test_a_second_claim_is_refused_and_reported(outsider, monkeypatch):
    monkeypatch.setattr(window_key, "STATE", {"claimed": False, "secondClaim": False})
    assert outsider.post("/api/window/key").status_code == 200
    second = outsider.post("/api/window/key")
    assert second.status_code == 409
    assert second.json()["detail"] == "Another window already holds this engine's window key; use that window, or restart form.ext"
    assert "key" not in second.json()
    state = outsider.get("/api/window").json()
    assert state["claimed"] is True
    assert state["secondClaim"] is True


def test_a_fresh_engine_reports_no_claim_yet(outsider, monkeypatch):
    monkeypatch.setattr(window_key, "STATE", {"claimed": False, "secondClaim": False})
    assert outsider.get("/api/window").json() == {"packaged": False, "claimed": False, "secondClaim": False}


def test_a_packaged_engine_hands_out_no_key_over_http(outsider, monkeypatch):
    monkeypatch.setattr(window_key, "STATE", {"claimed": False, "secondClaim": False})
    monkeypatch.setenv("FORMEXT_WINDOW_KEY_STDOUT", "1")
    reply = outsider.post("/api/window/key")
    assert reply.status_code == 404
    assert "key" not in reply.json()
    assert outsider.get("/api/window").json()["packaged"] is True
    assert window_key.STATE["claimed"] is False


def test_a_packaged_engine_prints_the_key_line(monkeypatch, capsys):
    monkeypatch.setenv("FORMEXT_WINDOW_KEY_STDOUT", "1")
    window_key.announce()
    assert capsys.readouterr().out == "formext-window-key: " + window_key.KEY + "\n"


def test_an_unpackaged_engine_prints_nothing(monkeypatch, capsys):
    monkeypatch.delenv("FORMEXT_WINDOW_KEY_STDOUT", raising=False)
    window_key.announce()
    assert capsys.readouterr().out == ""


def _until(ws, wanted):
    for _ in range(20):
        name = ws.receive_json()["name"]
        if name in wanted:
            return name
    return None


def test_the_live_socket_admits_a_window_that_says_hello_with_the_key(outsider, monkeypatch):
    from app.services.bus import bus
    monkeypatch.setattr(bus, "_loop", bus._loop)
    with outsider.websocket_connect("/api/live") as ws:
        assert ws.receive_json()["name"] == "hello"
        ws.send_json({"type": "window", "key": window_key.KEY})
        assert _until(ws, ("window.admitted", "window.refused")) == "window.admitted"


def test_the_live_socket_refuses_a_window_hello_with_a_wrong_key(outsider, monkeypatch):
    from app.services.bus import bus
    monkeypatch.setattr(bus, "_loop", bus._loop)
    with outsider.websocket_connect("/api/live") as ws:
        assert ws.receive_json()["name"] == "hello"
        ws.send_json({"type": "window", "key": "not-the-key"})
        assert _until(ws, ("window.admitted", "window.refused")) == "window.refused"


def test_the_live_socket_delivers_bus_events_in_the_order_they_were_sent(outsider, monkeypatch):
    from app.services.bus import bus
    monkeypatch.setattr(bus, "_loop", bus._loop)
    with outsider.websocket_connect("/api/live") as ws:
        assert ws.receive_json()["name"] == "hello"
        for i in range(25):
            bus.emit("security.order", {"n": i})
        seen = []
        while len(seen) < 25:
            message = ws.receive_json()
            if message["name"] == "security.order":
                seen.append(message["data"]["n"])
    assert seen == list(range(25))
