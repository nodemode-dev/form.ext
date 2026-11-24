# Changelog

## v0.11.0 · 2026-11-23

form.ext has a full test suite.

- `./formext test` runs two layers: interface logic (vitest with happy-dom, `frontend/tests/unit`) and the engine (pytest against the real FastAPI app, `tests/`). `./formext test unit` or `./formext test engine` runs one. `docs/TESTING.md` says how to run them and what a test must do to be accepted.
- 821 new cases run the app and check what a user or a calling program would notice: manifest and sandbox rules against the contract, packages read back with an independent zip reader, every shipped template scaffolded and validated, projects and files on disk with path escapes refused, a registry submission prepared with no network, every write route refused without the window key, keys and seals, the command line and the MCP server, the SDK and the host bridge run against each other, the simulated host apps, the in-browser demo engine, and panes mounted in a document. With the 41 cases that were already here, 862 pass.
- No app code changed. Where a test showed the app to be wrong, the test stays as a strict expected failure whose reason starts with `DEFECT:`. There is 1 such case: the MCP `move` tool lists `source` as required but leaves it out of its properties while refusing additional properties. `git grep -n "DEFECT:" tests frontend/tests` lists it.
- CI runs the tests on every pull request in one job, `test`, on Linux.
- Not run for this version: the browser demo in `demo/` was not rebuilt, so its built script still says 0.10.0. The desktop shell has no tests. The tests did not run on macOS or Windows.

## v0.10.0 · 2026-11-20

form.ext understands the Form family's shared style names, its browser demo is rebuilt, and the README says it is released.

- **Shared style names:** every style name FormVis uses now works in form.ext too, each one following form.ext's own colours, sizes and three themes, so a panel shared across the family looks right here without changes. Nothing in form.ext looks different: the screens were compared before and after in Studio Dark, light and AMOLED Black.
- **The browser demo is rebuilt:** the demo you open from `demo/index.html` now shows this version and everything added since 0.4.1, and it opens with no error in the browser's console (it no longer asks for a window key that only the app has).
- **The README's status** now says released, built and tested on macOS, Windows and Linux (the owner's statement).
- Checked here: on Linux, the demo built before and after and opened in three themes and three views, the value of every style name compared, the tests in `tests/` (41, none of which can start a real agent program), the agents check, the engine's self check, the hosts check and the frontend build as the repository's own checks run them.
- Not verified by this release: the desktop shell was not compiled on the build machine. No real agent program was run.

## v0.9.0 · 2026-11-20

The Windows engine opens no console window, the app waits a shorter time for its engine, and the terminal panel's guide names all four agent programs.

- **No console window on Windows:** the Windows engine is now built without a console window of its own. A build made with `FORMEXT_ENGINE_WINDOWED=0` keeps the console. macOS and Linux are unchanged.
- **Behaves differently:** the app now waits at most 90 seconds for its engine to come up, instead of 120, and then shows the dialog that says why.
- **Fixed on macOS:** an engine that was left behind and had just been ended could still be taken for running, and the next start was refused with "could not stop an engine that was left running". It now counts as gone.
- **The guide in the terminal panel:** when Claude Code is installed, the guide now also says that Codex, Cursor and Antigravity each get a button of their own when they are on this computer. The manual names all four programs where it says which of the Studio's own tabs are not asked.
- Checked here: on Linux, the Windows build script with stand-ins (the console switch on by default and off with `0`, never on Linux), the engine's self check with no output streams, the shell's start-up functions with the 90 second wait in a scratch build, the macOS fix with the Linux process folder hidden, the tests in `tests/` (41, none of which can start a real agent program), the agents check, the engine's self check, the hosts check and the frontend build as the repository's own checks run them.
- Not verified yet: anything on Windows or macOS. The desktop shell was not compiled on the build machine, so the release build is its first compile. No real agent program was run.

## v0.8.0 · 2026-11-19

form.ext starts and stops cleanly beside its engine, on Windows too, and a start that fails says why.

