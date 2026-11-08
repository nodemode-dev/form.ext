---
name: export
description: Saving and delivering work from formvis through its MCP tools. Use to export a picture as PNG, JPEG or WebP at an absolute path, export at a particular width or height, save an editable .fmv project, keep a transparent PNG, hand back a file for a destination such as a thumbnail, social post or web page, or render a video timeline to mp4, gif or frames.
---

# export

Tools: `export_image`, `save_project`, `timeline_render`. All three write a file at an absolute path (`~` works), the folder must exist, and an existing file is replaced.

## What each tool does

| Tool | Parameters | Notes |
| --- | --- | --- |
| `export_image` | `path` (absolute, ending `.png`, `.jpg`, `.jpeg` or `.webp`), `quality` (0.1 to 1, default 0.92) | Writes the document as it looks: visible layers, masks, adjustments, styles flattened. The type comes from the extension; `quality` matters for JPEG and WebP |
| `save_project` | `path` (absolute, ending `.fmv`) | Keeps every layer, mask, adjustment and text editable. Reopen with `open_file` |
| `timeline_render` | `path` (`.mp4`, `.gif`, `.zip`), `from`, `to`, `scale` | See `timeline-and-video` |

`export_image` has no size parameter. To deliver at a size, resize first (and undo afterwards if the document should stay full size).

## Before writing

1. Choose a path the person asked for. If they gave only a name, ask where, or use the folder of the opened file (the document name from `get_document` and the path you opened).
2. Do not replace a file you did not create without asking; pick a new name (`photo-edited.jpg`) instead.
3. Check the picture with `get_image` so you are not exporting a mistake.
4. Check the folder exists; the error says if it does not, and you cannot create it with these tools: ask the person to create it, or use a folder that exists.

## Recipes

### Export as is
1. `get_image`.
2. `export_image` `path: "/Users/me/Pictures/final.png"`.
3. Report the path and size from the reply ("Wrote ... (N bytes)").

### JPEG at 2000 pixels wide, keeping proportions
1. `save_project` first if the work should stay editable.
2. `get_document` for `width` and `height`; `f = 2000 / width`.
3. `resize_image` `width: 2000`, `height: round(height * f)`.
4. `export_image` `path: "/Users/me/Desktop/final.jpg"`, `quality: 0.9`.
5. `undo` to return the document to full size (one `undo` for the resize).

### Transparent PNG of a cut-out
1. The background must be transparent: a `remove_background` mask on a photo layer, with no filled layer beneath, or `new_document` with `background: "transparent"`.
2. `export_image` to a `.png` path. JPEG has no transparency, so use PNG or WebP when it matters.

### Several sizes
For each target: `resize_image`, `export_image` to a separately named file, `undo`. Always `undo` before the next size so each resize starts from the original, never from an already shrunk copy.

### Keep working tomorrow
`save_project` with a `.fmv` path next to the original; tell the person the path. Reopen with `open_file`.

### Web-friendly photo
`resize_image` to the display width (1600 is typical), apply `unsharpMask` lightly if wanted (see `adjustments-and-filters`), `export_image` as `.webp` with `quality: 0.85`, or `.jpg` at 0.85.

### Video
`timeline_render` with an `.mp4` path (H.264), or `.gif`, or `.zip` of numbered PNG frames; see `timeline-and-video`.

## Not available through tools

PDF, TIFF, EXR, HDR, AVIF, animated GIF from a frame animation, PSD, CMYK and 16 bit exports, export presets and batch export. They exist in the window under File > Export and Save a Copy; tell the person to use those when they need them. `.psd`, `.psb` and `.ora` projects can be opened with `open_file` but not written by these tools.

## When it fails

- "Give an absolute path": use a full path such as `/Users/you/Pictures/photo.png`.
- "formvis takes .fmv here" or ".png, .jpg, .jpeg, .webp here": fix the extension.
- "The folder ... does not exist": choose an existing folder.
- "Could not write the file": permission or disk; tell the person the message.
