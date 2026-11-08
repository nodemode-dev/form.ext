# FormPortal MCP tools

Generated from the FormPortal MCP server by `./formportal agents sync`; do not edit by hand.

## Contents

- The tool table, below
- Parameters, one heading per tool
- Shell equivalents, including `policy` and the command-line-only `mirror`

## Tools

| Tool | Changes the computer | What it does |
| --- | --- | --- |
| `status` | no | FormPortal's version, this computer's platform, the install folder, the catalogue source and everything installed. Call first. |
| `apps` | no | The Form apps that are released (a published release in the catalogue or on the app's GitHub repository) or installed here, as on formai.studio: name, what it replaces, group, and per channel what the catalogue offers this computer and what is installed. Apps not released yet are not named; on_the_way gives each scheduled group's opening date and how many apps it holds, plus one group with opens null for apps whose date is still to come (counted from formai.studio, present only when it answered); a names array per group appears only when the person has a supporter code that formai.studio confirmed. Works offline from the registry when the catalogue cannot be read, and says why. |
| `app_info` | no | The registry entry and the catalogue's releases for one product: versions per channel, artifacts with size, SHA-256 and minimum OS, and release notes. |
| `installs` | no | What FormPortal has installed: product, channel, current version with path and SHA-256, the previous version kept for rollback, and the process ids of any copy that is open. |
| `install` | yes | Downloads the release the catalogue offers this computer for the product and channel, verifies its SHA-256, unpacks it per user (no administrator) and keeps the version it replaces for rollback. Installing the newer version over an older one is how an update is done. If the app is open, the new version goes into its own folder, the open copy keeps running untouched, and the result's note says the new version opens next time; reinstalling the exact version that is open is refused. Changes the person's computer: confirm first. |
| `versions` | no | Every version of a product's channel the catalogue offers, newest first (the latest and its history), with date, release notes, size and whether there is a file for this computer, plus what is installed and kept for rollback. Install one with install and version. |
| `updates` | no | Every installed app and channel with a newer version in the catalogue: from and to versions, download size, release notes, whether a copy is open, and whether the person's preferences would update it automatically. Also says when a newer FormPortal is available. |
| `update` | yes | With product (and channel), installs that app's newer version; with later true instead, puts it off until the app is closed (installed the next time FormPortal checks, whatever the automatic setting), and later false cancels that. Without product, installs every waiting update; with automatic_only, only those the person's preferences allow or put off (skipping open apps when only_when_closed is on, and always for put-off ones). An open app keeps running and the new version opens next time. Changes the person's computer: confirm first. |
| `preferences` | yes | Reads FormPortal's update preferences, or changes the ones given: auto_update (all apps, default on, applied while FormPortal is open), auto_update_beta (default off), only_when_closed (default on), notices (default on), keep_previous (default on: keep the replaced version for rollback; off deletes it after each update), per_app (an object of product id to true, false, or null to follow the global setting), open_at_login (default off: open the FormPortal window when the person logs in; the window writes or removes its login item when it next starts, and runs nothing in the background). supporter_code is only ever reported as true or false. Changing them is the person's choice: confirm first. |
| `extensions` | no | The open extension index (effects, looks, templates, presets, plugins for the thirteen Form apps that load extensions: formvis, formcut, formwav, formpdf, formdeck, formlit, formmd, formencoder, formvfx, formmcp, formtray, formskills, formportal) with each package's app, author, kind, permissions, extension API, homepage, whether it is signed, verified (reviewed and published by form.ext-registry), source (its folder in the registry), blocked (the block list's reason, if any), its install state, and support, an https page where people can pay or sponsor its maker if it has one (the extension is free either way); plus every installed extension, including sideloaded ones (source sideload), the block list (blocked) and any installed extension the block list just turned off (turned_off, with the reason). The index is form.ext-registry's signed index (https://github.com/nodemode-dev/form.ext-registry/releases/download/index/extensions.json, verified with registry keys only), or extensions_source, or FORMPORTAL_EXTENSIONS. index_error says when it was refused (this build trusts no registry key yet, a signature that does not match) or when the registry is private or unreachable. |
| `extension_install` | yes | Installs a package from the index by id (download, SHA-256 check, publisher signature check, manifest check against the index), or a local .formpkg file by path (sideloaded and labelled so unless the index lists the same file). A package whose manifest asks for an extension API other than "1", that runs native code, that is on the registry's block list, or (from the index) that carries no publisher signature without allow_unsigned, is refused. The app picks it up while it runs (it watches FormPortal's enabled.json); note says so, or that an older installed app uses it the next time it starts. Changes the person's computer: confirm first, and name the permissions it asks for. |
| `extension_remove` | yes, destructive | Removes an installed extension and its files; the app drops it while it runs. Confirm first. |
| `extension_enable` | yes | Turns an installed extension on or off without removing it; the app sees the change while it runs (an app older than its extension host release sees it the next time it starts). An extension on the registry's block list stays off. |
| `account` | no | Whether the person has signed in to GitHub in FormPortal (optional: installing and updating never need it), as whom, and which access they granted (scopes). configured false means this FormPortal has no GitHub app set up. Signing in and out is the person's own step in FormPortal's Preferences or with formportal-cli sign-in; this tool never starts it. |
| `shares` | no | The person's Files folders shared through their own GitHub account (each a private repository named formportal-library-...), libraries others shared with them (and invitations waiting), and files given a public link, with portfolio, the address of the front page in formportal-public that lists them all. Needs a GitHub sign-in for invitations; the rest is read from this computer. |
| `share` | yes | Shares one of the person's Files folders as a private repository in their own GitHub account, sends its files (unchanged files are skipped, files over 100 MB are listed as skipped) and invites the GitHub users named. Again on a shared folder, it sends what changed. Puts their files on GitHub and invites people: confirm first. |
| `share_accept` | yes | Accepts an invitation from the shares tool and downloads that library into Shared in the person's projects folder, which Files then lists. Confirm first. |
| `share_pull` | yes, destructive | Downloads what changed in a library shared with the person (owner/repo from the shares tool) into its folder; files the person changed locally are replaced by the shared version. |
| `publish` | yes | Gives a file a public link that anyone can open, by storing it in the public repository formportal-public in the person's GitHub account; with unpublish true, removes it. Makes the file public: confirm first. |
| `policy` | no | Whether an organisation manages FormPortal on this computer, and what its policy fixes: the catalogue address and extra catalogue keys, whether unsigned catalogues are refused, update settings that cannot be changed (locked), which apps and channels may be installed, and whether extensions and sideloaded packages are allowed. Read it before suggesting a change a policy would refuse. The policy is a system file (/etc/formportal/policy.json, /Library/Application Support/FormPortal/policy.json or %ProgramData%\FormPortal\policy.json) set by the organisation; FORMPORTAL_POLICY is read only for testing when no system file exists. |
| `files` | yes | The person's Form project files (by each app's project extensions, e.g. .fc for FormCut) in the folders they gave FormPortal, newest first, with the app that opens each, size, date and how many earlier versions FormPortal keeps; plus each folder's file count and size. query filters by name or app. Reading also keeps a version of any file that changed since the last one, in folders where versions are on. Local only: nothing leaves the computer. |
| `folders` | yes | Lists the folders FormPortal looks in; with action add and a path (the suggested folder if none), adds one (create true makes it), keep_versions on by default; with action remove, stops listing one without touching its files. Changing them is the person's choice: confirm first. |
| `open_file` | yes | Opens a project file with the installed Form app that makes it (by extension), stable first, then beta. Says which app to install if none is. |
| `file_versions` | yes | The versions FormPortal kept of a project file in one of its folders, newest first (id, time, size, SHA-256, why it was kept). action save keeps one now; action revert with version puts that version back after keeping the current file as a version too, so nothing is lost. Reverting changes the person's file: confirm first. |
| `storage` | no | What FormPortal uses on disk (installed apps, downloads, extensions, kept file versions, the catalogue copy) and the size of each projects folder. |
| `fonts` | no | The open font index (families with foundry, licence, category and styles, each marked installed or not) read from fonts.json beside the catalogue (or fonts_source, FORMPORTAL_FONTS), signed like the catalogue; plus every font FormPortal installed, from the index or the person's own files, the per-user font folder, and updates: installed styles whose file in the index has changed (font_install with the id and style installs the new one). query filters by family, foundry or category. |
| `font_install` | yes | With id (and optionally style), downloads that family or style from the index, checks each file's SHA-256 and that it is a TrueType or OpenType font, refuses anything not under OFL-1.1, Apache-2.0 or MIT, and installs it for this user only (no administrator). With path, adds the person's own TTF or OTF file instead; rights_confirmed must be true, meaning the person said they have the right to use it. Apps see new fonts after they restart. Confirm first. |
| `font_remove` | yes, destructive | Removes a font FormPortal installed (a whole family, or one style), from the per-user font folder. Never touches fonts it did not install. Confirm first. |
| `media` | no | The open media index (media.json beside the catalogue, or media_source or FORMPORTAL_MEDIA, signed like the catalogue): images, video, audio and Form app templates, each with creator, licence (CC0, CC BY, CC BY-SA, Apache, MIT, OFL), source page, credit line and whether it is saved; plus everything saved in the person's Library. query and kind filter. |
| `media_save` | yes | Saves an item from the media index into the person's Library (Documents/Form/Library by default, or FORMPORTAL_LIBRARY), checking its SHA-256 and writing its credit line beside it and into credits.json. With use true on a template, also copies it into the first projects folder (or folder) and opens it in its app. Confirm first. |
| `media_remove` | yes, destructive | Removes an item FormPortal saved into the Library, with its credit file. Copies of templates already in projects folders are not touched. Confirm first. |
| `repair` | yes, destructive | Checks every install record (its folder is there, it has something to open, the kept earlier version is there) and FormPortal's own folders (versions no record points to, unfinished installs, old downloads). Without fix it only reports, which is safe to run any time. With fix true it reinstalls a broken app's same version when the catalogue still offers that exact file (same SHA-256), otherwise forgets the record, forgets missing earlier versions, and deletes leftovers. It never touches anything outside FormPortal's folder, folders younger than ten minutes, or a running app. Confirm before fix. |
| `learn` | no | Tutorials: FormPortal's own six (installing, betas, going back, files, fonts and stock, agents) plus the Form apps' tutorials from the signed tutorial index (learn.json beside the catalogue, or learn_source or FORMPORTAL_LEARN). Each has its steps (some name the FormPortal screen they happen on), minutes, level, and the steps this person has finished (numbered from 1), kept on this computer only. product and query filter. |
| `learn_progress` | yes | Marks a tutorial step finished (done true, the default) or not (done false), steps numbered from 1; or with reset true clears the tutorial's progress. Progress is kept on this computer only. |
| `app_agents` | no | Whether an installed Form app ships its own MCP server (declared in the app's form-app.json), the server name FormPortal uses for it (the product id, with -beta for a beta), and for Claude Code, Codex and Cursor whether it is connected, not connected, taken by another server of the same name, or the client is not installed. manifest is the install's form-app.json as read (format_version 1 or 2): whether the app has an MCP server and, for format_version 2, its skills archive and each skill's name and description. |
| `connect_agents` | yes | Adds the installed app's MCP server to the clients given (claude, codex, cursor; all three by default) at user scope, or with disconnect true takes it out. The entry starts FormPortal's app-mcp, which runs whichever version is installed, so updates and rollbacks need no change. Never overwrites a server of the same name that FormPortal did not add; backs up each config file it changes. Changes the person's agent configuration: confirm first. |
| `open` | yes | Starts the installed app for the product and channel and returns its process id. |
| `rollback` | yes, destructive | Swaps the installed version for the previous one FormPortal kept. Fails when no previous version is kept. Confirm first. |
| `remove` | yes, destructive | Uninstalls the product's channel and deletes its install folder, including the kept previous version. The app's own documents elsewhere are not touched. Refused while the app is open. Confirm first. |

## Parameters

### status

No parameters.

### apps

- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.

### app_info

- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.

### installs

No parameters.

### install

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.
- `version` (optional): string. An earlier version from the versions tool. Omit for the newest.

### versions

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.

### updates

- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.

### update

- `automatic_only` (optional): boolean. Only the updates the preferences allow or that were put off.
- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `later` (optional): boolean. Put this app's update off until it is closed (true), or cancel that (false).
- `product` (optional): string. Product id from apps, e.g. formcut, formvis, formencoder.
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.

### preferences

- `auto_update` (optional): boolean. 
- `auto_update_beta` (optional): boolean. 
- `keep_previous` (optional): boolean. 
- `notices` (optional): boolean. 
- `only_when_closed` (optional): boolean. 
- `open_at_login` (optional): boolean. 
- `per_app` (optional): object. 

### extensions

- `extensions_source` (optional): string. Extension index address or file.
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.

### extension_install

- `extensions_source` (optional): string. 
- `id` (optional): string. 
- `path` (optional): string. Absolute path of a .formpkg file.
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.

### extension_remove

- `id`: string. 
- `product`: formvis|formcut|formwav|formpdf|formdeck|formlit|formmd|formencoder|formvfx|formmcp|formtray|formskills|formportal. The app the extension is for, by its extension product id (formdeck and formportal, not the catalogue's formslide and formai).

### extension_enable

- `enabled`: boolean. 
- `id`: string. 
- `product`: formvis|formcut|formwav|formpdf|formdeck|formlit|formmd|formencoder|formvfx|formmcp|formtray|formskills|formportal. The app the extension is for, by its extension product id (formdeck and formportal, not the catalogue's formslide and formai).

### account

No parameters.

### shares

No parameters.

### share

- `folder`: string. A folder from the files tool, full path.
- `invite` (optional): array. GitHub logins to invite.

### share_accept

- `id`: integer. 

### share_pull

- `repo`: string. 

### publish

- `file`: string. 
- `unpublish` (optional): boolean. 

### policy

No parameters.

### files

- `limit` (optional): integer. At most this many files (default 200).
- `query` (optional): string. 

### folders

- `action` (optional): list|add|remove. 
- `create` (optional): boolean. 
- `keep_versions` (optional): boolean. 
- `path` (optional): string. 

### open_file

- `path`: string. 

### file_versions

- `action` (optional): list|save|revert. 
- `path`: string. 
- `version` (optional): string. 

### storage

No parameters.

### fonts

- `fonts_source` (optional): string. 
- `query` (optional): string. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.

### font_install

- `fonts_source` (optional): string. 
- `id` (optional): string. 
- `path` (optional): string. 
- `rights_confirmed` (optional): boolean. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.
- `style` (optional): string. 

### font_remove

- `family`: string. 
- `style` (optional): string. 

### media

- `kind` (optional): image|video|audio|template. 
- `media_source` (optional): string. 
- `query` (optional): string. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.

### media_save

- `folder` (optional): string. 
- `id`: string. 
- `media_source` (optional): string. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.
- `use` (optional): boolean. 

### media_remove

- `id`: string. 

### repair

- `fix` (optional): boolean. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.

### learn

- `learn_source` (optional): string. 
- `product` (optional): string. 
- `query` (optional): string. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.

### learn_progress

- `done` (optional): boolean. 
- `id`: string. 
- `learn_source` (optional): string. 
- `reset` (optional): boolean. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json.
- `step` (optional): integer. 

### app_agents

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.

### connect_agents

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `clients` (optional): array. 
- `disconnect` (optional): boolean. Take the app out of the clients instead.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.

### open

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.

### rollback

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.

### remove

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.

## Shell equivalents

`./formportal cli status`, `apps [--source S]`, `info [product]`, `installs`, `install [product] [--channel C] [--source S] [--allow-unsigned]`, `open [product]`, `rollback [product]`, `remove [product]`, `policy`. Output is the same JSON the tools return. `mirror --to DIR --base-url URL` exists only on the command line (see sub-skills/organisations).
