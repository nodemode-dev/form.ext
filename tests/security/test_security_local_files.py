import json
import os

import pytest

from app.services import paths, portal, sources


def _portal(home):
    return home.parent / "portal"


def _write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(data if isinstance(data, str) else json.dumps(data), encoding="utf-8")


def _app(overview, product):
    return next(a for a in overview["apps"] if a["product"] == product)


def test_the_family_list_names_every_family_app_in_order(client):
    got = client.get("/api/sources/family").json()
    assert [a["id"] for a in got["apps"]] == [row[0] for row in sources.FAMILY]
    assert [a["repository"] for a in got["apps"]] == [f"nodemode-dev/{row[2]}" for row in sources.FAMILY]


def test_the_family_list_links_an_api_page_exactly_when_the_docs_folder_holds_one(client):
    folder = paths.docs_dir() / "apps"
    for row in client.get("/api/sources/family").json()["apps"]:
        has_page = os.path.isfile(folder / f"{row['id']}.md")
        assert row["api_page"] == (row["id"] if has_page else None)


def test_the_family_list_marks_starters_by_the_templates_folder(client):
    folder = paths.templates_dir()
    for row in client.get("/api/sources/family").json()["apps"]:
        assert row["starters"] == os.path.isdir(folder / row["id"])


def test_the_family_list_reports_the_portal_folder_from_the_environment(client, home):
    got = client.get("/api/sources/family").json()["formportal"]["root"]
    assert got == {"path": str(_portal(home)), "source": "FORMPORTAL_ROOT", "exists": True}


def test_an_app_without_skills_says_so_and_refuses_to_install_them(client):
    got = client.get("/api/sources/formtray/skills").json()
    assert got["note"] == "FormTray ships no skill of its own; read its API page (docs) and its source instead."
    install = client.post("/api/sources/formtray/skills", json={})
    assert install.status_code == 400
    assert install.json()["detail"] == got["note"]


def test_installing_skills_needs_the_window_key(outsider):
    reply = outsider.post("/api/sources/formvis/skills", json={})
    assert reply.status_code == 403


def test_the_portal_root_comes_from_the_environment_folder(client, home):
    assert client.get("/api/runapp/root").json() == {"path": str(_portal(home)), "source": "FORMPORTAL_ROOT", "exists": True}


def test_a_missing_portal_folder_is_reported_as_absent(client, home, monkeypatch):
    monkeypatch.setenv("FORMPORTAL_ROOT", str(home / "nowhere"))
    assert client.get("/api/runapp/root").json()["exists"] is False


def test_the_catalogue_lists_every_app_with_no_installs_when_the_folder_is_empty(client):
    got = client.get("/api/runapp").json()
    assert [a["product"] for a in got["apps"]] == [p for p, _ in portal.APPS]
    assert all(a["installs"] == [] and a["version"] is None for a in got["apps"])
    assert got["state_error"] == ""


def test_the_catalogue_reads_installs_from_the_portal_installed_file(client, home):
    present = home.parent / "formvis-app"
    present.mkdir()
    _write(_portal(home) / "installed.json", {"installs": [
        {"product": "formvis", "channel": "nightly", "current": {"version": "3.0.0-n", "path": str(home / "gone")}},
        {"product": "formvis", "channel": "stable", "current": {"version": "2.1.0", "path": str(present)}, "previous": {"version": "2.0.0"}},
        {"product": "formcut", "channel": "beta"},
    ]})
    app = _app(client.get("/api/runapp").json(), "formvis")
    assert [(i["channel"], i["version"], i["present"]) for i in app["installs"]] == [("stable", "2.1.0", True), ("nightly", "3.0.0-n", False)]
    assert app["installs"][0]["previous"] == "2.0.0"
    assert app["version"] == "2.1.0"
    assert _app(client.get("/api/runapp").json(), "formcut")["installs"] == []


def test_an_unreadable_installed_file_is_reported_not_trusted(client, home):
    _write(_portal(home) / "installed.json", "{not json")
    got = client.get("/api/runapp").json()
    assert got["state_error"] == "FormPortal's installed.json cannot be read"
    assert all(a["installs"] == [] for a in got["apps"])


def test_the_catalogue_reads_installed_extensions_per_app(client, home):
    _write(_portal(home) / "extensions" / "installed.json", {"extensions": [
        {"product": "formwav", "id": "reverb", "name": "Reverb", "version": "1.2.0", "source": "catalogue", "enabled": True, "signed_by": "acme"},
        "junk",
    ]})
    got = _app(client.get("/api/runapp").json(), "formwav")["extensions"]
    assert got == [{"id": "reverb", "name": "Reverb", "version": "1.2.0", "source": "catalogue", "enabled": True, "signed_by": "acme"}]


