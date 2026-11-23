import io
import json
import zipfile

import pytest

from app.services import paths, settings
from app.services import window_key


def test_saved_settings_read_back_and_are_written_to_the_settings_file(client, home):
    res = client.put("/api/settings", json={"theme": "light", "author": "Ada"})
    assert res.status_code == 200
    got = client.get("/api/settings").json()
    assert (got["theme"], got["author"]) == ("light", "Ada")
    on_disk = json.loads((home / "settings.json").read_text(encoding="utf-8"))
    assert (on_disk["theme"], on_disk["author"]) == ("light", "Ada")


def test_settings_report_the_data_folder_in_use(client, home):
    assert client.get("/api/settings").json()["home"] == str(home)


def test_saving_one_editor_setting_keeps_the_other_editor_settings(client):
    before = client.get("/api/settings").json()["editor"]
    client.put("/api/settings", json={"editor": {"font_size": 20}})
    after = client.get("/api/settings").json()["editor"]
    assert after == {**before, "font_size": 20}


def test_a_setting_saved_as_null_goes_back_to_its_first_value(client):
    first = client.get("/api/settings").json()["licence"]
    client.put("/api/settings", json={"licence": "MIT"})
    assert client.get("/api/settings").json()["licence"] == "MIT"
    client.put("/api/settings", json={"licence": None})
    assert client.get("/api/settings").json()["licence"] == first


def test_home_folder_cannot_be_changed_through_settings(client, home, tmp_path):
    client.put("/api/settings", json={"home": str(tmp_path / "elsewhere")})
    assert client.get("/api/settings").json()["home"] == str(home)
    assert not (tmp_path / "elsewhere").exists()


def test_settings_change_without_the_window_key_is_refused_and_nothing_changes(client, outsider):
    before = client.get("/api/settings").json()["theme"]
    res = outsider.put("/api/settings", json={"theme": "sand"})
    assert res.status_code == 403
    assert res.json()["detail"] == "Only the form.ext window can do this"
    assert client.get("/api/settings").json()["theme"] == before


def test_agent_access_outside_the_three_choices_is_refused_and_not_saved(client):
    before = client.get("/api/settings").json()["agent_access"]
    res = client.put("/api/settings", json={"agent_access": "always"})
    assert res.status_code == 400
    assert res.json()["detail"] == "agent_access is ask, allowed or blocked"
    assert client.get("/api/settings").json()["agent_access"] == before


def test_agent_access_saved_by_the_window_reads_back(client):
    client.put("/api/settings", json={"agent_access": "blocked"})
    assert client.get("/api/settings").json()["agent_access"] == "blocked"


def test_agent_access_cannot_be_changed_by_a_caller_that_is_not_the_window(home):
    before = settings.get()["agent_access"]
    settings.update({"agent_access": "allowed", "theme": "light"})
    assert settings.get()["agent_access"] == before
    assert settings.get()["theme"] == "light"


def test_unreadable_settings_file_falls_back_to_the_first_values(client, home):
    first = client.get("/api/settings").json()
    (home / "settings.json").write_text("{broken", encoding="utf-8")
    assert client.get("/api/settings").json()["theme"] == first["theme"]


def test_new_project_manifest_takes_author_and_licence_from_settings(client):
    client.put("/api/settings", json={"author": "Ada", "licence": "MIT"})
    made = client.post("/api/projects", json={"name": "Signed Work", "product": "formvis"}).json()
    assert (made["manifest"]["author"], made["manifest"]["licence"]) == ("Ada", "MIT")


def test_settings_value_reads_a_nested_key_by_dotted_name(client):
    client.put("/api/settings", json={"editor": {"tab_size": 8}})
    assert settings.value("editor.tab_size") == 8
    assert settings.value("editor.nothing", "fallback") == "fallback"


def test_data_folders_live_under_the_home_folder_named_by_the_environment(home):
    assert paths.home() == home
    assert paths.projects_dir() == home / "projects"
    assert paths.trash_dir() == home / "trash"
    assert paths.settings_file() == home / "settings.json"
    assert paths.index_file() == home / "projects.json"
    assert (home / "projects").is_dir() and (home / "trash").is_dir()


