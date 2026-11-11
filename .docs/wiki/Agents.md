# Agents

form.ext's engine does every step a person does, so agents make extensions the same way: from a starter, through Check and Preview, to a signed package in the app.

## The command line

`./formext cli` covers the path: `docs` and `templates` (what each app offers), `new NAME --app formcut --starter panel`, `read`, `write` and `manifest`, `validate` (Check), `preview` (a snapshot of what a host would load), `package` (`--anyway` past code-lint errors), `import` (a folder or a `.formpkg`), `keys`, `sign`, `verify`, `entry`, `run-in-app` (add to or remove from `dev.json`), `publish` (the submission folder, `--formportal` to send it on) and `submit` (the folder in form.ext-registry's layout, the registry's checks run from form.ext's own copy of the registry, and the `git` and `gh` commands for the pull request; `--checkout` names your own clone of the registry instead, `--ready` reports whether git and `gh` are installed and signed in, `--pull-request` forks, pushes and opens the pull request in one step). It also has `family` (every Form app, with its repository and whether its source is here), `source [app]` (`--action get`, `status`, `update`, `remove` or `list`) and `skills [app]` (`--install`, `--project`, `--checkout`). `./formext cli --help` lists every command. Answers are short text, or JSON with `--json`; failures exit non-zero with the reason in plain words. It uses a running engine with the same data folder, or runs in-process. The desktop app's frozen engine takes the same commands (`formext-engine cli ...`).

## The MCP server

`./formext mcp` serves MCP on stdio. `.mcp.json` registers it for Claude Code in this repository, `.codex/config.toml` for Codex and `.cursor/mcp.json` for Cursor. Its tools are the command line's commands under the same names (`run_in_app` with an underscore), and its resources `formext://docs/<topic>` serve the contract, the SDK source, the schema, the example and each app's API page. What an agent does appears in the open window at once through the engine's live events.

The tools added for the apps' real source and for the registry:

| Tool | What it does |
| --- | --- |
| `family` | Every Form app an extension can be made for (id, name, repository, kind, API page, starters, skills bundled here, source state), and whether formMCP, FormSkills and FormPortal are on this computer. |
| `source` | `{app, action?}`: brings the app's source onto this computer (read-only). `action` is `get` (default), `status` (no network), `update`, `remove` or `list`. |
| `source_files` | `{app, under?, glob?, limit?}`: the files of a pulled source, with sizes. |
| `source_read` | `{app, path, start?, lines?}`: one file by lines (400 by default, 2000 at most). |
| `source_search` | `{app, query, glob?, regex?, case?, limit?}`: matches with file and line. |
| `skills` | `{app, install?, project?, checkout?}`: the skills that teach one app (bundled here, in the pulled source, released through formskills-cli). `install` asks the person first. |
| `submit` | Also takes `ready` (report what the one-step pull request needs), `pull_request` (fork, push, open it; it posts publicly, so ask first) and `checkout`. |

`docs` for an app answers from the app's pulled source (`docs/EXTENSIONS.md`) when that is newer than the bundled page, and its `from` field says so.

## Connect

`./formext claude` starts Claude Code in the repository with formext (and formMCP when found) connected. `./formext agents install` registers the MCP servers and copies the skills for your account in Claude Code, Codex and Cursor (`--dry-run` shows the changes; files are backed up first). `./formext agents status` reports what it found. `./formext agents sync` regenerates the tool reference and mirrors `.claude/skills` to `.agents/skills`; `--check` exits 1 on drift.

formMCP (`formmcp mcp`) is the family hub that reaches every installed Form app's tools. It is a separate app; when it is missing its entry shows as unavailable and the formext server still works.

## The skills

- `.claude/skills/formext-harness`: using form.ext through MCP to make an extension for any Form app, from choosing the app's API calls to a signed package.
- `.claude/skills/formext-hosts`: for each of the twelve host apps, what an extension can do, which host skill explains the app and how to test live through Run in App and formMCP.
- Host skills copied byte for byte from the apps (`formvis-driving`, `formcut-mcp`, `formwav-harness` and the others), with their source commits in `.claude/skills/HOSTS.md`.
- `.claude/skills/formext-skillset`: changing form.ext's own code (the panes, the engine modules, the contract kit rules).

## Working from the app's real source

The app's API page says what an extension may do. The app's source says how it does it. The loop:

1. `family` to see the apps and whether formMCP, FormSkills and FormPortal are here.
2. `source {app}` for the host app (a project id works too). It pulls the source if it is not here, and answers with `docs` (read these first), `extension_host` (the files that implement the contract in that app) and `skills`. The Studio has usually pulled it already when the project was made or opened.
3. `source_read` the docs and the host files; `source_search` for a command name, a document field or an event; `source_files` to find a folder.
4. `skills {app}` for the skills that teach the app. Ask the person before `install: true`.
5. Write the extension through the contract's calls only. The source is reference: it is never built or run, and it is not copied into the extension. GPL apps (formMCP, FormSkills, FormPortal) are for reading; copying their code would put the extension under the GPL.
6. `source {app, action: "update"}` when the app has moved on.

Claude Code started from the Studio gets the pulled source as an extra directory, so the app's own skills load there too.

## In the app

The Studio's bottom panel has Terminal, Claude Code and Chat tabs. They run in the open project's folder with these servers and skills, over local-only routes (127.0.0.1, session-guarded).

## Extensions and agents in the apps

Every host with an MCP server or command line also offers `extensions_list` and `extension_command` (contract section 8), so an agent can run an extension's commands in the app, under the same consent rules as a person.
