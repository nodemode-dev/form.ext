# Shipping

## Run in App

Run in App writes the project's package folder into `extensions/<product>/dev.json` in FormPortal's folder (contract section 3). The app reads it at start, again within 2 s of a change while its window has focus, and on Reload Extensions, and shows the extension with the source Development and its folder. Saves show on the next reload, with no packaging. The pane shows whether the app is installed and its version, whether the project is listed, and whether the app would load it or why it would refuse it; Open starts the app, Reload in App touches `dev.json`, Stop removes the row.

FormPortal's folder is `FORMPORTAL_ROOT`, otherwise `~/Library/Application Support/studio.formai.portal` (macOS), `%LOCALAPPDATA%\FormPortal` (Windows) or `~/.local/share/formportal` (Linux).

## Package and Sign

| Step | What happens |
| --- | --- |
| Build | Check runs first. Contract errors stop the build; code errors stop it unless you package anyway. The kit's `formpkg` makes the zip: entries sorted, dates 1980-01-01, mode 0644, deflate, so the same files always give the same SHA-256. |
| Reproduce | Two builds by two routes (the engine and the kit's `formpkg.py` command line), compared byte for byte, differences listed by file. |
| Keys | Ed25519 publisher keys in the data folder's `keys/`, optionally locked with a passphrase; Export Public Key gives the publisher entry for the index. |
| Sign | Signs the build's exact bytes, stores and verifies the signature, and carries it into the index entry. |

Builds live in `builds/<project>/<sha256>/` with a `build.json` record.

## Publish

Prepare Submission builds (if needed), signs with the default publisher key and writes `submissions/<id>-<version>/`: the `.formpkg`, `entry.json`, a one-package `extensions.json` checked against the contract's `extensions.schema.json`, the publisher entry, a `README.md` for the reviewer and `submission.json`. The package address defaults to `https://formai.studio/extensions/packages/<id>-<version>.formpkg`.

Send to FormPortal installs the package with `formportal cli extension-install --path <package>` when FormPortal's command line is found, otherwise opens it with FormPortal or the system's handler for `.formpkg`. FormPortal's own checks and signature policy apply.
