---
name: engine-core
description: "form.ext's engine core: backend/app/main.py and the router auto-include, the workspace service (projects, path safety, atomic writes, import and link, the disk watcher), the live bus and /api/live, settings, the data folder paths, health, boot_backend and the PyInstaller entry formext_engine.py. Use when changing how projects are stored or read, adding a core route, fixing a path-safety or watcher bug, or when a router fails to load."
---

# engine-core

## Shape

- `app/main.py` creates the FastAPI app, runs `paths.use_contract()` (puts `contract/host/python` and `contract/tools` on `sys.path`, so modules `import formext_host` and `import formpkg`), and includes `router` from every `app/routers/*.py` found with `pkgutil`: core first (health, settings, projects, live), then the rest alphabetically. A router that fails to import is skipped and listed in `GET /api/health` as `router_errors`. It serves the built interface (`FORMEXT_DIST`, the frozen `frontend_dist`, or `frontend/dist`) with an SPA fallback; `/api/*` misses stay JSON 404.
- Errors: `WorkspaceError` (400), `Unsafe` (400), `NotFound` (404), `Conflict` (409) become `{detail}`; a plain `ValueError` from a route is 400.
- The lifespan attaches the bus to the server loop and starts the watcher. Code that imports `app.main` without serving (the CLI's in-process mode) runs no lifespan: no watcher, and `bus.emit` is a no-op.

## Workspace

- Projects live in `paths.projects_dir()` (`FORMEXT_HOME`, else the OS app-data folder `ai.nodemode.formext`); `projects.json` keeps linked folders, the recent list and meta.
- Ids follow `^[a-z0-9][a-z0-9-]{1,63}$`; new ids are the slug of the name with `-2`, `-3` on collision.
- `create(name, product, files)`: keys without a `package/` prefix go under `package/`; a starter manifest is written when none is given; creation is staged in `projects/.new-*` and moved in one rename.
- `import_folder(path, link)`: copy (skipping `.git`, `node_modules`, symlinks) or link in place. A linked package-layout folder has `package_prefix` `""`: always use `package_dir(id)` and `package_prefix(id)`, never assume `package/`.
- `clean_rel` refuses empty, NUL, absolute, drive-letter and `..` paths; `safe_join` refuses symlinks along the path and anything resolving outside the project. Every read and write goes through them.
- Writes are atomic (temp then rename) and emit `project.changed` with `source: "engine"`; the watcher emits the same with `source: "disk"` for outside edits, skipping paths the engine wrote in the last 2 s. When `manifest.json` changed the event carries the new manifest.

## Bus

`bus.emit(name, data)` is safe from any thread (it posts onto the server loop). Event names are `module.verb`: `project.created`, `project.changed`, `validate.done`, `package.built`, `runapp.running`, `publish.ready`. The interface hears them through `ctx.events.on`.

## Adding a core route

Core routes are few on purpose. A new capability belongs in a module router (`engine-modules`). When a core change is really needed, keep the answer shapes in `backend/HASHOUT_LOG.md` (Routes table) in step, and add the op to `cli.py` so the agents have it.

## Running

`backend/boot_backend` makes `backend/venv` with python3.12 when missing, installs `requirements.txt`, and runs uvicorn on `FORMEXT_HOST` and `FORMEXT_PORT` (default 127.0.0.1:8640) with reload on `backend/app` (`FORMEXT_RELOAD=0` off). `formext_engine.py`: no argument serves (port `0` picks a free one and writes `engine.port`), `--selfcheck` imports everything and fails on any router error, `cli ...` and `mcp ...` hand over to `app.cli.main` and `app.mcp.main`.
