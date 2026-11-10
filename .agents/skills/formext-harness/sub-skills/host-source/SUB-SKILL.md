---
name: host-source
description: "Reading a Form app's real source code before writing its extension: pulling it with the source tool, the reading order, finding a command id, a document field or an event with source_search, the app's own skills, licences (Apache-2.0 versus GPL-3.0 hosts) and keeping the copy current. Use when the API page is thin or unclear, a command or op fails with -32004, a field is missing from the snapshot, or you need the app version for minimum_app."
---

# host-source

## What source does

`source {app: "[product]"}` brings the app's source code onto this computer, in form.ext's data folder at `sources/[repository name]/` (for example `sources/form.md/`): a shallow git clone of `https://github.com/nodemode-dev/[repo]`. It is read-only reference. `family` lists every app with its source state.

The answer has `state` (absent, pulling, ready, failed), `dir`, `commit`, `licence`, `docs` (pages to read first), `extension_host` (the files that implement the Form Extension Contract in that app), `skills` and `note`.

## Reading order

1. The `docs` list: `CLAUDE.md`, `AGENTS.md`, `docs/EXTENSIONS.md` (`source_read {app, path}`).
2. The `extension_host` files: the ops, the snapshot builder, the event emitters.
3. `source_search {app, query}` for the exact command id or field, then `source_read {app, path, start, lines}` around the match. `source_files {app, under?, glob?}` lists what is there. A source also holds docs, logs and skills that mention the same words, so narrow a search to the code with `glob`, for example `glob: "web/src/extensions/*"` or `glob: "*.ts"`.

On the command line the same calls are `./formext cli source-search formmd "doc.select" --glob "*.ts"` and `./formext cli source-read formmd docs/EXTENSIONS.md --start 60 --lines 40`.

## To find ... search for ...

| To find | Search for |
| --- | --- |
| A `document.apply` op and its args | the op id (such as `doc.replaceBlock`) in the `extension_host` files |
| What `document.read` returns | the snapshot builder named in `extension_host` (the function that builds the snapshot object) |
| An `app.run` command | the command registry: `id: "` or the command id itself |
| An event name | `document.changed` or `ext.event` |
| The app version for `minimum_app` | the app's version constant (Form.md: `internal/app/version.go`) |
| Where extensions appear in the app's UI | `extensions` in `frontend/src` or `web/src`, plus the host-bridge file |

## Worked example: Form.md

`source {app: "formmd"}`. Read `docs/EXTENSIONS.md`, then `internal/formext/formext.go` and `module.go`, then `web/src/extensions/formext/docops.ts`: it holds the `doc.*` ops (the `DOC_OPS` list) and the snapshot builder (the function `readDocument`; `outline` there lists only the page's top-level headings). `document.apply` accepts only the nine `doc.*` ops, so `source_search {app: "formmd", query: "doc.replaceBlock"}` shows its args. For `app.run`, `source_search {app: "formmd", query: "id: \""}` in `web/src/engine/commands.ts` lists the command registry; ids starting `extensions.` or `ext.` and risky commands are not runnable from an extension.

## The same pattern elsewhere

- Python host (formvis, formcut): read `backend/app/routers/extensions.py` and `services/formext_host.py` (formvis), or `backend/app/extensions.py` and `formext_host.py` (formcut); search the command id there.
- Rust host (formmcp, formskills, formtray): read `core/src/extensions.rs`, then the frontend host bridge (`frontend/src/ext/` or `host-bridge.ts`).

## The app's own skills

`skills {app}` lists the skills that teach one app: `here` (bundled with form.ext), `source` (in the pulled source) and `released` (through formskills-cli, when installed). `skills {app, install: true}` installs the released ones into Claude Code's skills folder: ask first. Claude Code started from the Studio gets the host app's source as an extra directory, so the app's own skills load there too.

## Licences

Apache-2.0: formvis, formcut, formwav, formpdf, formdeck, formlit, form.md, formencoder, formvfx, formtray and the registry. GPL-3.0: formMCP, FormSkills and FormPortal. Reading GPL source to learn an app's API is fine. Copying its code into an extension puts the extension under the GPL, so never copy it: write the call yourself. `licence` and `note` in the answer say which applies.

## Keeping it current

- `source {app, action: "status"}` reports the commit without network.
- `source {app, action: "update"}` pulls the newest commit.
- `docs {topic: "[product]"}` answers from the pulled source's `docs/EXTENSIONS.md` when that is newer than the bundled page, and its `from` says so.
- Name the commit you read in the reply.

## What not to do

- Never edit, build or run the host source from here.
- Never claim an op or command exists because the source has similar code. `validate`, `preview` and Run in App still decide.
- When the API page and the source disagree, trust the source and tell the person.

## When it fails

- No internet: the bundled API page (`docs`) still works; say the source was not read.
- git missing: an archive is downloaded instead.
- `state` failed: the answer's `error` says why; fix that and call `source` again.
