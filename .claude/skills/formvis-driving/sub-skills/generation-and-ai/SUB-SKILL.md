---
name: generation-and-ai
description: AI-assisted edits in formvis through its MCP tools. Use to remove an object, person, watermark or blemish from a photo, paint something new into a selection from a prompt, extend a picture past its edges, generate an image from a prompt, upscale a picture 2 or 4 times, or cut out a subject; covers generative_fill, generative_expand, generate_image, upscale, select_subject and remove_background, local models first, fal only with the person's consent.
---

# generation-and-ai

Tools: `generative_fill`, `generative_expand`, `generate_image`, `upscale`, `fal_models`, with `select`, `select_subject`, `select_by_text` and `remove_background` to aim them.

## Local first, fal last

formvis runs these on the person's computer when a model is installed, for free: LaMa (fills from the surroundings, needs no prompt, any computer), Krea 2 (prompted fill and generation, Apple silicon or an NVIDIA GPU), FLUX.2 klein 4B (generation), Real-ESRGAN (upscaling). Only when nothing local can do the job does it use fal, which costs money: then the formvis window asks the person, and a no comes back to you as an error. Never set `model: "fal"` on your own initiative.

If nothing can run, the error names exactly what to download (Preferences > Plugins > Local models) or set up (a fal key in Edit > Generative Fill). Pass that on to the person and stop; do not guess a result.

## What each tool does

| Tool | Parameters | Notes |
| --- | --- | --- |
| `generative_fill` | `prompt` (up to 2000 characters, default empty), `model` (`auto`, `lama`, `krea-2`, `fal`), `influence` (0 to 1, default 0.4, Krea 2 only) | Needs a selection ("Generative Fill needs a selection: call select, select_subject or select_color_range first"). No prompt removes what the selection covers; a prompt paints that. Result is a new layer masked to the selection |
| `generative_expand` | `left`, `top`, `right`, `bottom` (pixels, 0 to 8000), `prompt`, `model` | Grows the canvas by the margins and fills the new border, continuing the picture. At least one margin |
| `generate_image` | `prompt` (required), `model` (`auto`, `krea-2`, `flux2-klein-4b`, `fal`, or a generate model id from `fal_models`), `seed`, `size` (`width`, `height`), `aspect_ratio` (such as `16:9`), `negative_prompt`, `options` | A new layer the size of the document; make or open a document of the right size first. With a catalogue model it asks the person, runs on fal, and `seed`, `size`, `aspect_ratio`, `negative_prompt` and `options` apply as that model's inputs allow (a reply names what the model lacks); with `size` or `aspect_ratio` the layer keeps that shape, centred and fitted inside the document |
| `upscale` | `scale` (2 or 4), `model` (`auto`, `local`, `fal`, or an upscale model id from `fal_models`), `seed`, `negative_prompt`, `options` | Enlarges what the document shows into a new document, which becomes current |
| `fal_models` | `role` (generate, edit, upscale and the rest), `model` | Lists the fal models formvis may use, by role; with `model`, that model's inputs for `options`. Read only, no window needed |
| `remove_background` | none | Acts on the active layer; keeps the subject as a layer mask. Local, free |

`model: "auto"` picks LaMa for a fill without a prompt and Krea 2 for one with a prompt, falling back to fal (with consent), and says in the reply which ran. If a prompt is given but only LaMa exists, LaMa runs without it and the reply says so; read that reply and tell the person.

## Recipes

### Remove an object
1. `get_document`, `get_image`.
2. Select it generously: `select` an `ellipse` or `rectangle` a little bigger than the object (see `selections` for coordinates), or `select_subject` if it is the main subject.
3. `generative_fill` with no `prompt`.
4. `select` `shape: "none"`; `get_image`. If an edge remains or the fill is wrong, `undo` twice (fill and deselect), select a bit more, and retry.
5. For a large object on a busy background, remove it in two or three smaller selections.

### Remove a person but keep the rest
`select` a rectangle around the person on the photo layer (make the layer that holds the pixels active first with `set_layer`), `generative_fill` with no prompt, `get_image`.

### Remove a watermark or text
`select` the exact box with `select` (use `mode: "add"` for several boxes), `generative_fill`, then check the area at 2048 `max_size` or crop in with `crop` only on a copy of the document.

### Replace or add something
1. Select where it goes (a shape the size of the new thing).
2. `generative_fill` with a concrete `prompt` ("a wooden bench with a red cushion"); with Krea 2, `influence` near 0.4 keeps the look of what was there; raise it to follow the old shape more.
3. `get_image`; `undo` and rephrase if wrong.

### Extend a landscape picture
1. `get_document` for the size. For a 16:9 banner from a 4:3 photo, work out the margins (for example left and right 400 each).
2. `generative_expand` with `left: 400`, `right: 400`, and a `prompt` if the new areas should hold something specific.
3. `get_image`; `undo` and retry with smaller margins if seams show.

### Generate an image into a document
1. `new_document` at the final size (1536 by 1024 etc.).
2. `generate_image` with a descriptive `prompt` (subject, style, lighting). The layer fills the document.
3. Add text or shapes on top (see `type-and-shapes`); `export_image`.

### Upscale for print
1. `upscale` `scale: 2` (or 4). The new document is current.
2. `get_document` to confirm the size, `get_image`, then `export_image` or `save_project`.
3. Upscale last, after edits, so the work is done at the smaller size.

### Cut out a subject
Use `remove_background` (active layer) for a mask-based cut-out, or `select_subject` then `select` `shape: "invert"` and `generative_fill` with no prompt to wipe the surroundings. See `layers-and-masks`.

## Selection-Aware Fill (not generative)

To heal or remove from the picture's own pixels, and to draw the fill from a place the person chose, load `steering-selection-aware-fill`: `run_command` `content-fill` with `prefer` and `strength`.

## Habits

- Look first, select precisely, fill, then look again. Generative steps are slow; ask for the fewest tries.
- Prompts describe the result, not the task: not "remove the dog" but no prompt at all for removal.
- Do not promise identical results between runs.
- The first use of a model can take a while to load; a "did not answer in time" error means check the window and retry once.
