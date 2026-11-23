import json
import os

import pytest

from app.services import validate

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REQUIRED = ["format", "format_version", "id", "name", "product", "kind", "version", "author", "licence", "native", "permissions"]


def schema():
    with open(os.path.join(ROOT, "contract", "schema", "package.schema.json"), encoding="utf-8") as f:
        return json.load(f)


def errors(result, path=None, rule=None):
    return [p for p in result["problems"] if p["severity"] == "error" and (path is None or p["path"] == path) and (rule is None or p["rule"] == rule)]


def test_the_contract_example_package_is_accepted_without_errors(hello):
    result = validate.validate_folder(hello)
    assert result["ok"] is True
    assert result["counts"]["error"] == 0
    assert result["id"] == "hello-formext"
    assert result["product"] == "formvis"


def test_the_schema_requires_the_same_keys_the_refusals_name():
    assert sorted(schema()["required"]) == sorted(REQUIRED)


@pytest.mark.parametrize("key", REQUIRED)
def test_a_manifest_without_a_required_key_is_refused_and_names_the_key(hello, edit, key):
    edit(hello, lambda m: m.pop(key))
    result = validate.validate_folder(hello)
    assert result["ok"] is False
    assert f"{key} is required." in [p["message"] for p in errors(result, path=key)]


@pytest.mark.parametrize("bad", ["A", "a", "Bad_Id", "-lead", "x" * 65, "has space"])
def test_an_id_outside_2_to_64_lower_case_letters_digits_hyphens_is_refused(hello, edit, bad):
    edit(hello, lambda m: m.update(id=bad))
    result = validate.validate_folder(hello)
    assert result["ok"] is False
    assert len(errors(result, path="id")) == 1


@pytest.mark.parametrize("good", ["ab", "x" * 64, "0-a", "my-ext-2"])
def test_an_id_inside_the_stated_shape_is_accepted(hello, edit, good):
    edit(hello, lambda m: m.update(id=good))
    result = validate.validate_folder(hello)
    assert errors(result) == []
    assert result["id"] == good


@pytest.mark.parametrize("bad", ["1.0", "v1.0.0", "1.0.0-beta", "1.0.0.0", ""])
def test_a_version_that_is_not_three_numbers_is_refused_with_x_y_z(hello, edit, bad):
    edit(hello, lambda m: m.update(version=bad))
    result = validate.validate_folder(hello)
    assert [p["message"] for p in errors(result, path="version")] == ["version must be x.y.z."]


def test_an_unknown_product_is_refused_and_the_message_lists_the_schema_products(hello, edit):
    edit(hello, lambda m: m.update(product="formnothing"))
    result = validate.validate_folder(hello)
    found = errors(result, path="product")
    assert len(found) == 1
    for name in schema()["properties"]["product"]["enum"]:
        assert name in found[0]["message"]


def test_an_unknown_permission_is_refused(hello, edit):
    edit(hello, lambda m: m.update(permissions=["document", "camera"]))
    result = validate.validate_folder(hello)
    assert result["ok"] is False
    assert len(errors(result, path="permissions")) == 1


def test_a_permission_listed_twice_is_refused(hello, edit):
    edit(hello, lambda m: m.update(permissions=["document", "document"]))
    result = validate.validate_folder(hello)
    assert result["ok"] is False
    assert len(errors(result, path="permissions")) == 1


def test_a_manifest_without_api_is_refused_as_every_api_1_host_would(hello, edit):
    edit(hello, lambda m: m.pop("api"))
    result = validate.validate_folder(hello)
    assert result["ok"] is False
    found = errors(result, path="api")
    assert found and all("API 1 host" in p["message"] for p in found)


@pytest.mark.parametrize("value", ["2", 1, "1.0"])
def test_an_api_value_other_than_the_text_1_is_refused(hello, edit, value):
    edit(hello, lambda m: m.update(api=value))
    result = validate.validate_folder(hello)
    assert result["ok"] is False
    assert len(errors(result, path="api")) == 1


def test_a_native_extension_is_refused(hello, edit):
    edit(hello, lambda m: m.update(native=True))
    result = validate.validate_folder(hello)
    assert [p["message"] for p in errors(result, path="native")] == ["native extensions are not supported by API 1 hosts."]


def test_format_version_2_is_refused(hello, edit):
    edit(hello, lambda m: m.update(format_version=2))
    result = validate.validate_folder(hello)
    assert [p["message"] for p in errors(result, path="format_version")] == ["format_version must be 1."]


def test_an_entry_page_that_is_not_in_the_folder_is_reported_as_missing_entry(hello, edit):
    edit(hello, lambda m: m.update(entry={"ui": "ui/absent.html"}))
    result = validate.validate_folder(hello)
    found = errors(result, rule="missing-entry")
    assert [p["message"] for p in found] == ["entry.ui ui/absent.html is not a file in the folder."]


@pytest.mark.parametrize("escape", ["../outside.html", "ui/../../outside.html"])
def test_an_entry_page_outside_the_package_is_refused(hello, edit, escape):
    (hello.parent / "outside.html").write_text("<p>x</p>", encoding="utf-8")
    edit(hello, lambda m: m.update(entry={"ui": escape}))
    result = validate.validate_folder(hello)
    assert result["ok"] is False
    assert len(errors(result, path="entry.ui")) == 1


def test_contributions_without_an_entry_page_are_refused(hello, edit):
    edit(hello, lambda m: m.pop("entry"))
    result = validate.validate_folder(hello)
    assert "entry.ui is required when panels or commands are contributed." in [p["message"] for p in errors(result)]


