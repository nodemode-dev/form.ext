# HASHOUT_LOG · Preview pane · form.ext

Living log of the Preview module: this pane, the simulated hosts in `frontend/src/sim/`, and the engine router `backend/app/routers/preview.py`. Source files stay comment-free; what they would have said lives here.

Current build version: v0.1.0
Last updated: 2026-11-07 · v0.1.0 preview

---

## Org-navi-map

```
frontend/src/panes/preview/
├── index.ts          the pane: layout, simulated app window, dialogs, side tabs, reload
├── log.ts            MessageLog: one row per message, expandable JSON, filter, copy
├── preview.css       pane styles (shell tokens; the stage uses --sim-* from the app's theme)
└── HASHOUT_LOG.md
frontend/src/sim/
├── index.ts          SIMS (the twelve hosts), simFor, re-exports
├── types.ts          AppSim, SimCmd, SimEvent, SimOffers
├── host.ts           SimHost: wraps the kit's ExtensionHost, holds the document, undo, events, log
├── tokens.ts         the contract's theme tokens per app and mode
├── samples.ts        sample files for files.open (CSV, BibTeX, PNG, WAV, PDF with fields, ...)
├── util.ts           errors, base64, page lists, a PDF writer with AcroForm fields, a WAV writer
└── apps/<product>.ts one simulated host per app
backend/app/routers/preview.py   record, files with the contract's headers, net.fetch relay
```

---

## The simulated host {#sim}
- refers-to: src/sim/host.ts :: SimHost
- kind: decision
- logged: v0.1.0 · 2026-11-07

`SimHost` builds the contract kit's own `ExtensionHost` (`contract/host/host-bridge.ts`, imported unchanged) with handlers that talk to an `AppSim`. Nothing in the kit is copied or edited. To log every message it wraps the instance's `dispatch` method (the kit calls `this.dispatch` for every request from a frame), so permission errors (-32001), unknown methods (-32601) and the kit's own checks are logged exactly as the kit answers them. Host-to-extension messages (`ext.activate`, `ext.event`, `ext.theme`, `ext.deactivate`) are logged where SimHost sends them. Log ids come from one module counter, so a reload (a new SimHost) never reuses a row.

Panels open with the kit's `open()` (consent before the frame, LEAD resolution 07:47); headless commands use the kit's `runCommand` (idle clock that pauses during long requests). A command with `panel` opens that panel and sends `ext.activate { reason: "command", panel, command }`.

`document.apply` runs the ops on a copy of the document. `apply: "atomic"` drops the copy when an op fails (formvis, formcut, formwav, formpdf, formlit, form.md, FormEncoder, FormVFX, formMCP, formtray); `apply: "partial"` keeps the ops before the failing one as the step (formdeck, formskills), as their pages say. A failure answers -32004 (or -32602 for bad params) with `op N (command): reason`. `applyKinds` limits apply to document commands where the app does (formcut `edit`, formwav reducer commands, formpdf change actions, form.md `doc.*`, formtray board commands); `runExclude` keeps formwav's reducer commands out of `app.run`. FormVFX's `"$N.key"` references are resolved (`opRefs`).

