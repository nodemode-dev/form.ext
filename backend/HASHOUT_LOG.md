# backend HASHOUT_LOG

The living log of the form.ext engine. Read it before editing `backend/`. Core files belong to the engine module; module routers and services (`routers/<module>.py`, `services/<module>.py`) keep their own notes in their own HASHOUT logs.

## 0.4.1 one pull request at a time, entry trailing slash, formext.bat arguments {#pr-lock}

- refers-to: app/services/registry_pr.py; contract/tools/formpkg.py; contract/host/python/formext_host.py; frontend/src/demo/engine/kit.ts; formext.bat; formext_engine.py
- `registry_pr.open_pull_request` works in one clone, `registry-work/form.ext-registry`, and the engine runs sync handlers on a thread pool, so two Open pull request clicks (or the window and `./formext cli submit --pull-request --local`, which is a second process) reset, checked out and committed over each other: one failed with "nothing to commit" or "FETCH_HEAD is not a commit" and the other could push a branch holding the wrong folder. The clone, reset, copy, commit and push now run in `_push`, inside `held(registry-work/.lock)`: a module `threading.Lock` for the engine's threads, then an exclusive lock on that file (`fcntl.flock`, `msvcrt.locking` on Windows) for another process. The fork step and the pull request listing and opening stay outside the lock; the branch is per extension and version. A second request waits, it is not refused.
- `entry.ui` ending in `/` (`ui/index.html/`) passed `formpkg.problems()` and the host's `check()`, because `Path()` and `resolve()` drop the slash and the file exists. Both now refuse a raw value that ends in `/`, before the normalised comparison, so `./ui/index.html` and `ui//index.html` still pass. The demo's `engine/kit.ts` port gets the same two refusals and the demo bundle is rebuilt. The kit is vendored: the same change belongs in the kit's own source and in form.ext-registry's mirror.
- `formext.bat` `cli`, `mcp` and `agents` passed `%2` to `%9`, so arguments after the eighth were dropped (and `=` and `,` split arguments). They now set the program and go to `:forward`, which keeps `%*` whole and drops the first word with delayed expansion (`!ARGS:*%1=!`), so quoting, `=` and every argument reach Python unchanged, and a `!` in an argument survives because delayed expansion is turned on only after `ARGS` is set. Traced, not run: no Windows host. The file is LF in this tree (no `.gitattributes`), and it stays LF.
- `formext_engine.py --selfcheck`, which CI's engine job runs, adds `checks`: `entry_trailing_slash` (the hello example with `ui/index.html` passes both the kit and the host, with `ui/index.html/` both refuse) and `registry_pr_lock` (two threads in `held()` never overlap, and while one holds it the lock file cannot be taken by another open of it). Either false fails the self check. The end-to-end race (two pull requests at once against local bare repositories, a stand-in `gh` and a `git` that sleeps on `write-tree`) failed four runs out of four before and passed four runs on threads and one on two processes after; that harness is not in the tree.
- Owner decision, not changed: Submit imports the registry clone's `tools/check.py` and runs it inside the engine process (`publish._run_registry_check`), so code fetched from form.ext-registry runs with the engine's rights. Found with it: that function wraps the run in `contextlib.redirect_stdout` and `redirect_stderr`, which swap the process-wide `sys.stdout` and `sys.stderr`; two submits at once on the engine's threads can leave them pointing at one submit's `StringIO` for good (seen in two of four runs of the race harness). Not changed here.

## 0.3.1 anchors, entry file, registry digest

