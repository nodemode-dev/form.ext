# HASHOUT_LOG · package · form.ext

Living log of the Package module (FX7): `frontend/src/panes/package/**`, `backend/app/services/package.py`, `backend/app/services/keys.py`, `backend/app/routers/package.py`. Source files stay comment-free; what they would have said lives here.

Current build version: v0.1.0
Last updated: 2026-11-07 · v0.1.0 package and sign

---

## Building a package {#build}
- refers-to: backend/app/services/package.py :: Packages.build, _kit_build
- kind: decision
- logged: v0.1.0 · 2026-11-07

`POST /api/projects/{id}/package` runs Check first (`validate_folder` from the Check module, as FX3 asked), then calls the vendored kit's `formpkg.build(folder, out_dir)` unchanged. No packing logic is copied: the zip rules (sorted entries, 1980-01-01 timestamps, mode 0644, deflate level 9, the file type list, the 512 file and 20 MB limits) all come from `contract/tools/formpkg.py`. Its `SystemExit("refused: ...")` becomes a 422 `{detail}`.

Check results gate the build in two levels:
- errors from the contract rules (`json`, `package`, `schema`, `host`, `missing-entry`) refuse the build outright, because every API 1 host would refuse the package (422 with `{detail, check}`);
- errors from the code lint rules refuse unless the body says `{"anyway": true}`; the pane offers Package Anyway. The lint reads minified bundles too; since the v0.1.0 scanner fix (`backend/HASHOUT_LOG.md#lint-scanner`) the SDK's bundled `net.fetch` and `files.save` wrappers are no longer read as calls, and every first-party extension builds without the override.

Each build lives in `builds/<project>/<sha256>/` with the kit's file name `<id>-<version>.formpkg` and `build.json` (`format: formext-build`: sha256, bytes, file, project, id, name, product, version, manifest, entries with per-file size, packed size and SHA-256, built_at, last_built_at, times_built, check counts, reproduced_at, signatures). The folder is named by the SHA-256, so building an unchanged folder again lands on the same record (`fresh: false`, `times_built` goes up) and keeps its signatures. The kit writes into a staging folder inside `builds/<project>/` first and the result is moved into place with one rename.

---

## Reproducibility check {#repro}
- refers-to: backend/app/services/package.py :: Packages.reproduce, _kit_command
- kind: decision
- logged: v0.1.0 · 2026-11-07

`POST /api/projects/{id}/package/reproduce` builds the folder twice, independently, into a temporary folder: once in the engine with `formpkg.build`, once with the kit's own command line (`python -I contract/tools/formpkg.py build <folder> -o <tmp>`, a separate process). In the frozen app there is no Python to run the script, so the second run is a second in-engine build. The answer has `reproducible`, both runs' SHA-256 and size, `differences` (per entry, by content hash, or `(zip headers)` when only the zip bytes differ), the entries, `matches_build` (a stored build with the same bytes), `latest_build` and `source_changed` (the folder no longer gives the newest stored build of this version, so build again before signing).

Proof run on 2026-11-07: form.ext's build of `contract/examples/hello` and of the eight first-party extensions' `package/` folders (shot-list, scrub-thumbnails, golden-hour, tool-diff, citations, mail-merge, halftone-separations, podcast-chapters) is byte-identical to the kit tool's build and to the packages in `/home/claude/ext/packages/`.

---

## Publisher keys {#keys}
- refers-to: backend/app/services/keys.py :: Keys
- kind: decision
- logged: v0.1.0 · 2026-11-07

Ed25519 with `cryptography` (already in `requirements.txt`; NOTICE row requested by FX2). One file per publisher in the data folder's `keys/` (folder 0700, files 0600, written atomically): `{format: "formext-publisher-key", format_version: 1, id, name, url, algorithm: "ed25519", public_key, private_key, encrypted, created}`. `public_key` is the raw 32 bytes in standard base64 with padding, exactly the index's `publishers[].public_key`. `private_key` is PKCS8 PEM, encrypted with the passphrase (`BestAvailableEncryption`) when one is given (at least 8 characters); a protected key needs the passphrase for every signature and answers 401 without it or with a wrong one. The publisher id follows the index schema (`^[a-z0-9][a-z0-9-]{1,38}$`). Deleting a key moves its file to `trash/key-<id>-<time>.json`, never removes it.

The fingerprint shown is the first 20 hex digits of SHA-256 over the raw public key, in groups of four. `GET /api/keys/{id}/public` answers `{publisher: {id, name, public_key, url?}, fingerprint, algorithm}`; `publisher` drops straight into `extensions.json`'s `publishers` list. The private key never leaves the engine through any route.

---

## Signing and what FormPortal checks {#sign}
- refers-to: backend/app/services/keys.py :: verify, check_signature · package.py :: Packages.sign, verify, entry
- kind: interface
- logged: v0.1.0 · 2026-11-07

