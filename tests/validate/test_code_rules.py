import pytest

from app.services import validate

PAGE = '<!doctype html>\n<html>\n<body>\n{body}\n<script type="module" src="app.js"></script>\n</body>\n</html>\n'


def setup(hello, edit, js="", body="", permissions=None):
    for old in (hello / "ui").iterdir():
        old.unlink()
    (hello / "ui" / "index.html").write_text(PAGE.format(body=body), encoding="utf-8")
    (hello / "ui" / "app.js").write_text(js, encoding="utf-8")

    def change(m):
        m["permissions"] = permissions or []
        m["contributes"] = {"panels": [{"id": "main", "title": "Main", "location": "dock"}]}

    edit(hello, change)
    return validate.validate_folder(hello)


def by_rule(result, rule):
    return [p for p in result["problems"] if p["rule"] == rule]


def test_a_page_with_only_package_files_and_no_calls_has_no_problems(hello, edit):
    result = setup(hello, edit, js="const a = 1;\n")
    assert result["problems"] == []
    assert result["ok"] is True


@pytest.mark.parametrize("line,rule", [
    ("fetch('https://example.org/data');", "no-network"),
    ("const x = new XMLHttpRequest();", "no-network"),
    ("const s = new WebSocket('wss://example.org');", "no-network"),
    ("navigator.sendBeacon('/log', '1');", "no-network"),
    ("eval('1 + 1');", "no-eval"),
    ("const f = new Function('return 1');", "no-eval"),
    ("setTimeout('work()', 10);", "no-eval"),
    ("localStorage.setItem('a', '1');", "sandbox-storage"),
    ("const c = document.cookie;", "sandbox-storage"),
])
def test_code_the_sandbox_blocks_is_an_error_at_its_line(hello, edit, line, rule):
    result = setup(hello, edit, js="const a = 1;\n\n" + line + "\n")
    found = by_rule(result, rule)
    assert len(found) == 1
    assert (found[0]["file"], found[0]["line"], found[0]["severity"]) == ("ui/app.js", 3, "error")
    assert result["ok"] is False


@pytest.mark.parametrize("line", ["alert('hi');", "window.open('x.html');"])
def test_dialogs_and_popups_are_warnings_that_do_not_fail_the_check(hello, edit, line):
    result = setup(hello, edit, js=line + "\n")
    found = by_rule(result, "sandbox-ui")
    assert [(p["severity"], p["line"]) for p in found] == [("warning", 1)]
    assert result["ok"] is True


@pytest.mark.parametrize("line", [
    "// fetch('https://example.org');",
    "/* eval('1') */",
    "const text = \"call fetch('x') and eval('y') and localStorage\";",
])
def test_blocked_words_inside_comments_and_strings_are_not_reported(hello, edit, line):
    result = setup(hello, edit, js=line + "\n")
    assert result["problems"] == []


def test_an_inline_script_is_an_error_at_the_line_of_its_tag(hello, edit):
    result = setup(hello, edit, body="<script>const a = 1;</script>")
    found = by_rule(result, "csp-inline-script")
    assert [(p["file"], p["line"]) for p in found] == [("ui/index.html", 4)]
    assert result["ok"] is False


def test_an_inline_handler_attribute_is_an_error_naming_the_attribute(hello, edit):
    result = setup(hello, edit, body='<button onclick="go()">Go</button>')
    found = by_rule(result, "csp-inline-script")
    assert len(found) == 1
    assert "onclick" in found[0]["message"]


def test_a_script_from_the_internet_is_an_error(hello, edit):
    result = setup(hello, edit, body='<script src="https://cdn.example.org/lib.js"></script>')
    found = by_rule(result, "csp-external")
    assert len(found) == 1
    assert "https://cdn.example.org/lib.js" in found[0]["message"]
    assert result["ok"] is False


def test_a_stylesheet_from_the_internet_is_an_error(hello, edit):
    result = setup(hello, edit, body='<link rel="stylesheet" href="https://cdn.example.org/a.css">')
    assert len(by_rule(result, "csp-external")) == 1


def test_a_frame_is_an_error(hello, edit):
    result = setup(hello, edit, body='<iframe src="other.html"></iframe>')
    assert [p["severity"] for p in by_rule(result, "csp-frame")] == ["error"]


