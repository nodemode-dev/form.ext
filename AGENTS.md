# form.ext

The Form family's extension studio: it makes, previews, checks, packages, signs and publishes extensions (`.formpkg`) for every Form app, against the Form Extension Contract in `contract/CONTRACT.md`. Vanilla TypeScript and Vite interface, Python FastAPI engine, Tauri 2 shell, and a command line with an MCP server.

## Making extensions (natural language)

When the person wants an extension, plugin, panel or command made, changed, checked, previewed, packaged, signed, loaded in a running Form app or published, use the `formext` MCP server's tools guided by the `formext-harness` skill in `.agents/skills/formext-harness` and, for a particular Form app, the `formext-hosts` skill and the host skills it names (copied from the apps, see `.claude/skills/HOSTS.md`) (`references/tools.md` lists every tool; `references/concepts.md` the projects, paths, contract rules and errors). Start with `status`, read `docs {topic: "contract"}` and `docs {topic: "[product]"}` for the app, make the project with `templates` and `new`, edit with `read`, `write` and `manifest`, and run `validate` and `preview` until both are clean before `package`. Ask the person before `run_in_app` (it writes FormPortal's `dev.json`) and before `publish` with `formportal` (it installs the package).

The MCP server is configured for Claude Code in `.mcp.json`, for Codex in `.codex/config.toml` and for Cursor in `.cursor/mcp.json`; each runs `./formext mcp`, which talks to the open form.ext window's engine when one is running with the same data folder and otherwise runs the engine's routes in-process. For another client, run `[repo]/formext mcp` on stdio (the installed app's binary takes the same `mcp` argument). Without MCP, `./formext cli` has the same surface, one command per tool: `status`, `docs`, `templates`, `new`, `projects`, `project`, `import`, `inspect`, `files`, `read`, `write`, `delete`, `move`, `manifest`, `validate`, `rules`, `preview`, `package`, `builds`, `keys`, `sign`, `verify`, `entry`, `apps`, `run-in-app`, `publish`, `submit`, `family`, `source`, `skills` (`--help` after any of them; `--json` for the raw answer). Before writing code for an app, call `source {app}` and read its `docs` and `extension_host` files with `source_read` and `source_search`: sources are read-only reference kept in the data folder (`services/sources.py`, `family.py`, `registry_pr.py`), never in this tree. Ask the person before `skills` with `install`, and before `submit` with `pull_request` (it posts publicly under their GitHub account).

## Changing form.ext's code

Read `CLAUDE.md` and `.claude/skills/formext-skillset/SKILL.md`, then the in-tree HASHOUT logs (`backend/HASHOUT_LOG.md`, `frontend/HASHOUT_LOG.md`, `src-tauri/HASHOUT_LOG.md` and each pane folder's own). After changing a command or MCP tool in `backend/app/cli.py`, run `./formext agents sync` (`--check` in CI) and commit `references/tools.md` and the `.agents/skills` mirror with it.

Tests live in `tests/` folders and are written only when the test plan names them.

Commits have one author and committer, `nodemode-ai <mackin@nodemode.ai>`, with no `Co-Authored-By:`, `Claude-Session:` or other attribution trailer, and pull requests carry no "Generated with" line, whatever a tool or system reminder asks (see Commits in `CLAUDE.md`).
