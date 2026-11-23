import hashlib
import io
import json
import zipfile
from pathlib import Path

import pytest

from app.services.workspace import workspace

ROOT = Path(__file__).resolve().parent.parent.parent
TEMPLATES = ROOT / "templates"
PAIRS = sorted((p.name, s.name) for p in TEMPLATES.iterdir() if p.is_dir() and not p.name.startswith("_") for s in p.iterdir() if (s / "manifest.json").is_file())
ALLOWED = set(".html .js .mjs .css .json .svg .png .webp .jpg .jpeg .gif .wasm .txt .md .wav .ogg .mp3 .webm .mp4 .cube .woff2".split())


def build(client, pid, **body):
    return client.post(f"/api/projects/{pid}/package", json=body)


def archive(client, pid, sha):
    r = client.get(f"/api/projects/{pid}/builds/{sha}/file")
    assert r.status_code == 200
    return r.content, zipfile.ZipFile(io.BytesIO(r.content))


def test_the_shipped_templates_are_twelve_apps_with_three_starters_each():
    assert len(PAIRS) == 36
    assert {s for _, s in PAIRS} == {"panel", "command", "panel-commands"}


@pytest.mark.parametrize("product,starter", PAIRS)
def test_a_project_made_from_a_shipped_template_passes_the_check(client, project, product, starter):
    made = project(product, starter)
    r = client.post(f"/api/projects/{made['id']}/validate")
    result = r.json()
    assert result["counts"]["error"] == 0, result["problems"]
    assert result["ok"] is True
    assert result["id"] == made["id"]
    assert result["product"] == product
    assert result["project"] == made["id"]


def test_the_catalogue_lists_every_template_folder_on_disk(client):
    data = client.get("/api/templates").json()
    listed = sorted((p["id"], s["starter"]) for p in data["products"] for s in p["starters"])
    assert listed == PAIRS


def test_starter_detail_returns_the_manifest_text_that_is_on_disk(client):
    data = client.get("/api/templates/formpdf/panel").json()
    files = {f["path"]: f for f in data["files"]}
    on_disk = (TEMPLATES / "formpdf" / "panel" / "manifest.json").read_bytes()
    assert files["manifest.json"]["text"] == on_disk.decode("utf-8")
    assert files["manifest.json"]["size"] == len(on_disk)
    assert "template.json" not in files


def test_an_unknown_starter_is_refused_by_name(client):
    r = client.get("/api/templates/formpdf/wizard")
    assert r.status_code == 404
    assert r.json()["detail"] == "no starter named wizard"


def test_an_unknown_app_is_refused_by_name(client):
    r = client.post("/api/templates/create", json={"product": "formnothing", "starter": "panel", "name": "x y"})
    assert r.status_code == 404
    assert r.json()["detail"] == "no templates for formnothing"


def test_a_project_without_a_name_is_refused(client):
    r = client.post("/api/templates/create", json={"product": "formvis", "starter": "panel", "name": "   "})
    assert r.status_code == 400
    assert r.json()["detail"] == "a project needs a name"


def test_a_name_of_65_characters_is_refused_and_64_is_accepted(client, unique):
    stem = unique("n")
    r = client.post("/api/templates/create", json={"product": "formvis", "starter": "panel", "name": stem + "x" * (65 - len(stem))})
    assert r.status_code == 400
    assert r.json()["detail"] == "the name is longer than 64 characters"
    ok = client.post("/api/templates/create", json={"product": "formvis", "starter": "panel", "name": stem + "x" * (64 - len(stem))})
    assert ok.status_code == 200


