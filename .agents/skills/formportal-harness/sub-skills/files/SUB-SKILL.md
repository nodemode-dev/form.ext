---
name: files
description: The person's Form project files through FormPortal. Use when they want their projects found, listed or searched, a projects folder added or dropped, a project opened in the right app, an earlier version of a project brought back or a version kept, or to know how much disk FormPortal and their projects use; or when files, folders, open_file, file_versions or storage fail.
---

# files

## What it is

Local only: FormPortal looks in folders the person chose on their own disk, finds Form projects by each app's project extensions (`.fc` FormCut, `.fmv` and `.formvis` FormVis, `.fmw` FormWav, more as apps ship), and keeps up to 20 earlier versions of each in its own folder (`history/`) when versions are on for that folder. Nothing goes to a cloud; there is no sharing or public link.

## The loop

1. `files` (with `query` to narrow): folders, recent projects newest first, the app for each, versions kept. Reading it also keeps a version of anything changed since the last one. With no folders, it names a suggested folder (Documents/Form).
2. `folders {action: "add", path, create}` after the person agrees; `remove` only stops listing, it deletes nothing.
3. `open_file {path}` opens a project in its installed app (stable first); if the app is missing, say which to install.
4. `file_versions {path}` lists versions (id, time, size, why). `action: "save"` keeps one now. `action: "revert", version` puts that version back after keeping the current file as a version, so nothing is lost; still confirm first, because the file on disk changes.
5. `storage`: what FormPortal uses (installed apps, downloads, extensions, kept versions, the catalogue copy) and each folder's size.

## Limits to say plainly

While FormPortal's window is open it keeps a version within a few seconds of each save; with it closed, a version is kept the next time FormPortal reads the folder (opening FormPortal, the Files screen, `files`), unless the app itself asked for one (`file_versions` with `action: "save"`). `formportal cli watch` does the same as the open window, from a terminal. A project with a `[file].preview.webp` beside it shows that preview in Files. Files over 256 MB are listed but not versioned. A scan stops at 5,000 projects and six folders deep.
