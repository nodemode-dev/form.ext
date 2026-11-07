# Extensions in formvis

formvis loads extensions that follow the Form Extension Contract, API 1 (the kit in `frontend/src/formext/host-bridge.ts` and `backend/app/services/formext_host.py`, Apache-2.0, nodemode). FormPortal installs them; form.ext makes them and runs them in the app while you work on one. This page is what an extension can rely on in formvis. The contract itself is the same in every Form app; only the `document` and `app` methods below are formvis's own.

- Product id: `formvis`. App name in `host.hello`: `FormVis`. `appVersion` is the running version (`./formvis version`).
- `minimum_app`: compared with `appVersion`. The extension host ships in formvis 2.1.0; while you develop against a source checkout that still reports an older version, leave `minimum_app` out or set it to that version.
- The older formvis plugin kinds (single `.js` files and plugin folders in the Plugins menu, WebAssembly filter plug-ins) are separate and keep working; this page is only about contract extensions.

## document.read

`document.read` takes `{ what? }`. Every answer is plain JSON.

| `what` | Answer |
| --- | --- |
| left out or `"document"` | the open document: the same data as the MCP tool `get_document`, plus `open` |
| `"layers"` | `{ activeLayerId, layers }`, the layer tree, groups holding `children` (as `get_layer_tree`) |
| `"selection"` | `{ selection }`, the selection's bounding box in document pixels, or `null` |
| `"history"` | `{ current, count, steps: [{ index, name, done }], snapshots }` (as `list_history`) |
| `"image"` | `{ mimeType: "image/png", data, width, height }`, the flattened picture as base64 PNG, at most `max_size` pixels on its long side (1024 when left out, 4096 at most); give `id` for one layer alone, or `x`, `y`, `width`, `height` for a box in document pixels |

| `"file"` | `{ name, type: "application/x-formvis-project", size, data }`, the open document as a formvis `.fvd` project as it would be saved now (unsaved changes included, every layer kept), base64, at most 200 MB; it needs the engine service, and fails with -32004 when it cannot pack the document |

With no document open, `"document"` answers `{ "open": false, "documents": [] }` and the others answer `null`.

A real snapshot, taken from the running app (formvis 2.0.3 source build) with an 800 by 600 document holding a background and one text layer, a rectangle selected:

```json
{
  "open": true,
  "name": "Ext Test",
  "width": 800,
  "height": 600,
  "resolution": 72,
  "mode": "rgb",
  "depth": 8,
  "profile": "sRGB",
  "activeLayerId": "C34B63CE-A6E3-40AC-A512-BB1E17F0DFF0",
  "selection": { "x": 100, "y": 80, "width": 400, "height": 300 },
  "history": { "steps": 2, "done": 2, "canUndo": true, "canRedo": false, "last": "Rectangular Marquee" },
  "documents": [{ "id": "F1EE41FC-F998-498B-B5E5-5A10D76D9930", "name": "Ext Test", "active": true, "width": 800, "height": 600, "layers": 2, "modified": true }],
  "layers": [
    { "id": "BEAD0B07-1917-4933-B058-21FC13507DFF", "name": "Background", "kind": "pixels", "visible": true, "opacity": 1, "blend": "normal", "parentId": null },
    { "id": "C34B63CE-A6E3-40AC-A512-BB1E17F0DFF0", "name": "Hello", "kind": "text", "visible": true, "opacity": 1, "blend": "normal", "parentId": null }
  ]
}
```

Ids are opaque strings (UUIDs); pass them back as they are.

`kind` is `pixels`, `group`, `text`, `shape`, `smart object`, `adjustment:<kind>` or `fill:<kind>`. Layers are listed bottom first.

## document.apply and app.run

`document.apply` takes `{ label, ops: [{ command, args }] }` and runs the ops in order as one undo step named `label` (Edit > Undo shows it, the History panel lists it once). It answers `{ applied, results }`, one result per op. When an op fails, the ops before it are undone, nothing is left half done, and the call fails with -32004 and formvis's own reason.

