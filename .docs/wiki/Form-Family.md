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

## form.ext, formMCP and FormSkills

formMCP is the family hub: one MCP server (`formmcp mcp`) whose tools (`family_apps`, `suggest_app`, `app_tools`, `call_app`, `app_resources`, `read_app_resource`, `app_prompts`, `get_app_prompt`, `extensions_list`, `extension_command`, `demo_open`) reach every installed Form app's own MCP server. An extension is tested live through it. It does not handle skills, and its family list does not include form.ext.

FormSkills views and installs the apps' released skills. It has no MCP server; its command line is `formskills-cli`. Its catalogue does not list form.ext's own skills. form.ext's `family` command reports whether formMCP and FormSkills are on this computer, and its `skills` command uses `formskills-cli` when it is there, translating the ids that differ (FormDeck is `formslide` and FormPortal is `formai` in FormSkills).

## Source repositories

form.ext pulls an app's source (read-only, into its data folder) from `https://github.com/nodemode-dev/[repository]`. The twelve hosts, FormPortal and the registry:

| Id | App | Repository | Licence |
| --- | --- | --- | --- |
| formvis | FormVis | formvis | Apache-2.0 |
| formcut | FormCut | formcut | Apache-2.0 |
| formwav | FormWav | formwav | Apache-2.0 |
| formpdf | FormPDF | formpdf | Apache-2.0 |
| formdeck | FormDeck | formdeck | Apache-2.0 |
| formlit | FormLit | formlit | Apache-2.0 |
| formmd | Form.md | form.md | Apache-2.0 |
| formencoder | FormEncoder | formencoder | Apache-2.0 |
| formvfx | FormVFX | formvfx | Apache-2.0 |
| formmcp | formMCP | formMCP | GPL-3.0 |
| formtray | FormTray | formtray | Apache-2.0 |
| formskills | FormSkills | formskills | GPL-3.0 |
| formportal | FormPortal | formportal | GPL-3.0 |
| registry | Form Extension Registry | form.ext-registry | Apache-2.0 |

Reading GPL source to learn an app's API is fine; copying its code into an extension puts the extension under the GPL.

## Hue

form.ext's hue is indigo `#4f6bff`, the colour farthest from every other app's hue in FormPortal's `design/app-hues.json`.
