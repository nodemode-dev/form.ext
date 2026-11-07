# Getting Started

## Requirements

Node 20.19+ and Python 3.12. The desktop app also needs Rust and the Tauri 2 toolchain. `./formext doctor` checks the toolchain, the installs and the ports.

## Install and run

```bash
./oc_install        # the engine venv (backend/venv) and the interface packages
./formext           # the engine on 127.0.0.1:8640 and the interface on http://localhost:5640
```

`./formext backend` and `./formext frontend` start one half each. One process serving the built interface: `./formext build`, then `./formext serve` (http://127.0.0.1:8640).

## The first extension

1. **New**: choose an app (FormCut), a starter (Panel), a name (Beat Board), Create. The project opens in Edit at `package/ui/app.js`.
2. **Preview**: the panel runs in a simulated FormCut, with a real-looking timeline, the consent dialog and a log of every message.
3. **Check** (F7): what the contract, the sandbox or a host would refuse, at its file and line. Clicking a problem opens Edit there.
4. **Run in App** (F5): FormCut lists the extension under Extensions as a Development extension and reloads it on every save.
5. **Package**: the deterministic `beat-board-0.1.0.formpkg`, its SHA-256, a reproducibility check, and a signature with your publisher key.
6. **Publish**: the index entry and submission folder for formai.studio, and Send to FormPortal.

Mod+K lists every command. Mod is Cmd on macOS and Ctrl elsewhere.

## Where things are kept

Projects, builds, publisher keys, submissions and settings live in form.ext's data folder: `FORMEXT_HOME` when set, otherwise `ai.nodemode.formext` in the OS app-data folder. A folder opened with Open Folder stays where it is and is edited in place.