`app.run` takes `{ command, args }` and runs one command as its own undo step; `app.commands` lists every command (`[{ id, title, group, args }]`, about 1,700).

`command` is one of:

1. A command of formvis's catalogue, the same ids as the palette, `./formvis cli list` and the MCP tool `list_commands` (`.claude/skills/formvis-driving/references/commands.md` lists them all). Commands that open a dialog open it in the window for the person.
2. One of these window tools, written `tool:<name>`, with the arguments of the MCP tool of that name: `tool:add_layer`, `tool:set_layer`, `tool:delete_layer`, `tool:duplicate_layer`, `tool:move_layer`, `tool:fill`, `tool:place_image` (`data` base64 only; `path` is not accepted), `tool:add_text`, `tool:draw_shape`, `tool:select`, `tool:transform_layer`, `tool:add_adjustment`, `tool:apply_filter`, `tool:crop`, `tool:resize_image`, `tool:resize_canvas`.

The most useful for extensions:

| Command | Args | Does |
| --- | --- | --- |
| `tool:add_layer` | `{ name? }` | an empty layer above the active one, made active; result `{ id }` |
| `tool:place_image` | `{ data, name?, x?, y?, scale?, fit?: "none" \| "contain" \| "cover", center? }` | a PNG, JPEG, WebP or SVG (base64) as a new layer |
| `tool:add_text` | `{ text, x?, y?, size?, color?, font?, bold?, italic?, align? }` | a text layer; result `{ id }` |
| `tool:draw_shape` | `{ kind: "rectangle" \| "ellipse" \| "triangle" \| "star" \| "polygon" \| "line" \| "arrow", x, y, width, height, fill?, stroke?, stroke_width? }` | a shape layer |
| `tool:fill` | `{ color: "#rrggbb" }` | fills the selection, or the active layer when nothing is selected |
| `tool:set_layer` | `{ id, name?, visible?, opacity?, blend?, active? }` | changes a layer |
| `layer.set` | `{ id?, name?, visible?, opacity?, blend?, active? }` | the same through the catalogue (active layer when `id` is left out) |
| `select.rect`, `select.ellipse` | `{ x, y, width, height, mode? }` | a selection in document pixels; `mode` `replace`, `add`, `subtract`, `intersect` |
| `select.lasso` | `{ points: [[x, y], ...], mode?, antialias? }` | a polygon selection |
| `select-all`, `deselect`, `inverse` | `{}` | the whole canvas, nothing, the inverse |
| `adjust.apply` | `{ kind, as?: "pixels" \| "layer", data? }` plus the kind's values (`hsv`: `hue`, `saturation`, `lightness`) | an adjustment with exact values |
| `filter.apply` | `{ kind, settings? }` plus the kind's values (`gaussianBlur`: `radius`) | a filter on the active layer, inside the selection |
| `paint.stroke` | `{ points: [{ x, y, pressure? }], tool? }` | one stroke with a painting tool |
| `new-layer`, `duplicate`, `merge` (Merge Down), `flatten` | `{}` | layer housekeeping |
| `invert`, `desaturate`, `auto-tone`, `auto-color` | `{}` | one-step image changes |
| `swatch-add` | `{}` | the foreground colour into the Swatches panel |

`./formvis cli describe <id>` (or the MCP tool `describe_command`) gives any command's full parameters.

## ext.event

| Name | Data | When |
| --- | --- | --- |
| `document.changed` | `{ name, width, height, layers, revision }` | the document's layers, pixels or history changed (after an edit, an undo or a redo), at most every 150 ms |
| `selection.changed` | `{ selection }` | the selection changed (bounding box or `null`) |
| `layer.activated` | `{ activeLayerId }` | another layer became the active one |
| `document.switched` | `{ id, name }` or `null` | another document tab became active, or the last one closed |

