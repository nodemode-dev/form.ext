from pathlib import Path

import pytest

from .conftest import make_remote

LINES = [f"line {n} of the host" for n in range(1, 11)]


@pytest.fixture
def local(tmp_path, setting):
    def make(key: str, files: dict | None = None) -> Path:
        folder = tmp_path / f"own-{key}"
        folder.mkdir()
        for rel, data in (files or {}).items():
            target = folder / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data if isinstance(data, bytes) else data.encode("utf-8"))
        setting("sources", {"local": {key: str(folder)}})
        return folder

    return make


def test_the_list_agrees_with_each_source_asked_alone(client):
    listed = client.get("/api/sources").json()["sources"]
    assert len(listed) == len({s["key"] for s in listed}) >= 13
    for row in listed:
        alone = client.get(f"/api/sources/{row['key']}").json()
        assert alone["repository"] == row["repository"]
        assert alone["url"].endswith("/" + row["repository"].split("/", 1)[1])
        assert alone["state"] == row["state"]


def test_the_registry_and_formportal_are_family_sources_not_hosts(client):
    kinds = {s["key"]: s["kind"] for s in client.get("/api/sources").json()["sources"]}
    assert kinds["registry"] == "family" and kinds["formportal"] == "family"
    assert kinds["formvis"] == "host"


def test_an_unknown_source_is_refused_and_the_message_lists_the_real_ones(client):
    res = client.get("/api/sources/formnothing")
    assert res.status_code == 404
    detail = res.json()["detail"]
    assert detail.startswith("formnothing is not a Form app")
    assert all(s["key"] in detail for s in client.get("/api/sources").json()["sources"])


def test_a_repository_name_resolves_to_its_source(client):
    assert client.get("/api/sources/form.ext-registry").json()["key"] == "registry"
    assert client.get("/api/sources/form.md").json()["key"] == "formmd"
    assert client.get("/api/sources/FormCut").json()["key"] == "formcut"


def test_a_project_id_resolves_to_its_host_app(client, make_project):
    p = make_project(product="formwav")
    assert client.get(f"/api/sources/{p['id']}").json()["key"] == "formwav"


def test_reading_before_a_pull_is_refused_with_what_to_do(client):
    for path in ("/files", "/file?path=README.md", "/search?q=x"):
        res = client.get(f"/api/sources/formdeck{path}")
        assert res.status_code == 404, path
        assert "is not here yet; pull it first" in res.json()["detail"], path


def test_a_failed_pull_is_refused_and_the_source_shows_as_failed(client):
    res = client.post("/api/sources/formlit/pull")
    assert res.status_code == 502
    assert "check the internet connection" in res.json()["detail"]
    seen = client.get("/api/sources/formlit").json()
    assert seen["state"] == "failed" and seen["dir"] is None
    assert seen["error"] == res.json()["detail"]
    assert client.delete("/api/sources/formlit").json()["state"] == "absent"


def test_a_base_address_with_another_scheme_is_refused(client, monkeypatch):
    monkeypatch.setenv("FORMEXT_SOURCES_BASE", "ftp://example.invalid/forms")
    res = client.get("/api/sources/formpdf")
    assert 400 <= res.status_code < 500
    assert "must be an https://, http:// or file:// address" in res.json()["detail"]


def test_pull_clones_the_repository_then_reads_it_and_remove_takes_it_away(client, remotes):
    commit = make_remote(remotes, "formencoder", {"README.md": "# FormEncoder\n", "src/extensions.ts": "export const host = 1;\n", "LICENSE": "MIT License\n"})
    try:
        res = client.post("/api/sources/formencoder/pull")
        assert res.status_code == 200, res.text
        out = res.json()
        assert out["state"] == "ready" and out["method"] == "git"
        assert out["commit"] == commit and out["subject"] == "first"
        assert out["licence"] == "MIT"
        assert "src/extensions.ts" in out["extension_host"]
        assert "README.md" in out["docs"]
        folder = Path(out["dir"])
        assert (folder / "src" / "extensions.ts").read_text(encoding="utf-8") == "export const host = 1;\n"
        names = [f["path"] for f in client.get("/api/sources/formencoder/files").json()["files"]]
        assert names == ["LICENSE", "README.md", "src/extensions.ts"]
        again = client.post("/api/sources/formencoder/pull", json={"update": True}).json()
        assert again["commit"] == commit
    finally:
        gone = client.delete("/api/sources/formencoder")
    assert gone.json()["state"] == "absent"
    assert not folder.exists()
    assert client.get("/api/sources/formencoder/files").status_code == 404


