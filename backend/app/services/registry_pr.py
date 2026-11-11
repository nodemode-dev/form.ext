"""Submit to Registry, the last step: the pull request, opened by form.ext for the person so nobody has to type git. It forks
nodemode-dev/form.ext-registry into the person's GitHub account, puts the checked folder on a branch in a working clone kept in the
data folder, pushes the branch to the fork and opens (or updates) the pull request. GitHub's own command line, gh, holds the
sign-in: nothing here reads or stores a token. It runs only when the person asks, and only after the checks passed."""

import contextlib
import json
import os
import re
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Iterator

from app.services import paths, portal, publish, registry, sources
from app.services.bus import bus
from app.services.workspace import WorkspaceError, workspace

STUBS = {
    "LICENSE": ("Replace this file with the full text", "LICENSE is still the placeholder form.ext wrote: put the full text of the licence in it"),
    "README.md": ("Why: say here what the extension does with it.", "README.md still has form.ext's placeholder under Permissions: say why the extension needs each permission"),
}
ID_RE = re.compile(r"[a-z0-9][a-z0-9-]{1,63}")
VERSION_RE = re.compile(r"\d+\.\d+\.\d+")
GH_INSTALL = "https://cli.github.com"
GH_SYSTEM = ("/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/usr/bin/gh")
TIMEOUT = 300
READY_KEEP = 20
_ready: dict = {"at": 0.0, "value": None}
LOCK_WAIT = 600
LOCK_POLL = 0.5
BUSY = "another pull request is still running"
_work_guard = threading.Lock()


class Needs(WorkspaceError):
    status = 409

    def __init__(self, message: str, needs: list[dict]) -> None:
        super().__init__(message)
        self.needs = needs


def gh() -> str | None:
    found = os.environ.get("FORMEXT_GH_BIN") or shutil.which("gh")
    if found:
        return None if any(c in found for c in '"$`') else found
    for p in GH_SYSTEM:
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return None


def work_dir() -> Path:
    return paths.sub("registry-work") / "form.ext-registry"


@contextlib.contextmanager
def held(lock_file: Path) -> Iterator[None]:
    deadline = time.monotonic() + LOCK_WAIT
    if not _work_guard.acquire(timeout=LOCK_WAIT):
        raise WorkspaceError(BUSY)
    try:
        with open(lock_file, "a+b") as handle:
            _lock_file(handle, deadline)
            try:
                yield
            finally:
                _unlock_file(handle)
    finally:
        _work_guard.release()


def _lock_file(handle, deadline: float) -> None:
    while not _try_lock(handle):
        left = deadline - time.monotonic()
        if left <= 0:
            raise WorkspaceError(BUSY)
        time.sleep(min(LOCK_POLL, left))


def _try_lock(handle) -> bool:
    handle.seek(0)
    if os.name == "nt":
        import msvcrt

        try:
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            return False
        return True
    import fcntl

    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return False
    return True


def _unlock_file(handle) -> None:
    handle.seek(0)
    if os.name == "nt":
        import msvcrt

        msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        return
    import fcntl

    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def _env() -> dict:
    return dict(os.environ, GIT_TERMINAL_PROMPT="0", GH_PROMPT_DISABLED="1", GH_NO_UPDATE_NOTIFIER="1", GCM_INTERACTIVE="never", GIT_LFS_SKIP_SMUDGE="1", GIT_CEILING_DIRECTORIES=str(work_dir().parent))


def _run(args: list[str], cwd: Path | None = None, timeout: int = TIMEOUT) -> subprocess.CompletedProcess:
    flags = 0x08000000 if os.name == "nt" else 0
    try:
        return subprocess.run(args, cwd=str(cwd) if cwd else None, capture_output=True, text=True, timeout=timeout, env=_env(), stdin=subprocess.DEVNULL, creationflags=flags)
    except subprocess.TimeoutExpired as exc:
        raise WorkspaceError(f"{Path(args[0]).name} {args[1] if len(args) > 1 else ''} did not finish in {timeout} s; check the internet connection") from exc
    except OSError as exc:
        raise WorkspaceError(f"{args[0]} could not start ({exc})") from exc


