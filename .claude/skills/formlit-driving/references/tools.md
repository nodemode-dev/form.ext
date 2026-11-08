# formlit tools

Generated from formlit's own tool catalogue; do not edit by hand. Every tool works on the catalog of the formlit app on the person's computer.

## Contents

- Look: `get_catalog`, `find_photos`, `get_photo`, `get_preview`, `analyze_photo`, `list_people`, `get_develop_controls`, `get_develop`, `list_presets`, `list_export_presets`
- Import and organize: `import_photos`, `set_rating`, `set_flag`, `set_label`, `add_keywords`, `set_metadata`, `set_location`, `create_collection`, `add_to_collection`, `stack_photos`
- Jobs and templates: `setup_shoot`, `list_templates`, `apply_template`
- Cull and people: `refine_photos`, `analyze_culling`, `apply_culling`, `find_faces`, `name_person`
- Develop: `match_look`, `match_exposures`, `virtual_copy`, `snapshot`, `noise_by_iso`, `develop_set`, `develop_patch`, `auto_tone`, `auto_white_balance`, `reset_develop`, `apply_preset`, `save_preset`, `sync_settings`, `add_ai_mask`, `add_gradient_mask`, `auto_straighten`, `upright`
- Enhance and merge: `denoise`, `super_resolution`, `merge_hdr`, `merge_panorama`
- Output: `export_photos`, `print_pdf`, `make_book`, `export_slideshow`, `export_web_gallery`, `publish`
- Window, history and everything else: `show_in_window`, `undo`, `redo`, `list_commands`, `run_command`, `extensions_list`, `extension_command`, `get_agent_access`
- Other: `set_code_replacements`, `check_required_metadata`, `get_cull_groups`, `add_layer`, `set_layer`, `merge_focus_stack`, `merge_astro_stack`, `proofing_gallery`, `import_client_selections`, `search_photos_by_description`, `find_similar_photos`, `check_my_style`, `apply_my_style`, `get_control_maps`, `remove_object`, `merge_flash_blend`, `retouch_skin`, `session`, `session_move`

## get_catalog

The catalog: name and counts, folders (id, path, count), collections (id, name, kind, count) and keywords. Use the ids as find_photos sources.

- no parameters

Note: read-only.

## find_photos

Lists photos: source picks where (kind all, folder, collection, keyword, person, previousImport, quick, ids), filter narrows (text, which also takes field operators such as iso>=3200, rating>=3, camera:x100, lens:35; rating with ratingOp >= <= =, flags [pick reject none], labels, kinds [raw jpeg video...], edited, cameras, lenses, keywords [ids], dates [YYYY or YYYY-MM-DD]), sort orders (by captureTime, importTime, editTime, fileName, rating; desc). Returns ids with file, capture time, rating, flag, label and size.

- `source`: object
- `filter`: object
- `sort`: object
- `limit`: integer; default 200

Note: read-only.

## get_photo

One photo in full: path, camera, lens, exposure, GPS, metadata, keywords, collections and develop settings.

- `id`: integer; required; A photo id from find_photos.

Note: read-only.

## get_preview

The photo as developed, as a JPEG image (long side max_size; 512 is enough to judge a look and costs a quarter of 1024). values renders proposed develop values without saving them; preset (an id or name from list_presets) with amount previews a preset before apply_preset; before true shows it with no edits; analyze true adds the compact measurement of the same render.

- `id`: integer; required; A photo id from find_photos.
- `max_size`: integer; default 768
- `values`: object; Develop ids to values, e.g. {"light.exposure": 0.5}.
- `preset`: string
- `amount`: number; default 100
- `before`: boolean; default false
- `analyze`: boolean; default false

Note: read-only.

## analyze_photo

Measures a photo as developed, or with proposed values or a preset without saving: luminance percentiles and tonal zones (blacks, shadows, midtones, highlights, whites), clipping, saturation, colour cast in neutral areas, the share and strength of each colour-mixer band, and findings with suggested develop values. Use it before and after edits instead of judging exposure by eye. Pass ids instead of id for one compact line per photo and the spread across the set.

