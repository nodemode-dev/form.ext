# Changelog

## v0.4.0 · 2026-11-10

The host app's source sits beside the project, the skills know the whole family, and the registry pull request opens from the window.

- **Host sources:** form.ext brings the source code of the app an extension is for onto the computer, read-only, in the data folder (`sources/[repository]/`): a shallow clone of the app's public repository, or an archive when git is not installed. A project made or opened in the window pulls its host's source in the background, and the Studio's project card shows where it stands with one button (Get, Update, Retry). New commands and MCP tools: `source`, `source_files`, `source_read`, `source_search`. Each answer names the docs to read first and the files that implement the extension host in that app. Claude Code started from the Studio gets the source as an extra directory, and `docs` answers an app's page from its pulled source when that is newer than the bundled one. FormPortal and the registry can be pulled the same way.
- **The family:** `family` lists every Form app with its repository, API page, starters, skills and source, and says whether formMCP, FormSkills and FormPortal are on the computer. `skills` lists an app's skills (bundled here, in its source, and released through `formskills-cli`) and installs the released ones on request.
- **Skills:** `formext-harness` pulls and reads the host's source before writing code (new `host-source` sub-skill) and names the commit it wrote against; `formext-hosts` gains `family.md` (how the apps, FormPortal, form.ext, the registry, formMCP and FormSkills fit together) and `sources.md` (where each host implements the contract). The host skills and three app API pages (form.md, FormVFX, FormSkills) are refreshed from the apps' current sources.
- **Submit to Registry:** there is no clone to set up. form.ext keeps its own copy of form.ext-registry and runs the registry's `tools/check.py` from it on every submit. **Open pull request** (Publish, or `submit --pull-request`) forks the registry into your GitHub account, pushes the folder on a branch and opens or updates the pull request, through GitHub's `gh`; it asks first, and refuses while the checks fail or a placeholder text is left. `submit --ready` says what the computer still needs. New starter READMEs carry the Permissions and Screenshot sections the registry asks for, and a missing LICENSE is written in full for Apache-2.0 and MIT.
- Checked here: clones of all fourteen family repositories; list, read and search over them; the archive path against a local mirror; `skills` through a locally built formskills-cli; submit with the registry's own checks; the pull request flow against local stand-ins for the registry, a fork and `gh`, from the command line and in the window; both panes in Chrome under 4x CPU and network throttling; the engine self check and the frontend build.
- Includes every v0.3.1 fix: main was merged into this release, and the browser demo bundle was rebuilt from the merged tree (v0.3.1 had edited its version strings by hand).
- Not verified yet: the pull request against GitHub itself, the archive download from GitHub, FormSkills' released catalogue (neither address is reachable from the build machine), Windows, and the frozen desktop engine.

## v0.3.1 · 2026-11-10

- Fixed: the contract kit's id, panel and command id and version patterns ended in `$`, which also matches before a trailing newline, so a manifest with such an id or version passed the check and the package file was named with a newline; they now end in `\Z` in the kit (`formpkg.py`, `formext_host.py`) and in the engine's own id patterns (`portal.py`, `workspace.py`, `keys.py`, `package.py`).
- Fixed: the kit's check accepted an `entry.ui` that the package would never contain (a hidden file or a `../` path); it now requires the entry to be one of the files that get packed.
- Fixed: `formext.bat cli`, `mcp` and `agents` passed the subcommand word twice and dropped the last argument; they now pass the arguments after it.
- Fixed: the kit's `entry.ui` check compares the normalised path, so `./ui/index.html` and `ui//index.html` pass as before, and `SHA_RE` in `package.py` and `library.py` now ends in `\Z` too.
- The tracked demo bundle `demo/assets/formext.js` was not rebuilt: its two version strings (`version:` in the health answer and `hy`) were edited by hand to 0.3.1.
- Fixed: a registry index entry whose `sha256` is not exactly 64 lowercase hex characters is refused before it is used in the package cache path.

## v0.3.0 · 2026-11-09

The browser demo opens inside the app.

- **Demos:** Home has a Demos section with the studio demo (Golden Hour, Mail Merge and Rating Desk in a sample workspace), and Help has Demo: The Studio with Sample Projects (the palette command `demo.studio`; on macOS in the system menu bar too). Opening it asks first, offers Save All when files are unsaved, and reloads the window on the demo's own engine and sample disk: nothing reaches the projects folder, publisher keys, settings or FormPortal's folder, no engine request is made, and the window's remembered project, pane and tabs stay yours. A Demo button in the title bar, Help, Leave the Demo, and Home's Leave Demo end it and remove what the demo made; quitting the app ends it too.
- **Demo:** the page engine moved from `demo/src/engine/` to `frontend/src/demo/engine/` and is shared by the browser demo and the app; the thirteen registry packages the demo shows ship in the app as files (`frontend/public/demos/studio/`, written by `scripts/demo-media.mjs`).
- Fixed: with the sidebar collapsed, the form.ext icon at the top left sat right of the icons below it and was clipped by the edge; it now centres over them.
- Not covered: Preview's grants and extension storage are kept by the contract kit's host bridge under its own keys, which a demo preview shares with a real preview of an extension with the same id.

## v0.2.3 · 2026-11-09

- The Library's registry shelf reads form.ext-registry: this build trusts the registry's index key (`backend/app/registry_keys.txt`), so the signed index and block list are read instead of refused with "this build trusts no registry key yet".

## v0.2.2 · 2026-11-08

- Fixed: the Intel Mac (macos-x64) desktop build's engine could not load package signing, so Library, Package, Publish and Run in App failed to start ("Symbol not found: _SSL_get0_group_name"). cryptography 49 and later ship no Intel Mac wheel, so it was compiled against another OpenSSL than the one the app carried. Intel Macs now install cryptography 48.0.1, whose wheel includes its own OpenSSL; every other platform keeps 50.0.2.
- Checked here: the engine's self check with cryptography 48.0.1, all thirteen routers. Not verified yet: the macos-x64 build, which FormCompiler runs.

## v0.2.1 · 2026-11-08

The README shows the new window, and the repository has the community files every Form repository has.

- **README:** nine new screenshots of the 0.2.0 window (Home in dark and light, New Extension, the Studio, Check, Preview in a simulated app, Package and Sign, the Terminal and Preferences) as WebP, replacing the old PNGs; the icon in light and dark; Home, Terminal and Claude Code, and Preferences sections.
- **Community:** `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md` (extensions go to form.ext-registry, contract changes to the kit first, and the studio, its starters and its SDK here, with the GPL and Apache-2.0 parts named) and `SECURITY.md` (what is supported and what counts here); the README links them.

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
