# HASHOUT_LOG · demo · form.ext

Living log of the offline browser demo. Source files stay comment-free; what they would have said lives here.

Current build version: v0.4.1
Last updated: 2026-11-11 · v0.4.1 rebuilt: `engine/kit.ts` refuses an `entry.ui` that ends in `/`, as the kit's `formpkg.py` and `formext_host.py` now do. Before: v0.4.0 rebuilt: the Publish pane's Open pull request answers that it needs form.ext on the computer, the Studio's source row reads "Source: desktop app" (the sources routes are not ported), and starter READMEs carry Permissions and Screenshot as the engine's do. Before: v0.3.1 the version only (the bundle's two version strings edited by hand). Before: v0.3.0 the page engine moved to frontend/src/demo and the app opens this demo in its window. Before: v0.2.1 the version only

---

## Org-navi-map

```
demo/
├── index.html, assets/, packs/, favicon.*   built output, committed (file:// needs no install)
├── vite.config.mjs                          roots at frontend/, swaps api.ts, writes the IIFE build here
├── tsconfig.json                            type-checks demo/src and, through its imports, frontend/src
└── src/
    ├── entry.ts         boot first, then frontend/src/main.ts
    ├── boot.ts          starts the page engine, first-visit project, /api/ link downloads, reveal, Start Over command
    ├── api.ts           the shell's api module for the page (same exports as frontend/src/shell/api.ts)
    ├── tauri.ts         stub for @tauri-apps/api/core
    └── engine/          now frontend/src/demo/engine/ (v0.3.0), shared with the in-app demo
        ├── router.ts    every engine route the panes call, as (method, pattern) to handler
        ├── vfs.ts       the virtual disk (absolute posix paths, saved in local storage)
        ├── workspace.ts services/workspace.py
        ├── settings.ts  services/settings.py
        ├── templates.ts services/templates.py over the bundled templates/ and contract/examples/
        ├── validate.ts  services/validate.py
        ├── kit.ts       contract/tools/formpkg.py and contract/host/python/formext_host.py
        ├── preview.ts   routers/preview.py, plus the frame document (see #frame)
        ├── zip.ts       deterministic zip writer and reader, CRC-32, deflate through Compression Streams
        ├── package.ts   services/package.py
        ├── keys.ts      services/keys.py with WebCrypto Ed25519
        ├── library.ts   services/library.py
        ├── diff.ts      Myers line diff with difflib's grouped opcodes
        ├── portal.ts    services/portal.py over the simulated FormPortal folder
        ├── publish.ts   services/publish.py
        ├── seed.ts      the sample workspace
        └── ready.ts     the promise every request waits for
```

---

## The real interface, one module swapped {#swap}
- refers-to: demo/vite.config.mjs :: demo · demo/src/api.ts
- kind: decision
- logged: v0.1.0 · 2026-11-07

Every pane reaches the engine through `ctx.api`, which is `frontend/src/shell/api.ts`; four shell files import it as `./api`. The build resolves that one specifier, only when the importer is inside `frontend/src/shell/`, to `demo/src/api.ts`, which exports the same names (`ApiError`, `apiUrl`, `readBody`, `request`, `api`, `errorMessage`) and hands each request to `engine/router.ts` instead of `fetch`. Nothing in `frontend/` is edited. Answers are deep-copied through JSON so a pane never holds the engine's own objects, binary answers (`?raw=1`, a build's file) come back as an `ArrayBuffer` like `readBody` gives, and errors become `ApiError` with the engine's status and `detail`.

Live events need no socket: the page engine imports `emit` from the real `shell/events.ts` and emits the engine's event names (`project.created`, `project.changed`, `package.built`, `runapp.changed`, ...) with the engine's payloads. `connect()` already does nothing on `file:`. Health answers `version: "0.3.1 in this page"`, so the status bar reads "Engine 0.3.1 in this page".

`apiUrl` has one more job: the Edit pane builds `<img src>` for binary files from it and appends `?raw=1&v=...`. For a project file it returns a `data:` address ending in `#`, so the appended query falls into the fragment and the picture still shows. The Package pane's Download is a plain `<a href="/api/...">`; `boot.ts` catches clicks on such links in the capture phase and saves the build's bytes as a file.

---

