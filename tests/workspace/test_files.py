import base64
import os

import pytest

from app.services.workspace import NotFound, Unsafe, clean_rel, safe_join, slug

BASE = "/api/projects/grain-tool/files"


def test_text_written_to_a_project_file_reads_back_the_same_and_is_on_disk(client, project, home):
    text = "line one\nline two \u00e9\n"
    wrote = client.put(f"{BASE}/package/src/app.js", json={"text": text})
    assert wrote.status_code == 200
    assert wrote.json()["size"] == len(text.encode("utf-8"))
    got = client.get(f"{BASE}/package/src/app.js").json()
    assert (got["encoding"], got["text"], got["path"]) == ("utf-8", text, "package/src/app.js")
    assert (home / "projects" / "grain-tool" / "package" / "src" / "app.js").read_bytes() == text.encode("utf-8")


def test_binary_bytes_survive_a_base64_write_and_read(client, project):
    data = bytes(range(256))
    client.put(f"{BASE}/package/blob.bin", json={"base64": base64.b64encode(data).decode()})
    got = client.get(f"{BASE}/package/blob.bin").json()
    assert got["encoding"] == "base64"
    assert base64.b64decode(got["base64"]) == data
    assert got["size"] == 256


def test_raw_upload_is_served_back_byte_for_byte_with_the_type_of_its_extension(client, project):
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
    assert client.put(f"{BASE}/package/icon.png?raw=1", content=png).status_code == 200
    got = client.get(f"{BASE}/package/icon.png?raw=1")
    assert got.content == png
    assert got.headers["content-type"] == "image/png"
    assert got.headers["x-content-type-options"] == "nosniff"
    assert got.headers["cache-control"] == "no-store"


def test_overwriting_a_file_replaces_its_content_and_leaves_no_temp_file_listed(client, project):
    client.put(f"{BASE}/package/a.txt", json={"text": "first"})
    client.put(f"{BASE}/package/a.txt", json={"text": "second"})
    assert client.get(f"{BASE}/package/a.txt").json()["text"] == "second"
    listed = client.get("/api/projects/grain-tool/files").json()
    assert sorted(f["path"] for f in listed["files"]) == ["package/a.txt", "package/manifest.json"]


def test_file_list_reports_sizes_and_which_files_ship_in_the_package(client, project):
    client.put(f"{BASE}/package/a.txt", json={"text": "12345"})
    client.put(f"{BASE}/notes.md", json={"text": "abc"})
    listed = {f["path"]: f for f in client.get("/api/projects/grain-tool/files").json()["files"]}
    assert listed["package/a.txt"]["size"] == 5
    assert listed["package/a.txt"]["package"] is True
    assert listed["notes.md"]["size"] == 3
    assert listed["notes.md"]["package"] is False


def test_write_body_without_text_or_base64_is_refused_and_writes_nothing(client, project, home):
    res = client.put(f"{BASE}/package/a.txt", json={"content": "x"})
    assert res.status_code == 400
    assert res.json()["detail"] == "send JSON with text or base64, or use ?raw=1"
    assert not (home / "projects" / "grain-tool" / "package" / "a.txt").exists()


def test_reading_a_file_that_is_not_there_is_refused_with_its_path(client, project):
    res = client.get(f"{BASE}/package/missing.txt")
    assert res.status_code == 404
    assert res.json()["detail"] == "no such file: package/missing.txt"


def test_reading_a_folder_as_a_file_is_refused(client, project):
    res = client.get(f"{BASE}/package")
    assert res.status_code == 404
    assert res.json()["detail"] == "not a file: package"


def test_writing_a_file_where_a_folder_is_is_refused(client, project):
    res = client.put(f"{BASE}/package", json={"text": "x"})
    assert res.status_code == 409
    assert res.json()["detail"] == "a folder is at package"


def test_writing_into_an_unknown_project_is_refused_and_creates_no_folder(client, home):
    res = client.put("/api/projects/never-made/files/a.txt", json={"text": "x"})
    assert res.status_code == 404
    assert res.json()["detail"] == "no such project: never-made"
    assert not (home / "projects" / "never-made").exists()


@pytest.mark.parametrize("rel", ["..%2F..%2Fsecret.txt", "package%2F..%2F..%2Fsecret.txt", "..%5C..%5Csecret.txt"])
def test_write_with_a_path_that_climbs_out_of_the_project_is_refused_and_nothing_lands_outside(client, project, home, rel):
    res = client.put(f"{BASE}/{rel}", json={"text": "stolen"})
    assert res.status_code == 400
    assert res.json()["detail"] == "path leaves the project"
    assert not (home / "secret.txt").exists()
    assert not (home / "projects" / "secret.txt").exists()


def test_read_with_a_path_that_climbs_out_does_not_return_the_outside_file(client, project, home):
    (home / "projects" / "secret.txt").write_text("private", encoding="utf-8")
    res = client.get(f"{BASE}/..%2Fsecret.txt")
    assert res.status_code == 400
    assert "private" not in res.text
    assert res.json()["detail"] == "path leaves the project"


def test_absolute_path_is_refused_for_reading(client, project):
    res = client.get(f"{BASE}/%2Fetc%2Fhostname")
    assert res.status_code == 400
    assert res.json()["detail"] == "absolute paths are not allowed"


