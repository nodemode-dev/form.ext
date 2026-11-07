# @formai/ext

The extension side of the Form Extension Contract, API 1. One small typed client, no dependencies, for extensions that run inside any Form app: FormVis, FormCut, FormWav, FormPDF, FormDeck, FormLit, Form.md, FormEncoder, FormVFX, FormMCP, FormTray and FormSkills.

An extension is a web page in a sandboxed frame (`sandbox="allow-scripts"`, no same origin, no network). The only way out is `postMessage` to the app that hosts it, as JSON-RPC 2.0 with `"formext": 1` on every message. This package speaks that protocol for you: it sends requests, matches the answers, times them out, routes the host's calls to your handlers and applies the app's theme.

The source is `src/formext.ts`, the kit's `sdk/formext.ts` unchanged; `dist/formext.js` and `dist/formext.d.ts` are built from it. The contract itself is `CONTRACT.md` in the kit (and in form.ext under Docs).

## Install

```sh
npm install @formai/ext
```

```ts
import { formext } from '@formai/ext';
```

A package may hold only the file types of contract section 2, and `.ts` is not one of them, so a bundler (or your own build step) turns your code into `.js` before you package it. Without a build step, copy `dist/formext.js` into your package (for example as `ui/formext.js`) and load it as a module:

```html
<script type="module" src="app.js"></script>
```

```js
import { formext } from './formext.js';
```

A module is evaluated once per page, so every file that imports `./formext.js` shares the one client.

Inline scripts are blocked by the extension's Content Security Policy (`script-src 'self'`), so every script is a file.

## A panel in twenty lines

The examples are for Form.md; each app's page under Docs gives its own snapshot and commands.

```ts
import { formext, FormExtError, ERR } from '@formai/ext';

formext.onActivate(async ({ reason, panel }) => {
  if (reason === 'panel') await refresh();
});

formext.onEvent(({ name }) => {
  if (name === 'document.changed') void refresh();
});

async function refresh() {
  try {
    const doc = await formext.readDocument<{ page: { title: string } }>();
    document.querySelector('#title')!.textContent = doc.page.title || 'Untitled';
  } catch (e) {
    if (e instanceof FormExtError && e.code === ERR.PERMISSION) return;
    throw e;
  }
}

const hello = await formext.hello();
document.querySelector('#app')!.textContent = `${hello.app} ${hello.appVersion}`;
```

Register handlers before you call `hello()`: the host sends `ext.activate` right after it answers `host.hello`.

## A headless command

A command without `panel` in the manifest runs in a hidden frame. The host sends `ext.activate` with `reason: "command"` and closes the frame when you call `done()`, or after 120 s without a pending request.

```ts
formext.onActivate(async ({ reason, command }) => {
  if (reason !== 'command') return;
  setTimeout(async () => {
    try {
      if (command === 'stamp') await formext.apply('Stamp Draft', [{ command: 'doc.insertMarkdown', args: { markdown: '**Draft**', at: 'start' } }]);
    } catch (e) {
      await formext.notify(String((e as Error).message), 'error');
    } finally {
      await formext.done();
    }
  });
});
void formext.hello();
```

Answer `ext.activate` at once and do the work on the next task, so the host's activation call never waits on your work.

## The client

`formext` is the one `FormExt` instance the package creates when it loads. It listens for `message` events from `window.parent` only and ignores anything without `formext: 1` and `jsonrpc: "2.0"`.

### Talking to the host

| Method | Sends | Answers | Permission |
|---|---|---|---|
| `hello()` | `host.hello` (once; later calls reuse the first answer) | `Hello`, and applies `hello.theme` | none |
| `notify(message, level?)` | `ui.notify`; `level` is `info` (default), `success`, `warning` or `error` | `null` | none |
| `resize(height)` | `ui.resize`, rounded up | `null` | none |
| `setTitle(title)` | `ui.setTitle` | `null` | none |
| `storageGet<T>(key)` | `storage.get` | the stored value or `null` | none |
| `storageSet(key, value)` | `storage.set`; at most 256 KB per extension in total | `null` | none |
| `readDocument<T>(what?)` | `document.read`, with `{ what }` when given | the app's document snapshot | `document` |
| `apply(label, ops)` | `document.apply` with `{ label, ops: [{ command, args }] }`, one undo step | `{ applied, results }` | `document` |
| `commands()` | `app.commands` | `[{ id, title, args? }]` | `document` |
| `run<T>(command, args?)` | `app.run` | the command's result | `document` |
| `openFiles(accept, multiple?)` | `files.open`; the person picks in the app's dialog | `PickedFile[]`, `data` in base64 | `files-read` |
| `saveFile(name, type, data)` | `files.save` with base64 `data` | `{ saved, name }` | `files-write` |
| `fetch(url, init?)` | `net.fetch`; `https://` only, `init` is `{ method?, headers?, body? }` | `{ status, headers, body }`, `body` in base64 | `network` |
| `done(result?)` | `ext.done`, ends a headless command | `null` | none |
| `call<T>(method, params?)` | any method by name | its result | as the method |

