import importlib
import inspect
import json
import logging
import os
import sys
import threading
import time

if sys.stdin is None:
    sys.stdin = open(os.devnull, encoding="utf-8")
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")

PORT_NAME = "engine.port"


def resource_dir() -> str:
    return getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))


def selfcheck() -> int:
    info = {"python": sys.version.split()[0]}
    for name in ("fastapi", "uvicorn", "starlette", "pydantic", "websockets", "watchfiles"):
        try:
            module = __import__(name)
            info[name] = getattr(module, "__version__", "ok")
        except Exception as exc:
            info[name] = f"missing: {exc}"
    try:
        from app import __version__
        import app.main as engine
        from app.services import paths

        info["formext"] = __version__
        info["routers"] = engine.app.state.routers
        info["router_errors"] = engine.app.state.router_errors
        info["contract"] = (paths.contract_dir() / "CONTRACT.md").is_file()
        info["frontend"] = bool(paths.frontend_dist())
        import formext_host  # noqa: F401
        import formpkg  # noqa: F401

        info["kit"] = "ok"
        info["checks"] = checks(paths.contract_dir())
    except Exception as exc:
        info["app"] = f"failed: {exc!r}"
        print(json.dumps(info))
        return 1
    print(json.dumps(info))
    return 0 if info["contract"] and not info["router_errors"] and all(info["checks"].values()) else 1


def checks(contract) -> dict:
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        return {
            "entry_ui_paths": entry_slash_refused(contract / "examples" / "hello", Path(tmp) / "hello"),
            "registry_pr_lock": registry_lock_serialises(Path(tmp) / ".lock"),
            "registry_pr_push_held": pull_requests_serialise(Path(tmp) / "registry"),
            "registry_pr_lock_gives_up": registry_lock_gives_up(Path(tmp) / "wait.lock"),
            "window_key_writes": window_key_writes(),
            "window_key_bootstrap": window_key_bootstrap(),
            "seal_catches_edit": seal_catches_edit(),
            "agent_consent": agent_consent(),
            "agent_tabs_blocked": agent_tabs_blocked(),
        }


def _asgi(app, method: str, path: str, headers: list) -> int:
    import anyio

    state = {"status": 0}

    async def receive():
        return {"type": "http.request", "body": b"{}", "more_body": False}

    async def send(message):
        if message["type"] == "http.response.start":
            state["status"] = message["status"]

    scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method, "scheme": "http", "path": path, "raw_path": path.encode(),
             "query_string": b"", "root_path": "", "headers": [(b"host", b"127.0.0.1:8640"), (b"content-type", b"application/json"), *headers],
             "client": ("127.0.0.1", 0), "server": ("127.0.0.1", 8640), "state": {}}
    anyio.run(app, scope, receive, send)
    return state["status"]


def window_key_writes() -> bool:
    import re

    from app.main import app
    from app.services import window_key

    if set(window_key.OPEN) != {"/mcp", "/api/window/key"}:
        return False
    tried = 0
    for path, operations in app.openapi()["paths"].items():
        for method in sorted({m.upper() for m in operations} - set(window_key.READS)):
            if path in window_key.OPEN:
                continue
            tried += 1
            if _asgi(app, method, re.sub(r"\{[^}]+\}", "zz-none", path), []) != 403:
                return False
    return tried > 40


def window_key_bootstrap() -> bool:
    from app.main import app
    from app.services import window_key

    if window_key.stdout_mode() or window_key.STATE["claimed"]:
        return True
    first, second = _asgi(app, "POST", "/api/window/key", []), _asgi(app, "POST", "/api/window/key", [])
    keyed = _asgi(app, "POST", "/api/projects/zz-none/validate", [(window_key.HEADER.encode(), window_key.KEY.encode())])
    return first == 200 and second == 409 and keyed != 403


def seal_catches_edit() -> bool:
    from app.services import seal

    saved = sys.modules.get("keyring")
    try:
        seal.reset()
        seal._CACHE.update(tried=True, available=True, key=b"s" * 32)
        signed = seal.sign({"formportal_root": "", "formportal_cli": "/opt/formportal/bin/formportal"})
        kept = seal.effective(signed)
        edited = seal.effective({**signed, "formportal_cli": "/tmp/elsewhere"})
        seal.reset()
        sys.modules["keyring"] = None
        missing = seal.effective({"formportal_cli": "/opt/formportal/bin/formportal"})
    finally:
        seal.reset()
        if saved is None:
            sys.modules.pop("keyring", None)
        else:
            sys.modules["keyring"] = saved
    return (kept["seal"] == "ok" and kept["formportal_cli"] == "/opt/formportal/bin/formportal" and edited["sealBroken"] and edited["formportal_cli"] == ""
            and missing["seal"] == "unavailable" and missing["formportal_cli"] == "/opt/formportal/bin/formportal")


