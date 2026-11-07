# HASHOUT_LOG · src-tauri · form.ext

Living log for the desktop shell (Tauri 2). Source files stay comment-free; what they would have said lives here.

Current build version: v0.1.0
Last updated: 2026-11-07 · v0.1.0 desktop shell

---

## Org-navi-map

```
src-tauri/
├── Cargo.toml          tauri 2 (devtools, macos-private-api), shell, dialog, single-instance, regex, objc2 on macOS
├── Cargo.lock          started from formvis's lock so the family builds the same crate versions
├── build.rs            the app commands with generated allow permissions (app_ready, engine_url)
├── tauri.conf.json     the splash window, macOSPrivateApi, the sidecar, bundle metadata
├── entitlements.plist  hardened runtime exceptions for the frozen Python engine
├── capabilities/       default.json: the engine's 127.0.0.1 origin and the Vite address as remote URLs
├── icons/              the app icon set made by `tauri icon` from icon.svg's 1024 px rendering
└── src/
    ├── main.rs         engine start, main window, exit
    ├── reveal.rs       splash minimum, bar finish, fallback, rounded splash
    └── packaged.rs     `formext cli ...` and `formext mcp ...` handed to the engine binary
```

---

## Splash parity with the family {#splash}
- refers-to: src/reveal.rs · frontend/public/splash.html · tauri.conf.json :: app.windows[splash]
- kind: decision
- logged: v0.1.0 · 2026-11-07

The pattern is formvis's (src-tauri/src/reveal.rs there), kept line for line where it matters: a 360 by 200 undecorated, transparent, shadowless splash built hidden; `round_splash` makes the macOS window non-opaque with a clear background and masks its content layer to 16 px, then shows it (elsewhere it is simply shown). The page is a `#0a0a0a` card with a 16 px radius, the app mark, "Starting form.ext" and the family gradient bar (`#3A7BFF`, `#9A5CFF` 30%, `#FF4F7A` 62%, `#FFAE2B`) that eases to 92% over 2.6 s. `SPLASH_MIN` 2600 ms counts from `mark_launch` (first line of main); when the page calls `app_ready` (shell.ts `revealed`, after the first pane has mounted and one frame has passed) the shell waits out the minimum, runs `formextSplashDone` so the bar completes, waits `BAR_FINISH` 220 ms, then shows the main window and closes the splash. `FALLBACK` 20 s shows the main window anyway if the page never reports. On macOS the main window is built hidden and put on screen at alpha 0 with clicks passing through (a hidden web view stops its animation frames); elsewhere it is built visible behind the splash. Both windows carry the page's ground (`#111111`), so no white frame shows.

`macOSPrivateApi` is true in the config and the `macos-private-api` feature is on, as Tauri requires for the transparent splash; it matters only for the Mac App Store.

---

## Engine and windows {#engine}
- refers-to: src/main.rs :: start_engine, open_main, dev_mode
- kind: decision
- logged: v0.1.0 · 2026-11-07

Release builds start the frozen engine (`binaries/formext-engine-<target>`, made by `setup/freeze_backend`, or a one-folder `engine/formext-engine` beside the binary when a packager puts one there) with `FORMEXT_PORT=0`, read the port from uvicorn's "running on http://127.0.0.1:N" line, and open the main window on that address, so the page and its `/api` share one origin exactly as in the browser. The engine exits by itself when its parent ends; on exit the shell also sends SIGTERM, then kills after 1.5 s. Debug builds (`./formext desktop dev`) open `FORMEXT_DEV_URL` or http://localhost:5640 and start no engine: the script starts `./formext boot` first when the ports are free. `FORMEXT_SIDECAR=1` makes a debug build use the sidecar.

The main window keeps the system title bar (no overlay), 85% of the primary screen, at least 960 by 620, centred. Tauri's drop handler is off so the page receives dropped `.formpkg` files as ordinary drop events. A second launch focuses the running window (single instance).

`formext cli ...` and `formext mcp ...` on the app's own binary hand the arguments to the engine binary (`formext_engine.py` passes them to `app.cli` and `app.mcp`), so an agent configuration can name the installed app.

---

## Verification limits {#verify}
- refers-to: Cargo.toml
- kind: note
- logged: v0.1.0 · 2026-11-07

The build machine for this round has no WebKitGTK development files, so `cargo check` stops in the GTK system crates before reaching this crate. The sources were checked with rustfmt's parser, the crate graph resolves (`cargo metadata`), and the APIs used are the ones formvis's shell compiles against with the same lock. The first desktop build on the owner's Mac is the compile check.
