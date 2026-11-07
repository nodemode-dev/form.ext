# Agents

form.ext's engine does every step a person does, so agents make extensions the same way: from a starter, through Check and Preview, to a signed package in the app.

## The command line

`./formext cli` covers the path: `docs` and `templates` (what each app offers), `new NAME --app formcut --starter panel`, `read`, `write` and `manifest`, `validate` (Check), `preview` (a snapshot of what a host would load), `package` (`--anyway` past code-lint errors), `import` (a folder or a `.formpkg`), `keys`, `sign`, `verify`, `entry`, `run-in-app` (add to or remove from `dev.json`), `publish` (the submission folder, `--formportal` to send it on) and `submit` (the folder in form.ext-registry's layout, the registry's checks, and the `git` and `gh` commands for the pull request; `--checkout` names a local clone of the registry). `./formext cli --help` lists every command. Answers are short text, or JSON with `--json`; failures exit non-zero with the reason in plain words. It uses a running engine with the same data folder, or runs in-process. The desktop app's frozen engine takes the same commands (`formext-engine cli ...`).

## The MCP server

`./formext mcp` serves MCP on stdio. `.mcp.json` registers it for Claude Code in this repository, `.codex/config.toml` for Codex and `.cursor/mcp.json` for Cursor. Its tools are the command line's commands under the same names (`run_in_app` with an underscore), and its resources `formext://docs/<topic>` serve the contract, the SDK source, the schema, the example and each app's API page. What an agent does appears in the open window at once through the engine's live events.

## The skills

- `.claude/skills/formext-harness`: using form.ext through MCP to make an extension for any Form app, from choosing the app's API calls to a signed package.
- `.claude/skills/formext-skillset`: changing form.ext's own code (the panes, the engine modules, the contract kit rules).

## Extensions and agents in the apps

Every host with an MCP server or command line also offers `extensions_list` and `extension_command` (contract section 8), so an agent can run an extension's commands in the app, under the same consent rules as a person.
