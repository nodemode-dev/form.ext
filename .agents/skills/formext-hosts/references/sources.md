# Source map

Where each Form app implements the Form Extension Contract, so `source_read` and `source_search` go straight to the right file. Paths are inside the pulled source (`sources/[repository name]/`). The first eight rows come from the family facts checked on 2026-11-10; the rows for formwav, formpdf, formdeck, formlit, formencoder and formvfx were checked file by file in checkouts. The `source` answer lists `docs` and `extension_host` for an app too: trust it over this table when they differ, since apps change.

| App (id for `source`) | Extension host files | Command catalogue and document snapshot |
| --- | --- | --- |
| formvis (`formvis`) | `backend/app/routers/extensions.py`, `backend/app/services/formext_host.py`, `frontend/src/formext/` | in the host files above; the palette catalogue is what `app.run` runs |
| formcut (`formcut`) | `backend/app/extensions.py`, `backend/app/formext_host.py`, `frontend/src/extensions/host-bridge.ts` | in the host files above |
| form.md (`formmd`) | `internal/formext/formext.go`, `internal/formext/module.go`, `web/src/extensions/formext/` (`host-bridge.ts`, `index.ts`, `docops.ts`) | `docops.ts` holds the `doc.*` ops and the snapshot builder; `web/src/engine/commands.ts` is the command registry |
| formMCP (`formmcp`) | `core/src/extensions.rs`, `frontend/src/ext/` | in the host files above |
| formskills (`formskills`) | `core/src/extensions.rs`, `frontend/src/extensions.ts`, `frontend/src/formext/host-bridge.ts`, `src-tauri/src/extensions.rs` | in `frontend/src/extensions.ts` |
| formtray (`formtray`) | `core/src/extensions.rs`, `frontend/src/ext/host-bridge.ts`, `src-tauri/src/extensions.rs` | in the host files above |
| FormPortal (`formportal`) | `core/src/extensions.rs` (installs, `enabled.json`) | not a host: it installs and enables extensions |
| Registry (`registry`) | `tools/check.py`, `SUBMITTING.md`, `POLICY.md` | not a host: the checks and rules for official extensions |
| formwav (`formwav`) | `backend/app/services/formext_host.py`, `backend/app/routers/extensions.py`, `frontend/src/ui/extensions.ts` | `frontend/src/engine/catalogue.ts` (commands), `frontend/src/engine/inspect.ts` (session snapshot) |
| formpdf (`formpdf`) | `backend/app/services/formext_host.py`, `backend/app/routers/extensions.py`, `frontend/src/ext/extensions.ts` | `frontend/src/automation/catalogue.ts` (commands); `read` in `frontend/src/ext/extensions.ts` builds the snapshot |
| formdeck (`formdeck`) | `backend/app/services/formext_host.py`, `backend/app/routers/extensions.py`, `frontend/src/extensions/host.ts` | `frontend/src/automation/catalogue.ts` (commands); `read` in `frontend/src/extensions/host.ts` builds the snapshot |
| formlit (`formlit`) | `backend/app/services/formext_host.py`, `backend/app/routers/extensions.py`, `backend/app/engine/cmd_extensions.py`, `frontend/src/modules/shared/extensions.ts` | `backend/app/engine/commands.py` (commands, listed to the window by `/api/commands`); `read` in `frontend/src/modules/shared/extensions.ts` builds the snapshot |
| formencoder (`formencoder`) | `backend/app/services/formext_host.py`, `backend/app/services/extensions.py`, `backend/app/routers/extensions.py`, `frontend/src/ext/extensions.ts` | `commands` and `readDocument` in `frontend/src/ext/extensions.ts` |
| formvfx (`formvfx`) | `backend/app/services/formext_host.py`, `backend/app/routers/formext.py`, `frontend/src/formext/host.ts` | `catalogue` and `read` in `frontend/src/formext/host.ts` |

The Python hosts carry the contract kit's `host-bridge.ts` (the JSON-RPC bridge) and `formext_host.py` (the resolver); form.md has its own Go and TypeScript port and the Rust hosts their own `extensions.rs`. Read those for the contract, and the other files for what the app does with it. Read the app's `docs/EXTENSIONS.md` first: it is the app's own statement of what `document.read`, `document.apply` and `app.run` accept.

## Reading order for an app

1. The app's `CLAUDE.md` or `AGENTS.md`, then `docs/EXTENSIONS.md` (the `docs` field of the `source` answer lists them).
2. The command catalogue: the ids `app.run` accepts and their parameters.
3. The snapshot builder: what each `document.read {what}` returns.
4. The host bridge and resolver files only when the contract itself is in doubt.
5. The app's own skills in its `.claude/skills` (the `skills` field), when it has any.

## How to use it

1. `source {app}` pulls the source (or `source {app, action: "status"}` to see without the network). The answer's `extension_host` and `docs` give the same files for the current commit.
2. `source_read {app, path}` reads a file by lines (400 by default, 2000 at most; page with `start`). Start with `docs/EXTENSIONS.md`, then the command catalogue, then the snapshot builder.
3. `source_search {app, query}` finds a command id, a `what` value or an op name with file and line. Use `regex: true` for patterns and `glob` to narrow, for example `glob: "frontend/src/**/*.ts"`.
4. `source_files {app, under}` lists a folder when a path above has moved.
5. Sources are read-only. Never build or run them, and never edit them. For a GPL app (formMCP, formskills, formportal) reading is fine; copying code into an extension puts the extension under the GPL.
