# form.ext Manual

form.ext is the studio where you make extensions for the Form apps. You pick an app, start from a working project, edit it with the manifest kept in sync, try it in a simulated copy of the app, check it against the Form Extension Contract, run it in the real app, build and sign the `.formpkg`, and prepare it for FormPortal and formai.studio. People and agents use the same steps: every one of them is also a command line command and an MCP tool.

An extension is a small web page with a `manifest.json`. It runs in a sandboxed frame inside one Form app and talks to that app only through the contract's calls (`document.read`, `document.apply`, `files.open` and the rest). What each app lets an extension read and do is in that app's page under Docs.

## Contents

- [Getting started](#getting-started)
- [The window](#the-window)
- [Home](#home)
- [New](#new)
- [Edit](#edit)
- [Preview](#preview)
- [Check](#check)
- [Library](#library)
- [Run in App](#run-in-app)
- [Package and Sign](#package-and-sign)
- [Publish](#publish)
- [Docs](#docs)
- [The command line](#the-command-line)
- [The MCP server](#the-mcp-server)
- [Settings and the data folder](#settings-and-the-data-folder)
- [Keys](#keys)
- [When something goes wrong](#when-something-goes-wrong)

## Getting started

From the repository:

```sh
./oc_install        # the engine's Python venv and the interface packages, once
./formext           # engine on 127.0.0.1:8640 and interface on http://localhost:5640
```

Open http://localhost:5640. `./formext build` then `./formext serve` runs the built interface from the engine alone on http://127.0.0.1:8640. `./formext desktop dev` opens the desktop app (Tauri 2), and `./formext desktop build` bundles it with the frozen engine inside. `./formext doctor` checks the toolchain, the installs and the ports.

The first five minutes:

1. **New**: choose FormCut, the Panel starter, name it Beat Board, Create.
2. **Edit** opens `package/ui/app.js`. Change a label and save (Mod+S).
3. **Preview** shows the panel running in a simulated FormCut with a real-looking timeline. Press its buttons and watch the log.
4. **Check** says what the contract or a host would refuse, file and line.
5. **Run in App** lists the extension for FormCut. Open FormCut: the extension is in its Extensions menu, marked Development.
6. **Package** builds `beat-board-0.1.0.formpkg`; Sign it with your publisher key; **Publish** prepares the folder for formai.studio and sends the package to FormPortal.

## The window

- **Start page and Studio**: the window has two layouts. The start page (Home, New, Registry, Docs) carries the family sidebar: Home, Recent, Registry, a Learn group with Docs, and Preferences and Help at the foot. Its edge handle folds the sidebar to a 49 px icon rail, and the choice is remembered. Opening a project switches to the Studio, a full-window editor with no sidebar: the tool strip, the Files and Library panel, the tabbed code editor, the Manifest, Permissions and Check inspector, and a bottom panel of Problems, Host calls and Output.
- **Menus**: on macOS the menus are the system menu bar (form.ext, File, Edit, View, Project, Package, Publish, Help). On Windows, Linux and in a browser the same menus sit in the title row. Every item is a command, so the palette lists the same names and keys.
- **Title row**: 38 px high. The open project is on the left (on macOS), the app name in the centre, and three buttons at the right: Commands, the theme toggle (Mod+Shift+L) and Preferences. Studio Dark is the default; the light theme is remembered.
- **Preferences**: Mod+, or the gear opens a dialog with eight sections (General, Interface, Editor, Preview, Publishing, Registry, FormPortal, Developer). A change is saved to settings.json as you make it.
- **Command palette**: Mod+K (or Mod+Shift+P) lists every command of every pane with its keys.
- **Status bar**: the engine's state, the open project, the version.

Mod is Cmd on macOS and Ctrl elsewhere. Keys without a modifier never fire while you type in a field or in the editor.

Every pane knows the open project. Work flows forward: New opens Edit, a problem in Check opens Edit at its line, Package hands its build to Publish.

## Home

- **New Extension**, **Open Folder** and **Import .formpkg**.
- **Recent**: the last eight projects you opened. A row opens the project in Edit; its trash button moves a project to form.ext's trash, or forgets a folder that was opened in place (the folder itself stays).
- **Start for an app**: one button per Form app, which opens New with that app chosen.
- **Examples**: the kit's examples, copied into a new project with Copy.

**Open Folder** takes a folder that holds `manifest.json` at its root (a package) or in `package/` (a form.ext project). It is opened in place: form.ext edits your files where they are and notices changes made by other editors. **Import .formpkg** goes to the Library.

## New

Three choices on one page:

1. **The app**: FormVis, FormCut, FormWav, FormPDF, FormDeck, FormLit, Form.md, FormEncoder, FormVFX, FormMCP, FormTray or FormSkills.
2. **The starter**:
   - **Panel**: a docked panel that reads the document and changes it.
   - **Command**: a headless command in the app's Extensions menu, no window of its own.
   - **Panel with commands**: a panel plus commands that open it.
3. **The name**, and an optional description. The id is made from the name (lower case, hyphens) and shown as you type.

The card beside the name says what the starter asks for, in the same plain words the app's consent dialog uses, what it adds to the app (panels and commands), and which of the app's calls it uses. Every starter does one real thing with its app (FormCut's panel lists the markers and seeks to them, Form.md's command inserts a dated entry, FormPDF's numbers the pages) and passes Check with no warning.

Create writes the project and opens `package/ui/app.js` in Edit. Mod+N opens New from anywhere.

### What a project holds

```
<project>/
├── README.md          what the starter does and what to do next
└── package/           the package root: exactly what goes into the .formpkg
    ├── manifest.json
    └── ui/
        ├── index.html  the page the app loads (entry.ui)
        ├── app.js      your code
        ├── formext.js  the SDK as plain JavaScript
        ├── kit.js      small helpers (fill in place, headless runner, resize)
        └── base.css    styles on the app's own theme tokens
```

Files outside `package/` are yours (notes, sources, a build step) and are never packed.

## Edit

The Studio's three columns: the file tree (Files, with a Library tab beside it), the code editor, and the manifest form in the inspector. Check, Preview, Run in App, Package and Publish are buttons in the tool strip: Check fills the Problems list below and the Check tab at the right, Preview opens beside the code (Split), Run in App, Package and Publish open as sheets over the Studio.

- **File tree**: every file of the project. Files outside the package are in italics (not packed); a file whose type the `.formpkg` refuses carries a warning mark. New File in Project, rename and delete from the row.
- **Code editor**: CodeMirror 6 with JavaScript, TypeScript, JSON, CSS, HTML and Markdown, search and replace (Mod+F), completion, folding, and JSON linting. Each file keeps its own undo history and cursor. Tabs come back after a reload. Images open as a picture; other binary files show their size.
- **Manifest form**: name, id, version, description, minimum app version, homepage, entry page; the **permissions** with the words the app's consent dialog shows; **panels** (id, title, dock or dialog) and **commands** (id, title, the panel it opens or Headless). The form and `manifest.json` are one: a change in the form is an edit in the JSON (so Mod+Z in the JSON undoes it) and a change typed in the JSON shows in the form. While the JSON does not parse the form waits, with the parser's message; nothing is lost. Hints under the fields say what the schema and the hosts would refuse; Check has the last word.

Saving: Mod+S saves the file, Mod+Alt+S saves all. Closing a changed file asks to save or discard; leaving the window with unsaved work asks first. Unsaved files stay when you open another project. When a file changes on disk (another editor, an agent), a file with no unsaved changes updates in place; one with changes shows a bar: Load Disk Version or Keep Mine.

Renaming a panel's id renames it in the commands that open it; removing a panel turns those commands headless.

## Preview

Preview runs the extension in a simulated host for its app, with the contract's own host bridge, so the frame, the sandbox, the messages, the permission checks and the time-outs are the real ones.

- **The stage**: the extension's panels (dock and dialog) and the app's contributed commands, as the app would show them. Headless commands run in a hidden frame and close when they call `ext.done`.
- **The document**: a realistic document for the app (a FormCut timeline with clips and markers, a FormPDF document with pages and text, a Form.md page with blocks, and so on), built from the app's `docs/EXTENSIONS.md`. `document.read` answers from it; `document.apply` and `app.run` change it, one undo step per call (Undo, Reset).
- **Simulate in**: the app the host plays. The manifest's product is the default.
- **Inject**: Send `ext.activate` again, Send `ext.event` (the app's own events, with real-looking data), Send `ext.theme` (and the Light toggle), Close panels (`ext.deactivate`).
- **Permissions and consent**: the consent dialog appears the first time, as in the app (Allow or Not Now). Allow now and Forget consent change it at any time; turning a declared permission off runs the extension as if the manifest did not ask for it, so you can see your `-32001` handling.
- **Files and network**: `files.open` offers sample files for the app or a file from this computer; `files.save` shows the save dialog and downloads the file; `net.fetch` goes out through the engine to public `https://` addresses only.
- **The log**: every message both ways (extension to host, host to extension), with its time, method, params, result or error; Errors shows only failures; Copy puts the log on the clipboard as JSON.

Reload on save (on by default) reloads the extension whenever a project file is saved. Commands: Preview: Reload the extension, Preview: Undo the last simulated step.

## Check

Check validates the saved package against the contract and lints its code. It runs when a project opens, on F7, and 500 ms after every save (Check on save). Problems are grouped by file, errors first; clicking one opens Edit at its line.

What it looks for:

- **The manifest**: JSON syntax (at the line and column), the kit's package rules (file types, sizes, paths, no symlinks), the package schema, and what an API 1 host refuses (no `api: "1"`, `native: true`, a missing or unsafe `entry.ui`, a panel without an entry).
- **Files the code loads**: every relative script, style, image, import and `url()` points at a file in the package.
- **Code the CSP and the sandbox will block**: inline `<script>`, `on...` attributes and `javascript:` links (scripts load from package files only); scripts, styles, fonts, images and media from the internet; frames and `<base>`; `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` and `sendBeacon` (the frame has no network: use `net.fetch` with the network permission); `eval`, `new Function` and string timers; `localStorage`, `sessionStorage`, `indexedDB` and cookies (use `storage.get` and `storage.set`); and, as warnings, `alert`, `confirm`, `prompt`, `window.open`, `target=_blank` and form submits, which do nothing in the sandbox.
- **Permissions**: a call that needs a permission the manifest does not ask for is an error at the call; a permission nothing uses is a warning at the manifest.
- **Headless commands**: they must handle `ext.activate` and call `ext.done`.
- **Sizes**: a file over 5 MB is a warning, a package over 20 MB an error.
- **Description**: without one the index and FormPortal show only the name (info).

Rules lists every rule with its reason. Filters show All, Errors, Warnings or Info.

## Library

The Library imports and inspects packages.

- **Import .formpkg**: a package from disk becomes a project, after the kit's checks (layout, file types, paths, the manifest). A package that fails them can still be imported to fix it.
- **Inspect**: any package, without importing it: its manifest, files, sizes, SHA-256 of each file and of the whole, permissions in plain words, whether it is deterministic (the kit's sort order, dates and modes), and whether it matches a build of yours.
- **Compare**: two builds of a project, or a build and the working files: what changed in the manifest, which files were added, removed or changed, and a line diff of a text file.
- **Registry**: the extensions registered in form.ext-registry (`nodemode-dev/form.ext-registry`), the single source of official Form extensions. form.ext downloads the registry's signed index (`extensions.json`) and checks `extensions.json.sig` with the registry keys it trusts before it shows anything. Each card has the Verified mark, its app, version, permissions in plain words and a link to its source folder in the registry. Inspect and Import download the package, check its SHA-256 against the index and its publisher signature against the index's publisher key, then go through the same checks as any import. Refresh downloads the index again; the last good copy is kept and used, with a note, when the registry cannot be reached.

The registry address is the setting `registry.url` (by default `https://github.com/nodemode-dev/form.ext-registry/releases/download/index/extensions.json`); `FORMEXT_REGISTRY_URL` overrides it. The registry keys are compiled into the engine (`backend/app/registry_keys.txt`); `FORMEXT_REGISTRY_PUBKEY` (comma-separated base64 Ed25519 keys) adds keys for testing. When the index comes from another address than the default, packages are fetched from the same address with the registry's release paths (a mirror). The shelf says plainly why it is empty:

| It says | What it means |
|---|---|
| This build trusts no registry key yet | `registry_keys.txt` holds no key yet and none was given in `FORMEXT_REGISTRY_PUBKEY`. The developer setting `registry.developer` reads the index without checking it, and its cards are not marked Verified. |
| The registry is private or not published yet | GitHub answered 404, 401 or 403. While the registry is private its downloads need a token: set `GITHUB_TOKEN` (or `FORMEXT_GITHUB_TOKEN`). |
| The registry is unreachable | No answer (no network, a wrong address), and no copy kept from before. |
| Signature mismatch | The index or a package does not match its signature: it was changed, or signed with a key this build does not trust. Nothing from it is shown or imported. |

## Run in App

Run in App loads your extension, live, in the real app. It writes the project's package folder into `extensions/<product>/dev.json` in FormPortal's folder (contract section 3); the app reads that file at start and again within 2 s of a change while its window has focus, or at once with Reload Extensions. The extension appears in the app's Extensions menu and panel with the source Development and its folder path. Every save shows in the app on its next reload, with no packaging.

The pane shows:

- the app, whether it is installed (from FormPortal's records and the usual install places) and its version; Open starts it;
- whether this project is listed in `dev.json`, and, from the contract's host rules, whether the app will load it (Ready, Needs Permission, or Refused with the reason, for example a `minimum_app` newer than the installed app);
- Run in the app (F5), which adds the project to `dev.json`, and Stop in the app, which removes it;
- Reload in App, which touches `dev.json` so the app reads it again;
- Install with FormPortal (build the package and hand it to FormPortal) and Manage in FormPortal.

FormPortal's folder is `FORMPORTAL_ROOT` when set, otherwise the OS place the contract names (macOS `~/Library/Application Support/studio.formai.portal`, Windows `%LOCALAPPDATA%\FormPortal`, Linux `~/.local/share/formportal`). Settings can point it elsewhere.

## Package and Sign

**Build** checks the project first: a contract error (one every host would refuse) stops the build; code errors stop it unless you choose Package Anyway. The package is made by the kit's `formpkg` rules: `manifest.json` at the root, entries sorted, dates 1980-01-01, mode 0644, deflate. The same folder always gives the same bytes, so the SHA-256 identifies the build. Each build shows its file name (`<id>-<version>.formpkg`), size, SHA-256, its files with their hashes, and the Check counts at build time. Building unchanged files again finds the same build.

**Reproduce** builds the package twice, by two different routes (the engine, and the kit's own `formpkg.py` command line), and compares them byte for byte; any difference is listed by file. It also says whether the files have changed since the last build of this version.

**Keys**: a publisher key is an Ed25519 key pair kept in form.ext's data folder (`keys/`), named by a publisher id (lower case and hyphens), optionally locked with a passphrase of at least eight characters. Export Public Key gives the publisher entry (id, name, algorithm, public key, fingerprint) that formai.studio's index lists. The private key never leaves the data folder.

**Sign** signs a build's exact bytes with a key. The signature is stored with the build and checked at once; Verify checks every signature of a build again. A signature names the publisher and is carried into the index entry, so FormPortal can tell who made the package.

Open the folder, copy the SHA-256, or remove a build from its row.

## Publish

Publish turns a build into what the catalogue needs.

- **The index entry**: the package's row for formai.studio's extensions index (`formai-extensions`, format 1): id, name, product, version, description, permissions, the package address (by default `https://formai.studio/extensions/packages/<id>-<version>.formpkg`), SHA-256, size, and the signature when signed. It is checked against the contract's `extensions.schema.json` before anything is written.
- **Prepare Submission** builds the package if needed, signs it with your publisher key (Settings chooses the default key), and writes a submission folder in the data folder (`submissions/<id>-<version>/`): the `.formpkg`, `entry.json`, a one-package `extensions.json` with your publisher entry, a `README.md` for the reviewer, and `submission.json`. Reveal opens the folder.
- **Send to FormPortal** installs the package through FormPortal's command line (`formportal cli extension-install --path <package>`) when it is found, otherwise opens the package with FormPortal or with the system's handler for `.formpkg`. FormPortal applies its own checks and signature policy, and its answer is shown.
- **Submit to Registry** is how an extension becomes official. It writes the project into a folder in form.ext-registry's layout, `submissions/registry/extensions/<id>/` in the data folder: `package/` (exactly what goes in the `.formpkg`), the source beside it (`src/`, `package.json` and its lock file when the project has them, `docs/`), and `README.md`, `LICENSE` and `CHANGELOG.md` (form.ext writes the ones the project lacks, for you to finish). The screenshot slot is `docs/screenshot.png`, shown in the README. Then it runs the registry's checks on the folder: with **Registry checkout** set to a local clone of the registry (the setting `registry.checkout`), form.ext imports that clone's `tools/check.py` and runs exactly the checks CI runs on a pull request (contract, version and immutability against the published index, reproducible build, code bans, permissions declared and used, README, licence, changelog and screenshot, block list); without one it runs its own Check and the metadata checks, and says which ran. Last, it shows the `git` and `gh` commands that fork `nodemode-dev/form.ext-registry`, copy the folder in on a branch, run the checks, commit, push and open the pull request; Copy Commands puts them on the clipboard. form.ext never pushes anything itself. The owners review the pull request, and once it is merged the registry builds, signs and publishes the new version.

## Docs

Docs is the reference, inside the app and offline:

- **Manual**: this page.
- **Extension Contract**: the Form Extension Contract, API 1, as vendored in `contract/CONTRACT.md`: the package, where apps find extensions, how files are served, the sandbox, every method and error, consent, and what every host shows.
- **SDK reference**: the `@formai/ext` client (`sdk/`), every method, the permission it needs, its time-out and its errors.
- **App APIs**: one page per app, its own `docs/EXTENSIONS.md`: what `host.hello` reports, the document snapshot `document.read` returns, the commands `document.apply` and `app.run` take, its events, files and network, where its extensions appear.

Search (top of the list) counts the matches in every page and marks them in the open one; Enter and Shift+Enter step through them, Escape clears. On this page lists the sections and follows your scroll. Links between pages open in Docs; links to the web open in your browser. The button in the head opens the API of the open project's app. Each page is also a palette command (Docs: FormCut API and so on).

## The command line

`./formext cli` is form.ext's command line over the same engine, for scripts, CI and agents. It talks to a running engine with the same data folder, or runs the engine's routes in-process when none is running (`--engine URL` and `--local` choose). The commands:

| Step | Commands |
|---|---|
| Learn | `status`, `docs [topic]` (contract, sdk, schema, example, or an app id such as `formcut`), `templates [app]`, `rules` |
| Make | `new NAME --app formcut --starter panel` (or `--example hello`), `projects`, `project`, `import` (a folder or a `.formpkg`), `inspect`, `files`, `read`, `write`, `delete`, `move`, `manifest` |
| Check and try | `validate`, `preview` (a snapshot: the host check, the frame address and its headers) |
| Package | `package` (`--anyway` builds past code-lint errors), `builds`, `keys`, `sign`, `verify`, `entry` |
| Ship | `apps`, `run-in-app` (`--remove`, `--status`, `--open`), `publish` (`--url`, `--publisher`, `--unsigned`, `--formportal`), `submit` (`--checkout` a local clone of the registry) |

`./formext cli --help` lists them and `./formext cli <command> --help` explains one. Answers are short text by default and JSON with `--json`; failures exit non-zero with the reason in the same words the window uses. Changes made from the command line appear in the open window at once.

The desktop app's frozen engine takes the same commands (`formext-engine cli ...`).

## The MCP server

`./formext mcp` is form.ext's MCP server on standard input and output. The repository's `.mcp.json` registers it for Claude Code, `.codex/config.toml` for Codex and `.cursor/mcp.json` for Cursor, so an agent working in this repository makes extensions the way a person does. Its tools are the command line's commands under the same names (`status`, `docs`, `templates`, `new`, `write`, `manifest`, `validate`, `preview`, `package`, `sign`, `run_in_app`, `publish`, `submit` and the rest), with the same arguments, and its resources (`formext://docs/<topic>`) are the contract, the SDK source, the schema, the example and every app's API page. The tools answer what the panes show, and every change an agent makes appears in the open window at once (the engine's live events). The skill `formext-harness` teaches the loop: read the app's page, start from a starter, write, validate, preview, package, run in the app.

## Settings and the data folder

Settings (`settings.json` in the data folder, read and changed through the engine's `/api/settings`) hold the theme, your author name, the default publisher key, the default licence, the default app for New, FormPortal's folder, the editor's font size, tab size and wrapping, the Preview's theme and consent defaults, and the registry: `registry.url` (the index address), `registry.checkout` (a local clone for Submit to Registry's checks) and `registry.developer` (read an index without a trusted key; for development only).

form.ext keeps its projects and everything it makes in its data folder: `FORMEXT_HOME` when set, otherwise the OS app-data folder `ai.nodemode.formext` (macOS Application Support, Windows `%APPDATA%`, Linux `~/.local/share`).

| Path | What |
|---|---|
| `projects/<id>/` | a project; `package/` inside is the package root |
| `projects.json` | recent projects and folders opened in place |
| `settings.json` | the settings you changed |
| `builds/<id>/<sha256>/` | builds, each with its `.formpkg` and `build.json` |
| `keys/` | publisher keys |
| `submissions/` | prepared submissions; `submissions/registry/extensions/<id>/` for the registry |
| `registry/` | the last verified registry index and its signature, and the registry packages already downloaded (by SHA-256) |
| `trash/` | removed projects |

## Keys

| Keys | Does |
|---|---|
| Mod+K, Mod+Shift+P | command palette |
| Mod+, | Preferences |
| Mod+1 to Mod+9 | go to a pane |
| Mod+O | open a project |
| Mod+N | New |
| Mod+Shift+O | open a folder |
| Mod+Shift+L | light or dark theme |
| Mod+S, Mod+Alt+S | save the file, save all (Edit) |
| Mod+F | find in the file (Edit) |
| F5 | run in the app, or stop |
| F7 | check the project |

## When something goes wrong

- **The status bar says the engine is not reachable**: start it with `./formext` (or `backend/boot_backend`); Reconnect to the Engine in the palette tries again.
- **The app does not show the extension**: Run in App says whether the project is in `dev.json` and why the app would refuse it. Bring the app's window to the front (it checks every 2 s while focused) or use its Reload Extensions. A test copy for an unreleased build of the app should leave `minimum_app` out.
- **A call fails with -32001**: the manifest does not ask for that permission, or the person chose Not Now. Check lists undeclared calls.
- **Nothing happens in the frame**: the CSP blocks inline scripts; move them into a file. Check reports them.
- **Package refused**: Check's errors are listed with the refusal; fix them or choose Package Anyway for code errors.
- **Not reproducible**: Reproduce lists the files that differ; a file that changes while it is being packed (a watcher, a build step writing into `package/`) is the usual cause.
