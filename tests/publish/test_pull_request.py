import json
import subprocess
from pathlib import Path

from app.services import registry_pr
from .conftest import PNG, git, make_remote

SHOT = {"docs/screenshot.png": {"base64": PNG}}


def test_readiness_asks_for_a_sign_in_when_gh_is_not_signed_in(client, make_project, gh):
    p = make_project()
    out = client.get(f"/api/publish/{p['id']}/registry/pull-request").json()
    assert out["ready"] is False
    assert out["gh"] is True and out["signed_in"] is False and out["login"] is None
    assert [n["what"] for n in out["needs"]] == ["sign-in"]
    assert "gh auth login --web" in out["needs"][0]["how"]
    assert out["repo"] == "nodemode-dev/form.ext-registry"


def test_readiness_asks_for_gh_when_it_is_not_installed(client, make_project, monkeypatch):
    monkeypatch.delenv("FORMEXT_GH_BIN")
    monkeypatch.setattr(registry_pr, "GH_SYSTEM", ())
    p = make_project()
    out = client.get(f"/api/publish/{p['id']}/registry/pull-request").json()
    assert out["ready"] is False and out["gh"] is False
    assert [n["what"] for n in out["needs"]] == ["gh"]
    assert out["needs"][0]["how"] == "https://cli.github.com"


def test_readiness_is_ready_and_names_the_login_when_signed_in(client, make_project, gh):
    gh.sign_in()
    p = make_project()
    out = client.get(f"/api/publish/{p['id']}/registry/pull-request").json()
    assert out == {"ready": True, "git": True, "gh": True, "signed_in": True, "login": "tester", "needs": [], "repo": "nodemode-dev/form.ext-registry"}


def test_pull_request_is_refused_before_setup_and_nothing_is_submitted(client, make_project, gh):
    p = make_project(files=SHOT)
    res = client.post(f"/api/publish/{p['id']}/registry/pull-request")
    assert res.status_code == 409
    body = res.json()
    assert body["detail"].startswith("the pull request needs a little setup first")
    assert [n["what"] for n in body["needs"]] == ["sign-in"]
    assert client.get(f"/api/publish/{p['id']}").json()["registry"]["submission"] is None
    assert all(c == "api user" for c in gh.calls())


def test_pull_request_is_refused_while_the_checks_fail(client, make_project, gh):
    gh.sign_in()
    p = make_project()
    res = client.post(f"/api/publish/{p['id']}/registry/pull-request")
    assert res.status_code == 409
    body = res.json()
    assert "no pull request was opened" in body["detail"]
    assert body["needs"] == [{"what": "checks", "say": "a screenshot is missing: add docs/screenshot.png (the extension in its app)", "how": "docs/screenshot.png"}]
    assert not any(c.startswith(("repo fork", "pr ")) for c in gh.calls())


def test_pull_request_is_refused_while_the_readme_placeholder_is_left(client, make_project, gh):
    gh.sign_in()
    p = make_project(files=SHOT, permissions=["network"], description="Fetches.")
    res = client.post(f"/api/publish/{p['id']}/registry/pull-request")
    assert res.status_code == 409
    body = res.json()
    assert "still left for you to write" in body["detail"]
    assert [n["what"] for n in body["needs"]] == ["text"]
    assert "README.md" in body["needs"][0]["say"]
    assert not any(c.startswith(("repo fork", "pr ")) for c in gh.calls())


def test_pull_request_is_refused_while_the_licence_placeholder_is_left(client, make_project, gh):
    gh.sign_in()
    p = make_project(files=SHOT, licence="MPL-2.0")
    res = client.post(f"/api/publish/{p['id']}/registry/pull-request")
    assert res.status_code == 409
    says = [n["say"] for n in res.json()["needs"]]
    assert len(says) == 1 and says[0].startswith("LICENSE is still the placeholder")
    assert not any(c.startswith(("repo fork", "pr ")) for c in gh.calls())


def test_unfinished_reports_nothing_for_finished_texts(tmp_path):
    (tmp_path / "README.md").write_text("# Mine\n\n- `network`: it fetches the weather.\n", encoding="utf-8")
    (tmp_path / "LICENSE").write_text("MIT License\n", encoding="utf-8")
    assert registry_pr.unfinished(tmp_path) == []


def test_pull_request_puts_the_folder_on_the_add_branch_of_the_fork_and_asks_gh_to_open_it(client, make_project, gh, remotes, monkeypatch):
    gh.sign_in()
    make_remote(remotes, "form.ext-registry", {"README.md": "# registry\n"})
    fork = remotes / "fork.git"
    git("clone", "-q", "--bare", str(remotes / "form.ext-registry.git"), str(fork), cwd=remotes)
    monkeypatch.setenv("FORMEXT_REGISTRY_FORK_URL", fork.as_uri())
    p = make_project(files={"package/panel.js": "export const hello = 1;\n", **SHOT}, description="Shows a board.")
    try:
        res = client.post(f"/api/publish/{p['id']}/registry/pull-request")
        assert res.status_code == 200, res.text
        out = res.json()
        branch = f"add-{p['id']}-0.1.0"
        assert out["ok"] is True and out["state"] == "opened"
        assert out["branch"] == branch
        assert out["url"] == "https://example.invalid/registry/pull/1"
        assert out["fork"] == "tester/form.ext-registry"
        assert git("rev-parse", f"refs/heads/{branch}", cwd=fork) == out["commit"]
        tree = git("ls-tree", "-r", "--name-only", branch, cwd=fork).splitlines()
        submitted = client.get(f"/api/publish/{p['id']}").json()["registry"]["submission"]
        assert sorted(tree) == sorted(["README.md"] + [f"extensions/{p['id']}/{rel}" for rel in submitted["files"]])
        blob = subprocess.run(["git", "show", f"{branch}:extensions/{p['id']}/package/panel.js"], cwd=str(fork), capture_output=True, text=True).stdout
        assert blob == "export const hello = 1;\n"
        assert git("log", "-1", "--format=%an <%ae>", branch, cwd=fork) == "Tess Ter <7+tester@users.noreply.github.com>"
        created = [c for c in gh.calls() if c.startswith("pr create")]
        assert len(created) == 1
        title = f"Add {p['name']} 0.1.0"
        assert out["title"] == title
        assert f"--repo nodemode-dev/form.ext-registry --base main --head tester:{branch} --title {title} --body {title}: Shows a board." in created[0]
        assert git("log", "-1", "--format=%s", branch, cwd=fork) == f"feat({p['id']}): add {p['name']} 0.1.0"
        shown = next(c["run"] for c in submitted["commands"] if c["run"].startswith("gh pr create"))
        assert f"--title '{title}'" in shown
        assert git("rev-parse", "refs/heads/main", cwd=fork) == git("rev-parse", "refs/heads/main", cwd=remotes / "form.ext-registry.git")
    finally:
        import shutil

        shutil.rmtree(registry_pr.work_dir(), ignore_errors=True)
