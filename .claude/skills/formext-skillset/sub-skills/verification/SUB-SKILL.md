---
name: verification
description: "Checking a change to form.ext before reporting it: a scratch data folder, starting and stopping the engine and interface, the command line and an MCP client as quick end-to-end checks, headless Chrome against the real shell, zero-flash checks, the engine self-check, and the skill gates. Use before saying any form.ext change works."
---

# verification

## Scratch folders

Point `FORMEXT_HOME` and `FORMPORTAL_ROOT` at scratch folders for every check, so no real project or app is touched. `FORMEXT_PORT` moves the engine off 8640 when another one is running there.

## Engine changes

1. `backend/venv/bin/python backend/formext_engine.py --selfcheck` (every router imports, the kit is found).
2. The command line runs the routes in-process with no server at all: `./formext cli new "Probe" --app formcut`, `validate probe`, `preview probe`, `package probe --reproduce`, `run-in-app probe`, `publish probe`. Exit code 1 means the check found problems or a refusal; read the message.
3. For live events and the window: `FORMEXT_RELOAD=0 backend/boot_backend` (or `./formext serve` for the built interface), then the same commands talk to it over HTTP (`status` shows the mode).

## MCP changes

Drive the server with a real client over stdio (the `mcp` Python SDK's `stdio_client` and `ClientSession`, or a short JSON-RPC script): `initialize`, `tools/list`, a `tools/call` for each changed tool, an error case (unknown project) that must come back with `isError`, and an unknown tool that must be a protocol error. Then `./formext agents sync --check`.

## Interface changes

Build (`./formext build`), serve it from the engine, and check in headless Chrome against the real shell and engine: the pane's first paint is its final layout (no layout shift on load, on reload, or when a live event arrives), dark and light, no console errors. Screenshots go to the module's sidecar folder, not the repository.

## Skills

Run the skill creator's `validate_skill.py` on `.claude/skills/formext-harness` and `.claude/skills/formext-skillset`: zero FAIL.

## Shared machine

Start servers only on free ports, stop what you started as soon as the check is done, run one browser at a time.
