# Extensions in formtray

formtray hosts extensions made to the Form Extension Contract, API 1 (product id `formtray`). An extension is a folder with a `manifest.json` and a web page; FormPortal installs it, form.ext runs one from a folder while you make it, and formtray loads it in a sandboxed frame. This page lists what formtray offers an extension.

formtray has no document of its own. What a person arranges in it is the **board**: the Widgets tiles, the Stack pins and the hidden apps. `document.read` returns that, with the list of Form apps around it, and `document.apply` changes it.

## document.read

`document.read({ what? })`, permission `document`.

| `what` | Returns |
|---|---|
| `"all"` (default) | the whole snapshot below |
| `"apps"` | `{ apps }` |
| `"board"` | `{ board }` |
| `"pinned"` | `{ pinned }` |
| `"hidden"` | `{ hidden }` |
| `"updates"` | `{ portal, updates }` |
| `"view"` | `{ view }` |

Any other value fails with -32602. An example taken from the window (browser preview data, trimmed to three apps and four tiles):

```json
{
  "product": "formtray",
  "view": "widgets",
  "apps": [
    { "id": "formvis", "name": "FormVis", "category": "image", "installed": true, "running": true, "hidden": false, "pinned": true, "onBoard": true },
    { "id": "formcut", "name": "FormCut", "category": "motion", "installed": true, "running": true, "hidden": false, "pinned": true, "onBoard": true },
    { "id": "formportal", "name": "FormPortal", "category": "family", "installed": true, "running": false, "hidden": false, "pinned": false, "onBoard": false }
  ],
  "board": [
    { "tile": "formvis", "kind": "app", "app": "formvis", "size": "l" },
    { "tile": "formcut", "kind": "app", "app": "formcut", "size": "l" },
    { "tile": "group-mh2k1x", "kind": "group", "name": "Sound", "apps": ["formwav", "formencoder"], "size": "m" },
    { "tile": "ext:hello:main", "kind": "extension", "extension": "hello", "panel": "main", "size": "l" }
  ],
  "pinned": ["formvis", "formcut"],
  "hidden": [],
  "portal": true,
  "updates": [{ "app": "formvis", "from": "1.60.0", "to": "1.66.1" }]
}
```

`tile` is the id commands use: an app tile's id is the app id, a group's is `group-...`, the updates tile is `updates`, and a contributed panel docked on the board is `ext:<extension>:<panel>`.

## document.apply and app.run

`document.apply({ label, ops: [{ command, args }] })` and `app.run({ command, args })`, permission `document`. Both use formtray's own commands, the same ones its board, Stack and tray menu use. `app.commands` returns this list.

| Command | Args | What it does |
|---|---|---|
| `board.add` | `{ app, size? }` | puts an app tile on the board (`size` is `s`, `m` or `l`, default `m`) |
| `board.remove` | `{ tile }` | takes a tile off the board |
| `board.resize` | `{ tile, size }` | changes a tile's size |
| `board.move` | `{ tile, index }` | moves a tile to a place in the board order (0 is first) |
| `group.create` | `{ name, apps?, size? }` | adds a group tile; the result is its `tile` id |
| `group.rename` | `{ tile, name }` | renames a group |
| `group.add` | `{ tile, app }` | adds an app to a group |
| `group.remove` | `{ tile, app }` | takes an app out of a group |
| `stack.pin` | `{ app }` | pins an app to the Stack and the tray menu |
| `stack.unpin` | `{ app }` | unpins it |
| `app.hide` | `{ app }` | hides an app from every view |
| `app.unhide` | `{ app }` | shows it again |
| `app.open` | `{ app }` | opens an app, or brings it forward |
| `app.quit` | `{ app }` | quits a running app |
| `view.show` | `{ view }` | shows `switcher`, `stack`, `apps`, `windows` or `widgets` |
| `apps.rescan` | `{}` | Find Apps Again |
| `updates.open` | `{}` | opens FormPortal for updates |