def agent_consent() -> bool:
    from app.services import consent

    saved = consent.access
    try:
        results = {}
        for mode in ("ask", "blocked", "allowed"):
            consent.access = lambda mode=mode: mode
            results[mode] = consent.check("new", "New extension", {}) if consent.windows() == 0 else "window open"
    finally:
        consent.access = saved
    return results == {"ask": consent.NO_WINDOW, "blocked": consent.BLOCKED, "allowed": None}


def agent_tabs_blocked() -> bool:
    from app.services import consent

    saved, token = consent.access, "selfcheck-tab-token"
    consent.open_tab(token, "")
    try:
        results = {}
        for mode in ("ask", "blocked", "allowed"):
            consent.access = lambda mode=mode: mode
            mark = consent.from_tab(token)
            try:
                results[mode] = consent.check("new", "New extension", {})
            finally:
                consent.end_tab(mark)
    finally:
        consent.access = saved
        consent.close_tab(token)
    return results == {"ask": None, "blocked": consent.BLOCKED_TAB, "allowed": None} and not consent.is_tab(token)


def entry_slash_refused(example, folder) -> bool:
    import shutil

    import formext_host
    import formpkg

    shutil.copytree(example, folder)
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    verdicts = []
    entries = {"ui/index.html": False, "./ui/index.html": False, "ui//index.html": False, "ui/index.html/": True, "ui/index.html/.": True, "ui/index.html//": True, "ui\\index.html": True}
    for entry, refused in entries.items():
        (folder / "manifest.json").write_text(json.dumps({**manifest, "entry": {"ui": entry}}), encoding="utf-8")
        ext = formext_host.check(formext_host.Extension(id=manifest["id"], version=manifest["version"], source="sideload", path=folder), manifest["product"], "9.99.9", "the host")
        verdicts.append((bool(formpkg.problems(folder)[0]), ext.state == "refused") == (refused, refused))
    return all(verdicts)


def registry_lock_serialises(lock_file) -> bool:
    from app.services import registry_pr

    spans: list[tuple[float, float]] = []
    probes: list[bool] = []

    def hold() -> None:
        with registry_pr.held(lock_file):
            start = time.monotonic()
            probes.append(file_lock_taken(lock_file))
            time.sleep(0.2)
            spans.append((start, time.monotonic()))

    workers = [threading.Thread(target=hold) for _ in range(2)]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join()
    if len(spans) != 2 or not all(probes):
        return False
    first, second = sorted(spans)
    return first[1] <= second[0]


