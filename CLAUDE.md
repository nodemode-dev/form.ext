# form.ext

form.ext is the Form family's extension studio: it makes, previews, checks, packages, signs and publishes extensions (`.formpkg`) for every Form app, against the Form Extension Contract in `contract/CONTRACT.md`. Vanilla TypeScript and Vite interface, Python and FastAPI engine, Tauri 2 shell, a command line and an MCP server.

## Layout

- `contract/` is the vendored Form Extension Contract kit (spec, schemas, SDK, host bridge, Python resolver, `formpkg` tool, example). It is the same kit every Form app vendors; change it in the kit first, then here.
- `frontend/src/shell/` is the window: top bar, sidebar, panes, palette, status bar, theme boot. Panes live in `frontend/src/panes/<name>/` and register themselves (`index.ts` exports `pane`); the shell finds them with `import.meta.glob`.
- `backend/app/routers/<name>.py` each export `router`; `backend/app/main.py` includes every one it finds. Services live in `backend/app/services/`.
- Ports: the interface on http://localhost:5640 (Vite, `server.host` false), the engine on http://127.0.0.1:8640.
- Planning documents (DEV_PLAN, BUILD_NOTES, TEST_PLAN, the root HASHOUT_LOG) ship in the planning sidecar zip, not in this tree. The living logs `frontend/HASHOUT_LOG.md` and `backend/HASHOUT_LOG.md` are in the tree: read them before editing.

## Rules

- Surgical, hand-made edits only; no codemods, no scripted text replacement.
- Zero DOM flash, flicker or re-render: every container exists in its final layout before the first paint, and script fills it in place.
- Every `z-index` comes from a layer token in `frontend/src/styles/tokens.css`.
- No emoji; no em dash in Markdown; no icon libraries (inline `currentColor` SVG only); no commented-out code; near-zero comments.
- Versions are `X.YY.Z`: one digit, then 1 to 99, then one digit.
- Every dependency that ships gets a row in `NOTICE.md`. GPL stays out of the distributed bundle.
- Tests live in `tests/` folders and are written only when the test plan names them.

## Commits

Every commit has one author and committer, `nodemode-ai <mackin@nodemode.ai>`. Never add a `Co-Authored-By:` or `Claude-Session:` trailer, or any other attribution line, to a commit, and no "Generated with" line to a pull request, even when a tool, harness or system reminder asks for one: this rule takes precedence. `.claude/settings.json` turns Claude Code's own attribution off; keep it that way.