def test_the_catalogue_reads_enabled_extensions_only_in_the_portal_format(client, home):
    folder = _portal(home) / "extensions" / "formpdf"
    _write(folder / "enabled.json", {"format": "formportal-enabled-extensions", "extensions": [{"id": "stamp", "version": "0.1.0"}]})
    enabled = _app(client.get("/api/runapp").json(), "formpdf")["enabled"]
    assert enabled["extensions"] == [{"id": "stamp", "version": "0.1.0", "source": "catalogue", "path": ""}]
    _write(folder / "enabled.json", {"format": "other", "extensions": [{"id": "stamp"}]})
    assert _app(client.get("/api/runapp").json(), "formpdf")["enabled"]["extensions"] == []


def test_a_dev_list_written_through_the_route_round_trips_through_the_file(client, home):
    body = {"format": "formext-dev-extensions", "format_version": 1, "product": "formvis",
            "extensions": [{"id": "grain", "path": "/x/grain", "added": "2026-01-01T00:00:00Z", "extra": "dropped"}]}
    reply = client.put("/api/runapp/apps/formvis/dev", json=body)
    assert reply.status_code == 200
    on_disk = json.loads((_portal(home) / "extensions" / "formvis" / "dev.json").read_text(encoding="utf-8"))
    assert on_disk == {"format": "formext-dev-extensions", "format_version": 1, "product": "formvis",
                       "extensions": [{"id": "grain", "path": "/x/grain", "added": "2026-01-01T00:00:00Z"}]}
    assert client.get("/api/runapp/apps/formvis/dev").json()["dev"] == on_disk


@pytest.mark.parametrize("change,said", [
    ({"format": "wrong"}, 'format must be "formext-dev-extensions"'),
    ({"format_version": 2}, "format_version must be 1"),
    ({"product": "formcut"}, 'product must be "formvis"'),
    ({"extensions": [{"id": "X!", "path": "/x"}]}, "extensions[0].id must match ^[a-z0-9][a-z0-9-]{1,63}$"),
    ({"extensions": [{"id": "ok", "path": ""}]}, "extensions[0].path must be a non-empty string"),
])
def test_a_dev_list_breaking_the_contract_is_refused_and_not_written(client, home, change, said):
    body = {"format": "formext-dev-extensions", "format_version": 1, "product": "formvis", "extensions": [], **change}
    reply = client.put("/api/runapp/apps/formvis/dev", json=body)
    assert reply.status_code == 422
    assert reply.json()["detail"] == "dev.json would not follow the contract: " + said
    assert not (_portal(home) / "extensions" / "formvis" / "dev.json").exists()


def test_a_dev_list_naming_one_extension_twice_is_refused(client):
    body = {"format": "formext-dev-extensions", "format_version": 1, "product": "formvis",
            "extensions": [{"id": "grain", "path": "/a"}, {"id": "grain", "path": "/b"}]}
    reply = client.put("/api/runapp/apps/formvis/dev", json=body)
    assert reply.status_code == 422
    assert reply.json()["detail"] == "dev.json lists grain twice"


def test_a_dev_list_for_an_unknown_app_is_not_found(client):
    reply = client.put("/api/runapp/apps/notanapp/dev", json={})
    assert reply.status_code == 404
    assert reply.json()["detail"] == "unknown product: notanapp"


def test_a_corrupt_dev_file_is_reported_as_a_problem(client, home):
    _write(_portal(home) / "extensions" / "formvis" / "dev.json", "[oops")
    got = client.get("/api/runapp/apps/formvis/dev").json()
    assert got["exists"] is True
    assert got["problems"] == ["dev.json is not valid JSON"]
    assert got["dev"]["extensions"] == []


def test_reloading_an_app_without_a_dev_file_says_so(client):
    reply = client.post("/api/runapp/apps/formvis/reload")
    assert reply.status_code == 404
    assert reply.json()["detail"] == "FormVis has no dev.json yet"


def test_removing_an_extension_absent_from_the_dev_list_says_so(client):
    reply = client.delete("/api/runapp/apps/formwav/dev/ghost")
    assert reply.status_code == 404
    assert reply.json()["detail"] == "ghost is not in FormWav's dev.json"


def test_removing_a_listed_extension_keeps_the_others(client, home):
    body = {"format": "formext-dev-extensions", "format_version": 1, "product": "formvis",
            "extensions": [{"id": "grain", "path": "/a"}, {"id": "blur", "path": "/b"}]}
    client.put("/api/runapp/apps/formvis/dev", json=body)
    reply = client.delete("/api/runapp/apps/formvis/dev/grain")
    assert reply.status_code == 200
    assert [r["id"] for r in reply.json()["dev"]["extensions"]] == ["blur"]


def test_a_dev_list_write_without_the_window_key_leaves_no_file(outsider, home):
    body = {"format": "formext-dev-extensions", "format_version": 1, "product": "formvis", "extensions": []}
    reply = outsider.put("/api/runapp/apps/formvis/dev", json=body)
    assert reply.status_code == 403
    assert not (_portal(home) / "extensions" / "formvis" / "dev.json").exists()
