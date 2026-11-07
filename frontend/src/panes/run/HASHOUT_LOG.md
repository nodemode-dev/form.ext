# HASHOUT_LOG · ship · form.ext

Living log of the ship module: the Run in App pane (`frontend/src/panes/run/`), the Publish pane (`frontend/src/panes/publish/`), `backend/app/services/portal.py`, `backend/app/services/publish.py`, `backend/app/routers/runapp.py` and `backend/app/routers/publish.py`. Source files stay comment-free; what they would have said lives here.

Current build version: v0.1.0
Last updated: 2026-11-07 · v0.1.0 ship

---

## FormPortal's folder {#root}
- refers-to: backend/app/services/portal.py :: root, installs, launch_target
- kind: interface
- logged: v0.1.0 · 2026-11-07

- The root follows contract section 3: `FORMPORTAL_ROOT` when set, then form.ext's own setting `formportal_root` (for a person whose FormPortal keeps a moved folder), then the kit's `formext_host.portal_root()` (the platform default, including the macOS `dev.formai.portal` fallback). `GET /api/runapp/root` answers `{path, source, exists}`; `source` is `FORMPORTAL_ROOT`, `settings` or `default`. Every child process form.ext starts (the app, FormPortal, its command line) gets `FORMPORTAL_ROOT` set to that folder, so they all read the same place form.ext writes.
- Installed apps come from `installed.json` at the root, exactly as FormPortal's core `state.rs` writes it: `{installs: [{product, channel, current: {version, path, sha256, installed_at, files?}, previous?}]}`. Channels are `stable`, `beta`, `nightly`; rows are shown stable first.
- What opens an app is a Python port of the core's `find_target` and `deep_find` (`portal.rs`): a lone folder is entered, then the `.app` (macOS), the `.exe` named like the product (Windows), or the AppImage or first executable (Linux), else a search five levels deep preferring a file named like the product. Opening is `open <target>` on macOS and the target itself, in its own folder and session, elsewhere. The answer of `POST /api/runapp/apps/{product}/open` says what was opened.
- Extension state per app: `extensions/P/enabled.json` (FormPortal's) and `extensions/installed.json` (its full record, for names and on or off) are read only. form.ext writes only `extensions/P/dev.json`.

---

## dev.json {#dev}
- refers-to: backend/app/services/portal.py :: read_dev, write_dev, dev_add, dev_remove, reload
- kind: interface
- logged: v0.1.0 · 2026-11-07

- Written exactly per `contract/schema/dev.schema.json`: `{format: "formext-dev-extensions", format_version: 1, product, extensions: [{id, path, added}]}`, two-space JSON, keys in that order, nothing else. `added` is UTC ISO 8601 to the second with `Z`. `path` is the resolved absolute package folder of the project (`workspace.package_dir`, so a linked package-layout folder works too), which holds `manifest.json`.
- Every write is a temp file then one rename, so a host polling the modification time never reads half a file. A write keeps every other row (rows from other tools or other copies of form.ext) and replaces only the row with the same id. An existing dev.json that does not follow the schema is never overwritten by Run: the answer names the problems and the file, so nothing a person wrote by hand is lost. `PUT /api/runapp/apps/{product}/dev` replaces the whole file after the same type-strict check (format_version must be the integer 1) and refuses duplicate ids.
- Reload in App rewrites the same content, which only moves the modification time; hosts re-resolve on that (contract section 3).
- Each row is also checked the way a host will check it, with the kit's `formext_host.check` (source `development`), using the installed app's version when FormPortal installed it and otherwise 999.0.0, so `minimum_app` only refuses when there is a real version to compare. The pane shows that state (Ready to load, Loading live, Refused with the kit's reason).

---

## Sending a package to FormPortal {#send}
- refers-to: backend/app/services/portal.py :: cli_info, send
- kind: decision
- logged: v0.1.0 · 2026-11-07

1. FormPortal's command line when present: the `formportal_cli` setting or `FORMPORTAL_CLI` (a path to `formportal-cli`, or to a `formportal` runner, which then gets `cli` first), then `formportal-cli` on PATH, then `formportal` on PATH (the repository's runner takes `cli`), then a `formportal-cli` inside FormPortal's own install folder. It runs `extension-install --path FILE` with a 90 s limit and returns FormPortal's JSON (`installed`, `note`). A refusal that names a signature or policy is shown as FormPortal's refusal and nothing else is tried.
2. Otherwise FormPortal itself, when FormPortal installed it: its launch target with the package path as the argument (FormPortal's `package_arg` picks the first argument ending in `.formpkg` and asks before it installs).
3. Otherwise the system's handler for `.formpkg` (`open`, `xdg-open`, `os.startfile`).
The answer's `method` is `cli`, `app` or `system`. The installed Tauri app answers only `mcp` as its first argument, not `cli`, which is why the CLI is searched by its own name first.

---

## Publish {#publish}
- refers-to: backend/app/services/publish.py :: prepare, index_problems, _readme
- kind: interface
- logged: v0.1.0 · 2026-11-07

- `POST /api/publish/{id} {url?, publisher?, passphrase?, sign?}` builds with the Package service (`packages.build`, which refuses on Check errors with 422), signs that exact build with the chosen key when it is not signed by it yet (`packages.sign`; a protected key without its passphrase answers 401, which the pane turns into a passphrase dialog), and takes the entry from `packages.entry` (the kit's `formpkg.entry` plus the signature block and the publisher). No key, or `sign: false`, gives an unsigned entry. The key is the one asked for, else the `publisher` setting, else the newest key.
- Before anything is written the one-package index `{format, format_version, name, description, publishers, packages: [entry]}` is checked against `contract/schema/extensions.schema.json` with Check's `schema_errors`, after the schema's references into `package.schema.json` are rewritten to local `$defs` (Check's validator follows only `#/` references). The rules the subset validator does not express are added by hand: a native entry needs a signature, and a signature's publisher must be listed. A failing check refuses with the messages.
- The submission folder is `submissions/<id>-<version>/` in form.ext's data folder, made in a staging folder and moved into place in one rename: the `.formpkg`, `entry.json` (the entry alone), `extensions.json` (the one-package index, with the publisher's public key when signed), `README.md` (fields, plain-word permissions, SHA-256, signature, what each file is, how the site uses it) and `submission.json` (form.ext's record). `GET /api/publish/{id}` returns it with `stale: true` when the project's latest build has another SHA-256.
- The default address is the Package service's `https://formai.studio/extensions/packages/{id}-{version}.formpkg`; any address must start with `https://`.
- `POST /api/publish/{id}/send` sends the submission's package to FormPortal as above; `/reveal` opens the folder with the system.

---

## Submit to Registry {#registry}
- refers-to: backend/app/services/publish.py :: submit, _registry_tree, _registry_checks, _run_registry_check, _own_checks, _commands · frontend/src/panes/publish/index.ts :: renderRegistry, submitRegistry
- kind: interface
- logged: v0.1.1 · 2026-11-07

- `POST /api/publish/{id}/registry` writes `submissions/registry/extensions/<id>/` (staged, then one rename) in form.ext-registry's layout: every package file under `package/` (whatever the project's `package_prefix`), every other project file at the same path (`src/`, `package.json`, `package-lock.json`, `docs/`, `README.md` and the rest) except `import.json`, `dist/` and `build/`, and `README.md`, `LICENSE`, `CHANGELOG.md` written from the manifest when the project has none (listed in `made`). The generated README has what the registry's check 6 needs: a description, the screenshot `![...](docs/screenshot.png)` and a `## Permissions` section naming each permission with a "Why:" for the author to finish; the generated LICENSE is an SPDX line and a note to put the full text in. The record (`<id>.submission.json` beside `extensions/`) is `{project, id, version, folder, files, made, screenshot, screenshot_slot, checks, update, published_version, commands, prepared_at}`; `GET /api/publish/{id}` returns it as `registry.submission` with `registry.folder`, `registry.checkout` and `registry.repo`.
- The checks: when the setting `registry.checkout` names a folder with `tools/check.py`, that file is imported (`importlib`, registered in `sys.modules` so its dataclasses work; it puts its own `tools/` and the clone's `contract/tools` on `sys.path`) and its own functions run: `published_index` (form.ext's registry address when it is not the default, else the script's own default with its `gh` fallback), `registry.load_blocklist`, then `check_extension(folder, {skip_npm: False}, published, None, True, blocked)`. The folder is outside the clone's `extensions/`, which the script's `main` refuses, so `main` is not called; `changed` is true because a submission is a change, and no base commit is compared. The report is printed in `main`'s words. Without a checkout, `_own_checks` runs Check on `package/` (errors only), api and native, README, LICENSE, CHANGELOG and the screenshot, and the note says the registry's script did not run. Nothing of the registry is vendored.
- `update` and `published_version` come from the Library's registry shelf when it can be read. `commands` are `[{say, run}]`: `gh repo fork --clone --remote`, a branch `add-<id>-<version>` (or `update-`) from `upstream/main`, copy the folder in, `python3 tools/check.py extensions/<id>`, commit (`feat(<id>): ...`), push, `gh pr create --repo nodemode-dev/form.ext-registry`. Arguments are shell-quoted. form.ext runs none of them.
- `POST /api/publish/{id}/registry/reveal` opens the folder. The CLI and MCP `submit {id, checkout?}` saves `checkout` as the setting first (it must hold `tools/check.py`).
- Found while testing: a project with no `src/` (a starter, or a package imported from the registry) fails the registry's permission check, because the script then reads the shipped files and the bundled SDK (`ui/formext.js`) names every SDK method. A project that keeps its source in `src/` passes.
- The pane: a "Submit to Registry" section under entry.json with the Registry checkout field (saved to `registry.checkout` on submit), the button, a status notice (which checks ran, passed or not), the folder, files and screenshot facts, Open Folder, Copy Commands, and two fixed-height code blocks for the report and the commands. Everything is in the first render; a submit changes only text.

---

## The panes {#panes}
- refers-to: frontend/src/panes/run/index.ts · frontend/src/panes/publish/index.ts
- kind: decision
- logged: v0.1.0 · 2026-11-07

- Run in App (ship, order 10): the project card (app, state chip, folder, dev.json, what it contributes, Reload in App, Install with FormPortal, Manage in FormPortal, Open App), FormPortal's folder and command line, and a fixed table of the thirteen products (installed versions, development rows with the host's verdict, FormPortal's extensions, Open). F5 runs or stops. While the pane is shown and the window visible it reads `GET /api/runapp` and the project's status every 4 s and repaints only when the answer changed, so a dev.json edited by another tool or a FormPortal install shows without a click.
- Publish (ship, order 30): the address (remembered per project), the key (remembered per project; protected keys ask for the passphrase in the shell's dialog), the submission card and `entry.json` as text.
- Zero shift: every element exists in the first render. The project card and the no-project state share one grid cell and swap with `visibility` (and `inert`), so the sections below never move; the apps table is `table-layout: fixed` with set column widths; the status notices reserve two lines; chips whose text changes sit at the start of a row; the run button has a fixed width with its text at the start; the button whose label names the app is last in its group. Measured 0 inside both panes across load, project open, run, stop and prepare.

---

## Events {#events}
- refers-to: backend/app/services/portal.py · backend/app/services/publish.py
- kind: interface
- logged: v0.1.0 · 2026-11-07

`runapp.changed {product, kind}` after any dev.json write, `runapp.running {id, product, state}`, `runapp.opened {product, channel, pid}`, `runapp.sent {package, method}`, `publish.ready {id, sha256, folder, signed_by}`. The Publish pane also listens to the Package module's `package.built`, `package.signed` and `keys.changed`.
