import asyncio
import json
import threading
from collections import deque

import pytest

from app.services import agent_feed, window_key
from app.services.bus import Bus


def _run(coro):
    return asyncio.run(coro)


def test_the_bus_delivers_events_to_a_subscriber_in_the_order_they_were_emitted():
    async def scenario():
        bus = Bus()
        bus.attach(asyncio.get_running_loop())
        queue = bus.subscribe()
        for i in range(200):
            bus.emit("n", i)
        return [queue.get_nowait()["data"] for _ in range(queue.qsize())]
    assert _run(scenario()) == list(range(200))


def test_events_emitted_from_another_thread_arrive_in_order():
    async def scenario():
        bus = Bus()
        bus.attach(asyncio.get_running_loop())
        queue = bus.subscribe()
        worker = threading.Thread(target=lambda: [bus.emit("n", i) for i in range(100)])
        worker.start()
        await asyncio.to_thread(worker.join)
        return [(await queue.get())["data"] for _ in range(100)]
    assert _run(scenario()) == list(range(100))


def test_every_subscriber_gets_the_same_sequence():
    async def scenario():
        bus = Bus()
        bus.attach(asyncio.get_running_loop())
        first, second = bus.subscribe(), bus.subscribe()
        for name in ("a", "b", "c"):
            bus.emit(name, {"x": name})
        return [[q.get_nowait()["name"] for _ in range(3)] for q in (first, second)]
    assert _run(scenario()) == [["a", "b", "c"], ["a", "b", "c"]]


def test_an_event_carries_its_name_data_and_a_time():
    async def scenario():
        bus = Bus()
        bus.attach(asyncio.get_running_loop())
        queue = bus.subscribe()
        bus.emit("keys.changed", {"id": "acme"})
        return queue.get_nowait()
    got = _run(scenario())
    assert got["name"] == "keys.changed"
    assert got["data"] == {"id": "acme"}
    assert isinstance(got["at"], float)


def test_an_unsubscribed_queue_receives_nothing_more_and_the_count_drops():
    async def scenario():
        bus = Bus()
        bus.attach(asyncio.get_running_loop())
        kept, gone = bus.subscribe(), bus.subscribe()
        assert bus.clients() == 2
        bus.unsubscribe(gone)
        bus.emit("n", 1)
        return bus.clients(), kept.qsize(), gone.qsize()
    assert _run(scenario()) == (1, 1, 0)


def test_a_bus_without_a_loop_drops_events_without_raising():
    bus = Bus()
    bus.subscribe()
    bus.emit("n", 1)
    assert bus.clients() == 1


def test_a_full_subscriber_keeps_the_first_thousand_events_in_order():
    async def scenario():
        bus = Bus()
        bus.attach(asyncio.get_running_loop())
        queue = bus.subscribe()
        for i in range(1100):
            bus.emit("n", i)
        return [queue.get_nowait()["data"] for _ in range(queue.qsize())]
    assert _run(scenario()) == list(range(1000))


def test_creating_a_key_is_announced_on_the_live_socket(client, outsider):
    with outsider.websocket_connect("/api/live") as ws:
        assert ws.receive_json()["name"] == "hello"
        assert client.post("/api/keys", json={"id": "acme", "name": "Acme"}).status_code == 200
        for _ in range(20):
            message = ws.receive_json()
            if message["name"] == "keys.changed":
                break
        assert message["data"] == {"id": "acme", "kind": "created"}
        assert "private_key" not in json.dumps(message)


def test_the_live_hello_reports_the_running_version(outsider):
    version = outsider.get("/api/health").json()["version"]
    with outsider.websocket_connect("/api/live") as ws:
        hello = ws.receive_json()
    assert hello["data"] == {"app": "formext", "version": version}


def test_the_live_socket_answers_a_ping_with_a_pong(outsider):
    with outsider.websocket_connect("/api/live") as ws:
        ws.receive_json()
        ws.send_text("ping")
        for _ in range(20):
            if ws.receive_json()["name"] == "pong":
                break
        else:
            pytest.fail("no pong")


