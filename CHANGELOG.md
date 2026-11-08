# Changelog

## v0.2.0 · 2026-11-08

form.ext takes the Form family's look: one window with a start page and a full-window Studio.

- **Start page:** the family sidebar (Home, Recent, Registry, Docs, Preferences, Help) with a 49 px icon rail, a greeting, a Make an extension card, Recent cards and a tile for each of the twelve apps. The sidebar is on this page only.
- **Studio:** the Edit pane is now a full-window editor: tool strip (project, Check, Preview, Run in App, Package, Publish), Files and Library, tabbed code, a Manifest, Permissions and Check inspector, and a bottom panel of Problems, Host calls and Output. Preview opens beside the code; Package, Run in App and Publish open as sheets.
- **Menus:** the macOS system menu bar (File, Edit, View, Project, Package, Publish, Help) built with `@tauri-apps/api/menu`; the same menus in the title row on Windows, Linux and in a browser.
- **Preferences:** Mod+, opens FormVis's Preferences dialog with eight sections wired to the engine's settings.
- **Desktop:** an overlay title bar with the traffic lights in the 38 px title row, the window title follows the open project, and the ground is #0a0a0a.
- **Icons:** the new form.ext app icon (the bundle icons, the README in light and dark) and in-app mark (sidebar, favicon, the splash at 72 px with its bar re-sampled from the mark), and every Form app's own icon art on Start, Recent, the project card and the switcher.
- **Terminal:** a Terminal tab in the Studio's bottom panel (View, Terminal, Mod+J) with real shells, a Claude Code tab and a Chat tab on `claude -p`, started in the open project's folder with formext and formMCP and the skills available. The engine owns the sessions over local-only, session-guarded routes; xterm, ptyprocess and pywinpty are in NOTICE.md.
- **Home:** a Home button and the app name in the title row, and File, Home (Mod+Shift+H) in both the macOS menu bar and the in-window menus, with no layout shift.
- **Scripts:** `formext_oc_install` (renamed from `oc_install`), `build_app` and Windows twins `formext.bat`, `formext_oc_install.bat` and `build_app.bat`.
- **Agents:** `./formext agents install|status|sync` (`--check` for CI) and `./formext claude`; the formMCP hub beside formext in `.mcp.json`, `.codex/config.toml` and `.cursor/mcp.json`; the `formext-hosts` skill and the host apps' own skills copied unchanged, with sources in `.claude/skills/HOSTS.md`.
- **Studio details:** the Manifest inspector in grouped property rows, the Check tool pressed while its results show, Library cards that fit the left panel, no scrollbars anywhere, and zero layout shift as the Studio loads.

## v0.1.1 · 2026-11-07

form.ext reads and submits to form.ext-registry (`nodemode-dev/form.ext-registry`), the single source of official Form extensions.

- **Library:** the Examples shelf is now the Registry shelf. It downloads the registry's signed index (`registry.url`, `FORMEXT_REGISTRY_URL` overrides), checks `extensions.json.sig` with the registry keys compiled into the engine (`backend/app/registry_keys.txt`, comment lines only until the owners add theirs) and `FORMEXT_REGISTRY_PUBKEY`, and shows each extension with the Verified mark, its app, version, permissions and source link. Inspect and Import download the package and check its SHA-256 and publisher signature before the usual import. It says plainly when no key is trusted yet, when the registry is private or not published, unreachable, or the signature does not match. The local examples folders are gone.
- **Publish:** Submit to Registry writes the project in the registry's layout (`extensions/<id>/` with `package/`, the source, README, LICENSE, CHANGELOG and the `docs/screenshot.png` slot), runs the registry's own `tools/check.py` from a local checkout (`registry.checkout`), or form.ext's Check without one, and shows the `git` and `gh` commands that fork the registry and open the pull request.
- **Agents:** `submit` on the command line and as the 27th MCP tool; the harness skill teaches it.
- **Demo:** the page's Library shows the bundled registry packages as the registry's verified entries, and Submit to Registry runs in the page.
- **Contract:** `extensions.schema.json` takes the registry's `verified`, `registry_commit` and `source` entry fields.

## v0.1.0 · 2026-11-07

The first release of form.ext, the Form family's extension studio: make, preview, check, package, sign and publish extensions for every Form app, against the Form Extension Contract, API 1.

- **Home and New:** recent projects, Open Folder, Import .formpkg and the examples; a new project for any of the twelve host apps from a panel, command, or panel-with-commands starter that reads the app's document and runs a real command.
- **Edit:** a file tree, a CodeMirror 6 editor, a manifest form in two-way sync with `manifest.json`, the permission picker in the contract's plain words, panels and commands editors, and an unsaved-change guard.
- **Preview:** the extension in a simulated host for its app, using the contract's own host bridge, with a realistic document, an event injector, a log of every message, and permission and consent toggles.
- **Check:** the schema, the kit's package rules, what an API 1 host accepts, and lint for what the extension sandbox blocks, each problem with its file, line and fix. Bundled, minified SDK code is read correctly, so every first-party extension checks clean.
- **Run in App:** writes FormPortal's `dev.json` for the app so the installed app loads the extension live, lists the installed Form apps and opens them.
- **Package and Sign:** the kit's deterministic `.formpkg` with SHA-256 and size, a byte-for-byte reproducibility check, Ed25519 publisher keys with an optional passphrase, signing and verification the way FormPortal checks it.
- **Publish:** the extensions index entry, a submission folder for formai.studio, and Send to FormPortal.
- **Library:** import and inspect any `.formpkg` safely, compare two builds, and an Examples shelf of the first-party extensions.
- **Docs:** the manual, the contract, the SDK reference and each app's extension API page in the window.
- **Agents:** the `formext` command line and an MCP server with 26 tools over the same engine, wired for Claude Code, Codex and Cursor, with the `formext-harness` and `formext-skillset` skills.
- **SDK:** `@formai/ext` 0.1.0 in `sdk/`.
- **Desktop and demo:** a Tauri 2 shell with the family splash, and an offline browser demo of the real interface in `demo/`.
