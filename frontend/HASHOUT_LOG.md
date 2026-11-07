# HASHOUT_LOG · frontend · form.ext

Living log for the interface: the shell, the shared styles and the build files. Source files stay comment-free; what they would have said lives here. Each pane keeps its own `src/panes/<name>/HASHOUT_LOG.md`.

Current build version: v0.1.0
Last updated: 2026-11-07 · v0.1.0 shell

---

## Org-navi-map

```
frontend/
├── index.html            static window skeleton, critical style, pre-paint theme boot
├── vite.config.ts        port 5640, host false, /api proxied (with WebSocket) to 127.0.0.1:8640
├── public/               favicon art, Inter and JetBrains Mono woff2
└── src/
    ├── main.ts           imports the four style sheets, then boot()
    ├── styles/
    │   ├── tokens.css     FormPortal's Studio Dark tokens plus the form.ext block at the end
    │   ├── base.css       fonts, reset, scrollbars, small utilities
    │   ├── components.css buttons, fields, checks, switches, lists, tabs, chips, cards, empty states, pane head and body, tables, notices
    │   └── shell.css      the window grid, top bar, sidebar, status bar, dialog, palette, toasts
    ├── shell/
    │   ├── index.ts       the public surface panes import from ('../../shell')
    │   ├── types.ts       PaneDef, ShellContext, ProjectRef (the plan's interfaces, unchanged)
    │   ├── shell.ts       pane discovery, layout, openPane, built-in commands, boot
    │   ├── api.ts         fetch wrapper (ctx.api)
    │   ├── events.ts      /api/live WebSocket with reconnect, local emitter (ctx.events)
    │   ├── project.ts     the open project (ctx.project)
    │   ├── dialog.ts      confirm and form dialogs (ctx.dialog)
    │   ├── toast.ts       ctx.notify
    │   ├── commands.ts    command registry and key bindings (ctx.commands)
    │   ├── palette.ts     command palette and quick pick
    │   ├── theme.ts       dark and light, extension theme tokens
    │   ├── icons.ts       the inline currentColor icon set and the brand mark
    │   ├── products.ts    the thirteen product ids, names and glyphs
    │   ├── dom.ts         esc, h, qs, key labels
    │   ├── storage.ts     guarded localStorage
    │   └── version.ts     VERSION
    ├── sim/              the simulated hosts of the twelve apps for Preview (notes: panes/preview/HASHOUT_LOG.md)
    └── panes/<name>/     one folder per pane, owned by its module
```

Module notes: `panes/home` and `panes/new` in `panes/new/HASHOUT_LOG.md`; `panes/run` and `panes/publish` in `panes/run/HASHOUT_LOG.md`; `panes/docs/HASHOUT_LOG.md` also covers `docs/`, `.docs/wiki/` and `sdk/`; `panes/preview/HASHOUT_LOG.md` covers `src/sim/`. The CodeMirror 6 and Lezer packages the Edit pane bundles are pinned in `package.json` (exact versions) and listed in `NOTICE.md`.

---

## The pane contract {#panes}
- refers-to: src/shell/shell.ts :: discover, buildLayout, openPane
- kind: interface
- logged: v0.1.0 · 2026-11-07

A pane is `src/panes/<name>/index.ts` exporting `export const pane: PaneDef` and importing its own `<name>.css`. The shell finds every pane with `import.meta.glob('../panes/*/index.ts', { eager: true })`, sorts them by group (make, ship, learn; no group means make) then `order`, and builds the sidebar and one `section.fx-pane[data-pane=id]` per pane before the window is shown. A pane mounts the first time it is opened; its container is absolutely filling the main area (`.fx-pane`, `overflow: auto`), so a pane that wants its own scrolling uses `.pane-fill` with a `.pane-head` and a `.pane-body`. `mount` may return a cleanup function. A pane that throws in `mount` shows an error state in its own container; the rest of the window keeps working.

`icon` is a name from `icons.ts` (`home`, `new`, `edit`, `preview`, `checklist`, `run`, `package`, `publish`, `docs`, `library` and the rest) or a whole `<svg>` string. The suggested ids and orders: home 0, new 10, edit 20, preview 30, check 40, library 50 (make); run 10, package 20, publish 30 (ship); docs 10 (learn).

The window stays hidden (`#app` visibility) until the first pane has mounted and the last open project has been restored (at most 1.5 s, then the next frame), so the first paint is the final layout: the project button, the status bar path and each pane's project-dependent parts are filled before anything shows. A `.pane-fill > .pane-head` never shrinks (`flex: none`), so a pane body whose content grows cannot squeeze its head, and the engine status item keeps a minimum width so its label change does not move the items beside it (v0.1.0 integration, measured CLS 0 under 4x CPU). The selected pane is in the hash (`#/edit`) and in localStorage, so a reload comes back to it.

---

## ShellContext in practice {#ctx}
- refers-to: src/shell/types.ts · api.ts · events.ts · project.ts · dialog.ts · commands.ts
- kind: interface
- logged: v0.1.0 · 2026-11-07

