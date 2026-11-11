# HASHOUT_LOG · Edit pane · form.ext

Living log for `frontend/src/panes/studio/` (formerly `edit/`), the Studio module (FX5). Source files stay comment-free; what they would have said lives here.

Current build version: v0.4.1

## Terminal dock {#terminal}

- refers-to: terminal.ts · chat.ts · terminal.css · zones.ts · index.ts · ../../shell/icons.ts · ../../shell/menus.ts
- kind: decision
- logged: v0.2.0 · 2026-11-08

The Terminal tab sits after Output in the bottom panel (`[data-bbody="terminal"]` exists in the final layout, hidden until chosen). `TerminalDock` owns a tab strip for shells, Claude Code and Chat, each backed by an engine session over a WebSocket (text frames for output, a binary frame carrying JSON for the exit). xterm and the fit addon load on first use, so the Studio's chunk does not grow; the theme is read from `--bar`, `--ink` and the accent tokens with a 4.5 contrast floor. The panel grows to 340 px only when the Terminal tab is active and unfolded, set from `bottom.dataset.active` before the tab paints, so switching tabs moves nothing else. Shortcuts: Mod+J toggles, and the commands (new, Claude Code, Chat) are in View. xterm and the ask input would swallow the window shortcuts, so the terminal passes Mod combos up and the ask input stops propagation only for keys it uses. Icons are the family's `agent`, `agentChat` and `terminal`; the sparkle is not used. The chat tab shows the project folder and whether formMCP was found in its first line.
Last updated: 2026-11-08 · v0.2.0 studio

---

## Org-navi-map

```
frontend/src/panes/edit/
├── index.ts      the pane: layout, sessions and buffers, tabs, save, unsaved guard, disk reconcile, commands
├── editor.ts     CodeMirror 6 setup: extensions, theme on the shell tokens, highlight style, languages, goTo, minimalChange
├── tree.ts       the file tree (flat rows with depth, reconciled by path)
├── manifest.ts   the manifest form: details, permissions, panels and commands; setKey and formatManifest
└── edit.css      pane layout and the syntax colour variables (dark and light)
```

---

## Layout and zero flash {#layout}
- refers-to: index.ts :: mount
- kind: decision
- logged: v0.1.0 · 2026-11-07

`mount` writes the whole pane in one `innerHTML`: head, a three-column grid (tree 240 px, editor, manifest form 360 px), the tab strip, the conflict bar, the editor host, the binary viewer, both empty states and the status line. The CodeMirror view is created inside `mount` with an empty read-only state, and the tree and form append their final structure in the same task, so the first paint is the final layout. Everything after that is filled in place: tree rows and tabs are reconciled by path (existing nodes kept, only new ones created), form inputs get `value` set only when it differs and never while focused, and text uses `setText`. Hiding the manifest column keeps the grid track (width 0, `visibility: hidden`) so nothing else reflows beyond the editor widening. The choice is `localStorage['formext.edit.manifest']`.

---

## Buffers and sessions {#buffers}
- refers-to: index.ts :: Session, Buffer, ensure, show, park, stateOf
- kind: decision
- logged: v0.1.0 · 2026-11-07

One `EditorView`; one `EditorState` per open file, so every file keeps its own undo history, selection and scroll. The shown file's live state is `view.state`; `park()` writes it back to the buffer before another file or project is shown (`stateOf` hides the difference). A buffer remembers `base`, the `Text` last read from or written to disk; dirty is `!doc.eq(base)`, so undoing back to the saved text makes the file clean again.

Buffers live in a `Session` per project id and are kept when another project is opened, so switching projects never loses unsaved work: the pane warns once (`N unsaved files in <id> stay here ...`) and the chip in the head counts unsaved files across every session. Open tabs and the active file are stored per project in `formext.edit.tabs.<id>` and come back after a reload.

`manifest.json` (at `package_prefix`, `package/manifest.json` normally, the package root for a linked package-layout folder) is always loaded when a project opens, even without a tab, because the form edits it. Closing its tab resets its state to `base` instead of dropping it.

---

## Two-way manifest sync {#manifest}
- refers-to: index.ts :: mutateManifest, syncForm, afterChange · manifest.ts :: ManifestForm, setKey, formatManifest
- kind: decision
- logged: v0.1.0 · 2026-11-07