## A port, checked against the engine {#port}
- refers-to: demo/src/engine/*.ts
- kind: decision
- logged: v0.1.0 · 2026-11-07

Each engine file mirrors one Python service and keeps its messages word for word (including Python's `repr` quoting, through `pyRepr`), because the panes show them. The parity was measured, not assumed: Check on the seventeen first-party packages gives the same rule, file, line and message lists as `validate_folder` in the backend venv, and New plus Check on all thirty-six starters gives the same files, sizes and problems as `templates.create` plus `validate_folder`. When `validate.py`, `templates.py` or the kit's rules change, change the matching file here and run the same comparison (TEST_PLAN in the sidecar).

Known differences: JSON syntax errors carry Chrome's message instead of Python's; `1.0` and `1` are the same number in a page, so the schema's integer check cannot tell them apart; a symlink cannot exist on the virtual disk.

---

## Deterministic packages in the page {#zip}
- refers-to: demo/src/engine/zip.ts · demo/src/engine/kit.ts :: build
- kind: decision
- logged: v0.1.0 · 2026-11-07

`writeZip` writes the same headers Python's `zipfile` writes for the kit (version 20, made by Unix 3.20, DOS date 1980-01-01, external attributes 0100644, no extra fields, no data descriptor, UTF-8 flag only for non-ASCII names) and deflates each entry with `CompressionStream('deflate-raw')`. The result is the same bytes on every build in the same browser. Against the kit's `formpkg` on this machine (Python's zlib-ng at level 9), sixteen of seventeen first-party packages come out byte-identical; Mail Merge (one 59 KB script) gets a different deflate stream, so its SHA-256 differs while its files are the same. The Reproducibility card therefore compares two builds in the page and says so in its run names, rather than claiming the kit's command line ran.

---

## How Preview runs a package without the files route {#frame}
- refers-to: demo/src/engine/preview.ts :: frameDocument, record
- kind: decision
- logged: v0.1.0 · 2026-11-07

`file://` has no `/api/preview/{id}/files/...`, and the kit's bridge sets `frame.src = base + entryUi`. The preview record therefore carries `base: ""` and `entryUi`: a `data:text/html;base64` document built from the package. The kit and the Preview pane are untouched, and the frame keeps `sandbox="allow-scripts"`, an opaque origin and `postMessage` as its only channel.

Tried first and dropped: relative imports inside a `data:` document or a `data:` module fail ("Failed to resolve module specifier") because a `data:` URL is not hierarchical, and `srcdoc` would need the bridge changed. What works (verified in Chrome 153 before writing it): every package script becomes a `data:` module whose relative specifiers are rewritten to `https://package.formext.invalid/{id}/{version}/{path}`; an import map maps those addresses to the modules and lists each module's SHA-256 under `integrity`; each `<script src>` of the entry page becomes an inline `import "..."`. The CSP meta tag allows exactly those hashes plus `'wasm-unsafe-eval'`. Measured in the test page: the package's modules load; an extra inline `<script>`, a script element added at run time, `eval` and an unlisted `data:` module are all refused. Styles are inlined (`'unsafe-inline'`, as the contract allows), `url()`, `src` and `poster` that name package files become `data:` addresses, which `img-src` and `media-src` already allow; fonts need `font-src data:`. The specifier rewrite matches `import ... from`, `export ... from`, bare `import "x"` and `import("x")` with a literal relative path that names a package file; anything else is left as written.

Verified with the newest version of each of the thirteen first-party extensions on the Examples shelf, the FormLit panel starter and the kit's hello (opened through Open Folder): each panel and command was opened, consent given, files dialogs cancelled, with no console error. Chrome caps a navigable URL at 2 MB, so a package whose frame document is larger is reported as refused with that reason.

---

## Reveal and layout shift {#reveal}
- refers-to: demo/vite.config.mjs :: demo (index.html) · demo/src/boot.ts
- kind: decision
- logged: v0.1.0 · 2026-11-07

The shell reveals the window at boot, then restores the project, which renames the top bar's project button (FX8 measured a 0.0146 shift in the desktop window). The demo's `index.html` shows `#app` only with `body.app-ready.demo-ready`; `boot.ts` adds `demo-ready` after `shell.project` has fired and the page engine has no request in flight twice in a row, two frames later (1.2 s when no project restores, 4 s at most). This is the demo's splash: shifts while hidden are not painted, so not counted. Measured with 4x CPU throttling: first visit (seeding included) ready in about 1.2 s, reload in 0.3 to 0.9 s on every pane, CLS 0 on the first visit, on each pane opened from the sidebar and on reload of each pane.

---

## The sample workspace {#seed}
- refers-to: demo/src/engine/seed.ts
- kind: decision
- logged: v0.1.0 · 2026-11-07

First visit (or Start Over): Rating Desk from the FormLit panel starter, built once so Compare Builds has a build; Mail Merge and Golden Hour imported through the Library's registry import (so the Registry shelf shows them as imported); the seed marker is version 2 since v0.1.1, so a disk saved by v0.1.0 (imports recorded as examples) is replaced; a publisher key `demo-publisher` named Demo Publisher, made fresh with WebCrypto; author "Demo Author" in settings; the kit's hello example on the disk at `/home/demo/Extensions/hello` for Open Folder; FormPortal's folder with `installed.json` for FormLit 0.50.0, FormPDF 0.59.0, FormCut 2.14.0, FormVis 2.1.0 and FormPortal 0.63.0 (stand-in `.AppImage` files and a stand-in `formportal-cli`). Golden Hour is the open project. A seed marker with a version lets a later demo build replace an old saved disk.

Golden Hour checks clean, as in the app: since v0.1.0's Check scanner (`backend/HASHOUT_LOG.md#lint-scanner`, mirrored in `engine/validate.ts`) the bundled SDK's own `files.open` and `fetch` wrappers are no longer read as calls, so every first-party package checks with no problem and Package builds without Package Anyway. A project with real code-lint errors still gets Package Anyway, as the app does.

---

## file:// rules {#file}
- refers-to: demo/vite.config.mjs
- kind: decision
- logged: v0.1.0 · 2026-11-07

Chrome runs no module script and fetches no font or file from `file://`. The build emits one classic deferred IIFE (`assets/formext.js`) and one stylesheet, removes the font preloads and every `crossorigin`, makes root paths relative, rewrites `base.css`'s `/fonts/` to the files in `frontend/public/fonts` so they are inlined, and loads `packs/packages.js` as a blocking classic script before the app (it sets `window.__FORMEXT_PACKAGES__`, the registry's packages in base64). The build writes `packs/packages.js` only when `FORMEXT_DEMO_PACKAGES` names a folder of `<id>-<x.y.z>.formpkg` files (v0.1.1 was built from the registry test index's `packages/`, byte-identical to the registry's builds); without it the committed file stays as it is. No machine path is in the config. The two dynamic `import('@tauri-apps/api/core')` calls resolve to a stub that rejects, so external links in Docs and the Library fall back to `window.open` as in a browser. Fixed output names keep rebuilds from leaving stale files, since the output shares the folder with the sources.

---

## The registry in the page {#registry}
- refers-to: demo/src/engine/library.ts :: readIndex, registryShelf, inspectRegistry, importRegistry · demo/src/engine/publish.ts :: submit
- kind: decision
- logged: v0.1.1 · 2026-11-07

The page cannot download the registry's signed index (`file://`, no network, and the registry is private while tested), and it carries no registry key: a test key in a committed page would teach every reader to trust a throwaway key. So the page builds its copy of the index from the packages it carries: the newest version of each id, as the kit's `formpkg.entry` with `verified: true`, the registry's release URL and source tree URL, the SHA-256 and size of the bundled bytes. The shelf answers the engine's shape with `verified: true`, `key: null` and a note that this is the copy bundled with the page and that form.ext itself checks the signed index; the cards show the Verified mark, app, version, permissions and source link as in the app. Inspect and Import look the package up by the entry's URL, compare its SHA-256 with the entry, and import through the same path with `source.kind` `registry` (`index_verified: false`, so the verdict says "matches the index", not "the signed index"). Submit to Registry runs the engine's port: the same folder layout on the virtual disk, form.ext's own Check (a page cannot run the registry's `tools/check.py`, and the note says so), the same commands; Open Folder saves the folder as a zip.

---

## Verified {#verified}
- kind: test
- logged: v0.1.0 · 2026-11-07

Headless Chrome 153 (`/usr/bin/google-chrome`, Playwright) over `file://`, 1440 x 900: every pane opened and screenshotted; the engine routes exercised from the page (build refused then anyway, rebuild counted, reproduce, sign, verify, entry, publish, run, overview, install, open, stop, examples, inspect, import, new, validate, edit, compare, compare file, open folder, net.fetch refusal, keys with passphrase, locked signing); click flows for Package (build, anyway, download, reproduce, sign), Publish (prepare, send), Run in App, Library (choose a file), New (create, lands in Edit) and Preview (consent, panels, headless commands) for every first-party package; Check and New parity with the Python engine; CLS with 4x CPU throttling. Console errors 0, requests that are not `file:`, `data:` or `blob:` 0. Scripts and screenshots: `/home/claude/sidecars/form.ext/demo/`.
