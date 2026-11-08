---
name: install-and-update
description: Installing, updating, opening, rolling back and removing Form apps with FormPortal. Use when the person wants a Form app installed or updated, an update undone, an app opened, or an app removed, or when install, open, rollback or remove fails.
---

# install-and-update

## Install or update

`install {product, channel?}`. An update is an install of the newer version the catalogue offers; FormPortal keeps the version it replaces. Before calling:

1. `apps` shows `available` for that channel. Anything else: stop and say which state it is in.
2. Tell the person the version and the size, and get a yes.

The result carries `installed.current` (version, path, SHA-256), `installed.previous` (what rollback would return to) and `opens` (the file `open` will start). Every desktop release kind installs per user without administrator: zip, AppImage, dmg (copied out of the mounted image), deb and rpm (unpacked, no install scripts), msi (an administrative image) and NSIS (silent, into FormPortal's folder). Nothing is registered with the system's package manager.

## Updates and preferences

- `updates` lists every installed app with a newer version: from, to, size, release notes, whether it is open, and whether the person's preferences update it automatically. It also says when FormPortal itself has a newer version (`formportal_update`), which the person downloads from `https://formai.studio/download/`.
- `update {product, channel?}` updates one app; `update {}` updates everything waiting; `update {automatic_only: true}` does only what the preferences allow, which is what FormPortal's window does each time it opens. Only a newer version counts as an update; an older one offered by the catalogue is never installed this way.
- `preferences` reads the settings, or changes the ones given: `auto_update` (default on), `auto_update_beta` (default off), `only_when_closed` (default on), `notices` (default on), `keep_previous` (default on; off deletes the replaced version after each update, so rollback is no longer possible), `per_app` (product id to true or false, null to follow the global switch). These are the person's choices; change one only when they ask.

## Other versions

- `versions {product, channel?}` lists what the catalogue offers, newest first: the latest and its history, each with date, notes, size and whether there is a file for this computer, plus what is installed and kept for rollback.
- `install {product, version}` installs that exact version, newer or older; the replaced one is kept for rollback (unless the person turned `keep_previous` off).
- Installing an older version while automatic updates would replace it turns that app's automatic updates off (`automatic_updates_held` in the result says so), so it stays. Tell the person; `preferences {per_app: {"[id]": null}}` gives it back to the global switch.

## Open

`open {product, channel?}` starts the installed app and returns its process id. Only when asked. On macOS the first start of an unsigned build may be stopped by the system; the person allows it once under Privacy and Security.

## Roll back

`rollback {product, channel?}` swaps current and previous. It fails when no previous version is kept (a first install). After it, `installs` shows the older version as current; rolling back again returns to the newer one.

## Remove

`remove {product, channel?}` deletes the channel's install folder, the kept previous version included. The app's own documents and settings live elsewhere and stay. Confirm with the person, naming what will be deleted.

## Open apps

FormPortal checks for open copies (`installs` lists their `open_processes`).

- **Update while open:** allowed. The new version unpacks into its own folder and the open copy keeps running from the old one; the result carries `still_open` and a `note`. Tell the person the new version opens next time they start the app.
- **Reinstalling the version that is open, or remove:** refused with "[app] is open (process ...); close it first". Ask the person to close the app, then retry. Never end the process yourself.
- **Rollback while open:** allowed; it changes which version opens next time, not the open copy.