@pytest.mark.skipif(os.name == "nt", reason="symbolic links need extra rights on this system")
def test_symbolic_link_inside_a_project_is_not_followed_to_an_outside_file(client, project, home, tmp_path):
    outside = tmp_path / "outside.txt"
    outside.write_text("private", encoding="utf-8")
    os.symlink(outside, home / "projects" / "grain-tool" / "package" / "link.txt")
    res = client.get(f"{BASE}/package/link.txt")
    assert res.status_code == 400
    assert res.json()["detail"] == "symbolic links are not followed"
    wrote = client.put(f"{BASE}/package/link.txt", json={"text": "changed"})
    assert wrote.status_code == 400
    assert outside.read_text(encoding="utf-8") == "private"
    assert "package/link.txt" not in [f["path"] for f in client.get("/api/projects/grain-tool/files").json()["files"]]


def test_deleted_file_is_gone_from_disk_and_a_second_delete_is_refused(client, project, home):
    client.put(f"{BASE}/package/a.txt", json={"text": "x"})
    res = client.delete(f"{BASE}/package/a.txt")
    assert res.json() == {"path": "package/a.txt", "deleted": True}
    assert not (home / "projects" / "grain-tool" / "package" / "a.txt").exists()
    again = client.delete(f"{BASE}/package/a.txt")
    assert again.status_code == 404
    assert again.json()["detail"] == "no such file: package/a.txt"


def test_moved_file_keeps_its_content_under_the_new_name_only(client, project):
    client.put(f"{BASE}/package/a.txt", json={"text": "moved text"})
    res = client.post("/api/projects/grain-tool/move", json={"from": "package/a.txt", "to": "package/deep/b.txt"})
    assert res.json() == {"from": "package/a.txt", "to": "package/deep/b.txt"}
    assert client.get(f"{BASE}/package/deep/b.txt").json()["text"] == "moved text"
    assert client.get(f"{BASE}/package/a.txt").status_code == 404


def test_move_onto_an_existing_file_is_refused_and_both_files_keep_their_content(client, project):
    client.put(f"{BASE}/package/a.txt", json={"text": "A"})
    client.put(f"{BASE}/package/b.txt", json={"text": "B"})
    res = client.post("/api/projects/grain-tool/move", json={"from": "package/a.txt", "to": "package/b.txt"})
    assert res.status_code == 409
    assert res.json()["detail"] == "package/b.txt already exists"
    assert client.get(f"{BASE}/package/a.txt").json()["text"] == "A"
    assert client.get(f"{BASE}/package/b.txt").json()["text"] == "B"


def test_move_to_a_place_outside_the_project_is_refused_and_the_file_stays(client, project, home):
    client.put(f"{BASE}/package/a.txt", json={"text": "A"})
    res = client.post("/api/projects/grain-tool/move", json={"from": "package/a.txt", "to": "../../a.txt"})
    assert res.status_code == 400
    assert res.json()["detail"] == "path leaves the project"
    assert client.get(f"{BASE}/package/a.txt").json()["text"] == "A"
    assert not (home / "a.txt").exists()


def test_file_over_fifty_megabytes_is_refused_with_the_limit_in_words(client, project, home):
    big = b"a" * (50 * 1024 * 1024 + 1)
    res = client.put(f"{BASE}/package/big.bin?raw=1", content=big)
    assert res.status_code == 400
    assert res.json()["detail"] == "the file is larger than 50 MB"
    assert not (home / "projects" / "grain-tool" / "package" / "big.bin").exists()


@pytest.mark.parametrize("given,expected", [("a/./b//c.txt", "a/b/c.txt"), ("a\\b\\c.txt", "a/b/c.txt"), ("./x.txt", "x.txt")])
def test_clean_rel_gives_one_forward_slash_form_for_equal_paths(given, expected):
    assert clean_rel(given) == expected


@pytest.mark.parametrize("bad,message", [("", "invalid path"), ("a\x00b", "invalid path"), ("/abs", "absolute paths are not allowed"), ("C:\\x", "absolute paths are not allowed"), ("a/../b", "path leaves the project"), (".", "path leaves the project"), ("a/" * 201 + "b", "path is too long")])
def test_clean_rel_refuses_paths_that_could_leave_a_project(bad, message):
    with pytest.raises(Unsafe) as caught:
        clean_rel(bad)
    assert caught.value.message == message


def test_safe_join_stays_under_the_root_and_reports_missing_files(tmp_path):
    assert safe_join(tmp_path, "a/b.txt") == tmp_path.resolve() / "a" / "b.txt"
    with pytest.raises(NotFound) as caught:
        safe_join(tmp_path, "a/b.txt", must_exist=True)
    assert caught.value.message == "no such file: a/b.txt"


@pytest.mark.parametrize("name,expected", [("Grain Tool", "grain-tool"), ("  Hello,  World!  ", "hello-world"), ("x", "x-extension"), ("", "extension"), ("A" * 80, "a" * 48)])
def test_slug_turns_a_name_into_a_lower_case_dashed_id(name, expected):
    assert slug(name) == expected
