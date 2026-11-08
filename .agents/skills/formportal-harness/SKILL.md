---
name: formportal-harness
description: Drive FormPortal, the Form family's app portal (a Creative Cloud desktop app alternative), through its formportal MCP server or the formportal command line. Use whenever the person wants a Form app (FormCut, FormVis, FormLit, FormDesign, FormPath, FormVFX, FormEncoder, FormWav, form.md, FormDAM, FormDeck, FormPDF, FormTxt, FormCel and the rest) listed, checked, installed, updated, opened, rolled back to the previous version, removed, or its beta installed beside the stable build; asks which Form apps exist, what each replaces, which are released or in progress, what version is installed or offered for this computer; wants the catalogue checked or pointed at a local or forked catalogue; wants another Form app's own MCP server reached after installing it; or when formportal tools such as status, apps, app_info, installs, install, open, rollback or remove are available or fail, or an organisation's policy refuses one. Not for changing FormPortal's own source (use formportal-skillset).
---

# formportal harness

FormPortal installs and looks after the Form family's desktop apps on this computer. It reads a signed catalogue that formcompiler (`nodemode-dev/formcompiler`) publishes, offers this computer the release that fits its system and processor, verifies every download's SHA-256 against the catalogue before unpacking it, installs per user with no administrator, keeps the version it replaced so one step back is always possible, and keeps a beta beside the stable build. No account, no background process.

Its MCP server, named `formportal`, is the same engine as the window (`formportal-core`), so what an agent installs is what the person sees in FormPortal, and the reverse.

## The model

- The **registry** is the family: every Form app's id, name, what it replaces, group (Adobe alternatives, other alternatives, on the way) and development status (available, in progress, in development). It is built into FormPortal, so it answers offline.
- The **catalogue** is what is released: per product, a state (prelaunch, public, live) and per channel a release with a version and artifacts (file, size, SHA-256, minimum OS). It is fetched, signature-checked, and kept for offline use; a newer release an app has published on its own GitHub repository is offered over the catalogue's (see `references/concepts.md` Trust).
- A **view** is what this computer is offered for one product and channel: `available` (with version and size), `other-platform`, `no-release` or `unreleased`.
- An **install** is one product on one channel: the current version (path, SHA-256) and the previous one kept for rollback. Channels are `stable`, `beta`, `nightly`; each is its own install.

`references/concepts.md` has the details: ids, where installs live, what refuses and why, environment variables.

## Start every job

1. `status`: version, platform, install folder, catalogue source, everything installed.
2. `apps`: the family with what is offered and installed per channel. If it reports `catalog_error`, read it before anything else (see `sub-skills/session-and-connection/SUB-SKILL.md`).
3. For one product, `app_info` before acting: the release notes, the file and its size.

## The loop

1. **Plan.** One line per change: product, channel, from which version to which, and the download size.
2. **Confirm.** `install`, `update`, `rollback`, `remove` and `preferences` changes alter the person's computer or choices. Say what will change and get a yes first. `remove` also deletes the kept previous version.
3. **Act** with one tool call per product and channel.
4. **Check** with `installs`: the version and SHA-256 now on disk. `open` only when the person wants the app started.
5. **Report**: what changed, the version, where it is, and anything refused with its reason.

## Routing

| The job involves | Load |
| --- | --- |
| A broad request: set up the whole family, update everything, a new computer | `sub-skills/harness-director/SUB-SKILL.md` |
| Tools missing, the server not starting, a catalogue refused, offline, a local or forked catalogue | `sub-skills/session-and-connection/SUB-SKILL.md` |
| Installing, updating, update preferences, opening, rolling back, removing | `sub-skills/install-and-update/SUB-SKILL.md` |
| Beta and nightly builds beside stable | `sub-skills/channels-and-beta/SUB-SKILL.md` |
| Extensions: finding, installing, sideloading a .formpkg, turning off, removing | `sub-skills/extensions/SUB-SKILL.md` |
| Fonts: find, install a family or style, add their own TTF or OTF, remove | `sub-skills/fonts/SUB-SKILL.md` |
| Stock images, video, audio and app templates: find, save with credit, start a project from a template, remove | `sub-skills/stock-and-templates/SUB-SKILL.md` |
| Checking and repairing installs, cleaning leftovers and old downloads, an app that will not open, updates put off until an app is closed | `sub-skills/repair/SUB-SKILL.md` |
| Tutorials: which exist, what is finished, the next step, marking a step, starting again; questions asked from Ask your agent | `sub-skills/learn/SUB-SKILL.md` |
| The person's project files: find, search, open in the right app, versions and going back, disk use | `sub-skills/files/SUB-SKILL.md` |
| A computer an organisation manages: a refusal naming a policy, locked settings, mirroring the catalogue, silent deployment | `sub-skills/organisations/SUB-SKILL.md` |
| Which apps exist, what each replaces, status and groups | `sub-skills/catalog-and-registry/SUB-SKILL.md` |
| Using an installed Form app through its own MCP server, deep links, the formai.studio website | `sub-skills/form-family-bridge/SUB-SKILL.md` |
| Checking work before reporting it | `sub-skills/verification/SUB-SKILL.md` |

## Rules that hold everywhere

- **Never guess an id.** Product ids come from `apps` (lowercase: `formcut`, `formvis`, `formencoder`, `formmd`). FormPortal itself is `formai` in the catalogue.
- **The catalogue decides.** `apps` lists only released or installed apps, as formai.studio does; an app it does not list is not released yet, so there is nothing to install. Say so, give the opening date from `on_the_way` when the person asks what is coming, and never name an unreleased app or look for a download elsewhere.
- **Never weaken a check to make an install work.** Do not ask the person to set `FORMPORTAL_ALLOW_UNSIGNED` for the family catalogue. A SHA-256 mismatch means the file is not the one the catalogue describes: report it, do not retry with another source.
- **Ask before changing the computer**, every time, for `install`, `rollback`, `remove`.
- **Leave the person's work alone.** FormPortal's tools touch only its own install folder; never delete an app's documents or settings by hand.

## References

| File | What it holds |
| --- | --- |
| `references/concepts.md` | Ids, channels, install folders, the catalogue's trust model, errors and what they mean, environment variables |
| `references/tools.md` | Every MCP tool with its parameters and shell equivalent (generated by `./formportal agents sync`) |
