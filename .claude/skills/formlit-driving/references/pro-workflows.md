# Professional workflows: how working photographers use Lightroom, done in formlit

Researched from Adobe's documentation, Adobe staff (Julieanne Kost), established educators (Scott Kelby's Lightroom Killer Tips, Victoria Bampton's Lightroom Queen), working professionals writing in Fstoppers, PetaPixel, DPReview, Digital Camera World, SLR Lounge and PPA, and the AP and NPPA ethics codes. Keys in brackets point to the source list at the end. A claim marked *single source* had one source only: use it as a starting point. Each workflow also exists as an MCP prompt (`pro_ingest_and_cull`, `wedding_event_workflow`, `portrait_session_workflow`, `landscape_workflow`, `news_sports_workflow`, `real_estate_workflow`, `product_workflow`, `client_delivery`), which the server hands to any agent that asks.

## Contents

- Lightroom practice to formlit, at a glance
- Ingest
- Culling
- Editing a whole shoot
- Output and delivery
- Genres: wedding and event, portrait, landscape, news and sports, real estate, product
- What formlit does not have yet
- Sources

## Lightroom practice to formlit, at a glance

| Professional practice | Lightroom Classic | formlit tool |
| --- | --- | --- |
| Copy from the card, rename, date folders, copyright on every file, second copy | Import: Copy, Rename Files, Organize by date, Metadata preset, Make a Second Copy [A-IMPORT; LKT-IMPORT] | `import_photos` with `mode: "copy"` (or `"dng"`), `folderTemplate`, `renameTemplate`, `metadata`, `backup` |
| Develop preset at import | Apply During Import, Develop Settings [A-IMPORT] | `import_photos` `develop` |
| Skip duplicates | Don't Import Suspected Duplicates [A-IMPORT] | `import_photos` `skipDuplicates` (on by default) |
| Flag pass, then star pass | P, X, U; stars; Refine Photos [KOST-FLAGS; A-FLAGS] | `set_flag`, `set_rating`, `refine_photos` |
| Machine help with culling | third-party AI cullers paired with Lightroom [DPR-AFTERSHOOT; FS-IMAGEN] | `analyze_culling`, `apply_culling` (sharpness, exposure, eyes, near-duplicates) |
| Edit one, spread to the rest | Sync, Auto Sync, Previous, Copy/Paste [KOST-APPLY; LKT-PREVIOUS] | `sync_settings`, `match_look`; Auto Sync and Paste Previous in the window |
| Even out an uneven series | Match Total Exposures [KOST-MTE; PP-MTE] | `match_exposures` |
| Alternate versions | Virtual copies, snapshots [KOST-VC; LKT-SNAP; PL-SNAP] | `virtual_copy`, `snapshot` |
| Find frames by ISO, camera or lens | Library filter | `find_photos` filter `text` with `iso>=3200`, `camera:x100`, `lens:35` |
| Deliverable presets | Export presets, Batch Export [A-EXPORT; KOST-EXPORT] | `export_photos` with `builtin.web`, `builtin.print`, `builtin.tiff`, settings overrides |
| Client gallery, publish | Publish services, web sharing [A-PUBLISH; LRQ-WEB] | `export_web_gallery`, `publish` |

## Ingest

- Copy is the usual mode from a card; Add is for files already where they belong; Move is a copy then delete, so copy, verify, then delete the source yourself [LKT-IMPORT; PF-IMPORT].
- One parent folder with date subfolders, renamed afterwards to add detail, keeps the archive findable [LKT-IMPORT]; another pro structure is year, client, event (*single source* [PF-IMPORT]).
- Rename at import so files are findable outside the catalog, for example client, event and date [A-IMPORT; PF-IMPORT]: in formlit `renameTemplate: "{custom}_{date:%Y%m%d}_{seq:4}"` with `custom` set to the client.
- A copyright metadata preset at import puts the name and year on every file [A-IMPORT; PF-IMPORT]: `metadata: {"copyright": "...", "creator": "..."}`.
- "Make a Second Copy" is a one-time backup, not a backup plan [A-IMPORT]: `backup` with a folder on another drive.

## Culling