def test_a_script_tag_pointing_at_a_file_that_is_not_there_is_an_error(hello, edit):
    result = setup(hello, edit, body='<script src="gone.js"></script>')
    found = by_rule(result, "missing-file")
    assert [p["message"] for p in found] == ["script gone.js is not in the package."]


def test_an_import_reaching_outside_the_package_is_reported_missing(hello, edit):
    (hello.parent / "outside.js").write_text("export const a = 1;\n", encoding="utf-8")
    result = setup(hello, edit, js="import { a } from '../../outside.js';\n")
    assert len(by_rule(result, "missing-file")) == 1
    assert result["ok"] is False


def test_a_bare_import_name_is_an_error(hello, edit):
    result = setup(hello, edit, js="import x from 'lodash';\n")
    found = by_rule(result, "missing-file")
    assert len(found) == 1
    assert "lodash" in found[0]["message"]


@pytest.mark.parametrize("call,method,permission", [
    ("formext.readDocument();", "document.read", "document"),
    ("formext.openFiles({ accept: ['.wav'] });", "files.open", "files-read"),
    ("formext.saveFile('a.txt', 'x');", "files.save", "files-write"),
    ("formext.fetch('https://example.org');", "net.fetch", "network"),
    ("formext.call('app.commands');", "app.commands", "document"),
])
def test_a_call_that_needs_an_undeclared_permission_is_an_error_naming_both(hello, edit, call, method, permission):
    result = setup(hello, edit, js=call + "\n")
    found = by_rule(result, "undeclared-permission")
    assert len(found) == 1
    assert method in found[0]["message"]
    assert f"the {permission} permission" in found[0]["message"]
    assert result["ok"] is False
    declared = setup(hello, edit, js=call + "\n", permissions=[permission])
    assert declared["problems"] == []


@pytest.mark.parametrize("permission", ["document", "files-read", "files-write", "network", "models", "native-code"])
def test_a_declared_permission_no_code_uses_is_a_warning_only(hello, edit, permission):
    result = setup(hello, edit, js="const a = 1;\n", permissions=[permission])
    found = by_rule(result, "unused-permission")
    assert [(p["severity"], p["path"]) for p in found] == [("warning", "permissions[0]")]
    assert permission in found[0]["message"]
    assert result["ok"] is True


def test_a_headless_command_without_an_activate_handler_is_warned_about(hello, edit):
    setup(hello, edit, js="const a = 1;\n")
    edit(hello, lambda m: m["contributes"].update(commands=[{"id": "go", "title": "Go"}]))
    result = validate.validate_folder(hello)
    found = by_rule(result, "headless-command")
    assert len(found) == 1
    assert "'go'" in found[0]["message"] and "ext.activate" in found[0]["message"]
    assert result["ok"] is True


def test_a_headless_command_that_handles_activate_and_calls_done_is_clean(hello, edit):
    setup(hello, edit, js="formext.onActivate(() => { formext.done(null); });\n")
    edit(hello, lambda m: m["contributes"].update(commands=[{"id": "go", "title": "Go"}]))
    assert by_rule(validate.validate_folder(hello), "headless-command") == []


def test_a_command_that_opens_a_panel_is_not_treated_as_headless(hello, edit):
    setup(hello, edit, js="const a = 1;\n")
    edit(hello, lambda m: m["contributes"].update(commands=[{"id": "go", "title": "Go", "panel": "main"}]))
    assert validate.validate_folder(hello)["problems"] == []


def test_every_reported_rule_is_in_the_published_rule_list_with_the_same_severity(client, hello, edit):
    r = client.get("/api/validate/rules")
    listed = {x["id"]: x["severity"] for x in r.json()["rules"]}
    assert len(listed) == len(r.json()["rules"])
    result = setup(hello, edit, js="fetch('x');\nalert('y');\nformext.readDocument();\n", body="<iframe></iframe><script>eval('1')</script>", permissions=["network"])
    seen = {(p["rule"], p["severity"]) for p in result["problems"]}
    assert len(seen) >= 6
    for rule, severity in seen:
        assert listed[rule] == severity
