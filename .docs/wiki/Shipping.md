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

## Submit to Registry

Official Form extensions live in `nodemode-dev/form.ext-registry`, one folder per extension. Submit to Registry (the Publish pane, `./formext cli submit <id>`, the MCP tool `submit`):

| Step | What happens |
| --- | --- |
| Folder | Writes `submissions/registry/extensions/<id>/` in the data folder: `package/`, the source (`src/`, `package.json` and its lock file, `docs/`), `README.md`, `LICENSE`, `CHANGELOG.md` (written for you when missing) and the screenshot slot `docs/screenshot.png`. |
| Checks | form.ext keeps its own copy of the registry and fetches it before each submit. That copy's `tools/check.py` is run on the folder, exactly as CI runs it on the pull request, so there is no clone to set up. With the setting `registry.checkout` (your own clone), that clone is used instead. If the copy cannot be fetched, form.ext's Check and the metadata checks run, and the result says which. |
| Pull request | One step with `--pull-request` (below), or the `git` and `gh` commands to run by hand. |

The owners (`@nodemode-ai`, `@gbarnai`) review it; after the merge the registry builds, signs and publishes the version, and every Library and FormPortal lists it as Verified. Nothing is published until they merge it.

### Sending it for review, step by step

You need a GitHub account, and GitHub's `gh` tool signed in once. Git must be installed too.

In the window, all of this is the **Submit to Registry** section of the Publish pane: **Submit** writes the folder and runs the checks, the line under **Open the pull request** says whether this computer is ready and what is still needed, and the **Open pull request** button (enabled once the checks pass) asks you to confirm, then does step 5 and shows the pull request's link. The commands below do the same from the Terminal tab.

1. Make the project ready. Its README has a `## Permissions` section with one line per permission, each ending in "Why: say here what the extension does with it." Replace that sentence on every line with the real reason. Save a screenshot as `docs/screenshot.png`. The LICENSE file must have no placeholder text either.
2. In the Terminal tab, run `./formext cli submit [id] --ready`. It says whether git and `gh` are installed and signed in.
3. If `gh` is missing, install it from https://cli.github.com. If it is not signed in, run `gh auth login --web` in the Terminal tab and follow the browser page. This is needed once.
4. Run `./formext cli submit [id]`. form.ext writes the folder, fetches the registry's own copy and runs its checks. Fix whatever it lists, and run it again until it passes. That is what "ready" means: the checks pass and no placeholder text is left.
5. Run `./formext cli submit [id] --pull-request`. form.ext copies the registry into your GitHub account (a fork), puts your folder on a branch named `add-[id]-[version]` (`update-...` for a new version), pushes it and opens the pull request. If one is already open, it updates it. It refuses, and says why, while the checks fail or a placeholder is left. This posts publicly under your GitHub account, so an agent asks you first.
6. The address of the pull request is shown. The owners review it. Nothing is published until they merge it; then the registry builds, signs and publishes your version.

If you would rather do it yourself, skip step 5: step 4 also lists the `git` and `gh` commands (fork, copy the folder in on a branch, run the checks, commit, push, open the pull request). Run them one by one in a terminal. Nothing is pushed until you do.

The working copy used for the pull request is in the data folder's `registry-work/`.