- refers-to: contract/tools/formpkg.py; contract/host/python/formext_host.py
- The kit's `ID_RE`, `LOCAL_RE` and `VERSION_RE` ended in `$`, which Python also matches before a trailing newline, so a manifest id, version or contributed id ending in a newline passed the check (and named the built file with a newline) while the JSON schema refused it. They now end in `\Z`, in `formpkg.py` and `formext_host.py`, byte for byte as the kit mirror in form.ext-registry.
- `formpkg.problems()` checked `entry.ui` with `is_file()`, which accepts a hidden file or a `../` path that `files_of()` never packs, so the built package had no entry file. It now requires the entry to be one of the files `files_of()` would pack. The entry is compared as `Path(entry).as_posix()`, so `./ui/index.html` and `ui//index.html`, which the schema, the host and the TS kit accept, still pass; hidden, `../` and absolute entries stay refused.
- The same `$` to `\Z` change in the engine's own id patterns, so a project, extension or publisher id with a trailing newline is refused there too: `services/portal.py` (`ID_RE`), `services/workspace.py` (`ID_RE`), `services/keys.py` (`PUBLISHER_RE`) and `services/package.py` (the project id check in `_root`, and `SHA_RE`). `SHA_RE` in `services/library.py` gets the same `\Z`. The messages that print the pattern are unchanged.
- `formext.bat` `cli`, `mcp` and `agents` ran `shift & ... %1 ... %9` on one line, and cmd expands `%n` before `shift` runs, so the subcommand word was passed twice and the ninth argument lost. They now pass `%2` to `%9` without `shift`, as the `app` line does. Traced, not run: no Windows host. The file keeps its line endings (LF in this tree).
- `services/registry.py` `Registry.package` only checked that an index entry's `sha256` had 64 characters before using it in the cache path `packages/<sha256>.formpkg`, so a value with `../` could read, write or unlink a `.formpkg` outside the cache (reachable with an unsigned index, that is the `registry.developer` setting). It now needs exactly 64 lowercase hex characters (`re.fullmatch`) and otherwise answers with the existing "no usable package address or SHA-256" refusal.

## 0.2.2 cryptography on Intel Macs

