# HASHOUT_LOG · library · form.ext

Living log of the Library module: `frontend/src/panes/library/`, `backend/app/services/library.py`, `backend/app/services/registry.py`, `backend/app/registry_keys.txt`, `backend/app/routers/library.py`. Source files stay comment-free; what they would have said lives here.

Current build version: v0.2.3
Last updated: 2026-11-08 · v0.2.0 a part of the Studio

---

## Routes {#routes}
- refers-to: backend/app/routers/library.py
- kind: interface
- logged: v0.1.0 · 2026-11-07

| Route | Answer |
|---|---|
| `GET /api/library/registry?refresh=1` | the registry shelf `{url, url_source, name, verified, key, keys, note, offline, fetched_at, sha256, registry_commit, publishers, extensions}`, each extension `{id, name, product, version, kind, author, licence, description, permissions[{id, words}], verified, listed_verified, source, registry_commit, url, sha256, bytes, signed_by, imported[project ids]}`. A refusal answers 200 with `{error: {detail, problem, status}, url, extensions: []}` so the pane shows it without a failed request in the console |
| `GET /api/library/registry/{id}` | the inspect report of the registry's newest package of that id, after the SHA-256 and signature checks; `source` is `{kind: "registry", id, version, sha256, url, index, repo, repo_name, signed_by, index_verified}` |
| `POST /api/library/registry/{id}/import` | `{name?, anyway?}` makes a new project from it; a registry refusal answers its status with `{detail, problem}` |
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

## Registry shelf {#examples}
- refers-to: services/registry.py · services/library.py :: registry_shelf, inspect_registry, import_registry
- kind: decision
- logged: v0.1.1 · 2026-11-07

The shelf (tab id `examples`, labelled Registry) reads only form.ext-registry; the v0.1.0 folder search (`FORMEXT_EXAMPLES`, `library.examples_dir`, `<data>/examples` and the build machine's package drop) is gone, and no machine path is left in the code.

- Address: `FORMEXT_REGISTRY_URL`, else the setting `registry.url` (default `https://github.com/nodemode-dev/form.ext-registry/releases/download/index/extensions.json`, REGISTRY_SPEC). `https`, `http` (local tests) and `file` addresses are read; GitHub hosts get `Authorization: Bearer` from `FORMEXT_GITHUB_TOKEN`, `GITHUB_TOKEN` or `GH_TOKEN` when set.
- Keys: `backend/app/registry_keys.txt` (comment lines only until the owners add the real key; packed beside `app/` by `setup/freeze_backend`) plus `FORMEXT_REGISTRY_PUBKEY`, comma-separated; only base64 of 32 bytes counts. No key: refused before any download with "this build trusts no registry key yet" (409, `no-key`), unless the developer setting `registry.developer` is true, which reads the index unchecked and leaves every card unverified.
- The index and `extensions.json.sig` are downloaded, the signature checked against each key (`keys.verify`), and the fingerprint of the key that matched is shown. A missing `.sig` or no matching key is "signature mismatch" (422, `signature`). 401, 403 and 404 are `private` ("private while it is tested, so its downloads need a GitHub token, or nothing is published yet"); no answer is `unreachable`. A verified index is kept in `<data>/registry/` (`extensions.json`, `.sig`, `kept.json`); when the registry is unreachable the kept copy for the same address is checked again and used, and the shelf says so (`offline`). Answers are cached in memory for 5 minutes; Refresh (`?refresh=1`) downloads again.
- Entries are the index's `packages` (or `extensions`) list, newest version per id. A card is Verified when the entry says `verified` and the index signature verified. `source` is the entry's, else the registry tree URL of the id.
- Inspect and Import: the package is downloaded from the entry's `url`, or from the same relative release path under the index address when the index is not the default one (a mirror: `mirrored()`), its SHA-256 and size compared with the entry (`sha256`), then the publisher signature checked with `keys.check_signature` against the index's `publishers` (an unsigned entry is refused unless `registry.developer`). Verified bytes are kept by SHA-256 in `<data>/registry/packages/`; a kept file that no longer matches is deleted and refused. Then the ordinary import path (`import_bytes`), with the registry `source` in `import.json`.
- Verified against the test index (`/home/claude/ext/registry-test`, served over HTTP with the release paths): 12 cards, all Verified, signed by `nodemode`; Inspect and Import of Golden Hour and Focus Timer; refusals with no key, a tampered index, a wrong key, a 404 and a closed port; a tampered kept package and a wrong publisher key.

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

Three tabs (Registry, Inspect and Import, Compare Builds), all present in the first render and switched with `.hidden`; the tab is kept in `localStorage['formext.library.tab']`. Arguments through `openPane('library', args)` (heard on `pane.open`, which also fires for the opening call): `{action: 'import'}` (Home's Import .formpkg: shows Inspect and opens the file chooser in the same click), `{action: 'inspect', path}`, `{action: 'inspect', project, sha}`, `{action: 'inspect', key}` (`key` is a registry id), `{action: 'compare'}`, `{action: 'examples'}`. A package can also be dropped anywhere on the pane. After an import the project opens and the Edit pane shows `package/manifest.json`. Commands: Library: Import .formpkg, Library: Registry, Library: Compare Builds. The Registry tab has a fixed-height status notice (two lines, the icon in a fixed box so a spinner turning into a mark moves nothing) and Refresh above the cards; a refusal hides the grid and shows the empty state with a plain title (no trusted key, private or not published, unreachable, signature mismatch) and the engine's words. The pane reloads its build list on `package.built` and `package.removed`, and recompares on `project.changed` when the To side is the current files.