- **Nothing is left running after a quit:** on Windows the engine and everything it started (terminals, agent programs) now end when the app ends, however it ends, a quit and Task Manager alike. On every system the engine watches the app that started it and stops within about two seconds when that app is gone.
- **A start that fails says why:** when the app cannot start, a dialog now says what happened (the engine program is missing, it could not be started, it stopped and with which code, another copy holds the data folder, or the app waited too long), shows the engine's last lines and gives the path of the engine's log. The app goes only after the dialog is closed. Before, the app could close without a word.
- **One engine per data folder:** an engine that is started while another one serves the same data folder for a running app stops with one sentence that names the other. An engine that was left behind by an app that is gone is ended and replaced.
- **A double click on the engine opens the app:** the engine program in the install folder serves nothing on its own. Started by hand, it opens form.ext and stops, or says that it is a part of form.ext when the app is not near it.
- **The engine keeps a log:** `Logs/formext-engine.log` in the data folder, with the last three files kept. When the engine has no error output of its own, its errors go to `Logs/formext-engine-errors.log` beside it.
- **Behaves differently:** the app now waits at most 120 seconds for its engine to come up and then shows the dialog; before, it waited without limit. The development engine (`./formext boot`) is not affected by any of this: it has no log file, takes no lock and runs beside the desktop app as before.
- **Not covered:** an engine left behind by 0.7.0 or older is not found by the first start after the update, because those versions wrote no lock. It does not stop 0.8.0 from opening; end it in Task Manager or restart the computer once.
- Checked here: on Linux, with stand-ins for the app: a second engine refused while the first kept serving, the engine gone about a second after its app, a stuck engine replaced, damaged lock files replaced, the engine started alone with and without an app near it, the engine with no output streams, and a normal start; the tests in `tests/` (40, none of which can start a real agent program); the Windows-only code checked against the Windows interfaces without being run; the engine's self check, the hosts check and the frontend build as the repository's own checks run them.
- Not verified yet: anything on Windows or macOS. The desktop shell was not compiled on the build machine, so the release build is its first compile. No real agent program was run.

## v0.7.0 · 2026-11-19

Antigravity joins Claude Code, Codex and Cursor, and form.ext finds these programs however it was started.

- **Antigravity:** Google's Antigravity (the `agy` program) is the fourth agent program form.ext works with. The terminal panel shows an Antigravity button when the program is installed, and it opens in a tab of its own. `./formext agents install` also connects Antigravity, by adding form.ext's MCP server (and formMCP when it is installed) to `~/.gemini/config/mcp_config.json`; everything else in that file is kept, and a server of the same name that form.ext did not write is left alone.
- **Agent programs are found wherever they are installed:** an app started from the Dock, the Start menu or a desktop launcher does not get the PATH a terminal has, so form.ext could call an installed Claude Code, Codex or Cursor missing. It now also looks in the folders these programs are usually installed to and in the PATH of your own shell. When a program is not found, the message says where form.ext looked; when it is found but does not start, the message says so and gives the program's own error line.
- **The engine starts without a console:** an engine that is started with no output streams, as a desktop build on Windows starts it, no longer stops at start.
- **Behaves differently:** an Antigravity tab does not open in the project's folder. It opens in a folder of form.ext's own inside the data folder, because Antigravity reads its connection to form.ext from a file in its working folder and that file should not be written into your project. Chat is now started through your login shell, as the tabs already were. A program that is installed but cannot start is no longer offered as installed.
- **For agents:** the status answer for the agent programs lists four and says for each whether it runs, is broken or is missing, how it was found and where the search looked. `agents/manifest.json` lists the panel's six kinds of tab. `./formext agents status` has an Antigravity section.
- **Kept in step:** the terminal panel's files were replaced by the family's next version of them, unchanged, and the part that finds the agent programs is one file shared by the family's apps; `./formext agents sync --check` fails, naming the file, when either differs from its recorded copy.
- **Docs:** README, the manual, the wiki pages and the help texts name four agent programs.
- Checked here: with stand-ins for all four programs, on a scratch data folder and home: the status with the programs present, missing and broken; Codex, Claude Code and Antigravity tabs opened through the engine; the Antigravity tab's connection written and removed again with the rest of its file untouched; `agents install` for Antigravity; the engine started with its output streams closed and started normally; the tests in `tests/` (29, none of which can start a real agent program), the agents check and the frontend type check.
- Not verified yet: the real Antigravity, Claude Code, Codex and Cursor (stand-ins only), the Antigravity button and tab in a window (not looked at in a browser), the desktop shell (not compiled on the build machine), a production build, Windows and macOS.

