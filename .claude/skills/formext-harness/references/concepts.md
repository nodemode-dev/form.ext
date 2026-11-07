# formext concepts

## Projects and paths

- Projects live in form.ext's data folder (`FORMEXT_HOME`, else the OS app-data folder `ai.nodemode.formext`): `projects/[id]/` with `package/` inside. `status` prints the folder.
- A project id follows the package id pattern: lowercase letters, digits and hyphens, 2 to 64 characters. `new` makes it from the name (`Beat Markers` becomes `beat-markers`, `-2` on collision).
- Tool paths are relative to the project folder: `package/manifest.json`, `package/ui/app.js`, `README.md`. Files outside `package/` (README, notes, sources) are never packed. `..`, absolute paths and symlinks are refused.
- A folder opened with `import {link: true}` is edited in place; when its `manifest.json` is at its root, `package_prefix` is empty and paths are `manifest.json`, `ui/app.js`.
- Writes are atomic and the window shows them at once; edits made in an editor outside form.ext are picked up too.

## What a starter gives you

Every starter has `ui/index.html` (no inline script), `ui/app.js` (the extension), `ui/formext.js` (the SDK as plain JavaScript), `ui/kit.js` (small helpers: `$`, `esc`, `fill`, `status`, `errorText`, `debounce`, `headless`, `plural`) and `ui/base.css` (styles that follow the host's theme tokens). Keep `formext.js` as it is; change `app.js`, `index.html` and the manifest.

## The contract rules that cost the most time

- `manifest.json` needs `format: "formai-package"`, `format_version: 1`, `id`, `name`, `product`, `kind` (usually `script-plugin`), `version` (`x.y.z`), `author`, `licence`, `native: false`, `permissions`, `api: "1"`, `description`, `entry.ui` (required when there are panels or commands) and `contributes`.
- Panel and command ids match `^[a-z0-9][a-z0-9-]{0,31}$`. A panel has `location` `dock` or `dialog`. A command with `panel` opens that panel; one without runs headless: the host loads the page hidden, sends `ext.activate {reason: "command"}`, and closes it on `ext.done` or after 120 s without a pending request.
- The page's CSP: scripts, styles, images, media and fonts only from the package itself; `connect-src 'none'`. So: no inline script elements, no `fetch`, `XMLHttpRequest`, `WebSocket` or `EventSource` (use the SDK's `fetch`, which goes through the host with the `network` permission), no `eval` or `new Function`, no remote fonts or CDN scripts. Inline styles are allowed.
- The sandbox has no same-origin, forms, popups, downloads or top navigation, so `localStorage`, `sessionStorage`, `indexedDB` and cookies throw, and `alert`, `confirm` and `window.open` do nothing. Files go through `openFiles` and `saveFile` (the host's own dialogs); settings through `storageGet` and `storageSet` (256 KB in total).
- `document.apply {label, ops}` runs as one undoable step, using the app's own command ids. `app.run` runs one command and returns its result. Both need `document`.
- Allowed file types: `.html .js .mjs .css .json .svg .png .webp .jpg .jpeg .gif .wasm .txt .md .wav .ogg .mp3 .webm .mp4 .cube .woff2`. At most 20 MB packed, 512 files, paths up to 200 characters.
- `minimum_app` is compared with the version the app reports; leave it out while testing against an unreleased source build.

## Errors

| Where | What it means |
| --- | --- |
| Tool result with `isError` and `status` 404 | No such project, file or build: list them (`projects`, `files`, `builds`) and use the exact id or path |
| `status` 400 | The engine refused the input; the message says why (an unsafe path, a bad id, a manifest that is not JSON) |
| `status` 409 | A conflict, such as a name already taken |
| `package` refused with `problems` | Check found errors; each one has file, line, rule and fix |
| `the engine ... stopped answering` | The window's engine went away mid-call; retry (the tools fall back to in-process) |
| -32001 in the app | The manifest lacks the permission the call needs |
| -32004 in the app | The app refused the op; its message is in the app's words, usually an unknown command or bad args |
| -32003 in the app | The app does not offer this (for example no network) |