def pull_requests_serialise(root) -> bool:
    from types import SimpleNamespace

    from app.services import registry_pr

    (root / "work").mkdir(parents=True)
    (root / "ext").mkdir()
    spans: list[tuple[float, float]] = []
    results: list[dict] = []

    def push(*_args) -> None:
        start = time.monotonic()
        time.sleep(0.2)
        spans.append((start, time.monotonic()))

    stubs = {
        "readiness": lambda fresh=False: {"ready": True, "needs": []},
        "publish": SimpleNamespace(submit=lambda pid: {"folder": str(root / "ext"), "checks": {"ok": True, "problems": []}}, PLAIN={}),
        "workspace": SimpleNamespace(manifest=lambda pid: {"id": "selfcheck-ext", "version": "1.0.0", "product": "formext"}),
        "gh": lambda: "gh",
        "_user": lambda program: {"login": "selfcheck"},
        "_fork": lambda program, login: "file:///selfcheck",
        "_push": push,
        "work_dir": lambda: root / "work" / "form.ext-registry",
    }
    saved = {name: getattr(registry_pr, name) for name in stubs}

    def submit() -> None:
        results.append(registry_pr.open_pull_request("selfcheck"))

    try:
        for name, stub in stubs.items():
            setattr(registry_pr, name, stub)
        workers = [threading.Thread(target=submit) for _ in range(2)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join()
    finally:
        for name, original in saved.items():
            setattr(registry_pr, name, original)
    if len(spans) != 2 or [r.get("state") for r in results] != ["same", "same"]:
        return False
    first, second = sorted(spans)
    return first[1] <= second[0]


def registry_lock_gives_up(lock_file) -> bool:
    from app.services import registry_pr
    from app.services.workspace import WorkspaceError

    saved = registry_pr.LOCK_WAIT
    entered = threading.Event()
    release = threading.Event()
    refusals: list[str] = []

    def hold() -> None:
        with registry_pr.held(lock_file):
            entered.set()
            release.wait(5)

    def wait_on(take) -> None:
        try:
            take()
        except WorkspaceError as exc:
            refusals.append(str(exc))

    holder = threading.Thread(target=hold)
    try:
        registry_pr.LOCK_WAIT = 0.3
        holder.start()
        entered.wait(5)
        started = time.monotonic()
        wait_on(lambda: registry_pr.held(lock_file).__enter__())
        thread_wait = time.monotonic() - started
        with open(lock_file, "a+b") as other:
            started = time.monotonic()
            wait_on(lambda: registry_pr._lock_file(other, time.monotonic() + 0.3))
            file_wait = time.monotonic() - started
    finally:
        release.set()
        holder.join()
        registry_pr.LOCK_WAIT = saved
    return refusals == [registry_pr.BUSY, registry_pr.BUSY] and thread_wait < 3 and file_wait < 3


def file_lock_taken(lock_file) -> bool:
    if os.name == "nt":
        return True
    import fcntl

    with open(lock_file, "a+b") as other:
        try:
            fcntl.flock(other.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return True
        fcntl.flock(other.fileno(), fcntl.LOCK_UN)
        return False


def watch_shell(data) -> None:
    from app.services import runtime, startup

    shell = startup.shell_pid()
    if not shell and os.name == "posix" and os.environ.get("FORMEXT_WATCH_PARENT", "1") != "0":
        shell = os.getppid()
    if shell <= 1:
        return

    def leave() -> None:
        logging.getLogger("formext").info("the app that started this engine is gone (process %s), stopping", shell)
        runtime.release(data)
        os._exit(0)

    startup.watch(shell, leave)


def announce_port(server, data) -> None:
    from app.services import window_key

    def run() -> None:
        for _ in range(600):
            if server.started and server.servers:
                break
            time.sleep(0.1)
        else:
            return
        try:
            port = server.servers[0].sockets[0].getsockname()[1]
            if window_key.stdout_mode():
                print(f"{window_key.ADDRESS}http://127.0.0.1:{port}", flush=True)
            (data / PORT_NAME).write_text(json.dumps({"pid": os.getpid(), "port": port}), encoding="utf-8")
        except (OSError, IndexError):
            return

    threading.Thread(target=run, name="formext-port-file", daemon=True).start()


def passthrough(module_name: str, argv: list[str]) -> int:
    try:
        module = importlib.import_module(module_name)
    except ImportError as exc:
        print(f"formext: {module_name} is not part of this build ({exc})", file=sys.stderr)
        return 2
    entry = getattr(module, "main", None)
    if entry is None:
        print(f"formext: {module_name} has no main()", file=sys.stderr)
        return 2
    sys.argv = [f"formext {module_name.rsplit('.', 1)[-1]}", *argv]
    result = entry(argv) if inspect.signature(entry).parameters else entry()
    return int(result or 0)


def serve() -> int:
    from pathlib import Path

    from app.services import paths, runtime, startup

    try:
        data = paths.home()
        logs = runtime.start_logging(data).parent
    except OSError as err:
        print(f"formext cannot use its data folder: {err}", file=sys.stderr)
        return 5
    startup.keep_errors(logs)
    log = logging.getLogger("formext")
    if startup.alone():
        beside = startup.app_beside(Path(sys.executable))
        if beside is not None and startup.open_app(beside):
            log.info("started without its app, so it opened %s and stopped", beside)
            return 0
        log.error("started without its app, and no app program was found near %s", sys.executable)
        print("formext-engine is a part of form.ext and serves nothing on its own. Open form.ext instead.", file=sys.stderr)
        return 4
    try:
        runtime.claim(data)
    except startup.Busy as err:
        log.error("%s", err)
        print(err, file=sys.stderr)
        return 2
    bundled = os.path.join(resource_dir(), "frontend_dist")
    if os.path.isdir(bundled):
        os.environ.setdefault("FORMEXT_DIST", bundled)
    os.environ.setdefault("FORMEXT_DESKTOP", "1")
    watch_shell(data)
    import signal

    import uvicorn

    from app.main import app as fastapi_app
    from app.services import window_key

    def leave(_signum, _frame) -> None:
        runtime.release(data)
        os._exit(0)

    signal.signal(signal.SIGTERM, leave)

    host = os.environ.get("FORMEXT_HOST", "127.0.0.1")
    port = int(os.environ.get("FORMEXT_PORT", "8640") or 0)
    server = uvicorn.Server(uvicorn.Config(fastapi_app, host=host, port=port, log_level="info"))
    runtime.start_logging(data)
    window_key.announce()
    announce_port(server, data)
    try:
        server.run()
    finally:
        runtime.release(data)
    return 0 if server.started else 3


def main() -> int:
    args = sys.argv[1:]
    if "--version" in args:
        from app import __version__

        print(f"formext {__version__}")
        return 0
    if "--selfcheck" in args:
        return selfcheck()
    if args and args[0] == "cli":
        return passthrough("app.cli", args[1:])
    if args and args[0] == "mcp":
        return passthrough("app.mcp", args[1:])
    try:
        return serve()
    except Exception:
        logging.getLogger("formext").exception("the engine stopped on an error")
        raise


if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()
    sys.exit(main())
