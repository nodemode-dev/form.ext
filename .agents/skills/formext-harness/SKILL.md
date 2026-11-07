---
name: formext-harness
description: Makes extensions for the Form apps with form.ext through its formext MCP server or the ./formext cli command line. Use whenever the person wants an extension, plugin, add-on, panel or command made, changed, fixed, checked, previewed, packaged, signed, loaded in a running app or published for formvis, formcut, formwav, formpdf, formdeck, formlit, form.md, formencoder, formvfx, formMCP, formtray or formskills; asks what an extension may do in the sandbox or which permission it needs; has a .formpkg, a manifest.json or an extension folder to work on; wants an index entry or a formai.studio submission; or when formext tools such as status, new, write, validate, preview, package, sign, run_in_app or publish are available or fail. Not for changing form.ext's own source code (use formext-skillset) and not for installing finished extensions from the catalogue (use formportal-harness).
---

# formext harness

form.ext is the Form family's extension studio. Its engine keeps extension projects in its data folder, checks them against the Form Extension Contract (API 1), previews them in a simulated host, builds deterministic `.formpkg` packages, signs them with Ed25519 publisher keys, writes FormPortal's `dev.json` so the real app loads the project live, and prepares the formai.studio submission. The MCP server, named `formext`, exposes all of that as tools; `./formext cli` is the same surface on the command line (each tool is a command with the same name, dashes for underscores).

When the form.ext window is open, the tools talk to its engine and every change appears in the window as it happens. When it is closed, the tools run the engine's routes inside the server process against the same data folder. `status` says which.

## The model

- A **project** is a folder with `package/` (the package root: `manifest.json`, `ui/index.html`, scripts, styles, assets) and sources and notes beside it. A linked folder opened in place may have its package at its root: `files` reports `package_prefix`. Every path a tool takes is relative to the project folder, such as `package/ui/app.js`.
- An **extension** is a web page (`entry.ui`) the host app loads in a sandboxed frame (`sandbox="allow-scripts"`, opaque origin, a strict CSP with `connect-src 'none'`). Its only channel is JSON-RPC over `postMessage` through the SDK (`ui/formext.js`): `readDocument`, `apply`, `run`, `commands`, `openFiles`, `saveFile`, `fetch`, `notify`, `storageGet`, `storageSet`, `done`.
- It **contributes** dock or dialog panels and commands; a command without a panel runs headless and ends with `done`.
- It asks for **permissions**: `document` (read and change the open document), `files-read`, `files-write`, `network`, `models`. The host shows a consent dialog in those words before the frame exists.
- Each app documents its own **document snapshot, ops and events** in its extension API page: `docs {topic: "[product]"}`. Code for an app is written against that page, never from memory.

`references/concepts.md` has the contract rules that cost the most time when missed.

## Start every job

1. `status`: the engine, the data folder, which modules this engine has, and the projects.
2. `docs {topic: "contract"}` once per session, and `docs {topic: "[product]"}` for the app the extension is for.
3. `templates {product}` to see the three starters for that app (panel, command, panel-commands), each already working against the app's real API.

## The loop

1. **Make**: `new {name, product, starter}`, or `import {path, link}` for an existing folder.
2. **Write**: `read` and `write` the files, `manifest {id, set}` for manifest changes (a merge patch).
3. **Check**: `validate {id}` until it reports no errors. Each problem has file, line, rule and fix.
4. **Look**: `preview {id}` says whether a host accepts it, which frame it loads with which headers, the consent words, the panels and commands, and whether every file the page references is served. The person sees it running in form.ext's Preview pane.
5. **Run in the real app** (ask first): `run_in_app {id}` adds it to FormPortal's `dev.json`; the app picks it up while it runs and reloads it on every save.
6. **Ship**: `package {id, reproduce: true}`, `keys`, `sign`, `verify`, then `publish {id}` for the formai.studio submission folder (and `formportal: true` to install it, after asking).

## Routing

| The job involves | Load |
| --- | --- |
| A whole extension from an idea, several apps, or anything broad | `sub-skills/harness-director/SUB-SKILL.md` |
| Connecting: the MCP server, the command line, the engine, the data folder, errors that mention the engine | `sub-skills/session-and-connection/SUB-SKILL.md` |
| Writing the code and manifest: the SDK, the sandbox, panels, headless commands, document ops, events, permissions, theming | `sub-skills/writing-extensions/SUB-SKILL.md` |
| Checking and previewing: validate rules, preview snapshot, what counts as verified | `sub-skills/check-and-preview/SUB-SKILL.md` |
| Run in App, packaging, keys, signing, index entries, publishing, sending to FormPortal | `sub-skills/ship/SUB-SKILL.md` |

## Rules that hold everywhere

- **The app's API page decides.** Commands, document fields and events come from `docs {topic: "[product]"}` or the starter that already uses them. An op the app does not have fails with -32004 in the real app even when the preview simulates something close.
- **Verify before you claim.** Only `validate` with zero errors and a `preview` with state ready and no missing assets count as checked. Never describe how the extension looks or behaves in an app you did not run it in; say what was checked and how.
- **Ask before touching what is outside the data folder.** `run_in_app` writes FormPortal's `dev.json`; `publish` with `formportal` installs the package; `delete` removes files. Name what will happen first.
- **Keep the manifest honest.** `api` stays `"1"`, `native` stays false, the `id` stays the project's id, and `permissions` lists exactly what the code uses: Check flags both directions.
- **Never package anyway without saying so.** `package {anyway: true}` ships code errors; contract errors are always refused.
- **Secrets stay out of replies.** Key passphrases go into tool arguments, never into the conversation, a file or a manifest.

## References

| File | What it holds |
| --- | --- |
| `references/concepts.md` | Projects and paths, the contract rules that matter most, errors and what they mean: read once per session |
| `references/tools.md` | Every MCP tool with its arguments and the matching command (generated by `./formext cli agents-sync`) |