- `id`: integer; A photo id from find_photos.
- `ids`: array; Photo ids from find_photos.
- `values`: object; Proposed develop ids to values.
- `preset`: string
- `amount`: number; default 100

Note: read-only.

## match_look

Matches photos to a reference photo's look in one call: measures the reference as developed, then adjusts each target's exposure, contrast, highlights, shadows, whites, blacks, saturation, white balance and colour-mixer saturation and luminance over several internal render rounds until tone and colour converge. Returns the changes and the distance before and after. Use it when the person points at an example ("make these look like this one") or to make a set consistent; then add creative grading or masks.

- `ids`: array; required; Photo ids from find_photos.
- `reference`: integer; required; A photo id from find_photos.
- `strength`: number; default 100
- `tone`: boolean; default true
- `color`: boolean; default true
- `apply`: boolean; default true; false returns the proposal without saving.
- `report`: boolean; default false; Return a compact measurement of each changed photo (median, end points, contrast, clipping, saturation, cast, issues) so no separate analyze_photo call is needed.

## import_photos

Adds photos from folders or files (absolute paths) to the catalog the way working photographers ingest: mode add keeps them in place, copy or move put them under destination, dng copies as DNG. folderTemplate builds the folders (default {date:%Y}/{date:%Y-%m-%d}); renameTemplate renames files with tokens {custom} {shoot} {date:%Y%m%d} {seq:4} {name} {camera} {iso}; metadata applies a copyright preset to every file ({"copyright": ..., "creator": ..., "city": ...}); develop applies a preset id at import; backup makes a second copy in another folder; buildPreviews standard or 1:1; collection adds them to a collection id.

- `paths`: array; required
- `mode`: string (add | copy | move | dng); default "add"
- `destination`: string
- `folderTemplate`: string
- `renameTemplate`: string
- `custom`: string
- `metadata`: object
- `develop`: string
- `keywords`: array
- `collection`: integer
- `backup`: string
- `skipDuplicates`: boolean; default true
- `buildPreviews`: string ( | standard | 1:1)
- `smartPreviews`: boolean; default false

## refine_photos

Lightroom's Refine Photos for a multi-pass cull: unflagged photos become rejects and picks become unflagged, so the next pass sees only the survivors. Rejects stay rejects; nothing is deleted.

- `ids`: array; required; Photo ids from find_photos.

## match_exposures

Lightroom's Match Total Exposures: evens out the brightness of a run of photos of the same scene to the first id (the best-exposed frame), using their exposure metadata. For bracket sets and uneven series; match_look also matches colour.

- `ids`: array; required; Photo ids from find_photos.
- `report`: boolean; default false; Return a compact measurement of each changed photo (median, end points, contrast, clipping, saturation, cast, issues) so no separate analyze_photo call is needed.

## virtual_copy

Makes virtual copies (catalog-only versions that share the original file) for alternate edits such as colour and black and white, or another crop; returns the new ids.

- `ids`: array; required; Photo ids from find_photos.
- `name`: string

## snapshot

Named develop states inside one photo: action create saves the current settings under name, list shows them, apply restores one by its id.

- `action`: string (create | list | apply); required
- `id`: integer; A photo id from find_photos.
- `name`: string
- `snapshot`: integer

## setup_shoot

Starts a job from a shoot recipe (wedding, portrait, headshots, event, news-sports, landscape, real-estate, product, concert, stock, family, astro; list_templates kind shoot): makes a collection set named for the shoot with All Photos and intelligent collections for Picks, To Edit, Edited, Portfolio and Rejects limited to it, in one undo step. With paths it imports straight into it with the recipe's folder and file naming, metadata template, keyword set and previews, then applies noise reduction by ISO when the recipe calls for it. values fills the metadata (creator, email, url, client, event, job; creator, email and url are remembered). Returns the stage collection ids, the recipe's export presets and its workflow prompt to follow next.

