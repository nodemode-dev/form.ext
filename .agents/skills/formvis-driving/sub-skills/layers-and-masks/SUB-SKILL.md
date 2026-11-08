---
name: layers-and-masks
description: Working with layers in formvis through its MCP tools. Use to add, place, duplicate, reorder, rename, hide, delete, merge or flatten layers, set opacity or a blend mode, rasterize text or shapes, or cut a subject out with remove_background so it keeps a mask; also for placing an image file on top of a document.
---

# layers-and-masks

Tools: `add_layer`, `place_image`, `duplicate_layer`, `set_layer`, `move_layer`, `delete_layer`, `merge_layers`, `flatten_image`, `rasterize_layer`, `remove_background`. Layer ids come from `get_document`.

## What each tool does

| Tool | Parameters | Notes |
| --- | --- | --- |
| `add_layer` | `name` | Empty layer above the active one; becomes active; returns its id |
| `place_image` | `path` (absolute .png, .jpg, .jpeg, .webp) or `data` (base64), `name`, `x`, `y` | New layer at its own size, top-left at `x`, `y`; scale it with `transform_layer` |
| `duplicate_layer` | `id`, `name` | Copy above the original; returns the copy's id |
| `set_layer` | `id`, `name`, `visible`, `opacity` 0 to 1, `blend`, `active` | Any subset. `blend` is an id: `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `soft-light`, `hard-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`, `linear-dodge`, `linear-burn`, `vivid-light`, `linear-light`, `pin-light`, `hard-mix`, `darker-color`, `lighter-color`, `subtract`, `divide`, `dissolve` |
| `move_layer` | `id`, `target`, `where` (`above` or `below`) | Reorders the stack |
| `delete_layer` | `id` | Undoable |
| `merge_layers` | `ids` | Several ids merge into one; a single id merges that layer into the one below it |
| `flatten_image` | none | Everything into one layer |
| `rasterize_layer` | `id` | Text, shape or smart object to pixels, so filters and painting apply |
| `remove_background` | none | Acts on the active layer: keeps the subject as a layer mask (undoable), on this computer |

## Facts

- The new element always lands above the active layer (`add_layer`) or on top (`place_image`, `add_text`, `draw_shape`, `generate_image`). Use `move_layer` to put it where it belongs.
- Masks: `remove_background` is the tool that creates a mask, a non-destructive one; the pixels underneath stay. There is no tool to paint on, edit or invert a mask, and none for clipping layers or groups. For a selection-shaped mask, use `generative_fill` (its result layer is masked to the selection), or tell the person to add a mask by hand in the window (Layer menu) and then continue.
- `remove_background` needs the right layer active: `set_layer` with `active: true` first, then call it. It does not take an `id`.
- Layer styles (drop shadow, glow, stroke) have no tool. Fake a soft shadow instead: `draw_shape` a dark ellipse under the subject, `rasterize_layer` it, `apply_filter` with `gaussianBlur` (a `radius` in the settings), lower its `opacity`, and `move_layer` it below the subject.
- Hidden layers are not in `get_image` or in exports.

## Recipes

### Cut a subject out and put it on a new background
1. `get_document`, `get_image`; find the photo layer's id.
2. `set_layer` with `id` and `active: true`.
3. `remove_background`. `get_image` to check the edges; `undo` if it caught the wrong thing.
4. Add the new background: `add_layer` (name it Background), `fill` with a colour; or `generate_image` for a picture; or `place_image` a file.
5. `move_layer` with `id` of the background layer, `target` the photo layer's id, `where: "below"`.
6. `get_image`, then `export_image`.

### Place a logo or watermark
1. `place_image` with the file's absolute `path`, `name: "Logo"`, `x` and `y` for the corner.
2. `transform_layer` with its `id` and `scale` (a percentage) to size it.
3. `set_layer` with `opacity: 0.6` for a watermark. `get_image`.

### Darken or tint with a blend layer
1. `add_layer` (name Tint); `fill` a colour (nothing selected fills the whole layer).
2. `set_layer` with that `id`, `blend: "multiply"` or `"color"`, `opacity: 0.35`.
3. `get_image`; adjust `opacity` until right.

### Try a look and keep the original
1. `duplicate_layer` the photo.
2. Work on the copy (it becomes active); hide or delete it if rejected.

### Flatten for a flat export
Do not flatten unless the person wants it: `export_image` already writes the flattened look. Use `flatten_image` only when a later step needs one layer; `save_project` first if layers may be wanted back.

## When it fails

- "No layer has the id": call `get_document`; ids change after merges and undo.
- `rasterize_layer` on a pixel layer does nothing useful; check `kind` first.
- `merge_layers` with a single id on the bottom layer fails ("has no layer below it").
