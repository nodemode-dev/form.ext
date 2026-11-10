---
name: engine-modules
description: "form.ext's engine modules, each a routers/[module].py with its services/[module].py: validate (the Check rules), templates and the starters in templates/, preview (contract file serving and the preview fetch proxy), package and keys (deterministic builds, reproducibility, Ed25519 signing, index entries), runapp and portal (FormPortal's folder, installed apps, dev.json, opening apps, sending packages), publish (submission folders) and library (import and inspect .formpkg, compare builds, examples). Use when adding or changing a module route, a Check rule, a starter, or the package, signing, Run in App or publish behaviour."
---

# engine-modules

## Routes by module

| Module | Routes |
| --- | --- |
| validate | `POST /api/projects/{id}/validate` answers `{ok, counts, problems: [{rule, severity, file, line, column, message, fix, path}], files, bytes, checked_at}` and emits `validate.done`; `GET /api/validate/rules` |
| templates | `GET /api/templates` (products, starters, examples), `GET /api/templates/{product}/{starter}`, `POST /api/templates/create {product, starter, name, description?}`, `GET /api/templates/examples`, `POST /api/templates/examples/{id}` |
| preview | `GET /api/preview/{id}?product&app_version` (the host check and the frame record), `GET/HEAD /api/preview/{id}/files/{ext}/{version}/{path}` (contract headers and CSP), `POST /api/preview/fetch` (https only, public hosts only, no redirects, 50 MB) |
| package, keys | `POST /api/projects/{id}/package {anyway?}`, `POST .../package/reproduce`, `GET .../builds`, `GET/DELETE .../builds/{sha}`, `GET .../builds/{sha}/file`, `POST .../builds/{sha}/sign {key, passphrase}`, `POST .../builds/{sha}/verify`, `GET .../builds/{sha}/entry?url&publisher`; `GET/POST /api/keys`, `GET/DELETE /api/keys/{id}`, `GET /api/keys/{id}/public` |
| runapp | `GET /api/runapp` (root, installs, dev rows with host views), `GET /api/runapp/root`, `GET/POST/DELETE /api/runapp/projects/{id}`, `POST /api/runapp/projects/{id}/install`, `POST /api/runapp/send {path}`, `GET/PUT /api/runapp/apps/{product}/dev`, `DELETE /api/runapp/apps/{product}/dev/{ext}`, `POST /api/runapp/apps/{product}/{reload,open,manage}` |
| publish | `GET /api/publish/{id}` (with `registry {submission, folder, checkout, repo}`), `POST /api/publish/{id} {url, publisher, passphrase, sign}`, `POST /api/publish/{id}/send`, `POST /api/publish/{id}/reveal`, `POST /api/publish/{id}/registry` (Submit to Registry), `POST /api/publish/{id}/registry/reveal` |
| library | `POST /api/library/inspect`, `POST /api/library/import` (JSON `{path}` or the raw bytes), `GET/POST /api/library/builds/{id}/{sha}[/import]`, `GET /api/library/compare/{id}[/file]`, `GET /api/library/registry[?refresh=1]`, `GET /api/library/registry/{id}`, `POST /api/library/registry/{id}/import` (`services/registry.py`: the signed index, keys in `app/registry_keys.txt` plus `FORMEXT_REGISTRY_PUBKEY`) |

## Sources, family and the registry pull request

`services/sources.py` is the source store (shallow clones, or archive downloads when git is missing, under the data folder's `sources/[repository name]/`), `services/family.py` the family map and the link to FormSkills (`formskills-cli`), `services/registry_pr.py` the pull request for Submit to Registry (working clone in `registry-work/`). Routes: `GET /api/sources`, `GET /api/sources/family`, `/api/sources/{key}` with `pull`, `files`, `file`, `search` and `skills`, and `GET|POST /api/publish/{pid}/registry/pull-request`. Events: `source.changed` and `publish.pull_request`.

- **Sources are read-only.** Never build, install or execute anything from a pulled source, and never write into it. A source set with `sources.local.[key]` is the person's own checkout: never delete it.
- **Subprocess calls take an argument list.** Every call to git, `gh` or `formskills-cli` passes a list, never a shell string.
- **Caller paths go through `_inside`.** Any path from a caller (a file in a source, a skills checkout) is checked with `_inside` before use.
- **Network failures become a plain sentence.** A failed pull, download or `gh` call answers with a sentence a person can act on, and the source state becomes `failed`; no traceback reaches the answer.
- **The pull request is opt-in and public.** It runs only for `pull_request: true`, refuses while the registry's checks fail or a README or LICENSE placeholder is left, and posts under the person's GitHub account.
- **New ops** go into the `OPS` table in `backend/app/cli.py` (the route first), then run `./formext agents sync`.

Each module keeps its own notes in its pane folder's `HASHOUT_LOG.md` (for example `frontend/src/panes/check/HASHOUT_LOG.md` covers the validate service and router).

## Rules

- **Use the kit, do not copy it.** Host acceptance is `formext_host.check`, file serving `formext_host.file_for` and `headers_for`, the CSP `formext_host.csp_for`, package rules and builds `formpkg.problems` and `formpkg.build`, index entries `formpkg.entry`. One rule implemented twice drifts.
- **Check rules carry their fix.** A new rule goes into `RULES` in `services/validate.py` with id, severity, title and text, and each problem it reports has file, line, column and a fix sentence a person can follow. Rules in `CONTRACT_RULES` (`json`, `package`, `schema`, `host`, `missing-entry`) make `package` refuse even with `anyway`.
- **Builds are deterministic.** The same package folder gives the same SHA-256; builds are stored by SHA-256 under the project's builds folder with a `formext-build` record; `reproduce` rebuilds with the kit's own command line and compares.
- **Keys never leave the data folder.** Only the public part is exported; a passphrase encrypts the private key; signatures are Ed25519 over the package bytes.
- **Outside folders are written atomically and only where the contract says.** Run in App writes `extensions/[product]/dev.json` under FormPortal's root (`FORMPORTAL_ROOT` first, the same order as FormPortal's `Portal::default_root`); publish writes only into the data folder's `submissions/`.
- **Starters must stay Check-clean.** Each of the twelve hosts has `panel`, `command` and `panel-commands` under `templates/[product]/`, written against that app's `docs/apps/[product].md`. After changing one, create it in a scratch data folder and run `validate` on it.
- **Emit an event** for anything the window should refresh on, and add the op to `backend/app/cli.py` for anything an agent should be able to do.
