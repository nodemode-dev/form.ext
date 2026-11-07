# HASHOUT_LOG · library · form.ext

Living log of the Library module: `frontend/src/panes/library/`, `backend/app/services/library.py`, `backend/app/routers/library.py`. Source files stay comment-free; what they would have said lives here.

Current build version: v0.1.0
Last updated: 2026-11-07 · v0.1.0 library

---

## Routes {#routes}
- refers-to: backend/app/routers/library.py
- kind: interface
- logged: v0.1.0 · 2026-11-07

| Route | Answer |
|---|---|
| `GET /api/library/examples` | `{examples, packages, folders}`: one card per extension (newest version first, earlier versions in `older[]`), each `{key, file, folder, sha256, bytes, ok, id, name, product, version, description, permissions[{id, words}], repo, repo_name, homepage, imported[project ids], older[{key, version, sha256, imported}]}` |
| `GET /api/library/examples/{key}` | the inspect report of that package (`key` is the file name without `.formpkg`, `id-x.y.z`) |
| `POST /api/library/examples/{key}/import` | `{name?, anyway?}` makes a new project from it |
| `POST /api/library/inspect` | raw bytes (`application/octet-stream`, `?name=file.formpkg`) or JSON `{path}` of a file on this computer |
| `POST /api/library/import` | raw bytes (`?name=`, `?project=` new project name, `?anyway=1`) or JSON `{path, name?, anyway?}` |
| `GET /api/library/builds/{pid}/{sha}` | the inspect report of a Package build |
| `POST /api/library/builds/{pid}/{sha}/import` | a build as a new project |
| `GET /api/library/compare/{pid}?a=&b=` | `a` and `b` are build SHA-256s or `current` (the project's package files now, default for `b`) |
| `GET /api/library/compare/{pid}/file?a=&b=&path=&context=3` | the line diff of one file as hunks `{a_start, a_lines, b_start, b_lines, lines[{t: ' ' or '+' or '-', a, b, s}]}`, cut after 4000 lines (`truncated`) |

A refused import answers 422 `{detail, report}`; the pane shows the report. Imports emit `library.imported {id, sha256, package, version}` and the workspace's `project.created`.

The inspect report: `{sha256, bytes, name, ok, can_import, kit_refuses, product, errors[{file, message, kit?}], warnings, files[{path, size, packed, sha256, type, text, ok, problem?}], manifest, summary, layout{kit_layout, notes}, check{ok, counts, problems}, rebuild{ok, sha256, same, reason}, known[{kind: build or import, project}], source, ms}`. `summary.permissions` carries the contract's plain words (the same text as `PERMISSION_WORDS` in `contract/host/host-bridge.ts`).

---

## Reading a package safely {#safety}
- refers-to: services/library.py :: read_package, _entry_problem, inspect_bytes, import_bytes
- kind: decision
- logged: v0.1.0 · 2026-11-07

The zip is read in memory (`zipfile` over `BytesIO`) and never extracted with `extractall`. Each entry is judged on its own before its bytes are read: no empty, NUL, backslash, absolute, drive-letter, `..` or `.` segments; a Unix symlink mode (`create_system` 3 and `S_ISLNK`) is refused; encrypted entries are refused; the type list, the 200-character path limit, 20 MB packed and 512 files are the kit's own constants (`formpkg.TYPES`, `MAX_BYTES`, `MAX_FILES`). form.ext adds limits the contract leaves open: 50 MB unpacked per file (the workspace's own file limit), 200 MB unpacked in total, a 200:1 ratio for files over 1 MB, and paths that differ only in letter case (they would collide on macOS and Windows). Bytes are read with a cap and the real length must match the header.

Only accepted entries are written, through `workspace.safe_join`, into a temporary folder; there the vendored kit runs unchanged (`formpkg.problems`, `formpkg.files_of`), then Check (`validate_folder`), then `formpkg.build` into another temporary folder to see whether the package rebuilds to the same SHA-256 (every first-party package does). An import writes through `workspace.create`, which stages the files with `safe_join` in `projects/.new-*` and moves them into place in one rename, so nothing lands outside the new project. The project gets `import.json` beside `package/` (outside the package, so it is never packed) recording the source SHA-256; the Examples shelf and the report's "Seen here" use it.

Two kinds of error: unsafe or unreadable (a structural problem, or no readable root `manifest.json`) never imports; the kit refusing a readable manifest (for example `api` missing or `"2"`) imports only with `anyway`, because opening it in form.ext is how such a package gets fixed. Check findings never block an import. The manifest id is kept; the project id is a fresh slug (`shot-list-2` when `shot-list` exists).

A package not laid out the way `formpkg build` writes it (unsorted entries, timestamps, modes, stored entries, folder entries) is a warning, not an error: hosts install it, but its SHA-256 will not match a rebuild.

---

## Examples shelf {#examples}
- refers-to: services/library.py :: example_dirs, examples
- kind: decision
- logged: v0.1.0 · 2026-11-07

Folders searched, in order: `FORMEXT_EXAMPLES` (path list), the setting `library.examples_dir`, `<data folder>/examples`, and `/home/claude/ext/packages` (the build machine's package drop, used only when it exists). Files must be named `<id>-<x.y.z>.formpkg`. The packages are read in place and never copied into the repository; importing one copies it into the data folder like any other import. Each card links the extension's source repository, `https://github.com/nodemode-dev/formext-<product>-<id>`, opened with the system browser in the desktop app (Tauri shell `open`, the same way the Docs pane does). Reports are cached per file by size and modification time.

---

## Compare {#compare}
- refers-to: services/library.py :: compare, compare_file
- kind: decision
- logged: v0.1.0 · 2026-11-07

A side is a Package build (read from `builds/<project>/<sha>/`, its recorded manifest and its zip) or `current`, the files `formpkg.files_of` would pack now. The manifest is flattened to dotted paths, with lists of objects that have an `id` keyed by it (`contributes.commands[open].title`), so a reordered list is not a change. Permissions are shown added, removed and kept in plain words; `consent_again` is true when a permission is added or the version changes, since hosts ask again for a new version or a larger set (contract section 7). Text files get line counts; the hunks come on demand when a file row opens.

---

## The pane {#pane}
- refers-to: frontend/src/panes/library/index.ts · library.css
- kind: decision
- logged: v0.1.0 · 2026-11-07

Three tabs (Examples, Inspect and Import, Compare Builds), all present in the first render and switched with `.hidden`; the tab is kept in `localStorage['formext.library.tab']`. Arguments through `openPane('library', args)` (heard on `pane.open`, which also fires for the opening call): `{action: 'import'}` (Home's Import .formpkg: shows Inspect and opens the file chooser in the same click), `{action: 'inspect', path}`, `{action: 'inspect', project, sha}`, `{action: 'inspect', key}`, `{action: 'compare'}`, `{action: 'examples'}`. A package can also be dropped anywhere on the pane. After an import the project opens and the Edit pane shows `package/manifest.json`. Commands: Library: Import .formpkg, Library: Examples, Library: Compare Builds. The pane reloads its build list on `package.built` and `package.removed`, and recompares on `project.changed` when the To side is the current files.
