---
name: selections
description: Making and changing selections in formvis through its MCP tools. Use to select a rectangle or ellipse by pixel coordinates, select everything, deselect, invert, combine selections, select the main subject of a photo, or select pixels near a colour; the step that comes before fill, generative_fill, filters on part of a picture, and removing an object.
---

# selections

Tools: `select`, `select_subject`, `select_by_text`, `select_color_range`. The selection limits what `fill`, `generative_fill` and `apply_filter` change. `get_document` reports it as `selection` (`x`, `y`, `width`, `height`, or null).

## What each tool does

| Tool | Parameters | Notes |
| --- | --- | --- |
| `select` | `shape` (`rectangle`, `ellipse`, `all`, `none`, `invert`), `x`, `y`, `width`, `height`, `mode` (`replace`, `add`, `subtract`, `intersect`) | Rectangle and ellipse are in pixels from the picture's top-left; `mode` combines with the selection already there; `all`, `none`, `invert` ignore the geometry |
| `select_subject` | none | Finds the main subject (a person, animal or object) on this computer; replaces the selection. Needs the subject model, fetched on first use |
| `select_by_text` | `prompt` (what to select, in words), `mode` (`replace`, `add`, `subtract`, `intersect`) | Sends the picture and the words to SAM 3 on fal after asking the person; the returned mask becomes the selection. Fails with a message when nothing matches |
| `select_color_range` | `color` (`#rrggbb`), `fuzziness` 0 to 200, default 40 | Selects pixels near that colour in the active layer; widen `fuzziness` for gradients and noise |

There is no lasso, magic wand, path or feather tool. Approximate an irregular area with several `select` calls using `mode: "add"` or `"subtract"` (rectangles and ellipses), or with `select_subject` then `select` with `mode: "subtract"`. Tell the person if an area needs hand selection in the window.

## Recipes

### Select an object by coordinates
1. `get_image` and estimate the object's bounds in picture pixels. Remember the image is shown scaled: a point at (300, 200) in a 1024 pixel preview of a 4000 pixel wide photo is at about (1172, 781). Use `get_document` for the real width and scale by `width / shown width`.
2. `select` with `shape: "ellipse"` or `"rectangle"`, with `x`, `y`, `width`, `height`. Make it a little larger than the object, since a fill that includes a margin blends better.
3. `get_document` to read the `selection`; `get_image` shows no outline, so trust the numbers.

### Select two things
1. `select` the first with `mode: "replace"`.
2. `select` the second with `mode: "add"`.

### Select everything except a region
1. `select` the region.
2. `select` with `shape: "invert"`.

### Cut a hole in a selection
1. `select` the outer shape; `select` the inner shape with `mode: "subtract"`.

### Select the subject, then adjust only the background
1. `select_subject`.
2. `select` with `shape: "invert"`.
3. `apply_filter` (for example `gaussianBlur`) on the photo layer; it works inside the selection only.
4. `select` with `shape: "none"` when done.

### Select by colour
1. `set_layer` the right layer active (the colour is read from the active layer).
2. `select_color_range` with the colour and a `fuzziness` near 40; raise it if the area is patchy.
3. `get_document` to see how much was selected; if the bounds are the whole picture, lower `fuzziness`.

## Habits

- Always end an operation with `select` `shape: "none"` so the next tool does not act on a leftover selection.
- A selection belongs to the current document; `switch_document` changes which one you are selecting in.
- `undo` also undoes selection changes (they are history steps).

## When it fails

- `select_subject`: "No subject was found" means the model saw nothing clear; select by shape instead.
- "Selected ... " with a bounds covering everything after `select_color_range` means the colour range is too wide.
- Keep coordinates inside the picture: check them against `width` and `height` from `get_document`, and read the "The selection is now ..." reply to see what was really selected.