Any call that changes the document is one step: the sim's `step()` updates its own history fields (revision, undo label, new PDF id), the previous state goes on the preview's undo stack (50 steps), and the sim's `changed(prev, next)` produces the app's own `ext.event`s (`document.changed`, `selection.changed`, and the app's extras such as `layer.activated`, `transport.changed`, `module.changed`, `time.changed`, `apps.changed`), broadcast to every frame. Undo, Reset and Edit in the Document tab send the same events.

---

## The twelve documents {#apps}
- refers-to: src/sim/apps/*.ts
- kind: decision
- logged: v0.1.0 · 2026-11-07

Each app's `document.read` answers, command names, argument names, events, theme token extras and file and network offers follow its `docs/EXTENSIONS.md` (all twelve were present when this was written). The sample documents are realistic and coherent with the sample files: a 1200 by 800 picture with three layers that renders to a real PNG for `what: "image"` (formvis), a three-track timeline with markers and media (formcut), a podcast session at 48 kHz with markers and regions in samples (formwav), a three-page membership form whose `what: "file"` is a real PDF with AcroForm text fields built by `buildPdf` (formpdf), a three-slide deck (formdeck), four geotagged photos with capture times (formlit), a page of blocks parsed from Markdown with citation keys (form.md), a two-source queue (FormEncoder), a two-layer composition (FormVFX), formMCP's settings, formtray's board and formskills' library. Each sim lists a subset of the app's command catalogue (the ones the page names as most useful), not all of it; an unknown command answers the way the app does (-32602 in formcut, -32004 elsewhere).

When an app's page changes, change only its file in `apps/`. To add an app: write `apps/<product>.ts` exporting an `AppSim` and add it to `SIMS`.

---

## The pane {#pane}
- refers-to: src/panes/preview/index.ts
- kind: interface
- logged: v0.1.0 · 2026-11-07

Left, the simulated app window: title bar (app, version, document title, state chip Ready, Needs Permission or Refused), an Extensions row (one button per contributed command `Name: Title`, one Open per panel, as the app's Extensions menu), a reason line when the host refuses the extension, the document view (`sim.view`, with Undo of the last simulated step), and the dock (tabs per open dock panel with Close). `dialog` panels open in a modal over the window. The host's own dialogs (consent, Open, Save) are a second modal layer above it, so a dialog panel can ask for files.

Right, four tabs: Log (every message both ways, filter, direction and error toggles, copy as JSON, click a row for the params and the answer; base64 and long strings are cut in the view only), Events (send any of the app's events with editable JSON prefilled from the current document, or a custom one; resend `ext.theme`, `ext.activate`; close panels), Document (`document.read` for any `what`, the raw simulated state editable as JSON, Reset), Permissions (consent state with Allow now and Forget consent, a switch per declared permission to run as if the manifest did not ask for it, what the app offers, storage used and Clear).

Header: Simulate in (another app shows how that app refuses it, through the real `formext_host.check`), Reload on save (on by default; a `project.changed` for the open project reloads after 800 ms and reopens the dock panels that were open), Light (the simulated app's theme, sends `ext.theme`), API (opens Docs at the simulated app's page, `ctx.openPane('docs', { doc: product })`), Reload. Palette: "Preview: Reload the extension", "Preview: Undo the last simulated step". Stored keys: `formext.preview.tab`, `.auto`, `.mode`, `.off` (permissions switched off, per extension id). Consent uses the kit's `formext.grants`, storage the kit's `formext.store.<id>`.

`files.open` shows sample files that match `accept` and "From this computer" (a real file input, 200 MB together); Cancel is -32002. `files.save` shows name, type, size and a preview of pictures and text, and Save downloads the file. `net.fetch` goes through the engine relay below. Apps whose page says they do not offer one of these get no handler, so the kit answers -32003 by itself.

---

## Engine routes {#routes}
- refers-to: backend/app/routers/preview.py
- kind: interface
- logged: v0.1.0 · 2026-11-07

| Route | Answer |
|---|---|
| `GET /api/preview/{pid}?product&app&app_version` | `{project, product, record, manifest, csp}`. `record` is `formext_host.check` on the project's package folder as a development extension for that product, app name and version, then `Extension.public(base)` with base `/api/preview/{pid}/files/{id}/{version}/`. The pane passes the simulated app's name and this round's version, so `minimum_app` and product refusals read as in the app. |
| `GET` and `HEAD /api/preview/{pid}/files/{id}/{version}/{path}` | the package's own file through `formext_host.file_for` (inside the folder, no symlink, listed types only, 404 with no detail otherwise) with `formext_host.headers_for(type, "")`: nosniff, no-store, CORP cross-origin, ACAO `*`, and for HTML the contract's CSP with `'self'`. The id and version must be the manifest's. |
| `POST /api/preview/fetch` | `{url, method?, headers?, body?}` with base64 body; https only, refuses hosts that resolve to loopback, private, link-local or reserved addresses, no redirects followed (a 3xx is returned), 30 s, 50 MB; answers `{status, headers, body}`. |

The frame `src` is relative (`/api/preview/...`), so the same page works through Vite's proxy and from the built app. The engine's CORS middleware leaves the route's `Access-Control-Allow-Origin: *` in place for the frame's `Origin: null` requests.

---

## Verified {#verified}
- kind: test
- logged: v0.1.0 · 2026-11-07

Headless Chrome against the built interface served by a scratch engine: the five first-party packages from `/home/claude/ext/packages/` (Citations: import `library.bib`, build the bibliography as one `document.apply`; Golden Hour: the headless tag command applies `photo.addKeywords` and ends with `ext.done`; Halftone Separations: the dialog panel separates the rendered picture and the headless command adds four Multiply plate layers; Mail Merge: reads `what: "file"`, parses the generated PDF's fields, takes `members.csv` and saves a zip; Shot List: reads the timeline and takes injected events and `ext.theme`), the kit's `examples/hello` (consent, Not Now leaves no frame, a switched-off permission gives -32001, Simulate in FormCut refuses it, reload on save), and a probe extension per app that reads every `what`, applies two ops, runs one command, and checks storage and `net.fetch` (all twelve pass).
