---
name: ship
description: "Shipping a Form extension from form.ext: Run in App through FormPortal's dev.json, the installed apps, deterministic .formpkg packages and the reproducibility check, Ed25519 publisher keys, signing and verifying builds, formai-extensions index entries, the formai.studio submission folder, sending a package to FormPortal to install, and submitting to form.ext-registry (form.ext's own registry copy, its tools/check.py, whether git and gh are ready, opening the pull request). Use when the person wants the extension loaded in the real app, packaged, signed, published, installed or registered."
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

Official Form extensions live in `nodemode-dev/form.ext-registry` (one `extensions/[id]/` folder each; the owners review every pull request, CI runs `tools/check.py`, and the merge publishes a signed release). form.ext can open the pull request for the person.

1. Make the project registry-ready first. New starter READMEs already carry the `## Permissions` and `## Screenshot` sections: write the real reason for each permission (replace "Why: say here what the extension does with it.") and save the picture at `docs/screenshot.png`. `LICENSE` is written in full for Apache-2.0 and MIT when missing. Also `CHANGELOG.md` with an entry for the version, and source in `src/` when there is any (without `src/` the registry reads the shipped files, bundled SDK included, for the permission check). A changed extension raises its version above the published one.
2. `submit {id}` fetches form.ext's own copy of the registry (the `registry` source; no clone to set up) and runs the registry's `tools/check.py` on `submissions/registry/extensions/[id]/` in the data folder (package/, the source, the metadata; README, LICENSE or CHANGELOG are written only when missing and listed in `made`). `checkout` is only for using the person's own clone instead. `checks.by` says which checker ran (`registry` or `formext`): say which.
3. `submit {id, ready: true}` reports whether git and `gh` are installed and signed in, and what to do when not (`gh auth login --web`).
4. When `checks.ok` is true and the person agrees, `submit {id, pull_request: true}` forks the registry, pushes the branch `add-[id]-[version]` (or `update-...`) and opens or updates the pull request. It answers the URL, the branch, the fork and what happens next. It posts publicly under their GitHub account, so ask first. It refuses while checks fail or placeholder text is left in README.md or LICENSE: fix the project and submit again.
5. When `gh` is not available, give the person the `commands` list (fork, branch, copy, check, commit, push, `gh pr create`) instead. Never run the push yourself.

The Library's Registry shelf (in the window) lists the registry's verified extensions from its signed index; importing one checks its SHA-256 and publisher signature.
