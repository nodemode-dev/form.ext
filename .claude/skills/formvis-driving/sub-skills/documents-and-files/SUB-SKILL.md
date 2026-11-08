---
name: documents-and-files
description: Opening, creating, inspecting and switching documents in formvis through its MCP tools. Use when the person wants to open a photo or project, start a new canvas at a size, see what is open, understand the layers and ids, work in several documents, undo or redo, or when a tool says no document is open or a layer id is wrong.
---

# documents-and-files

Tools: `get_document`, `get_image`, `new_document`, `open_file`, `switch_document`, `undo`, `redo`. Saving and exporting are in `export`. Two narrower reads: `get_selection` (the selection's bounds and mode) and `get_layer_tree` (the layers nested as folders hold them). Anything else the window can do is a command: see the command catalogue in `formvis-driving` and the `terminal` sub-skill.

## What each tool does

| Tool | Parameters | Result |
| --- | --- | --- |
| `get_document` | none | JSON: `name`, `width`, `height`, `resolution`, `mode`, `depth`, `profile`, `activeLayerId`, `selection` (`x`, `y`, `width`, `height` or null), `documents` (`id`, `name`, `active`), `layers` bottom to top (`id`, `name`, `kind`, `visible`, `opacity`, `blend`, `parentId`) |
| `get_image` | `max_size` 64 to 2048, default 1024 | The picture as a PNG, longer side at most `max_size`, as it looks (visible layers, masks, adjustments, styles) |
| `new_document` | `width`, `height` (1 to 30000), `name`, `background` (`white`, `transparent`, `black`) | Opens a new document and makes it current |
| `open_file` | `path` (absolute) | Opens a picture or project as a new document |
| `switch_document` | `id` from `documents` | Makes that document the one tools act on |
| `undo`, `redo` | `steps` 1 to 100, default 1 | Steps through the current document's history |

Layer `kind` values: `pixels`, `text`, `shape`, `smart object`, `group`, `adjustment:[kind]` (for example `adjustment:curves`), `fill:[kind]`.

`open_file` takes PNG, JPEG, WebP, AVIF, GIF, BMP, TIFF, HEIC and HEIF, QOI, TGA, ICO (its largest size), PBM, PGM, PPM and PAM, camera raw (DNG, CR2, CR3, NEF, ARW, RAF, ORF, RW2), and the projects `.fmv`, `.psd`, `.psb` and `.ora`, up to 512 MB. Camera raw is developed with the camera's white balance. A multi-page TIFF opens its first page through this tool.

## Recipes

### Look at what is open
1. `get_document`.
2. `get_image` with `max_size` 1024 (use 2048 only to inspect detail).
3. Describe back to the person what is there before changing anything when the request is ambiguous.

### Start a canvas at a destination size
1. `new_document` with the destination's pixel size (1280 by 720 for a video thumbnail, 1080 by 1080 for a square post, 1200 by 630 for a link card), a `name`, and `background`: `white`, `black` or `transparent`.
2. `get_document` to read the new layer list and note the id.

### Work on a photo from disk
1. `open_file` with the absolute path. The new document becomes current.
2. `get_document`, `get_image`.
3. The original file is never changed; edits live in the document until `save_project` or `export_image`.

### Combine two pictures
1. `open_file` the base picture; `place_image` (see `layers-and-masks`) the second one from its path as a new layer.
2. Do not open both and try to copy between them: there is no copy-between-documents tool. `place_image` is the way.

### Several documents
1. `get_document` lists `documents`; the active one is marked.
2. `switch_document` with an `id` before any tool that should act on another document. After `upscale`, the new upscaled document is already current.

### Take back a mistake
1. `undo` (default one step). Every tool call is one step; a multi-step recipe needs as many `undo` steps as tools you called.
2. `get_image` to confirm. `redo` steps forward again.

## When it fails

- "No document is open": `new_document` or `open_file`.
- "No layer has the id": the id came from before an `undo`, a merge or a delete; call `get_document` again.
- `open_file` errors name the problem (not absolute, not found, extension not taken, over 512 MB); give an absolute path to a file that exists.
- A picture beyond formvis's limits (30,000 pixels a side, and a pixel budget of about 100 megapixels unless raised in Preferences) may be refused; read the message and, if needed, tell the person it has to be opened by hand in the window, where formvis offers to open large pictures in pieces.
