# HASHOUT_LOG · check · form.ext

Living log of the Check module: `frontend/src/panes/check/`, `backend/app/services/validate.py`, `backend/app/routers/validate.py`. Source files stay comment-free; what they would have said lives here.

Current build version: v0.1.0
Last updated: 2026-11-07 · v0.1.0 check

---

## Routes {#routes}
- refers-to: backend/app/routers/validate.py
- kind: interface
- logged: v0.1.0 · 2026-11-07

- `POST /api/projects/{id}/validate` checks the saved files of the project's package folder (`workspace.package_dir`) and answers `{ ok, counts: {error, warning, info}, problems, files, bytes, manifest, id, product, checked_at, ms, project }`. Each problem is `{ rule, severity, file, line, column, message, fix, path }`: `file` is relative to the project folder (`package/ui/app.js`, or `ui/app.js` for a linked package-layout folder), so it is the same `rel` the files routes take; `line` and `column` are 1-based, 0 when the problem has no place (a file-type refusal); `path` is the manifest field (`contributes.panels[0].location`) for manifest problems. Problems are sorted errors first, the manifest first, then by file and line. `ok` means no errors.
- It emits `validate.done` `{ id, ok, counts, checked_at }` on `/api/live`, so the CLI, the MCP server or the Package pane running a check shows in the Check pane, and the Package pane can refuse a build on `ok: false`.
- `GET /api/validate/rules` lists the rules `{ id, severity, title, text }`.
- Python callers (CLI, MCP, library import): `from app.services.validate import validate_folder` then `validate_folder(folder, prefix="")` on any package folder; `prefix` is put before every file path.

---

## How a check runs {#order}
- refers-to: backend/app/services/validate.py :: validate_folder
- kind: decision
- logged: v0.1.0 · 2026-11-07

1. `json`: manifest.json is read and parsed; a syntax error carries JSON's own line and column. `locate` is a small position-keeping parser run on the same text, mapping every manifest path to its line, so manifest problems point at the key.
2. `package`: the vendored kit's `formpkg.files_of` and `formpkg.problems`, imported (never copied). Their messages are kept word for word; a fix text is added from the field. A missing `entry.ui` file becomes `missing-entry`. When `problems` raises on a malformed manifest (a non-object `entry` or `contributes`) that is reported as info, and the schema step says what is wrong. Logged as a contract issue.
3. `schema`: `contract/schema/package.schema.json` is read at run time and checked with a small draft 2020-12 subset validator (`$ref` to `$defs`, `type`, `const`, `enum`, `required`, `properties`, `additionalProperties: false`, `items`, `minLength`, `maxLength`, `pattern`, `maxItems`, `uniqueItems`), with type-strict `const` and `enum` (so `format_version: true` fails, which Python's `True == 1` lets through the kit). No jsonschema dependency. A schema problem on a field the kit already reported (same field or below it) is dropped, so each mistake shows once.
4. `host`: what an API 1 host refuses (contract section 3): a missing `api`, `native: true`, then `formext_host.check` with a development source and app version 99.99.9 (so `minimum_app` never refuses), its reason shown unless the field was already reported.
5. Lint over the package's `.html`, `.js`, `.mjs` and `.css` up to 2 MB each. The contract SDK (a file holding `class FormExt` and `host.hello`) is skipped. Comments are blanked out first (line breaks kept, strings kept) so line numbers stay true and commented-out code does not count. A bundled, minified SDK is handled by the scanner in `backend/HASHOUT_LOG.md#lint-scanner` (strings and regular expressions blanked for the code rules, definitions are not calls, the SDK's own wrappers are not uses). Rules and their reasons are in `RULES`; the CSP and sandbox they enforce are contract sections 4 and 5.
6. Permissions: method names in quotes (`'files.open'`) and the SDK's methods (`readDocument`, `apply('label'`, `run('cmd'`, `openFiles`, `saveFile`, `client.fetch`) are mapped to the permission they need. Used but undeclared is an error at the first call; declared but unused is a warning at the permission in the manifest. `models` and `native-code` have no API 1 method, so they are always unused.
7. Headless commands (no `panel`) need `ext.activate` handled and `ext.done` called.
8. Sizes: a file over 5 MB is a warning; when the files add up to over 20 MB the deflated size is estimated and over 20 MB is an error. The real packed size is the Package module's.

Check reads what is saved on disk; unsaved editor buffers are not seen (the pane runs again on every save).

---

## The pane {#pane}
- refers-to: frontend/src/panes/check/index.ts
- kind: decision
- logged: v0.1.0 · 2026-11-07

- The whole layout (head, filter bar, status notice, groups container, the three empty states, the rules table) is written in `mount`; later updates only set text, toggle `hidden` and move keyed rows. Rows are keyed by rule, file, line, column and message and kept between runs, so a re-check after a save changes only the rows that changed.
- Runs when a project opens, on the Check button, on F7 (command `check.run`, Check Project), on `openPane('check', { run: true })`, and, with Check on save (default on, `localStorage['formext.check.auto']`), 500 ms after a `project.changed` for the open project. A `validate.done` from someone else re-runs it to fetch the problems; while a run is in flight such events are ignored, so the pane's own event does not loop.
- Clicking a problem calls `ctx.openPane('studio', { path, line, column, from: 'check', rule })` with `path` relative to the project folder. The Edit pane is asked to open that file at that line.
- The filter (All, Errors, Warnings, Info) is kept in `localStorage['formext.check.filter']`; groups collapse per file.
