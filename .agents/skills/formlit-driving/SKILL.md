---
name: formlit-driving
description: Cull, develop and deliver photos in formlit, the local Lightroom alternative, through its MCP tools. Use whenever the person wants photos imported, rated, flagged, culled, keyworded, geotagged, developed or colour graded (exposure, white balance, colour grading, black and white, masks, presets and film looks, denoise, HDR or panorama merges) or exported, printed, made into a book, slideshow or web gallery, and the formlit tools (find_photos, get_preview, develop_set, export_photos and the rest) are available or formlit is named. Also use when a formlit tool fails, says formlit is not open or is refused, and the next step is unclear. Not for changing formlit's own source code (that is formlit-harness) and not for layered compositing (formvis).
---

# Working with photos in formlit

formlit is a photo library and raw developer running on this computer. Its tools work on the person's catalog through the open formlit app, and every change is an ordinary undoable step the person sees in Library and Develop. These tools are the hands; this skill is how to use them well.

Work in small verified steps. Ids come from `find_photos`; looks come from `get_preview`. A develop change is only right once the preview shows it.

## Before the first call

- formlit comes as a plugin from the Form marketplace: in the Claude app open Customize, Plugins and add it, or run `/plugin` in Claude Code. Its tools then appear under the name formlit.
- formlit has to be open on the person's computer. When a call says it is not open, ask the person to open it, then try again once.
- The first call asks the person, in formlit's own window, to allow Claude. When a call is refused because outside agents are turned off or the person chose Not now, tell them they can change it in formlit under Preferences, AI agents, and stop. Never retry in a loop.
- Claude chat on the web or the phone cannot reach apps on the person's computer. Suggest Cowork in the Claude desktop app, or Claude Code.

## Look first

1. `get_catalog`: folders, collections and keywords with their ids, and the photo count.
2. `find_photos` with a `source` (`{"kind": "folder", "id": 3}`, `{"kind": "previousImport"}`, `{"kind": "collection", "id": 7}`) and a `filter` (`{"rating": 3, "ratingOp": ">="}`, `{"flags": ["pick"]}`, `{"text": "beach"}`).
3. `get_preview` and `analyze_photo` on one or two photos before changing anything.

The server's prompts hold full step lists: `culling_workflow` and `develop_strategy`, plus professional workflows researched from Adobe, Adobe staff, educators and working pros: `pro_ingest_and_cull`, `wedding_event_workflow`, `portrait_session_workflow`, `landscape_workflow`, `news_sports_workflow` (with the AP and NPPA editing limits), `real_estate_workflow`, `product_workflow` and `client_delivery`, and `job_from_template`, `concert_workflow`, `stock_workflow`, `astro_workflow`, `wildlife_workflow`, `social_batch` and `catalog_maintenance`. When the person names a genre or a deliverable, follow that prompt. References: `references/tools.md` lists every tool with its parameters, `references/editing-guide.md` explains the develop controls with sources, `references/pro-workflows.md` maps how professionals use Lightroom to formlit's tools with sources, `references/presets.md` lists every built-in preset and `references/templates.md` every shoot recipe, export preset, filename, folder, metadata, keyword set and intelligent collection template.

## Start a job from a template