def _said(out: subprocess.CompletedProcess) -> str:
    lines = [ln for ln in ((out.stderr or "") + "\n" + (out.stdout or "")).strip().splitlines() if ln.strip()]
    return " | ".join(lines[-5:]) or "no message"


def _user(program: str) -> dict | None:
    out = _run([program, "api", "user"], timeout=40)
    if out.returncode != 0:
        return None
    try:
        data = json.loads(out.stdout)
    except ValueError:
        return None
    return data if isinstance(data, dict) and data.get("login") else None


def readiness(fresh: bool = False) -> dict:
    """What the one-step pull request needs on this computer, in the order a person fixes it. Kept for a few seconds, since the
    window asks on every refresh and each answer costs a call to GitHub."""
    if not fresh and _ready["value"] is not None and time.time() - _ready["at"] < READY_KEEP:
        return _ready["value"]
    _ready["value"], _ready["at"] = _readiness(), time.time()
    return _ready["value"]


def _readiness() -> dict:
    program = gh()
    git = sources.git()
    user = _user(program) if program else None
    needs = []
    if not git:
        needs.append({"what": "git", "say": "Install git, the tool that sends the files to GitHub.", "how": "https://git-scm.com/downloads"})
    if not program:
        needs.append({"what": "gh", "say": "Install GitHub's command line (gh); it signs you in to GitHub in the browser.", "how": GH_INSTALL})
    elif not user:
        needs.append({"what": "sign-in", "say": "Sign in to GitHub once: run this in the Terminal tab and follow the browser.", "how": "gh auth login --web --git-protocol https"})
    return {"ready": not needs, "git": bool(git), "gh": bool(program), "signed_in": bool(user), "login": (user or {}).get("login"), "needs": needs, "repo": registry.REPO}


def _git(args: list[str], cwd: Path, program: str, what: str) -> subprocess.CompletedProcess:
    helper = f'!"{program}" auth git-credential'
    out = _run([sources.git(), "-c", "credential.helper=", "-c", f"credential.helper={helper}", *args], cwd=cwd)
    if out.returncode != 0:
        raise WorkspaceError(f"git could not {what} ({_said(out)})")
    return out


def _fork(program: str, login: str) -> str:
    name = registry.REPO.split("/", 1)[1]
    probe = _run([program, "api", f"repos/{login}/{name}", "--jq", ".parent.full_name"], timeout=40)
    parent = probe.stdout.strip() if probe.returncode == 0 else ""
    if probe.returncode == 0 and parent.lower() != registry.REPO.lower():
        raise WorkspaceError(f"your GitHub account already has a repository named {name} that is not a fork of {registry.REPO}; rename it on GitHub, then try again")
    if probe.returncode != 0:
        made = _run([program, "repo", "fork", registry.REPO, "--clone=false"], timeout=120)
        if made.returncode != 0:
            raise WorkspaceError(f"GitHub could not make your fork of {registry.REPO} ({_said(made)})")
    return os.environ.get("FORMEXT_REGISTRY_FORK_URL") or f"https://github.com/{login}/{name}.git"


def _identity(clone: Path, user: dict) -> list[str]:
    name = _run([sources.git(), "config", "user.name"], cwd=clone, timeout=20).stdout.strip()
    email = _run([sources.git(), "config", "user.email"], cwd=clone, timeout=20).stdout.strip()
    if name and email:
        return []
    login = user["login"]
    return ["-c", f"user.name={name or user.get('name') or login}", "-c", f"user.email={email or str(user.get('id') or 0) + '+' + login + '@users.noreply.github.com'}"]


def unfinished(folder: Path) -> list[str]:
    out = []
    for name, (marker, say) in STUBS.items():
        try:
            if marker in (folder / name).read_text(encoding="utf-8", errors="replace"):
                out.append(say)
        except OSError:
            continue
    return out


