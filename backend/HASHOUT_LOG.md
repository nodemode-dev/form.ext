# backend HASHOUT_LOG

The living log of the form.ext engine. Read it before editing `backend/`. Core files belong to the engine module; module routers and services (`routers/<module>.py`, `services/<module>.py`) keep their own notes in their own HASHOUT logs.

## 0.1.0 engine core

### Running

- `backend/boot_backend` makes `backend/venv` with `python3.12` and installs `requirements.txt` when the venv is missing, then runs uvicorn on `FORMEXT_HOST` (default `127.0.0.1`) and `FORMEXT_PORT` (default `8640`). `FORMEXT_RELOAD=0` turns off `--reload`; with it on, only `backend/app` is watched, so a new `routers/<module>.py` loads without a restart.
- `FORMEXT_HOME` moves the data folder; otherwise it is the OS app-data folder named `ai.nodemode.formext` (macOS Application Support, Windows `%APPDATA%`, Linux `$XDG_DATA_HOME` or `~/.local/share`).
- `FORMEXT_WATCH=0` turns off the disk watcher (useful for one-shot scripts that import `app.main`).

### Data folder

| Path | What |
|---|---|
| `projects/<id>/` | one project: `package/` is the package root (holds `manifest.json`, packed by `formpkg`), sources and notes beside it |
| `projects.json` | `linked` (id to an outside folder opened in place), `recent` (ids, newest first), `meta` (name, product, created, opened) |
| `settings.json` | only the keys a person changed; defaults live in `services/settings.py` |
| `builds/`, `keys/`, `trash/` | for the package module, the keys module, and removed projects |
| `engine.port` | `{pid, port}` while the frozen engine runs |

### Interfaces

- `app.main` includes `router` from every `app/routers/*.py` found with `pkgutil` (core first: health, settings, projects, live; then the rest alphabetically). A router that fails to import is skipped and reported in `GET /api/health` as `router_errors`, so one module's bug never stops the engine. When a built frontend exists (`FORMEXT_DIST`, the frozen `frontend_dist`, or `frontend/dist`) it is served at `/` with an SPA fallback; `/api/*` misses stay JSON 404.
- `paths.use_contract()` runs at import of `app.main`: `contract/host/python` and `contract/tools` are on `sys.path`, so modules `import formext_host` and `import formpkg` from the vendored kit, unchanged.
- `WorkspaceError` (400), `Unsafe` (400), `NotFound` (404), `Conflict` (409) become `{detail}` JSON. A plain `ValueError` from a route becomes 400.
- Project ids follow the package id pattern `^[a-z0-9][a-z0-9-]{1,63}$`; new ids are the slug of the name, with `-2`, `-3` on collision. One-letter names become `<slug>-extension`.
- `workspace.create(name, product, files)`: keys are relative to the project folder. When no key starts with `package/`, every file goes under `package/` (so a starter can pass package-relative paths). A starter manifest (api 1, kind `script-plugin`, version 0.1.0, author and licence from settings) is written when none is given. Creation is staged in `projects/.new-*` and moved into place in one rename.
- `workspace.import_folder(path, link)`: the folder must hold `manifest.json` at its root (package layout) or in `package/` (project layout). Copy mode copies into the data folder (skipping `.git`, `node_modules` and the like, dropping symlinks); link mode opens the folder in place, and a package-layout folder then has `package_prefix` `""`. Always use `package_dir(id)` or `package_prefix` rather than assuming `package/`.
- Path safety: `clean_rel` refuses empty, NUL, absolute, drive-letter and `..` paths; `safe_join` refuses any symlink along the path and anything that resolves outside the project. All reads and writes go through it.
- Writes are atomic (temp file then rename) and emit `project.changed` with `source: "engine"`. The watcher (watchfiles over `projects/` and every linked folder) emits the same event with `source: "disk"` for outside edits, skipping paths the engine wrote in the last 2 s, hidden folders and temp files. When `manifest.json` is among the paths the event carries the new `manifest`.
- `bus.emit` is safe from any thread: it posts onto the server loop. The loop is attached at startup and again by each `/api/live` connection.

### Routes

