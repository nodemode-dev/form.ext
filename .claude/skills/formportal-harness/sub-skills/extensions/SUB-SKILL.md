---
name: extensions
description: Extensions for the Form apps through FormPortal. Use when the person wants an effect, look, LUT, template, preset, theme, script or plugin found, installed, updated, turned off or removed; double-clicked or was sent a .formpkg file; asks what an extension can use or whether it is signed; or when extensions, extension_install, extension_remove or extension_enable fail.
---

# extensions

## What an extension is

A `.formpkg` package (a zip with `manifest.json`) for one app: its id, kind (effect-stack, lut, preset, script-plugin, native-plugin and the rest), version, author, licence, whether it runs native code, and the permissions it asks for (document, files-read, files-write, network, models, native-code). FormPortal checks and unpacks it into its own folder and lists it for the app in `extensions/[product]/enabled.json`. The products are the thirteen of the Form Extension Contract (formvis, formcut, formwav, formpdf, formdeck, formlit, formmd, formencoder, formvfx, formmcp, formtray, formskills, formportal). An API 1 package also names `api: "1"`, a `description`, its `entry.ui` page and what it `contributes` (panels and commands, shown in `installed[].contributes`). FormPortal refuses a package whose `api` is not "1" and any native package. Apps from their extension host release on watch `enabled.json` and pick the change up while they run; the result's `note` says which.

## Where they come from

Extensions come only from form.ext-registry (`nodemode-dev/form.ext-registry`): its signed index (`https://github.com/nodemode-dev/form.ext-registry/releases/download/index/extensions.json`) and signed block list beside it, verified with registry keys only (`core/registry_keys.txt` compiled in, plus `FORMEXT_REGISTRY_PUBKEY`, comma-separated, for testing). The app catalogue's keys never verify extensions. `extensions_source` or `FORMPORTAL_EXTENSIONS` points at another index (a test index, a mirror; package addresses on the registry's release downloads then come from the same mirror). Each entry carries `verified` (reviewed and published by the registry) and `source` (its folder in the registry); say "verified by form.ext-registry" and give the source link when the person asks who made it or what it does.

## The loop

1. `extensions`: the registry index with each package's install state, plus everything installed, the block list (`blocked`) and anything the block list just turned off (`turned_off`, with the reason: tell the person). If it reports `index_error`, pass it on plainly: "this build trusts no registry key yet" (the build has no registry key; only the developer setting, `allow_unsigned`, lists it), a signature that does not match (do not work around it), or "the registry is private or unreachable" (nothing to fix here).
2. Before installing, tell the person what the package is for, who made it, and the permissions it asks for, in words ("the open document, the network"). Native code deserves a sentence of its own.
3. `extension_install {id}`, or `{path}` for a file the person has. Every package is checked against the index's SHA-256, its publisher signature, and its manifest against the index. An index entry without a publisher signature is refused unless the developer setting (`allow_unsigned`) is on; a blocked id or version is always refused.
4. `extension_enable {product, id, enabled}` turns one off without removing it (a blocked one cannot be turned on); `extension_remove {product, id}` removes it.
5. Pass on the result's `note`: "ready in" the app while it runs, or, for an installed copy older than its extension host release, from its next start.

## Sideloaded packages

A file installed by path that the index does not list is recorded with `source: sideload` and shown as such. Treat it as unreviewed: say so, and never install a sideloaded native package without the person turning the developer setting on themselves.

## When it fails

The refusals name the reason ("the package's signature does not match ...'s key", "its manifest says ... the index says ...", "it needs extension API 2; this FormCut offers API 1", "native extensions are not supported by FormCut"). Report the sentence; do not retry from another source.
