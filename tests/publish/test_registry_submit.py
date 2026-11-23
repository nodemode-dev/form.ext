import json
from pathlib import Path

from .conftest import PNG

SHOT = {"docs/screenshot.png": {"base64": PNG}}


def submit(client, pid):
    res = client.post(f"/api/publish/{pid}/registry")
    assert res.status_code == 200, res.text
    return res.json()


def test_submit_writes_the_registry_layout_the_manual_states(client, make_project):
    p = make_project()
    out = submit(client, p["id"])
    folder = Path(out["folder"])
    assert folder.parts[-4:] == ("submissions", "registry", "extensions", p["id"])
    assert out["files"] == ["CHANGELOG.md", "LICENSE", "README.md", "package/manifest.json"]
    assert all((folder / rel).is_file() for rel in out["files"])
    assert sorted(out["made"]) == ["CHANGELOG.md", "LICENSE", "README.md"]


def test_package_folder_holds_exactly_the_project_package_bytes(client, make_project):
    p = make_project(files={"package/panel.js": "export const hello = 1;\n", **SHOT})
    out = submit(client, p["id"])
    folder = Path(out["folder"])
    source = Path(p["package_dir"])
    made = sorted(f.relative_to(folder / "package").as_posix() for f in (folder / "package").rglob("*") if f.is_file())
    assert made == sorted(f.relative_to(source).as_posix() for f in source.rglob("*") if f.is_file())
    assert all((folder / "package" / rel).read_bytes() == (source / rel).read_bytes() for rel in made)


def test_source_and_docs_go_beside_the_package(client, make_project):
    p = make_project(files={"src/main.ts": "export const a = 1;\n", "package.json": "{}\n", **SHOT})
    out = submit(client, p["id"])
    assert {"src/main.ts", "package.json", "docs/screenshot.png"} <= set(out["files"])
    assert (Path(out["folder"]) / "src" / "main.ts").read_text(encoding="utf-8") == "export const a = 1;\n"


def test_a_missing_screenshot_fails_the_checks_and_names_the_slot(client, make_project):
    p = make_project()
    out = submit(client, p["id"])
    assert out["checks"]["ok"] is False
    assert out["screenshot"] is None
    assert out["screenshot_slot"] == "docs/screenshot.png"
    assert [x["where"] for x in out["checks"]["problems"]] == ["docs/screenshot.png"]
    assert "1 problem" in out["checks"]["report"]


def test_with_a_screenshot_the_checks_pass(client, make_project):
    p = make_project(files=SHOT)
    out = submit(client, p["id"])
    assert out["checks"]["ok"] is True
    assert out["checks"]["problems"] == []
    assert out["screenshot"] == "docs/screenshot.png"
    assert "passed" in out["checks"]["report"]


def test_the_result_says_form_ext_ran_its_own_check_when_the_registry_copy_cannot_be_fetched(client, make_project):
    p = make_project(files=SHOT)
    out = submit(client, p["id"])
    assert out["checks"]["by"] == "formext"
    assert "could not fetch the registry's checks" in out["checks"]["note"]
    assert "its own Check" in out["checks"]["note"]


def test_the_projects_own_readme_is_kept_and_not_rewritten(client, make_project):
    mine = "# Mine\n\nI wrote this.\n"
    p = make_project(files={"README.md": mine, **SHOT})
    out = submit(client, p["id"])
    assert "README.md" not in out["made"]
    assert (Path(out["folder"]) / "README.md").read_text(encoding="utf-8") == mine


def test_a_missing_apache_licence_is_written_with_the_full_text(client, make_project):
    p = make_project()
    out = submit(client, p["id"])
    text = (Path(out["folder"]) / "LICENSE").read_text(encoding="utf-8")
    assert "Apache License" in text and "Version 2.0" in text
    assert "Replace this file" not in text


def test_a_missing_mit_licence_is_written_with_the_full_text_and_the_author(client, make_project):
    p = make_project(licence="MIT", author="Ada Example")
    out = submit(client, p["id"])
    text = (Path(out["folder"]) / "LICENSE").read_text(encoding="utf-8")
    assert text.startswith("MIT License")
    assert "Ada Example" in text
    assert "Permission is hereby granted, free of charge" in text


