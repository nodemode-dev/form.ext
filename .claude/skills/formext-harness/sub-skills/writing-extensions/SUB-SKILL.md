---
name: writing-extensions
description: "Writing a Form extension's code and manifest with form.ext: the formext SDK calls, the sandbox and its CSP, dock and dialog panels, headless commands, document.read, document.apply and app.run against an app's own commands, events, files, storage, theming and permissions. Use when editing ui/app.js, ui/index.html or manifest.json of a form.ext project, or when an extension does nothing in the frame, fails with -32001 or -32004, or needs a new panel, command or permission."
---

# writing-extensions

## The page

`ui/index.html` loads styles and one module script from the package, never inline code:

```text
head:  link rel=stylesheet href=base.css
body:  the panel's markup (final layout, filled in place by script)
end:   script type=module src=app.js
```

`app.js` imports the SDK and helpers: `import { formext } from './formext.js'` and `import { $, esc, fill, status, errorText, debounce, headless } from './kit.js'`. Write the panel's containers in the HTML and fill them; do not build the layout from script, so the panel does not jump when it opens.

## The SDK

| Call | Use | Permission |
| --- | --- | --- |
| `formext.hello()` | product, app version, granted permissions, theme tokens, locale | none |
| `formext.readDocument(what?)` | the app's document snapshot (`what` per the app's API page; `"file"` for the bytes where offered) | document |
| `formext.apply(label, ops)` | change the document with the app's commands as one undoable step | document |
| `formext.run(command, args)` | run one app command and get its result | document |
| `formext.commands()` | the app's command catalogue | document |
| `formext.openFiles(accept, multiple)` | the person picks files; base64 data | files-read |
| `formext.saveFile(name, type, data)` | the person picks where | files-write |
| `formext.fetch(url, init)` | https only, through the host; body base64 | network |
| `formext.notify(message, level)`, `resize(height)`, `setTitle(title)` | host UI | none |
| `formext.storageGet(key)`, `storageSet(key, value)` | per-extension settings, 256 KB | none |
| `formext.onActivate(cb)`, `onEvent(cb)` | activation and app events (`document.changed`, `selection.changed`, the app's own) | none |
| `formext.done(result)` | ends a headless command | none |

Errors arrive as `FormExtError` with `code`: -32001 permission not granted, -32002 cancelled, -32003 not available in this app, -32004 the app refused (its message says why), -32602 invalid params. Show `errorText(err)` with `status(..., 'error')`; never swallow it.

## Panels and commands

- A panel is `contributes.panels[] {id, title, location: "dock" | "dialog"}`.
- A command with `panel` opens it; the page gets `ext.activate {reason: "command", panel}`.
- A command without `panel` is headless. Use `headless(run, onPanel)` from `kit.js`: it runs `run` for a headless activation, reports errors with `notify`, and always calls `done`. A headless command must not wait for clicks: the page is hidden.
- Ids are lowercase with hyphens, at most 32 characters.

## Changing the document

Use the app's own command ids and args from `docs {topic: "[product]"}`. One user action is one `apply` with a clear label (it becomes the undo step's name). Read the document again after `document.changed` (debounce it) rather than keeping a stale copy.

## Theme

The host sends theme tokens (`--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--border`, `--radius` at least) in `hello` and `ext.theme`; `base.css` and the SDK's `applyTheme` use them. Style with those variables so the panel looks like the app in dark and light.

## Permissions

List exactly what the code uses: Check reports a call whose permission is missing and a permission nothing uses. Every extra permission is another line in the consent dialog the person must accept.

## Manifest changes

Use `manifest {id, set}` with a merge patch: `{"permissions": ["document", "files-write"]}`, `{"contributes": {"commands": [...]}}` (arrays are replaced whole), `{"minimum_app": null}` removes a key. Keep `id`, `api: "1"` and `native: false`. Bump `version` (x.y.z) for each release.
