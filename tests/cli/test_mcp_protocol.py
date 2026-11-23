import json

import pytest

from .conftest import ROOT, call, make_home, mcp_lines, rpc, run

HTTP_SCRIPT = r"""
import json, sys
from starlette.testclient import TestClient
from app.main import app
out = {}
with TestClient(app, base_url="http://127.0.0.1:8640") as c:
    h = c.get("/api/health")
    out["health"] = [h.status_code, h.json()]
    r = c.post("/mcp", content="{}", headers={"content-type": "text/plain"})
    out["plain"] = [r.status_code, r.json()]
    r = c.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"}, headers={"origin": "https://evil.example"})
    out["origin"] = [r.status_code, r.json()]
    r = c.post("/mcp", content="{nope", headers={"content-type": "application/json"})
    out["parse"] = [r.status_code, r.json()]
    r = c.post("/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"})
    out["note"] = [r.status_code, r.text]
    r = c.post("/mcp", json={"jsonrpc": "2.0", "id": 5, "method": "initialize", "params": {"protocolVersion": "2025-03-26", "clientInfo": {"name": "probe"}}})
    out["init"] = [r.status_code, r.json(), r.headers.get("mcp-session-id")]
    r = c.post("/mcp", json={"jsonrpc": "2.0", "id": 6, "method": "tools/list"})
    out["list"] = [r.status_code, [t["name"] for t in r.json()["result"]["tools"]]]
    r = c.post("/mcp", json=[{"jsonrpc": "2.0", "id": 7, "method": "ping"}, {"jsonrpc": "2.0", "id": 8, "method": "tools/call", "params": {"name": "projects"}}])
    out["batch"] = [r.status_code, r.json()]
print("RESULT" + json.dumps(out))
"""


@pytest.fixture(scope="module")
def wire(allowed_home):
    lines = [
        rpc(1, "initialize", {"protocolVersion": "2025-06-18", "clientInfo": {"name": "lane"}}),
        json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
        rpc(2, "ping"),
        rpc(3, "tools/list"),
        rpc(4, "no/such"),
        "this is not json",
        json.dumps({"jsonrpc": "1.0", "id": 5, "method": "ping"}),
        rpc(6, "tools/call", {"name": "no_such_tool", "arguments": {}}),
        json.dumps([json.loads(rpc(7, "ping")), {"jsonrpc": "2.0", "method": "notifications/x"}, json.loads(rpc("eight", "prompts/list"))]),
        rpc(9, "resources/list"),
        rpc(10, "resources/read", {"uri": "formext://docs/contract"}),
        rpc(11, "resources/read", {"uri": "formext://docs/nothing"}),
        rpc(12, "initialize", {"protocolVersion": "1999-01-01"}),
        call(20, "new", {"name": "Wire Panel", "product": "formcut", "starter": "command"}),
        call(21, "write", {"id": "wire-panel", "path": "package/ui/extra.txt", "text": "caf\u00e9 \u2713"}),
        call(22, "read", {"id": "wire-panel", "path": "package/ui/extra.txt"}),
        call(23, "validate", {"id": "wire-panel"}),
        call(24, "package", {"id": "wire-panel"}),
        call(25, "builds", {"id": "wire-panel"}),
        call(26, "read", {"id": "wire-panel", "path": "missing.txt"}),
        call(27, "new", {"name": "Y", "product": "formcut", "starter": "wizard"}),
        call(28, "write", {"id": "wire-panel"}),
        call(29, "projects"),
    ]
    answers = mcp_lines(allowed_home, lines)
    by_id = {}
    for a in answers:
        for item in a if isinstance(a, list) else [a]:
            by_id[item.get("id")] = item
    return {"answers": answers, "by_id": by_id, "home": allowed_home, "sent": len(lines)}


@pytest.fixture(scope="module")
def tools(wire):
    return wire["by_id"][3]["result"]["tools"]


def payload(answer):
    return json.loads(answer["result"]["content"][0]["text"])


def test_every_answer_is_json_rpc_2_with_exactly_one_of_result_or_error(wire):
    flat = [i for a in wire["answers"] for i in (a if isinstance(a, list) else [a])]
    assert flat
    for item in flat:
        assert item["jsonrpc"] == "2.0"
        assert ("result" in item) != ("error" in item)
        if "error" in item:
            assert isinstance(item["error"]["code"], int) and isinstance(item["error"]["message"], str)


def test_notifications_get_no_answer(wire):
    flat = [i for a in wire["answers"] for i in (a if isinstance(a, list) else [a])]
    ids = [i["id"] for i in flat]
    assert ids == [1, 2, 3, 4, None, 5, 6, 7, "eight", 9, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]


