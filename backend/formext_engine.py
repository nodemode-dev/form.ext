import importlib
import inspect
import json
import os
import sys
import threading
import time

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
        return {"entry_trailing_slash": entry_slash_refused(contract / "examples" / "hello", Path(tmp) / "hello"), "registry_pr_lock": registry_lock_serialises(Path(tmp) / ".lock")}


def entry_slash_refused(example, folder) -> bool:
    import shutil

    import formext_host
    import formpkg

    shutil.copytree(example, folder)
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    verdicts = []
    for entry in ("ui/index.html", "ui/index.html/"):
        (folder / "manifest.json").write_text(json.dumps({**manifest, "entry": {"ui": entry}}), encoding="utf-8")
        ext = formext_host.check(formext_host.Extension(id=manifest["id"], version=manifest["version"], source="sideload", path=folder), manifest["product"], "9.99.9", "the host")
        verdicts.append((bool(formpkg.problems(folder)[0]), ext.state == "refused"))
    return verdicts == [(False, False), (True, True)]


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


def watch_parent() -> None:
    if os.name != "posix" or os.environ.get("FORMEXT_WATCH_PARENT", "1") == "0":
        return
    parent = os.getppid()
    if parent <= 1:
        return

    def run() -> None:
        while os.getppid() == parent:
            time.sleep(2)
        os._exit(0)

    threading.Thread(target=run, name="formext-parent-watch", daemon=True).start()


def announce_port(server, data) -> None:
    def run() -> None:
        for _ in range(600):
            if server.started and server.servers:
                break
            time.sleep(0.1)
        else:
            return
        try:
            port = server.servers[0].sockets[0].getsockname()[1]
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
    bundled = os.path.join(resource_dir(), "frontend_dist")
    if os.path.isdir(bundled):
        os.environ.setdefault("FORMEXT_DIST", bundled)
    os.environ.setdefault("FORMEXT_DESKTOP", "1")
    watch_parent()
    import uvicorn

    from app.main import app as fastapi_app
    from app.services import paths

    host = os.environ.get("FORMEXT_HOST", "127.0.0.1")
    port = int(os.environ.get("FORMEXT_PORT", "8640") or 0)
    server = uvicorn.Server(uvicorn.Config(fastapi_app, host=host, port=port, log_level="info"))
    data = paths.home()
    announce_port(server, data)
    try:
        server.run()
    finally:
        try:
            if json.loads((data / PORT_NAME).read_text(encoding="utf-8")).get("pid") == os.getpid():
                (data / PORT_NAME).unlink()
        except (OSError, ValueError, AttributeError):
            pass
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
    return serve()


if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()
    sys.exit(main())
