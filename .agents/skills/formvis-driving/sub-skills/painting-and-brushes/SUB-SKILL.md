---
name: painting-and-brushes
description: Painting in formvis through its MCP tools, and what cannot be painted by an agent. Use when the person asks to paint, draw, colour in, fill an area with a colour, paint a background, add a vignette or a flat colour wash, or asks for brush strokes, a pencil, an eraser or specific brush settings. Explains that the MCP catalogue has no stroke tool and gives the flat-fill and shape alternatives.
---

# painting-and-brushes

The MCP picture tools have no brush, pencil, eraser, smudge, healing or clone tool and no brush settings, but the command catalogue does: `run_command` with `paint.stroke` draws one stroke through points (with pressure) using the active painting tool, after `tool.select.brush` or a `tool` parameter, and `tool.options.[tool].[option]` sets size, hardness and the rest. Read `list_commands` with `text: "brush"` first. What an agent can do is fill areas with flat colour and draw shapes. Be upfront about this when the request is for hand painting.

## Tools that paint

| Tool | Parameters | Notes |
| --- | --- | --- |
| `fill` | `color` (`#rrggbb`) | Fills the selection, or the whole active layer when nothing is selected. It sets formvis's foreground colour to `color` as a side effect. Needs a pixel layer |
| `draw_shape` | `kind` (`rectangle`, `ellipse`, `triangle`, `star`, `polygon`, `line`, `arrow`), `x`, `y`, `width`, `height`, `fill`, `stroke`, `stroke_width` | A new shape layer; at least one of `fill` and `stroke`. Set its `opacity` with `set_layer`, soften it with `rasterize_layer` then `apply_filter` |
| `add_layer` | `name` | An empty layer to fill, so the fill can be removed later |
| `generative_fill` | `prompt`, `model`, `influence` | Paints what a prompt describes into a selection (see `generation-and-ai`) |

## What to say when asked for brush work

- Hand drawing, signatures, painting over a spot, dodge and burn, smudging, cloning: say these need the Brush, Healing, Clone or Smudge tool used by hand in the formvis window (the person can press B for the Brush, and Window > Brush Settings holds tip, dynamics and presets).
- For removing a blemish or object, use a selection and `generative_fill` with no prompt instead of cloning (see `generation-and-ai`).
- For lightening or darkening an area, use a selection plus `add_adjustment` `exposure`, or a soft blend layer (below), instead of dodge and burn.

## Recipes

### Solid background on a new layer
1. `add_layer` with `name: "Background"`.
2. `fill` with the colour (nothing selected, so the whole layer fills).
3. `move_layer` it below the others if needed.

### Colour a region
1. `select` a rectangle or ellipse (or `select_color_range` for a coloured area).
2. `add_layer` to keep the colour separate; `fill` the colour.
3. `select` with `shape: "none"`; `set_layer` `opacity` or `blend` (`multiply`, `color`) to taste.

### Darker edges (a vignette)
A feathered vignette needs a radial gradient or a soft mask, and neither has a tool. The closest honest attempt:
1. `select` an ellipse over the centre of the picture, then `select` with `shape: "invert"` so the edges are selected.
2. `add_layer` (name Edges) and `fill` it black, then `select` with `shape: "none"`.
3. `apply_filter` `gaussianBlur` with a large `radius` (for example 150) on that layer to soften the edge, `set_layer` `opacity` 0.4, `get_image`.
4. If it looks harsh, `undo` back or delete the layer and tell the person a proper vignette is quicker by hand in the window.

### A flat colour wash for text legibility
1. `draw_shape` a `rectangle` across the area behind the text, `fill: "#000000"`.
2. `set_layer` that id with `opacity: 0.5`.
3. `add_text` above it (the plate is below the text if added before the text; otherwise `move_layer` it `below` the text).

### Replace one colour with another
No recolour tool exists. Use `select_color_range` on the colour, `add_layer`, `fill` the new colour, and set the layer `blend` to `color` so the original shading survives.

## Limits to remember

- `fill` replaces pixels on the target layer; on a text, shape or adjustment layer it may fail or do nothing useful. `rasterize_layer` first, or fill a new layer.
- There is no gradient tool; a gradient needs a gradient-map adjustment (`add_adjustment` `kind: "gradientMap"`, tuned by hand) or `generate_image`.
