# Changelog

## v0.1.0 · 2026-11-07

The first release of form.ext, the Form family's extension studio: make, preview, check, package, sign and publish extensions for every Form app, against the Form Extension Contract, API 1.

- **Home and New:** recent projects, Open Folder, Import .formpkg and the examples; a new project for any of the twelve host apps from a panel, command, or panel-with-commands starter that reads the app's document and runs a real command.
- **Edit:** a file tree, a CodeMirror 6 editor, a manifest form in two-way sync with `manifest.json`, the permission picker in the contract's plain words, panels and commands editors, and an unsaved-change guard.
- **Preview:** the extension in a simulated host for its app, using the contract's own host bridge, with a realistic document, an event injector, a log of every message, and permission and consent toggles.
- **Check:** the schema, the kit's package rules, what an API 1 host accepts, and lint for what the extension sandbox blocks, each problem with its file, line and fix. Bundled, minified SDK code is read correctly, so every first-party extension checks clean.
- **Run in App:** writes FormPortal's `dev.json` for the app so the installed app loads the extension live, lists the installed Form apps and opens them.
- **Package and Sign:** the kit's deterministic `.formpkg` with SHA-256 and size, a byte-for-byte reproducibility check, Ed25519 publisher keys with an optional passphrase, signing and verification the way FormPortal checks it.
- **Publish:** the extensions index entry, a submission folder for formai.studio, and Send to FormPortal.
- **Library:** import and inspect any `.formpkg` safely, compare two builds, and an Examples shelf of the first-party extensions.
- **Docs:** the manual, the contract, the SDK reference and each app's extension API page in the window.
- **Agents:** the `formext` command line and an MCP server with 26 tools over the same engine, wired for Claude Code, Codex and Cursor, with the `formext-harness` and `formext-skillset` skills.
- **SDK:** `@formai/ext` 0.1.0 in `sdk/`.
- **Desktop and demo:** a Tauri 2 shell with the family splash, and an offline browser demo of the real interface in `demo/`.