- Keys and roles: pick the best, reject what will be deleted, stars for levels (for example 3 for heroes), colour labels for "needs attention" (roles *single source* [KOST-FLAGS]); Adobe describes labelling keepers then filtering as a two-pass approach [A-FLAGS].
- Multi-pass: first pass flags with auto advance, leaving undecided frames unflagged; then Refine Photos turns unflagged into rejects and picks into unflagged for the next pass [KOST-FLAGS; A-FLAGS]. In formlit: `set_flag` (or `apply_culling`), then `refine_photos`, then `set_rating`.
- Wedding reduction: set a target count and reduce by lens and part of the day; one star scheme is 3 selects, 4 strong, 5 favourites, with editing effort on 4 and 5 (*single source* [PP-BERGREEN]).
- Machine help: Aftershoot and Imagen cull and rate, then pros review and finish in Lightroom [DPR-AFTERSHOOT; FS-IMAGEN; FS-WARING]. formlit's `analyze_culling` is the built-in equivalent; always spot-check picks and rejects.
- Deleting rejects stays with the person: Lightroom offers remove from catalog or delete from disk [KOST-DELETE; HCWT-DELETE]; formlit keeps this in the window.

## Editing a whole shoot

- Edit one hero frame, then spread: Sync to choose which settings copy, Auto Sync to apply live, Previous for frames in similar light [KOST-APPLY; LKT-PREVIOUS; SLR-DAYLEY]. In formlit: `develop_set` on the hero with `report: true`, then `sync_settings`; when the light shifts frame to frame, `match_look` with the hero as `reference`.
- Choose what to sync: the Sync dialog checks everything by default, so untick what should not travel [KOST-APPLY; LKT-EDIT]. Which settings pros usually leave out (crop, spot removal, white balance when the light changes) could not be confirmed in a source; formlit's `sync_settings` without `groups` already leaves out crop, masks, spots and red eye.
- AI masks are recomputed for each photo when synced (*single source* [PF-MASKS]); formlit recomputes subject, sky and people masks per photo the same way.
- Match Total Exposures evens out brightness to the best-exposed frame using the exposure metadata; it is approximate and needs a good reference [KOST-MTE; PP-MTE]: `match_exposures` with the best frame first.
- A signature preset on the whole batch, with variants for indoor and night light that usually need only an exposure or white balance tweak [PP-BERGREEN; FS-WARING]: the Wedding group's Signature Base, Signature Indoor and Signature Night are such a set.
- High ISO: filter by ISO, fix noise on one frame per ISO level, sync only noise reduction (*single source* [SLR-DAYLEY]): `find_photos` `text: "iso>=3200"`, a Noise by ISO preset on one frame, `sync_settings` `groups: ["detail"]`.
- Versions: virtual copies share the original file and suit colour and black and white versions or different crops; snapshots save a state inside one photo [KOST-VC; LKT-SNAP; PL-SNAP]: `virtual_copy`, `snapshot`.

## Output and delivery

- Colour space: sRGB for screen, email and web; wider spaces for files that go on to an editor [LRQ-EXPORT; A-EXPORT].
- Output sharpening: Screen for the web, the paper type for prints, amount Low, Standard or High [A-EXPORT; LRQ-EXPORT]; there is no preview, so test on typical images (*single source* [KOST-EXPORT]).
- Sizes: Lightroom Queen's email preset is 800 px at quality 65 and prints at 300 ppi [LRQ-EXPORT]; one educator exports the web at a 2048 px long edge (*single source* [SLR-JIRSA]), which is formlit's `builtin.web`; Instagram at 1080 px (square or landscape) or 1350 px (portrait) after cropping to the ratio (*single source* [LKT-SOCIAL]). Adobe gives 180 to 480 ppi for inkjet [A-EXPORT].
- Metadata: copyright only, or copyright and contact, and remove location for private places [A-EXPORT; KOST-EXPORT].
- Several deliverables: one export per preset, into one parent folder [A-EXPORT; KOST-EXPORT].

## Genres

**Wedding and event.** Ingest through the catalog, not by copying cards to the desktop, so identical names cannot overwrite each other (*single source* [SLR-DAYLEY]); cull to a target; signature preset plus lighting variants; edit by scene and spread; high-ISO noise per ISO level; deliver per deliverable. Reported turnarounds: about 3,100 frames culled to about 650 in roughly an hour and a gallery delivered about 4.5 hours after starting [FS-WARING], and a full gallery culled and edited in 3 to 4 hours with a trained preset and AI grouping [FS-NEEDHAM] (both *single source*). Prompt: `wedding_event_workflow`.

