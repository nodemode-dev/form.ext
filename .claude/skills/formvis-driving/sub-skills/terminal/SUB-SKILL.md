---
name: terminal
description: Terminals, shells and running commands in relation to formvis when an agent is driving it. Use when the person asks for a terminal inside formvis, to run a shell command from formvis, to have formvis start Claude Code, or asks how to start, stop or reconnect formvis itself so the MCP tools work. formvis has a terminal dock (Mod+J) for the person but no MCP terminal tool; this explains how to start the engine, what to ask the person to run, and the command line that runs formvis commands.
---

# terminal

The formvis window has a terminal dock (Window > Terminal, Mod+J), a Claude Code panel and Agent Connect for the person, but the MCP catalogue has no terminal or shell tool: an agent drives formvis through the picture tools and the command tools (`list_commands`, `describe_command`, `run_command`, `run_commands`). Do not claim to run shell commands "inside formvis". From a shell, `./formvis cli` lists and runs the same commands against the open window.

## What the person may need to run

These are commands for the person to run in the formvis folder, or for you to run in your own shell only when you have a shell tool and the person has asked.

| Goal | Command |
| --- | --- |
| Start formvis (engine and web window) for development | `./formvis boot` |
| Start the engine serving the built app, one process | `./formvis serve` (after `./formvis build`) |
| Check the machine is ready | `./formvis doctor` |
| Connect Claude Code, Codex and Cursor to formvis for this user | `./formvis agents install` (add `--dry-run` to see what it would do first) |
| Run the MCP server as a client would (stdio) | `./formvis mcp` (it starts the engine if none is running) |
| Windows | the same commands as `formvis.bat boot`, `formvis.bat install` |

`./formvis mcp` is what `.mcp.json`, `.cursor/mcp.json` and `.codex/config.toml` already run, so inside the formvis repository the tools connect without setup. The engine listens on `http://127.0.0.1:8190`; `GET http://127.0.0.1:8190/api/mcp/status` reports `live` (a window is polling), `allowed` (outside agents are on) and the tool count.

## Reconnect checklist when the tools do not respond

1. Call `get_document`. If it works, the problem is not the connection.
2. "formvis is not open": ask the person to run `./formvis boot` or open the formvis app; formvis may also open a browser tab by itself.
3. "did not allow outside agents": ask them to allow it in the formvis window (the question appears once) or in Preferences > Plugins > Allow outside agents. A refusal holds for ten minutes.
4. No formvis tools at all: the MCP server is not registered in this client. Ask the person to run `./formvis agents install`, then restart the client.
5. "formvis did not answer in time": the window is busy with a long task; wait and retry once.

## What to say when asked for more

- A shell inside formvis, or formvis launching an agent: the person has the dock and the Claude Code panel; those are theirs to use, not tools. The agent drives formvis through MCP. Offer to do the picture task directly with the tools.
- Scripting many pictures: formvis has batch processing and Actions in the window (File > Automate); an agent can instead repeat the tool recipe per file with `open_file` and `export_image`.
- For changing formvis's code to add such a feature, that is a development task: use `formvis-harness`.
