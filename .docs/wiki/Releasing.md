# Releasing

1. Versions are `X.YY.Z` (one digit, 1 to 99, one digit). Raise the version in every site in one commit: `frontend/src/shell/version.ts`, `frontend/package.json` and `frontend/package-lock.json` (two lines), `backend/app/__init__.py`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and the `formext` entry in `src-tauri/Cargo.lock`, the version badge in `README.md`, the release entry for form.ext in `setup/family.spec.json`, the health answer in `frontend/src/demo/engine/router.ts` and the "Current build version" line of the HASHOUT logs that carry one. The built demo (`demo/assets/formext.js`) holds the same string from `router.ts`, so rebuild it as `demo/README.md` says. Search the tree for the old version before committing to see that none is left. `sdk/package.json` moves only when the SDK changes.
2. Refresh the app API copies in `docs/apps/` from each app's `docs/EXTENSIONS.md` with `cp`, and the contract kit in `contract/` and `sdk/src/` from the kit, when they changed.
3. `./formext build`, `./formext freeze` (its self-check must pass) and `./formext desktop build`.
4. Commits have one author and committer, `nodemode-ai <mackin@nodemode.ai>`, and no trailers. The release commit is `chore(release): vX.YY.Z`.
5. Every shipped dependency has its row in `NOTICE.md`; GPL stays out of the bundle.
