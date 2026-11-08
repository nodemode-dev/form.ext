---
name: colour-and-modes
description: Colour work in formvis through its MCP tools, and the limits of that surface. Use when the person asks about the document's colour mode, bit depth or profile, wants CMYK, Lab, grayscale or 16 bit, wants colours matched between a pasted element and its background, a colour cast removed, or colours graded; reads mode, depth and profile with get_document and grades with adjustment layers, since no tool changes mode, depth or profile.
---

# colour-and-modes

## What an agent can see and do

- Read: `get_document` returns `mode` (`rgb`, `grayscale`, `bitmap`, `indexed`, `cmyk`, `lab`), `depth` (8, 16 or 32), and `profile` (the profile's name; `sRGB` when none is set; null for CMYK without one).
- Grade: `add_adjustment` and `set_adjustment` (see `adjustments-and-filters`): `develop`, `vibrance`, `photoFilter`, `colorBalance`, `channelMixer`, `selectiveColor`, `blackWhite`, `colorLookup`, `splitToning`.
- Match: `color_match` makes a Curves layer clipped to a layer so its colours fit what is beneath it (`to: "beneath"`) or around it (`to: "around"`), with `amount` 0 to 1.
- Look: `add_film_layer` for leaks and frames.

## What an agent cannot do

No MCP tool changes the colour mode, bit depth or profile, converts to CMYK or Lab, proofs colours, or shows the gamut warning. Say so, and give the person the exact place in the window:

| They want | Where, by hand in the formvis window |
| --- | --- |
| Grayscale, CMYK, Lab, indexed, bitmap | Image > Mode |
| 8, 16 or 32 bits a channel | Image > Mode > 8, 16 or 32 Bits/Channel |
| Tag a document with a profile without changing pixels | Edit > Assign Profile |
| Convert pixels to another profile | Edit > Convert to Profile (rendering intent and black point compensation are in the dialog) |
| Soft proof for a printer | View > Proof Setup, then View > Proof Colors; View > Gamut Warning marks colours the proof device cannot print |

For the reasoning behind these choices (which intent, which profile, why CMYK looks duller), use `formvis-colour-science`.

Some filters and edits decline in 16 bit, 32 bit, CMYK and Lab documents with a message such as "does not work in CMYK yet. Image > Mode > RGB Color to use it". Pass that message on to the person; do not try to work around it.

## Recipes

### Warm or cool the whole picture, editable
1. `add_adjustment` `kind: "develop"` with `params: { "temperature": 20 }` (positive warmer, negative cooler) and, if needed, `tint`.
2. `get_image`; refine with `set_adjustment` on the returned id.

### Remove a colour cast
1. `get_image` and name the cast (for example too green).
2. `add_adjustment` `kind: "develop"`, `params: { "tint": 15 }` (towards magenta against green), plus `temperature` if it is blue or orange.
3. Or `add_adjustment` `kind: "photoFilter"` with the opposite `color` and a `density` near 15.
4. `get_image` after each; stop when whites look neutral.

### Make a pasted element fit its background
1. The element must be on its own layer (`place_image` or `duplicate_layer`).
2. `color_match` with its `id`, `to: "beneath"`, `amount: 0.7`.
3. `get_image`; `undo` and try `to: "around"` or a lower `amount` if it looks tinted.

### Muted or selective colour
There is no tool to limit an adjustment to one colour with a mask, so true selective colour is a by-hand job in the window. What an agent can do:
1. A muted look: `add_adjustment` `kind: "vibrance"`, `params: { "saturation": -60 }`.
2. Shift one colour family: `add_adjustment` `kind: "blackWhite"` with `params` for `reds`, `yellows`, `greens`, `cyans`, `blues`, `magentas` changes how bright each family turns in black and white.
3. Say plainly which part could not be done.

### Report the document's colour state
1. `get_document`.
2. State mode, depth and profile in plain words; if the person plans to print, say that a CMYK conversion needs a profile chosen by hand (see `formvis-colour-science` for which).

## Facts

- `export_image` writes PNG, JPEG or WebP of how the picture looks (see `export`). A CMYK, 16 bit, TIFF or EXR deliverable has to be exported by hand with File > Export in the window.
- Hex colours in tools are sRGB values.