## v0.6.0 · 2026-11-19

The Studio's Terminal tab is now the terminal panel every Form app shares, and it has Codex and Cursor tabs.

- **The shared terminal panel:** the Terminal tab in the Studio's bottom panel is now the Form family's shared terminal panel. It is where it was, next to Problems, Host calls and Output, with the same key (Mod+J), the same fold arrow and the same height. Shells, Claude Code and Chat work as before, and Chat's first line still names the working folder and says whether formMCP was found. A tab whose program has ended is shown struck through.
- **Codex and Cursor tabs:** the panel shows a Codex button and a Cursor button when those programs are installed, and each opens its program in a tab of its own in the project's folder. A new More agents menu gives the install command for the one that is missing, opens the Outside agents choice in Preferences, and has Show me around, a short tour of the panel.
- **The question for outside agents:** the question is now the shared panel's dialog. It names the agent when the engine knows who is asking, says what it asked to run, offers Deny, Allow once and Always allow, counts the requests that are waiting ("Request 1 of 2"), opens above any other dialog of the app, and closes by itself when the request is answered elsewhere or has run out of time. Escape still means Deny. What the three answers do has not changed.
- **A quieter start:** when the app opens on Home with the Terminal tab remembered, the panel asks the engine for nothing until the Studio is opened. Before, it started a shell behind Home.
- **Behaves differently:** after a reload the terminals come back with the last one in front, not the first, and a Chat tab is not reopened by itself. The panel's top row and the line you type in look slightly different (a larger send button, its mark in the accent colour), and Chat's first line sits lower in the empty pane. On macOS, Cmd+J is the panel's key and Ctrl+J typed in a shell now reaches the shell; before, it did nothing there.
- **For agents:** the MCP entry form.ext writes for its own Claude Code and Chat tabs is now named `formext_tab`, so it no longer shares a name with the `formext` entry that `./formext agents install` writes. In those tabs the tools are `mcp__formext_tab__*`; `./formext claude` and installed agents still use `formext`. `agents/manifest.json` lists the panel's five kinds of tab: shell, Claude Code, Codex, Cursor and Chat.
- **Kept in step:** the shared panel's files are a copy and are not edited here. `./formext agents sync --check` and the tests fail, naming the file, when one of them differs from the list that came with the panel, is missing or is extra.
- **Docs:** README and the manual name the Codex and Cursor tabs.
- Checked here: the panel in headless Chrome against the engine run from source, with stand-ins for Claude Code, Codex and Cursor: opening and folding with Mod+J, a command typed in a shell, a second shell, the Claude Code, Codex and Chat tabs, the keys, three themes, a reload, and the question through the MCP endpoint with each of its answers, with two requests waiting and under Blocked; a cold load with the tab remembered open under 4x CPU and network throttling; the tests in `tests/`, the engine self check, the agents and hosts checks and the frontend type check.
- Known: the panel stays at the bottom of the Studio at its set height; it has no right-hand position and is not resized by dragging. The tour does not start by itself; Show me around in the More agents menu runs it. The browser demo in `demo/` was not rebuilt for this release, so it still shows the 0.4.1 interface and says 0.4.1.
- Not verified yet: the desktop shell (not compiled on the build machine, so the release build is its first compile), the real Claude Code, Codex and Cursor, a whole Chat turn, the browser demo with the new panel, Windows and macOS.

## v0.5.0 · 2026-11-19

Changes are made in the form.ext window or asked there first, and there is a true-black theme.

