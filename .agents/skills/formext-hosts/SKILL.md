---
name: formext-hosts
description: "Knows the twelve Form host apps an extension can be made for (formvis, formcut, formwav, formpdf, formdeck, formlit, form.md, formencoder, formvfx, formMCP, formtray, formskills): what an extension may read and change in each app, where its panels and commands appear, which host skill to load to understand the app, and how to test live (Run in App through FormPortal, the app's own MCP tools through formMCP). Use when the person says make a FormWav extension that does X, or any app-specific extension request, or asks what an app lets an extension do, or wants an extension tried in the real app. Load formext-harness for the build loop and this skill for the app."
---

# formext-hosts

The build loop is `formext-harness` (new, write, validate, preview, package, run_in_app). This skill adds the app: what the extension can touch, which skill teaches the app, and how to try it live.

## Loop for "make a [App] extension that does X"

1. Find the app's row in `references/apps.md`. Read the app's page with the formext `docs` tool (`docs {topic: "formwav"}`) and the contract through `docs`.
2. Load the host skill named in the row (it is already in `.claude/skills`). It explains the app's own model, commands and tools. For apps with no host skill, rely on the app page and on `app_tools` through formMCP when it is installed.
3. Start the project with `new` for that app, `write` the manifest and code, then `validate` and `preview`. The preview is a simulated host: it proves the contract, not the real app.
4. Ask the person, then `run_in_app {id}` (FormPortal's `dev.json`). The app loads it as a development extension and rechecks within 2 s of each change. Read `host` in the answer: ready, or refused with the reason.
5. Prove it in the real app. The app asks the person to allow the permissions the first time a version opens or runs; say so and wait.
6. When done: `run_in_app {id, remove: true}`, then `package`, `sign`, `publish` as `formext-harness/sub-skills/ship` says.

## Test live

- Run in App needs the app installed by FormPortal (`apps` lists it). If `app.installs` is empty the entry is written and the app picks it up once installed.
- Use the app's own tools to look at the result. With formMCP installed (`formmcp` on the path; `./formext agents status` says), call `app_tools` for the app and `call_app` for its tools (`extensions_list`, `extension_command`, and the app's document tools). Load `formmcp-harness` first. Without formMCP, the app's command line does the same (`./formwav cli extensions`, and the like) when it has one.
- An agent run of `extension_command` needs the app window open; consent shows in that window.
- Never call a tool that changes the person's document or files without asking. A document op is one undoable step in the app; say what you will change first.

## What every host shares

The same manifest, sandbox and permissions (`contract/CONTRACT.md`). The `document` permission gates `document.read` and `document.apply`; `app.run` runs the app's command catalogue; `files-read` and `files-write` go through the app's own dialogs; `net` goes through the host. What `what` values, ops and commands exist differs per app and is in the table. Ids and counts above the app page's own list are not guessed: read the page.

## Gaps

form.md, formtray and formskills have no host skill yet. The table still gives their surface from the app pages. `.claude/skills/HOSTS.md` records where each host skill came from and the commit. Host skills are copied unchanged: report a problem in them to the app's repository, not here.
