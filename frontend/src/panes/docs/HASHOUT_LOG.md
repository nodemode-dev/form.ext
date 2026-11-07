# HASHOUT_LOG · docs · form.ext

Living log of the Docs module: the Docs pane (`frontend/src/panes/docs/`), the app API copies (`docs/apps/`), the manual (`docs/MANUAL.md`), the wiki (`.docs/wiki/`) and the SDK package (`sdk/`). Source files stay comment-free; what they would have said lives here.

Current build version: v0.1.0
Last updated: 2026-11-07 · v0.1.0 docs

---

## Org-navi-map

```
frontend/src/panes/docs/
├── index.ts      the pane: sources, nav, article, table of contents, search, links, commands
├── markdown.ts   the Markdown renderer (no dependency)
└── docs.css      pane layout and the .md article typography
docs/
├── MANUAL.md     the whole app, also shown as Docs > Manual
└── apps/<product>.md   cp of /home/claude/repos/<repo>/docs/EXTENSIONS.md, never edited here
.docs/wiki/       Home, Getting-Started, Making-Extensions, Shipping, Contract, SDK, Agents, Form-Family, Architecture, Desktop, Releasing, _Sidebar
sdk/              @formai/ext: src/formext.ts (cp of contract/sdk/formext.ts), dist/formext.js and .d.ts (tsc), package.json, tsconfig.json, README.md, LICENSE (cp)
```

---

## Sources are bundled {#sources}
- refers-to: index.ts :: SOURCES, DOCS
- kind: decision
- logged: v0.1.0 · 2026-11-07

`import.meta.glob([...], { query: '?raw', import: 'default', eager: true })` pulls `contract/CONTRACT.md`, `sdk/README.md`, `docs/MANUAL.md` and `docs/apps/*.md` into the bundle as strings (Vite's `server.fs.allow: ['..']` lets the dev server read outside `frontend/`). Docs therefore needs no engine route, works offline, in the frozen app and in the file:// demo, and the first paint already holds the article. A source missing at build time leaves its nav row disabled ("Not in this build"); nothing fails. About 150 KB of text, rendered lazily per document and cached.

App pages are copied with `cp` from each app's `docs/EXTENSIONS.md` (product to repo: `formmd` is `form.md`, `formmcp` is `formMCP`). Refresh them before a release; the copies are the only place form.ext reads an app's API from, and the templates service reports `docs/apps/<product>.md` as each product's `docs`.

---

## The renderer {#markdown}
- refers-to: markdown.ts :: render, blocks, inline
- kind: decision
- logged: v0.1.0 · 2026-11-07

Written here rather than taken as a dependency: the family's docs use a small subset. Blocks: ATX headings (GitHub-style ids, duplicates get `-1`, `-2`), fenced code (language label, copy button), GFM tables (alignment, `\|` inside cells), blockquotes, ordered and unordered lists nested by indentation (tight lists render without `<p>`), rules, paragraphs. Inline: code spans first (held in placeholders so nothing inside them is touched), backslash escapes, links and images (images become links: no remote loads in the app), `<url>` and bare `https://` autolinks, strong, emphasis (`_` only at word boundaries, so `snake_case` stays), strikethrough, hard breaks. All text is escaped; raw HTML is shown as text; `javascript:`, `data:` and `vbscript:` links render as plain text. `render` returns `{ html, headings, title, text }`; `text` feeds search counts.

A link resolver maps hrefs per document: `#anchor` stays in the page; `CONTRACT.md`, `MANUAL.md`, `sdk/README.md` and `<product>.md` (any folder) open that document in Docs, with the anchor; `http(s):` and `mailto:` are external; anything else (`PLUGINS.md`, `FORMAT.md` in an app's page) is a dotted, unlinked span with the target as its title.

---

## The pane {#pane}
- refers-to: index.ts :: mount · docs.css
- kind: interface
- logged: v0.1.0 · 2026-11-07

Order 10 in Learn. `mount` writes the whole layout (head with the project's app button, a three-column grid: nav with search, article, On this page) and renders the remembered document (`localStorage['formext.docs.doc']`, default the contract) in the same task, so the first paint is final. Switching documents swaps the article's HTML and the table of contents; scroll positions are kept per document for the session. Below 1100 px the table-of-contents column collapses to zero width (`visibility: hidden`) instead of being removed.

- Links: every click inside the article is handled (`preventDefault`), so the shell's `#/<pane>` hash is never touched. External links open with Tauri's shell plugin (`plugin:shell|open`, allowed by `shell:allow-open`) in the desktop app and `window.open` in a browser.
- Search (2+ characters, 140 ms debounce): each nav row shows its match count and rows with none dim; matches in the open article are wrapped in `mark.docs-hit` by a TreeWalker and unwrapped (with `normalize`) before the next search, so the article is never re-rendered for a search. Enter and Shift+Enter step, Escape clears. When the open page has no match, the first page that has one opens.
- Scroll spy: on scroll (one rAF), the last heading above the top marks its TOC link `aria-current`; only changed attributes are written.
- The head button opens the API page of the open project's app (`ctx.project.onChange`); disabled without a project.

Other panes open it with `ctx.openPane('docs', { doc, anchor?, query? })`: `doc` is `manual`, `contract`, `sdk`, a host product id, or `project` (the open project's app); `anchor` is a heading id (GitHub-style slug, for example `document-read`); `query` fills the search.

Commands: Docs: Extension Contract, Docs: SDK reference, Docs: form.ext Manual, Docs: Search, and Docs: <App> API for each of the twelve hosts. No keys are bound.

---

## The SDK package {#sdk}
- refers-to: sdk/**
- kind: interface
- logged: v0.1.0 · 2026-11-07

`@formai/ext` 0.1.0, Apache-2.0, ESM. `src/formext.ts` is byte-identical to `contract/sdk/formext.ts` (check with `cmp`). `npm run build` (`tsc -p tsconfig.json`, TypeScript 7.0.2 from `frontend/node_modules` works too) emits ES2020 `dist/formext.js` and `dist/formext.d.ts`, comments removed, `useDefineForClassFields: false` so the parameter properties of `FormExtError` assign after `super`. `sideEffects` names the module because it creates the `formext` client on import. `npm pack --dry-run` packs six files (README, LICENSE, package.json, src, the two dist files).

The built `dist/formext.js` was run in a real `sandbox="allow-scripts"` frame served with the contract's CSP by the preview route: `host.hello` (theme applied), `ui.notify`, a `-32001` rejection with `ERR.PERMISSION`, and `ext.activate` answered. Check (`validate_folder`) treats the file as the SDK (it holds `class FormExt` and `host.hello`) and reports nothing on it.

---

## Open items {#open}
- kind: note
- logged: v0.1.0 · 2026-11-07

- JetBrains Mono is not preloaded in `frontend/index.html` (Inter is), so its arrival shifts code-heavy layout once (measured CLS 0.0013 on Docs, from table column widths). Requested from FX1/FX13 in the requests file: preload `/fonts/jetbrains-mono-latin-400-normal.woff2`.
- The manual's command line and MCP sections and `.docs/wiki/Agents.md` were checked against `backend/app/cli.py` (its `OPS` table, read while that module was still landing). If FX9 renames an op, update both.