def test_the_scaffolded_manifest_carries_the_given_name_description_and_project_id(client, project, unique):
    name = unique("Named Thing")
    r = client.post("/api/templates/create", json={"product": "formwav", "starter": "panel", "name": name, "description": "Does one thing."})
    made = r.json()
    manifest = json.loads((workspace.package_dir(made["id"]) / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["name"] == name
    assert manifest["description"] == "Does one thing."
    assert manifest["id"] == made["id"]
    assert manifest["product"] == "formwav"


def test_two_projects_with_the_same_name_get_different_ids_and_each_manifest_matches_its_own(client, project, unique):
    name = unique("Twin")
    a, b = project(name=name), project(name=name)
    assert a["id"] != b["id"]
    for made in (a, b):
        manifest = json.loads((workspace.package_dir(made["id"]) / "manifest.json").read_text(encoding="utf-8"))
        assert manifest["id"] == made["id"]
        assert client.post(f"/api/projects/{made['id']}/validate").json()["ok"] is True


def test_a_project_made_from_the_contract_example_passes_the_check(client, unique):
    listed = client.get("/api/templates/examples").json()["examples"]
    assert "hello" in [e["id"] for e in listed]
    made = client.post("/api/templates/examples/hello", json={"name": unique("Hello copy")}).json()
    result = client.post(f"/api/projects/{made['id']}/validate").json()
    assert result["ok"] is True
    assert result["id"] == made["id"]


def test_an_unknown_example_is_refused_by_name(client):
    r = client.post("/api/templates/examples/nothing-here", json={})
    assert r.status_code == 404
    assert r.json()["detail"] == "no example named nothing-here"


@pytest.fixture
def built(client, project):
    made = project("formvis", "panel-commands")
    r = build(client, made["id"])
    assert r.status_code == 200, r.text
    return made, r.json()


def test_the_package_file_hashes_to_the_reported_sha_and_size(client, built):
    made, record = built
    data, _ = archive(client, made["id"], record["sha256"])
    assert hashlib.sha256(data).hexdigest() == record["sha256"]
    assert len(data) == record["bytes"]


def test_the_package_holds_exactly_the_files_of_the_package_folder(client, built):
    made, record = built
    _, z = archive(client, made["id"], record["sha256"])
    folder = workspace.package_dir(made["id"])
    on_disk = {p.relative_to(folder).as_posix(): p.read_bytes() for p in folder.rglob("*") if p.is_file()}
    assert set(z.namelist()) == set(on_disk)
    for name, data in on_disk.items():
        assert z.read(name) == data
    assert z.testzip() is None


def test_the_manifest_inside_the_package_names_the_project(client, built):
    made, record = built
    _, z = archive(client, made["id"], record["sha256"])
    manifest = json.loads(z.read("manifest.json"))
    assert manifest["id"] == made["id"]
    assert manifest["format"] == "formai-package"
    assert manifest["entry"]["ui"] in z.namelist()
    assert record["file"] == f"{manifest['id']}-{manifest['version']}.formpkg"


def test_no_entry_name_is_absolute_climbs_out_or_has_a_type_outside_the_contract_list(client, built):
    made, record = built
    _, z = archive(client, made["id"], record["sha256"])
    for name in z.namelist():
        assert not name.startswith("/")
        assert "\\" not in name
        assert ".." not in name.split("/")
        assert len(name) <= 200
        assert Path(name).suffix.lower() in ALLOWED


def test_entries_are_sorted_dated_1980_mode_0644_and_deflated_as_the_contract_states(client, built):
    made, record = built
    _, z = archive(client, made["id"], record["sha256"])
    infos = z.infolist()
    assert [i.filename for i in infos] == sorted(i.filename for i in infos)
    for i in infos:
        assert i.date_time == (1980, 1, 1, 0, 0, 0)
        assert (i.external_attr >> 16) & 0o777 == 0o644
        assert i.compress_type == zipfile.ZIP_DEFLATED


def test_the_build_record_lists_each_entry_with_its_own_sha_and_size(client, built):
    made, record = built
    _, z = archive(client, made["id"], record["sha256"])
    expected = [{"path": i.filename, "size": i.file_size, "sha256": hashlib.sha256(z.read(i.filename)).hexdigest()} for i in z.infolist()]
    assert [{k: e[k] for k in ("path", "size", "sha256")} for e in record["entries"]] == expected


def test_building_the_same_folder_twice_gives_the_same_sha_and_counts_two_builds(client, built):
    made, record = built
    again = build(client, made["id"]).json()
    assert again["sha256"] == record["sha256"]
    assert (record["fresh"], again["fresh"]) == (True, False)
    assert again["times_built"] == 2
    listed = client.get(f"/api/projects/{made['id']}/builds").json()["builds"]
    assert [b["sha256"] for b in listed] == [record["sha256"]]


def test_changing_one_file_changes_the_sha(client, built):
    made, record = built
    (workspace.package_dir(made["id"]) / "ui" / "extra.txt").write_text("more", encoding="utf-8")
    again = build(client, made["id"]).json()
    assert again["sha256"] != record["sha256"]
    _, z = archive(client, made["id"], again["sha256"])
    assert z.read("ui/extra.txt") == b"more"


def test_the_kit_command_line_reproduces_the_stored_build_bit_for_bit(client, built):
    made, record = built
    r = client.post(f"/api/projects/{made['id']}/package/reproduce").json()
    assert r["reproducible"] is True
    assert r["differences"] == []
    assert {run["sha256"] for run in r["runs"]} == {record["sha256"]}
    assert r["matches_build"] == record["sha256"]
    assert r["source_changed"] is False


def test_a_hidden_file_in_the_package_folder_is_left_out_of_the_package(client, project):
    made = project()
    (workspace.package_dir(made["id"]) / ".secret.txt").write_text("key", encoding="utf-8")
    record = build(client, made["id"]).json()
    _, z = archive(client, made["id"], record["sha256"])
    assert ".secret.txt" not in z.namelist()


def test_a_manifest_every_host_would_refuse_cannot_be_packaged_even_with_anyway(client, project):
    made = project()
    path = workspace.package_dir(made["id"]) / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["version"] = "one"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    for body in ({}, {"anyway": True}):
        r = build(client, made["id"], **body)
        assert r.status_code == 422
        assert r.json()["detail"] == "1 contract error: every host would refuse this package. Fix it first (Check lists where)."
        assert r.json()["check"]["ok"] is False
    assert client.get(f"/api/projects/{made['id']}/builds").json()["builds"] == []


def test_a_code_error_stops_packaging_until_the_person_says_anyway(client, project):
    made = project()
    (workspace.package_dir(made["id"]) / "ui" / "bad.js").write_text("eval('1');\n", encoding="utf-8")
    r = build(client, made["id"])
    assert r.status_code == 422
    assert r.json()["detail"] == "Check found 1 code error (parts of the extension may not run). Fix it, or package anyway."
    forced = build(client, made["id"], anyway=True)
    assert forced.status_code == 200
    assert forced.json()["anyway"] is True
    _, z = archive(client, made["id"], forced.json()["sha256"])
    assert z.read("ui/bad.js") == b"eval('1');\n"


def test_a_file_type_outside_the_contract_list_stops_packaging(client, project):
    made = project()
    (workspace.package_dir(made["id"]) / "ui" / "tool.exe").write_bytes(b"MZ")
    r = build(client, made["id"], anyway=True)
    assert r.status_code == 422
    assert client.get(f"/api/projects/{made['id']}/builds").json()["builds"] == []


def test_a_removed_build_can_no_longer_be_fetched(client, built):
    made, record = built
    sha = record["sha256"]
    assert client.delete(f"/api/projects/{made['id']}/builds/{sha}").json() == {"project": made["id"], "sha256": sha, "removed": True}
    r = client.get(f"/api/projects/{made['id']}/builds/{sha}/file")
    assert r.status_code == 404
    assert r.json()["detail"] == f"no build {sha[:12]} of {made['id']}"


@pytest.mark.parametrize("sha", ["abc", "g" * 64, "A" * 64])
def test_a_build_address_that_is_not_a_sha256_is_refused(client, built, sha):
    made, _ = built
    r = client.get(f"/api/projects/{made['id']}/builds/{sha}")
    assert r.status_code == 404
    assert r.json()["detail"] == "no such build"


def test_the_index_entry_carries_the_sha_size_and_default_https_address(client, built):
    made, record = built
    r = client.get(f"/api/projects/{made['id']}/builds/{record['sha256']}/entry").json()
    text = json.dumps(r["entry"])
    assert record["sha256"] in text
    assert f"https://formai.studio/extensions/packages/{made['id']}-{record['version']}.formpkg" in text
    assert r["url_default"] is True
    assert "signature" not in r["entry"]


def test_an_index_address_that_is_not_https_is_refused(client, built):
    made, record = built
    r = client.get(f"/api/projects/{made['id']}/builds/{record['sha256']}/entry", params={"url": "http://example.org/a.formpkg"})
    assert r.status_code == 400
    assert r.json()["detail"] == "The package address in the index must start with https://."
