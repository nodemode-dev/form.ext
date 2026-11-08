---
name: transform-and-warp
description: Moving, scaling, rotating, flipping, resizing, cropping and extending in formvis through its MCP tools. Use to place or size a layer, rotate a layer, mirror a layer or the whole picture, resize an image to a width and height, change the canvas size, crop to a rectangle or a square or an aspect ratio, add space around a picture, or when the person asks for a warp, perspective, skew or liquify, which have no MCP tool.
---

# transform-and-warp

Tools: `transform_layer`, `flip_canvas`, `resize_image`, `resize_canvas`, `crop`. For growing the canvas and painting the new border, `generative_expand` (see `generation-and-ai`). For enlarging with detail, `upscale`.

## What each tool does

| Tool | Parameters | Notes |
| --- | --- | --- |
| `transform_layer` | `id`, `x`, `y`, `scale` (1 to 1000 percent), `rotation` (-360 to 360 degrees), `flip` (`horizontal`, `vertical`) | Any subset. `scale` is a percentage of the layer's own pixel size (100 is native size) and scales about the layer's centre; `x` and `y` then set the new top-left. Reply: the layer's position and size |
| `flip_canvas` | `direction` (`horizontal`, `vertical`) | Mirrors the whole document |
| `resize_image` | `width`, `height` | Resamples the whole picture (all layers) to this size. To keep proportions scale both by one factor |
| `resize_canvas` | `width`, `height`, `anchor` (`center`, `top-left`, `top`, `top-right`, `left`, `right`, `bottom-left`, `bottom`, `bottom-right`) | Changes the canvas without scaling the picture; shrinking cuts, growing adds new empty space (look at it with `get_image`); `anchor` says where the picture stays |
| `crop` | `x`, `y`, `width`, `height` (pixels) | Keeps a rectangle of the document |

Limits: 30,000 pixels a side and the pixel budget (about 100 megapixels by default). A size beyond that fails with a message.

## Not available as tools

Free transform with skew, distort, perspective or warp, Liquify, puppet warp, content-aware scale, rotating the whole canvas by 90 degrees or an arbitrary angle (only `flip_canvas`; rotate the layers with `transform_layer` `rotation` if only one layer matters), straightening, and perspective crop. When asked, say so and offer the nearest tool: a rotated layer (`rotation`), a crop, or `generative_expand` to fill the corners left by a rotation. The person can do the rest by hand in the window (Edit > Transform, Filter > Liquify).

## Recipes

### Resize for a width, keeping proportions
1. `get_document` for `width` and `height`.
2. Factor `f = target width / width`; `resize_image` with `width = target`, `height = round(height * f)`.
3. `get_image`.

### Crop to a square around the middle
1. `get_document`; side `s = min(width, height)`.
2. `crop` with `x = (width - s) / 2`, `y = (height - s) / 2`, `width = s`, `height = s` (round to integers).

### Crop to 16:9
1. Full width `W`; target height `h = round(W * 9 / 16)`; if `h` is larger than the photo's height, use full height `H` and `w = round(H * 16 / 9)` instead.
2. `crop` centred as above, or biased to the subject (move `y` up for a portrait's headroom).

### Centre a layer on the canvas
1. `transform_layer` with just its `id`; read its size from the reply.
2. `transform_layer` with `x = (canvas width - w) / 2`, `y = (canvas height - h) / 2`.

### Fit a placed image to the canvas
1. `place_image` from `path`; the reply or a `transform_layer` read gives its size.
2. `transform_layer` with `scale = min(canvas width / w, canvas height / h) * 100`, then centre it.

### Straighten a layer slightly
`transform_layer` with `rotation: -2`; `get_image`; the corners may show transparency, so crop in or use `generative_expand` or `generative_fill` on the gaps.

### Add space around a picture for a banner
`resize_canvas` to the wider size with an `anchor` (`left` keeps the picture at the left); then either `fill` a new layer behind, or `generative_expand` for a continued scene.

### Mirror
`flip_canvas` for the whole picture, or `transform_layer` `flip` for one layer.

## When it fails

- "That rectangle does not overlap the picture": check `crop` numbers against `get_document`.
- "The size is outside what formvis allows": reduce width and height; there is a pixel budget as well as a side limit.
- After `resize_image`, selections and layer positions refer to the new size; call `get_document` again.