When the person starts a shoot ("import my wedding card", "set up the Oak Street listing"), use one `setup_shoot` call instead of a dozen: `recipe` (wedding, portrait, headshots, event, news-sports, landscape, real-estate, product, concert, stock, family, astro), `name` (the client, event, listing or SKU), `values` with `creator` the first time (remembered after; the person can also set it in formlit's Preferences, Metadata, and `list_templates` shows what is stored), and `paths` with `mode` copy and a `destination` to ingest now. It builds a collection set with All Photos and stage intelligent collections (Picks, To Edit, Edited, Portfolio, Rejects) that fill themselves as flags, stars and edits change; imports with the recipe's folder and file names, metadata and keyword set; runs `noise_by_iso` when the recipe calls for it; and returns the stage ids, the recipe's export presets and its workflow prompt. Then cull All Photos, edit from To Edit and export from Edited.

Templates on their own: `list_templates` (with `kind` or `query`) then `apply_template`: `metadata` for copyright and licences (Creative Commons 4.0 and CC0, editorial, client, listing, event, portfolio, stock), `keywordSet`, `filename` (preview first, it renames files on disk) or `smartCollection` (`within` a collection, `parent` a set). `noise_by_iso` gives every photo the Noise by ISO preset for its own ISO, the way Lightroom's ISO adaptive presets do.

## Workflow 1: cull a shoot

1. `import_photos` with absolute folder paths when the photos are not in the catalog yet.
2. `analyze_culling` on the shoot's ids: sharpness, exposure, faces and near-duplicate groups are scored; nothing visible changes.
3. `apply_culling` with `pickBest: true`; add `rejectBlurry` and `rejectDuplicates` only when the person wants rejects marked.
4. Spot-check picks and rejects with `get_preview`; correct with `set_flag`, `set_rating`, `set_label`.
5. `create_collection` with the picks so they are easy to find again. Nothing is ever deleted from here.

For a professional ingest (copy, rename, date folders, copyright on every file, a second copy) pass `folderTemplate`, `renameTemplate`, `metadata` and `backup` to `import_photos`. For a multi-pass cull: flags first, `refine_photos` (unflagged become rejects, picks become unflagged), then stars on the survivors.

## Work efficiently

Every call costs the person time, and every image costs context. A single-photo look should take about four to six calls, not twenty.

- **Batch values.** One `develop_set` with every slider you mean to change, never one call per slider. Pass several `ids` at once.
- **Ask for the result in the same call.** `develop_set`, `develop_patch`, `apply_preset`, `sync_settings` and `match_look` take `report: true` and return the measurement after the change; `get_preview` takes `analyze: true` and measures the same render. Do not follow a commit with a separate `analyze_photo`.
- **Let the engine iterate.** When the person shows an example ("make it look like this one", a before and after pair, a hero frame), use `match_look` with that photo as `reference`: it fits tone, white balance and colour bands in about a second. Then add only what statistics cannot copy: grading, masks, a selective colour. To let the person judge the match, `show_in_window` with `photo` (the target) and `reference` (the reference) opens Develop's Reference View with both side by side.
- **Numbers before pictures.** Decide with `analyze_photo`; look with `get_preview` at `max_size` 512 once the numbers say it is right. Check a set with `analyze_photo` `ids` (one line per photo and the spread), not a preview per photo.
- **Search, do not scroll.** `list_presets` with a `query` returns a handful; never page through all of them.
- **Stop when it is done.** When the findings that matter are gone and one preview confirms it, report and stop.

## Workflow 2: develop a look

Measure, propose, check, commit. Read `references/editing-guide.md` before grading colour, toning black and white, or working on skin: it explains every control the way Lightroom photographers use it, with sources and the typical strengths.

1. `get_photo` for camera, lens, ISO and the current settings, then `analyze_photo`: luminance percentiles, tonal zones (Adobe's blacks, shadows, midtones, highlights, whites bands), clipping, saturation, colour cast on near-neutral pixels, how much of each colour-mixer band the photo holds, and `findings` with suggested values. Use the numbers, not a guess from a small preview.
2. Agree the intent (natural, bright and airy, moody, film, black and white, a named preset) when the person has not said.
3. Start: `match_look` when there is a reference photo, `match_exposures` for a bracket set or an unevenly exposed run, `auto_tone` for an unedited photo, or a preset. Find presets by purpose with `list_presets` and a `query` ("moody forest", "portrait warm", "bw street", "overcast", "wedding night", "iso 3200", "news"); `references/presets.md` lists all 300 built-ins with what each does. Alternate versions go on a `virtual_copy` or a `snapshot`, not over the person's edit. Preview first: `get_preview` and `analyze_photo` take `preset` and `amount` and save nothing.
4. Refine with proposals: `get_preview` and `analyze_photo` take `values` (for example `{"light.highlights": -40, "grading.shadows.hue": 210, "grading.shadows.sat": 12}`). Compare the before and after numbers, then look. Commit with `develop_set`; curve points, `treatment: "bw"` and crops go through `develop_patch`.
5. Local work beats global: `add_ai_mask` with `kind: "sky"` and `adjust: {"exposure": -0.5, "saturation": 15}`; `kind: "people"` with `parts` (`["hair"]`, `["faceSkin", "bodySkin"]`, `["lips"]`, `["iris", "sclera"]`); `kind: "landscape"` with `parts` (`["water"]`, `["vegetation"]`, `["mountains"]`, `["architecture"]`); or `add_gradient_mask` for a graduated sky or a radial spotlight. A change to one colour (richer red hair, bluer sky, greener grass) needs no mask at all: one `develop_set` on that colour's `mixer.[band]` values, which works without any AI model. AI masks need their model installed; if a mask call says the model is missing, offer the install once, and if it fails use the mixer or a gradient instead of retrying.
   **Isolate the subject and grade it differently** (all done by formlit's local models and its own renderer, not by you): set the overall mood first (`match_look`, a preset or `develop_set`), then two masks in the same turn: `add_ai_mask` `kind: "subject"` with the subject's grade, and `kind: "background"` with the background's grade, for example subject `{"saturation": 30, "temp": 15, "exposure": 0.2, "colorHue": 28, "colorSat": 15}` and background `{"saturation": -15, "colorHue": 220, "colorSat": 12, "exposure": -0.15}`. `colorHue` and `colorSat` are the mask's colour tint (Lightroom's mask colour swatch) and `curve` is a local tone curve. Each result reports the mask's `coverage`; a subject usually covers 10 to 60 percent of the frame, and an empty mask is refused rather than silently added. Confirm with one `get_preview`.
6. `analyze_photo` again: stop when the findings that matter are gone and the preview reads right. Say what changed in photographer's words (recovered highlights, warmer skin, darker sky).
7. A whole shoot: develop one photo, then `sync_settings` from it to the others. Without `groups` it copies everything but crop, masks, spots and red eye; `groups: ["whiteBalance", "basicTone", "presence"]` copies only exposure and colour. Frames shot in changing light match better with `match_look` against the hero frame after the sync. Check the set with `analyze_photo` `ids`.
8. Keep a look the person likes: `save_preset` from the finished photo, with a name and a group, so it appears in the window and in `list_presets`.
9. Noise: for a whole set, `noise_by_iso` (Detail only, per photo by its ISO); when `analyze_photo` flags high ISO on a raw that matters, `denoise` (it writes an enhanced DNG beside the raw and stacks it) and develop that DNG.

Setting ids and ranges are in `get_develop_controls`. Families: `light.*` (exposure, contrast, highlights, shadows, whites, blacks), `effects.*` (texture, clarity, dehaze), `color.*` (vibrance, saturation), `wb.*`, `curve.*` (parametric regions and splits), `mixer.[band].hue|sat|lum` (red, orange, yellow, green, aqua, blue, purple, magenta), `bw.[band]`, `grading.shadows|midtones|highlights|global.hue|sat|lum` plus `grading.blending` and `grading.balance`, `calibration.*`, `detail.*`, `vignette.*`, `grain.*`, `profile.amount`.

Strength guide from real presets and practitioners (details and sources in the editing guide): colour-grading saturation usually 7 to 20, obvious above about 20 to 25; film grain about 25 to 35; a matte look is a raised black point in the curve; prefer vibrance over saturation near skin.

## Workflow 3: deliver

- Files: `export_photos` with a preset (`builtin.web` 2048 px JPEG, `builtin.full`, `builtin.tiff` 16-bit ProPhoto, `builtin.print` 300 ppi Adobe RGB, `builtin.original`, `builtin.dng`, and per deliverable `builtin.client-gallery`, `builtin.proof` (centred PROOF watermark), `builtin.print-lab` (sRGB JPEG, 300 ppi), `builtin.stock`, `builtin.news`, `builtin.mls`, `builtin.instagram`, `builtin.blog`, `builtin.4k`, `builtin.archive`; `list_templates` kind export says what each is for) and an absolute `folder`. Settings override any part of a preset. Before files leave, check copyright: the Without Copyright intelligent collection template finds the gaps and `apply_template` kind metadata fills them.
- Paper: `print_pdf` with `settings` such as `{"rows": 4, "cols": 3, "caption": {"on": true, "field": "fileName"}}` for a contact sheet.
- A book: `make_book` with a title; the PDF lands in the Exports folder unless a `path` is given.
- Motion: `export_slideshow` as MP4 (ffmpeg on the computer) or PDF.
- The web: `export_web_gallery` writes an `index.html` folder.
- `show_in_window` with a module and photo lets the person see the result in the window.

## Things that matter

- Every mutating tool is one undo step; `undo` reverses the last one.
- Paths are absolute on the person's computer; `~` works.
- Long jobs (import, AI, export) wait until done and return the written paths.
- Deleting files and switching catalogs are refused here on purpose: the person does those in the window.
- `run_command` reaches every engine command (`list_commands` shows them) when no curated tool fits. Its shape is `{"command": "ai.download", "params": {"model": "objects", "wait": true}}`: one `params` object, never a JSON string.

## Extensions

The person may have Form extensions installed (from FormPortal, or a folder run by form.ext). `extensions_list` shows each one's id, version, source, state (ready, needs-permission, refused with the reason) and the commands it adds; `extension_command` with `id` and `command` runs one in formlit's window, which must be open. The first run of an extension version asks the person there to allow it; a refusal or a closed window ends the call, so say so and stop. What an extension changes is one undo step, so `undo` reverses it. Check the result with `get_photo` or `get_preview` as with any other change.

## Local AI models

Every model runs on the person's computer through ONNX Runtime, downloads once on first use from a pinned revision, and is checked against its SHA-256 before it is kept. `run_command` `ai.models` lists which are installed.

| Model id | Model | Licence | Needed for |
| --- | --- | --- | --- |
| `subject` | U2-Net | Apache-2.0 | subject and background masks, adaptive subject presets |
| `people` | U2-Net human segmentation | Apache-2.0 | people masks and every people part |
| `faces` | YuNet face detector, SFace recognizer | MIT, Apache-2.0 | face skin, hair, eyebrows, eyes, lips and teeth parts; finding and naming faces |
| `sky` | U-2-Net sky segmenter (xiongzhu666) | MIT | sky masks; sharper landscape parts |
| `objects` | SAM 2.1 tiny | Apache-2.0 | object masks from a box |
| `depth` | Depth Anything V2 Small | Apache-2.0 | depth masks, Lens Blur; sharper landscape parts |
| `remove` | LaMa | Apache-2.0 | generative Remove |
| `upscale` | Real-ESRGAN x4plus | BSD-3-Clause | Super Resolution |

People parts are built from the person mask and the face boxes with skin-colour rules, not a dedicated face-parsing model, so check them with a preview. Landscape parts work without any model and get sharper with `sky` and `depth`. When a model is missing the refusal gives the one install call; colour-mixer bands and gradient masks need no model at all.

## When something fails

| What you see | What it means | What to do |
| --- | --- | --- |
| No formlit tools at all | The formlit plugin is not added in this client | Ask the person to add formlit from the Form marketplace (Customize, Plugins, or `/plugin` in Claude Code), then start a new chat |
| "formlit is not open" | The formlit app is closed | Ask the person to open formlit, then try once more |
| Refused, mentioning outside agents | The person has not allowed Claude yet, chose Not now, or turned outside agents off | Tell them to open formlit and choose Allow, or to change AI agents in Preferences. Stop and do not retry in a loop |
| "needs the ... model" | An AI model is not installed yet | Run `run_command` with `ai.download` and the model id, or ask the person to install it in Preferences |
| "No photo with id" | A stale id | `find_photos` again |
| An export wrote nothing | Every file existed and `existing` was skip | Pass `settings.destination.existing` as `unique` or `overwrite` |