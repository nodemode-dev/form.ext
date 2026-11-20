# HASHOUT_LOG · src-tauri · form.ext

Living log for the desktop shell (Tauri 2). Source files stay comment-free; what they would have said lives here.

Current build version: v0.8.0
Last updated: 2026-11-19 · v0.8.0 a start that fails says why, and the engine ends with the shell on Windows (#windows-start). Before: v0.7.0 the version only. Before: v0.6.0 the version only. Before: v0.5.0 the shell reads the window key from the engine and waits at most 10 seconds for it (#window-key, #key-wait). Before: v0.4.1 the version only. Before: v0.4.0 the version only. Before: v0.3.1 the version only. Before: v0.2.1 the version only. Before: v0.2.0 overlay title bar

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
├── icons/              the app icon set made by `tauri icon` from the owner's formext-app-dark-1024.png (v0.2.0; icon.svg is gone, the favicon and splash use PNGs of the in-app mark)
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

---

## Overlay title bar and traffic lights {#title-bar}
- refers-to: src/main.rs · src/traffic_lights.rs · src/reveal.rs · build.rs · capabilities/default.json
- kind: decision
- logged: v0.2.0 · 2026-11-08

The main window on macOS uses `TitleBarStyle::Overlay` with a hidden title, so the page's 38 px title row is the title bar. `traffic_lights.rs` is FormVis's: it centres the three lights in that row after every moment AppKit lays the title bar out again (page load, resize, focus, theme, scale) and once more 120 ms later; `set_window_title` sets the title and places them again. The page calls it when the project changes. The menus are built by the page with `@tauri-apps/api/menu`, covered by `core:default`, so no Rust is needed for them. The window and splash ground is #0a0a0a (`reveal::BACKGROUND`) to match the page's critical background. This round's machine has the GTK libraries: `cargo check` passes for the Linux target; the macOS-only code is checked on the owner's Mac. `rustfmt` at the default width reports differences in code that was already there (the crate is written at 120 columns); the new file is clean at 120.

## The window key {#window-key}

- refers-to: src/main.rs
- kind: decision
- logged: unreleased

`start_engine` sets `FORMEXT_WINDOW_KEY_STDOUT=1`. The engine then prints `formext-window-key: <key>` and, once it listens, `formext-engine: http://127.0.0.1:<port>`, both on standard output and flushed, in that order. The reading loop now takes only standard output, so the key line always arrives before the address line on the one pipe; it keeps the key when it sees it and stops at the address line, as before, so it waits no longer than it did. `open_main` takes the key and adds one `initialization_script` (tauri 2.11.6, `WebviewWindowBuilder::initialization_script(impl Into<String>)`, read in that version's source) that sets `window.__FORMEXT_WINDOW_KEY` only when `location.origin` is the engine's own address. The development window (Vite, no engine started by the shell) gets no key and the page claims it from the engine. Standard output is drained after the window opens and goes to no log. Not compiled here: no WebKit libraries in this sandbox; `rustfmt --check` parses the file (it reports only the existing 120-column formatting).

## A start that fails says why, and the engine ends with the shell on Windows {#windows-start}

- refers-to: src/main.rs :: start_engine, forward_lines, read_port, engine_exit_code, engine_failed, kill_backend, open_main; src/engine_start.rs; src/win_job.rs; src/packaged.rs :: engine_program; Cargo.toml; Cargo.lock; ../backend/HASHOUT_LOG.md#windows-start
- kind: decision
- logged: v0.8.0 · 2026-11-19

The shell half of the pattern FormTools 0.10.0 has. `src/win_job.rs` is FormTools's file, unchanged. `src/engine_start.rs` is FormTools's with the names at its top changed, `data_folder` rewritten to give the folder `backend/app/services/paths.py :: home` gives (`FORMEXT_HOME`, else `ai.nodemode.formext` under Application Support, under `APPDATA` or `LOCALAPPDATA`, or under `XDG_DATA_HOME`), and its test strings changed. The two rules are kept the same by hand; the unit test `the_log_is_where_the_engine_writes_it` is where a mismatch shows.

Which way for the plugin: the engine was started through tauri-plugin-shell, which gives no `std::process::Child`, and the job object takes one. The one start moved to `std::process::Command` (`start_engine` and `forward_lines`, as in FormTools), so `win_job.rs` needed no addition. The plugin stays registered; only the engine's start no longer uses it. `packaged::engine_program` finds the engine where the plugin did: the one-folder place first, then `formext-engine` beside the app's program. What changed with that move: the engine's standard input is the null device (the plugin gave it a pipe nobody wrote to), standard error is read too and kept with the last lines, `PYTHONUNBUFFERED=1` is set, and on Windows the start asks for no console window, as the plugin did. The working folder is still the shell's own.

`start_engine` sets `FORMEXT_SHELL_PID` to the shell's process id, and on Windows puts the engine into a job object with kill-on-close (`win_job::hold`). The handle is kept for the life of the shell and never closed by the code, so when the shell ends in any way Windows ends the engine and everything it started. `kill_backend` ends the job first (`win_job::end`), then the child, and now waits for it; on macOS and Linux it asks the child itself whether it has gone after SIGTERM (`try_wait`), because a child that nobody has waited for still answers `kill -0`.

`engine_failed` order was: close the loading window, show the dialog, stop the engine, exit. The loading window is the only window then, and closing the last window lets the app end before the dialog is seen. Now the dialog comes first and the loading window closes after it returns. The dialog has one sentence for the kind of failure (engine program missing, could not be started, stopped with its code, another copy holds the data folder for code 2, a wait ran out, the window could not be built), the engine's last 12 lines without the key line, and the path of the engine's log. Removed text: "The form.ext engine failed to start. Please relaunch the app." `open_main` returns whether the window was built; a window that fails to build goes the same way and no longer just closes the loading window.

`read_port` is FormTools's loop with this app's two lines. It replaces the loop and the `Arc<AtomicBool>` timer of #key-wait. The key wait is still 10 seconds from the address line. New: the wait for the address has a limit, 120 seconds (`engine_start::ADDRESS_WAIT`; FormTools has 60). #key-wait left it without one on purpose, because a first start of the one-file engine can be slow; the pattern asks for a limit on every wait, so it is twice FormTools's here. If a healthy first start is slower than that on someone's machine, this constant is the one to raise.

Not taken: the second start. The single-instance plugin is here already and still brings only the main window forward; while the loading window is the only one, a second start does nothing visible.

`Cargo.toml`, `Cargo.lock`: `windows-sys` 0.61.2 is a direct dependency for Windows with the four features the job object needs. It was in the lock already at that version (19 packages use it). The lock gained one line in formext's own list, typed by hand; `cargo update --workspace` on a copy of the old lock with the new manifest wrote the same file, byte for byte (run with the manifest already at 0.8.0, so it showed the version line and the dependency line together).

Checked in a scratch crate outside the repository that includes `engine_start.rs` and `win_job.rs` by path: `cargo check --target x86_64-pc-windows-msvc` finished with no error and no warning (rustc 1.97.0, windows-sys 0.61.2). On Linux the module's 4 unit tests pass, and so do `read_port` and `engine_exit_code`, cut from `main.rs` as they stand and run over tokio channels and real child processes (5 tests): key then address is ready at once and the key is not in the tail; a closed output gives "stopped" with the engine's words; an address with no key runs out at 10 s; silence runs out at 120 s; exit code 2 is read and a running child gives none after one second. `rustfmt` parses `main.rs` and its modules.

Not compiled and not run: the shell itself, on any system (no WebKit libraries here), so `start_engine`, `forward_lines`, `engine_failed`, `kill_backend`, `packaged::engine_program` and the start in `setup` were read against FormTools's, not built. The first compile is the release build. Nothing has run on Windows: the job object, the order of dialog and window, and whether the one-file engine's second process is inside the job are for a Windows machine to show.

## A bounded wait for the key line {#key-wait}

- refers-to: src/main.rs :: start_engine
- kind: decision
- logged: unreleased

The engine's start has no time limit, as on `origin/main`: a first launch of the frozen engine can take well over 10 seconds (cold disk, a virus scan, unpacking), and a limit counted from the spawn would show "failed to start" on a healthy app. An earlier version of this change did exactly that and was corrected. The 10 seconds (the family value) start only when the address line has arrived without a key: then a plain `std::thread` sleeps 10 seconds and an `Arc<AtomicBool>` decides which side settles first. If the timer wins it takes the existing `engine_failed` path (dialog, the engine stopped, exit 1) and the loop, if the key turns up later, does nothing. If the loop wins it opens the window with the address and the key. An engine that exits before the address, or after it and before the key, takes `engine_failed` at once. The flag makes the failure path run at most once and never after the window opened. The loop now goes on reading after the address until it has the key, so a key line read out of order still counts; this engine prints the key line first and flushes it (seen by running `formext_engine.py` with `FORMEXT_WINDOW_KEY_STDOUT=1`), so normally the key is in hand before the address. Only `std` is used (tokio is not a direct dependency of this crate). Not compiled here: no WebKit libraries; `rustfmt --check` parses the file. The loop was copied into a scratch crate with tokio 1.53.1 (the version in `Cargo.lock`) and fed fake event streams: key then address opens at once; address then nothing fails at 10 s; nothing for 25 s then key and address opens at 25 s; exit before the address fails at once; key 12 s after the address fails at 10 s and does not open.

## The wait for the address is 90 seconds {#address-wait}

- refers-to: src/engine_start.rs :: ADDRESS_WAIT; ../backend/HASHOUT_LOG.md#windowed
- kind: decision
- logged: v0.9.0 · 2026-11-20

The owner's decision for the family: every shell waits 90 seconds for the engine's address. It was 120 here (#windows-start), 60 in FormTools and 300 in FormVis. The test of the sentence now says "waited 90 seconds". Nothing was measured here that asks for longer: the one-file engine was not frozen or started from a cold disk in this round, so a first start on a slow machine that needs more than 90 seconds is still possible and would show the "waited 90 seconds" dialog. Checked in the scratch crate that includes `engine_start.rs` and `win_job.rs` by path: `cargo check --target x86_64-pc-windows-msvc` finished; the 5 unit tests of the module pass, and of the 5 loop tests cut from `main.rs` the silent engine now runs out at 90.01 seconds.