def _texts(manifest: dict, update: bool) -> tuple[str, str, str, str]:
    eid, version, name = manifest["id"], manifest["version"], manifest.get("name") or manifest["id"]
    branch = f"{'update' if update else 'add'}-{eid}-{version}"
    title = f"{'Update' if update else 'Add'} {name} {version}"
    message = f"feat({eid}): " + (f"version {version}" if update else f"add {name} {version}")
    perms = [p for p in manifest.get("permissions") or [] if isinstance(p, str)]
    lines = [f"{title}: {str(manifest.get('description') or name).rstrip('.')}.", "", f"For {portal.app_name(str(manifest.get('product') or ''))}. Made and checked with form.ext; the registry's own checks passed on this folder before the pull request.", "", "Permissions:"]
    lines += [f"- `{p}`: {publish.PLAIN.get(p, p)} (the README says why)" for p in perms] or ["- none"]
    return branch, title, message, "\n".join(lines) + "\n"


def _push(program: str, user: dict, folder: Path, eid: str, branch: str, message: str, fork_url: str, steps: list[str]) -> str | None:
    clone = work_dir()
    upstream = sources.url("registry") + ".git"
    top = _run([sources.git(), "rev-parse", "--show-toplevel"], cwd=clone, timeout=20) if (clone / ".git").exists() else None
    if top is None or top.returncode != 0 or Path(top.stdout.strip()).resolve() != clone.resolve():
        shutil.rmtree(clone, ignore_errors=True)
        clone.parent.mkdir(parents=True, exist_ok=True)
        _git(["clone", "--no-tags", "--", upstream, str(clone)], clone.parent, program, f"clone {registry.REPO}")
        steps.append("working clone made")
    _git(["remote", "set-url", "origin", upstream], clone, program, "point the clone at the registry")
    remotes = _run([sources.git(), "remote"], cwd=clone, timeout=20).stdout.split()
    _git(["remote", "set-url" if "fork" in remotes else "add", "fork", fork_url], clone, program, "point the clone at your fork")
    _git(["fetch", "--no-tags", "origin", "main"], clone, program, "fetch the registry's main branch")
    _git(["reset", "--hard", "-q"], clone, program, "tidy the working clone")
    _git(["clean", "-fdq"], clone, program, "tidy the working clone")
    _git(["checkout", "-q", "-B", branch, "FETCH_HEAD"], clone, program, f"start the branch {branch}")
    target = clone / "extensions" / eid
    try:
        shutil.rmtree(target, ignore_errors=True)
        shutil.copytree(folder, target, ignore=shutil.ignore_patterns("node_modules", "dist", ".DS_Store", "Thumbs.db"))
    except OSError as exc:
        raise WorkspaceError(f"the extension folder could not be copied into the working clone ({exc.strerror or exc})") from exc
    _git(["add", "-A", "--", f"extensions/{eid}"], clone, program, "stage the extension folder")
    same = _run([sources.git(), "diff", "--cached", "--quiet"], cwd=clone, timeout=60)
    if same.returncode == 0:
        return None
    _run([sources.git(), "update-ref", "-d", f"refs/remotes/fork/{branch}"], cwd=clone, timeout=20)
    _run([sources.git(), "-c", "credential.helper=", "-c", f'credential.helper=!"{program}" auth git-credential', "fetch", "--no-tags", "fork", f"+refs/heads/{branch}:refs/remotes/fork/{branch}"], cwd=clone)
    staged = _run([sources.git(), "write-tree"], cwd=clone, timeout=60).stdout.strip()
    there = _run([sources.git(), "rev-parse", "-q", "--verify", f"refs/remotes/fork/{branch}^{{tree}}"], cwd=clone, timeout=20)
    if there.returncode == 0 and staged and there.stdout.strip() == staged:
        commit = _run([sources.git(), "rev-parse", f"refs/remotes/fork/{branch}"], cwd=clone, timeout=20).stdout.strip()
        steps.append(f"your fork's {branch} already holds exactly this ({commit[:12]}), so nothing was pushed")
    else:
        _git([*_identity(clone, user), "commit", "-q", "-m", message], clone, program, "commit the extension folder")
        commit = _run([sources.git(), "rev-parse", "HEAD"], cwd=clone, timeout=20).stdout.strip()
        steps.append(f"commit {commit[:12]} on {branch}")
        _git(["push", "--force-with-lease", "fork", f"HEAD:refs/heads/{branch}"], clone, program, "push the branch to your fork")
        steps.append(f"pushed to {user['login']}:{branch}")
    return commit