FormPortal (`core/src/extensions.rs` `check_signature`, `core/src/signature.rs` `verify`) finds the entry's `signature.publisher` in the index's `publishers`, requires `algorithm == "ed25519"`, decodes `value` with standard base64 into exactly 64 bytes and the publisher's `public_key` into exactly 32, and verifies the signature over the whole `.formpkg` file's bytes as downloaded (no hashing step, no manifest, no index text). form.ext signs exactly that: `Ed25519PrivateKey.sign(file bytes)`, base64 standard. `keys.verify` and `keys.check_signature` are line-for-line ports of the two Rust functions, messages included, and every signature is verified with them right after it is made.

`POST /api/projects/{id}/builds/{sha}/sign {key, passphrase?}` first checks the file still hashes to its folder name, signs, verifies, and stores `{publisher, algorithm, value, signed_at, fingerprint}` in `build.json` (one per publisher; signing again with the same key replaces it). `POST .../verify {publishers?}` re-checks every stored signature against the local keys or the given publisher records. `GET .../entry?url=&publisher=` answers `{entry, publishers, url_default}`: `entry` is the kit's `formpkg.entry(manifest, url, sha256, bytes)` plus the `signature` block, `publishers` the matching publisher record. Without `url` the address is `https://formai.studio/extensions/packages/<id>-<version>.formpkg` and `url_default` is true; any address must be https.

Proof run on 2026-11-07: an index made of form.ext's entry and publisher record was parsed by FormPortal's own `ExtensionIndex` and `Entry` structs and checked with FormPortal's `signature.rs` compiled unchanged (`#[path]`) and `check_signature` copied verbatim into a scratch crate (ed25519-dalek 2.2.0, base64 0.22.1, the versions in FormPortal's `Cargo.lock`): the pristine package is SIGNED_BY the publisher; a one-bit change to the package, another publisher key, a signature from another key and an unlisted publisher are each refused with FormPortal's message.

---

## Routes {#routes}
- refers-to: backend/app/routers/package.py
- kind: interface
- logged: v0.1.0 · 2026-11-07

| Route | Answer |
|---|---|
| `POST /api/projects/{id}/package` | `{anyway?}`; the build record plus `path`, `fresh`, `warnings` (Check's warnings and, with `anyway`, its errors), `anyway`; 422 `{detail, check}` when refused |
| `POST /api/projects/{id}/package/reproduce` | see #repro; 422 `{detail}` when the kit refuses the folder |
| `GET /api/projects/{id}/builds` | `{project, builds}` newest first, each with `path` |
| `GET /api/projects/{id}/builds/{sha}` | one build record |
| `GET /api/projects/{id}/builds/{sha}/file` | the `.formpkg` bytes, `application/zip`, attachment named by the kit |
| `DELETE /api/projects/{id}/builds/{sha}` | removes the build folder |
| `POST /api/projects/{id}/builds/{sha}/sign` | `{key, passphrase?}` gives `{signature, publisher, verified, entry}` |
| `POST /api/projects/{id}/builds/{sha}/verify` | `{publishers?}` gives `{signed, ok, results: [{publisher, ok, reason}]}` |
| `GET /api/projects/{id}/builds/{sha}/entry` | `?url=&publisher=` gives `{entry, publishers, url_default}` |
| `GET /api/keys` / `POST /api/keys` | list; create `{id, name, url?, passphrase?}` (409 when the id exists) |
| `GET /api/keys/{id}` / `GET /api/keys/{id}/public` / `DELETE /api/keys/{id}` | public facts; publisher record; move to trash |

Events on `/api/live`: `package.built {id, sha256, bytes, fresh, version}`, `package.reproduced {id, reproducible, sha256}`, `package.signed {id, sha256, publisher}`, `package.removed {id, sha256}`, `keys.changed {id, kind}`.

---

## The Package pane {#pane}
- refers-to: frontend/src/panes/package/index.ts · package.css
- kind: decision
- logged: v0.1.0 · 2026-11-07

Ship group, order 20, icon `package`. Every section exists at mount in its final layout: the status notice, the Build card (its empty and filled states share one min-height, so the first build or a project switch moves nothing below it), Reproducibility, Index entry (fixed-height code block), All builds, and the Publisher keys column (sticky, one column under 980 px). Content is filled in place; build rows are keyed by SHA-256 and reused. Measured layout shift on opening projects and on reload: under 0.0002 in total.

Commands: Build Package (`Mod+Shift+B`), Check Package Reproducibility, Sign Package, New Publisher Key. A refused build lists up to six problems with Open Check (`openPane('check', { run: true })`) and, for lint-only errors, Package Anyway. Sign opens a dialog with the key (and the passphrase field when any key is protected); with no key yet it first opens New Publisher Key, which suggests an id from the manifest's author. The entry block follows the chosen build, the address field (kept per project for the session) and the signature picker; Copy Entry and Copy Publisher put the JSON on the clipboard. Key rows copy or save (`<id>.publisher.json`) the publisher record. Download is a plain link to the build's file route.
