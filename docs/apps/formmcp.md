# Extensions in formMCP

formMCP loads extensions made to the Form Extension Contract, API 1 (`api: "1"`, product id `formmcp`). FormPortal installs them, form.ext makes them, formai.studio lists them. This page is what an extension can rely on in formMCP. The contract itself is the Form Extension Contract kit's `CONTRACT.md`.

formMCP has no open file. Its "document" is the state the person edits in the window: the Form family list, which apps are offered to which agent, which apps always show their tools, each app's start policy, single tools turned off, and profiles. An extension reads that state and changes it through the window's own commands, so it can never do more than the window does, and less: the safety settings, secrets, hooks, tracing, the HTTP token, agent connections and exports are not open to extensions.

## `document.read`

`{ what? }`. `what` is one of `all` (the default), `apps`, `agents`, `profiles`, `http`, `selection`; formMCP has no open file, so the contract's optional `file` (and any other value) answers -32602. `all` returns every key below; the others return `app`, `version`, `live` and that one part.

```json
{
  "app": "formmcp",
  "version": "0.9.0",
  "live": true,
  "selection": { "agent": "claude", "filter": "all" },
  "apps": [
    {
      "id": "formcut",
      "name": "FormCut",
      "kind": "video",
      "summary": "Video editor: cut, trim, titles and export.",
      "mcp": true,
      "state": "live",
      "installed": true,
      "version": "2.13.3",
      "reach": "formportal",
      "exposed": false,
      "on_for_agent": true,
      "off_for": [],
      "profile_off_for": [],
      "start": "demand",
      "hidden_tools": 0
    }
  ],
  "agents": [
    { "client": "claude", "label": "Claude Code", "state": "connected", "profile": null },
    { "client": "codex", "label": "Codex", "state": "not-connected", "profile": null },
    { "client": "cursor", "label": "Cursor", "state": "no-client", "profile": null },
    { "client": "other", "label": "other agents", "state": null, "profile": null }
  ],
  "profiles": [{ "name": "quiet", "apps_off": 3, "tools_off": 0, "starts": 1, "used_by": ["codex"] }],
  "http": { "running": false, "port": 5625, "address": "http://127.0.0.1:5625/mcp" },
  "source": "bundled list from nodemode-dev/formcompiler 0.6.1 (f0e3201)"
}
```

- `apps` lists all 24 family apps in the window's order. `on_for_agent` is for the agent in `selection.agent`; `off_for` names the agents the person turned the app off for, `profile_off_for` the agents whose profile turns it off. `start` is `demand`, `session` or `keep`. `hidden_tools` counts the app's tools turned off for every agent.
- `selection` is the window's Apps for picker (`claude`, `codex`, `cursor`, `other`) and its filter chip (`all` or `mcp`).
- `live` is false in a browser preview without the app: then `apps` holds the bundled list only, without `installed`, `reach` or the switches, and `document.apply` answers -32003.

## `document.apply` and `app.run`

`document.apply({ label, ops: [{ command, args }] })` runs the ops in order as one step labelled `label`. formMCP has no undo history of its own, so the host makes the step whole: it keeps a copy of formMCP's settings before the first op, puts it back if any op fails (the call then fails with -32004 and that op's message), and after a step that changed something the filter row shows Undo, which puts the settings back as they were before the step. `app.run({ command, args })` runs one command; a command that changes settings is its own step, labelled with the command's title. Results: `{ applied, results }`, one result per op, each the window command's own answer.

`app.commands` returns this catalogue:

| Command | Args | Does | Result |
|---|---|---|---|
| `set_for` | `{ client, id, on }` | offer an app to one agent or not (`client`: claude, codex, cursor, other) | `true` when it is now on |
| `set_expose` | `{ id, on }` | always show that app's own tools in formMCP's tool list | the list of always-shown ids |
| `set_start` | `{ id, policy }` | when the app's server starts: `demand`, `session`, `keep` | the policy now |
| `set_tool` | `{ id, tool, on }` | offer one of an app's tools or not, to every agent | `true` when it is now on |
| `tool_list` | `{ id }` | the app's tools formMCP last saw, with `on` and `read_only` (reads only) | `{ app, loaded, tools }` |
| `tool_load` | `{ id }` | start the app once to list its tools (changes no settings, so it is not an undo step) | `{ app, loaded, tools }` |
| `profile_save` | `{ name, from }` | save one agent's settings as a named profile | the profiles |
| `profile_use` | `{ client, name }` | use a profile for an agent, `name: null` for none | the profiles |
| `profile_delete` | `{ name }` | delete a profile | the profiles |
| `select_agent` | `{ agent }` | change the window's Apps for picker | `{ agent, filter }` |
| `select_filter` | `{ filter }` | `all` or `mcp`, as the filter chips do | `{ agent, filter }` |
| `refresh` | `{}` | read this computer's state again (reads only) | the `all` snapshot |