- **Only the window changes things:** the engine takes changes only from the form.ext window: saving settings, opening a terminal or typing into one, answering a Chat permission card and every change to a project. Changes from outside the app's window are refused. Agents and the command line reach a running engine through its MCP endpoint, where the next point applies.
- **Outside agents ask first:** an agent or the command line that wants to change something asks in the form.ext window. Settings, Developer, Outside agents is Ask (the default), Allowed or Blocked. Under Ask the window shows Deny, Allow once and Always allow; with no window open the change is refused at once, and a question nobody answers is refused after two minutes. Reading always works. Only the window can change this setting; a change made to it outside the app turns it back to Ask, and the app says so once. Anyone who scripts form.ext with no window open chooses Allowed in the window first.
- **The Studio's own tabs:** the Claude Code and Chat tabs in the Studio's terminal panel are not asked that question under Ask or Allowed. Each tab gets its own pass when it opens, and the pass stops working when the tab closes. Blocked stops their changes too, so Blocked stops every agent's changes; reading still works. In those tabs Claude Code runs the tools that only read without asking, and asks before any other.
- **Sealed settings:** the FormPortal folder, the FormPortal command line and the Outside agents choice are sealed with a key kept in the system keychain. A change made outside the app reads as the default until it is saved again in Settings. Without a keychain they work as before. New dependency: keyring 25.7.0 (MIT).
- **New theme, AMOLED Black:** a true-black window for OLED screens, with panels told apart by their outlines.
- **Desktop:** the app waits as long as the engine needs to start, as before. If the engine starts but the window never gets what it needs to save, the app says the engine failed to start after 10 seconds instead of opening a window that cannot save.
- **For agents:** `agents/manifest.json` says what form.ext offers agents (33 MCP tools, 19 that only read, 14 that ask first, and 3 skills). `./formext agents sync` writes it and `--check` fails when it is out of date.
- **Hosts:** the list of apps that load extensions (`setup/hosts.json`) and `.claude/skills/HOSTS.md` are written from the family's list of apps by `setup/hosts.py`, and CI checks them. They change only when something they show changes.
- **Engine, for a later release:** the engine can start Codex and Cursor's agent in a terminal tab, say in one call whether Claude Code, Codex and Cursor are installed, say which agent is asking and when a question was answered or ran out of time, and let a window follow what outside agents are calling. The window does not use these yet: form.ext keeps its own terminal panel in this release.
- **Docs:** README, the wiki, the manual, the tool reference and the skills describe Ask, Allowed and Blocked and what a closed window means for an agent. The release page lists every place that holds the version.
- Checked here: the engine run from source with stand-ins for the window, the keychain, Claude Code, Codex and Cursor, under Ask, Allowed and Blocked, through the MCP endpoint and the command line; the question and AMOLED Black in Chrome under 4x CPU and network throttling; the engine self check, the tests in `tests/`, the agents and hosts checks and the frontend type check.
- Known: the browser demo in `demo/` was not rebuilt for this release, so it still shows the 0.4.1 interface and says 0.4.1.
- Not verified yet: the desktop shell (not compiled on the build machine, so the release build is its first compile), the frozen desktop engine, a real keychain, the real Claude Code, Codex and Cursor, Windows and macOS.

## v0.4.1 · 2026-11-11

- Fixed: two registry pull requests at once broke each other (one failed with "nothing to commit", the other could push the wrong folder), because both used the same working clone. The clone, commit and push steps now take a lock, in the engine and across processes, so the second waits for the first.
- Fixed: the kit's package check and the host accepted an `entry.ui` ending in `/` (`ui/index.html/`); both refuse it now, and so does the browser demo's port of the kit.
- Fixed: `formext.bat cli`, `mcp` and `agents` dropped arguments after the eighth; they now pass every argument, quoting unchanged. Traced, not run on Windows.
- The engine's self check (`--selfcheck`, run by CI) now checks both fixes and fails when either regresses.
- Fixed: an `entry.ui` whose last part is `.` (`ui/index.html/.`) or empty still passed the kit, the host and the demo; all three refuse it now, and the kit refuses a backslash as the host does. `./ui/index.html` and `ui//index.html` still pass.
- A second pull request waits at most 10 minutes for the first, then stops with "another pull request is still running", in the engine and across processes.
- The `.bat` scripts are checked out with Windows line endings (`.gitattributes`), so cmd.exe finds their labels reliably.
- The self check also runs two whole pull requests at once (with GitHub and git stubbed) and fails if their clone and push steps overlap, and checks that the wait gives up.
- Known, unchanged: Submit runs the registry's `tools/check.py` inside the engine process, an owner decision; two submits at once can leave the engine's standard output redirected (see `backend/HASHOUT_LOG.md#pr-lock`).

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