The manifest buffer's text is the single source of truth. A form edit calls `mutateManifest(fn)`: parse the text, apply `fn`, print with `formatManifest` (the kit's style: an object or array stays on one line when it fits in 100 columns, otherwise one key per line; the file's own indent and final newline are kept), and apply only the changed span (`minimalChange`) as a transaction with `userEvent: 'input.form'`. When manifest.json is the shown file this goes through `view.dispatch`, otherwise through the buffer's state; either way the change is in that file's undo history, so Mod+Z in manifest.json undoes a form edit. A typed edit in the JSON re-fills the form after 150 ms; a form edit re-fills it at once (for the hints). While the JSON does not parse, the form is disabled with the parser's message; nothing is lost.

`setKey` adds a new key at its place in the contract's field order (`format` ... `permissions`, `minimum_app`, `api`, `description`, `entry`, `contributes`, `homepage`, `support`) and keeps unknown keys and their order. Optional fields (`minimum_app`, `description`, `homepage`, `support`, `entry.ui`) are removed when emptied; required ones stay as empty strings so the hint shows the problem.

Hints come from `package.schema.json`'s patterns (ids, versions, `https://`, relpath, title lengths, 8 panels, 32 commands) plus the host refusals in contract section 3 (`api` must be `"1"`, with a Set to 1 button; `native` must be false; entry needed when anything is contributed; the entry file must exist in the package). They are hints only: the Check pane is the authority.

Panels and commands: renaming a panel's id renames `panel` in commands that open it; removing a panel removes `panel` from those commands (they become headless). Adding the first contribution fills `entry.ui` (ui/index.html when present). A command's panel select lists the current panels plus `Headless`.

---

## Permission words {#permissions}
- refers-to: manifest.ts :: buildPerms
- kind: interface
- logged: v0.1.0 · 2026-11-07

The words are imported from the vendored kit, `contract/host/host-bridge.ts` `PERMISSION_WORDS` (the same strings every host's consent dialog shows, section 7), not copied. `native-code` is listed but disabled: API 1 hosts refuse native extensions. Permissions are written in the schema's order; unknown entries already in the file are kept after them.

---

## Unsaved-change guard {#guard}
- refers-to: index.ts :: closeTab, guard, load, reconcile
- kind: decision
- logged: v0.1.0 · 2026-11-07

- Closing a changed tab asks Save the changes / Discard the changes (shell form dialog, OK is Close File).
- `beforeunload` is armed while any session has an unsaved buffer (browser and Vite reloads). The Tauri window close does not raise `beforeunload` in every webview; a native close guard belongs to `src-tauri` (FX1) if wanted.
- Opening another project keeps the buffers (see buffers). Deleting a project drops its session.
- Outside changes (`project.changed`, debounced 150 ms, from the disk watcher or another pane): a clean buffer takes the new text in place (minimal change, not in undo history); a changed buffer gets the conflict bar (Load Disk Version or Keep Mine; Keep Mine makes the disk text the base, so the next save overwrites it). A file deleted outside closes when clean, and stays with a "Deleted on disk" bar when changed (saving writes it again). An echo of our own save (the text equals the buffer) just marks it clean.

---

## Opening at a place {#open}
- refers-to: index.ts :: pane.open handler, resolvePath, show · editor.ts :: goTo
- kind: interface
- logged: v0.1.0 · 2026-11-07

`ctx.openPane('studio', { path, line, column })` (the Check pane sends `from` and `rule` too, ignored) opens `path` (relative to the project folder, as the files routes; a package-relative path is tried under `package_prefix` as well), puts the cursor at the 1-based line and column, scrolls it to the middle and flashes the line for 1.4 s. The call waits for the project to finish loading, so it works right after `ctx.project.open`.

---

## Editor {#editor}
- refers-to: editor.ts
- kind: decision
- logged: v0.1.0 · 2026-11-07

Languages: JavaScript (js, mjs, cjs), TypeScript, JSX, JSON (with the JSON parse linter), CSS, HTML (and SVG), Markdown; anything else is plain text. Indent unit follows the file (two spaces, four spaces or tab). The theme is an `EditorView.theme` whose values are the shell's CSS variables, and the highlight style uses `--edit-syn-*` variables from `edit.css`, so the light and dark themes switch with no re-creation of views. Keys: the CodeMirror default, search, history, fold, completion and lint keymaps, Tab indents, Mod+S saves inside the editor (it prevents the default, so the shell's own Mod+S command does not run twice). Shell commands: Save File (Mod+S, only while Edit is the active pane), Save All Files (Mod+Alt+S), Edit Manifest, New File in Project, Close File.

Binary files (the engine answers `encoding: base64`) are not edited: images are shown from `?raw=1`, other files show their size.