- refers-to: backend/requirements.txt; NOTICE.md
- The 0.2.1 macos-x64 build's frozen engine failed its self check: `library`, `package`, `publish` and `runapp` did not import, with `Symbol not found: _SSL_get0_group_name` in the bundled `libssl.3.dylib`. cryptography 49 and later publish macOS wheels for Apple silicon only, so on the Intel runner pip built 50.0.2 from source against Homebrew's OpenSSL (dynamically linked, PyInstaller's hook says so), and the frozen engine carried an older `libssl.3.dylib` under the same name, which lacks a function that OpenSSL 3.2 added.
- Intel Macs now get cryptography 48.0.1, the newest with a wheel for them (universal2, OpenSSL linked statically, as on every other platform); everywhere else stays on 50.0.2. The two lines carry environment markers, so each platform installs exactly one. The engine's self check passes on 48.0.1 with all thirteen routers; the Ed25519 calls it uses are the same in both.

## 0.1.0 engine core

### Running

- `backend/boot_backend` makes `backend/venv` with `python3.12` and installs `requirements.txt` when the venv is missing, then runs uvicorn on `FORMEXT_HOST` (default `127.0.0.1`) and `FORMEXT_PORT` (default `8640`). `FORMEXT_RELOAD=0` turns off `--reload`; with it on, only `backend/app` is watched, so a new `routers/<module>.py` loads without a restart.
- `FORMEXT_HOME` moves the data folder; otherwise it is the OS app-data folder named `ai.nodemode.formext` (macOS Application Support, Windows `%APPDATA%`, Linux `$XDG_DATA_HOME` or `~/.local/share`).
- `FORMEXT_WATCH=0` turns off the disk watcher (useful for one-shot scripts that import `app.main`).

### Data folder

| Path | What |
|---|---|
| `projects/<id>/` | one project: `package/` is the package root (holds `manifest.json`, packed by `formpkg`), sources and notes beside it |
| `projects.json` | `linked` (id to an outside folder opened in place), `recent` (ids, newest first), `meta` (name, product, created, opened) |
| `settings.json` | only the keys a person changed; defaults live in `services/settings.py` |
| `builds/`, `keys/`, `trash/` | for the package module, the keys module, and removed projects |
| `registry/` | the last verified registry index (`extensions.json`, `.sig`, `kept.json`) and `packages/<sha256>.formpkg` already downloaded and checked (library module) |
| `submissions/` | Publish's folders; `submissions/registry/extensions/<id>/` for Submit to Registry |
| `engine.port` | `{pid, port}` while the frozen engine runs |

### Interfaces

- `app.main` includes `router` from every `app/routers/*.py` found with `pkgutil` (core first: health, settings, projects, live; then the rest alphabetically). A router that fails to import is skipped and reported in `GET /api/health` as `router_errors`, so one module's bug never stops the engine. When a built frontend exists (`FORMEXT_DIST`, the frozen `frontend_dist`, or `frontend/dist`) it is served at `/` with an SPA fallback; `/api/*` misses stay JSON 404.
- `paths.use_contract()` runs at import of `app.main`: `contract/host/python` and `contract/tools` are on `sys.path`, so modules `import formext_host` and `import formpkg` from the vendored kit, unchanged.
- `WorkspaceError` (400), `Unsafe` (400), `NotFound` (404), `Conflict` (409) become `{detail}` JSON. A plain `ValueError` from a route becomes 400.
- Project ids follow the package id pattern `^[a-z0-9][a-z0-9-]{1,63}$`; new ids are the slug of the name, with `-2`, `-3` on collision. One-letter names become `<slug>-extension`.
- `workspace.create(name, product, files)`: keys are relative to the project folder. When no key starts with `package/`, every file goes under `package/` (so a starter can pass package-relative paths). A starter manifest (api 1, kind `script-plugin`, version 0.1.0, author and licence from settings) is written when none is given. Creation is staged in `projects/.new-*` and moved into place in one rename.
- `workspace.import_folder(path, link)`: the folder must hold `manifest.json` at its root (package layout) or in `package/` (project layout). Copy mode copies into the data folder (skipping `.git`, `node_modules` and the like, dropping symlinks); link mode opens the folder in place, and a package-layout folder then has `package_prefix` `""`. Always use `package_dir(id)` or `package_prefix` rather than assuming `package/`.
- Path safety: `clean_rel` refuses empty, NUL, absolute, drive-letter and `..` paths; `safe_join` refuses any symlink along the path and anything that resolves outside the project. All reads and writes go through it.
- Writes are atomic (temp file then rename) and emit `project.changed` with `source: "engine"`. The watcher (watchfiles over `projects/` and every linked folder) emits the same event with `source: "disk"` for outside edits, skipping paths the engine wrote in the last 2 s, hidden folders and temp files. When `manifest.json` is among the paths the event carries the new `manifest`.
- `bus.emit` is safe from any thread: it posts onto the server loop. The loop is attached at startup and again by each `/api/live` connection.

### Routes

| Route | Answer |
|---|---|
| `GET /api/projects` | `{projects: [project]}`, newest change first |
| `POST /api/projects` | `{name, product, files?}` creates; `{path, link?}` imports. Files are `rel: text`, `rel: {text}` or `rel: {base64}` |
| `POST /api/projects/import` | `{path, link?, name?}` |
| `GET /api/projects/recent` | `{projects}` in opening order (so a project named `recent` cannot be opened by id) |
| `GET /api/projects/{id}` | the project, and marks it opened (`?touch=false` to just read) |
| `DELETE /api/projects/{id}` | moves a data-folder project to `trash/`, or forgets a linked one (its folder is kept) |
| `GET /api/projects/{id}/files` | `{id, package_prefix, files: [{path, size, modified, package}]}` |
| `GET /api/projects/{id}/files/{rel}` | `{path, size, modified, encoding: "utf-8", text}` or `{encoding: "base64", base64}`; `?raw=1` gives the bytes |
| `PUT /api/projects/{id}/files/{rel}` | JSON `{text}` or `{base64}`; `?raw=1` takes the raw body |
| `DELETE /api/projects/{id}/files/{rel}` | removes a file or a folder |
| `POST /api/projects/{id}/move` | `{from, to}` |
| `GET /api/health` | version, api, pid, home, contract folder, live clients, routers, router errors |
| `GET/PUT /api/settings` | merged settings plus `home`; PUT merges a partial object (nested objects merge, a top-level `null` removes that key) |
| `WS /api/live` | `{name, data, at}`: `hello`, `engine.started`, `project.created`, `project.changed`, `project.deleted`, `settings.changed`, and every module's events |

A project is `{id, name, product, version, dir, package_dir, package_prefix, manifest, manifest_error, linked, created, opened, modified}`; it is a superset of the shell's `ProjectRef`.

### Desktop build

- `backend/formext_engine.py` is the PyInstaller entry: no argument serves (port `FORMEXT_PORT`, default 8640, `0` for any free port, written to `engine.port`); `--selfcheck` imports the whole app and the kit and fails on any router error; `--version`; `cli ...` and `mcp ...` hand over to `app.cli.main` and `app.mcp.main` when those modules exist. On POSIX it exits when its parent process is gone (`FORMEXT_WATCH_PARENT=0` turns that off for manual runs).
- `setup/freeze_backend` installs `requirements.txt` and PyInstaller 6.22.3 (a build tool, not shipped code) into the venv, builds the frontend when `frontend/dist` is missing, and makes one file, `src-tauri/binaries/formext-engine-<target triple>`, with `frontend_dist`, `contract`, `templates` and `docs` packed as data, then runs its self-check. The Tauri `externalBin` name is `binaries/formext-engine`. `FORMEXT_TARGET` overrides the triple.

### Dependencies

`fastapi`, `uvicorn[standard]` (brings `websockets`, `watchfiles`, `httptools`, `uvloop`), `python-multipart`, `cryptography` (Ed25519 for the package and keys module). Each has a row in `NOTICE.md`. A new dependency gets its row there in the same commit.

## Terminal, Claude Code and agents {#terminal}

- refers-to: app/services/terminal.py · app/services/claude_code.py · app/services/agents.py · app/routers/terminal.py · app/routers/claude.py · requirements.txt
- kind: decision
- logged: v0.2.0 · 2026-11-08

The engine owns the shells so the window, a browser tab and the desktop app see the same sessions, as FormVis does. `terminal.py` keeps a table of PTY sessions (`ptyprocess` on macOS and Linux, `pywinpty` on Windows, chosen by platform markers in requirements) with a scrollback buffer, resize, restart and close. A login shell starts in the project's folder (`workspace.dir`), with `FORMEXT_URL` set so `./formext` talks to this engine. In a source checkout the repo is put first on PATH, so `formext` works by name.

The routes are local only. Every one checks the Host header is loopback and the Origin is loopback or absent, and the WebSocket handshake gets the same check plus a cap of 24 sockets. This is a shell: a page on another origin must never reach it. Guards are per route (`dependencies=LOCAL`) and the stream lives on the same router, because a router-level dependency did not cover the WebSocket route and a separate websocket router was not found by the auto-include.

`claude_code.py` finds the CLI, reports installed, version and sign-in, and builds one launch: `--mcp-config` with the formext server (and formmcp when `agents.formmcp_command()` finds it), `--allowedTools mcp__formext mcp__formmcp`, `--append-system-prompt` saying where the project is and how to use the skills, and `--add-dir` for the repo in a source checkout so the skills load. The Claude Code tab runs that in a PTY; the Chat tab runs `claude -p` with stream-json and turns permission requests into cards. Missing Claude Code is a plain message with the install command, never a blank tab.

`agents.py` is stdlib only so `setup/agents.py` and the frozen engine share the server definitions: frozen, the formext server is the sidecar with `mcp`; from source, `./formext mcp`.

Dependencies: `ptyprocess` 0.7.0 (ISC) and `pywinpty` 3.0.5 (MIT), rows in NOTICE.md.

## Host sources, the family map and the registry pull request {#sources}

- refers-to: app/services/sources.py · app/services/family.py · app/services/registry_pr.py · app/routers/sources.py · app/routers/publish.py · app/services/publish.py · app/services/claude_code.py · app/cli.py · app/mcp.py
- kind: decision
- logged: v0.4.0 · 2026-11-10

**Why.** An agent wrote extension code from the API page and from memory, and the page can lag the app (formmd's copy said 0.50.1 while the app was 0.52.2). The owner's ask: the agent building an extension for form.md has form.md's source in the same place it builds, the skills understand the whole family, and a non-developer can publish to the registry without a terminal.

**The store (`sources.py`).** `sources/[repository name]/` in the data folder holds one read-only copy per Form app, plus `formportal` and `registry` (form.ext-registry); `sources/.meta/[key].json` records how it came (git or archive), the commit, when, and the landmarks. The folder is named after the repository (`form.md`, `formMCP`, `formdeck`) on purpose: that is the layout FormSkills' `FORMSKILLS_DEV_ROOTS` and formMCP's `FORMMCP_DEV_ROOTS` read, so `family.skills(checkout=True)` can point formskills-cli at it. `FAMILY` is the table (key, name, repository, kind); `resolve` takes a product id, a repository name or a project id.

- Pull: `git clone --depth 1 --no-tags` into `.new-[key]-[pid]-[thread]`, then one rename into place; the old copy is moved aside first and dropped after. Without git, `[url]/archive/HEAD.tar.gz` is downloaded (600 MB cap) and unpacked with `tarfile` and `filter="data"`; the commit comes from the archive's pax comment. Update is `git fetch --depth 1 origin HEAD` and `reset --hard FETCH_HEAD` in a copy only form.ext writes; when that copy has no `.git` it is pulled fresh.
- Every git call passes an argument list, `GIT_TERMINAL_PROMPT=0` and `GIT_LFS_SKIP_SMUDGE=1`, so a private or missing repository fails with a sentence instead of a prompt, and LFS files stay pointers.
- Nothing in a source is built, imported or executed. `files`, `read` and `search` walk it, skipping `.git`, `node_modules`, `target`, `dist` and symlinks; a caller's path goes through `_inside` (no absolute path, no `..`, must resolve under the source).
- Landmarks are computed, not kept by hand: the docs that exist (`CLAUDE.md`, `AGENTS.md`, `docs/EXTENSIONS.md`, the wiki's Extensions and Architecture pages), the files that implement the extension host (named `host-bridge.ts`, `formext_host.py`, `formext.go`, `extensions.*`, `docops.ts`, or inside a `formext` folder), the app's own skills and its licence. Checked on all fourteen repositories on 2026-11-10: each host answers its real host files (form.md: `internal/formext/`, `web/src/extensions/formext/`).
- `auto(product)` starts a background pull when a project is made from a starter or opened in the window (`routers/templates.py`, `routers/projects.py` on `touch`), once, and not again for ten minutes after a failure; `sources.auto` false or `FORMEXT_SOURCES_AUTO=0` turns it off. The thread is a daemon, so a one-shot `./formext cli new` may exit before it ends: the `new` op's `next` says to call `source`, which waits.
- `sources.base` or `FORMEXT_SOURCES_BASE` moves the origin (a mirror, or a `file://` folder); `sources.local.[key]` uses a person's own checkout in place, never pulled or deleted here.
- Events: `source.changed {key, state, commit?, error?}`.

**Agents.** `claude_code.extra_dirs(project)` adds the host source as a second `--add-dir` when it is here, so Claude Code reads it and loads the app's own skills from its `.claude/skills`; `note()` says where it is, or tells the agent to call `source`. `op_docs` answers a product topic from the pulled source's `docs/EXTENSIONS.md` when it differs from the bundled page and says so in `from`.

**The family (`family.py`).** `overview()` is one answer for the `family` op: each app with its API page, starters, bundled skills and source state, and whether formMCP, formskills-cli and FormPortal are on this computer. `skills(key)` lists the skills bundled here, the ones in the pulled source, and the released ones through `formskills-cli skills [id]` (FormSkills names FormDeck `formslide` and FormPortal `formai`); when the catalogue gives none and the source is here it asks again in FormSkills' dev mode over the store. `install` runs `formskills-cli install [id] --to claude [--project DIR]`. formMCP does not list form.ext and FormSkills does not catalogue form.ext's skills (both read formcompiler's registry); that is their side to change.

**Submit to Registry.** `publish.registry_checkout()` falls back to the `registry` source, and `submit` fetches it first (`_ensure_registry`), so the registry's own `tools/check.py` runs with nothing to set up; `registry.checkout` still overrides. A missing LICENSE is written in full for Apache-2.0 (the text in `templates/LICENSE`) and MIT; starter READMEs now carry `## Permissions` and `## Screenshot`, the two things check 6 asked for that every new project failed.

**The pull request (`registry_pr.py`).** Only on request (`POST /api/publish/{pid}/registry/pull-request`, the `submit` op's `pull_request`). It runs `submit` again, refuses with 409 and a `needs` list while the checks fail or a placeholder is left (`STUBS`), then: `gh api user`; the fork (`gh repo fork --clone=false` unless `repos/[login]/form.ext-registry` already is a fork of the registry); a full working clone in `registry-work/`; `checkout -B [branch] FETCH_HEAD` from the registry's main; the folder copied over `extensions/[id]`; a commit under the person's own git identity (a GitHub noreply address when git has none); `push --force-with-lease` to the remote `fork` only; then `gh pr create`, or nothing when their open pull request for the branch exists. When the fork's branch already has the same tree nothing is pushed. git's credentials come from `gh auth git-credential` per command, so no global git config is written and no token is read here.

**Hardened after an independent read of the code.** A background pull of a source that was already here left it reading "pulling" for good (the state was set before the thread found nothing to do); `pull_async` now answers at once for a present or local source and its thread always clears its own state. An archive over the size cap or cut short left its temporary file behind; it is removed on every failure path, the unpacked size is capped, and stale ones are swept. `source_search` with a pattern that repeats a repeating group could hold the engine for good, so such patterns and patterns over 200 characters are refused and lines are matched up to 2000 characters. `sources.base` must be an http, https or file address and every clone passes `--` before it, so it can never be read as a git option. `.git` is not readable through `source_read`. The working clone is used only when git says its top level is that folder (else it is made again), with `GIT_CEILING_DIRECTORIES` set, so `reset --hard` and `clean` cannot reach an enclosing repository; the id and version are checked against the registry's forms before any path is built from them; a lost sign-in and a failed copy answer a sentence.

**Checked.** Real clones of all fourteen repositories from GitHub; `source_files`, `source_read`, `source_search` over them, by product and by project id; the archive path against a `file://` mirror made with `git archive` (GitHub's archive address is not reachable from the build machine, so the download itself was not exercised against GitHub); `skills` against a locally built formskills-cli 0.10.1 in dev mode (its catalogue address was not reachable there); `submit` with the fetched registry running the real `tools/check.py`; the pull request flow end to end against two local bare repositories and a stand-in `gh` (opened, updated, unchanged, refused on checks, refused on placeholder). **Not checked:** the pull request against GitHub itself, Windows, and the frozen desktop engine.

## Module notes (where each module's backend files are explained)

| Module | Files | Notes |
|---|---|---|
| Check | `services/validate.py`, `routers/validate.py` | `frontend/src/panes/check/HASHOUT_LOG.md` (and #lint-scanner below) |
| New and Home | `services/templates.py`, `routers/templates.py`, `templates/` | `frontend/src/panes/new/HASHOUT_LOG.md` |
| Preview | `routers/preview.py` | `frontend/src/panes/preview/HASHOUT_LOG.md` (covers `frontend/src/sim/` too) |
| Package | `services/package.py`, `services/keys.py`, `routers/package.py` | `frontend/src/panes/package/HASHOUT_LOG.md` |
| Ship | `services/portal.py`, `services/publish.py`, `routers/runapp.py`, `routers/publish.py` | `frontend/src/panes/run/HASHOUT_LOG.md` (Submit to Registry in `#registry`) |
| Library | `services/library.py`, `services/registry.py`, `registry_keys.txt`, `routers/library.py` | `frontend/src/panes/library/HASHOUT_LOG.md` (the registry shelf, its keys and refusals) |
| Agents | `app/cli.py` (the engine client and the `OPS` table both surfaces are built from), `app/mcp.py` | `.claude/skills/formext-skillset/sub-skills/agent-substrate/SUB-SKILL.md`. After any op change run `./formext cli agents-sync` (regenerates `.claude/skills/formext-harness/references/tools.md` and the `.agents/skills/formext-harness` mirror) and commit both. |
| Sources | `services/sources.py`, `services/family.py`, `services/registry_pr.py`, `routers/sources.py` | `#sources` above; the Studio's source row in `frontend/src/panes/studio/HASHOUT_LOG.md#source`. Not ported to the demo: its routes answer 404 there and the window stays quiet. |
| Demo | none here | `demo/src/engine/` ports `services/{workspace,settings,templates,validate,package,keys,library,registry,portal,publish}.py` (the registry shelf in `engine/library.ts`) and `routers/preview.py`; a change to those needs the same change there (`demo/HASHOUT_LOG.md#port`). |

### Check lint scanner {#lint-scanner}

`scan_js` gives two copies of a script, both the same length as the source so offsets stay lines and columns: `code` with comments blanked, and `bare` with string, template text and regular-expression contents blanked too (quotes kept, `${...}` expressions kept as code). The code rules (`fetch`, `eval`, storage, dialogs, the SDK calls) run on `bare`, so a word inside a string is never a call; an `import` counts only where `bare` still has the keyword and it is not a property (`x.import(`). A match that is followed by a parameter list and `{` is a definition, not a call (the bundled SDK's `fetch(t,n={}){...}` method). Method strings count as uses unless they are the first argument of `this.call(` or `this.on(` (the SDK's own wrappers) or items of an array made only of method strings (the SDK's long-timeout set). With these rules every first-party package (the registry's packages) checks with no problem, the minified ones included, and FX3's bad fixture gives exactly the problems it gave before. The demo's `engine/validate.ts` has the same scanner.
