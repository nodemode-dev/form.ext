---
name: session-and-connection
description: "Connecting to form.ext: the formext MCP server, the ./formext cli command line, the engine (the open window or in-process), the data folder and FormPortal's folder. Use when formext tools are missing, a call says the engine is not answering, projects seem to be missing, the window does not show changes, or the setup for Claude Code, Codex or Cursor is needed."
---

# session-and-connection

## How the tools reach the engine

The server (`./formext mcp`) and the command line (`./formext cli`) call the engine's own HTTP routes, so they do exactly what the window does. On each call they pick the engine:

1. `--engine URL` or `FORMEXT_URL` when given.
2. Otherwise a running engine whose data folder is the same as theirs: the desktop app's (its port is in `engine.port` in the data folder) or `./formext boot`'s on 127.0.0.1:8640 (`FORMEXT_PORT` moves it).
3. Otherwise the engine's routes run inside the server process (`--local` forces this). The data folder is the same, and an open window picks up the files from disk; live events (the window refreshing at once) need the running engine. With no window open, only the 19 tools that read run. The 14 that change something are refused under the default Ask, because there is no window to ask in; the refusal says so and is not an error to retry. Ask the person to open form.ext, or to choose Allowed in Settings, Developer, Outside agents (only the window can change it). Under Blocked every change is refused.

`status` reports `engine.mode` (`http` or `in-process`), the URL, the data folder and which modules the engine has (check, new, preview, package, run, publish, sources). A module marked no is not in that build: its tools fail with a sentence naming the missing router.

## Setup

- Claude Code: `.mcp.json` in the repository runs `./formext mcp`.
- Any client: the command is `[repo]/formext mcp` (stdio, newline-delimited JSON-RPC 2.0, protocol 2025-11-25 down to 2024-11-05). The frozen desktop engine takes the same arguments: `formext-engine mcp`.
- The command line: `./formext cli --help`, `./formext cli [command] --help`. `--json` prints the raw answer; exit code 1 means the check found problems or the request was refused, 2 a usage error, 3 the engine failed.

## Folders

| Variable | What it moves |
| --- | --- |
| `FORMEXT_HOME` | form.ext's data folder (projects, builds, keys, submissions, settings) |
| `FORMEXT_URL` | the engine to talk to |
| `FORMEXT_PORT` | the port probed for a running engine (default 8640) |
| `FORMEXT_SOURCES_BASE` | another address to pull the host apps' sources from (default `https://github.com/nodemode-dev`) |
| `FORMPORTAL_ROOT` | FormPortal's folder, where Run in App writes `extensions/[product]/dev.json` |

Inside the data folder, pulled sources live in `sources/` and the registry working clone for pull requests in `registry-work/`.

Use a scratch `FORMEXT_HOME` and `FORMPORTAL_ROOT` for experiments, so the person's real projects and apps are untouched.

## When it fails

- "no such project": `projects` lists the ids; a project made with another data folder is not visible.
- "is not in this engine yet": the build lacks that module; tell the person which one.
- "no form.ext window is open to ask", "blocked", "did not allow" or "nobody answered": the outside-agents setting refused a change; say what the message says and stop. Do not retry unless the person asks.
- "stopped answering": the window closed during the call; call again.
- A tool that is not listed: the client loaded an old tool list; restart the MCP server.