**Portrait and headshot.** Tethered capture with a develop preset on every frame keeps a session consistent, so only exposure and white balance need touching [A-TETHER; PL-TETHER]; heal temporary blemishes only, skin softened through people masks rather than globally [FS-SKIN; DCW-PORTRAIT; FS-PORTRAIT]; one photographer's skin values: texture about -44, clarity -15 (*single source* [FS-SKIN]); pixel retouching goes to Photoshop last [PP-ROUNDTRIP; SLR-DAYLEY]. Prompt: `portrait_session_workflow`.

**Landscape.** Three or more brackets on a tripod, merged to a DNG, deghost only when something moved [A-HDR; DCW-HDR]; sky masks and gradients, with each brightening move paired with a small highlights reduction [FS-MOHRLE]; dodge and burn with gradients and brushes [FS-DODGE]; a warm, vibrant grade from the Landscape profile, lower blue luminance, warm highlights and a small calibration blue shift [PP-MOHRLE] (one photographer across these articles); print with a soft proof and test prints [SLR-PROOF; FS-PRINT]. Prompt: `landscape_workflow`.

**News, sports and documentary.** Deadlines rule: one wire photographer targets the top 10 to 15 frames within 45 minutes and the set captioned within two hours (*single source* [DPR-ACH]); captions at ingest [DPR-ACH; FS-PMPLUS]. Ethics: the AP allows only cropping, dodging and burning, greyscale conversion and normal toning, minimally; no content changes, no blurred backgrounds, no substantial changes to density, contrast, colour or saturation [AP] (the AP page was read through a mirror); the NPPA code forbids editing that misleads [NPPA]. In formlit that means no generative remove, no stylised presets or match to a stylised reference, and only the Documentary group's News Neutral presets. Prompt: `news_sports_workflow`.

**Real estate and architecture.** Brackets two stops apart (or more frames at one stop), merged with auto align and no deghosting [PP-KOCH; SLR-SAVILLE]; lens profile then Upright; when synced, Upright modes re-analyse each photo [A-UPRIGHT]; windows from the darkest bracket or masked (*single source* [PP-KOCH]); consistency through Auto Sync per room (*single source* [SLR-SAVILLE]). Prompt: `real_estate_workflow`.

**Product.** A colour chart in the first frame and again when the body or lens changes, white balance from it [FS-CHART; FS-PASSPORT]; exposure set on the first frame; background to white (one tutorial: exposure +1.0, whites +40, *single source* [DPS-PRODUCT]); sync from first to last. Prompt: `product_workflow`.

## What formlit does not have yet

- Reference View (a fixed reference beside the photo being edited) [KOST-REF]: `match_look` covers the matching, the window has no side-by-side reference yet.
- ISO adaptive presets (a preset that interpolates noise reduction across ISO) [A-PRESETS]: the Noise by ISO presets are fixed steps instead.
- Adobe's people masks are a learned face-parsing model; formlit's people parts are rules on the person mask and face boxes.

## Sources

