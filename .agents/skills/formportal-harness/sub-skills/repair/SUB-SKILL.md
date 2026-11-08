---
name: repair
description: Checking and repairing FormPortal's installs. Use when an app will not open after an install, Go back fails because the earlier version is gone, disk space is taken by old downloads or leftover versions, an install was interrupted, or the person asks FormPortal to check itself, clean up, or repair; also for running that check silently on many computers.
---

# repair

## What it checks

Every install record: its folder is there, it has something to open, and the kept earlier version (if any) is there. FormPortal's own folders: versions no record points to (leftover), installs that did not finish (staging), and downloads that were not cleaned up. It never looks outside FormPortal's folder, skips anything younger than ten minutes (an install may be running), and never touches a running app.

## The loop

1. `repair` with no arguments only reports. It is safe any time. Read `report.findings`: each has `kind`, `problem` in plain words, the `fix` it would apply and `bytes`.
2. Tell the person what was found and what each fix does; get their go-ahead.
3. `repair {fix: true}`. A missing or broken app is installed again at the same version only when the catalogue still offers that exact file (same SHA-256); otherwise its record is forgotten and they install it again from Apps. Leftovers and old downloads are deleted. Report `fixed` and `freed`.
4. Run `repair` once more; an empty list confirms it.

## Silent, for administrators

`formportal cli repair` prints the report as JSON and changes nothing; `formportal cli repair --fix` repairs. Both run without a window, so they fit a management tool's script.

## Related

An update put off with `update {product, later: true}` waits until the app is closed; `update {product, later: false}` cancels that. A `formai://file/formcut?url=...` link (any app id in place of formcut) from a web page asks the person before downloading a Form project file into From the web in their projects folder.
