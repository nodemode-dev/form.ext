---
name: formmcp-harness
description: Find the Form family app that fits a task through formMCP, and drive it through its own tools when it is reachable. Use when the person wants something a Form app does (edit a picture, cut a video, mix audio, lay out a page, draw vector art, take notes, make slides, encode media, manage a library) and formmcp tools are available, or formMCP or the Form family is mentioned. Not for installing apps (FormPortal does that) and not for changing formMCP's own code (read CLAUDE.md).
---

# formMCP harness

formMCP is one MCP server for the whole Form family. It keeps the conversation small: an app costs one line until it is needed, and an app's own tools are loaded only for the app the task needs.

## The tools

| Tool | Changes anything | What it does |
| --- | --- | --- |
| `family_apps` | no | every Form app: `id`, `name`, `kind`, a one-line `summary`, `mcp` (it has an MCP server), `state` (`live`, `public`, `prelaunch`), `installed` (by FormPortal on this computer) and `reach` (`dev`, `formportal`, or null: how formMCP can start its server here); `mcp_only: true` keeps the apps with a server |
| `suggest_app` | no | the person's `task` in their words in, up to five apps out (best first), each with `installed`, `reach` and `next`: call `app_tools`, install it with FormPortal, install FormPortal first, or why an agent cannot drive it yet |
| `app_tools` | no | starts one app's own server (or reuses it) and returns its tools with input schemas, its name and version, and its instructions; `refresh: true` asks again |
| `call_app` | what the app's tool changes | runs one of that app's tools with `arguments` and returns the app's own result unchanged |
| `app_resources` | no | the resources one app offers (each with a `uri`) and its resource templates; empty with a note when it offers none |
| `read_app_resource` | no | one resource's contents by its `uri`, as the app sent them |
| `app_prompts` | no | the prompt templates one app offers, with their arguments |
| `get_app_prompt` | no | one prompt filled with its `arguments` (strings): the app's messages, ready to follow |

## Workflow

1. Call `suggest_app` with the task in the person's words, and follow the first suggestion's `next` unless a later one clearly fits better. Use `family_apps` (once per conversation) when the person wants the whole family or `suggest_app` finds nothing. If two apps fit, name both and say how they differ.
2. If the app has `reach`, call `app_tools` for that one app, read its instructions and the tool you need, then `call_app`. Load another app only when the task moves to it.
3. Before a `call_app` that changes the person's files or computer (the app's tool is not read-only, or says so), say what will change and get their go-ahead. The app's own tool descriptions and annotations decide this, not formMCP's.
4. If the app has no `reach`: when `installed` is false, say which app fits and that FormPortal (`id` `formai`) installs and updates the Form apps; formMCP never installs. When `installed` is true but `reach` is null, FormPortal could not be found to start it, or the app's install names no launcher yet; say so plainly.
5. When `app_tools` or `call_app` fails, the message carries the app's own last output. Pass on what it asks for (for example form.md asks for `FORMMD_MCP_TOKEN`, a personal API token from its Account settings, which the person keeps in formMCP's Safety panel or with `formmcp cli secret set formmd FORMMD_MCP_TOKEN`; never ask them to paste it into the chat) instead of retrying.

6. An app missing from `family_apps`, or refused as "turned off" for this agent, and a tool missing from `app_tools` (listed in `hidden`) or refused in `call_app`, were turned off by the person in formMCP's window, directly or through a profile the message names. Say so and suggest they turn it on there; do not look for a way around it.
7. When `app_tools` shows `offers.resources` or `offers.prompts`, the app's own documents and prompt templates are reachable through `app_resources` and `read_app_resource`, `app_prompts` and `get_app_prompt`; read what the task needs rather than everything.
8. Tools named `<id>__<tool>` (for example `formai__status`) are an app's own tools that the person chose to always show; they behave as `call_app` with that app.
9. `source` in `family_apps` says whether the list is the signed family catalogue or the bundled list, and why; mention it only when it matters (a newer app the person names is missing, for example).
10. "[redacted by formMCP]" in a result stands for a secret or token formMCP hid; work without it. A call refused by "formMCP's before-call hook", or an app "not started" because its installed files changed, was stopped by a rule the person set or by formMCP's check: tell them the reason as given and do not retry around it.

## formMCP's own extensions

`extensions_list` and `extension_command` are about extensions installed in formMCP itself (by FormPortal, or from a folder by form.ext), not about the other apps. `extensions_list` gives each one's `state` (`ready`, or `refused` with the `reason`), its permissions and its `commands`; `extension_command` (`id`, `command`, `args`) runs one in the formMCP window. The window must be open ("open FormMCP and ask again" otherwise), and the first run of a version asks the person there to allow it; a refusal fails the call, so do not retry it. A command can change formMCP's settings (apps and tools on or off, start policies, profiles): say so and get the go-ahead first. Without MCP: `./formmcp cli extensions` and `./formmcp cli extension <id> <command> [args JSON]`.

## formMCP's demos

When the person wants to see what formMCP does, `demo_open` (`id`: `window`, `connect` or `safety`) opens one of its three demos in a window of its own beside formMCP's window, which must be open. `window` shows every Form app, the per-agent switches and the Lab (suggest, console, redact, three replayed flows); `connect` shows the config written for Claude Code, Codex and Cursor, HTTP with its token and refusals, and what each agent sees; `safety` replays a recorded session against the Safety settings, hooks, tracing and the file check. A demo is a sandboxed copy in a prepared state with no access to formMCP's commands, so it changes nothing; it needs no go-ahead. In the window they are under the Demos button, and on macOS in the Help menu.

## Without MCP

`./formmcp cli apps` (and `--mcp-only`) prints the list as JSON; `./formmcp cli app <id>` one app; `./formmcp cli reach` how each app would be started here; `./formmcp cli suggest <task>` the suggestions; `./formmcp cli catalog` where the list comes from; `./formmcp cli expose <id> on|off` always show an app's tools; `./formmcp cli for <agent> <id> on|off` and `tool <id> <tool> on|off` turn an app off for one agent or one tool off for all; `./formmcp cli agents install` adds formMCP to Claude Code, Codex and Cursor for the user account; `./formmcp cli serve` serves the same tools over HTTP on this computer (`http token` gives the access token).
