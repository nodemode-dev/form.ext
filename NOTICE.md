# form.ext notices

form.ext is licensed under the GNU General Public License v3.0 (`LICENSE`, SPDX `GPL-3.0-only`). The Form Extension Contract kit (`contract/`), the `@formai/ext` SDK (`sdk/`) and the starters (`templates/`) stay under the Apache License 2.0 (each folder's own `LICENSE`, or the kit's), so the extensions you make with form.ext are yours to license as you choose. It includes or depends on the following work. Versions are the exact pins in `frontend/package-lock.json`, `backend/requirements.txt` (with the installed backend venv for the packages they bring) and `src-tauri/Cargo.lock`.

## Shipped in the app

| Component | Use | License |
| --- | --- | --- |
| Form Extension Contract kit, Apache-2.0, nodemode (`contract/`, vendored unchanged; `sdk/src/formext.ts` and the starters' `ui/formext.js` are a copy and a plain-JS translation of its `sdk/formext.ts`) | the spec, schemas, SDK, host bridge in Preview, `formext_host` and `formpkg` in the engine | Apache-2.0 |
| Form family icon art: the form.ext app icon and in-app mark (`frontend/public`, `src-tauri/icons`, `assets/app-icon`) and the twelve host apps' icons (`frontend/src/assets/icons`), the owner's own art for the Form apps | the window, the Start and Studio screens, the splash, the desktop bundle and the README | GPL-3.0-only (this repository) |
| Inter by Rasmus Andersson, latin woff2 from `@fontsource/inter` 5.3.0 (`frontend/public/fonts/inter-*`) | interface font | SIL Open Font License 1.1 |
| JetBrains Mono by JetBrains, latin woff2 from `@fontsource/jetbrains-mono` 5.3.0 (`frontend/public/fonts/jetbrains-mono-*`) | code font | SIL Open Font License 1.1 |
| CodeMirror 6: `@codemirror/state` 6.7.6, `view` 6.43.15, `commands` 6.11.1, `language` 6.13.1, `search` 6.7.2, `autocomplete` 6.20.4, `lint` 6.9.7, `lang-javascript` 6.2.5, `lang-json` 6.0.2, `lang-css` 6.3.1, `lang-html` 6.4.12, `lang-markdown` 6.5.2, `streamparser` 6.0.0, by Marijn Haverbeke and contributors | the Edit pane's code editor, bundled into the interface | MIT |
| Lezer: `@lezer/common` 1.5.5, `lr` 1.4.12, `highlight` 1.2.5, `javascript` 1.5.6, `json` 1.0.3, `css` 1.3.9, `html` 1.3.13, `markdown` 1.8.1, by Marijn Haverbeke and contributors | the editor's parsers and highlighting, bundled | MIT |
| crelt 1.0.7, style-mod 4.1.4, w3c-keyname 2.2.8, `@marijn/find-cluster-break` 1.0.4, by Marijn Haverbeke | CodeMirror's DOM, style and key helpers, bundled | MIT |
| xterm.js (`@xterm/xterm` 6.0.0) and its fit addon (`@xterm/addon-fit` 0.11.0), by the xterm.js authors | the Terminal tab's terminal screen, loaded when the tab first opens | MIT |
| `@tauri-apps/api` 2.11.1 | the interface's calls into the desktop shell | Apache-2.0 OR MIT |
| Tauri 2: tauri 2.11.6, tauri-build 2.6.3, tauri-plugin-shell 2.3.6, tauri-plugin-dialog 2.7.3, tauri-plugin-single-instance 2.4.5 | the desktop shell | Apache-2.0 OR MIT |
| regex 1.13.1, serde_json 1.0.151 | the shell reading the engine's port and JSON | Apache-2.0 OR MIT |
| objc2 0.6.4, objc2-app-kit 0.3.2 (macOS only) | the splash window's corner mask and clear background (`reveal.rs`) | MIT |
| FastAPI 0.141.1, Starlette 1.10.0 | the engine service | MIT, BSD-3-Clause |
| Uvicorn 0.53.0 with its `standard` extras: websockets 17.4, watchfiles 1.3.0, httptools 0.9.0, uvloop 0.23.0, h11 0.16.0, click 8.5.1, python-dotenv 1.2.4, PyYAML 6.0.3 | HTTP and WebSocket serving (`/api/live`), the disk watcher | BSD-3-Clause (uvicorn, websockets, click, python-dotenv); MIT (watchfiles, httptools, h11, PyYAML); uvloop MIT, its wheel also carries the Apache-2.0 text |
| python-multipart 0.0.32 | form and upload bodies | Apache-2.0 |
| pydantic 2.14.3, pydantic-core 2.50.4, annotated-types 0.8.0, annotated-doc 0.0.5, typing-inspection 0.4.5, typing-extensions 4.16.0 | request models for FastAPI | MIT (typing-extensions PSF-2.0) |
| anyio 4.16.0, idna 3.20 | async I/O (also the command line's in-process calls), host names | MIT, BSD-3-Clause |
| cryptography 50.0.2 (48.0.1 on Intel Macs, the last with a wheel for them), with the OpenSSL its wheels link statically, cffi 2.1.1 and pycparser 3.12 | Ed25519 publisher keys and package signatures (package module) | Apache-2.0 OR BSD-3-Clause (cryptography); Apache-2.0 (OpenSSL 3); MIT-0 (cffi); BSD-3-Clause (pycparser) |
| ptyprocess 0.7.0 (macOS and Linux) | the Studio's Terminal tab: engine-owned pseudo-terminals for shells and Claude Code | ISC |
| pywinpty 3.0.5 (Windows) | the same Terminal tab on Windows (ConPTY) | MIT |
| CPython 3.12, embedded by PyInstaller in the one-file engine sidecar | runs the engine | PSF-2.0 |

The Python rows were read from the `*.dist-info/METADATA` of `backend/venv` (Python 3.12). What PyInstaller freezes is what the engine imports; the build tools below are not frozen.

## Desktop shell: crates under other licences

Tauri links these crates unedited (no `[patch]`, no vendored copy): cssparser, selectors, dtoa-short and option-ext (MPL-2.0, Tauri's HTML handling in tauri-utils, source at crates.io) and r-efi (MIT OR Apache-2.0 OR LGPL-2.1-or-later, used under MIT). The Linux bundles use the system's WebKitGTK, GTK and GLib (LGPL-2.1-or-later) as shared libraries.

## Build and development only (not shipped)

| Component | Use | License |
| --- | --- | --- |
| Vite 8.3.5 | builds the interface and the demo | MIT |
| TypeScript 7.0.2 | type checks the interface, builds `sdk/dist` | Apache-2.0 |
| `@tauri-apps/cli` 2.11.4 | builds the desktop app | Apache-2.0 OR MIT |
| PyInstaller 6.22.3, pyinstaller-hooks-contrib 2026.9, altgraph 0.17.5, packaging 26.3 | freezes the engine sidecar (`setup/freeze_backend`) | GPL-2.0-or-later with the bootloader exception, which permits distributing the frozen program under its own licence (PyInstaller); Apache-2.0 OR GPL-2.0 (hooks-contrib, used under Apache-2.0); MIT (altgraph); Apache-2.0 OR BSD-2-Clause (packaging) |

## Agent skills copied from the Form apps (not shipped in the app)

The skills in `.claude/skills` and `.agents/skills` named in `.claude/skills/HOSTS.md` are copied byte for byte from the Form apps' repositories, each by NodeAgentc, Inc. They teach an agent to understand and drive the host apps; they are read by Claude Code, Codex and Cursor, not bundled in the desktop app. `formvis-driving` (FormVis), `formcut-mcp` (FormCut), `formwav-harness` (FormWav), `formpdf-harness` (FormPDF), `formdeck-harness` (FormDeck), `formlit-driving` (FormLit), `formencoder-harness` (FormEncoder) and `formvfx-harness` (FormVFX) come from repositories licensed under the Apache License 2.0; `formmcp-harness` (formMCP) and `formportal-harness` (FormPortal) come from repositories licensed under the GNU General Public License version 3, as their `LICENSE` files say. The source repository and commit of each copy are in `HOSTS.md`.

## Demo and media

The browser demo (`demo/`) bundles only what the interface bundles (the rows above) and the first-party extension packages from their own Apache-2.0 repositories (`nodemode-dev/formext-<product>-<id>`, linked from the Library). The screenshots in `assets/` are of form.ext itself. There are no photographs or third-party media (`demo/CREDITS.md`).

Trademarks: Form app names belong to nodemode. Other product names mentioned in the docs belong to their owners.