The tree marks files outside the package folder (not packed, italic) and files whose type `.formpkg` refuses (warning mark), from contract section 2's list.

---

## Dependencies {#deps}
- kind: interface
- logged: v0.1.0 · 2026-11-07

Installed by FX5 in `frontend/` with `npm install --no-save` (FX1 owns `package.json`; the pin is requested in `/home/claude/ext/status/formext-requests.md`): @codemirror/state 6.7.6, view 6.43.15, commands 6.11.1, language 6.13.1, search 6.7.2, autocomplete 6.20.4, lint 6.9.7, lang-javascript 6.2.5, lang-json 6.0.2, lang-css 6.3.1, lang-html 6.4.12, lang-markdown 6.5.2, @lezer/highlight 1.2.5, and what they pull in (@lezer/common, lr, javascript, json, css, html, markdown, @codemirror/streamparser, crelt, style-mod, w3c-keyname), all MIT.

---

## From Edit to Studio, and the zones compositor {#studio}
- refers-to: index.ts · zones.ts · studio.css · tree.ts · ../library · ../check · ../preview · ../package · ../publish · ../run
- kind: decision
- logged: v0.2.0 · 2026-11-08

The Edit pane (folder `edit`) became the Studio (`studio`, `view: 'studio'`): a full-window editor with a tool strip (project switcher, Check, Preview, Run in App, Package, hint line, Publish), a left Files and Library panel, the tabbed code editor, a right Manifest, Permissions and Check inspector and a collapsible bottom panel (Problems, Host calls, Output; Events and Document while Split is on). The `edit-*` class names inside the editor and manifest are kept; the file ids moved with `git mv`, so history follows.

`zones.ts` is the compositor. The part panes (library, check, preview, package, publish, run) are mounted hidden into their own slots; on mount it moves their pieces into the zones: the Library root into the left panel, Preview's stage, bar and message log into the split panel and bottom panel, Check's list and filters into Problems and its Run button and options into the inspector. Package, Run in App and Publish open as a sheet: the part's first child moves into `.st-sheet` and goes back on close, so their code and state are untouched. A part opens through `ctx.openPane(id)`, which the shell turns into `studio.part`; the zones react. The choices (left tab, right tab, bottom tab, split, fold) are remembered in `formext.studio.*`. `check.result` and `library.count` carry the numbers for the inspector summary and the tab counts. The Output tab lists every toast and message (`shell/output.ts`).

Differences from the mock: the host app art is a glyph tile, not the real app icons; the Manifest tab keeps the existing form (its groups are drawn by CSS) instead of the mock's rebuilt group rows; Package, Run in App and Publish open sheets rather than acting as one-click toolbar buttons that only toast.

---

## Host source row in the project card {#source}
- refers-to: index.ts :: paintSource, loadSource, pullSource, projectBar · studio.css :: .st-projcard-src
- kind: decision
- logged: v0.4.0 · 2026-11-10

The project card has a fourth line from the first paint: a muted text (`.st-projcard-c`) and a small ghost button with the refresh glyph, inside `.st-projcard-src`, whose height is fixed at `--ctl-sm`, so no state changes the card's height. `paintSource` writes only the text (`setText`), the `title` and the button label when they differ, the button's `hidden` class and its `disabled` flag. States: absent reads "Source: not here" with Get; pulling reads "Source: fetching" with no button; ready reads "Source: [first 7 characters of the commit]" with Update; failed reads "Source: failed" with Retry. The full sentence for each state (the app's name, the folder, the commit subject, the error) is the text's `title`. The words are this short because the left panel is 287 px at every window width: a first version read "[App] source: not on this computer", and in a browser run the state itself was cut off by the ellipsis in every state. The button has a minimum width so the text's room does not change with the label. With no project or no product the text is empty and the button hidden.

`projectBar` notes the host product; when it differs from the last one it paints from `sourceCache` (a Map per product, so switching back is instant) and asks `GET /api/sources/[product]` once. An answer is cached always but painted only if the open product is still the one asked for. The button posts `/pull` with `{wait: false}` (plus `update: true` when ready), is disabled while the request runs, and paints the answer. The live event `source.changed` re-fetches the status when its key is the open product; it is unsubscribed with the other events.

In the browser demo the routes answer 404: the status is cached as unavailable, the line reads "Source: desktop app", the button stays hidden, and nothing is notified or logged. Other fetch failures leave the row as it was; a failed pull click on any status other than 404 shows one error toast.
