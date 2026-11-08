---
name: interface
description: "form.ext's vanilla TypeScript and Vite interface: the shell (38 px title row, native and in-window menus, start sidebar, status bar, palette, dialogs, Preferences, toasts, theme boot), ShellContext and the pane contract, the panes Home, New, Studio (CodeMirror 6 and the zones compositor), Preview with the simulated hosts in src/sim, Check, Library, Run in App, Package, Publish and Docs, the tokens and component classes, and the zero-flash rules. Use when adding or changing a pane, a shell feature, styles, or fixing a flash, flicker or layout jump."
---

# interface

## The pane contract

A pane is `frontend/src/panes/[name]/index.ts` exporting `export const pane: PaneDef` (`id`, `title`, `icon`, `order`, `group` make, ship or learn, `mount(el, ctx)` returning an optional cleanup) and importing its own `[name].css`. `view` is `start` (a page beside the start sidebar: home, new, docs), `studio` (the full-window editor, id `studio`) or `part` (library, check, preview, package, publish, run: mounted hidden, their DOM pieces moved into the Studio's left, centre, right, bottom and sheet zones by `panes/studio/zones.ts`). The shell finds panes with `import.meta.glob`, builds one `section.fx-pane` per pane before the window shows, and mounts a pane on first open. The layout is `data-layout` and `data-rail` on the root, set pre-paint by the boot script in `index.html`. A part's `q()` falls back to `document.querySelector` because its pieces leave its root. Menus are listed in `shell/menus.ts`; `native-menu.ts` builds them as the macOS menu bar, `menubar.ts` in the window elsewhere; Preferences is `shell/settings.ts` with `styles/settings.css`.

## ShellContext

- `ctx.api.get/post/put/del(path, body)`: JSON in and out; failures throw `ApiError` with `status` and FastAPI's `detail`.
- `ctx.events.on(name, cb)`: the engine's `/api/live` events plus `live.status`, `shell.project`, `shell.theme`, `pane.open`.
- `ctx.project.current()`, `onChange`, `open(id)`; `ctx.openPane(id, args)` (`lastArgs(id)` reads them later); `ctx.commands.register`; `ctx.dialog.confirm` and `form`; `ctx.notify`.
- Shared helpers from `../../shell`: `icon`, `appIcon`, `PRODUCTS`, `HOSTS`, `productName`, `esc`, `h`, `theme`, `palette`, `storage`.

The full notes are `frontend/HASHOUT_LOG.md` (#panes, #ctx, #styles, #theme).

## Zero flash

- The pane's markup is final in its first render: write every container, then fill text and attributes in place. Never replace a container's `innerHTML` on refresh; update keyed rows.
- The window is revealed after the first pane mounts; the theme is set by the inline boot script before any style sheet (`localStorage['formext.theme']`).
- A project switch or a live event updates only what changed; `project.changed` reaches subscribers only when name, product, folder or manifest changed.

## Styles

`src/styles/tokens.css` is FormPortal's Studio Dark tokens plus form.ext's hue `--hue-ext` `#4f6bff` and the layer tokens (`--z-pane` to `--z-tip`): every `z-index` uses one. Components are plain classes (`.btn`, `.field`, `.list-row`, `.tabs`, `.chip`, `.card`, `.empty`, `.pane-head`, `.pane-body`, `.pane-fill`, `.table`, `.notice`). A pane's CSS uses tokens only. Icons are inline `currentColor` SVG from `src/shell/icons.ts`; no icon libraries.

## Preview and the simulated hosts

`src/sim/apps/[product].ts` is each app's simulated host (`AppSim`: document state, reads, commands, events, offers, tokens), driven through the contract's `host-bridge.ts`. Keep each simulation in step with that app's `docs/apps/[product].md`; an op the real app lacks must fail with -32004 here too.

## Dependencies

npm packages are pinned exactly in `frontend/package.json`, and each shipped one has a row in `NOTICE.md`. CodeMirror 6 is the only editor; no UI frameworks.