`app` is an app id from `document.read`. A command that names an unknown app, tile or size fails with -32004 and says why, and nothing is changed.

`document.apply` takes the board commands only (`board.*`, `group.*`, `stack.*`, `app.hide`, `app.unhide`). It checks every op first and then saves the board once, so the whole call is one change: either every op lands or none does. formtray has no undo history, so the step cannot be undone from a menu; it is one save with the label shown as a toast. The action commands (`app.open`, `app.quit`, `view.show`, `apps.rescan`, `updates.open`) run only through `app.run`, since they act on other apps rather than on the board.

## Events

`ext.event` names formtray sends:

| Name | Data | When |
|---|---|---|
| `document.changed` | `{ what: ["board", "pinned", "hidden"] }` (the parts that changed) | the board, the pins or the hidden list changed, by the person or an extension |
| `selection.changed` | `{ view }` | formtray switched to another view (its equivalent of a selection) |
| `apps.changed` | `{ running: [ids] }` | an app was opened or quit |

## Files and network

- `files.open`: available. formtray uses the window's own file picker (the webview's file chooser), with `accept` as the filter.
- `files.save`: not available (-32003). formtray has no save dialog of its own (it carries no dialog plugin). The contract's fallback for such hosts (confirm the name in the app's own dialog, then save into the downloads folder) is not built in this version, so an extension that saves files cannot run here yet.
- `net.fetch`: not available (-32003). formtray never reaches the network itself.

## Where extensions appear

- **Extensions menu**: the tray menu has an Extensions submenu (formtray has no menu bar): one item per contributed command (`Name: Title`), then Extensions Panel, Reload Extensions and Manage in FormPortal.
- **Extensions panel**: a sheet over the panel window, from that menu or the Extensions button in the Widgets header. One row per extension with its version, source, permission chips and state, Open buttons for its panels, and the folder of a development extension.
- **Contributed panels**: a `dock` panel opens as a tile on the Widgets board titled `Name: Panel`, which you can resize, move and remove like any tile; a `dialog` panel opens as a card over the panel window.
- **Commands**: from the Extensions submenu, from the Apps view's search (type part of a command's title), and from `formtray-cli extension_command`.

## Agents and the command line

formtray has no MCP server; its command line is the agent route.

- `formtray-cli extensions_list [--json]`: id, name, version, source, state and commands of every extension formtray sees.
- `formtray-cli extension_command <id> <command> [args-json]`: runs a contributed command in the running formtray window and prints its result. The window applies the same consent rules: the first run of a version shows the consent card there.

## Run an extension from a folder

form.ext's Run in App writes `extensions/formtray/dev.json` under FormPortal's folder (`FORMPORTAL_ROOT` when set; Linux `~/.local/share/formportal`, macOS `~/Library/Application Support/studio.formai.portal`, Windows `%LOCALAPPDATA%\FormPortal`):

```json
{ "format": "formext-dev-extensions", "format_version": 1, "product": "formtray", "extensions": [{ "id": "hello", "path": "/home/me/hello", "added": "2026-11-07T10:00:00Z" }] }
```

formtray checks both files every second while its panel is open (every 3 s otherwise) and on Reload Extensions, and shows the extension with the source Development. The manifest's `product` must be `formtray`.

FormPortal installs a package into its own folder and lists it in `extensions/formtray/enabled.json`; formtray loads it from there with the source Catalogue or File.

## In development

`npm run dev` in `frontend/` serves the window on http://localhost:5610 with preview data. The same routes as the app are served there by the Vite server through `formtray-cli` (build it with `cargo build -p formtray-cli`): `GET /api/extensions` and `GET /api/extensions/files/{id}/{version}/{path}`. In the app the files come from `formext://{id}/{version}/{path}` (`http://formext.localhost/{id}/{version}/{path}` on Windows).
