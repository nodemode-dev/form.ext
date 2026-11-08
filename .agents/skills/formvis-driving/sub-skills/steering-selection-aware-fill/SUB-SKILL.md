---
name: steering-selection-aware-fill
description: Steer Selection-Aware Fill as an agent, so a fill is drawn from the place the person chose. Use when the person says fill or remove this using the texture from over there, only from this area, draw the fill from the left side, keep the fill from using the wrong part of the picture, or when a Selection-Aware Fill or content-fill result shows texture from the wrong place. Covers the content-fill command with prefer and strength, checking the result, a second pass or a Clone and Healing cleanup, and when to leave the fill on Auto.
---

# steering-selection-aware-fill

## What the person gets

Selection-Aware Fill removes or heals the selection from the rest of the picture. The Custom painted area in the window is a preference, not a limit: patches there are favoured by up to 60 percent, and the whole picture is still searched. So a person who wants the fill drawn from one place cannot force it by painting alone. You get close to that result with the tools below: set the preference area, set the strength to its top value, run the fill, look at it, and fix what is wrong by hand-guided steps. Everything runs through the formvis MCP tools and the command catalogue; the window stays as it is.

## Steps, in order

1. `get_document`, then `get_image` to look. Make the layer that holds the pixels active with `set_layer` (`active: true`).
2. Ask the person which place the fill should come from if they have not said. Work out its box in document pixels from `get_image` (use `x`, `y`, `width`, `height` to look closer).
3. Select the hole generously: `select` with `shape: "rectangle"` or `"ellipse"` and `x`, `y`, `width`, `height` (see `selections`), or `select_subject`.
4. Paint the preference area and run the fill in one call: `run_command` with `id: "content-fill"` and `params: { "prefer": [{ "x": 0, "y": 400, "width": 600, "height": 500 }], "strength": 0.6 }`. `prefer` is a list of rectangles in document pixels (add several to cover an odd shape); `strength` is 0 to 0.6 and defaults to 0.4. Use 0.6 when the person wants the fill drawn from one place. Without `prefer` the plain quick fill runs.
5. Check the result: `get_image` of the document, and `get_image` with `view: "layer"` and the layer `id` to see the filled pixels alone, cropped with `x`, `y`, `width`, `height` around the hole at 1:1. Look at it; a tool reply only says the step ran.
6. If texture from the wrong place shows, `undo`, then either run again on a smaller hole (select part of the hole, fill, select the next part, so each pass has little to choose from), or keep the fill and clean up by hand, below.
7. `select` with `shape: "none"`, `get_image` once more, then deliver (`export_image`, `save_project`).

## Cleanup with Clone Stamp or Healing Brush, sampling where the person chose

Use this when a small patch of the fill is still wrong. Take the source point from the person (or confirm it with them), never guess a place.

1. `run_command` `tool.select.cloneStamp` (or `tool.select.healingBrush` to blend into the surroundings).
2. `run_command` `clone-source-set` with `params: { "x": 320, "y": 610 }`, the point in document pixels to copy from.
3. Optionally `run_command` `tool.options.cloneStamp.size` and the other `tool.options.[tool].[option]` ids to match the patch (read `describe_command` for the value each takes).
4. `run_command` `paint.stroke` with `params: { "points": [{ "x": 500, "y": 700 }, { "x": 540, "y": 705 }] }`: one stroke over the bad patch on the active layer, one undo step.
5. `get_image` and repeat from step 2 for the next patch.

## Uniform textures: use Auto

For sky, star fields, noise, film grain, sand, or any texture that looks the same everywhere, any source is as good as any other. Run `content-fill` with no `prefer` (Auto) and do not spend a preference on it. A preference can make these worse, because it narrows the pick to one stretch of texture.

## What not to do

- Never ask the app for a hard sampling limit: do not look for a command, setting or parameter that restricts the fill to a sampling area, and do not tell the person one exists. The area is a preference by design.
- Never build a mask, selection, layer or cropped copy whose purpose is to exclude the rest of the image from the fill (for example by selecting the hole plus only the wanted area, by hiding or cutting away the other pixels, or by filling on a copy that holds only the wanted area). That is the same hard limit by another route.
- Do not drive the window's Selection-Aware Fill workspace (`content-fill-workspace`) with `ui_pointer` or clicks to paint a limit; the `prefer` parameter is the way to set a preference.
- Do not set `strength` above 0.6; the engine caps it.
- If the person insists on drawing only from one place, tell them plainly that the fill favours that place but may still use others, and offer the second pass or the Clone cleanup above, which copy from a place they choose.
