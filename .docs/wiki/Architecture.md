# Architecture

```text
interface (vanilla TypeScript, Vite, port 5640)
  shell: window, sidebar, palette, dialogs, theme boot, /api/live client
  panes: home, new, edit, preview, check, library, run, package, publish, docs (each frontend/src/panes/<name>/)
  sim: per-app simulated hosts over contract/host/host-bridge.ts
    -> HTTP /api/* and WebSocket /api/live
engine (Python 3.12, FastAPI, 127.0.0.1:8640)
  core: workspace (projects, path safety, disk watcher), bus (live events), settings, paths
  modules: templates, validate, preview, package and keys, portal and publish, library (each routers/<name>.py + services/<name>.py)
  contract kit: formpkg and formext_host imported from contract/, never copied
    -> data folder (FORMEXT_HOME): projects, builds, keys, submissions, settings
    -> FormPortal's folder: extensions/<product>/dev.json
command line and MCP server -> the same services
desktop shell (Tauri 2) -> frozen engine sidecar formext-engine
```

## The interface

The shell discovers panes with `import.meta.glob('../panes/*/index.ts')` and builds the sidebar and every pane container before the first paint; a pane mounts on first open and fills its own final layout in place. Panes talk through the shell's context (`api`, `events`, `project`, `openPane`, `commands`, `dialog`, `notify`) and never import each other. The Docs pane bundles `contract/CONTRACT.md`, `sdk/README.md`, `docs/MANUAL.md` and `docs/apps/*.md` at build time and renders them with its own small Markdown renderer, so Docs works offline and in the demo.

## The engine

`app.main` includes `router` from every `routers/*.py`; a router that fails to import is listed in `/api/health` and the rest keep working. Every file access goes through the workspace's path-safe join (no `..`, no symlinks out). Writes are atomic and announced on `/api/live` as `project.changed`; the watcher announces outside edits the same way, so the editor, Check and Preview follow an agent's changes live.

## Living logs

`frontend/HASHOUT_LOG.md`, `backend/HASHOUT_LOG.md`, `src-tauri/HASHOUT_LOG.md` and one `HASHOUT_LOG.md` per pane folder hold what comments would have said. Read them before editing.
