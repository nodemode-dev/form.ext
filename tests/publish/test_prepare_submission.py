import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((ROOT / "contract" / "schema" / "extensions.schema.json").read_text(encoding="utf-8"))
ENTRY = SCHEMA["$defs"]["entry"]


def prepare(client, pid, **body):
    res = client.post(f"/api/publish/{pid}", json={"sign": False, **body})
    assert res.status_code == 200, res.text
    return res.json()


def test_prepare_writes_the_five_files_the_manual_lists(client, make_project):
    p = make_project()
    out = prepare(client, p["id"])
    folder = Path(out["folder"])
    package = f"{p['id']}-0.1.0.formpkg"
    assert sorted(f.name for f in folder.iterdir()) == sorted([package, "entry.json", "extensions.json", "README.md", "submission.json"])
    assert folder.parent.name == "submissions" and folder.name == f"{p['id']}-0.1.0"


def test_entry_sha256_and_bytes_match_the_package_file_on_disk(client, make_project):
    p = make_project()
    out = prepare(client, p["id"])
    raw = (Path(out["folder"]) / out["package"]).read_bytes()
    entry = json.loads((Path(out["folder"]) / "entry.json").read_text(encoding="utf-8"))
    assert entry["sha256"] == hashlib.sha256(raw).hexdigest()
    assert entry["bytes"] == len(raw)


def test_entry_has_every_field_the_index_schema_requires_and_no_other(client, make_project):
    p = make_project()
    out = prepare(client, p["id"])
    entry = json.loads((Path(out["folder"]) / "entry.json").read_text(encoding="utf-8"))
    assert set(ENTRY["required"]) <= set(entry)
    assert set(entry) <= set(ENTRY["properties"])
    for key in ("id", "version", "url", "sha256"):
        assert re.search(ENTRY["properties"][key]["pattern"], entry[key]), key
    assert entry["product"] in ENTRY["properties"]["product"]["enum"]
    assert all(isinstance(entry[k], str) and entry[k] for k in ("name", "author", "description", "licence"))


def test_one_package_index_holds_the_same_entry_and_the_schema_constants(client, make_project):
    p = make_project()
    out = prepare(client, p["id"])
    folder = Path(out["folder"])
    index = json.loads((folder / "extensions.json").read_text(encoding="utf-8"))
    entry = json.loads((folder / "entry.json").read_text(encoding="utf-8"))
    assert index["format"] == SCHEMA["properties"]["format"]["const"]
    assert index["format_version"] == SCHEMA["properties"]["format_version"]["const"]
    assert set(SCHEMA["required"]) <= set(index) <= set(SCHEMA["properties"])
    assert index["packages"] == [entry]


def test_unsigned_submission_carries_no_signature_and_no_publisher(client, make_project):
    p = make_project()
    out = prepare(client, p["id"])
    folder = Path(out["folder"])
    index = json.loads((folder / "extensions.json").read_text(encoding="utf-8"))
    assert out["signed_by"] is None
    assert index["publishers"] == []
    assert "signature" not in index["packages"][0]
    assert "Not signed" in (folder / "README.md").read_text(encoding="utf-8")


def test_default_address_agrees_between_status_and_the_prepared_entry(client, make_project):
    p = make_project()
    before = client.get(f"/api/publish/{p['id']}").json()
    out = prepare(client, p["id"])
    assert out["url"] == before["default_url"]
    assert out["url"].startswith("https://formai.studio/extensions/")
    assert out["url"].endswith(f"{p['id']}-0.1.0.formpkg")
    assert out["url_default"] is True


def test_a_given_https_address_goes_into_the_entry(client, make_project):
    p = make_project()
    url = "https://downloads.example.org/ext/mine.formpkg"
    out = prepare(client, p["id"], url=url)
    entry = json.loads((Path(out["folder"]) / "entry.json").read_text(encoding="utf-8"))
    assert entry["url"] == url
    assert out["url_default"] is False


def test_an_address_that_is_not_https_is_refused_with_a_message(client, make_project):
    p = make_project()
    res = client.post(f"/api/publish/{p['id']}", json={"sign": False, "url": "http://downloads.example.org/mine.formpkg"})
    assert 400 <= res.status_code < 500
    assert "https" in res.json()["detail"]
    assert client.get(f"/api/publish/{p['id']}").json()["submission"] is None


def test_preparing_twice_gives_the_same_sha256(client, make_project):
    p = make_project()
    first = prepare(client, p["id"])
    second = prepare(client, p["id"])
    assert first["sha256"] == second["sha256"]
    assert second["files"] == first["files"]


def test_readme_names_the_sha256_and_the_package_for_the_reviewer(client, make_project):
    p = make_project()
    out = prepare(client, p["id"])
    folder = Path(out["folder"])
    text = (folder / "README.md").read_text(encoding="utf-8")
    digest = hashlib.sha256((folder / out["package"]).read_bytes()).hexdigest()
    assert digest in text
    assert out["package"] in text
    assert p["name"] in text.splitlines()[0]


def test_readme_says_a_permission_in_plain_words(client, make_project):
    p = make_project(permissions=["network"], description="Fetches things.")
    out = prepare(client, p["id"])
    text = (Path(out["folder"]) / "README.md").read_text(encoding="utf-8")
    assert "- `network`: reach the internet" in text
    entry = json.loads((Path(out["folder"]) / "entry.json").read_text(encoding="utf-8"))
    assert entry["permissions"] == ["network"]
    assert entry["description"] == "Fetches things."


def test_status_before_prepare_has_no_submission_and_names_the_registry(client, make_project):
    p = make_project()
    out = client.get(f"/api/publish/{p['id']}").json()
    assert out["submission"] is None
    assert out["registry"]["submission"] is None
    assert out["registry"]["repo"] == "nodemode-dev/form.ext-registry"
    assert Path(out["registry"]["folder"]).parts[-4:] == ("submissions", "registry", "extensions", p["id"])


def test_status_after_prepare_reports_the_same_submission(client, make_project):
    p = make_project()
    out = prepare(client, p["id"])
    seen = client.get(f"/api/publish/{p['id']}").json()["submission"]
    assert seen["sha256"] == out["sha256"]
    assert seen["folder"] == out["folder"]
    assert seen["stale"] is False


def test_send_before_prepare_is_refused(client, make_project):
    p = make_project()
    res = client.post(f"/api/publish/{p['id']}/send")
    assert res.status_code == 404
    assert res.json()["detail"] == "prepare a submission first"


def test_reveal_before_prepare_is_refused(client, make_project):
    p = make_project()
    res = client.post(f"/api/publish/{p['id']}/reveal")
    assert res.status_code == 404
    assert res.json()["detail"] == "prepare a submission first"


def test_registry_reveal_before_submit_is_refused(client, make_project):
    p = make_project()
    res = client.post(f"/api/publish/{p['id']}/registry/reveal")
    assert res.status_code == 404
    assert res.json()["detail"] == "submit to the registry first"


def test_an_unknown_project_is_refused_at_every_publish_step(client):
    for method, path in (("get", ""), ("post", ""), ("post", "/registry"), ("post", "/send")):
        res = getattr(client, method)(f"/api/publish/no-such-project-here{path}")
        assert res.status_code == 404, path
        assert "no such project" in res.json()["detail"], path