def test_initialize_answers_the_asked_protocol_version_and_names_the_server(wire):
    result = wire["by_id"][1]["result"]
    assert result["protocolVersion"] == "2025-06-18"
    assert result["serverInfo"]["name"] == "formext"
    assert "tools" in result["capabilities"]


def test_initialize_with_an_unknown_version_offers_a_real_one(wire):
    assert wire["by_id"][12]["result"]["protocolVersion"] in ("2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05")


def test_ping_answers_an_empty_result(wire):
    assert wire["by_id"][2]["result"] == {}


def test_unknown_method_is_method_not_found(wire):
    assert wire["by_id"][4]["error"]["code"] == -32601


def test_text_that_is_not_json_is_a_parse_error_with_null_id(wire):
    assert wire["by_id"][None]["error"]["code"] == -32700


def test_wrong_jsonrpc_version_is_an_invalid_request(wire):
    assert wire["by_id"][5]["error"]["code"] == -32600


def test_unknown_tool_is_an_invalid_params_protocol_error(wire):
    assert wire["by_id"][6]["error"]["code"] == -32602
    assert "no_such_tool" in wire["by_id"][6]["error"]["message"]


def test_a_batch_is_answered_as_one_array_without_the_notification(wire):
    batch = [a for a in wire["answers"] if isinstance(a, list)]
    assert len(batch) == 1
    assert [i["id"] for i in batch[0]] == [7, "eight"]
    assert batch[0][1]["result"] == {"prompts": []}


def test_readme_count_of_33_tools_19_reading_and_14_changing(tools):
    reading = [t for t in tools if t["annotations"]["readOnlyHint"]]
    assert len(tools) == 33
    assert len(reading) == 19
    assert len(tools) - len(reading) == 14


def test_each_listed_tool_has_the_mcp_tool_shape(tools):
    names = [t["name"] for t in tools]
    assert len(set(names)) == len(names)
    for t in tools:
        assert isinstance(t["name"], str) and t["name"]
        assert isinstance(t["description"], str) and t["description"]
        schema = t["inputSchema"]
        assert schema["type"] == "object"
        assert isinstance(schema["properties"], dict)
        for spec in schema["properties"].values():
            assert spec["type"] in ("string", "integer", "boolean", "object", "array", "number")


@pytest.mark.xfail(strict=True, reason="DEFECT: the move tool's inputSchema lists source as required but leaves source out of properties while additionalProperties is false, so no call can satisfy the schema; every required argument should be a declared property (JSON Schema object rules used by the MCP tool listing; backend/app/mcp.py _schema drops every param named source)")
def test_every_required_argument_is_a_declared_property(tools):
    for t in tools:
        schema = t["inputSchema"]
        assert set(schema.get("required", [])) <= set(schema["properties"]), t["name"]


def test_tools_the_person_must_be_asked_about_are_not_marked_read_only(tools):
    by_name = {t["name"]: t for t in tools}
    for name in ("run_in_app", "publish", "submit", "skills", "delete"):
        assert by_name[name]["annotations"]["readOnlyHint"] is False, name
        assert by_name[name]["annotations"]["destructiveHint"] is True, name


def test_list_tools_flag_prints_the_same_list_as_the_wire(wire, tools):
    done = run(wire["home"], ["-m", "app.mcp", "--list-tools"])
    assert done.returncode == 0
    assert json.loads(done.stdout) == tools


def test_allowed_tools_flag_names_only_tools_that_read(wire, tools):
    done = run(wire["home"], ["-m", "app.mcp", "--allowed-tools"])
    ours = [n.removeprefix("mcp__formext__") for n in done.stdout.split() if n.startswith("mcp__formext__")]
    reading = {t["name"] for t in tools if t["annotations"]["readOnlyHint"]}
    assert len(ours) == 19
    assert set(ours) == reading


def test_every_listed_tool_can_be_called_and_answers_a_tool_result(tools, ask_home):
    lines = [call(100 + i, t["name"], {}) for i, t in enumerate(tools)]
    answers = mcp_lines(ask_home, lines)
    assert [a["id"] for a in answers] == [100 + i for i in range(len(tools))]
    for t, a in zip(tools, answers):
        assert "result" in a, (t["name"], a)
        content = a["result"]["content"]
        assert content and all(c["type"] == "text" and isinstance(c["text"], str) for c in content), t["name"]
        needs = t["inputSchema"].get("required")
        if needs:
            assert a["result"]["isError"] is True, t["name"]
            assert json.loads(content[0]["text"])["error"] == f"{t['name']} needs {', '.join(needs)}"


def test_changing_tool_is_refused_as_a_tool_error_while_the_setting_is_ask(ask_home):
    answers = mcp_lines(ask_home, [call(1, "new", {"name": "Hidden", "product": "formcut"}), call(2, "projects")])
    assert answers[0]["result"]["isError"] is True
    body = payload(answers[0])
    assert "no form.ext window is open to ask" in body["error"]
    assert body["data"] == {"agentAccess": "ask"}
    assert payload(answers[1]) == {"projects": []}