App ids are the ids in `apps`. In `{ app, loaded, tools }`, `loaded` is when formMCP last listed the app's tools, in whole seconds since 1970-01-01 UTC (Unix time, not milliseconds), or `null` when it never has. An unknown command answers -32004 with "formMCP has no command NAME for extensions". `select_agent` and `select_filter` change only the window, not the settings, and are not part of an undo step.

## `ext.event`

| Name | Data | When |
|---|---|---|
| `document.changed` | `{ command }` | after any change to the settings: from the window, from an extension, or after a refresh found a change; `command` names what changed, `refresh` for a refresh |
| `selection.changed` | `{ agent, filter }` | the Apps for picker or the filter chip changed |

## Files and network

- `files.open`: yes. The window's own file chooser (the system one in the app, the browser's in a browser build), at most 200 MB in total.
- `files.save`: yes. formMCP has no save dialog, so it first shows its own dialog with the name asked for, which the person can change; Cancel answers -32002. Save puts the file in the Downloads folder under that name, with a number added when it is taken (`name (2).ext`, as formMCP exports profiles), and the status line names the place; in a browser build it becomes the browser's download.
- `net.fetch`: no, -32003. formMCP's window never reaches the internet itself.
- `storage.get` and `storage.set`: yes, 256 KB per extension, in the window.

## Where extensions appear

- **Extensions menu**: formMCP has no menu bar, so the Extensions button sits in the filter row beside Profiles and Safety. It opens a menu with one item per contributed command (`Name: Title`), then Extensions Panel, Reload Extensions and Manage in FormPortal.
- **Extensions panel**: a section under the filter row, like Profiles and Safety (opening one closes the others). One row per extension with name, version, source (Catalogue, File, Development), permission chips, state (Ready, Needs Permission, Refused with the reason), Open for its panels, and the folder of a development extension.
- **Contributed panels**: a `dock` panel opens in a section under the filter row, titled with the extension's name and the panel's title, with Close; one dock panel is open at a time. A `dialog` panel opens as a modal of the window's style.
- **Agents**: the MCP tools `extensions_list` and `extension_command`, and `formmcp cli extensions` and `formmcp cli extension <id> <command> [args JSON]`. A command runs in the formMCP window, which must be open; the consent dialog shows there the first time.
- No command palette: formMCP has none.

## Running an extension from a folder

form.ext's Run in App writes `extensions/formmcp/dev.json` under FormPortal's folder (`FORMPORTAL_ROOT`, else `~/Library/Application Support/studio.formai.portal` on macOS, `%LOCALAPPDATA%\FormPortal` on Windows, `$XDG_DATA_HOME/formportal` or `~/.local/share/formportal` elsewhere):

```json
{ "format": "formext-dev-extensions", "format_version": 1, "product": "formmcp", "extensions": [{ "id": "my-extension", "path": "/home/me/my-extension", "added": "2026-11-07T10:00:00Z" }] }
```

formMCP checks that file and `enabled.json` every 2 s while its window has focus, and on Reload Extensions, and changes only the rows that changed. `formmcp cli extensions` prints what it finds and why it refuses one. FormPortal installs a package into its own folder and lists it in `extensions/formmcp/enabled.json`; formMCP reads it from there and never installs anything itself.

`minimum_app` is compared with formMCP's version (this round 0.9.0). Files are served from `formext://{id}/{version}/{path}` in the app and from `/api/extensions/files/{id}/{version}/{path}` in a browser build, with the contract's headers; the page runs in a frame with `sandbox="allow-scripts"` only.
