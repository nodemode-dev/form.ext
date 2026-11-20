# HASHOUT_LOG · frontend · form.ext

Living log for the interface: the shell, the shared styles and the build files. Source files stay comment-free; what they would have said lives here. Each pane keeps its own `src/panes/<name>/HASHOUT_LOG.md`.

Current build version: v0.9.0
Last updated: 2026-11-20 · v0.9.0 the shared panel at module 2.2.1 (#panel-221). Before: v0.8.0 the version only. Before: v0.7.0 the shared panel at module 2.2.0 and Antigravity as the fourth agent tab (#panel-four). Before: v0.6.0 the Form family's shared terminal panel and its question for outside agents (#family-panel). Before: v0.5.0 the window key, the question for outside agents and AMOLED Black (#window-key, #agent-consent, #amoled). Before: v0.4.1 the demo's `engine/kit.ts` refuses an `entry.ui` ending in `/` (`demo/HASHOUT_LOG.md`). Before: v0.4.0 the host source row in the Studio and Open pull request in Publish (`panes/studio/HASHOUT_LOG.md#source`, `panes/publish/HASHOUT_LOG.md#pull-request`). Before: v0.3.1 the version only. Before: v0.3.0 the demo opens in the app (#in-app-demo). Before: v0.2.1 the README's screenshots and the community files

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
    ├── demo/             the in-app demo and the browser demo's page engine (see #in-app-demo)
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

## AMOLED Black {#amoled}
- refers-to: index.html :: inline script and critical style · src/styles/tokens.css :: `:root[data-theme="amoled"]`, `:root[data-oled]` · src/shell/theme.ts · src/shell/settings.ts :: themes row · src/styles/settings.css :: `.pf-swatch.ob` · src/shell/shell.ts :: renderTheme · src/styles/shell.css :: `.fx-dialog` · src/panes/home/home.css :: `.home-start`
- kind: decision
- logged: unreleased

The family's true-black theme for OLED screens, id `amoled`, label "AMOLED Black", the third swatch in Preferences, Interface, Theme. form.ext is not on the formvis theme system: its picker is two swatches and `ThemeMode`, its tokens are `--bg-*`, `--border-*`, `--text-*` with the shell names (`--ground`, `--pane`, `--float`, `--ink`, `--edge`) derived from them, so the profile is a `:root[data-theme="amoled"]` block of the family table's values in those names (`--bg-primary` and `--bg-secondary` `#000000`, `--bg-tertiary` `#141414`, borders `#262626` and `#3a3a3a`, text `#ededed`, `#a6a6a6`, `#858585`). The accent stays form.ext's orange. `theme.ts` keeps an `OLED` table and sets `data-oled` on the root for an oled mode, touching it only when it changes; `color-scheme` is dark for it. The toggle in the top bar stays light or dark (from AMOLED it goes to light); its icon is now replaced only when it changes, because the switch between two dark modes rebuilt the button's SVG.

Pre-paint: the inline script accepts `amoled`, has its own `OLED` table and sets `data-oled` beside `data-theme`; the critical style paints `html[data-oled]` black. The same style now hides the body-level overlays (`.fx-scrim`, `.fx-dialog`, `.fx-palette`) until `app-ready`: from the dev server their markup showed unstyled for the first frame (the palette's search icon as a white ring across the window, the dialog buttons) before the CSS arrived. That predates AMOLED, but it was the only non-black on the first frame.

`:root[data-oled]` carries the true-black exceptions, on the flag and not the theme id: hover and soft dividers at 10% and 12% white, and the three hard-coded near-blacks found by measuring (every element over 12,000 px2 with a fill that was not black, on Home and in the Studio): `--main` (`#050505`, the window and Studio ground), `--bar` (`#0c0c0c`, title bar, status bar and the Studio panels) and `--terminal` (`#0c0f10`). Two rules hang on it outside the tokens: the Home start card's blue gradient and the dialogs (`.fx-dialog`, so the consent dialog too) are black, with their borders. Left as they are: fields (`#141414`, by the spec) and the Home demo art (an illustration).

Checked against the Vite dev server and an engine from source, headless Chrome 1440 by 900, 4x CPU throttle, 150 ms and 1.6 Mbit/s, cache off: cold load and hard reload with `amoled` saved, every frame from navigation to ready (about 30 each, ready at 37 to 47 s) black at the window's corners and centre and at the corners and centre of each large surface (no sample non-black where the settled window is black; samples that land on text are counted apart). Live switch Studio Dark to AMOLED Black and back: 3309 elements with the same identity, no node added or removed, no box moved. The consent dialog under AMOLED: black with a `#3a3a3a` border, text `#ededed` and `#a6a6a6`, Deny refused the call.

---

## Fonts {#fonts}
- refers-to: public/fonts · src/styles/base.css
- kind: decision
- logged: v0.1.0 · 2026-11-07

Inter (400, 500, 600) and JetBrains Mono (400, 500) latin woff2 are copied from `@fontsource` into `public/fonts` and declared with `font-display: block`; the Inter files and JetBrains Mono 400 (the code font of Docs, Check and Edit) are preloaded, so text never reflows when the font arrives (without the mono preload Docs measured CLS 0.0013 as table columns widened). Both are OFL-1.1.

---

## README screenshots and icon {#readme-shots}

- refers-to: README.md · assets/*.webp · assets/app-icon
- kind: decision
- logged: v0.2.0 · 2026-11-08

The README's screenshots predated the redesign, the Terminal and the Home button. They are now taken from the running interface and engine (`./formext`, with the first-party `.formpkg` files from `demo/packs` imported into a separate data folder) with Playwright at 1440 by 900 and device scale 2, saved as WebP quality 85 in `assets/`: Home in dark and light, New, the Studio editor, Check, Preview with the simulated FormLit, Package and Sign, the Terminal (Mod+J) and Preferences. The old PNGs, including Run, Library, Docs and Publish, which need FormPortal or the registry to show anything real, are removed and those two features are described in text. The header icon was already the owner's new art (`assets/app-icon`, the same pixels as the design files); the `<picture>` now has one dark source with the light icon as the fallback.

---

## Home control {#home}

- refers-to: index.html · src/shell/shell.ts · src/shell/menus.ts · src/styles/shell.css
- kind: decision
- logged: v0.2.0 · 2026-11-08

The sidebar shows only on the start pages, so inside the Studio there was no way back except the File menu. The family answers with three: the app name in the title row, a Home button first in the right-hand group, and File, Home with Mod+Shift+H. All three run one command, `shell.home`, so the macOS menu bar, the in-window menus, the buttons and the shortcut cannot disagree. Both buttons exist in `index.html` at their final size (the name already had its box, the button is one of the 28 px `.fx-tb-r` cells), and script only paints the icon and sets `aria-current` on Start, so nothing is added after first paint and nothing shifts.

## Family redesign: title row, start-only sidebar, menus, Preferences {#redesign}
- refers-to: index.html · src/shell/shell.ts · src/shell/menus.ts · src/shell/native-menu.ts · src/shell/menubar.ts · src/shell/settings.ts · src/styles/shell.css · src/styles/settings.css
- kind: decision
- logged: v0.2.0 · 2026-11-08

The window follows the approved fourth-pass design (`/home/claude/design/formext`). The family sidebar (Home, Recent, Registry, Learn, Docs; Preferences and Help at the foot; 49 px rail through the edge handle, key `formext.rail`) shows only on the start pages, so every pane declares `view`: `start`, `studio` or `part`. The root carries `data-layout` and `data-rail`, set by the boot script in `index.html` before the first paint, so a reload never shows the other layout. The top row is 38 px (`--title-h`): menus on the left where they are in the window, the open project (macOS only, where the menus are the system's), the app name and three 28 px buttons. The ground is #0a0a0a and the panels use the kit palette tokens (`--main`, `--bar`, `--raise`); the primary button is white in dark and ink in light, and orange stays the accent.

Menus come from one list (`menus.ts`, the groupings of PRESENT.md) used twice: `native-menu.ts` builds the macOS menu bar with `@tauri-apps/api/menu` (app menu first; system Undo, Copy and the rest are predefined items, so `text_edit` is not needed), and `menubar.ts` draws the same list in the title row elsewhere. `has-native-menus` and `has-overlay-titlebar` are set by the boot script when Tauri runs on a Mac, so the in-window menus never flash before the native ones. Preferences (`settings.ts`) is FormVis's SettingsDialog in form.ext's tokens: rail with wire and port, foldable cards, Done; one `GET /api/settings` at boot and a debounced `PUT` per change; `settings.changed` carries the result (editor font size is the `--edit-font` variable, tab size and wrapping reach the editor for files opened afterwards). The Layout row of the mock (hide the inspector) is not built: the inspector is a tab strip, not a toggled column.

Part panes keep their own query helper but it falls back to `document.querySelector`, since their pieces move out of their root into the Studio's zones; class names are pane-unique. Receiving zones carry the old pane class (`pv-pane`, `check-pane`) so the pane stylesheets still apply.

## The demo opens in the app {#in-app-demo}
- refers-to: src/demo/mode.ts · src/demo/commands.ts · src/demo/inapp.ts · src/demo/transport.ts · src/demo/downloads.ts · src/demo/engine/ · src/main.ts · src/shell/api.ts · src/shell/storage.ts · src/shell/events.ts · src/shell/menus.ts · src/panes/home/ · index.html · ../scripts/demo-media.mjs
- kind: decision
- logged: v0.3.0 · 2026-11-09

The family rule is that every demo opens from inside the app. form.ext's demo is not a document but the studio in a prepared state (Golden Hour, Mail Merge and Rating Desk, a publisher key, a simulated FormPortal folder), so opening it puts the real window into a demo mode that cannot reach the user's data. The browser demo already had the engine for that: a TypeScript port of every route over a virtual disk. It moved from `demo/src/engine/` to `src/demo/engine/` unchanged except for import paths and one line in `seed.ts` (the sample project id is stored through `storage`), and the request path moved to `src/demo/transport.ts`; `demo/src/api.ts` now re-exports the shell's `ApiError` and the shared transport, so both demos run the same code and `instanceof ApiError` holds in each.

How it switches: Open Demo (Home, Demos; Help, Demo: The Studio with Sample Projects; the palette command `demo.studio`) asks first, offers Save All when the Studio's `beforeunload` guard reports unsaved files (the guard is asked with a synthetic cancelable event, so the Studio needs no new export), clears `formext.demo.*`, sets `sessionStorage['formext.demo'] = 'studio'` and reloads on `#/home`. A reload rather than an in-place swap means no pane keeps a real project's buffers, terminals or sockets. The boot script in `index.html` turns the flag into `data-demo="studio"` before the first paint; `main.ts` then imports `src/demo/inapp.ts` (its own chunk, so the normal window does not load the engine port), which installs a transport into `shell/api.ts` (`useTransport`: every `request` and `apiUrl` goes to the page engine, never to `fetch`), fetches the thirteen registry packages from `public/demos/studio/`, seeds the sample disk and only then boots the shell. `events.connect()` opens no `/api/live` socket in demo mode, the Terminal and Chat routes answer 404 from the page engine, so no shell starts, and the health answer reads "demo in this window" in the status bar. Measured: zero engine requests and zero files written under the engine's data folder during a demo session.

Storage: `storage.ts` maps every `formext.*` key except the theme and the rail width to `formext.demo.*` while in demo mode, and the boot script reads `formext.demo.pane`, so the last project, the last pane, open tabs and pane filters of the user are never overwritten and the layout is right on first paint. The page engine's disk is `formext.demo.disk`, inside the same prefix, so Leave the Demo (the Demo button in the title bar, Help, Leave the Demo, or Home's Leave Demo) removes it all with one sweep, drops the flag and reloads into the user's own projects. The flag lives in sessionStorage, so quitting the app also ends the demo. Not covered: the contract kit's host bridge keeps Preview grants and extension storage in its own `localStorage` keys (`formext.store.<id>`), which the kit owns and this repository does not edit; a demo preview of Golden Hour shares that sandbox store with a real preview of an extension with the same id.

No layout shift: the Demo button sits in `.fx-tb-r` in `index.html` at its final size and is shown by `:root[data-demo="studio"]`; the Home Demos card has both button sets in its first markup and CSS picks one. The browser demo build sets `data-demo="page"`, which hides Home's Demos section and makes `demo.studio` its existing Start Over. The registry packages ship as files written by `node scripts/demo-media.mjs` from `demo/packs/packages.js` (13 packages, 207,997 bytes). The MCP server has no window channel, so no MCP tool opens the demo; agents use the palette command in the window.

## The window key {#window-key}

- refers-to: src/shell/window-key.ts · src/shell/api.ts · src/main.ts · src/panes/studio/terminal.ts · src/panes/studio/chat.ts
- kind: decision
- logged: unreleased

The engine refuses every POST, PUT, PATCH and DELETE without the header `X-Formext-Window-Key` (backend `HASHOUT_LOG.md#window-key`). `main.ts` starts `loadWindowKey()` beside `boot()` (never in the demo, which has no engine: not in the in-app demo, and not in the browser demo, `data-demo="page"`, where the claim was a fetch of `file:///api/window/key` that the console showed as an error until v0.10.0): the desktop shell's `window.__FORMEXT_WINDOW_KEY` first, read once and deleted; otherwise the key this tab kept in `sessionStorage` (`formext.window-key`); otherwise the one-time `POST /api/window/key`, which only a source run (no shell) offers. `request()` in `api.ts`, the one helper every pane uses, waits for that and sends the header on every call; after a 403 on a write in a source run it claims once more and retries once, which recovers when the engine was restarted (a new engine has a new key and an unclaimed bootstrap). A second tab of a source run gets no key and its writes are refused: one window per engine launch.

Sockets: the terminal stream and the Chat stream send `windowHello()` (`{"type": "window", "key"}`) as their first message on open; the engine closes them with 4403 otherwise. `/api/live` carries only events and stays as it was. There are no other raw `fetch`, XHR, `sendBeacon` or `EventSource` calls outside `api.ts` and the demo (whose `demo/inapp.ts` reads its own static files). Nothing is drawn, so nothing moves.

Checked in headless Chrome against Vite and a running engine: the page boots (Home), claims the key once, `PUT /api/settings` and a terminal from the page succeed with the header, the terminal socket echoes a command after the hello, a reload writes with the stored key and claims nothing, and after the engine restarts the first write is refused, reclaimed and retried. Not checked: the packaged window (no shell build here).

## FormVis token names, names only {#fv-names}

- refers-to: src/styles/tokens.css
- kind: decision
- logged: unreleased · 2026-11-20

form.ext keeps its own palette and its three themes, and every token name of FormVis's token file (`frontend/src/styles/tokens.css` at FormVis `origin/main`, 154 names) now resolves here, so a stylesheet or a shared module written in FormVis's names works in form.ext unchanged. 54 of those names were already defined and keep form.ext's values, the z-index values included (`--z-raised` 100, `--z-chrome` 300, `--z-overlay` 600, `--z-toast` 800 and the rest of the site scale). The other 100 are one block after the form.ext block, each defined from a form.ext token where one means the same thing, otherwise with FormVis Studio Dark's value: `--bg-node` and `--surface-2` from `--raise`, `--canvas-bg` from `--main`, `--cta-bg`, `--cta-text` and `--text-on-cta` from the primary button's `--pri-bg` and `--pri-ink`, `--cta-bg-hover` with the primary button's own hover mix, `--transition-fast`, `--transition-normal` and `--ease-glass` from `--dur-fast`, `--dur` and `--ease-out`, `--space-8` from `--sp-6`, `--ok` from `--success`, `--warn` from `--warning`, `--danger` from `--error`, `--z-under` from `--z-behind`, `--z-modal` and `--z-settings` from `--z-dialog`, `--z-context` from `--z-menu`, and `--cv-titlebar-h`, `--cv-status-h`, `--cv-rail-w`, `--cv-row-h` from `--title-h`, `--statusbar-h`, `--sidebar-rail-w`, `--row`. FormVis's derived names (`--surface-*`, `--line-*`, `--accent-soft` and its kin, `--glass-*`) keep FormVis's expressions, which read form.ext's own `--bg-*`, `--border-*`, `--text-*` and accent, so they follow every theme. `--fs-16` and `--fs-18` are pixels, because this root's `rem` is 13px. FormVis's light-theme values of `--group-head`, `--line-0` and `--surface-raised` and its true-black values of `--surface-1` and `--line-0` sit under `[data-theme="light"]` and `[data-oled]`. No existing name was given another value and no rule was changed; nothing in form.ext reads the new names yet (the `--ok`, `--warn` and `--danger` in `src/sim/apps/` are keys of the simulated apps' own token maps, not reads of this root).

Checked: the browser demo built from the tip before and after, opened from `file://` at 1440 by 900 in Studio Dark, light and AMOLED Black on Home, the Studio with Golden Hour and Docs: the resolved value of all 344 names on the root was dumped in each theme; the 244 that resolved before are unchanged and the 100 new ones resolve. In the first run the nine screenshots were the same bytes; in two more runs eight were, and the AMOLED Studio differed in 379 pixels, the bracket highlight of CodeMirror's first and last line, which the same build without the change also drew in its first run (its timing, not a token).

## The shared panel at module 2.2.1 {#panel-221}

- refers-to: src/dock/ · ../setup/agents.py · ../tests/test_dock_module.py · ../docs/MANUAL.md
- kind: decision
- logged: v0.9.0 · 2026-11-20

`src/dock/` is module 2.2.1, every file of the folder copied unchanged from FormVis commit 23b01889 (`git show` per file, `MANIFEST.json` included); three files differ from 2.2.0: `strings.ts` (the guide's `tourInstalledBody` and `tourReadyBody` now end with "Codex, Cursor and Antigravity each get a button of their own here when they are on this computer."), `CONTRACT.md` and `MANIFEST.json`. `setup/agents.py` `DOCK_VERSION` says 2.2.1. The adapter needed no change. form.ext carries no translations of the panel's sentences, so there was nothing to translate. The manual's sentence about the Studio's own tabs under Ask now names all four programs, as the Preferences note already did. There is no Preferences field for where Claude Code is (the four programs are found by the shared finder, with `FORMEXT_CLAUDE_BIN`, `FORMEXT_CODEX_BIN`, `FORMEXT_CURSOR_BIN` and `FORMEXT_ANTIGRAVITY_BIN` already alike), so no program path was added.

## The shared panel at module 2.2.0, and Antigravity as the fourth agent tab {#panel-four}

- refers-to: src/dock/ · src/dock-adapter.ts · ../setup/agents.py · ../agents/manifest.json · ../tests/test_dock_module.py · ../backend/HASHOUT_LOG.md#antigravity-tab
- kind: decision
- logged: v0.7.0 · 2026-11-19

`src/dock/` is now module 2.2.0, copied whole from FormVis (commit ddc893ae; 15 files and `MANIFEST.json`, each hash checked against the manifest; `agents.ts` is new) and still never edited here. `setup/agents.py` `DOCK_VERSION` says 2.2.0. This supersedes "module 2.1.0" in #family-panel below; the rest of that entry holds. In 2.2.0 the panel takes its agent kinds from the adapter, so a fourth program is the adapter's to name.

The adapter is `DockAdapter<'antigravity'>`: `tabs().builtin` lists `antigravity` after `cursor`, `agentStatus()` passes the engine's `antigravity` answer on (`signedIn` stays null), the terminal record is `DockTerminal<'antigravity'>`, and `terminal.open('antigravity', ...)` goes to the same `POST /api/terminal/agent` as Codex and Cursor. `StudioDock.dock` is `Dock<'antigravity'>`. `keyHeaders: () => ({})` was left as it is (2.2.0 makes it optional). The optional steps of the module's moving notes (automation ids, `status` on a record, `note`) were not taken.

`agents/manifest.json` lists the tab (`dock.tabs`), written by `./formext agents sync`; `tests/test_dock_module.py` now expects 15 files in the module's manifest and the tab list with `antigravity`, because both are what this change makes true.

Checked: `tsc --noEmit` with the repository's `tsconfig.json` on a copy of `frontend/` outside the tree, 0 errors. Not looked at in a browser, and no build was made: the button, the row in the menu and the tab were not seen in a window. The engine side was run (backend log).

## The shared terminal panel and its question dialog {#family-panel}

- refers-to: src/dock/ · src/dock-adapter.ts · src/styles/dock-tokens.css · src/panes/studio/zones.ts · ../setup/agents.py · ../tests/test_dock_module.py
- kind: decision
- logged: v0.6.0 · 2026-11-19

`src/dock/` is the Form family's shared terminal panel, module 2.1.0, copied whole from FormVis and never edited here: `./formext agents sync` (and `sync --check`, and `tests/test_dock_module.py`) fail, naming the file, when a file there differs from `MANIFEST.json`, is missing or is extra, when the manifest names another module version than `setup/agents.py` `DOCK_VERSION`, or when a file in the folder imports from outside it. When the module does not fit, `src/dock-adapter.ts` absorbs it. The Studio's Terminal tab hosts the panel and the reasons for every choice are in `src/panes/studio/HASHOUT_LOG.md#family-panel`.

The question for outside agents (#agent-consent below) is now the module's dialog: `src/shell/consent.ts`, the `.fx-consent` markup in `index.html` and its rules in `shell.css` are removed. What stays from that entry: `events.ts` still says the window hello on `/api/live`, the engine still counts only such a socket as a window, and Preferences keeps the Outside agents select and the broken-seal note. The dialog's own broken-seal line is the module's `consentChanged`, read through `storedChoice.get()` each time the dialog opens. The Preferences note now also says that Blocked stops the Studio's own tabs.

## Outside agents ask in the window {#agent-consent}

- refers-to: index.html · src/shell/consent.ts · src/shell/events.ts · src/shell/shell.ts · src/shell/settings.ts · src/styles/shell.css
- kind: decision
- logged: unreleased · the dialog itself is replaced by #family-panel

The engine asks the window before an outside agent or the command line changes anything while Settings, Agents, Outside agents is Ask (backend `HASHOUT_LOG.md#agent-consent`). `events.ts` sends `windowHello()` on the `/api/live` socket once the key has loaded; the engine counts only such a socket as a window. On `window.refused` (a source run whose engine restarted) it reclaims the key once and says hello again. `consent.ts` listens for `window.admitted`, `agents.ask` and `agents.answered`, reads `GET /api/agents/requests` through `api.ts` (with the key) and shows the first request; Deny, Allow once and Always allow post the answer, Escape is Deny, and focus starts on Allow once. The dialog and its scrim are static markup in `index.html`, built once and shown with the `open` class, so nothing behind it is created or moved; it reuses `.fx-dialog` and `.fx-scrim`, so the z-index comes from `--z-dialog` and `--z-dialog-scrim`. The shield is hand-made inline SVG with `currentColor`. form.ext has no i18n table; strings are English in place, as elsewhere in the shell.

A broken seal (the stored choice was edited outside form.ext) shows "The saved agent permission was changed outside form.ext, so it is back to Ask." in two places: a `hidden` paragraph inside the consent dialog, set before the dialog opens, and a settings note row with `when: 'agentAccessReset'`, set in `sync()` before the settings sheet is shown. Settings gains the Outside agents select (`agent_access`: Ask, Allowed, Blocked).

Checked in headless Chrome (1440 by 900, 4x CPU throttle, cache off) against Vite and a running engine: three loads, one bootstrap request in all, a write from the page succeeds after each; `/mcp` `new` answered with Allow once (ran), Deny (refused) and Always allow (ran; the choice became `allowed`); the dialog element was the same node every time and the box of `.fx-main` was the same before, during and after; no console errors. After a hand edit of `settings.json`, the sentence shows in the dialog and in Settings, and the select reads Ask.