What `readDocument` returns, the `what` values it takes, and the commands `apply` and `run` accept are different in every app: each app's page under Docs (its `docs/EXTENSIONS.md`) lists them.

Requests time out after 30 s; `files.open`, `files.save`, `app.run`, `document.apply` and `net.fetch` after 300 s. A timeout rejects with `FormExtError` code `-32003` and the message `<method> timed out`.

### Hearing the host

| Method | For |
|---|---|
| `onActivate(handler)` | `ext.activate` `{ reason: "panel" \| "command", panel?, command?, args? }` |
| `onEvent(handler)` | `ext.event` `{ name, data }`: the app's events, such as `document.changed` and `selection.changed` |
| `on(method, handler)` | any host call by name, for example `ext.deactivate`. One handler per method; a second `on` replaces the first |

A handler's return value (or the value its promise resolves to) is the answer to the host; a throw answers an error with the thrown `code` (default `-32004`) and message. A host call with no handler is answered `-32601`. `ext.theme` is handled for you: it calls `applyTheme`. Calling `on('ext.theme', ...)` replaces that.

### Helpers

| Export | Does |
|---|---|
| `applyTheme(theme)` | sets `data-theme` on the root element to `theme.mode` and every `--token` in `theme.tokens` as a CSS variable on it |
| `toBase64(bytes)` | a `Uint8Array` to base64, in 32 KB chunks |
| `fromBase64(data)` | base64 to a `Uint8Array` |
| `FormExtError` | `Error` with `code` and `data`; every rejected call rejects with one |
| `ERR` | the error codes by name |
| `FormExt` | the class, if you want a second client (you rarely do: both would answer the host) |

The theme tokens the host sends always include `--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--border` and `--radius`, so `background: var(--bg); color: var(--text)` makes a page look like the app it runs in, dark or light.

### Errors

| `ERR` | Code | Means |
|---|---|---|
| `NOT_FOUND` | -32601 | the method is not in API 1 (or no handler for a host call) |
| `INVALID` | -32602 | invalid params |
| `PERMISSION` | -32001 | the permission is not granted; the host never prompts mid-call |
| `CANCELLED` | -32002 | the person cancelled a dialog |
| `UNAVAILABLE` | -32003 | not available in this app, or timed out |
| `REFUSED` | -32004 | the app refused the operation; the message says why in the app's words |

### Types

`Permission` (`document`, `files-read`, `files-write`, `network`, `models`, `native-code`), `Hello` (`product`, `app`, `appVersion`, `api: "1"`, `extension { id, version, source }`, `permissions`, `theme { mode, tokens }`, `locale`), `Activation` and `PickedFile` (`name`, `type`, `size`, `data`).

## The manifest

The client does nothing without a `manifest.json` at the package root that asks for the permissions your calls need and names the page:

```json
{
  "format": "formai-package",
  "format_version": 1,
  "id": "title-stamp",
  "name": "Title Stamp",
  "product": "formmd",
  "kind": "script-plugin",
  "version": "0.1.0",
  "author": "you",
  "licence": "Apache-2.0",
  "native": false,
  "permissions": ["document"],
  "api": "1",
  "entry": { "ui": "ui/index.html" },
  "contributes": {
    "panels": [{ "id": "main", "title": "Title Stamp", "location": "dock" }],
    "commands": [{ "id": "stamp", "title": "Stamp the Title" }]
  }
}
```

form.ext writes this for you (New), keeps it in sync with a form (Edit), checks that every call you make is covered by a permission and that every permission is used (Check), and builds the deterministic `.formpkg` (Package and Sign).

## Licence

Apache License 2.0. Part of the Form Extension Contract kit by nodemode.