| Route | Answer |
|---|---|
| `GET /api/projects` | `{projects: [project]}`, newest change first |
| `POST /api/projects` | `{name, product, files?}` creates; `{path, link?}` imports. Files are `rel: text`, `rel: {text}` or `rel: {base64}` |
| `POST /api/projects/import` | `{path, link?, name?}` |
| `GET /api/projects/recent` | `{projects}` in opening order (so a project named `recent` cannot be opened by id) |
| `GET /api/projects/{id}` | the project, and marks it opened (`?touch=false` to just read) |
| `DELETE /api/projects/{id}` | moves a data-folder project to `trash/`, or forgets a linked one (its folder is kept) |
| `GET /api/projects/{id}/files` | `{id, package_prefix, files: [{path, size, modified, package}]}` |
| `GET /api/projects/{id}/files/{rel}` | `{path, size, modified, encoding: "utf-8", text}` or `{encoding: "base64", base64}`; `?raw=1` gives the bytes |
| `PUT /api/projects/{id}/files/{rel}` | JSON `{text}` or `{base64}`; `?raw=1` takes the raw body |
| `DELETE /api/projects/{id}/files/{rel}` | removes a file or a folder |
| `POST /api/projects/{id}/move` | `{from, to}` |
| `GET /api/health` | version, api, pid, home, contract folder, live clients, routers, router errors |
| `GET/PUT /api/settings` | merged settings plus `home`; PUT merges a partial object (nested objects merge, a top-level `null` removes that key) |
| `WS /api/live` | `{name, data, at}`: `hello`, `engine.started`, `project.created`, `project.changed`, `project.deleted`, `settings.changed`, and every module's events |

A project is `{id, name, product, version, dir, package_dir, package_prefix, manifest, manifest_error, linked, created, opened, modified}`; it is a superset of the shell's `ProjectRef`.

### Desktop build

- `backend/formext_engine.py` is the PyInstaller entry: no argument serves (port `FORMEXT_PORT`, default 8640, `0` for any free port, written to `engine.port`); `--selfcheck` imports the whole app and the kit and fails on any router error; `--version`; `cli ...` and `mcp ...` hand over to `app.cli.main` and `app.mcp.main` when those modules exist. On POSIX it exits when its parent process is gone (`FORMEXT_WATCH_PARENT=0` turns that off for manual runs).
- `setup/freeze_backend` installs `requirements.txt` and PyInstaller 6.22.3 (a build tool, not shipped code) into the venv, builds the frontend when `frontend/dist` is missing, and makes one file, `src-tauri/binaries/formext-engine-<target triple>`, with `frontend_dist`, `contract`, `templates` and `docs` packed as data, then runs its self-check. The Tauri `externalBin` name is `binaries/formext-engine`. `FORMEXT_TARGET` overrides the triple.

### Dependencies

`fastapi`, `uvicorn[standard]` (brings `websockets`, `watchfiles`, `httptools`, `uvloop`), `python-multipart`, `cryptography` (Ed25519 for the package and keys module). Each has a row in `NOTICE.md`. A new dependency gets its row there in the same commit.

## Module notes (where each module's backend files are explained)

| Module | Files | Notes |
|---|---|---|
| Check | `services/validate.py`, `routers/validate.py` | `frontend/src/panes/check/HASHOUT_LOG.md` (and #lint-scanner below) |
| New and Home | `services/templates.py`, `routers/templates.py`, `templates/` | `frontend/src/panes/new/HASHOUT_LOG.md` |
| Preview | `routers/preview.py` | `frontend/src/panes/preview/HASHOUT_LOG.md` (covers `frontend/src/sim/` too) |
| Package | `services/package.py`, `services/keys.py`, `routers/package.py` | `frontend/src/panes/package/HASHOUT_LOG.md` |
| Ship | `services/portal.py`, `services/publish.py`, `routers/runapp.py`, `routers/publish.py` | `frontend/src/panes/run/HASHOUT_LOG.md` |
| Library | `services/library.py`, `routers/library.py` | `frontend/src/panes/library/HASHOUT_LOG.md` |
| Agents | `app/cli.py` (the engine client and the `OPS` table both surfaces are built from), `app/mcp.py` | `.claude/skills/formext-skillset/sub-skills/agent-substrate/SUB-SKILL.md`. After any op change run `./formext cli agents-sync` (regenerates `.claude/skills/formext-harness/references/tools.md` and the `.agents/skills/formext-harness` mirror) and commit both. |
| Demo | none here | `demo/src/engine/` ports `services/{workspace,settings,templates,validate,package,keys,library,portal,publish}.py` and `routers/preview.py`; a change to those needs the same change there (`demo/HASHOUT_LOG.md#port`). |

### Check lint scanner {#lint-scanner}

`scan_js` gives two copies of a script, both the same length as the source so offsets stay lines and columns: `code` with comments blanked, and `bare` with string, template text and regular-expression contents blanked too (quotes kept, `${...}` expressions kept as code). The code rules (`fetch`, `eval`, storage, dialogs, the SDK calls) run on `bare`, so a word inside a string is never a call; an `import` counts only where `bare` still has the keyword and it is not a property (`x.import(`). A match that is followed by a parameter list and `{` is a definition, not a call (the bundled SDK's `fetch(t,n={}){...}` method). Method strings count as uses unless they are the first argument of `this.call(` or `this.on(` (the SDK's own wrappers) or items of an array made only of method strings (the SDK's long-timeout set). With these rules every first-party package in `/home/claude/ext/packages` checks with no problem, the minified ones included, and FX3's bad fixture gives exactly the problems it gave before. The demo's `engine/validate.ts` has the same scanner.