- `ctx.api.get('/api/projects')`: paths may start with `/api/`, with `/` (prefixed with `/api`) or be bare. JSON bodies are sent as JSON; `FormData`, `Blob`, `ArrayBuffer` and typed arrays go raw, strings as text. Answers: JSON parsed, text types as a string, anything else as an `ArrayBuffer`. A failure throws `ApiError` (`status`, `detail`, and a `message` taken from FastAPI's `detail`); status 0 means the engine is not reachable.
- `ctx.events.on(name, cb)` hears the engine's `/api/live` messages (`{ name, data }`) and the shell's own: `live.status` `{ connected }`, `shell.project` (the ProjectRef or null), `shell.theme` `{ mode, tokens }`, `pane.open` `{ id, args }` (sent every time `openPane` runs, after the pane has mounted). `'*'` hears everything as `{ name, data }`. It returns the unsubscribe function.
- `ctx.openPane(id, args)`: shows the pane, mounting it first if needed, then emits `pane.open`. The event comes after `mount`, so a pane that subscribes inside `mount` hears the call that mounted it too; `lastArgs(id)` from the shell's index gives the last arguments at any time.
- `ctx.project`: `open(id)` reads `GET /api/projects/{id}` and tells every `onChange` subscriber; the last project reopens after a reload. An engine `project.changed` for the open project re-reads it and tells subscribers only when the name, product, folder or manifest changed (so editing a source file does not re-render panes); `project.deleted` closes it. `chooseProject()` (shell index) opens the project picker the top bar uses.
- `ctx.dialog.confirm(title, body, ok)`: a button label starting with Delete, Remove, Discard, Overwrite or Replace is drawn as a danger button. `ctx.dialog.form(title, html)`: the HTML is placed inside the dialog's `<form>`; it resolves with its `FormData` on OK (after the browser's own validity check, so `required` and `pattern` work) or `null`. An element with `data-ok="Create"` names the OK button; any element with `data-wide` widens the dialog. Dialogs queue.
- `ctx.commands.register({ id, title, keys, run })`: listed in the palette (Ctrl or Cmd+K, also Ctrl+Shift+P); `keys` like `Mod+S`, `Mod+Shift+B` or `F5` (Mod is Cmd on macOS, Ctrl elsewhere); keys without a modifier do not fire while typing in a field or a CodeMirror editor. Registering the same id again replaces it. A rejected or thrown `run` becomes an error toast. Built in: Mod+1 to Mod+9 go to the panes in sidebar order, Mod+O opens a project, Mod+Shift+L switches the theme.
- `ctx.notify(message, level)`: toasts at the bottom right, four at most, errors stay 8 s.

Beyond the context, `src/shell/index.ts` exports `icon`, `appIcon(product, large?)`, `PRODUCTS`, `HOSTS` (the twelve host apps), `productName`, `esc`, `h`, `theme` (`mode()`, `tokens()` as the contract's flat extension tokens, `set`, `toggle`), `palette.pick(items, placeholder)` (a quick pick that resolves with the chosen id or null), `storage`, `lastArgs` and `VERSION`. `window.formextShell` carries the same for scripts and the demo.

---

## Styles {#styles}
- refers-to: src/styles/*
- kind: decision
- logged: v0.1.0 · 2026-11-07

`tokens.css` is a copy of FormPortal's `design/tokens.css` (the family's Studio Dark vocabulary, light theme under `[data-theme="light"]`) with one block added at the end: form.ext's hue `--hue-ext` `#4f6bff` (indigo, the farthest free colour from every hue in FormPortal's `app-hues.json`), the family gradient, the shell sizes, status colours (`--success`, `--warning`, `--info`, `--error`) and the layer aliases `--z-pane`, `--z-shell`, `--z-menu`, `--z-dialog-scrim`, `--z-dialog`, `--z-palette`, `--z-toasts`, `--z-tip`. Every `z-index` in the interface uses one of these tokens. `[data-product="<id>"]` sets `--hue` for each of the thirteen products, which `.app-icon` and `.chip.hue` use.

Components are plain classes: `.btn` (`.primary`, `.danger`, `.ghost`, `.sm`, `.lg`, `.icon`), `.field` with `.input`, `.select`, `.textarea` (`.code`), `.check`, `.switch`, `.list` and `.list-row` (`.interactive`, `aria-selected`), `.tabs` and `.tab` (`aria-selected`), `.chip` (`.accent`, `.success`, `.warning`, `.error`, `.info`, `.hue`), `.card`, `.grid-cards`, `.empty`, `.pane-head`, `.pane-body`, `.pane-fill`, `.toolbar`, `.section` and `.section-title`, `.kbd`, `.badge`, `.table`, `.code-block`, `.notice`, `.spinner`, `.split`.

---

## Theme boot {#theme}
- refers-to: index.html :: inline script · src/shell/theme.ts
- kind: decision
- logged: v0.1.0 · 2026-11-07

Studio Dark is the default whatever the system says; the light theme is the top bar's toggle. The choice is `localStorage['formext.theme']`, read by the inline script before any style sheet, which sets `data-theme` and `color-scheme` on the root, and the critical style paints the matching ground (`#111111` or `#ecebe6`), so a reload never flashes the other theme or white.

---

## Fonts {#fonts}
- refers-to: public/fonts · src/styles/base.css
- kind: decision
- logged: v0.1.0 · 2026-11-07

Inter (400, 500, 600) and JetBrains Mono (400, 500) latin woff2 are copied from `@fontsource` into `public/fonts` and declared with `font-display: block`; the Inter files and JetBrains Mono 400 (the code font of Docs, Check and Edit) are preloaded, so text never reflows when the font arrives (without the mono preload Docs measured CLS 0.0013 as table columns widened). Both are OFL-1.1.