- `recipe`: string; required
- `name`: string; required; the shoot, client or event, used for the set, the folders and {custom} in names
- `values`: object
- `paths`: array
- `mode`: string (add | copy | move | dng); default "copy"
- `destination`: string
- `backup`: string
- `skipDuplicates`: boolean; default true

## list_templates

Built-in templates: filename (rename patterns), folder (import folder patterns), metadata (copyright, Creative Commons, editorial, client licences), keywordSet, smartCollection, shoot (whole-job recipes) and export (delivery presets with what each is for). kind and query narrow it; the result also shows the remembered creator, email and url.

- `kind`: string (filename | folder | metadata | keywordSet | smartCollection | shoot | export)
- `query`: string

Note: read-only.

## apply_template

Applies a template by id or name: kind metadata writes its IPTC fields (values fills creator, email, url, client, event, job); keywordSet adds its keywords (or the listed subset); filename renames the files on disk (custom fills {custom}; preview true shows the names first); smartCollection creates an intelligent collection (within limits it to a collection id, parent puts it in a set). One undo step each.

- `kind`: string (metadata | keywordSet | filename | smartCollection); required
- `template`: string; required
- `ids`: array; Photo ids from find_photos.
- `values`: object
- `keywords`: array
- `custom`: string
- `preview`: boolean; default false
- `name`: string
- `within`: integer
- `parent`: integer

## noise_by_iso

Lightroom's ISO adaptive noise reduction: gives each photo the Noise by ISO preset for its own ISO (800, 1600, 3200, 6400, 12800 and up), Detail only, in one undo step; photos under ISO 800 or without ISO are counted and left alone. AI denoise (denoise) is still better for the worst raws.

- `ids`: array; required; Photo ids from find_photos.
- `amount`: number; default 100
- `report`: boolean; default false; Return a compact measurement of each changed photo (median, end points, contrast, clipping, saturation, cast, issues) so no separate analyze_photo call is needed.

## set_rating

Sets star ratings, 0 to 5.

- `ids`: array; required; Photo ids from find_photos.
- `rating`: integer; required

## set_flag

Flags photos as pick, reject or none.

- `ids`: array; required; Photo ids from find_photos.
- `flag`: string (pick | reject | none); required

## set_label

Sets colour labels.

- `ids`: array; required; Photo ids from find_photos.
- `label`: string (red | yellow | green | blue | purple | none); required

## add_keywords

Adds keywords; a | separates levels (Places|France|Paris).

- `ids`: array; required; Photo ids from find_photos.
- `keywords`: array; required

## set_metadata

Sets IPTC fields: title, caption, headline, creator, copyright, location, city, state, country and the rest of the Metadata panel. Codes from the active code replacement set (=code= by default) expand to their text, and variables {date}, {time}, {camera}, {lens}, {filename}, {city}, {event} and the like fill from each photo; codes not in the set come back as unknownCodes.

- `ids`: array; required; Photo ids from find_photos.
- `fields`: object; required

## set_code_replacements

Saves a code replacement set for captions (one code per line: code, a tab or comma, the replacement, such as a team roster '23<TAB>LeBron James (23) of the Los Angeles Lakers') and makes it active. codes.state through run_command lists the sets.

- `name`: string; required
- `text`: string; required

## check_required_metadata