| Key | Source |
| --- | --- |
| A-IMPORT | Adobe, Specify import options, helpx.adobe.com/lightroom-classic/desktop/import-photos/photo-video-import-options.html |
| A-FLAGS | Adobe, Flag, label, and rate photos, helpx.adobe.com/lightroom-classic/desktop/organize-photos-in-lightroom-classic/flag-label-rate-photos.html |
| A-EXPORT | Adobe, Export files to disk or CD, helpx.adobe.com/lightroom-classic/desktop/export-photos/export-files-disk-or-cd.html |
| A-PUBLISH | Adobe, Export using publish services, helpx.adobe.com/lightroom-classic/desktop/export-photos/export-hard-drive-using-publish.html |
| A-PRESETS | Adobe, Apply presets, helpx.adobe.com/lightroom-classic/help/apply-presets.html |
| A-TETHER | Adobe, Import photos from a tethered camera, helpx.adobe.com/lightroom-classic/help/import-photos-tethered-camera.html |
| A-HDR | Adobe, HDR photo merge, helpx.adobe.com/lightroom-classic/help/hdr-photo-merge.html |
| A-UPRIGHT | Adobe, Upright automatic perspective correction, helpx.adobe.com/lightroom-classic/desktop/help/upright-automatic-perspective-correction.html |
| KOST-APPLY | Julieanne Kost, Quickly applying settings to multiple images in Lightroom Classic, jkost.com/blog/2024/09/ |
| KOST-MTE | Julieanne Kost, Match Total Exposures in Lightroom Classic, jkost.com/blog/2011/08/lr3-match-total-exposures.html |
| KOST-FLAGS | Julieanne Kost, Applying flags, stars and color labels, jkost.com/blog/2024/06/ |
| KOST-VC | Julieanne Kost, Working with virtual copies, jkost.com/blog/2024/08/ |
| KOST-REF | Julieanne Kost, Reference View in Lightroom Classic, jkost.com/blog/2024/08/ |
| KOST-EXPORT | Julieanne Kost, Exporting photos from Lightroom Classic, jkost.com/blog/2024/09/ |
| KOST-DELETE | Julieanne Kost, removing and deleting photos, jkost.com/blog/?p=22618 |
| LKT-IMPORT | Lightroom Killer Tips, import, lightroomkillertips.com/15495-2/ |
| LKT-PREVIOUS | Lightroom Killer Tips, the Previous button |
| LKT-EDIT | Lightroom Killer Tips, How to edit multiple photos at once |
| LKT-SNAP | Lightroom Killer Tips, Snapshots versus virtual copies |
| LKT-SOCIAL | Lightroom Killer Tips, Sharing to social media from Lightroom Classic |
| LRQ-EXPORT | Victoria Bampton, Lightroom Queen, Export from Classic |
| LRQ-WEB | Victoria Bampton, Lightroom Queen, Share a web gallery |
| PL-SNAP | Photography Life, Snapshot vs Virtual Copy in Lightroom |
| PL-TETHER | Photography Life, How to tether your camera in Lightroom |
| PP-MTE | PetaPixel, Match Total Exposures tip (2014) |
| PP-BERGREEN | Brenda Bergreen, PetaPixel, How to cull and edit wedding photos quickly |
| PP-ROUNDTRIP | PetaPixel, Sending photos between Lightroom and Photoshop (2020) |
| PP-MOHRLE | Christian Mohrle, PetaPixel, Lightroom colour grading for warm and vibrant landscapes (2022) |
| PP-KOCH | Dave Koch, PetaPixel, Real estate photos with HDR and flash |
| FS-WARING | Paul Waring, Fstoppers, Eight tips to speed up your wedding workflow |
| FS-NEEDHAM | Alex Cooke, Fstoppers, Wedding photography workflow that actually makes money |
| FS-IMAGEN | Usman Dawood, Fstoppers, Imagen AI and Lightroom (sponsored) |
| FS-SKIN | Jason Parnell-Brookes, Fstoppers, Perfect skin texture in portraits |
| FS-PORTRAIT | Alex Cooke, Fstoppers, Edit a portrait in Lightroom |
| FS-MOHRLE | Alex Cooke, Fstoppers, High contrast without blown skies |
| FS-DODGE | Alex Cooke, Fstoppers, Dodging and burning using only Lightroom |
| FS-PRINT | Michael Breitung, Fstoppers, Do this to get perfect prints |
| FS-PMPLUS | Mike Smith, Fstoppers, Photo Mechanic Plus review |
| FS-CHART | Amber Goetz, Fstoppers, Exact colour in product photography with a colour chart |
| FS-PASSPORT | Alex Cooke, Fstoppers, Using a ColorChecker Passport |
| DPR-AFTERSHOOT | Mike Tomkins, DPReview, Aftershoot Pro review |
| DPR-ACH | Jeff Carlson, DPReview, A professional's workflow: Brian Ach |
| DCW-PORTRAIT | Louise Robin, Digital Camera World, Polish your portraits |
| DCW-HDR | Digital Camera World, HDR panoramic photos in Lightroom Classic |
| SLR-DAYLEY | Trevor Dayley, SLR Lounge, Lightroom workflow tips for wedding photographers |
| SLR-SAVILLE | Matthew Saville, SLR Lounge, Lightroom tips for real estate photographers |
| SLR-JIRSA | Pye Jirsa, SLR Lounge, Best Lightroom export settings for web |
| SLR-PROOF | Kishore Sawh, SLR Lounge, Soft proofing in Lightroom (2016) |
| PF-IMPORT | Photofocus, Understanding Lightroom Classic's import dialog |
| PF-MASKS | Photofocus, Subject and sky masks in batch edits |
| HCWT-DELETE | Have Camera Will Travel, Delete rejected photos |
| DPS-PRODUCT | Jacob Macias, Digital Photography School, Post-processing studio product photography |
| AP | Associated Press, News values and principles: Telling the story (read through a mirror; confirm at ap.org) |
| NPPA | National Press Photographers Association, Code of Ethics, nppa.org/resources/code-ethics |
