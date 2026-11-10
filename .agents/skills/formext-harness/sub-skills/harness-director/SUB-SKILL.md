---
name: harness-director
description: Entry point for making a whole Form extension with form.ext, from an idea to a package. Use for a brief such as make a formcut extension that marks the beats, add a panel to formpdf that numbers pages, port this extension to another app, or any request that spans writing, checking, running and shipping; it fixes the plan, orders the work, keeps a ledger and decides when the extension is done.
---

# harness-director

An extension goes wrong in one of three places: code written against an API the app does not have, a sandbox rule that silently stops the page (an inline script, a `fetch`, a missing file), or a package reported as working that never ran in a host. The order below closes all three.

## 1. Intake

Settle these before the first change. Ask in plain prose only for what the request leaves open and a wrong guess would waste work; otherwise choose and say which.

- **The app**: one product id. An idea for several apps is one project per app.
- **What it does**, in one sentence: that sentence becomes the manifest's `description`.
- **Its shape**: a dock panel, a dialog, a headless command, or a panel with commands. Pick the starter that matches (`templates {product}`).
- **What it needs**: the document only, files the person picks, saving files, the network. Each is a permission and a consent line the person will read.

## 2. Read before writing

1. `docs {topic: "[product]"}`: the document snapshot, the ops (`document.apply` commands with their args), `app.run` commands, and the events. Note the exact command ids and fields you will use.
2. `source {app: "[product]"}`, then read the `docs` files and `extension_host` files it names and `source_search` the commands and fields from step 1. Note the exact command ids and fields from the code, and the commit (`host-source` has the recipes).
3. `templates {product}` and, after `new`, `read` the starter's `ui/app.js`: it already reads the document and runs a real command, so extend it rather than starting blank.

## 3. Plan

Write a short plan in the reply before editing:

```text
app       formcut, starter panel-commands, id beat-markers
source    formcut at commit a1b2c3d, ops and commands confirmed in backend/app/extensions.py
reads     document.read "project": timeline.tracks[].clips[], selection.clipId
does      app.run media.beats {mediaId}; document.apply "Beat markers" [marker.add {t, note}]
contributes panel main (dock), command open-beats (panel main), command mark-beats (headless)
permissions document
```

## 4. Build order

1. `new {name, product, starter}`.
2. Edit `ui/app.js`, `ui/index.html` and the manifest (`manifest {id, set}`); keep `formext.js` and `kit.js`.
3. `validate {id}` after every meaningful change; fix every error and read every warning.
4. `preview {id}`: state ready, frame headers ok, no missing assets, the consent words match the plan.
5. Tell the person to open the Preview pane (or `run_in_app` with their consent) to see it run; report what they or the app showed, never what you expect it to show.
6. `package {id, reproduce: true}`; then `sign` and `publish` when asked.

## 5. Ledger

On long jobs keep a ledger in replies:

```text
project  beat-markers (formcut) /data/projects/beat-markers
source   formcut a1b2c3d ready, media.beats and marker.add found in the code
checked  validate 0 errors 1 warning (unused-permission files-read, removed)
preview  ready, 3 assets served, consent: read and change the open document
next     package, then run_in_app after the person agrees
```

## 6. Done means

- `validate` reports zero errors, and every warning was fixed or explained.
- `preview` reports state ready, `headers_ok`, no `missing` and no `inline_script`.
- The manifest's permissions are exactly what the code calls, and its description is the one sentence from intake.
- When packaged: the SHA-256 and size are reported, and `reproduce` agreed.
- The reply says which commit of the host source the code was written against.
- The reply lists the project id and folder, what was checked and how, what was not (for example not run in the real app), and the package path when there is one.

## When to load the others

`writing-extensions` for the code and manifest, `check-and-preview` for verification, `ship` for Run in App, packages, keys and publishing, `session-and-connection` when a tool fails to reach the engine.
