# Desktop

```bash
./formext desktop dev       # the app over the running engine and interface
./formext freeze            # the engine as the sidecar src-tauri/binaries/formext-engine-<target triple>
./formext desktop build     # interface build, freeze, then tauri build
```

The shell is Tauri 2 with the family splash: a 16 px rounded `#0a0a0a` card with the family gradient bar, shown for at least 2.6 s and until the interface reports its first paint. It starts the frozen engine on a free loopback port (`FORMEXT_PORT=0`), reads the port, and loads the interface from it. The engine exits with the app.

`setup/freeze_backend` makes one PyInstaller file with the built interface, `contract/`, `templates/` and `docs/` packed inside, then runs its self-check (`--selfcheck` imports every router and the kit). The frozen engine also answers `cli ...` and `mcp ...`, so the installed app carries the command line and the MCP server.

Linux builds need the WebKitGTK 4.1 development packages.
