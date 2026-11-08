---
name: session-and-connection
description: How an agent reaches FormPortal. Use when the formportal MCP tools are missing or fail to start, the catalogue is refused or unreachable, the work should run offline or against a local, development or forked catalogue, or the formportal command line should be used instead of MCP.
---

# session-and-connection

## The pieces

- **The engine** is `formportal-core`, a Rust library. The window, the command line and the MCP server each load it; there is no service to start and nothing runs when they are closed.
- **The MCP server** is `./formportal mcp` (stdio). The first start compiles the server in release mode (a minute or two), later starts are instant. Logs go to stderr; stdout carries only JSON-RPC.
- **The command line** is `./formportal cli [command]` with the same surface as the tools; `references/tools.md` maps them.

## Configured clients

| Client | In this repository | For the user account |
| --- | --- | --- |
| Claude Code | `.mcp.json` | `./formportal agents install claude` |
| Codex | `.codex/config.toml` (trusted projects) | `./formportal agents install codex` |
| Cursor | `.cursor/mcp.json` | `./formportal agents install cursor` |

`./formportal agents install` sets all three up and copies this skill to `~/.claude/skills` and `~/.agents/skills`. `--dry-run` shows what it would change. Existing config files are backed up first.

## When the catalogue is refused or missing

Read `apps`' `catalog_error` and match it in `references/concepts.md`. Common cases:

- **Offline:** the last good catalogue is used automatically; say that the answer may be stale.
- **No trusted key:** a build made without `core/catalog_keys.txt` (formcompiler's catalogue key, compiled in) and without `FORMAI_CATALOG_PUBKEY` refuses a signed catalogue. State it plainly.
- **A local or forked catalogue:** pass `source` (an https address, `http://127.0.0.1:[port]/...`, or a file path with its `.sig` beside it) or set `FORMPORTAL_CATALOG`. A development catalogue is usually unsigned; only the person can accept it, by starting FormPortal with `FORMPORTAL_ALLOW_UNSIGNED=1`. The MCP tools ignore an `allow_unsigned` argument.

## A scratch install folder

For trying things without touching real installs, start the server with `FORMPORTAL_ROOT` pointing at an empty folder.