def test_your_own_folder_is_ready_listed_and_never_deleted(client, local):
    folder = local("formcut", {"README.md": "# mine\n", "src/a.ts": "const a = 1;\n", "node_modules/x/index.js": "x\n", ".git/config": "c\n"})
    seen = client.get("/api/sources/formcut").json()
    assert seen["state"] == "ready" and seen["method"] == "local" and seen["dir"] == str(folder)
    listed = client.get("/api/sources/formcut/files").json()
    assert [f["path"] for f in listed["files"]] == ["README.md", "src/a.ts"]
    assert {f["path"]: f["size"] for f in listed["files"]} == {"README.md": 7, "src/a.ts": 13}
    assert listed["total"] == 2 and listed["truncated"] is False
    res = client.delete("/api/sources/formcut")
    assert 400 <= res.status_code < 500
    assert "form.ext does not delete it" in res.json()["detail"]
    assert (folder / "src" / "a.ts").is_file()


def test_files_can_be_narrowed_by_folder_glob_and_limit(client, local):
    local("formcut", {"a.md": "a\n", "src/b.ts": "b\n", "src/c.ts": "c\n", "src/d.md": "d\n"})
    under = client.get("/api/sources/formcut/files", params={"under": "src"}).json()
    assert [f["path"] for f in under["files"]] == ["src/b.ts", "src/c.ts", "src/d.md"]
    globbed = client.get("/api/sources/formcut/files", params={"glob": "*.md"}).json()
    assert [f["path"] for f in globbed["files"]] == ["a.md", "src/d.md"]
    capped = client.get("/api/sources/formcut/files", params={"limit": 1}).json()
    assert len(capped["files"]) == 1 and capped["total"] == 4 and capped["truncated"] is True
    missing = client.get("/api/sources/formcut/files", params={"under": "nope"})
    assert missing.status_code == 404 and "there is no folder nope" in missing.json()["detail"]


def test_a_file_is_read_by_line_window(client, local):
    local("formcut", {"docs/host.txt": "\n".join(LINES) + "\n"})
    out = client.get("/api/sources/formcut/file", params={"path": "docs/host.txt", "start": 3, "lines": 4}).json()
    assert out["text"] == "\n".join(LINES[2:6])
    assert (out["start"], out["end"], out["total_lines"]) == (3, 6, 10)
    assert out["size"] == len("\n".join(LINES)) + 1
    whole = client.get("/api/sources/formcut/file", params={"path": "docs/host.txt"}).json()
    assert whole["text"].splitlines() == LINES


def test_a_binary_file_is_reported_not_returned_as_text(client, local):
    local("formcut", {"icon.bin": b"\x00\x01\x02\x03"})
    out = client.get("/api/sources/formcut/file", params={"path": "icon.bin"}).json()
    assert out["binary"] is True and out["size"] == 4
    assert "text" not in out


def test_paths_outside_the_source_are_refused(client, local, tmp_path):
    local("formcut", {"README.md": "x\n", ".git/config": "secret\n"})
    (tmp_path / "outside.txt").write_text("outside\n", encoding="utf-8")
    for path in ("../outside.txt", "src/../../outside.txt", ".git/config"):
        res = client.get("/api/sources/formcut/file", params={"path": path})
        assert 400 <= res.status_code < 500, path
        assert "is not a path inside the source" in res.json()["detail"], path
    res = client.get("/api/sources/formcut/file", params={"path": "absent.md"})
    assert res.status_code == 404 and "there is no file absent.md" in res.json()["detail"]


