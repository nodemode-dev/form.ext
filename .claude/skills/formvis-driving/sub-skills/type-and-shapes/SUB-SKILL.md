---
name: type-and-shapes
description: Adding text and shapes in formvis through its MCP tools. Use to add a title, caption, label or watermark text, centre text on the canvas, put a plate or bar behind text, draw rectangles, ellipses, triangles, stars, lines and arrows, build a thumbnail, poster, banner, quote card or social graphic, or fix a text layer's position, colour or stacking.
---

# type-and-shapes

Tools: `add_text`, `draw_shape`, then `transform_layer`, `move_layer`, `set_layer`, `rasterize_layer` to place and finish them. Each call makes a new layer and returns its id.

## What each tool does

| Tool | Parameters | Notes |
| --- | --- | --- |
| `add_text` | `text` (required, up to 5000 characters; newlines make lines), `x`, `y` (top-left of the text, pixels), `size` (pixels, default 48), `color` (`#rrggbb`, default `#000000`), `font` (default `Inter`), `bold`, `italic`, `align` (`left`, `center`, `right`, how lines align to each other) | One text layer, antialiased, line height 1.2, no wrapping box: break lines yourself with newlines |
| `draw_shape` | `kind` (`rectangle`, `ellipse`, `triangle`, `star`, `polygon`, `line`, `arrow`), `x`, `y`, `width`, `height` (the bounding box), `fill`, `stroke` (`#rrggbb`; omit for none), `stroke_width` (0.5 to 200, default 3) | A shape layer; give a `fill`, a `stroke`, or both. Using it sets formvis's foreground and background colours as a side effect |
| `transform_layer` | `id`, `x`, `y` (new top-left), `scale` (percent), `rotation` (degrees), `flip` | Its reply gives the layer's position and size, which is how you measure text |
| `move_layer` | `id`, `target`, `where` | Puts a plate below the text |
| `set_layer` | `id`, `opacity`, `blend`, `name`, `visible` | Soft plates and watermark text |
| `rasterize_layer` | `id` | Needed before a filter such as a blur or glow on text or a shape |

Fonts: `font` names a family installed on this computer; `Inter` always works. If a named family is missing the result may fall back; verify with `get_image`.

There is no tool to edit a text layer's content afterwards. To change the words, `delete_layer` and `add_text` again (keep its `x`, `y`, `size`).

## Measuring and centring text

The text's width is not known when you create it. Measure it:
1. `add_text` at `x: 0`, `y: 0`; note the returned `id`.
2. `transform_layer` with just that `id`; the reply says "is at 0, 0, W by H" with the layer's size.
3. Compute `x = (canvas width - W) / 2` and `y = (canvas height - H) / 2` using `get_document`'s width and height.
4. `transform_layer` with `id`, `x`, `y`.
5. `get_image`.

## Recipes

### A video thumbnail (1280 by 720) with a title
1. `new_document` 1280 by 720, `background: "black"` (or `add_layer` and `fill` a brand colour, or `generate_image` for a picture).
2. `add_text` `text: "LAUNCH DAY"`, `size: 160`, `color: "#ffffff"`, `bold: true`, `x: 0`, `y: 0`.
3. Measure and centre as above.
4. `draw_shape` `kind: "rectangle"` behind it with `fill: "#000000"`, sized text width + 80 by text height + 40 at (text x - 40, text y - 20); `set_layer` `opacity: 0.55`; `move_layer` it `below` the text.
5. `get_image`, then `export_image` to an absolute `.png` or `.jpg` path.

### A caption bar on a photo
1. `open_file`; `get_document` for width and height.
2. `draw_shape` a `rectangle` at `x: 0`, `y: height - 140`, `width`: the photo width, `height: 140`, `fill: "#000000"`; `set_layer` `opacity: 0.6`.
3. `add_text` the caption, `size: 48`, `color: "#ffffff"`, `x: 40`, `y: height - 110`.
4. `get_image` and nudge with `transform_layer`.

### Text with a soft glow
1. `add_text`, then `duplicate_layer` it.
2. The copy sits above the original. `rasterize_layer` the original (use its id), `set_layer` it `active: true`, `apply_filter` `gaussianBlur` `radius: 12`, then `set_layer` its `blend: "screen"` if the glow is lighter than the background.
3. Keep the sharp text on top. `get_image`.

### Arrow or highlight box on a screenshot
1. `draw_shape` `kind: "arrow"` with `x`, `y`, `width`, `height` spanning start to end, `stroke: "#ff3b30"`, `stroke_width: 6`.
2. For a box: `kind: "rectangle"` with only `stroke` and no `fill`.

### A quote card
1. `new_document` 1080 by 1080, `background: "white"`.
2. `add_text` the quote with newlines every ~28 characters, `size: 64`, `align: "center"`, `x`, `y` after measuring.
3. `add_text` the author smaller, `size: 36`, in a lighter `color`.
4. `draw_shape` a thin `line` between if wanted.

## When it fails

- Text looks cut off or wrong size: `size` is pixels, so 48 is small on a 4000 pixel photo; scale with the picture (about 4 to 8 percent of the height for titles).
- A filter says the layer is a text or shape layer: `rasterize_layer` first (this makes it uneditable, so keep a copy if needed).
- Hex colours must be `#rrggbb`; three-digit forms and names are refused.