PREVIEW = "/api/preview/grain-tool/files/grain-tool/0.1.0"


@pytest.mark.parametrize("name,body,kind", [
    ("index.html", b"<!doctype html><p>hi</p>", "text/html; charset=utf-8"),
    ("main.js", b"export const a = 1;\n", "text/javascript; charset=utf-8"),
    ("style.css", b"p { color: red }\n", "text/css; charset=utf-8"),
    ("data.json", b'{"a": 1}', "application/json"),
    ("icon.svg", b"<svg xmlns='http://www.w3.org/2000/svg'/>", "image/svg+xml"),
    ("dot.png", b"\x89PNG\r\n\x1a\n\x00\x01", "image/png"),
])
def test_preview_serves_a_package_file_byte_for_byte_with_the_content_type_of_its_kind(client, project, name, body, kind):
    client.put(f"/api/projects/grain-tool/files/package/{name}?raw=1", content=body)
    got = client.get(f"{PREVIEW}/{name}")
    assert got.status_code == 200
    assert got.content == body
    assert got.headers["content-type"] == kind
    assert got.headers["x-content-type-options"] == "nosniff"
    assert got.headers["cache-control"] == "no-store"


def test_preview_html_carries_a_content_security_policy_and_scripts_do_not(client, project):
    client.put("/api/projects/grain-tool/files/package/index.html", json={"text": "<p>hi</p>"})
    client.put("/api/projects/grain-tool/files/package/main.js", json={"text": "1"})
    assert client.get(f"{PREVIEW}/index.html").headers.get("content-security-policy")
    assert "content-security-policy" not in client.get(f"{PREVIEW}/main.js").headers


def test_preview_head_request_reports_the_file_length_without_a_body(client, project):
    client.put("/api/projects/grain-tool/files/package/main.js", json={"text": "12345678"})
    got = client.head(f"{PREVIEW}/main.js")
    assert got.status_code == 200
    assert got.headers["content-length"] == "8"
    assert got.content == b""


def test_preview_shows_the_latest_saved_content_of_a_file(client, project):
    client.put("/api/projects/grain-tool/files/package/main.js", json={"text": "old"})
    assert client.get(f"{PREVIEW}/main.js").content == b"old"
    client.put("/api/projects/grain-tool/files/package/main.js", json={"text": "newer"})
    assert client.get(f"{PREVIEW}/main.js").content == b"newer"


def test_preview_does_not_serve_files_outside_the_package_folder(client, project):
    client.put("/api/projects/grain-tool/files/notes.md", json={"text": "private notes"})
    got = client.get(f"{PREVIEW}/..%2Fnotes.md")
    assert got.status_code == 404
    assert b"private notes" not in got.content


def test_preview_does_not_serve_a_file_kind_it_has_no_content_type_for(client, project):
    client.put("/api/projects/grain-tool/files/package/tool.py", json={"text": "print(1)"})
    got = client.get(f"{PREVIEW}/tool.py")
    assert got.status_code == 404
    assert b"print" not in got.content


def test_preview_refuses_a_missing_file_an_old_version_and_an_unknown_project(client, project):
    client.put("/api/projects/grain-tool/files/package/main.js", json={"text": "1"})
    assert client.get(f"{PREVIEW}/missing.js").status_code == 404
    assert client.get("/api/preview/grain-tool/files/grain-tool/9.9.9/main.js").status_code == 404
    assert client.get("/api/preview/grain-tool/files/other-id/0.1.0/main.js").status_code == 404
    gone = client.get("/api/preview/never-made/files/never-made/0.1.0/main.js")
    assert gone.status_code == 404
    assert gone.content == b""


def test_preview_record_names_the_project_its_product_and_its_manifest(client, project):
    got = client.get("/api/preview/grain-tool").json()
    assert got["project"] == "grain-tool"
    assert got["product"] == "formvis"
    assert got["manifest"] == project["manifest"]
    assert got["record"]["id"] == "grain-tool"
    assert got["record"]["version"] == "0.1.0"


