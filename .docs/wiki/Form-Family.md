# Form Family

Extensions move through four places, each with one job:

| Place | Job |
| --- | --- |
| form.ext | makes, previews, checks, packages, signs and publishes extensions |
| FormPortal | installs them (from the catalogue or a `.formpkg`), writes each app's `enabled.json`, and manages permissions and updates |
| the twelve host apps | load them in a sandboxed frame, show the Extensions menu and panel, ask for consent, and offer them to agents |
| formai.studio | lists them in the extensions index and serves the packages |

## form.ext and the apps

Run in App is the development path: form.ext writes `extensions/<product>/dev.json` in FormPortal's folder and the app loads the folder directly, as a Development extension. The app finds the file itself; FormPortal need not be running.

## form.ext and FormPortal

Send to FormPortal hands it a built package (through `formportal cli extension-install --path`, or by opening the file). FormPortal checks it as it checks any package from a file, and installs it for its app. Manage in FormPortal opens `formai://extensions?product=<product>`.

## form.ext and formai.studio

Publish writes a submission folder with the package, its index entry (`formai-extensions`, format 1, checked against the contract's schema), the publisher's public key and a README for the reviewer. The site's extensions index takes the entry; the package goes to `https://formai.studio/extensions/packages/<id>-<version>.formpkg`.

## Hue

form.ext's hue is indigo `#4f6bff`, the colour farthest from every other app's hue in FormPortal's `design/app-hues.json`.