def test_a_command_that_names_a_panel_nobody_contributes_is_refused(hello, edit):
    edit(hello, lambda m: m["contributes"]["commands"][0].update(panel="ghost"))
    result = validate.validate_folder(hello)
    found = errors(result, path="contributes.commands.panel")
    assert [p["message"] for p in found] == ["command 'say-hello' names panel 'ghost', which is not contributed."]


def test_one_panel_more_than_the_schema_limit_is_refused(hello, edit):
    limit = schema()["properties"]["contributes"]["properties"]["panels"]["maxItems"]
    edit(hello, lambda m: m["contributes"].update(panels=[{"id": f"p{i}", "title": f"P {i}", "location": "dock"} for i in range(limit + 1)]))
    result = validate.validate_folder(hello)
    assert result["ok"] is False
    assert [p["message"] for p in errors(result, rule="schema")] == [f"contributes.panels has {limit + 1} items; at most {limit}."]


def test_exactly_the_schema_limit_of_panels_is_accepted(hello, edit):
    limit = schema()["properties"]["contributes"]["properties"]["panels"]["maxItems"]
    edit(hello, lambda m: m["contributes"].update(panels=[{"id": f"p{i}", "title": f"P {i}", "location": "dock"} for i in range(limit)]))
    assert errors(validate.validate_folder(hello)) == []


def test_a_panel_location_outside_dock_and_dialog_is_refused(hello, edit):
    edit(hello, lambda m: m["contributes"]["panels"][0].update(location="sidebar"))
    result = validate.validate_folder(hello)
    assert result["ok"] is False
    assert [p["path"] for p in errors(result)] == ["contributes.panels[0].location"]


def test_a_description_one_character_over_the_schema_limit_is_refused(hello, edit):
    limit = schema()["properties"]["description"]["maxLength"]
    edit(hello, lambda m: m.update(description="d" * (limit + 1)))
    result = validate.validate_folder(hello)
    assert [p["message"] for p in errors(result)] == [f"description is {limit + 1} characters; at most {limit}."]
    edit(hello, lambda m: m.update(description="d" * limit))
    assert errors(validate.validate_folder(hello)) == []


def test_a_homepage_that_is_not_https_is_refused(hello, edit):
    edit(hello, lambda m: m.update(homepage="http://example.org/"))
    result = validate.validate_folder(hello)
    assert result["ok"] is False
    assert [p["path"] for p in errors(result)] == ["homepage"]


def test_a_missing_description_is_only_a_note_and_the_package_stays_valid(hello, edit):
    edit(hello, lambda m: m.pop("description"))
    result = validate.validate_folder(hello)
    assert result["ok"] is True
    notes = [p for p in result["problems"] if p["rule"] == "description"]
    assert [(p["severity"], p["message"]) for p in notes] == [("info", "There is no description.")]


def test_a_folder_without_a_manifest_is_refused_in_plain_words(tmp_path):
    result = validate.validate_folder(tmp_path)
    assert result["ok"] is False
    assert [p["message"] for p in result["problems"]] == ["There is no manifest.json at the package root."]


def test_a_syntax_error_is_reported_at_its_line(hello):
    (hello / "manifest.json").write_text('{\n  "id": "ab",\n  "name" "x"\n}\n', encoding="utf-8")
    result = validate.validate_folder(hello)
    found = [p for p in result["problems"] if p["rule"] == "json"]
    assert len(found) == 1
    assert found[0]["line"] == 3
    assert found[0]["severity"] == "error"
    assert result["ok"] is False


def test_a_manifest_that_is_a_list_is_refused(hello):
    (hello / "manifest.json").write_text("[1, 2]", encoding="utf-8")
    result = validate.validate_folder(hello)
    assert [p["message"] for p in result["problems"] if p["rule"] == "json"] == ["manifest.json must hold one JSON object."]


def test_a_problem_points_at_the_line_of_the_offending_key(hello, edit):
    edit(hello, lambda m: m.update(version="nope"))
    lines = (hello / "manifest.json").read_text(encoding="utf-8").splitlines()
    expected = next(i for i, text in enumerate(lines, 1) if '"version"' in text)
    result = validate.validate_folder(hello)
    assert errors(result, path="version")[0]["line"] == expected


def test_a_file_type_outside_the_contract_list_is_refused_by_name(hello):
    (hello / "ui" / "tool.exe").write_bytes(b"MZ")
    result = validate.validate_folder(hello)
    found = [p for p in errors(result, rule="package") if p["file"] == "ui/tool.exe"]
    assert [p["message"] for p in found] == ["The file type .exe is not allowed."]


def test_a_symlink_in_the_package_is_refused(hello, tmp_path):
    (tmp_path / "secret.txt").write_text("s", encoding="utf-8")
    os.symlink(tmp_path / "secret.txt", hello / "ui" / "link.txt")
    result = validate.validate_folder(hello)
    found = [p for p in errors(result, rule="package") if p["file"] == "ui/link.txt"]
    assert [p["message"] for p in found] == ["Symlinks are not allowed."]


def test_counts_add_up_and_errors_are_listed_before_warnings_and_notes(hello, edit):
    edit(hello, lambda m: (m.update(version="x", permissions=["document", "network"]), m.pop("description")))
    result = validate.validate_folder(hello)
    assert sum(result["counts"].values()) == len(result["problems"])
    rank = {"error": 0, "warning": 1, "info": 2}
    order = [rank[p["severity"]] for p in result["problems"]]
    assert order == sorted(order)
    assert set(order) == {0, 1, 2}


def test_the_prefix_is_put_in_front_of_every_reported_file(hello, edit):
    edit(hello, lambda m: m.update(version="x"))
    (hello / "ui" / "tool.exe").write_bytes(b"MZ")
    result = validate.validate_folder(hello, "package")
    assert result["manifest"] == "package/manifest.json"
    assert {p["file"] for p in result["problems"]} == {"package/manifest.json", "package/ui/tool.exe"}
