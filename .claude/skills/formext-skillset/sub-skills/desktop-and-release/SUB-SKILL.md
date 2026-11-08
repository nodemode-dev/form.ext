---
name: desktop-and-release
description: "form.ext's desktop build and release: the Tauri 2 shell in src-tauri (the family splash and reveal.rs, single instance, window size, the engine sidecar), freezing the engine with setup/freeze_backend and PyInstaller, the ./formext and ./oc_install scripts, versions, NOTICE rows and commits. Use when changing the desktop shell, building or freezing, bumping the version, adding a shipped dependency, or preparing a release."
---

# desktop-and-release

## The shell

- Splash parity with formvis: a 360 by 200 `#0a0a0a` card with 16 px corners and the family gradient bar, `reveal.rs` with `SPLASH_MIN` 2600 ms, `BAR_FINISH` 220 ms, `FALLBACK` 20 s, `round_splash` masking the macOS corners (`macOSPrivateApi` and the `macos-private-api` feature). The main window shows when the page calls `app_ready` after its first pane mounts.
- Release builds start `binaries/formext-engine` with `FORMEXT_PORT=0`, read the port from uvicorn's log line and open the window on that origin. Debug builds open http://localhost:5640 (`./formext desktop dev` boots the servers first).
- `formext cli ...` and `formext mcp ...` on the app binary pass through to the engine binary, so an agent configuration can name the installed app.
- Notes: `src-tauri/HASHOUT_LOG.md` (#splash, #engine, #verify).

## Freezing

`setup/freeze_backend` installs `requirements.txt` and PyInstaller (a build tool, not shipped) into the venv, builds the interface when `frontend/dist` is missing, and makes `src-tauri/binaries/formext-engine-[target triple]` with `frontend_dist`, `contract`, `templates` and `docs` packed as data, then runs `--selfcheck` (fails on any router error). `FORMEXT_TARGET` overrides the triple.

## Scripts

`./formext` (boot, install, backend, frontend, build, serve, freeze, desktop dev or build, app, cli, mcp, claude, agents, doctor, version), `./formext_oc_install` (one-command install) and `./build_app` (the desktop build start to finish, logging to build_app.log; `formext.bat`, `formext_oc_install.bat` and `build_app.bat` are the Windows twins). Vite keeps `server.host: false` on port 5640; the engine is 127.0.0.1:8640.

## Releasing

- One version `X.YY.Z` in `backend/app/__init__.py`, `frontend/src/shell/version.ts`, `frontend/package.json` and its lockfile, and `src-tauri` (`Cargo.toml`, `tauri.conf.json`).
- Every shipped dependency (Python, npm, Rust, fonts) has a row in `NOTICE.md`; the contract kit's row is "Form Extension Contract kit, Apache-2.0, nodemode". GPL stays out of the bundle.
- `CHANGELOG.md` gets the version's entry; commits follow Conventional Commits, `nodemode-ai <mackin@nodemode.ai>` as author and committer, no trailers, the release commit last.
