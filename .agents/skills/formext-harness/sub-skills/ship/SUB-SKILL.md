---
name: ship
description: "Shipping a Form extension from form.ext: Run in App through FormPortal's dev.json, the installed apps, deterministic .formpkg packages and the reproducibility check, Ed25519 publisher keys, signing and verifying builds, formai-extensions index entries, the formai.studio submission folder, sending a package to FormPortal to install, and submitting to form.ext-registry (the registry layout, its tools/check.py, the git and gh pull request commands). Use when the person wants the extension loaded in the real app, packaged, signed, published, installed or registered."
---

# ship

## Run in App

1. `apps`: FormPortal's folder, which Form apps it installed and their versions, and the development extensions each app loads (with what the host says about each).
2. Ask the person, then `run_in_app {id}`: it adds the project's package folder to `extensions/[product]/dev.json`. The app loads it with source Development, rechecks it within 2 s of each change while focused, and shows it in its Extensions panel. `open: true` also opens the app when FormPortal installed it.
3. The answer's `host` is what the app will say (ready, or refused with the reason). `app.installs` empty means the app is not installed by FormPortal on this computer: the entry is written, and the app picks it up once installed.
4. `run_in_app {id, status: true}` reports without changing anything; `run_in_app {id, remove: true}` takes it out again. Remove what you added when the person is done testing.

## Package

`package {id, reproduce: true}` checks, builds the deterministic `.formpkg` (sorted entries, 1980 timestamps, mode 0644), and answers SHA-256, size and the warnings; `reproduce` rebuilds it with the kit's own `formpkg` command and compares. The same package folder always gives the same SHA-256, so an unchanged rebuild says it matches an earlier build. `out` saves a copy to a file or folder. `builds {id}` lists every build with its signatures.

## Keys and signing

- `keys` lists the publisher keys in form.ext's data folder; `keys {action: "create", id, name, url?, passphrase?}` makes an Ed25519 key; `keys {action: "export", id}` gives the public part and fingerprint for the index's `publishers`. Never export or show a private key.
- `sign {id, key, sha?, passphrase?}` signs a build (the latest when `sha` is left out; a unique prefix is enough) and verifies the signature. `verify {id, sha?}` checks every signature again.
- `entry {id, sha?, url?, publisher?}` is the `formai-extensions` index entry, with the signature when signed. The default URL is the build's formai.studio address.

## Publish

`publish {id, url?, publisher?, passphrase?, unsigned?}` builds, signs (unless `unsigned`; it picks the settings' publisher or the only key), and writes the submission folder: the `.formpkg`, `entry.json`, a one-package `extensions.json` that passes the index schema, `README.md` and `submission.json`. Report the folder, SHA-256, size, URL and signer.

`formportal: true` also sends the package to FormPortal: through its command line (`extension-install --path`) when found, otherwise by opening the package with the FormPortal app or the system's handler for `.formpkg`. The answer's `method` says which; `installed` is known only for the command line. Ask first: it changes what the app loads for everyone on this computer.

## Submit to the registry

Official Form extensions live in `nodemode-dev/form.ext-registry` (one `extensions/[id]/` folder each; the owners review every pull request, CI runs `tools/check.py`, and the merge publishes a signed release).

1. Make the project registry-ready first: `README.md` that says what it does, a `## Permissions` section naming every permission and why, and the screenshot `![...](docs/screenshot.png)` with the picture at `docs/screenshot.png`; `LICENSE`; `CHANGELOG.md` with an entry for the version; source in `src/` when there is any (without `src/` the registry reads the shipped files, bundled SDK included, for the permission check). A changed extension raises its version above the published one.
2. `submit {id, checkout?}` writes `submissions/registry/extensions/[id]/` in the data folder (package/, the source, the metadata; it writes README, LICENSE or CHANGELOG only when missing, and lists them in `made` for you to finish). `checkout` is a local clone of the registry: then the clone's own `tools/check.py` runs on the folder (`checks.by` is `registry`); without it form.ext's Check runs (`checks.by` is `formext`). Say which ran.
3. When `checks.ok` is false, fix the project and submit again. When it is true, give the person `commands` (fork, branch, copy, check, commit, push, `gh pr create`). Never run the push or the pull request yourself unless the person asks.

The Library's Registry shelf (in the window) lists the registry's verified extensions from its signed index; importing one checks its SHA-256 and publisher signature.