def test_preview_record_for_another_app_says_the_extension_is_not_made_for_it(client, project):
    record = client.get("/api/preview/grain-tool?product=formcut").json()["record"]
    assert record["state"] == "refused"
    assert "formvis" in record["reason"]


def test_preview_record_of_an_unknown_project_is_refused(client):
    res = client.get("/api/preview/never-made")
    assert res.status_code == 404
    assert res.json()["detail"] == "no such project: never-made"


def test_preview_fetch_refuses_addresses_that_are_not_https(client):
    res = client.post("/api/preview/fetch", json={"url": "http://example.invalid/x"})
    assert res.status_code == 400
    assert res.json()["detail"] == "only https:// addresses"


def test_preview_fetch_refuses_this_computer(client):
    res = client.post("/api/preview/fetch", json={"url": "https://127.0.0.1/x"})
    assert res.status_code == 403
    assert res.json()["detail"] == "127.0.0.1 is on this computer or the local network"


def test_inspecting_an_upload_that_is_not_a_zip_reports_that_and_its_size(client):
    res = client.post("/api/library/inspect?name=thing.formpkg", content=b"plain words, no archive", headers={"content-type": "application/octet-stream"})
    body = res.json()
    report = body.get("report", body)
    assert report["bytes"] == len(b"plain words, no archive")
    assert any(e["message"].startswith("this is not a zip file") for e in report["errors"])


def test_inspecting_an_empty_upload_is_refused(client):
    res = client.post("/api/library/inspect", content=b"", headers={"content-type": "application/octet-stream"})
    assert res.status_code == 400
    assert res.json()["detail"] == "the upload is empty"


def test_inspecting_a_path_that_is_not_given_or_not_there_is_refused(client, tmp_path):
    empty = client.post("/api/library/inspect", json={"path": ""})
    assert (empty.status_code, empty.json()["detail"]) == (400, "give the path of a .formpkg file")
    missing = str(tmp_path / "none.formpkg")
    gone = client.post("/api/library/inspect", json={"path": missing})
    assert (gone.status_code, gone.json()["detail"]) == (404, f"no such file: {missing}")


def test_importing_a_file_that_is_not_a_package_is_refused_and_makes_no_project(client):
    res = client.post("/api/library/import?name=thing.formpkg", content=b"plain words, no archive", headers={"content-type": "application/octet-stream"})
    assert res.status_code >= 400
    assert client.get("/api/projects").json()["projects"] == []


def test_importing_a_zip_whose_entry_climbs_out_is_refused_and_nothing_is_written_outside(client, home, tmp_path):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("manifest.json", json.dumps({"format": "formai-package", "format_version": 1, "id": "climber", "name": "Climber", "product": "formvis", "version": "0.1.0"}))
        z.writestr("../../climbed.txt", "out")
    res = client.post("/api/library/import?name=climber.formpkg", content=buf.getvalue(), headers={"content-type": "application/octet-stream"})
    assert res.status_code >= 400
    assert client.get("/api/projects").json()["projects"] == []
    assert not (home / "climbed.txt").exists()
    assert not (tmp_path / "climbed.txt").exists()
    assert not (home.parent / "climbed.txt").exists()


def test_inspecting_a_build_of_an_unknown_project_is_refused(client):
    res = client.get("/api/library/builds/never-made/" + "0" * 64)
    assert res.status_code == 404
    assert "never-made" in res.json()["detail"]


def test_library_change_without_the_window_key_is_refused(outsider):
    res = outsider.post("/api/library/import?name=a.formpkg", content=b"x", headers={"content-type": "application/octet-stream"})
    assert res.status_code == 403
    assert res.json()["detail"] == window_key.REFUSED


def test_run_in_app_status_of_an_unknown_project_is_refused_with_its_id(client):
    res = client.get("/api/runapp/projects/never-made")
    assert res.status_code == 404
    assert res.json()["detail"] == "no such project: never-made"