@pytest.fixture
def feed(monkeypatch):
    log = deque(maxlen=agent_feed.KEEP)
    monkeypatch.setattr(agent_feed, "_log", log)
    return log


def test_an_agent_call_is_logged_with_its_tool_title_and_project(feed):
    call = agent_feed.began("Probe", {"name": "family", "arguments": {"id": "grain-tool"}})
    row = agent_feed.backlog()[-1]
    assert row["id"] == call
    assert row["line"] == "Probe: Form family (family) in the project grain-tool"
    assert row["readOnly"] is True


def test_an_agent_call_keeps_no_argument_values(feed):
    agent_feed.began("Probe", {"name": "source", "arguments": {"id": "p1", "content": "TOP-SECRET-TEXT", "token": "abc123xyz"}})
    agent_feed.ended(agent_feed.backlog()[-1]["id"], {"result": {"content": [{"text": "RESULT-BODY"}]}})
    text = json.dumps(agent_feed.backlog())
    for secret in ("TOP-SECRET-TEXT", "abc123xyz", "RESULT-BODY"):
        assert secret not in text


def test_an_unknown_tool_is_logged_by_name_with_no_project(feed):
    agent_feed.began("", {"name": "made_up", "arguments": {"id": "p1"}})
    row = agent_feed.backlog()[-1]
    assert row["line"] == "An outside agent: made_up (made_up)"
    assert row["project"] == ""
    assert row["readOnly"] is False


def test_control_characters_in_a_tool_name_are_stripped_and_the_name_capped(feed):
    agent_feed.began("Probe", {"name": "bad\x1b[31m\n" + "x" * 200})
    tool = agent_feed.backlog()[-1]["tool"]
    assert "\x1b" not in tool and "\n" not in tool
    assert len(tool) == 80


def test_a_call_ending_in_an_error_is_logged_as_refused_or_failed(feed):
    call = agent_feed.began("Probe", {"name": "status"})
    agent_feed.ended(call, {"result": {"isError": True}})
    agent_feed.ended(call, {"error": {"code": -32000}})
    agent_feed.ended(call, {"result": {"content": []}})
    rows = agent_feed.backlog()[-3:]
    assert [(r["ok"], r["line"]) for r in rows] == [(False, "refused or failed"), (False, "refused or failed"), (True, "done")]


def test_the_feed_keeps_only_the_most_recent_calls_in_order(feed):
    for i in range(agent_feed.KEEP + 20):
        agent_feed.began("Probe", {"name": f"t{i}"})
    names = [r["tool"] for r in agent_feed.backlog()]
    assert len(names) == agent_feed.KEEP
    assert names[0] == "t20"
    assert names[-1] == f"t{agent_feed.KEEP + 19}"


@pytest.fixture
def local(home):
    from fastapi.testclient import TestClient

    from app.main import app
    return TestClient(app, base_url="http://127.0.0.1", raise_server_exceptions=False)


def test_the_agent_stream_sends_the_backlog_to_a_window_with_the_key(feed, local):
    agent_feed.began("Probe", {"name": "status"})
    with local.websocket_connect("ws://127.0.0.1/api/agents/stream") as ws:
        ws.send_text(json.dumps({"type": "window", "key": window_key.KEY}))
        assert json.loads(ws.receive_text())["type"] == "hello"
        assert json.loads(ws.receive_text())["line"] == "Probe: Status (status)"


def test_the_agent_stream_closes_on_a_window_without_the_key(feed, local):
    from starlette.websockets import WebSocketDisconnect
    agent_feed.began("Probe", {"name": "status"})
    with pytest.raises(WebSocketDisconnect) as caught:
        with local.websocket_connect("ws://127.0.0.1/api/agents/stream") as ws:
            ws.send_text(json.dumps({"type": "window", "key": "wrong"}))
            ws.receive_text()
    assert caught.value.code == 4403


def test_the_agent_stream_refuses_a_page_from_another_site(feed, local):
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect) as caught:
        with local.websocket_connect("ws://127.0.0.1/api/agents/stream", headers={"origin": "https://evil.example"}) as ws:
            ws.receive_text()
    assert caught.value.code == 4403
