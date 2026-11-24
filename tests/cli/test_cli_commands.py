import hashlib
import json
import re
import shutil
import zipfile

import pytest

from .conftest import BACKEND, ROOT, cli, cli_json, make_home, run

ASK_WORDS = "no form.ext window is open to ask"


def shown_version():
    text = (ROOT / "frontend" / "src" / "shell" / "version.ts").read_text(encoding="utf-8")
    return re.search(r"VERSION = '([^']+)'", text).group(1)


@pytest.fixture(scope="module")
def studio(allowed_home, tmp_path_factory):
    out = tmp_path_factory.mktemp("out")
    made = cli(allowed_home, "new", "Beat Board", "--app", "formwav", "--starter", "panel")
    checked = cli(allowed_home, "validate", "beat-board")
    code, built = cli_json(allowed_home, "package", "beat-board", "--out", str(out) + "/", "--reproduce")
    return {"home": allowed_home, "out": out, "made": made, "checked": checked, "built": built, "built_code": code}


def test_readme_new_command_makes_project_named_by_its_slug(studio):
    assert studio["made"].returncode == 0
    manifest = json.loads((studio["home"] / "projects" / "beat-board" / "package" / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["name"] == "Beat Board"
    assert manifest["product"] == "formwav"
    assert manifest["api"] == "1"
    assert manifest["native"] is False


def test_fresh_starter_passes_validate_with_exit_zero(studio):
    assert studio["checked"].returncode == 0
    assert "0 errors" in studio["checked"].stdout


def test_package_reports_the_sha256_and_size_of_the_saved_file(studio):
    assert studio["built_code"] == 0
    saved = studio["out"] / "beat-board-0.1.0.formpkg"
    data = saved.read_bytes()
    assert studio["built"]["build"]["sha256"] == hashlib.sha256(data).hexdigest()
    assert studio["built"]["build"]["bytes"] == len(data)
    assert studio["built"]["saved"] == str(saved.resolve())


def test_package_is_a_zip_with_sorted_entries_fixed_dates_and_root_manifest(studio):
    with zipfile.ZipFile(studio["out"] / "beat-board-0.1.0.formpkg") as z:
        names = z.namelist()
        dates = {info.date_time for info in z.infolist()}
        manifest = json.loads(z.read("manifest.json"))
    assert names == sorted(names)
    assert dates == {(1980, 1, 1, 0, 0, 0)}
    assert manifest["name"] == "Beat Board"
    assert "ui/index.html" in names


def test_package_bytes_match_the_kit_formpkg_tool_run_on_the_same_folder(studio, tmp_path):
    folder = studio["home"] / "projects" / "beat-board" / "package"
    done = run(studio["home"], [str(ROOT / "contract" / "tools" / "formpkg.py"), "build", str(folder), "-o", str(tmp_path / "kit")], cwd=tmp_path)
    assert done.returncode == 0, done.stdout + done.stderr
    assert json.loads(done.stdout.splitlines()[0])["sha256"] == studio["built"]["build"]["sha256"]


def test_package_reproduce_says_the_two_routes_agree(studio):
    answer = studio["built"]["reproduce"]
    assert answer.get("ok", answer.get("reproducible")) is True


def test_write_from_a_local_file_then_read_gives_the_same_text(studio, tmp_path):
    source = tmp_path / "notes.txt"
    source.write_text("tempo 120\nbars 8\n", encoding="utf-8")
    wrote = cli(studio["home"], "write", "beat-board", "notes/tempo.txt", "--from", str(source))
    assert wrote.returncode == 0
    assert "17 bytes" in wrote.stdout
    code, read = cli_json(studio["home"], "read", "beat-board", "notes/tempo.txt")
    assert code == 0
    assert read["text"] == "tempo 120\nbars 8\n"
    assert (studio["home"] / "projects" / "beat-board" / "notes" / "tempo.txt").read_text(encoding="utf-8") == "tempo 120\nbars 8\n"


def test_move_then_delete_leaves_no_file_and_read_is_refused(studio):
    assert cli(studio["home"], "write", "beat-board", "scratch/a.txt", "--text", "one").returncode == 0
    assert cli(studio["home"], "move", "beat-board", "scratch/a.txt", "scratch/b.txt").returncode == 0
    code, read = cli_json(studio["home"], "read", "beat-board", "scratch/b.txt")
    assert read["text"] == "one"
    gone = cli(studio["home"], "read", "beat-board", "scratch/a.txt")
    assert gone.returncode != 0 and gone.stderr.startswith("formext: ")
    assert cli(studio["home"], "delete", "beat-board", "scratch/b.txt").returncode == 0
    assert not (studio["home"] / "projects" / "beat-board" / "scratch" / "b.txt").exists()


def test_manifest_merge_patch_sets_a_key_and_null_removes_one(studio):
    code, first = cli_json(studio["home"], "manifest", "beat-board", "--set", json.dumps({"description": "Counts beats.", "homepage": "https://example.org/beat"}))
    assert code == 0 and first["manifest"]["homepage"] == "https://example.org/beat"
    code, second = cli_json(studio["home"], "manifest", "beat-board", "--set", json.dumps({"homepage": None}))
    on_disk = json.loads((studio["home"] / "projects" / "beat-board" / "package" / "manifest.json").read_text(encoding="utf-8"))
    assert "homepage" not in on_disk
    assert on_disk["description"] == "Counts beats."
    assert on_disk["name"] == "Beat Board"


def test_manifest_patch_that_is_not_json_is_refused_and_file_unchanged(studio):
    path = studio["home"] / "projects" / "beat-board" / "package" / "manifest.json"
    before = path.read_bytes()
    done = cli(studio["home"], "manifest", "beat-board", "--set", "{not json")
    assert done.returncode == 1
    assert "the manifest patch is not JSON" in done.stderr
    assert path.read_bytes() == before


def test_eval_and_fetch_fail_validate_with_exit_one_and_block_package(tmp_path):
    home = make_home(tmp_path, "allowed")
    assert cli(home, "new", "Bad Code", "--app", "formcut").returncode == 0
    assert cli(home, "write", "bad-code", "package/ui/bad.js", "--text", 'eval("1"); fetch("http://x");').returncode == 0
    checked = cli(home, "validate", "bad-code")
    assert checked.returncode == 1
    assert "2 errors" in checked.stdout
    assert "package/ui/bad.js:1" in checked.stdout
    refused = cli(home, "package", "bad-code")
    assert refused.returncode == 1
    assert "package anyway" in refused.stderr
    assert not (home / "builds" / "bad-code").exists() or not list((home / "builds" / "bad-code").rglob("*.formpkg"))
    anyway = cli(home, "package", "bad-code", "--anyway")
    assert anyway.returncode == 0
    assert "bad-code-0.1.0.formpkg" in anyway.stdout


def test_default_ask_setting_refuses_new_from_the_command_line_and_makes_nothing(ask_home):
    done = cli(ask_home, "new", "Quiet One", "--app", "formcut")
    assert done.returncode != 0
    assert ASK_WORDS in done.stderr
    assert not (ask_home / "projects" / "quiet-one").exists()
    listed = cli(ask_home, "projects")
    assert listed.returncode == 0
    assert "quiet-one" not in listed.stdout


def test_json_refusal_exits_non_zero_like_the_text_refusal(ask_home):
    done = cli(ask_home, "new", "Quiet Two", "--app", "formcut", "--json")
    assert json.loads(done.stdout)["error"].startswith("form.ext asks the person")
    assert done.returncode != 0


def test_blocked_setting_refuses_changes_but_reading_still_works(tmp_path):
    home = make_home(tmp_path, "blocked")
    done = cli(home, "new", "Nope", "--app", "formcut")
    assert done.returncode != 0
    assert not (home / "projects" / "nope").exists()
    assert cli(home, "rules").returncode == 0


def test_no_command_prints_help_and_exits_two(ask_home):
    done = cli(ask_home)
    assert done.returncode == 2
    for word in ("new", "validate", "preview", "package", "sign", "run-in-app", "publish"):
        assert re.search(rf"^\s+{word}\s", done.stdout, re.M), word


def test_version_flag_prints_the_version_the_interface_shows(ask_home):
    done = cli(ask_home, "--version")
    assert done.returncode == 0
    assert done.stdout.strip() == f"formext {shown_version()}"


def test_unknown_starter_is_refused_by_the_parser_with_exit_two(ask_home):
    done = cli(ask_home, "new", "X", "--app", "formcut", "--starter", "wizard")
    assert done.returncode == 2
    assert "panel-commands" in done.stderr


def test_unknown_project_fails_with_reason_on_stderr_and_as_json(ask_home):
    done = cli(ask_home, "files", "ghost")
    assert done.returncode == 1
    assert done.stderr.strip() == "formext: no such project: ghost"
    assert done.stdout == ""
    code, body = cli_json(ask_home, "files", "ghost")
    assert code == 1
    assert body["error"] == "no such project: ghost"


def test_docs_contract_is_the_contract_file_word_for_word(ask_home):
    code, body = cli_json(ask_home, "docs", "contract")
    assert code == 0
    assert body["text"] == (ROOT / "contract" / "CONTRACT.md").read_text(encoding="utf-8")


def test_docs_unknown_topic_is_refused_and_names_the_topics(ask_home):
    done = cli(ask_home, "docs", "nonsense")
    assert done.returncode == 1
    assert "there is no docs topic 'nonsense'" in done.stderr
    assert "contract" in done.stderr and "schema" in done.stderr


def test_templates_lists_the_twelve_host_apps_and_three_starters(ask_home):
    code, body = cli_json(ask_home, "templates")
    named = {"formvis", "formcut", "formwav", "formpdf", "formdeck", "formlit", "formmd", "formencoder", "formvfx", "formmcp", "formtray", "formskills"}
    assert {p["id"] for p in body["products"]} == named
    assert [s["id"] for s in body["starters"]] == ["panel", "command", "panel-commands"]
    assert "hello" in body["examples"]


def test_templates_for_an_unknown_app_is_refused(ask_home):
    done = cli(ask_home, "templates", "formnothing")
    assert done.returncode == 1
    assert "formnothing is not a host app" in done.stderr


def test_status_says_in_process_and_counts_no_projects_in_an_empty_folder(ask_home):
    code, body = cli_json(ask_home, "status")
    assert code == 0
    assert body["engine"]["mode"] == "in-process"
    assert body["engine"]["version"] == shown_version()
    assert body["projects"] == 0
    assert body["home"] == str(ask_home)


def test_example_hello_becomes_a_project_with_the_kit_manifest(tmp_path):
    home = make_home(tmp_path, "allowed")
    code, body = cli_json(home, "new", "--example", "hello")
    kit = json.loads((ROOT / "contract" / "examples" / "hello" / "manifest.json").read_text(encoding="utf-8"))
    assert code == 0
    assert body["manifest"]["product"] == kit["product"]
    assert body["manifest"]["entry"] == kit["entry"]
    assert body["manifest"]["permissions"] == kit["permissions"]


def test_keys_sign_verify_and_entry_agree_on_the_build(studio):
    code, key = cli_json(studio["home"], "keys", "create", "tester", "--name", "Tester")
    assert code == 0 and key["algorithm"] == "ed25519" and key["encrypted"] is False
    assert cli(studio["home"], "sign", "beat-board", "--key", "tester").returncode == 0
    code, entry = cli_json(studio["home"], "entry", "beat-board", "--url", "https://example.org/beat-board.formpkg")
    text = json.dumps(entry)
    assert code == 0
    assert studio["built"]["build"]["sha256"] in text or cli_json(studio["home"], "builds", "beat-board")[1]["builds"][0]["sha256"] in text
    assert "https://example.org/beat-board.formpkg" in text
    assert cli(studio["home"], "verify", "beat-board").returncode == 0


def test_inspect_reads_the_saved_package_without_importing_it(studio):
    saved = studio["out"] / "beat-board-0.1.0.formpkg"
    code, body = cli_json(studio["home"], "inspect", str(saved))
    assert code == 0
    assert "Beat Board" in json.dumps(body)
    code, listed = cli_json(studio["home"], "projects")
    assert [p["id"] for p in listed["projects"]].count("beat-board") == 1


def test_formpkg_tool_validates_and_builds_the_hello_example_copy(tmp_path):
    copy = tmp_path / "hello"
    shutil.copytree(ROOT / "contract" / "examples" / "hello", copy)
    tool = str(ROOT / "contract" / "tools" / "formpkg.py")
    valid = run(tmp_path, [tool, "validate", str(copy)], cwd=tmp_path)
    assert (valid.returncode, valid.stdout.strip()) == (0, "valid")
    built = run(tmp_path, [tool, "build", str(copy), "-o", str(tmp_path / "dist"), "--url", "https://example.org/h.formpkg"], cwd=tmp_path)
    first, _, rest = built.stdout.partition("\n")
    report, entry = json.loads(first), json.loads(rest)
    data = (tmp_path / "dist" / "hello-formext-0.1.0.formpkg").read_bytes()
    assert report["sha256"] == hashlib.sha256(data).hexdigest() == entry["sha256"]
    assert report["bytes"] == len(data) == entry["bytes"]
    assert entry["url"] == "https://example.org/h.formpkg"
    again = run(tmp_path, [tool, "build", str(copy), "-o", str(tmp_path / "dist2")], cwd=tmp_path)
    assert json.loads(again.stdout)["sha256"] == report["sha256"]


def test_formpkg_tool_refuses_a_manifest_with_native_true(tmp_path):
    copy = tmp_path / "hello"
    shutil.copytree(ROOT / "contract" / "examples" / "hello", copy)
    manifest = json.loads((copy / "manifest.json").read_text(encoding="utf-8"))
    manifest["native"] = True
    (copy / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    tool = str(ROOT / "contract" / "tools" / "formpkg.py")
    done = run(tmp_path, [tool, "validate", str(copy)], cwd=tmp_path)
    assert done.returncode == 1
    assert done.stdout.startswith("refused:")
    built = run(tmp_path, [tool, "build", str(copy), "-o", str(tmp_path / "dist")], cwd=tmp_path)
    assert built.returncode != 0
    assert not list((tmp_path / "dist").glob("*.formpkg")) if (tmp_path / "dist").exists() else True


def test_engine_selfcheck_exits_zero_with_every_check_true(tmp_path):
    home = make_home(tmp_path)
    done = run(home, [str(BACKEND / "formext_engine.py"), "--selfcheck"], cwd=tmp_path)
    assert done.returncode == 0, done.stderr[-400:]
    info = json.loads(done.stdout.strip().splitlines()[-1])
    assert info["formext"] == shown_version()
    assert info["router_errors"] == {}
    assert info["checks"] and all(v is True for v in info["checks"].values())


def test_engine_program_passes_cli_arguments_through(tmp_path):
    home = make_home(tmp_path)
    done = run(home, [str(BACKEND / "formext_engine.py"), "cli", "--version"], cwd=tmp_path)
    assert done.returncode == 0
    assert done.stdout.strip() == f"formext {shown_version()}"
