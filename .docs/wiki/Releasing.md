# Releasing

1. Versions are `X.YY.Z` (one digit, 1 to 99, one digit). Raise the version in every site in one commit: `frontend/src/shell/version.ts`, `frontend/package.json`, `backend/app/__init__.py`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`. `sdk/package.json` moves only when the SDK changes.
2. Refresh the app API copies in `docs/apps/` from each app's `docs/EXTENSIONS.md` with `cp`, and the contract kit in `contract/` and `sdk/src/` from the kit, when they changed.
3. `./formext build`, `./formext freeze` (its self-check must pass) and `./formext desktop build`.
4. Commits have one author and committer, `nodemode-ai <mackin@nodemode.ai>`, and no trailers. The release commit is `chore(release): vX.YY.Z`.
5. Every shipped dependency has its row in `NOTICE.md`; GPL stays out of the bundle.