def test_another_licence_gets_a_placeholder_to_finish(client, make_project):
    p = make_project(licence="MPL-2.0")
    out = submit(client, p["id"])
    text = (Path(out["folder"]) / "LICENSE").read_text(encoding="utf-8")
    assert "MPL-2.0" in text
    assert "Replace this file with the full text" in text


def test_written_readme_has_one_placeholder_line_per_permission(client, make_project):
    p = make_project(permissions=["network", "files-read"], description="Fetches.")
    out = submit(client, p["id"])
    text = (Path(out["folder"]) / "README.md").read_text(encoding="utf-8")
    lines = [ln for ln in text.splitlines() if ln.endswith("Why: say here what the extension does with it.")]
    assert len(lines) == 2
    assert lines[0].startswith("- `network`") and lines[1].startswith("- `files-read`")
    assert "## Permissions" in text
    assert "docs/screenshot.png" in text


def test_written_changelog_starts_at_the_manifest_version(client, make_project):
    p = make_project(version="2.3.4")
    out = submit(client, p["id"])
    text = (Path(out["folder"]) / "CHANGELOG.md").read_text(encoding="utf-8")
    assert "## 2.3.4" in text
    assert out["version"] == "2.3.4"


def test_commands_use_the_add_branch_name_the_manual_gives(client, make_project):
    p = make_project(files=SHOT)
    out = submit(client, p["id"])
    runs = [c["run"] for c in out["commands"]]
    branch = f"add-{p['id']}-0.1.0"
    assert out["update"] is False
    assert any(branch in r and "git switch -c" in r for r in runs)
    assert any(r == f"git push -u origin {branch}" for r in runs)
    assert f"python3 tools/check.py extensions/{p['id']}" in runs
    assert any(r.startswith("gh pr create --repo nodemode-dev/form.ext-registry --base main") for r in runs)
    assert any(r.startswith("gh repo fork nodemode-dev/form.ext-registry") for r in runs)


def test_submit_alone_starts_no_outside_program(client, make_project, gh):
    p = make_project(files=SHOT)
    submit(client, p["id"])
    assert gh.calls() == []


def test_status_after_submit_reports_the_registry_submission(client, make_project):
    p = make_project(files=SHOT)
    out = submit(client, p["id"])
    seen = client.get(f"/api/publish/{p['id']}").json()["registry"]
    assert seen["submission"]["id"] == p["id"]
    assert seen["submission"]["files"] == out["files"]
    assert seen["folder"] == out["folder"]


def test_submitting_again_drops_a_file_the_project_no_longer_has(client, make_project):
    p = make_project(files={"src/old.ts": "1\n", **SHOT})
    first = submit(client, p["id"])
    assert "src/old.ts" in first["files"]
    res = client.delete(f"/api/projects/{p['id']}/files/src/old.ts")
    assert res.status_code == 200, res.text
    second = submit(client, p["id"])
    assert "src/old.ts" not in second["files"]
    assert not (Path(second["folder"]) / "src" / "old.ts").exists()


def test_a_registry_checkout_without_check_py_is_named_in_the_note(client, make_project, setting, tmp_path):
    clone = tmp_path / "my-registry"
    clone.mkdir()
    setting("registry", {"checkout": str(clone)})
    p = make_project(files=SHOT)
    out = submit(client, p["id"])
    assert out["checks"]["by"] == "formext"
    assert str(clone) in out["checks"]["note"]
    assert "tools/check.py" in out["checks"]["note"]
    assert client.get(f"/api/publish/{p['id']}").json()["registry"]["managed"] is False


def test_the_record_file_beside_the_folder_is_the_answer_given(client, make_project):
    p = make_project(files=SHOT)
    out = submit(client, p["id"])
    kept = json.loads((Path(out["root"]) / f"{p['id']}.submission.json").read_text(encoding="utf-8"))
    assert kept == out
