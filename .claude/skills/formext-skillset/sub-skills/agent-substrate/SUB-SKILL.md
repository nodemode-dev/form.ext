---
name: agent-substrate
description: "form.ext's agent surface: the formext command line and MCP server (backend/app/cli.py with the engine client and the op table, backend/app/mcp.py the stdio JSON-RPC server), how they reach the engine (a running engine with the same data folder, or the ASGI app in-process), .mcp.json, AGENTS.md, the formext-harness skill, its generated references/tools.md and the .agents/skills mirror. Use when adding or changing a command or MCP tool, when the MCP server misbehaves with a client, or when the harness skill drifts from the tools."
---

# agent-substrate

## One table, two surfaces

`backend/app/cli.py` holds `OPS`: each `Op` has a name, a title, a help sentence, its `Param`s (type, required, positional, enum, default, flag), `read_only` and `destructive`, and a `say` formatter for the command line. The command line builds its argparse commands from it (the op name with dashes) and the MCP server builds its tools from it (the op name, `inputSchema` from the params, annotations from the flags). So a new capability is one `op_[name]` function and one `Op` row; both surfaces get it.

Ops call the engine's routes only (never services directly), so the window, the command line and the MCP server always agree. Routes that belong to other modules are named in `ROUTES` and checked with `_need`, which fails in plain words when that module's router is missing from the engine.

## Reaching the engine

`Engine` picks, per call: `--engine` or `FORMEXT_URL`; else a running engine whose `/api/health` `home` is this process's data folder (the desktop engine's `engine.port`, then 127.0.0.1 on `FORMEXT_PORT`, default 8640), re-probed every 5 s; else the FastAPI app in-process through a small ASGI caller (`_asgi_call`, run with anyio), with `FORMEXT_WATCH=0`. HTTP goes through an opener with no proxy, since loopback must never reach a proxy.

## The MCP server

- stdio, newline-delimited JSON-RPC 2.0; protocol versions 2025-11-25, 2025-06-18, 2025-03-26 and 2024-11-05 (the client's when supported, else the newest).
- `initialize` answers tools and resources capabilities, `serverInfo` and short `instructions`, and warms the engine in a thread. `tools/list`, `tools/call`, `resources/list` and `resources/read` (`formext://docs/contract`, `sdk`, `schema` and each `docs/apps/[product].md`), `ping`, `prompts/list` (empty).
- Tool failures are results with `isError: true` and a JSON body `{error, data?, status?}`; an unknown tool is a -32602 protocol error. Successful results carry the JSON as text and as `structuredContent`.
- Only protocol messages go to stdout: `main` points `sys.stdout` at stderr before serving, so a stray print cannot corrupt the stream.

## Keeping the agents in step

After changing `OPS`, run `./formext cli agents-sync`: it regenerates `.claude/skills/formext-harness/references/tools.md` and copies the harness skill to `.agents/skills/formext-harness`. Then update the harness sub-skill that teaches the changed tool. `.mcp.json` runs `./formext mcp`; `AGENTS.md` points Codex and other agents at the harness and at this skillset.

## Skills

Both skills pass the skill creator's gates: name under 64 characters, description under 1024, no XML or HTML tags (use square-bracket placeholders such as `[product]`), no emoji, no em dashes, `SKILL.md` and `SUB-SKILL.md` spelled exactly, no README inside a skill folder. Run its `validate_skill.py` on both skill folders after editing them.
