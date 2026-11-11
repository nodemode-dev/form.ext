---
name: formext-skillset
description: Use for any change to form.ext's own code, the Form family's extension studio. Covers the FastAPI engine in backend/app (workspace, bus, settings, paths, the router auto-include, the validate, templates, preview, package and keys, runapp and publish, and library modules), the vanilla TypeScript and Vite interface in frontend (the shell, ShellContext, panes Home, New, Edit, Preview, Check, Library, Run in App, Package, Publish and Docs, the simulated hosts in src/sim, tokens and zero-flash rules), the starters in templates, the vendored Form Extension Contract kit in contract, the formext command line and MCP server (backend/app/cli.py and mcp.py, .mcp.json, the formext-harness skill and agents-sync), the Tauri 2 shell and frozen engine sidecar, and the ./formext scripts. Trigger on form.ext source files, a new route, pane, rule, starter or MCP tool, an engine or interface bug, ports 8640 or 5640, or HASHOUT_LOG. Not for making extensions with form.ext (use formext-harness).
---

# formext-skillset

Route every change to form.ext's code through this file. It maps the subsystems, states the rules that hold everywhere, and names the specialist.

## Subsystem map

| Subsystem | Root | Specialist |
| --- | --- | --- |
| Engine core | `backend/app/main.py`, `services/{workspace,bus,settings,paths}.py`, `routers/{projects,live,settings,health}.py`, `backend/formext_engine.py`, `backend/boot_backend` | `sub-skills/engine-core/SUB-SKILL.md` |
| Engine modules | `routers/[module].py` with `services/[module].py`: validate, templates (and `templates/`), preview, package and keys, runapp and portal, publish, library, plus `services/sources.py` (the source store), `services/family.py` (the family map and the FormSkills link), `services/registry_pr.py` (the registry pull request) and `routers/sources.py` | `sub-skills/engine-modules/SUB-SKILL.md` |
| Interface | `frontend/src/shell/`, `frontend/src/styles/`, `frontend/src/panes/[name]/`, `frontend/src/sim/` | `sub-skills/interface/SUB-SKILL.md` |
| Command line and MCP | `backend/app/cli.py` (engine client, the op table, the commands), `backend/app/mcp.py` (stdio server), `.mcp.json`, `.claude/skills/formext-harness`, `.agents/skills`, `AGENTS.md` | `sub-skills/agent-substrate/SUB-SKILL.md` |
| Desktop and release | `src-tauri/`, `setup/freeze_backend`, `./formext`, `./formext_oc_install`, `./build_app` | `sub-skills/desktop-and-release/SUB-SKILL.md` |
| Checking a change | the servers, headless Chrome, the CLI and an MCP client | `sub-skills/verification/SUB-SKILL.md` |

## How the pieces depend

```text
contract/ (the Form Extension Contract kit, vendored unchanged: formext_host.py, formpkg.py, schema, sdk, host-bridge.ts)
  -> backend/app/services (workspace and bus first; modules import formext_host and formpkg, never copy them)
  -> backend/app/routers (one router per module, auto-included; one failing router is skipped and named in /api/health)
       -> frontend over /api and the /api/live WebSocket (ctx.api, ctx.events)
       -> backend/app/cli.py and mcp.py over the same routes (HTTP to a running engine, or the ASGI app in-process)
  -> backend/formext_engine.py (PyInstaller entry: serve, --selfcheck, cli, mcp) -> src-tauri sidecar
```

## Rules that hold everywhere

- **The engine does the work.** Every capability is a route; the window, the command line and the MCP server are surfaces over it. A capability one surface has and another lacks is a bug: add the route, then the op in `cli.py`, then the pane.
- **The kit is vendored, not edited.** `contract/` is a byte copy of the Form Extension Contract kit; wrap it. A real gap goes to the kit first (the contract issues list), then is copied here.
- **Paths stay safe.** All project file access goes through `workspace` (`clean_rel`, `safe_join`): no `..`, no absolute paths, no symlinks out.
- **Zero flash.** Every pane container exists in its final layout before the first paint and is filled in place; the window is revealed after the first pane mounts. Every `z-index` is a layer token from `frontend/src/styles/tokens.css`; icons are inline `currentColor` SVG.
- **Surgical edits.** Hand-made edits, one region at a time; no codemods or scripted text replacement. No emoji, no em dashes in Markdown, no commented-out code, near-zero comments: the reasoning goes in the HASHOUT logs.
- **Read the logs first.** `backend/HASHOUT_LOG.md`, `frontend/HASHOUT_LOG.md`, `src-tauri/HASHOUT_LOG.md` and each module's own `HASHOUT_LOG.md` in its pane folder.
- **Keep the agents in step.** After changing an op in `cli.py`, run `./formext agents sync` (regenerates the harness's `references/tools.md` and mirrors every skill to `.agents/skills`; `--check` fails on drift). `./formext agents install` sets the MCP servers and skills up for the user account. The skills copied from the Form apps are recorded in `.claude/skills/HOSTS.md` and are never edited here.
- **Versions** are `X.YY.Z`; `backend/app/__init__.py`, `frontend/src/shell/version.ts`, `frontend/package.json` and `src-tauri` carry the same one.
- **Commits** as `nodemode-ai <mackin@nodemode.ai>` only, no trailers of any kind (see `CLAUDE.md`).

## Run it

```bash
./formext_oc_install              # backend venv and interface packages
./formext boot                    # engine on 127.0.0.1:8640 and interface on localhost:5640
./formext serve                   # the built interface served by the engine on 8640
./formext cli status              # the command line
./formext mcp                     # the MCP server on stdio
./formext doctor                  # toolchain, installs and ports
FORMEXT_HOME=/tmp/fx ./formext cli new "Probe" --app formcut   # a scratch data folder
```
