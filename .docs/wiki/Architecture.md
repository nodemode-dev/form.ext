# Architecture

```text
interface (vanilla TypeScript, Vite, port 5640)
  shell: 38 px title row, menus (native on macOS), start sidebar, palette, dialogs, Preferences, theme boot, /api/live client
  panes: home, new, docs (start pages), studio (the compositor), and the parts library, check, preview, package, publish, run (each frontend/src/panes/<name>/)
  sim: per-app simulated hosts over contract/host/host-bridge.ts
    -> HTTP /api/* and WebSocket /api/live
engine (Python 3.12, FastAPI, 127.0.0.1:8640)
  core: workspace (projects, path safety, disk watcher), bus (live events), settings, paths
  modules: templates, validate, preview, package and keys, portal and publish, library, sources (each routers/<name>.py + services/<name>.py)
  host sources: services/sources.py (pull, update, remove, read, search), family.py (the apps and the tools around them), registry_pr.py (fork, branch, push, pull request)
  contract kit: formpkg and formext_host imported from contract/, never copied
    -> data folder (FORMEXT_HOME): projects, builds, keys, submissions, settings, sources/ (read-only app source), registry-work/ (pull request clone)
    -> FormPortal's folder: extensions/<product>/dev.json
command line and MCP server -> the same services
desktop shell (Tauri 2) -> frozen engine sidecar formext-engine
```

## The interface

The shell discovers panes with `import.meta.glob('../panes/*/index.ts')` and builds the start sidebar and every pane container before the first paint; the layout (`data-layout` start or studio, `data-rail`) is set on the root by the inline boot script. A pane declares `view`: `start` (own page with the sidebar), `studio` (the full-window editor) or `part`. Part panes mount hidden and the Studio's zones compositor moves their pieces into the left, centre, right, bottom and sheet zones. A pane mounts on first open and fills its own final layout in place. Panes talk through the shell's context (`api`, `events`, `project`, `openPane`, `commands`, `dialog`, `notify`) and never import each other. The Docs pane bundles `contract/CONTRACT.md`, `sdk/README.md`, `docs/MANUAL.md` and `docs/apps/*.md` at build time and renders them with its own small Markdown renderer, so Docs works offline and in the demo.

## The engine

`app.main` includes `router` from every `routers/*.py`; a router that fails to import is listed in `/api/health` and the rest keep working. Every file access goes through the workspace's path-safe join (no `..`, no symlinks out). Writes are atomic and announced on `/api/live` as `project.changed`; the watcher announces outside edits the same way, so the editor, Check and Preview follow an agent's changes live.

Host sources: `routers/sources.py` answers `GET /api/sources`, `GET /api/sources/family`, `GET /api/sources/{key}`, `POST /api/sources/{key}/pull` (`update`, `wait`), `DELETE /api/sources/{key}`, `GET /api/sources/{key}/files`, `file`, `search` and `skills`, and `POST /api/sources/{key}/skills`. A source is a shallow clone (or an archive when git is missing) in `sources/[repository]/` in the data folder, read-only and never inside the tree or a project; the setting `sources.local.[key]` points a key at your own checkout, which is never deleted. `routers/publish.py` also answers `GET` and `POST /api/publish/{pid}/registry/pull-request`, which `registry_pr.py` carries out in `registry-work/`. New live events: `source.changed {key, state, commit?, error?}` when a pull starts, ends or fails, and `publish.pull_request {id, url, state}` as the pull request opens. The window pulls the host app's source in the background when a project is made or opened (`sources.auto`), and Claude Code started from the Studio gets it as an extra directory.

## Living logs

`frontend/HASHOUT_LOG.md`, `backend/HASHOUT_LOG.md`, `src-tauri/HASHOUT_LOG.md` and one `HASHOUT_LOG.md` per pane folder hold what comments would have said. Read them before editing.