def test_new_over_the_wire_makes_the_project_folder(wire):
    answer = wire["by_id"][20]["result"]
    assert not answer.get("isError")
    assert answer["structuredContent"]["project"]["id"] == "wire-panel"
    manifest = json.loads((wire["home"] / "projects" / "wire-panel" / "package" / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["product"] == "formcut"


def test_write_then_read_returns_the_same_non_ascii_text(wire):
    assert payload(wire["by_id"][22])["text"] == "caf\u00e9 \u2713"
    on_disk = (wire["home"] / "projects" / "wire-panel" / "package" / "ui" / "extra.txt").read_bytes()
    assert on_disk == "caf\u00e9 \u2713".encode("utf-8")


def test_structured_content_equals_the_text_content(wire):
    for mid in (20, 22, 23, 24, 25, 29):
        result = wire["by_id"][mid]["result"]
        assert result["structuredContent"] == json.loads(result["content"][0]["text"]), mid


def test_package_and_builds_name_the_same_sha256(wire):
    built = payload(wire["by_id"][24])["build"]
    listed = payload(wire["by_id"][25])["builds"]
    assert len(built["sha256"]) == 64
    assert [b["sha256"] for b in listed] == [built["sha256"]]


def test_reading_a_missing_file_is_a_tool_error_with_the_engine_status(wire):
    result = wire["by_id"][26]["result"]
    assert result["isError"] is True
    assert payload(wire["by_id"][26])["status"] == 404


def test_enum_value_outside_the_schema_is_refused_with_the_choices(wire):
    assert wire["by_id"][27]["result"]["isError"] is True
    assert payload(wire["by_id"][27])["error"] == "starter is one of panel, command, panel-commands"


def test_missing_required_argument_is_named(wire):
    assert payload(wire["by_id"][28])["error"] == "write needs path"


def test_projects_lists_only_what_was_made(wire):
    assert [p["id"] for p in payload(wire["by_id"][29])["projects"]] == ["wire-panel"]


def test_contract_resource_is_listed_and_reads_as_the_contract_file(wire):
    listed = {r["uri"]: r for r in wire["by_id"][9]["result"]["resources"]}
    assert listed["formext://docs/contract"]["mimeType"] == "text/markdown"
    contents = wire["by_id"][10]["result"]["contents"]
    assert contents[0]["uri"] == "formext://docs/contract"
    assert contents[0]["text"] == (ROOT / "contract" / "CONTRACT.md").read_text(encoding="utf-8")


def test_unknown_resource_is_resource_not_found(wire):
    assert wire["by_id"][11]["error"]["code"] == -32002


@pytest.fixture(scope="module")
def http(tmp_path_factory):
    home = make_home(tmp_path_factory.mktemp("http"))
    done = run(home, ["-c", HTTP_SCRIPT])
    assert done.returncode == 0, done.stderr[-800:]
    line = [l for l in done.stdout.splitlines() if l.startswith("RESULT")][-1]
    return json.loads(line[len("RESULT"):]), home


def test_health_route_names_the_app_and_its_data_folder(http):
    out, home = http
    status, body = out["health"]
    assert status == 200
    assert body["app"] == "formext"
    assert body["home"] == str(home)
    assert "mcp" in body["routers"]


def test_http_mcp_refuses_a_body_that_is_not_declared_json(http):
    status, body = http[0]["plain"]
    assert status == 415
    assert body["detail"] == "Send JSON-RPC as application/json."


def test_http_mcp_refuses_a_page_from_another_origin(http):
    status, body = http[0]["origin"]
    assert status == 403
    assert body["detail"] == "Only programs on this computer may use form.ext's tools."


def test_http_mcp_answers_broken_json_with_a_parse_error(http):
    status, body = http[0]["parse"]
    assert body == {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}


def test_http_mcp_accepts_a_notification_with_202_and_no_body(http):
    assert http[0]["note"] == [202, ""]


def test_http_initialize_gives_a_session_id_and_the_asked_version(http):
    status, body, session = http[0]["init"]
    assert status == 200
    assert body["id"] == 5 and body["result"]["protocolVersion"] == "2025-03-26"
    assert session and len(session) >= 16


def test_http_and_stdio_list_the_same_tools(http, tools):
    assert http[0]["list"][1] == [t["name"] for t in tools]


def test_http_batch_answers_both_calls_in_order(http):
    status, body = http[0]["batch"]
    assert status == 200
    assert [i["id"] for i in body] == [7, 8]
    assert json.loads(body[1]["result"]["content"][0]["text"]) == {"projects": []}