def open_pull_request(pid: str) -> dict:
    ready = readiness(fresh=True)
    if not ready["ready"]:
        raise Needs("the pull request needs a little setup first: " + " ".join(n["say"] for n in ready["needs"]), ready["needs"])
    record = publish.submit(pid)
    folder = Path(record["folder"])
    if not record["checks"]["ok"]:
        raise Needs("the checks found problems, so no pull request was opened; fix them and submit again", [{"what": "checks", "say": p["message"], "how": p.get("where", "")} for p in record["checks"]["problems"]])
    left = unfinished(folder)
    if left:
        raise Needs("the checks passed, but some text is still left for you to write before the owners can review it", [{"what": "text", "say": s, "how": ""} for s in left])
    manifest = workspace.manifest(pid)
    eid = manifest["id"]
    if not ID_RE.fullmatch(str(eid)) or not VERSION_RE.fullmatch(str(manifest.get("version"))):
        raise WorkspaceError("the manifest's id or version is not in the registry's form (a lowercase id, a version such as 1.2.3)")
    program = gh()
    user = _user(program)
    if not user:
        raise Needs("GitHub's sign-in was lost; sign in again", [{"what": "sign-in", "say": "Sign in to GitHub again: run this in the Terminal tab and follow the browser.", "how": "gh auth login --web --git-protocol https"}])
    login = user["login"]
    branch, title, message, body = _texts(manifest, bool(record.get("update")))
    steps = []
    fork_url = _fork(program, login)
    steps.append(f"fork {login}/{registry.REPO.split('/', 1)[1]}")
    with held(work_dir().parent / ".lock"):
        commit = _push(program, user, folder, eid, branch, message, fork_url, steps)
    if commit is None:
        return {"ok": False, "state": "same", "message": f"extensions/{eid} is already exactly this in the registry, so there is nothing to submit", "branch": branch, "steps": steps}
    listed = _run([program, "pr", "list", "--repo", registry.REPO, "--head", branch, "--author", "@me", "--state", "open", "--json", "number,url"], timeout=60)
    try:
        mine = json.loads(listed.stdout) if listed.returncode == 0 else []
    except ValueError:
        mine = []
    if mine:
        url, state = mine[0].get("url"), "updated" if any(s.startswith("pushed") for s in steps) else "unchanged"
    else:
        made = _run([program, "pr", "create", "--repo", registry.REPO, "--base", "main", "--head", f"{login}:{branch}", "--title", title, "--body", body], timeout=120)
        if made.returncode != 0:
            raise WorkspaceError(f"the branch is on your fork, but GitHub did not open the pull request ({_said(made)}); open it by hand at https://github.com/{registry.REPO}/compare/main...{login}:{branch}")
        url = next((ln.strip() for ln in reversed(made.stdout.strip().splitlines()) if ln.strip().startswith("http")), None)
        state = "opened"
    steps.append(f"pull request {state}")
    result = {
        "ok": True,
        "state": state,
        "url": url,
        "branch": branch,
        "fork": f"{login}/{registry.REPO.split('/', 1)[1]}",
        "commit": commit,
        "title": title,
        "steps": steps,
        "next": "The registry's check runs on the pull request, then @nodemode-ai or @gbarnai reviews it; a first pull request from a new fork can wait for an owner to start the check. Nothing is published until they merge.",
    }
    bus.emit("publish.pull_request", {"id": pid, "url": url, "state": state})
    return result
