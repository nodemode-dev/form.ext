# form.ext browser demo

The real form.ext interface, running in a browser with nothing behind it. Open `demo/index.html` by double-clicking it, or serve the `demo/` folder with any static server. No engine, no Tauri, no network and no CDN: every script, style, font and package the demo uses is in this folder.

## What it shows

The interface is the repository's own: `frontend/index.html`, the shell, the tokens and every pane (Home, New, Edit, Preview, Check, Library, Run in App, Package, Publish, Docs) are built from `frontend/` unchanged. Only one module is swapped: the shell's `api.ts`, which talks to the FastAPI engine, is replaced at build time by `demo/src/api.ts`, which hands each request to an engine written for the page (`demo/src/engine/`). It answers the same routes with the same JSON as `backend/app`, and keeps the data folder in a small virtual disk saved in the browser's local storage.

The demo opens on a sample workspace with Golden Hour (the first-party FormLit extension) open:

- **Home and New.** Recent projects, the twelve apps and the starters. New writes a project from the real templates in `templates/`, with the same files, ids and README the engine writes.
- **Edit.** The file tree, CodeMirror and the manifest form, saving into the virtual disk; the save fires `project.changed` like the engine does, so Preview and Check follow.
- **Preview.** Runs the extension in the contract kit's own host bridge (`contract/host/host-bridge.ts`) inside the simulated app, with consent, the message log, events and permissions. Golden Hour draws its sun path and tags photos in the simulated FormLit catalogue; Mail Merge reads the simulated FormPDF form; every first-party package in the Library runs the same way. See "How Preview keeps the sandbox" below.
- **Check.** A line-for-line port of `backend/app/services/validate.py` with the kit's `formpkg` rules and `package.schema.json`. On the seventeen first-party packages in this build's pack and all thirty-six starters it gives the same problems, files, lines and messages as the Python engine.
- **Library.** The Examples shelf lists the first-party packages, which ship in `packs/packages.js`; Inspect reads any `.formpkg` you choose (zip parsing, entry checks, Check, a rebuild), Import turns it into a project, and Compare Builds diffs two builds or a build and the current files, manifest and lines.
- **Package.** Builds a real `.formpkg` in the page: Check first, then the kit's rules (sorted entries, 1980-01-01 timestamps, mode 0644, deflate) written by `src/engine/zip.ts` with the browser's own deflate. The SHA-256 is real, Download saves the file, Check Reproducibility builds twice and compares, and Sign makes an Ed25519 signature with WebCrypto that Verify checks. Publisher keys are made in the page and can carry a passphrase.
- **Run in App.** Writes `dev.json` into a simulated FormPortal folder (`/home/demo/.local/share/formportal`) whose `installed.json` lists FormLit, FormPDF, FormCut, FormVis and FormPortal, and shows the host's verdict through the port of `formext_host.check`.
- **Publish.** Prepares the submission folder (package, `entry.json`, `extensions.json` checked against the schema, README, `submission.json`); Open Folder saves the folder as a zip, Send to FormPortal installs it into the simulated FormPortal.
- **Docs.** The manual, the contract, the SDK and each app's API page, bundled as in the app.

A palette command, "Demo: Start Over with the Sample Projects", clears the virtual disk and brings the sample back.

## How Preview keeps the sandbox

A page opened from `file://` cannot serve `/api/preview/{id}/files/...`, so the demo engine hands the kit's bridge a record whose `entryUi` is a `data:text/html` document built from the package and whose `base` is empty. The bridge is untouched: it still creates the frame with `sandbox="allow-scripts"`, `allow=""` and `referrerpolicy="no-referrer"`, sets `src` to `base + entryUi`, and talks only through `postMessage`. The document is built like this:

1. Every `.js` and `.mjs` file in the package becomes a `data:text/javascript` module. Relative import specifiers are rewritten to absolute addresses under `https://package.formext.invalid/{id}/{version}/`, which no request ever reaches: an import map maps each address to its data module and gives its SHA-256 in the map's `integrity` table.
2. Each `<script src>` of the entry page becomes an inline module that imports its file; stylesheets are inlined as `<style>`, and relative `url()`, `src` and `poster` values become `data:` addresses.
3. A `<meta http-equiv="Content-Security-Policy">` goes first in the head: `default-src 'none'; script-src` the SHA-256 of the import map, of each inline entry and of each package module, then `'wasm-unsafe-eval'`; `style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'`.

So the package's own files run and nothing else does: an inline script the extension carries, an `eval`, a script injected at run time and a `data:` module that is not the package's own are all refused by the browser, as the contract's CSP refuses them in the app. The differences from the app are that the package's files are allowed by hash instead of by `'self'`, and fonts by `data:` because they are inlined. A script that builds a URL to one of its own files at run time (an image path set from code, `new URL(..., import.meta.url)`) has no file to reach; none of the first-party packages does that. A frame document is limited to 2 MB, so a very large package is refused in the demo with that reason.

## What is simulated

- The disk: projects, builds, keys, submissions and FormPortal's folder live in the virtual disk (`/home/demo/...`), saved in local storage. If the browser refuses to store more, the demo keeps working in memory until reload.
- Open Folder finds only `/home/demo/Extensions/hello` (the kit's example). Import a `.formpkg` from your computer in the Library instead.
- Run in App and Send to FormPortal change the simulated FormPortal folder; no app is started, and the apps' files are stand-ins.
- `net.fetch` has no relay: the demo makes no network requests, and Preview answers it with an error that says so.
- Publisher keys made in the demo are WebCrypto keys stored in the virtual disk; with a passphrase the private key is sealed with PBKDF2 and AES-GCM rather than the engine's encrypted PKCS#8 PEM.
- The command line and the MCP server do not run in a page.

The package bytes come from the browser's deflate. Sixteen of the seventeen first-party packages rebuild in the page to the same SHA-256 as the kit's `formpkg` command line wrote them; Mail Merge rebuilds to the same files with a different deflate stream, so its SHA-256 differs. Builds in the page are always the same bytes as each other.

## Browser support

A current Chromium (Chrome, Edge, Brave). Ed25519 in WebCrypto needs Chrome 137 (Firefox 129, Safari 17); import map `integrity` needs Chrome 127.

## Rebuild

```sh
cd frontend
npx tsc -p ../demo/tsconfig.json --noEmit
npx vite build --config ../demo/vite.config.mjs
```

The build uses the interface's own lockfile and node_modules (Vite and TypeScript), roots at `frontend/`, swaps `src/shell/api.ts` for `demo/src/api.ts` and `@tauri-apps/api/core` for a stub, and writes one classic IIFE script (`assets/formext.js`) and one stylesheet (`assets/formext.css`, with the Inter and JetBrains Mono faces inlined) into this folder with relative paths, because browsers refuse module scripts and font fetches on `file://`. `packs/packages.js` is written from `FORMEXT_EXAMPLES` or the first-party package folder when one exists; otherwise the committed pack stays. The output is committed so `file://` works with no install. `npx vite --config ../demo/vite.config.mjs` serves the sources on port 5642 (`host: false`).

## Layout

- `index.html`, `assets/`, `packs/`, `favicon.*`, `apple-touch-icon.png`: the built demo
- `src/entry.ts`, `src/boot.ts`: start the page engine, then the real interface
- `src/api.ts`: the shell's API module for the page
- `src/engine/`: workspace, templates, validate, kit (formpkg and formext_host), preview, package, keys, library, diff, portal, publish, settings, zip, router, seed
- `HASHOUT_LOG.md`: why it is built this way; `CREDITS.md`: what ships in it
