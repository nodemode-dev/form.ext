---
name: check-and-preview
description: "Verifying a Form extension with form.ext before anyone calls it done: the validate tool's rules and fixes, the preview snapshot (host acceptance, frame headers, CSP, consent words, served assets), and what the Preview pane and the real app add. Use after every change to an extension, when validate reports problems, when a host refuses the extension, or before packaging."
---

# check-and-preview

## validate

`validate {id}` answers `{ok, counts, problems}`; each problem has `rule`, `severity` (error, warning, info), `file`, `line`, `column`, `message` and `fix`. `rules` lists every rule. The groups:

- **Contract** (rules `json`, `package`, `schema`, `host`, `missing-entry`): the manifest against the package schema, the kit's package rules and what an API 1 host checks before loading (required fields, `api` "1", `native` false, ids, entry inside the package, file types, sizes, counts). A host refuses the package for any of these, and `package` always refuses.
- **Code**: what the CSP or sandbox will stop (`csp-inline-script`, `csp-external`, `csp-frame`, `no-network`, `no-eval`, `sandbox-storage` for localStorage and cookies, `sandbox-ui` for alert, popups and forms), `missing-file` for a referenced file that is not there, `headless-command`, `file-size`. `package` refuses the errors among these unless `anyway`.
- **Permissions**: SDK calls whose permission is not declared, and declared permissions nothing uses.

Fix in the order errors, then warnings. Apply the `fix` text; re-run `validate` after each batch.

## preview

`preview {id}` is the preview snapshot, what a host does before the person sees anything. The fields below are the tool's answer (`--json` on the command line); the command line's plain output prints the same as lines (`frame ... headers ok`, one `asset` line per file with its status) and names a missing file or an inline script only when there is one:

| Field | Good |
| --- | --- |
| `state` | `ready`; `refused` carries the host's reason in its own words |
| `frame.status`, `frame.headers_ok`, `frame.csp` | 200, true, the contract CSP |
| `permissions[].words` | exactly the consent the plan expects |
| `panels`, `commands` | what the manifest contributes, as the host will list them |
| `assets[]`, `missing` | every file the entry page references answers 200; `missing` is empty |
| `inline_script` | absent |

`preview {id, product, app_version}` checks against another app or version (for `minimum_app`).

## What only a running host shows

The snapshot does not run the page. To see it run, the person opens form.ext's Preview pane (a simulated host for the app with a realistic document, an event injector, a call log and permission toggles), or, with their consent, `run_in_app` loads it in the real app. Report what they saw; do not describe a rendering you did not see.

## Before packaging

- `validate`: zero errors.
- `preview`: ready, headers ok, nothing missing.
- The manifest's `version` is the one to ship and `description` reads well in a catalogue.
