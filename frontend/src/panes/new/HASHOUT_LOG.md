# HASHOUT_LOG · new and home · form.ext

Living log of the New module: the New pane, the Home pane, the templates service and route, and `templates/`. Source files stay comment-free; what they would have said lives here. The Home pane's notes are here too (`src/panes/home/` has no log of its own).

Current build version: v0.1.0
Last updated: 2026-11-07 · v0.1.0 new and home

---

## Org-navi-map

```
templates/
├── _shared/ui/              formext.js (the kit's sdk/formext.ts as plain JS), kit.js (small helpers), base.css
└── <product>/<starter>/     twelve host apps x panel, command, panel-commands
    ├── template.json        title, name, summary, uses (read by the service, never written into a project)
    ├── manifest.json        a complete, valid manifest with a real id and name
    └── ui/                  index.html, app.js, plus copies of the three _shared files
backend/app/services/templates.py   catalogue, detail, render, create, examples, create_example
backend/app/routers/templates.py    /api/templates routes
frontend/src/panes/new/             New pane (index.ts, new.css, this log)
frontend/src/panes/home/            Home pane (index.ts, home.css)
```

---

## Starters {#starters}
- refers-to: templates/**
- kind: decision
- logged: v0.1.0 · 2026-11-07

Each folder is a package root that passes `python3 contract/tools/formpkg.py validate` on its own and Check (`validate_folder`) with no warning: every one asks only for the permissions its code calls, every headless command handles `ext.activate` and calls `ext.done`, nothing inline, no direct network. Each starter does one real thing with its app's API from that app's `docs/EXTENSIONS.md` (ops, `what` values, events and argument names copied from there, nothing invented):

| Product | Panel | Command | Panel with commands |
|---|---|---|---|
| formvis | Layer List: visibility and active layer (`tool:set_layer`) | Name Stamp (`tool:add_text`) | Frame Maker (`tool:draw_shape`, storage) |
| formcut | Marker List (`marker.*`, `transport.seek`) | Split Here (`clips.split`, `marker.add`) | Beat Markers (`media.beats`, `marker.add`) |
| formwav | Marker List (`add-marker`, `set-marker`, `remove-marker`) | Loop Selection (`set-loop`) | Region Loops (`session.set-loop`, `add-region`) |
| formpdf | Page Words (`text`, `pdf-go-page`) | Number Pages (`page_numbers`) | Watermark (`watermark`) |
| formdeck | Notes Desk (`apply-ops` on notes, `go-to-slide`) | Agenda Notes (`apply-ops`) | Deck Outline (`slide:<id>`, `files.save`) |
| formlit | Rating Desk (`photo.rate`, `photo.flag`) | Keeper (`photo.flag`, `photo.rate`, `photo.label`) | Keyword Stamp (`photo.addKeywords`, `photo.removeKeywords`) |
| formmd | Heading Map (`blocks`, `doc.select`) | Dated Entry (`doc.insertMarkdown`) | Reading Time (`doc.insertMarkdown`, `doc.replaceBlock`) |
| formencoder | Queue Board (`queue.start/pause/stop`, `encode.estimate`) | Retry Failed (`queue.resetStatus`) | Preset Switch (`presets`, `queue.setPreset`) |
| formvfx | Layer Strip (`layer.select`, `layer.addMarker`) | Fade In Out (`prop.addKey`) | Lower Third (`layer.newShape`, `layer.newText`, `layer.setParent` with `$N.layer`) |
| formmcp | Agent Switchboard (`set_for`, `select_agent`, `select_filter`) | Lean Start (`set_start`) | Profile Snapshots (`profile_save`, `profile_use`, `profile_delete`) |
| formtray | Board Tidy (`board.*`) | Pin Running (`stack.pin`) | Group Maker (`group.create`) |
| formskills | Skill Shelf (`library`, `open-skill`) | Format Check (`check`) | Skill Finder (`search`, `open-file`, `download`) |

Patterns every starter follows, so a person can read one and know them all: handlers are registered before `formext.hello()` (the host sends `ext.activate` after `host.hello`); a panel answers `ext.activate` at once and refreshes on the app's `document.changed` and selection events, debounced; every change is one `formext.apply('<literal label>', ops)` so it is one undo step and Check sees the permission; a headless command goes through `kit.headless(run, onPanel)`, which answers `ext.activate` immediately, runs the work on the next task, notifies on error and always calls `ext.done`. A command with `panel` (reason `command` and `panel` set) goes to `onPanel`, not to the headless runner, so one page serves both kinds.

The page layout of every starter is final in its HTML (lists carry a placeholder row, text slots hold `&nbsp;`) and script fills it in place with `kit.fill`, which writes only when the markup differs: no flash, no jump. `kit.fitHeight` sends `ui.resize` only when the height changes by 2 px or more.

`_shared/ui/formext.js` is `contract/sdk/formext.ts` translated to plain JS line for line (same class, methods, timeouts, theme handling) plus `textToBase64`; it keeps `class FormExt` and `host.hello` so Check recognises it as the SDK and skips its method strings. `.ts` is not a package file type, so starters ship JS and need no build step. The copies inside each starter are `cp` of `_shared`; the service overlays `_shared` again when it writes a project, so a project always gets the current shared files even if a copy lags.

---

## The templates service {#service}
- refers-to: backend/app/services/templates.py · backend/app/routers/templates.py
- kind: interface
- logged: v0.1.0 · 2026-11-07

| Route | Answer |
|---|---|
| `GET /api/templates` | `{starters: [{id, title, summary}], products: [{id, name, repo, docs, starters: [summary]}], examples}`; a summary is `{product, starter, title, name, summary, uses, description, permissions, panels, commands, id}` |
| `GET /api/templates/{product}/{starter}` | the summary plus `files: [{path, size, text}]`, `product_name`, `docs` |
| `POST /api/templates/create` | `{product, starter, name, description?}` makes a project and answers it (the engine's project object plus `template`) |
| `GET /api/templates/examples` | `{examples: [{id, name, product, description, permissions}]}` from `contract/examples/` |
| `POST /api/templates/examples/{id}` | `{name?}` copies a kit example into a new project |

`render` writes the package under `package/` and a `README.md` beside it (what the starter uses, where the files are, what to do next). In the manifest it sets `id` (the project id), `name`, `author` and `licence` from Settings, `description` when one is given, and any panel or command title that equals the starter's name. In `.html` and `.md` files it replaces the starter's name (from `template.json`) with the new one; code is never rewritten. `create` predicts the id with the workspace's `slug`; when the workspace picks another (a taken id gets `-2`), it rewrites `manifest.json` with the real id, so the manifest id always equals the project id. Names are trimmed, collapsed, 1 to 64 characters. `docs` is `docs/apps/<product>.md` when the Docs module has bundled it, else `null`. Python: `from app.services import templates` (`templates.create(product, starter, name)`), for the CLI and MCP.

---

## The New pane {#new}
- refers-to: src/panes/new/index.ts · new.css
- kind: interface
- logged: v0.1.0 · 2026-11-07

Three steps on one page: app (the twelve `HOSTS` as radio cards with their icons), starter (three cards that fill in each starter's name, panel and command counts and permissions for the chosen app), and name (name, optional description, and a detail card: what it asks for in the contract's plain words, what it adds, which API calls it uses). The cards and the detail card are drawn from `HOSTS` and the fixed starter list before the catalogue arrives, so the layout never moves; the catalogue fills text in place. The last app and starter are remembered (`formext.new.product`, `formext.new.starter`). Arrow keys move between radio cards. The name follows the chosen starter until the person types their own; the id preview uses the engine's slug rule.

Create posts to `/api/templates/create`, opens the project (`ctx.project.open`) and calls `ctx.openPane('edit', { path: 'package/ui/app.js', from: 'new' })`.

Other modules open it with `ctx.openPane('new', { product?, starter?, name? })`. It registers the command `new.extension` (Mod+N).

---

## The Home pane {#home}
- refers-to: src/panes/home/index.ts · home.css
- kind: interface
- logged: v0.1.0 · 2026-11-07

Hero, three actions (New Extension, Open Folder, Import .formpkg), Recent (eight rows from `GET /api/projects/recent`, three skeleton rows until then), Start for an app (opens New with that product), and Examples (the kit's `examples/`, Copy makes a project). Recent reloads, debounced, on `project.created`, `project.deleted`, a `project.changed` that carries a manifest, `shell.project` and reconnection. A row opens the project and goes to Edit (Check when there is no Edit pane); its trash button moves a data-folder project to the trash or forgets a linked folder, after a confirm.

Open Folder asks for a path in the shell's form dialog and posts `/api/projects/import` (`link` on by default: the folder is worked on in place). Import .formpkg belongs to the Library module: Home calls `ctx.openPane('library', { action: 'import', from: 'home' })`, and says so in a toast when the Library pane is not in the build. More in the Library shows only when that pane exists. Commands: `home.open-folder` (Mod+Shift+O), `home.import`.
