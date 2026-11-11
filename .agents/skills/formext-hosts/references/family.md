# How the Form family fits together

Read this when a task crosses tools: which one tells you what an app allows, which drives the app, which installs, which publishes. The per-app facts are in `apps.md`, the code locations in `sources.md`.

## The pieces

- **The apps.** Twelve host apps load extensions written to the Form Extension Contract: formvis, formcut, formwav, formpdf, formdeck, formlit, form.md, formencoder, formvfx, formMCP, formtray and formskills. Most have their own MCP server and a skill that teaches an agent to drive them.
- **FormPortal** installs and updates the apps and the extensions, rolls them back, and owns each app's `enabled.json` (which extensions are on). It is not a host.
- **form.ext** (this tool) makes extensions: new, write, validate, preview, package, sign, publish. For Run in App it writes `extensions/[product]/dev.json` in FormPortal's folder, and the app loads that folder as a development extension.
- **The Form Extension Registry** (`nodemode-dev/form.ext-registry`) holds the official extensions and publishes the signed index that FormPortal and form.ext read. `submit` prepares, and with `pull_request` opens, the pull request that adds an extension.
- **formMCP** is the hub. One MCP server (`formmcp mcp`) reaches the own MCP tools of each installed app, so an agent sees one short list and loads one app's tools when a task needs them.
- **FormSkills** shows and installs the apps' released skills into Claude Code, Codex or Cursor. It has no MCP server; its command line is `formskills-cli`.

```text
   you / agent
     |
     +-- form.ext --writes dev.json--> FormPortal folder --> the app loads it (Run in App)
     |      |  \-- submit --> Registry (pull request, checks, signed index) --> FormPortal installs
     |      \----- source / skills --> app source on disk, skills of each app
     |
     +-- formMCP --app_tools / call_app--> each installed app's own MCP server
     |
     +-- FormSkills (formskills-cli) --installs--> Claude Code skills folder
```

## Which tool for which job

| Job | Use |
| --- | --- |
| Know what an extension may call in an app | `docs {topic: [product]}`, then `source` (and `source_read`, `source_search`) for the app's code |
| See every app at a glance, and what is installed here | `family` |
| Drive the real app to test an extension | the app's skill, plus formMCP `app_tools` and `call_app` |
| Load the extension in the real app | `run_in_app` (the person allows its permissions in the app) |
| Get the skills that teach an app | `skills {app}`; `install: true` after asking |
| Publish officially | `submit`; `pull_request: true` only after asking, it posts under the person's GitHub account |
| Install or update the apps themselves | FormPortal, with `formportal-harness` |

## How formMCP is connected

- form.ext's `.mcp.json` lists a `formmcp` server next to `formext`, and Claude Code started from the Studio adds the `formmcp` server when formMCP is installed (`./formext agents status` says).
- Its tools: `family_apps`, `suggest_app`, `app_tools`, `call_app`, `app_resources`, `read_app_resource`, `app_prompts`, `get_app_prompt`, `extensions_list`, `extension_command`, `demo_open`.
- Typical test: `app_tools` for the app, then `call_app` for its tools, then `extensions_list` and `extension_command` for the extension. Load `formmcp-harness` first.
- It does not list form.ext itself, and it does not handle skills. Its family list has 24 apps; formskills and formtray appear with no MCP server.

## How FormSkills is connected

- No MCP server. form.ext's `skills` tool runs `formskills-cli` when it is on the computer and reports three places: `here` (bundled with form.ext), `source` (in the pulled app source) and `released` (through `formskills-cli`).
- FormSkills names FormDeck `formslide` and FormPortal `formai`; the `skills` tool translates, so pass form.ext's product ids.
- `checkout: true` has FormSkills read the pulled sources instead of the releases.
- form.ext's own skills are not in FormSkills's catalogue. Install them with `./formext agents install`.

## What is not connected

- formMCP cannot drive form.ext, formskills or formtray: form.ext has no entry in its list, and the other two have no MCP server. For those, use the API page and `source`, and the app's command line where it has one.
- FormSkills cannot install form.ext's skills.
- Form.md has no skill that drives it; form.md, formtray and formskills are learned from the API page and `source`.
- Nothing here installs an app for you: FormPortal does that.

## A typical run

1. `family`: confirm the app, see that formMCP and FormPortal are present, see whether the source is pulled.
2. `docs {topic: [product]}` and, where it is thin, `source` then `source_read` of `docs/EXTENSIONS.md`.
3. `new`, `write`, `validate`, `preview`: the simulated host proves the contract only.
4. Ask the person, then `run_in_app`; test with the app's skill and formMCP `call_app`.
5. `package`, `sign`, `publish`; for an official listing, `submit {ready: true}` first, then ask before `pull_request: true`.

## When something is not installed

- No formMCP: skip `app_tools` and `call_app`; use the app's own command line (`./formwav cli extensions` and the like) or the app window. `family` says whether formMCP is present.
- No FormSkills (`formskills-cli`): `skills` still reports `here` and `source`; `released` carries an error or is empty, and the skills come from the app's pulled source.
- No FormPortal: Run in App still writes `dev.json`; the app picks it up once it is installed.
- No git: `source` downloads an archive instead.
- No git or `gh` signed in: `submit {ready: true}` says so; do the steps by hand from the commands `submit` lists.
- No network: `source {action: "status"}` shows what is already pulled; pulling and updating need the network.