The host also sends `ext.theme` when the person changes the theme or accent: `--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--border`, `--radius`, plus `--panel-2`, `--accent-text` and `--danger`.

## Files and network

- `files.open`: yes, the browser file picker formvis uses for Open (one or several files, `accept` passed on), at most 200 MB in total.
- `files.save`: yes, formvis's own save path: the desktop app's save dialog, or the browser's where it has one. A browser without a save dialog first asks the person to confirm the name in a formvis dialog, then downloads the file into the downloads folder (the browser adds ` (2)` when the name is taken).
- `net.fetch`: no. formvis does not give extensions the network: the call answers -32003, or -32001 first when the manifest does not ask for `network`.
- `storage.get` and `storage.set`: yes, 256 KB per extension, kept on this computer.

## Where extensions appear

- The **Extensions** menu in the menu bar, after Plugins: one item per contributed command (`Name: Title`), then Extensions Panel, Reload Extensions and Manage in FormPortal.
- The **Extensions** panel (Window > Extensions, or Extensions > Extensions Panel) in the dock: one row per extension with its version, source (Catalogue, File, Development), permission chips and state (Ready, Needs Permission, Refused with the reason), an Open button per panel and, for development extensions, the folder.
- **Contributed panels**: a `dock` panel opens as a panel in the dock (it moves, floats and hides like any other, Window lists it); a `dialog` panel opens as a formvis dialog. Each title starts with the extension's name.
- **The command palette** (Edit > Search..., Mod+K) lists every contributed command under the Extensions group.
- **Agents**: the MCP tools `extensions_list` and `extension_command`, and `./formvis cli extensions list` and `./formvis cli extensions run <id> <command> [key=value ...]`. A command still needs the person's consent in the window the first time.
- Plugins > Manage Plugins has an Extensions Panel button.

The first time a version of an extension runs, formvis asks in its own dialog before the frame exists, listing what the extension asks for in plain words, so the first `host.hello` already carries the granted permissions. Allow is kept for that id, version and permission set; Not Now leaves the panel closed (a command fails with -32001) and the next activation asks again. An extension with no permissions is never asked about. A headless command's frame closes on `ext.done`, or after 120 s without a pending request (the clock stops while `files.*`, `app.run` or `document.apply` is pending).

## Running an extension from a folder

form.ext's Run in App writes `extensions/formvis/dev.json` in FormPortal's folder (`FORMPORTAL_ROOT`, or on Linux `~/.local/share/formportal`, macOS `~/Library/Application Support/studio.formai.portal`, Windows `%LOCALAPPDATA%\FormPortal`):

```json
{ "format": "formext-dev-extensions", "format_version": 1, "product": "formvis",
  "extensions": [{ "id": "my-extension", "path": "/home/me/my-extension", "added": "2026-11-07T12:00:00Z" }] }
```

formvis checks the file every 2 seconds while its window has focus and on Extensions > Reload Extensions. A development extension's files are served fresh on every load (no caching), and Reload Extensions reads every manifest again and closes the open panels of development extensions only, so the next Open loads your edited files; installed extensions' panels stay as they are unless their entry changed. To try one by hand: `FORMPORTAL_ROOT=/tmp/portal ./formvis boot`, write the file above under `/tmp/portal/extensions/formvis/`, then open Extensions > Extensions Panel.

FormPortal installs a package by unpacking it and listing it in `extensions/formvis/enabled.json` (`source` `catalogue` or `sideload`); formvis picks the change up the same way.

## The sandbox

The page in `entry.ui` runs in an iframe with `sandbox="allow-scripts"` only, served by the formvis engine at `/api/extensions/files/{id}/{version}/{path}` with the contract's Content Security Policy (`'self'` for scripts, styles, pictures, media and fonts; `connect-src 'none'`). The window is cross-origin isolated (COOP same-origin, COEP credentialless); the extension's files are served with `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Resource-Policy: cross-origin` so the frame loads inside it. Use relative paths to your own files; module scripts, `fetch` of your own files and WebAssembly work.
