import base64
import json
from pathlib import Path


def test_created_project_is_a_folder_on_disk_with_a_manifest_naming_it(client, home):
    made = client.post("/api/projects", json={"name": "Grain Tool", "product": "formvis"}).json()
    assert made["id"] == "grain-tool"
    manifest = json.loads((home / "projects" / "grain-tool" / "package" / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["name"] == "Grain Tool"
    assert manifest["product"] == "formvis"
    assert manifest["id"] == "grain-tool"
    assert made["manifest"] == manifest


def test_created_project_is_listed_and_read_back_with_the_same_name_and_product(client, project):
    listed = client.get("/api/projects").json()["projects"]
    assert [(p["id"], p["name"], p["product"]) for p in listed] == [("grain-tool", "Grain Tool", "formvis")]
    opened = client.get("/api/projects/grain-tool").json()
    assert (opened["name"], opened["product"], opened["package_prefix"]) == ("Grain Tool", "formvis", "package")


def test_two_projects_with_one_name_get_different_ids_and_both_stay_listed(client):
    a = client.post("/api/projects", json={"name": "Same Name", "product": "formcut"}).json()
    b = client.post("/api/projects", json={"name": "Same Name", "product": "formcut"}).json()
    assert a["id"] == "same-name"
    assert b["id"] != a["id"]
    assert {p["id"] for p in client.get("/api/projects").json()["projects"]} == {a["id"], b["id"]}


def test_project_without_a_name_is_refused_and_nothing_is_created(client, home):
    res = client.post("/api/projects", json={"name": "   ", "product": "formvis"})
    assert res.status_code == 400
    assert res.json()["detail"] == "a project needs a name"
    assert client.get("/api/projects").json()["projects"] == []


def test_project_for_an_unknown_product_is_refused_by_name(client):
    res = client.post("/api/projects", json={"name": "Thing", "product": "formnothing"})
    assert res.status_code == 400
    assert res.json()["detail"] == "unknown product: formnothing"
    assert client.get("/api/projects").json()["projects"] == []


def test_project_created_with_files_holds_those_files_inside_its_package(client, home):
    body = {"name": "With Files", "product": "formpdf", "files": {"main.js": "let a = 1;\n", "img/dot.bin": {"base64": base64.b64encode(b"\x00\x01\xff").decode()}}}
    made = client.post("/api/projects", json=body).json()
    root = home / "projects" / made["id"]
    assert (root / "package" / "main.js").read_bytes() == b"let a = 1;\n"
    assert (root / "package" / "img" / "dot.bin").read_bytes() == b"\x00\x01\xff"


def test_project_created_with_a_file_path_that_climbs_out_is_refused_and_leaves_nothing_behind(client, home, tmp_path):
    res = client.post("/api/projects", json={"name": "Climber", "product": "formvis", "files": {"package/../../../escaped.txt": "x"}})
    assert res.status_code == 400
    assert res.json()["detail"] == "path leaves the project"
    assert not (tmp_path / "escaped.txt").exists()
    assert not (home / "escaped.txt").exists()
    assert client.get("/api/projects").json()["projects"] == []


def test_renaming_through_the_manifest_changes_the_name_shown_in_the_list(client, project, home):
    path = home / "projects" / "grain-tool" / "package" / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["name"] = "Film Grain"
    res = client.put("/api/projects/grain-tool/files/package/manifest.json", json={"text": json.dumps(manifest)})
    assert res.status_code == 200
    assert client.get("/api/projects/grain-tool").json()["name"] == "Film Grain"
    assert [p["name"] for p in client.get("/api/projects").json()["projects"]] == ["Film Grain"]
    assert json.loads(path.read_text(encoding="utf-8"))["name"] == "Film Grain"


def test_broken_manifest_is_reported_and_the_project_stays_listed_under_its_first_name(client, project):
    client.put("/api/projects/grain-tool/files/package/manifest.json", json={"text": "{not json"})
    opened = client.get("/api/projects/grain-tool").json()
    assert opened["manifest_error"].startswith("manifest.json is not valid JSON")
    assert opened["manifest"] == {}
    assert opened["name"] == "Grain Tool"


def test_deleted_project_leaves_the_list_and_its_files_move_to_the_trash(client, project, home):
    client.put("/api/projects/grain-tool/files/package/keep.txt", json={"text": "kept"})
    res = client.delete("/api/projects/grain-tool")
    assert res.status_code == 200
    gone = res.json()
    assert gone["removed"] == "trash"
    assert client.get("/api/projects").json()["projects"] == []
    assert not (home / "projects" / "grain-tool").exists()
    moved = Path(gone["dir"])
    assert moved.parent == (home / "trash").resolve() or moved.parent == home / "trash"
    assert (moved / "package" / "keep.txt").read_text(encoding="utf-8") == "kept"
    assert client.get("/api/projects/grain-tool").status_code == 404


def test_opening_an_unknown_project_is_refused_with_its_id(client):
    res = client.get("/api/projects/never-made")
    assert res.status_code == 404
    assert res.json()["detail"] == "no such project: never-made"


def test_deleting_an_unknown_project_is_refused_with_its_id(client):
    res = client.delete("/api/projects/never-made")
    assert res.status_code == 404
    assert res.json()["detail"] == "no such project: never-made"


def test_listing_files_of_an_unknown_project_is_refused(client):
    res = client.get("/api/projects/never-made/files")
    assert res.status_code == 404
    assert res.json()["detail"] == "no such project: never-made"


def test_project_id_that_is_not_a_plain_slug_is_refused(client):
    res = client.get("/api/projects/Not_A_Slug")
    assert res.status_code == 404
    assert res.json()["detail"] == "no such project"


def test_recent_list_puts_the_last_opened_project_first(client):
    a = client.post("/api/projects", json={"name": "First One", "product": "formvis"}).json()["id"]
    b = client.post("/api/projects", json={"name": "Second One", "product": "formvis"}).json()["id"]
    assert [p["id"] for p in client.get("/api/projects/recent").json()["projects"]] == [b, a]
    client.get(f"/api/projects/{a}")
    assert [p["id"] for p in client.get("/api/projects/recent").json()["projects"]] == [a, b]
    assert [p["id"] for p in client.get("/api/projects/recent?limit=1").json()["projects"]] == [a]


def test_peeking_at_a_project_without_touch_keeps_the_recent_order(client):
    a = client.post("/api/projects", json={"name": "First One", "product": "formvis"}).json()["id"]
    b = client.post("/api/projects", json={"name": "Second One", "product": "formvis"}).json()["id"]
    client.get(f"/api/projects/{a}?touch=false")
    assert [p["id"] for p in client.get("/api/projects/recent").json()["projects"]] == [b, a]


def test_changing_request_without_the_window_key_is_refused_and_creates_nothing(outsider, home):
    res = outsider.post("/api/projects", json={"name": "Sneak", "product": "formvis"})
    assert res.status_code == 403
    assert res.json()["detail"] == "Only the form.ext window can do this"
    assert outsider.get("/api/projects").json()["projects"] == []
    assert not (home / "projects" / "sneak").exists()


def test_imported_folder_is_copied_so_later_edits_to_the_source_do_not_show(client, home, tmp_path):
    src = tmp_path / "src-pack"
    src.mkdir()
    (src / "manifest.json").write_text(json.dumps({"id": "outside-pack", "name": "Outside Pack", "product": "formwav", "version": "2.3.4"}), encoding="utf-8")
    (src / "a.txt").write_text("one", encoding="utf-8")
    made = client.post("/api/projects/import", json={"path": str(src)})
    assert made.status_code == 200, made.text
    got = made.json()
    assert (got["id"], got["name"], got["product"], got["version"], got["linked"]) == ("outside-pack", "Outside Pack", "formwav", "2.3.4", False)
    (src / "a.txt").write_text("two", encoding="utf-8")
    assert client.get("/api/projects/outside-pack/files/package/a.txt").json()["text"] == "one"


def test_linked_folder_is_edited_in_place_and_delete_only_drops_the_link(client, home, tmp_path):
    src = tmp_path / "linked-pack"
    src.mkdir()
    (src / "manifest.json").write_text(json.dumps({"id": "linked-pack", "name": "Linked", "product": "formmd"}), encoding="utf-8")
    got = client.post("/api/projects", json={"path": str(src), "link": True}).json()
    assert got["linked"] is True
    assert got["package_prefix"] == ""
    client.put("/api/projects/linked-pack/files/note.txt", json={"text": "in place"})
    assert (src / "note.txt").read_text(encoding="utf-8") == "in place"
    gone = client.delete("/api/projects/linked-pack").json()
    assert gone["removed"] == "link"
    assert (src / "note.txt").read_text(encoding="utf-8") == "in place"
    assert client.get("/api/projects").json()["projects"] == []


def test_importing_a_folder_without_a_manifest_is_refused(client, tmp_path):
    src = tmp_path / "bare"
    src.mkdir()
    res = client.post("/api/projects/import", json={"path": str(src)})
    assert res.status_code == 400
    assert res.json()["detail"] == "the folder has no manifest.json (at its root or in package/)"


def test_importing_a_folder_that_is_not_there_is_refused(client, tmp_path):
    missing = str(tmp_path / "nowhere")
    res = client.post("/api/projects/import", json={"path": missing})
    assert res.status_code == 404
    assert res.json()["detail"] == f"no such folder: {missing}"