Which photos are missing required metadata fields (the person's list in Metadata, Required Fields, or the fields given): per photo and per field. Run it before export_photos for editorial delivery.

- `ids`: array; required; Photo ids from find_photos.
- `required`: array

Note: read-only.

## set_location

Sets GPS coordinates (decimal degrees), or clears them when lat and lon are left out.

- `ids`: array; required; Photo ids from find_photos.
- `lat`: number
- `lon`: number

## create_collection

Makes a collection holding the photos; returns its id.

- `name`: string; required
- `ids`: array; Photo ids from find_photos.

## add_to_collection

Adds photos to a collection by id.

- `collection`: integer; required
- `ids`: array; required; Photo ids from find_photos.

## stack_photos

Stacks photos together, the first on top.

- `ids`: array; required; Photo ids from find_photos.

## analyze_culling

Scores sharpness and exposure, finds faces when the faces model is installed, and groups near-duplicates. Writes the scores; changes no flags.

- `ids`: array; required; Photo ids from find_photos.
- `wait`: boolean; default true; Wait for the job to finish (default) or return its task id.

## apply_culling

After analyze_culling: pickBest flags the best of each group as a pick; rejectBlurry and rejectDuplicates flag the rest as rejects.

- `ids`: array; required; Photo ids from find_photos.
- `pickBest`: boolean; default true
- `rejectBlurry`: boolean; default false
- `rejectDuplicates`: boolean; default false
- `threshold`: number; default 35; Sharpness score under which rejectBlurry rejects.

## get_cull_groups

After analyze_culling: the photos in the order given, gathered into near-duplicate groups with the best frame of each, and each photo's sharpness, exposure, eyes-open and per-face scores (face boxes 0 to 1 across the photo as shown). The same view the window's Cull mode shows.

- `ids`: array; required; Photo ids from find_photos.

Note: read-only.

## find_faces

Finds faces in the photos (all when ids is left out) and groups them by person.

- `ids`: array; Photo ids from find_photos.
- `wait`: boolean; default true; Wait for the job to finish (default) or return its task id.

## list_people

Named people with counts, and unnamed face groups with their face and photo ids.

- no parameters

Note: read-only.

## name_person

Names a group of faces (face ids from list_people); adds a People keyword to their photos.

- `faces`: array; required
- `name`: string; required

## get_develop_controls

Every develop setting id with its label, range and default, the local (mask) adjustment ids, white balance presets and crop aspects.

- no parameters

Note: read-only.

## get_develop

A photo's develop settings and their effective values.

- `id`: integer; required; A photo id from find_photos.

Note: read-only.

## develop_set

Sets develop values on photos in one undo step: values maps ids from get_develop_controls to numbers (send every change together rather than one call per slider); delta true adds to the current values; report true returns the measurement after the change.

- `ids`: array; required; Photo ids from find_photos.
- `values`: object; required
- `delta`: boolean; default false
- `report`: boolean; default false; Return a compact measurement of each changed photo (median, end points, contrast, clipping, saturation, cast, issues) so no separate analyze_photo call is needed.

## develop_patch

Merges a nested develop object into the photos' settings: treatment ("color" or "bw"), crop (rect [x0,y0,x1,y1] 0 to 1, angle), geometry, masks, curve points. Plain numbers such as grading.shadows.hue go through develop_set.

- `ids`: array; required; Photo ids from find_photos.
- `patch`: object; required
- `label`: string
- `report`: boolean; default false; Return a compact measurement of each changed photo (median, end points, contrast, clipping, saturation, cast, issues) so no separate analyze_photo call is needed.

## auto_tone

Auto exposure, contrast, highlights, shadows, whites and blacks, like the Auto button.

- `ids`: array; required; Photo ids from find_photos.

## auto_white_balance

Auto white balance.

- `ids`: array; required; Photo ids from find_photos.

## reset_develop

Resets develop settings to defaults (undoable).

- `ids`: array; required; Photo ids from find_photos.

Note: replaces or removes.

## list_presets

Develop presets with ids for apply_preset, each with its group, a description of what it does and what it suits, and tags. query (for example "moody forest", "portrait warm", "bw street") and group narrow the list.

- `query`: string
- `group`: string

Note: read-only.

## apply_preset

Applies a develop preset at an amount (0 to 200 percent).

- `ids`: array; required; Photo ids from find_photos.
- `preset`: string; required
- `amount`: number; default 100
- `report`: boolean; default false; Return a compact measurement of each changed photo (median, end points, contrast, clipping, saturation, cast, issues) so no separate analyze_photo call is needed.

## save_preset

Saves a photo's current develop settings as a user preset the person can apply in the window and that list_presets returns. groups limits what it stores (whiteBalance, basicTone, presence, toneCurve, colorMixer, bwMix, treatment, colorGrading, detail, effects, calibration, profile, masks); by default everything but crop, masks, spots and red eye.

- `id`: integer; required; A photo id from find_photos.
- `name`: string; required
- `group`: string; default "User Presets"
- `groups`: array

## sync_settings

Copies develop settings from one photo to others, limited to groups when given (whiteBalance, basicTone, presence, toneCurve, colorMixer, pointColor, bwMix, treatment, colorGrading, detail, lensCorrections, transform, effects, calibration, profile, crop, masks, spots, redEye, lensBlur); with no groups, everything but crop, masks, spots and red eye.

- `from`: integer; required; A photo id from find_photos.
- `ids`: array; required; Photo ids from find_photos.
- `groups`: array
- `report`: boolean; default false; Return a compact measurement of each changed photo (median, end points, contrast, clipping, saturation, cast, issues) so no separate analyze_photo call is needed.

## add_ai_mask

Adds a local adjustment through an AI mask: sky, subject, background, people, object (with box [x0,y0,x1,y1] 0 to 1), depth, or parts: kind people with parts (faceSkin, bodySkin, eyebrows, sclera, iris, lips, teeth, hair, clothes; person for one person by index) or kind landscape with parts (sky, water, vegetation, mountains, architecture, naturalGround, artificialGround), several parts in one mask. adjust uses local ids: exposure, contrast, highlights, shadows, whites, blacks, temp, tint, hue, saturation, texture, clarity, dehaze, sharpness, noise, plus a local colour grade: colorHue (0 to 359) with colorSat (0 to 100) tints the masked area, and curve ({"master"|"red"|"green"|"blue": [[x, y], ...]}, 0 to 1) is a local tone curve. To grade a subject and its background differently, add a subject mask and a background mask with different adjust values. The result reports each mask's coverage of the frame; an empty mask is refused. Each kind runs a local model (subject and background: U2-Net; people: U2-Net human segmentation; face, hair, eye, lip and teeth parts also need the YuNet face model; sky: the sky segmenter; object: SAM 2.1; depth: Depth Anything V2); a refusal names the exact install call.

- `id`: integer; required; A photo id from find_photos.
- `kind`: string (sky | subject | background | people | object | depth | landscape); required
- `parts`: array
- `person`: integer
- `box`: array
- `adjust`: object
- `name`: string
- `refine`: number; Refine Edge: snaps the mask edge to edges in the photo (hair, fur, soft outlines)
- `shift`: number; Shift Edge: grows (positive) or shrinks (negative) the mask, up to 2 percent of the long side
- `feather`: number; Feather: softens the edge, up to 3 percent of the long side

## add_gradient_mask

Adds a linear gradient (start and end points, 0 to 1 of the frame) or a radial gradient (center, rx, ry, feather, invert) with local adjust values.

- `id`: integer; required; A photo id from find_photos.
- `kind`: string (linear | radial); required
- `start`: array
- `end`: array
- `center`: array
- `rx`: number
- `ry`: number
- `feather`: number
- `invert`: boolean
- `adjust`: object

## add_layer

Adds an adjustment layer: the photo's colour and tone settings copied into a layer you change separately (any develop control id except white balance, crop, geometry, lens corrections, noise reduction and profile, so tone curves, colour mixer, grading and effects too), blended through a mask (subject, sky, background, people, object, photo for the whole frame, or the id or name of an existing mask) at an opacity. Masks only reach 17 local sliders; layers reach everything. values maps control ids to absolute values for the layer.

- `id`: integer; required; A photo id from find_photos.
- `values`: object
- `mask`: string
- `invert`: boolean
- `opacity`: number; default 100
- `name`: string
- `refine`: number
- `shift`: number
- `feather`: number

## set_layer

Changes an adjustment layer by id, name or position: values (control ids to absolute values), opacity, visible, name, mask, invert; remove true deletes it. get_develop lists a photo's layers.

- `id`: integer; required; A photo id from find_photos.
- `layer`: string; required
- `values`: object
- `opacity`: number
- `visible`: boolean
- `name`: string
- `mask`: string
- `invert`: boolean
- `remove`: boolean

## auto_straighten

Levels the horizon from the lines in the photo.

- `ids`: array; required; Photo ids from find_photos.

## upright

Perspective correction: auto, level, vertical or full.

- `ids`: array; required; Photo ids from find_photos.
- `mode`: string (auto | level | vertical | full | off); required

## denoise

AI Denoise: writes an enhanced DNG next to each raw and stacks it.

- `ids`: array; required; Photo ids from find_photos.
- `amount`: number; default 50
- `wait`: boolean; default true; Wait for the job to finish (default) or return its task id.

## super_resolution

Doubles the resolution into an enhanced DNG, stacked with the original.

- `ids`: array; required; Photo ids from find_photos.
- `wait`: boolean; default true; Wait for the job to finish (default) or return its task id.

## merge_hdr

Merges bracketed exposures into an HDR DNG, stacked with the brackets.

- `ids`: array; required; Photo ids from find_photos.
- `deghost`: string (off | low | medium | high); default "off"
- `wait`: boolean; default true; Wait for the job to finish (default) or return its task id.

## merge_focus_stack

Merges photos of one scene focused at different distances (macro, product, landscape near-to-far) into a DNG sharp throughout: aligned for focus breathing, sharpest frame kept at each point, cropped to the shared area. Check the result with get_preview.

- `ids`: array; required; Photo ids from find_photos.
- `align`: boolean; default true
- `autoCrop`: boolean; default true
- `createStack`: boolean; default true
- `wait`: boolean; default true; Wait for the job to finish (default) or return its task id.

## merge_astro_stack

Stacks night-sky frames shot from a tripod into one clean DNG: aligns on the stars as the sky turns, removes hot pixels, and averages with outlier rejection (satellites, planes and meteors vanish; noise falls by about the square root of the frame count). ground fixed keeps the landscape sharp (needs the sky model), aligned moves everything with the stars. Check the result with get_preview.

- `ids`: array; required; Photo ids from find_photos.
- `reject`: string (sigma | median | mean); default "sigma"
- `ground`: string (fixed | aligned); default "fixed"
- `createStack`: boolean; default true
- `wait`: boolean; default true; Wait for the job to finish (default) or return its task id.

## proofing_gallery

Makes a client proofing gallery folder with no account or server: the client opens index.html in any browser, picks, rejects, rates and comments, and sends back a selections file for import_client_selections. Returns the folder; zip it to send.

- `ids`: array; required; Photo ids from find_photos.
- `title`: string; required
- `note`: string; a line for the client, such as how many to pick and by when
- `size`: integer; default 1600
- `folder`: string
- `limit`: integer; default 0; most photos the client may pick (the package size); 0 for no limit

## import_client_selections

Applies a client's selections from a proofing gallery: picks and rejects as flags, stars as ratings, comments onto the photos, and a collection of the picks.

- `path`: string; the selections .json file
- `text`: string; or its text
- `flags`: boolean; default true
- `ratings`: boolean; default true

## search_photos_by_description

Finds photos by what is in them from a plain description, such as 'bride and groom under an umbrella' or 'empty road through a desert', best match first with a score from 0 to 1. Works without keywords; runs on this computer (needs the search model, installed with ai.download model search). Indexes new photos first. ids limits the search to those photos; strict keeps only close matches.

- `text`: string; required
- `ids`: array; Photo ids from find_photos.
- `limit`: integer; default 50
- `strict`: boolean; default false

## find_similar_photos

Photos that look most like a given one (same scene, subject or look, not only exact duplicates), most similar first with a similarity from 0 to 1.

- `id`: integer; required
- `limit`: integer; default 30

## check_my_style

Before apply_my_style: measures on this catalog how close it gets to the person's own edits (each edited photo predicted from the others), beside the average edit and no edit, as exposure in stops and other sliders in points. better says whether it beats both. Changes nothing.

- `k`: integer; default 5

## apply_my_style

Develops photos the way the person edits: learns from their already edited photos (at least three, indexed for search) and gives each photo the tone and presence settings of the edited photos most like it, weighted by likeness, with exposure matched to its brightness. amount 0 to 100 blends with the current settings; one undo step. Returns which photos each was learned from. Check with get_preview.

- `ids`: array; required; Photo ids from find_photos.
- `amount`: number; default 100
- `k`: integer; default 5

## get_control_maps

Structure maps of a photo as images: edges (what Edge Range masks select), straight lines, depth (near is bright) and subject, to plan masks and Remove (Same Depth and Same Surface sampling). Read only.

- `id`: integer; required
- `kinds`: array

## remove_object

Generative remove at a point (x, y from 0 to 1 across the photo): detect grows the area to the whole object under the point, shadows also takes the shadow it casts and its reflection below it. Three fills are made, plainest first (least new detail inside, so nothing new is invented); seed 0 gives the standard set, another number a new set. Adds a Remove spot; check with get_preview, and call again with a new seed if the fill is wrong.

- `id`: integer; required
- `x`: number; required
- `y`: number; required
- `size`: number; default 0.03; brush radius as a fraction of the long side
- `detect`: boolean; default true
- `shadows`: boolean; default false
- `seed`: integer; default 0
- `sample_from`: array; [x0, y0, x1, y1] from 0 to 1: copy only from this area (for example clean sky or plain wall)
- `sample_same_depth`: boolean; default false; copy only from parts of the photo at the same distance as the area around the object (needs the depth model)
- `sample_same_surface`: boolean; default false; copy only from the surface the object sits on or against (wall, floor, sky, water), segmented around it (needs the objects model)
- `keep_lines`: boolean; default false; carry straight lines and edges that cross the object (tile joints, railings, horizons, window frames) through the fill

## merge_flash_blend

Real estate and interiors: blends a tripod bracket into one DNG. Ambient frames are merged as HDR; a flash frame gives the room clean colour (flambient: light from the ambient frames, colour from the flash); windows are pulled from the darker frames in darken mode so frames and mullions stay and flash reflections on glass go. flash names the flash frame (else the one tagged Flash fired); windowEv sets how many stops the view sits above the room. Check with get_preview.

- `ids`: array; required; Photo ids from find_photos.
- `flash`: integer
- `flashAmount`: number; default 50
- `colorAmount`: number; default 100
- `windowPull`: boolean; default true
- `windowEv`: number; default 1
- `createStack`: boolean; default true
- `perWindow`: boolean; default true; each window its own exposure, so a sunlit and a shaded window both read

## retouch_skin

Batch skin retouching for a portrait session: on every photo with a face, a Skin Retouch mask over face and body skin (smooth softens texture, shine tames bright skin) and heal spots on blemishes it finds (red spots only while keepFreckles is on, so freckles and moles stay). Everything lands as normal editable settings; photos without a face are skipped; running again replaces its own mask and spots. Check a result with get_preview. Needs the faces and people models.

- `ids`: array; required; Photo ids from find_photos.
- `smooth`: number; default 40
- `shine`: number; default 0
- `blemishes`: boolean; default true
- `sensitivity`: number; default 50
- `keepFreckles`: boolean; default true
- `maxSize`: number; default 3; largest spot healed, percent of the face width (0.5 to 8); raise for larger marks, lower to leave moles

## session

A studio session: a folder with Capture, Selects, Output and Trash; tethered shots land in Capture, exports default to Output, and each photo's settings are kept in the folder so it opens on any machine. action state shows the open session and its folders (ids for find_photos by folder), new makes one (parent folder and name), open opens a session folder or .flsession file and brings back saved settings, close closes it.

- `action`: string (state | new | open | close); required
- `parent`: string
- `name`: string
- `path`: string

## session_move

Moves photos of the open session on disk, settings with them: to selects (keepers), trash (the session's Trash folder, not deleted) or capture (back from Selects or Trash).

- `ids`: array; required; Photo ids from find_photos.
- `to`: string (selects | trash | capture); required

## merge_panorama

Stitches overlapping photos into a panorama DNG.

- `ids`: array; required; Photo ids from find_photos.
- `projection`: string (spherical | cylindrical | plane); default "spherical"
- `wait`: boolean; default true; Wait for the job to finish (default) or return its task id.

## list_export_presets

Export presets (id and name) and the last export's settings.

- no parameters

Note: read-only.

## export_photos

Exports photos to files: a preset id (builtin.web, builtin.full, builtin.tiff, builtin.print, builtin.original, builtin.dng or a user preset) and/or settings (destination.folder absolute path, file.format jpeg png tiff webp avif heic dng original, file.quality, size.resize with size.mode long and size.value, sharpen, metadata.include, watermark). Returns the written paths.

- `ids`: array; required; Photo ids from find_photos.
- `preset`: string
- `settings`: object
- `folder`: string; Absolute output folder; shorthand for settings.destination.folder.

## print_pdf

Lays photos out for print (settings as the Print module: paper, orientation, rows, cols, margins, style grid or package, fill, caption) and writes a PDF; path optional.

- `ids`: array; required; Photo ids from find_photos.
- `settings`: object
- `path`: string

## make_book

Auto-lays out the photos as a book (size, title) and writes a PDF, or print-ready interior and cover PDFs for a printer: printer blurb, lulu, kdp (Amazon KDP) or ingramspark. Printer files come with notes on anything the printer will reject (too few pages, text too near the trim).

- `ids`: array; required; Photo ids from find_photos.
- `title`: string
- `size`: string; default "standard-landscape"
- `path`: string
- `printer`: string (pdf | blurb | lulu | kdp | ingramspark); default "pdf"
- `cmyk_profile`: string; path of a CMYK ICC profile (the printer's, for example GRACoL or FOGRA39) to write CMYK PDFs; leave out for RGB
- `pdfx`: boolean; default false; with cmyk_profile: PDF/X-1a:2001 files (PDF 1.3) (fonts embedded, output intent, trim and bleed boxes), self-checked; the result lists any problem found

## export_slideshow

Writes a slideshow of the photos as MP4 (needs ffmpeg) or PDF; settings as the Slideshow module (duration, fade, panZoom, fill, music.path).

- `ids`: array; required; Photo ids from find_photos.
- `format`: string (mp4 | pdf); default "mp4"
- `settings`: object
- `path`: string

## export_web_gallery

Writes a web gallery folder (index.html plus images); settings as the Web module (site.title, layout, colors).

- `ids`: array; required; Photo ids from find_photos.
- `settings`: object
- `folder`: string

## publish

Publishes a published collection: new and edited photos go out, removed ones are deleted from the service.

- `collection`: integer; required

## show_in_window

Shows something in the formlit window if it is open: a module (library, develop, map, book, slideshow, print, web), a photo id, a source like find_photos takes, and a short message for the person. reference (a photo id) opens Develop's Reference View with that photo fixed on the left and photo on the right, so the person can compare a match_look result with its reference.

- `module`: string
- `photo`: integer
- `reference`: integer
- `source`: object
- `message`: string

## undo

Undoes the last change.

- no parameters

## redo

Redoes the last undone change.

- no parameters

## list_commands

Every engine command (id, group, parameters) for run_command, optionally one group.

- `group`: string

Note: read-only.

## run_command

Runs any engine command by id with its params (see list_commands). Deleting files and switching catalogs stay in the window.

- `command`: string; required
- `params`: object

## extensions_list

The extensions installed in formlit (from FormPortal, or run from a folder by form.ext): id, name, version, source (catalogue, sideload, development), state (ready, needs-permission, refused with the reason) and the commands each contributes for extension_command.

- no parameters

Note: read-only.

## extension_command

Runs a command an extension contributes (ids from extensions_list) in formlit's window, which must be open. The first run of an extension version asks the person there to allow its permissions; a refusal ends the call. What it changes is one undoable step.

- `id`: string; required; The extension id.
- `command`: string; required; The command id.
- `args`: object

## get_agent_access

Whether outside agents such as Claude may use formlit (outsideAgents: ask, allowed or blocked), which clients have called since formlit started, and whether a call is waiting for the person's answer. Like every tool it is refused while the setting is blocked.

- no parameters

Note: read-only.
