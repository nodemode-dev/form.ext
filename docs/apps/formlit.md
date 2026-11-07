# Extensions in formlit

formlit loads extensions made to the Form Extension Contract, API 1: a package with a `manifest.json` (`"product": "formlit"`, `"api": "1"`) and a web page that runs in a sandboxed frame and talks to formlit only through `postMessage` (JSON-RPC 2.0, `"formext": 1`). The contract itself (package rules, the protocol, permissions and consent) is the Form Extension Contract kit; this page is what is particular to formlit. The Publish plug-ins in the Plugins folder (`docs/plugins`, Plug-in Manager) are a separate, older mechanism and keep working.

formlit's engine owns the catalog, so everything an extension reads or changes goes through the same engine commands the window, `./formlit cli` and the MCP tools use. An extension can never do what formlit itself cannot.

## host.hello

```json
{ "product": "formlit", "app": "formlit", "appVersion": "0.50.0", "api": "1",
  "extension": { "id": "golden-hour", "version": "0.1.0", "source": "development" },
  "permissions": ["document"], "theme": { "mode": "dark", "tokens": { "--bg": "rgb(17, 17, 17)", "...": "..." } }, "locale": "en" }
```

`appVersion` is the engine's version. Set `minimum_app` to `"0.50.0"`, the first formlit with the host. A source build before the 0.50.0 release reports 0.49.3, so leave `minimum_app` out while you test against one.

## document.read

`document.read` takes `{ what }`. formlit's document is the open catalog together with what the person is looking at: the module, the source (folder, collection, keyword and so on), the selected photos and the active photo.

| `what` | Returns |
|---|---|
| `summary` (default) | the catalog, module, source, selected ids, the active photo in short, and the catalog revision |
| `selection` | every selected photo (at most 500, active photo when nothing is selected) with file, capture time, camera and exposure, GPS, rating, flag, label and keywords |
| `photo` | the active photo in full: everything above plus `meta` (IPTC fields), `exif`, `develop` (the develop settings), collections and history count |
| `catalog` | folders, collections and keywords (ids for sources and commands) |

Any other `what` fails with -32602.

A real `summary`, from the running app:

```json
{
  "what": "summary",
  "catalog": { "name": "formlit", "path": "/home/me/Formlit/Catalog/formlit.fldb", "photos": 3 },
  "module": "library",
  "source": { "kind": "all", "label": "All Photographs" },
  "selection": [1, 2],
  "selectionCount": 2,
  "active": { "id": 1, "file": "p0.jpg", "captureTime": "2026-11-07T06:57:05", "offset": null, "rating": 0, "flag": "none", "label": "", "gps": { "lat": 51.4545, "lon": -2.5879, "alt": 12.0, "dir": null } },
  "revision": 6
}
```

`selection` is `{ "what": "selection", "photos": [...], "count", "truncated" }`, each photo like this one (taken from the same run; a camera file fills the camera and exposure fields):

```json
{
  "id": 1, "file": "p0.jpg", "path": "/home/me/Pictures/p0.jpg", "kind": "jpeg", "format": "jpg",
  "width": 800, "height": 600, "captureTime": "2026-11-07T06:57:05", "offset": null,
  "camera": "", "lens": "", "focal": null, "aperture": null, "shutter": null, "iso": null,
  "gps": { "lat": 51.4545, "lon": -2.5879, "alt": 12.0, "dir": null },
  "rating": 0, "flag": "none", "label": "", "edited": false, "keywords": []
}
```

`photo` is `{ "what": "photo", "photo": {...} }` with the same fields plus `meta`, `exif`, `develop`, `collections`, `history`, `masterId`, `copyName`, `stackId` and `missing` (`photo: null` when no photo is active or selected). `catalog` is `{ "what": "catalog", "catalog", "folders", "collections", "keywords" }`.

- `captureTime` is the camera's local time without an offset; `offset` is the EXIF offset (`OffsetTimeOriginal`) when the file has one, otherwise `null`.
- `gps` is `null` for a photo without a location. `flag` is `pick`, `reject` or `none`; `label` is `red`, `yellow`, `green`, `blue`, `purple` or empty.
- Keywords are paths with `|` between levels (`Light|golden-hour`).

## document.apply and app.run

`document.apply` takes `{ label, ops: [{ command, args }] }`. Each op is an engine command id with its parameters, run in order; together they are one undo step named `label` in Edit, Undo. The result is `{ applied, results }` with each command's result. When an op fails, the ops before it are undone and the call fails with -32004 and the engine's message.

`app.run` takes `{ command, args }` and returns that command's result; a command that changes the catalog is its own undo step. `app.commands` returns the whole catalogue as `[{ id, title, args }]`, where `args` is the command's parameter schema.

`ids` in any command takes a list of photo ids, `"selection"` or `"active"`.

The commands most useful to extensions:

| Command | Args | Does |
|---|---|---|
| `photo.get` | `id` | one photo in full (read only) |
| `library.query` | `source`, `filter`, `sort`, `limit` | finds photos (read only); the same source and filter as `find_photos` |
| `library.tree` | | folders, collections, keywords (read only) |
| `photo.addKeywords` | `ids`, `keywords` (paths, `Light\|golden-hour`) | adds keywords, making missing ones |
| `photo.removeKeywords` | `ids`, `keywords` | removes keywords |
| `photo.rate` | `ids`, `rating` 0 to 5, or `delta` | sets the star rating |
| `photo.flag` | `ids`, `flag` (`pick`, `reject`, `none`) | sets the flag |
| `photo.label` | `ids`, `label` (`red` ... `purple`, `none`) | sets the colour label |
| `photo.setMeta` | `ids`, `fields` (IPTC: `title`, `caption`, `headline`, `city`, `country` ...) | edits metadata |
| `photo.setGps` | `ids`, `lat`, `lon`, `alt` | sets the location |
| `collection.create` | `name`, `kind` (`collection`), `ids` | makes a collection, returns its id |
| `collection.addPhotos` | `id`, `ids` | adds photos to a collection |
| `develop.get` | `id` | develop settings (read only) |
| `develop.set` | `ids`, `values` (`{"light.exposure": 0.3}`), `delta` | changes develop settings |
| `develop.controls` | | every develop id with its range (read only) |
| `develop.auto` | `ids` | Auto settings |
| `preset.apply` | `ids`, `preset`, `amount` | applies a develop preset |
| `photo.virtualCopy` | `ids`, `name` | makes a virtual copy |
| `library.select` | `ids`, `active` | sets the selection agents see; the window keeps its own, which `document.read` reports |

Refused with -32004 because they stay with the person: deleting files and folders (`photo.delete`, `folder.remove`), switching catalogs (`catalog.open`, `catalog.create`), answering agent prompts (`agents.respond`), the terminal and chat (`terminal.*`, `claudecode.*`, `chat.*`) and the extension commands themselves (`extensions.*`).

## Events

`ext.event` names formlit sends to every open frame:

| Name | Data |
|---|---|
| `document.changed` | `{ revision, photos: [ids], lists: ["keywords", "collections", ...], label }` after any catalog change, undo or redo (coalesced, at most one per animation frame) |
| `selection.changed` | `{ selection: [ids], active }` |
| `module.changed` | `{ module }` (library, develop, map, book, slideshow, print, web) |

`ext.theme` follows every theme or accent change in Preferences.

## Files and network

- `files.open` (permission `files-read`): the system's file picker; at most 200 MB in total.
- `files.save` (permission `files-write`): formlit's Choose Folder dialog, then the engine writes the file there. An existing file is never replaced; the name gets a number instead and the result says the name used.
- `net.fetch`: not offered (-32003).
- `storage.get` and `storage.set`: kept in the window's local storage, 256 KB per extension.

## Where extensions appear

- The **Extensions** menu in the menu bar, between Window and Help: one item per contributed command (`Name: Title`), then Extensions Panel, Reload Extensions and Manage in FormPortal.
- The **Extensions panel** opens in the right column, in every module, over the module's own panels (Extensions Panel again, or the close button, brings them back). One row per extension with its version, source, permission chips and state; Open for each of its panels; the folder of a development extension.
- **Dock panels** (`"location": "dock"`) open in the same column under the list, titled with the extension's name. **Dialog panels** (`"location": "dialog"`) open as a formlit dialog.
- A command without `panel` runs headless; a command with `panel` opens that panel and activates it with the command.
- Agents: the MCP tools `extensions_list` and `extension_command`, and on the command line `./formlit cli extensions.list` and `./formlit cli extensions.run id=... command=...`. The window must be open; consent is asked there.

## Running an extension from a folder

form.ext's Run in App writes `extensions/formlit/dev.json` under FormPortal's root (`FORMPORTAL_ROOT`, or `~/Library/Application Support/studio.formai.portal`, `%LOCALAPPDATA%\FormPortal`, `~/.local/share/formportal`):

```json
{ "format": "formext-dev-extensions", "format_version": 1, "product": "formlit",
  "extensions": [ { "id": "golden-hour", "path": "/home/me/golden-hour", "added": "2026-11-07T10:00:00Z" } ] }
```

formlit picks it up within 2 seconds while its window has focus, or at once with Extensions, Reload Extensions (which also re-reads a changed manifest). The folder is served as it is, so editing a file and reopening the panel shows the change.

FormPortal installs catalogue and sideloaded packages by unpacking them and writing `extensions/formlit/enabled.json`; formlit reads it the same way.

To try the engine side alone: `GET http://127.0.0.1:8390/api/extensions` lists what formlit found, with each refusal's reason.