def test_a_link_leading_out_of_the_source_is_refused(client, local, tmp_path):
    folder = local("formcut", {"README.md": "x\n"})
    (tmp_path / "outside.txt").write_text("outside\n", encoding="utf-8")
    (folder / "leak.txt").symlink_to(tmp_path / "outside.txt")
    res = client.get("/api/sources/formcut/file", params={"path": "leak.txt"})
    assert 400 <= res.status_code < 500
    assert "leads outside the source" in res.json()["detail"]
    assert "leak.txt" not in [f["path"] for f in client.get("/api/sources/formcut/files").json()["files"]]


def test_search_finds_the_lines_and_their_numbers(client, local):
    local("formcut", {"a.txt": "alpha\nBeta here\ngamma\n", "src/b.ts": "const beta = 2;\n", "pic.png": "beta\n"})
    out = client.get("/api/sources/formcut/search", params={"q": "beta"}).json()
    assert [(m["path"], m["line"], m["text"]) for m in out["matches"]] == [("a.txt", 2, "Beta here"), ("src/b.ts", 1, "const beta = 2;")]
    assert out["truncated"] is False and out["files_scanned"] == 2
    exact = client.get("/api/sources/formcut/search", params={"q": "beta", "case": True}).json()
    assert [m["path"] for m in exact["matches"]] == ["src/b.ts"]
    only = client.get("/api/sources/formcut/search", params={"q": "beta", "glob": "*.txt"}).json()
    assert [m["path"] for m in only["matches"]] == ["a.txt"]


def test_search_takes_words_literally_unless_regex_is_asked(client, local):
    local("formcut", {"a.txt": "a.c\nabc\n"})
    plain = client.get("/api/sources/formcut/search", params={"q": "a.c"}).json()
    assert [m["line"] for m in plain["matches"]] == [1]
    pattern = client.get("/api/sources/formcut/search", params={"q": "a.c", "regex": True}).json()
    assert [m["line"] for m in pattern["matches"]] == [1, 2]


def test_search_stops_at_the_limit_and_says_so(client, local):
    local("formcut", {"a.txt": "hit\n" * 9})
    out = client.get("/api/sources/formcut/search", params={"q": "hit", "limit": 4}).json()
    assert len(out["matches"]) == 4
    assert out["truncated"] is True and out["stopped"] == "limit"


def test_search_refuses_empty_words_and_bad_patterns(client, local):
    local("formcut", {"a.txt": "x\n"})
    cases = [({"q": "  "}, "give the words to search for"), ({"q": "(", "regex": True}, "not a valid regular expression"), ({"q": "(a+)+", "regex": True}, "repeats a group that itself repeats"), ({"q": "a" * 201, "regex": True}, "longer than 200 characters")]
    for params, words in cases:
        res = client.get("/api/sources/formcut/search", params=params)
        assert 400 <= res.status_code < 500, params
        assert words in res.json()["detail"], params


def test_a_gpl_source_carries_the_copying_warning_and_an_mit_one_does_not(client, local):
    local("formcut", {"LICENSE": "GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n"})
    local("formdeck", {"LICENSE": "MIT License\n\nPermission is hereby granted, free of charge\n"})
    gpl = client.get("/api/sources/formcut").json()
    mit = client.get("/api/sources/formdeck").json()
    assert gpl["licence"] == "GPL-3.0" and "puts the extension under GPL-3.0" in gpl["note"]
    assert mit["licence"] == "MIT" and "GPL" not in mit["note"]


def test_pull_on_your_own_folder_changes_nothing_and_reaches_nowhere(client, local):
    folder = local("formcut", {"README.md": "x\n"})
    out = client.post("/api/sources/formcut/pull", json={"update": True})
    assert out.status_code == 200
    assert out.json()["method"] == "local" and out.json()["dir"] == str(folder)
    assert sorted(f.name for f in folder.iterdir()) == ["README.md"]
