---
name: adjustments-and-filters
description: Adjusting looks and applying filters in formvis through its MCP tools. Use to blur or sharpen a photo, reduce or add noise, brighten, darken, warm, cool, add contrast or saturation, tone shadows and highlights, give a film or cinematic look, desaturate to black and white, stylize, distort, pixelate or add a light leak or frame; covers add_adjustment, set_adjustment, apply_filter and add_film_layer.
---

# adjustments-and-filters

Tools: `add_adjustment`, `set_adjustment`, `apply_filter`, `add_film_layer`, `color_match` (see also `colour-and-modes`).

Two kinds of change, and choosing between them is the main decision:

- Adjustment layers (`add_adjustment`) are non-destructive: a layer that changes what is beneath it. Prefer these for tone, colour and looks; the person can tune or remove them later.
- Filters (`apply_filter`) change the pixels of the active layer (inside the selection if there is one). Use these for blur, sharpen, noise and effects. They are undoable, but not editable afterwards, so duplicate the layer first if the original matters.

## add_adjustment and set_adjustment

`add_adjustment` takes `kind` and optional `params`; it adds the layer above the active one and returns its id. `set_adjustment` takes the layer `id` and `params` and changes it later.

Parameters are applied only for the kinds below. Values outside a range are clamped; unnamed parameters keep their defaults.

| kind | params (range) |
| --- | --- |
| `brightnessContrast` | `brightness` (-150 to 150), `contrast` (-50 to 100), `legacy` (boolean) |
| `vibrance` | `vibrance` (-100 to 100), `saturation` (-100 to 100) |
| `develop` | `exposure` (-500 to 500), `contrast`, `highlights`, `shadows`, `whites`, `blacks`, `temperature`, `tint`, `vibrance`, `saturation`, `texture`, `clarity`, `dehaze` (each -100 to 100), `vignette` (0 to 100) |
| `splitToning` | `shadowHue`, `highlightHue` (0 to 360), `shadowSat`, `highlightSat` (0 to 100), `balance` (-100 to 100) |
| `halation`, `glow` | `amount` (0 to 100), `radius` (1 to 200), `threshold` (0 to 100) |
| `colorLookup` | `look`: `warm`, `cool`, `tealOrange`, `bleach`, `fade`, `mono`, `cross`, `night` |
| `blackWhite` | `reds`, `yellows`, `greens`, `cyans`, `blues`, `magentas`, `tint`, `tintColor` (`r`, `g`, `b`) |
| `photoFilter` | `color` (`r`, `g`, `b`), `density` (1 to 100), `preserve` |
| `posterize` | `levels` (2 to 255) |
| `threshold` | `level` (1 to 255) |
| `invert` | none |
| `colorBalance`, `channelMixer`, `selectiveColor`, `shadowsHighlights`, `hdrToning` | accept `params` but have many keys (for example `shadowAmount`, `highlightAmount` for `shadowsHighlights`; `radius`, `strength`, `gamma` for `hdrToning`); add them at defaults first and judge with `get_image` |

The kinds `hsv`, `levels`, `curves`, `exposure`, `gradientMap` and `grain` can be added, but through this tool they are added at their defaults and `params` do not apply, and `set_adjustment` refuses them ("settings are not set by parameters"). If the person needs a specific curve, levels or hue shift, use `develop` (temperature, tint, exposure, contrast) or `vibrance` instead, or tell them to tune the layer in the window's Properties panel.

An adjustment acts on everything beneath it. To limit it, pass it through a selection made before adding it only if `get_image` shows it respected the selection; otherwise put the adjustment directly above the one layer you mean to change and keep the layers above out of its way.

## apply_filter

`apply_filter` takes `kind` and `settings` (an object; omit what you do not need). It acts on the active layer. Text, shape and smart-object layers must be `rasterize_layer`d first; the error names the id.

Most used kinds and their settings:

| Goal | kind | settings |
| --- | --- | --- |
| Soft blur | `gaussianBlur` | `radius` (pixels; 2 for a hint, 10 for strong, scale with picture size) |
| Motion blur | `motionBlur` | `angle` (degrees), `distance` (pixels) |
| Lens-like blur | `lensBlur` | `lensRadius` |
| Box, shape, smart blur | `boxBlur`, `shapeBlur`, `smartBlur` | `radius`; `shapeBlur` `shape`; `smartBlur` `threshold`, `quality`, `mode` |
| Spin or zoom, field, iris, tilt-shift | `radialBlur`, `fieldBlur`, `irisBlur`, `tiltShift`, `spinBlur` | defaults work; `spinBlur` takes `blurAngle`, `x`, `y`, `radiusX`, `radiusY`, `angle` |
| Sharpen | `sharpen`, `sharpenMore`, `sharpenEdges` | none |
| Sharpen with control | `unsharpMask` | `usmAmount` (percent), `usmRadius`, `threshold`; or `smartSharpen` |
| Add grain | `addNoise` | `amount`, `gaussian`, `monochromatic` |
| Remove noise | `reduceNoise`, `median`, `despeckle`, `dustAndScratches` | `reduceNoise`: `strength` 0 to 10, `preserve`, `color`, `sharpen`, `jpeg`; `median`: `radius` |
| High-pass detail | `highPass` | `radius` |
| Distort | `twirl`, `pinch`, `spherize`, `ripple`, `wave`, `zigZag`, `shear`, `polarCoordinates`, `displace` | `twirl` `angle`; `pinch`, `spherize` `amount`; centred on the selection if any, else the canvas |
| Pixelate | `mosaic`, `crystallize`, `pointillize`, `colorHalftone`, `facet`, `fragment`, `mezzotint` | `cellSize` for the first three; `colorHalftone` `maxRadius` |
| Stylize | `emboss`, `findEdges`, `solarize`, `oilPaint`, `tiles`, `traceContour`, `wind`, `extrude`, `diffuse` | `emboss` `angle`, `height`, `amount`; `oilPaint` `stylization`, `cleanliness` |
| Render | `clouds`, `differenceClouds`, `fibers`, `lensFlare`, `lightingEffects`, `flame`, `pictureFrame`, `tree` | Draw on the layer (use a new empty layer); colours come from the foreground and background colours |
| Filter Gallery | `filterGallery` | `effects`: a list of `{ filter, values, visible }` with one of 47 effects (for example `watercolor`, `posterEdges`, `neonGlow`, `filmGrain`, `glass`) |
| Misc | `average`, `ntscColors`, `offset`, `maximum`, `minimum`, `custom`, `hsbHsl`, `deInterlace` | per the tool list |

The full settings of every kind are in the `apply_filter` entry of `../formvis-editing/references/tools.md`.

## add_film_layer

`add_film_layer` with `kind: "leak"` (`color`: `amber`, `red`, `magenta`, `gold`; `from`: `left`, `right`, `top`, `bottom`, `corner`) or `kind: "frame"` (`style`: `film`, `white`, `line`). Each is its own layer above the active one.

## Recipes

### Blur the whole photo a little
1. `get_document`; find the photo layer; `set_layer` it active.
2. If its kind is not `pixels`, `rasterize_layer`.
3. `apply_filter` `kind: "gaussianBlur"`, `settings: { "radius": 4 }`. `get_image`; `undo` and change the radius if wrong.

### Blur only the background (keep the subject sharp)
1. `select_subject`; `select` `shape: "invert"`.
2. `apply_filter` `gaussianBlur` with `radius` 12 on the photo layer.
3. `select` `shape: "none"`. `get_image`.

### Warmer and brighter, editable
1. `add_adjustment` `kind: "develop"`, `params: { "temperature": 25, "exposure": 30, "vibrance": 15 }`.
2. `get_image`; tune with `set_adjustment` (the returned id) rather than stacking more layers.

### Cinematic teal and orange
1. `add_adjustment` `kind: "colorLookup"`, `params: { "look": "tealOrange" }`.
2. Optionally `add_adjustment` `kind: "splitToning"`, `params: { "shadowHue": 200, "highlightHue": 40, "shadowSat": 25, "highlightSat": 25 }` and `add_adjustment` `kind: "halation"` for a glow.

### Black and white
`add_adjustment` `kind: "blackWhite"` (defaults are a good start), then `reds`, `yellows` and so on to lighten or darken colours.

### Film look
`add_adjustment` `develop` for tone, `add_adjustment` `splitToning`, `add_film_layer` `{ "kind": "leak", "color": "gold", "from": "top" }`, `apply_filter` `addNoise` on a duplicated photo layer with `amount` 4 and `monochromatic: true`; `get_image` at each step.

### Sharpen for web
`apply_filter` `unsharpMask` with `usmAmount` 80, `usmRadius` 1, `threshold` 2, on the flattened or top pixel layer, after resizing, not before.

### Relight a photo
`run_command` `relight.apply` adds a Relight layer above the active layer, on this computer. Quick: `{ "look": "rembrandt" }` (also soft-key, split, rim, butterfly, golden-hour, window-blinds, window-light, candlelight, neon, moonlight, light-strip, dappled, ring). Exact: `{ "lights": [{ "type": "spot", "kelvin": 3200, "intensity": 80, "pos": { "x": 0.1, "y": 0.15 }, "aim": { "x": 0.5, "y": 0.4 }, "near": 40 }], "original": 35, "delight": 50, "ambient": "#d0dcff" }`; positions are fractions of the canvas and may lie outside it, `near` 40 keeps the light on the nearer subject. The message says whether Depth Anything shaped the light; without it there are no cast shadows. The photo's own light is taken out first (`split`: auto, marigold, classic, off) so the new light re-shades the face; to move a shadow to the other side keep `original` low (10 to 25). The message names the split used. Leave `split` on auto: it keeps the subject's own detail (the face stays the same person); `marigold` repaints surfaces, takes about a minute, and is only for when the person asks for it. Aim each light at the face (`aim` on it): lights stand above what they aim at. `get_image` after. 8-bit RGB only.

## When it fails

- "is a text layer: call rasterize_layer": do what it says, then retry.
- A filter message about memory or a lock: the layer is locked or the picture is too big for that filter; read the message.
- In 16 bit, CMYK or Lab documents some filters decline with a message to switch mode; tell the person (mode changes are made in the window, see `colour-and-modes`).
