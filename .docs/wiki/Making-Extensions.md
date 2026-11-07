# Making Extensions

An extension is a folder with `manifest.json` at its root and a web page (`entry.ui`) that runs in a sandboxed frame inside one Form app. A form.ext project keeps that folder as `package/`, with notes and sources beside it that are never packed.

## Home

Recent projects, New Extension, Open Folder (a package or project folder, edited in place), Import .formpkg, a Start button per app, and the kit's examples.

## New

The twelve host apps, each with three starters: **Panel** (a docked panel that reads and changes the document), **Command** (a headless command in the app's Extensions menu) and **Panel with commands**. Every starter does one real thing with its app's API, asks only for what its code uses and passes Check clean. The detail card says what it asks for in the consent dialog's words, what it adds and which calls it makes.

## Edit

A file tree, a CodeMirror 6 editor (JavaScript, TypeScript, JSON, CSS, HTML, Markdown) and a manifest form that is the same thing as `manifest.json`: a form edit is a JSON edit in the file's undo history, and a typed JSON edit shows in the form. Permissions use the words of the hosts' consent dialogs; panels and commands are edited as lists, and renaming a panel renames it in the commands that open it. Unsaved work is guarded and kept across project switches; outside changes update clean files in place and offer Load Disk Version or Keep Mine for changed ones.

## Preview

The extension in a simulated host for its app, built on the contract's own host bridge: the real sandbox, messages, permission checks and time-outs, a realistic document per app, `document.apply` and `app.run` with undo, an event injector (`ext.activate`, `ext.event`, `ext.theme`, `ext.deactivate`), the consent dialog, per-permission toggles, sample files for `files.open`, downloads for `files.save`, `net.fetch` through the engine to public `https://` addresses, and a log of every message both ways. It reloads on save.

## Check

The manifest against the kit's package rules, the schema and the hosts' refusals; the code against the CSP and the sandbox (inline script, outside resources, direct network, `eval`, browser storage, dialogs and popups); permissions used but not declared and declared but not used; headless commands that never call `ext.done`; sizes. It runs on open, on F7 and after every save.

## Library

Import a `.formpkg` into a project with the kit's checks, inspect any package (manifest, files, hashes, permissions, determinism), compare two builds of a project or a build and the working files, and the Registry shelf: the extensions of form.ext-registry from its signed index (the signature checked with the registry keys compiled into the engine, `backend/app/registry_keys.txt`, plus `FORMEXT_REGISTRY_PUBKEY`), each with the Verified mark, its app, version, permissions and source link. Importing one downloads the package and checks its SHA-256 and publisher signature first. The index address is the setting `registry.url`, or `FORMEXT_REGISTRY_URL`.
