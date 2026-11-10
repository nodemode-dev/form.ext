# formvis commands

Generated from the window's command catalogue (1674 commands) by `./formvis agents sync`; do not edit by hand. The live list is `GET /api/commands` or the MCP tools `list_commands` and `describe_command`; run one with `run_command`, several as one undo step with `run_commands`.

## Contents

- Edit: 108
- Extensions: 3
- File: 102
- Filter: 142
- Generate: 6
- Help: 5
- Image: 122
- Layer: 282
- Paint: 1
- Paths: 12
- Select: 47
- Tool options: 467
- Tools: 53
- Type: 66
- View: 102
- Window: 156

## Edit

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `apply-edit` | Apply Pending Edit | Enter | Applies what the tool in use is holding, as Return does: a crop, a warp, a floating selection, a polygon lasso. Bound to Return and movable in Keyboard Shortcuts. (changes the picture) |
| `auto-align-layers` | Auto-Align Layers... |  | Aligns the selected layers to a reference layer (bottom, middle or top) by matching their features (or, with registration intensity, by image correlation), with perspective, cylindrical, spherical, collage (move, turn and scale) or reposition projection, vignette removal and lens distortion correction. (changes the picture) |
| `auto-blend-layers` | Auto-Blend Layers... |  | Adds layer masks that blend the selected layers into a panorama or a focus stack, with halo control and an optional depth map layer, or a multiband (pyramid) blend into a new layer; Seamless Tones follows how the tone difference changes across the overlap (a smooth gain field, spatial false for one gain per layer). (changes the picture) |
| `cancel-edit` | Cancel Pending Edit | Escape | Cancels what the tool in use is holding, as Escape does. Bound to Escape and movable in Keyboard Shortcuts. |
| `cancel-job` | Cancel Background Job |  | Stops the running background job, such as a filter on a large layer, and keeps the document as it was. (changes the picture) |
| `clean-working-files` | Working Files |  | Deletes the stored recovery copies of documents that are no longer open and the closed tabs kept for Reopen Closed Tab, and says how much space came back. (changes the picture) |
| `clear` | Clear Selection Pixels |  | Erases the pixels inside the selection. (changes the picture) |
| `clear-history-log` | Clear History Log |  | Empties the history log. |
| `clone-source-overlay` | Clone Source: Overlay |  | Sets the Clone Source overlay: show, opacity, clipped to the brush, auto hide while painting, and invert. |
| `clone-source-reset` | Clone Source: Reset Transform |  | Resets the Clone Source transform to 100 percent, no angle and no flips. |
| `clone-source-set` | Clone Source: Set Source |  | Sets the chosen Clone Source slot: the source point in document pixels, the width and height in percent, the angle and the flips; each slot keeps its own. |
| `clone-source-slot` | Clone Source: Choose Slot |  | Chooses one of the five Clone Source slots; the slot brings back its own point, scale, angle and flips. |
| `colour.settings` | Color Settings... | Shift+Mod+K | Opens Color Settings: working spaces, color management policies and conversion options. |
| `compare-documents` | Compare with... |  | Opens Compare with: picks another open document and makes a new document with both pictures and a Differences layer in Difference blend mode, selecting where they differ. |
| `compare-split` | Compare with Snapshot (Split) |  | Shows the current state on the left and a kept snapshot (the opening snapshot unless one is named) on the right of a divider that can be dragged; run again to close it. History is not changed. |
| `composite-pixel` | Read Composite Pixel |  | Reads the composited color and opacity (red, green, blue, alpha 0 to 255 and the hex code) of the one document pixel at x and y, as the picture shows it with every layer, adjustment and effect. |
| `content-fill` | Quick Selection-Aware Fill | Shift+Backspace | Fills the selection from its surroundings; with prefer (rectangles {x, y, width, height} in document pixels) and strength (0 to 0.6) it favours patches from those rectangles while still searching the whole picture. (changes the picture) |
| `content-fill-workspace` | Selection-Aware Fill... |  | Opens the Selection-Aware Fill workspace for the selection. (changes the picture) |
| `copy` | Copy | Mod+C | Copies the selection to the clipboard. |
| `copy-merged` | Copy Merged | Shift+Mod+C | Copies the selection from all visible layers. |
| `customize-toolbar` | Toolbar... |  | Opens the Toolbar dialog to choose which tools the tool rail shows, how they are grouped and in what order. |
| `cut` | Cut | Mod+X | Cuts the selection to the clipboard. (changes the picture) |
| `cycle-tool-mode` | Cycle Tool Mode | Alt+Shift+M | Moves the current tool to the next choice of its first mode list in the options bar, such as the marquee shape or the selection mode. |
| `define-brush` | Define Brush Preset... |  | Saves the selection, or the whole image, as a sampled brush tip. (changes the picture) |
| `define-custom-shape` | Define Custom Shape... |  | Saves the current path as a custom shape for the Shape tool. (changes the picture) |
| `define-pattern` | Define Pattern... |  | Saves the selection as a pattern. |
| `delete` | Delete | Backspace Delete | Clears the selection, or deletes the selected layers. (changes the picture) |
| `edit-menus` | Menus... |  | Opens the Menus dialog to hide menu items from the menu bar and to color them; both are kept across sessions. |
| `edit-note` | Edit Note... |  | Opens the selected note for editing. |
| `fade` | Fade... | Shift+Mod+F | Opens Fade to soften the last filter or adjustment. (changes the picture) |
| `fill-bg` | Fill with Background | Mod+Backspace Mod+Delete | Fills the selection or layer with the background color. (changes the picture) |
| `fill-bg-keep` | Fill with Background, Keep Transparency | Shift+Mod+Backspace Shift+Mod+Delete | Fills the selection or layer with the background color but only where the layer already has pixels. (changes the picture) |
| `fill-dialog` | Fill... | Shift+F5 | Opens the Fill dialog with its contents and blend options. (changes the picture) |
| `fill-fg` | Fill with Foreground | Alt+Backspace Alt+Delete | Fills the selection or layer with the foreground color. (changes the picture) |
| `fill-fg-keep` | Fill with Foreground, Keep Transparency | Alt+Shift+Backspace Alt+Shift+Delete | Fills the selection or layer with the foreground color but only where the layer already has pixels. (changes the picture) |
| `fill-history` | Fill with History | Alt+Mod+Backspace Alt+Mod+Delete | Fills the selection or layer with its pixels from the history source, at full opacity. (changes the picture) |
| `free-helper-models` | Free Helper Models |  | Frees the ONNX helper models formvis holds in memory (depth, segmentation, background removal and the like) and names what it freed; the next use loads its model again. (changes the picture) |
| `generative-fill` | Generative Fill... |  | Opens Generative Fill for the selection. (changes the picture) |
| `layer-rotate-180` | Rotate 180° |  | Turns the layer 180 degrees. (changes the picture) |
| `layer-rotate-90-ccw` | Rotate 90° Counter Clockwise |  | Turns the layer 90 degrees counter clockwise. (changes the picture) |
| `layer-rotate-90-cw` | Rotate 90° Clockwise |  | Turns the layer 90 degrees clockwise. (changes the picture) |
| `load-brushes` | Load Brushes... |  | Loads brushes from an .abr file. |
| `match-edges-below` | Match Edges to Layer Below |  | Scales, turns and shifts the active layer a little so the band just inside its edge matches the picture under it; refuses a fit that does not improve the match or needs more than a small correction. (changes the picture) |
| `new-snapshot` | New Snapshot |  | Stores the current state as a snapshot in History. |
| `new-snapshot-layer` | New Snapshot of Current Layer |  | Stores only the selected layer as a snapshot in History. |
| `new-snapshot-merged` | New Snapshot of Merged Layers |  | Stores the picture as it looks now, merged into one layer, as a snapshot in History. |
| `paste` | Paste | Mod+V | Pastes the clipboard as a new layer, centered in view when the copied place is off screen. (changes the picture) |
| `paste-in-place` | Paste in Place | Shift+Mod+V | Pastes at the position the pixels were copied from. (changes the picture) |
| `paste-into` | Paste Into | Alt+Shift+Mod+V | Pastes into the selection with a mask. (changes the picture) |
| `paste-outside` | Paste Outside |  | Pastes outside the selection with a mask. (changes the picture) |
| `patterns-export` | Export Patterns... |  | Saves your patterns as one .pat file. |
| `patterns-import` | Import Patterns... |  | Adds the patterns from .pat files. |
| `peek-original` | Show Opening State |  | Shows the document as a kept snapshot holds it (the opening snapshot unless one is named) in place of the current state, without changing history; run again to put the current state back. Holding the Backslash key does the same while it is down. |
| `perspective-warp` | Perspective Warp |  | Starts Perspective Warp. (changes the picture) |
| `pick-screen-colour` | Pick Color from Screen |  | Picks the color of any pixel on the screen, outside the window too, as the foreground color. |
| `prefs-cursors` | Cursors... |  | Opens Preferences on Cursors: how painting tools show where they paint. |
| `prefs-enhanced-controls` | Enhanced Controls... |  | Opens Preferences on Enhanced Controls. |
| `prefs-file-handling` | File Handling... |  | Opens Preferences on File Handling: library folder, embedded profiles, reopening documents, recovery, lower-case extensions and the recent file list. |
| `prefs-general` | General... |  | Opens Preferences on General: the Home screen, What's New, animated zoom and the color picker. |
| `prefs-guides` | Guides, Grid & Slices... |  | Opens Preferences on Guides, Grid & Slices: colors and line styles of guides and the grid, grid spacing, and slice color and numbers. |
| `prefs-history-cache` | History & Cache... |  | Opens Preferences on History & Cache: history states, history memory and snapshots. |
| `prefs-interface` | Interface... |  | Opens Preferences on Interface: theme, accent, accent intensity and text size. |
| `prefs-performance` | Performance... |  | Opens Preferences on Performance: memory limit, caches, region redraws and the graphics processor. |
| `prefs-plugins` | Plug-ins... |  | Opens Preferences on Plug-ins: NodeMode and ComfyUI addresses, the language model, outside agents and local models. |
| `prefs-raw-defaults` | Raw Defaults... |  | Opens Preferences on Raw Defaults: what the Camera Raw dialog starts with. |
| `prefs-scratch-disks` | Scratch Disks... |  | Opens Preferences on Scratch Disks: the working files kept on this device, the storage allowed, and a button that cleans them. |
| `prefs-tools` | Tools... |  | Opens Preferences on Tools: scroll-wheel zoom, pen pressure, tool tips, the Shift key for tool switch and zoom-click centring. |
| `prefs-transparency` | Transparency & Gamut... |  | Opens Preferences on Transparency & Gamut: the checkerboard and the Gamut Warning color and opacity. |
| `prefs-type` | Type... |  | Opens Preferences on Type. |
| `prefs-units` | Units & Rulers... |  | Opens Preferences on Units & Rulers. |
| `prefs-workspace` | Workspace... |  | Opens Preferences on Workspace: lock the panels and the narrow-window side column. |
| `preset-manager` | Preset Manager... |  | Opens the Preset Manager to rename, delete, load and save brushes, swatches, gradients, patterns and custom shapes. (changes the picture) |
| `presets-export` | Export Presets... |  | Writes your swatches, gradients, custom shapes, patterns, keyboard shortcut sets and menu choices to one formvis-presets file. |
| `presets-import` | Import Presets... |  | Adds the swatches, gradients, custom shapes and patterns of a formvis-presets file to the libraries, skipping what is already there. |
| `presets-migrate` | Migrate Presets... |  | Adds the presets of a formvis-presets file and also takes its keyboard shortcuts, shortcut sets and menu choices. |
| `puppet-warp` | Puppet Warp |  | Starts Puppet Warp with pins on the layer; mode (rigid, normal, distort), density (fewer, normal, more), expansion in pixels and showMesh set its options. (changes the picture) |
| `purge-all` | All |  | Clears the clipboard and the history of every open document after asking. (changes the picture) |
| `purge-clipboard` | Clipboard |  | Clears formvis's internal clipboard. (changes the picture) |
| `purge-histories` | Histories |  | Clears the undo and redo history of every open document after asking, keeping their states and snapshots. (changes the picture) |
| `purge-undo` | Undo |  | Forgets the undone steps that Redo would make again, in the current document. (changes the picture) |
| `purge-video-cache` | Video Cache |  | Frees the reduced display copies and layer-effect results that video layers built while their frames were shown; the frames themselves stay. (changes the picture) |
| `redo` | Redo | Shift+Mod+Z Mod+Y | Steps forward one history step. (changes the picture) |
| `remove-wires` | Remove Wires and Cables |  | Finds wires and cables and removes them. (changes the picture) |
| `reset-all-tools` | Reset All Tools |  | Puts the options of every tool back to their defaults and forgets all the kept values. |
| `reset-tool` | Reset Tool |  | Puts the options of the active tool back to their defaults and forgets the values kept for them. |
| `save-history-log` | Save History Log... |  | Saves the history log (the time, document and name of each step made while Preferences > History Log was on) as a text file. |
| `stroke-dialog` | Stroke... |  | Opens the Stroke dialog for the selection. (changes the picture) |
| `swatch-add` | Add Foreground Color to Swatches |  | Adds the foreground color to the Swatches panel. |
| `swatches-load` | Load Swatches... |  | Replaces the swatches with those in an .aco or .ase file. |
| `swatches-reset` | Reset Swatches |  | Restores the default swatches. |
| `swatches-save` | Save Swatches... |  | Saves the current swatches as an .aco file. |
| `toggle-last-state` | Toggle Last State | Alt+Mod+Z | Switches between the current and the previous history state. (changes the picture) |
| `transform` | Transform Layer | Mod+T | Starts Free Transform on the layer or selection. (changes the picture) |
| `transform-again` | Again | Shift+Mod+T | Repeats the last transform. (changes the picture) |
| `transform-again-copy` | Transform Again on a Copy | Alt+Shift+Mod+T | Repeats the last transform on a copy of the layer. (changes the picture) |
| `transform-copy` | Free Transform a Copy | Alt+Mod+T | Copies the layer or selected pixels in place, then starts Free Transform on the copy. (changes the picture) |
| `transform-distort` | Distort |  | Starts a Distort transform. (changes the picture) |
| `transform-numeric` | Numerically... |  | Carries the layer's corners through numbers: a reference point, moveX, moveY, scaleX, scaleY (percent), angle, skewH, skewV, perspH, perspV or a six number matrix (a b c d e f); without arguments it opens the dialog. (changes the picture) |
| `transform-perspective` | Perspective |  | Starts a Perspective transform. (changes the picture) |
| `transform-rotate` | Rotate |  | Starts a Rotate transform. (changes the picture) |
| `transform-scale` | Scale |  | Starts a Scale transform. (changes the picture) |
| `transform-skew` | Skew |  | Starts a Skew transform. (changes the picture) |
| `transform-warp` | Warp |  | Starts a Warp transform on the layer; style (arc, arch, bulge, flag, wave, fish, rise, fisheye, inflate, squeeze, twist and the others), bend, horizontal, vertical and orientation start it from a preset. (changes the picture) |
| `undo` | Undo | Mod+Z | Steps back one history step. (changes the picture) |
| `warp-remove-split` | Remove Warp Split |  | Removes the Warp grid row or column added last, never the border lines. (changes the picture) |
| `warp-split-cross` | Split Warp Crosswise |  | Adds a row and a column to the Warp grid at the document point x, y (else where the pointer last was, else the middle of the largest cell). (changes the picture) |
| `warp-split-h` | Split Warp Horizontally |  | Adds a row to the Warp grid at the document point x, y (else where the pointer last was, else the middle of the largest cell), leaving the picture unchanged. (changes the picture) |
| `warp-split-v` | Split Warp Vertically |  | Adds a column to the Warp grid at the document point x, y (else where the pointer last was, else the middle of the largest cell), leaving the picture unchanged. (changes the picture) |

## Extensions

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `extensions-manage` | Manage in FormPortal |  | Opens FormPortal at formvis's extensions, where extensions are found, installed, turned off and removed. |
| `extensions-panel` | Extensions Panel |  | Shows the Extensions panel in the dock, opening it if it is hidden. |
| `extensions-reload` | Reload Extensions |  | Reads the installed and development extensions again, with every manifest; only the extensions that changed are reloaded. |

## File

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `action-options` | Action Options... |  | Sets an action's set (folder), its Button Mode color and its function-key shortcut such as F5 or Shift+F5. |
| `assemble-tiles` | Assemble Tiles... |  | Opens the dialog that assembles tile images into one large picture. (changes the picture) |
| `batch` | Batch... |  | Opens Batch to run an action over many files. (changes the picture) (asks first) |
| `clear-recent` | Clear Recent |  | Empties the Open Recent list. (asks first) |
| `close-all` | Close All |  | Closes every open document except pinned tabs. (asks first) |
| `close-document` | Close Document |  | Closes the current document, or the one with the given id, without asking about unsaved changes. (asks first) |
| `close-others` | Close Others | Alt+Mod+P | Closes every document but the current one and the pinned tabs. (asks first) |
| `close-tab` | Close Tab | Alt+Mod+W | Closes the current document, asking about unsaved changes. (asks first) |
| `close-tabs-right` | Close Tabs to the Right |  | Closes the documents whose tabs lie to the right of the current one, skipping pinned tabs; each unsaved one is asked about first. (asks first) |
| `comfyui-run` | Run ComfyUI Workflow... |  | Opens the dialog that runs a ComfyUI workflow and brings the result back. (changes the picture) (asks first) |
| `conditional-mode-change` | Conditional Mode Change... |  | Changes the document to a target mode only when its current mode is one of the ticked source modes. (changes the picture) |
| `contact-sheet` | Contact Sheet II... |  | Lays images (files, or documents true) out as captioned thumbnails on new documents, with page units, mode, depth, place order and caption font as parameters; without parameters it opens Contact Sheet II. (changes the picture) |
| `create-droplet` | Create Droplet... |  | Writes a shell script, or with kind data a droplet file (.fvdrop run by ./formvis cli droplet FILE pictures), that runs a chosen action over any pictures or folders given, saving them in the chosen type, quality and name suffix beside each picture or in an output folder; with the action parameter it writes without asking. (asks first) |
| `create-video-timeline` | Create Video Timeline |  | Creates a video timeline from the document layers. (changes the picture) |
| `crop-straighten-photos` | Crop and Straighten Photos |  | Finds each photo on a scanned page, straightens it and opens it as its own document. (changes the picture) |
| `download-project` | Download Project File |  | Downloads the project file through the browser. (asks first) |
| `earlier-states` | Earlier States... |  | Opens a list of the last two sessions and the crash sets formvis kept, to reopen as tabs. |
| `exit` | Exit |  | Quits formvis after asking Save, Don't Save or Cancel for each document with unsaved changes; in a browser it ends by saying the page can be closed. (asks first) |
| `export-actions-atn` | Save Actions... |  | Saves the actions of one set, or all of them, as an .atn file; steps with no .atn form are left out and listed. |
| `export-artboards` | Export Artboards to Files |  | Exports every artboard to its own file. (asks first) |
| `export-artboards-files` | Artboards to Files... |  | Exports each artboard to its own file in a chosen type and quality; opens the dialog, or runs at once when given any of prefix, format, quality, icc, folder or names (the artboards to write, by name). (asks first) |
| `export-artboards-pdf` | Artboards to PDF... |  | Exports every artboard as one page of a single PDF, in the Layers order, each page at its artboard size from the document resolution; takes name, jpeg, quality and icc. (asks first) |
| `export-as` | Export As... | Alt+Shift+Mod+W | Opens Export As with format, size and quality. (asks first) |
| `export-avif` | Export AVIF |  | Exports the flattened picture as AVIF. (asks first) |
| `export-data-sets` | Data Sets as Files... |  | Applies each data set in turn and exports the flattened document as [doc]_[dataset].png (or jpg, tiff, webp, psd by the format param; the template param names the files with {document}, {name} and {index}, repeated names are numbered), all in one zip; the document ends as it started. (asks first) |
| `export-exr` | OpenEXR... |  | Exports an OpenEXR file. (asks first) |
| `export-exr-half` | OpenEXR Half Float... |  | Exports an OpenEXR file with 16-bit half float channels and ZIP compression. (asks first) |
| `export-exr-none` | OpenEXR Uncompressed... |  | Exports an OpenEXR file with no compression. (asks first) |
| `export-exr-piz` | OpenEXR PIZ... |  | Exports an OpenEXR file with PIZ compression, lossless and quick on grainy pictures. (asks first) |
| `export-gif` | Export GIF... |  | Opens the GIF dialog and exports an animated GIF. (asks first) |
| `export-hdr` | Radiance HDR... |  | Exports a Radiance HDR file. (asks first) |
| `export-jpg` | Export JPEG... | Alt+Shift+Mod+S | Opens the JPEG quality dialog, then exports a JPEG. (asks first) |
| `export-layer-comps` | Layer Comps to Files... |  | Exports each layer comp to its own file named prefix_NNNN_compname, the flattened document with that comp applied, then puts the document back exactly as it was; opens the dialog, or runs at once when given any of prefix, format, quality, icc or folder. (asks first) |
| `export-layers` | Layers to Files... |  | Exports each layer to its own file named prefix_NNNN_layername, with its effects and mask applied; opens the dialog, or runs at once when given any of prefix, format, quality, visible_only, trim, icc or folder. (asks first) |
| `export-luts` | Color Lookup Tables... |  | Records the visible adjustment layers as color lookup tables in .cube, .3dl and .csp files at 17, 33 or 65 points per side, delivered as one file or a zip. Layer masks are ignored. (asks first) |
| `export-mp4` | Video (MP4)... |  | Renders the video timeline or animation to an MP4 file. (asks first) |
| `export-ora` | Export OpenRaster... |  | Exports an OpenRaster file that keeps layers. (asks first) |
| `export-paths-ai` | Paths to AI File... |  | Writes the document paths to an .ai file. (asks first) |
| `export-pdf` | Export PDF |  | Exports the picture as a PDF. (asks first) |
| `export-pfm` | Float PFM... |  | Exports a color float PFM file in linear light. (asks first) |
| `export-png` | Export PNG | Shift+Mod+E | Exports the flattened picture as a PNG. (asks first) |
| `export-preferences` | Export Preferences... |  | Opens Export Preferences: the Quick Export format, quality, prompt and recipe in PNG files, and the folder. |
| `export-psb` | Export PSB (Large Document)... |  | Exports a large document (PSB). (asks first) |
| `export-psd` | Export PSD... |  | Exports the document as a layered PSD. (asks first) |
| `export-selection-mask` | Selection as Mask PNG |  | Writes the selection as a gray PNG the size of the document, white where selected, black elsewhere, with feathered edges kept. (asks first) |
| `export-tiff` | Export TIFF |  | Exports the picture as TIFF. (asks first) |
| `export-tiff-layers` | TIFF with Layers... |  | Exports the picture as a TIFF that carries its layers in the PSD layer block; the TIFF Options prompt offers to discard the layers instead, or pass layers true or false to skip it. (asks first) |
| `export-to-file` | Export to File |  | Encodes the flattened picture as png, jpg, webp, tiff, tga or dpx, or the layers as tiff-layers, psd, psb, ora or fvd, and writes it to the exports folder. (asks first) |
| `export-webp` | Export WebP |  | Exports the flattened picture as WebP. (asks first) |
| `file-info` | File Info... | Alt+Shift+Mod+I | Opens File Info (title, author, description, rating, keywords, copyright), or sets the fields given as title, author, author_title, description, rating, description_writer, keywords, copyright_status, copyright_notice and copyright_url at once as one step; the fields travel in the project and are written as XMP into PNG, JPEG, TIFF, WebP and PSD exports. (changes the picture) |
| `fit-image` | Fit Image... |  | Scales the picture to fit within a width and height with its proportions kept (resample high, smooth or nearest, optionally never enlarging); without parameters it opens the dialog. (changes the picture) |
| `generate-image` | Generate Image... |  | Opens Generate Image. (changes the picture) |
| `generate-image-assets` | Generate Image Assets |  | Writes the image files for every layer or folder whose name holds an asset name such as hero.png, or a list like 200% big.png, small.jpg60%, 64x? icon.png, logo.svg (a shape layer as a vector file), each trimmed and scaled to its size: in the desktop app into a "[document] assets" folder beside the document, in the web build as a zip. (asks first) |
| `generate-image-assets-folder` | Generate Image Assets to Folder... |  | Writes the image files for every layer or folder named like hero.png straight into a folder the person chooses, instead of a zip; needs a browser that can write to a folder. (asks first) |
| `image-asset-variants` | Image Asset Default Variants... |  | Sets the default variants for Generate Image Assets: a list of scales such as 100, 200@2x, 3x; every asset name without a size of its own is written once per variant, with the suffix after its name. (changes the picture) |
| `image-assets-on-save` | Image Assets on Save |  | Turns Image Assets on or off for this document; while on, File > Save also regenerates the image files for every layer named like hero.png and writes them into the "[document] assets" folder beside the document (desktop app) or delivers them as a zip (web). (changes the picture) |
| `image-processor` | Image Processor... |  | Saves chosen files or the open images as JPEG, PSD, TIFF, PNG, WebP, TGA and DPX at a maximum size, optionally after an action and with a copyright notice, each type in its own folder; the dialog can write them into a folder you choose where the browser allows it. |
| `import` | Import Images... | Shift+Mod+O | Opens the file picker to place images as layers. (changes the picture) |
| `import-folder` | Import Images from Folder... |  | Opens the folder picker and places every picture in the chosen folder as a layer, in name order. (changes the picture) |
| `import-notes` | Import Notes... |  | Opens the file picker to add the text notes of a PSD, or the paragraphs of a text file, to the document as notes. (changes the picture) |
| `import-video` | Video Frames to Layers... |  | Opens the dialog that turns video frames into layers. (changes the picture) |
| `insert-action-step` | Insert Action Step... |  | Adds a nested Play Action step (plays another named action) or an Insert Menu Item step (runs one command by id) to a recorded action. |
| `insert-conditional` | Insert Conditional... |  | Adds a conditional step to a recorded action: when the document is landscape, portrait or square, 8, 16 or 32 bit, has a selection, unsaved changes, several layers, or an active type, smart object or masked layer, it plays one named action, otherwise another. Without parameters it opens the Actions dialog. (changes the picture) |
| `lens-correction-batch` | Lens Correction... |  | Opens the Lens Correction batch: one set of distortion, fringe, vignette, perspective and edge settings applied to chosen pictures or a folder, saved as the source type, PNG or JPEG in one zip. (asks first) |
| `list-actions` | List Actions |  | Returns the recorded actions with their step counts and which one is recording, or one action's steps with their kind, label and on or off state. |
| `load-actions` | Load Actions... |  | Loads actions from an .atn file (base64) or formvis JSON; steps with no formvis equivalent stay in the action grayed and are skipped when it plays. |
| `load-files-stack` | Load Files into Stack... |  | Loads image files (files, or documents true for the open ones) as the layers of one new document, optionally aligned and as a smart object stack; without parameters it opens the dialog. (changes the picture) |
| `merge-hdr` | Merge to HDR... |  | Merges bracketed exposures (files, or documents true) into a 32-bit picture, or toned to 16 or 8 bit with depth (method exposure, highlights or equalize; exposure and gamma for the first), with optional alignment, exposure times and ghost removal (ghost strength, ghost base photo); without parameters it opens the dialog. (changes the picture) |
| `new` | New Canvas... | Alt+Mod+N Mod+N | Opens the New Canvas dialog. |
| `new-canvas-model-preset` | New Canvas from Model Preset... |  | Opens New Canvas from Model Preset, which makes a blank document at a size a chosen model family works well at. (changes the picture) |
| `new-from-clipboard` | New from Clipboard |  | Makes a new document the size of the clipboard picture. (changes the picture) |
| `open` | Open Project... | Mod+O | Opens the library dialog to open a saved project. |
| `open-as` | Open As... |  | Opens a dialog to read one file as a format you choose (PNG, JPEG, TIFF, Targa, DPX, Cineon, WBMP, DDS, OpenEXR, PSD and others), whatever its name or extension says; the format parameter preselects it. (changes the picture) |
| `open-image-data` | Open Image Data |  | Opens base64 picture bytes with a file name as a new document. (changes the picture) |
| `open-svg-layers` | Open SVG as Layers... |  | Opens an SVG file as a new document with one editable shape layer per drawable element; with the svg parameter it reads that SVG text instead of asking for a file. (changes the picture) |
| `package` | Package... |  | Saves the document and the files of its linked smart objects together in one zip, as a formvis project pointing at the copies under Links, or as a PSD or PSB beside them. Pass format fvd, psd or psb to skip the dialog. (changes the picture) |
| `photomerge` | Photomerge... |  | Stitches files or the open documents (documents true) into a panorama (Auto, Perspective, Cylindrical, Collage or Reposition) with optional crop, vignette and lens distortion correction, or (layers true) as one layer per photo with seam masks, or (fill true) with the transparent edges and gaps filled by Selection-Aware Fill; without parameters it opens the dialog. (changes the picture) |
| `pin-tab` | Pin Tab |  | Pins or unpins the current document tab: a pinned tab moves to the front, loses its close button and is kept by Close All and Close Others. |
| `place-3d` | Place 3D Model... |  | Opens a file picker for a glTF or GLB model and places it as a layer. (changes the picture) |
| `place-embedded` | Place Embedded... |  | Places an image file as an embedded smart object. (changes the picture) |
| `place-linked` | Place Linked... |  | Places an image file as a linked smart object. (changes the picture) |
| `play-action` | Play Action |  | Plays a named action on the current document, from the first step or from the step given in from. (changes the picture) |
| `print` | Print... | Mod+P | Opens the Print dialog: paper size, orientation, position, scaled print size and a preview, then prints the flattened document through the system print dialog. |
| `print-one-copy` | Print One Copy | Alt+Shift+Mod+P | Prints the flattened document with the settings Print last used, skipping formvis's Print dialog; the system print dialog still opens to confirm the printer. |
| `quick-export` | Quick Export |  | Exports the flattened picture at once in the format, quality and folder set in Export Preferences. (asks first) |
| `render-video` | Render Video... |  | Opens the Render Video dialog for the video timeline. (asks first) |
| `reopen-closed-tab` | Reopen Closed Tab | Alt+Shift+Mod+T | Brings back the document closed last, with its layers, history-free state and unsaved changes as they were; the last five closed are kept until the window reloads. (changes the picture) |
| `revert` | Revert |  | Throws away changes and reopens the last saved version. (changes the picture) (asks first) |
| `save` | Save | Mod+S | Saves the document to the library, or asks for a name the first time. (asks first) |
| `save-as` | Save As... | Shift+Mod+S | Saves the document under a new name in the library. (asks first) |
| `save-as-history` | Save As with History... |  | Saves the document under a new name with the steps behind it kept in the project, up to the history size set in preferences (64 MB when none is set). (asks first) |
| `save-copy` | Save a Copy... | Alt+Mod+S | Saves a copy without changing which file the document belongs to. (asks first) |
| `save-for-web` | Save for Web (Legacy)... |  | Opens Save for Web (Legacy): side-by-side original and optimized previews, a format (JPEG, PNG-24, PNG-8, GIF, WebP) and quality, and an export of the whole image or every slice as a zip. (asks first) |
| `script-browse` | Browse... |  | Runs a JavaScript file in a sandbox with no document or network access: run(id, params) runs a catalogue command, commands() lists the ids and log(...) records a line. Without source it opens a file chooser. (changes the picture) (asks first) |
| `script-delete-empty-layers` | Delete All Empty Layers |  | Deletes every pixel layer with no visible pixels and every empty group, and says how many; keeps the Background and adjustment, fill, type, shape and smart object layers. (changes the picture) |
| `script-events` | Script Events Manager... |  | Opens the Script Events Manager, where a saved action is bound to an event: the app starting, or a document being made, opened, saved, closed, exported or printed. |
| `script-flatten-effects` | Flatten All Layer Effects |  | Draws every layer style into its layer's pixels and clears the style; a type, shape or fill layer that carries one is rasterized. (changes the picture) |
| `script-flatten-masks` | Flatten All Masks |  | Applies every layer mask and vector mask into its layer's pixels and removes it; a type, shape or fill layer that carries one is rasterized. (changes the picture) |
| `send-comfyui` | Send to ComfyUI... |  | Opens the dialog that sends the picture to ComfyUI. (asks first) |
| `send-host` | Send to NodeMode Canvas |  | Sends the picture to the NodeMode canvas that hosts formvis. (asks first) |
| `send-nodemode` | Send to NodeMode... |  | Opens the dialog that sends the picture to NodeMode. (asks first) |
| `stack-statistics` | Statistics... |  | Loads image files (files, or documents true) as a smart object stack, optionally aligned, and combines them with a stack mode (mean, median, minimum, maximum, range, stddev and more); without parameters it opens the dialog. (changes the picture) |

## Filter

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `bump-map` | Generate Bump Map... |  | Adds a Bump Map layer: the active layer's brightness as a grayscale height map. (changes the picture) |
| `filter-addNoise` | Add Noise... |  | Opens the Noise filter on the active layer. (changes the picture) |
| `filter-average` | Average |  | Fills the selection or layer with its average color. (changes the picture) |
| `filter-blur` | Blur |  | Opens the Blur filter on the active layer. (changes the picture) |
| `filter-blurMore` | Blur More |  | Opens the Blur More filter on the active layer. (changes the picture) |
| `filter-boxBlur` | Box Blur... |  | Opens the Box Blur filter on the active layer. (changes the picture) |
| `filter-chromaticShift` | Chromatic Shift... |  | Opens the Chromatic Shift filter on the active layer. (changes the picture) |
| `filter-clouds` | Clouds |  | Opens the Clouds filter on the active layer. (changes the picture) |
| `filter-colorHalftone` | Color Halftone... |  | Opens the Color Halftone filter on the active layer. (changes the picture) |
| `filter-colorToAlpha` | Color to Alpha... |  | Opens the Color to Alpha filter on the active layer. (changes the picture) |
| `filter-convert-smart` | Convert for Smart Filters |  | Converts the active pixel layer to a smart object so later filters stay editable smart filters. (changes the picture) |
| `filter-crystallize` | Crystallize... |  | Opens the Crystallize filter on the active layer. (changes the picture) |
| `filter-custom` | Custom... |  | Opens the Custom filter on the active layer. (changes the picture) |
| `filter-deInterlace` | De-Interlace... |  | Opens the De-Interlace filter on the active layer. (changes the picture) |
| `filter-despeckle` | Despeckle |  | Opens the Despeckle filter on the active layer. (changes the picture) |
| `filter-develop` | Develop... | Shift+Mod+A | Opens the Develop filter on the active layer. (changes the picture) |
| `filter-differenceClouds` | Difference Clouds |  | Opens the Difference Clouds filter on the active layer. (changes the picture) |
| `filter-diffuse` | Diffuse... |  | Opens the Diffuse filter on the active layer. (changes the picture) |
| `filter-displace` | Displace... |  | Opens the Displace filter on the active layer. (changes the picture) |
| `filter-dither` | Dither... |  | Opens the Dither filter on the active layer. (changes the picture) |
| `filter-dustAndScratches` | Dust & Scratches... |  | Opens the Dust & Scratches filter on the active layer. (changes the picture) |
| `filter-emboss` | Emboss... |  | Opens the Emboss filter on the active layer. (changes the picture) |
| `filter-extrude` | Extrude... |  | Opens the Extrude filter on the active layer. (changes the picture) |
| `filter-facet` | Facet |  | Opens the Facet filter on the active layer. (changes the picture) |
| `filter-fibers` | Fibers... |  | Opens the Fibers filter on the active layer. (changes the picture) |
| `filter-fieldBlur` | Field Blur... |  | Opens the Field Blur filter on the active layer. (changes the picture) |
| `filter-filterGallery` | Filter Gallery... |  | Opens the Filter Gallery filter on the active layer. (changes the picture) |
| `filter-findEdges` | Find Edges |  | Opens the Find Edges filter on the active layer. (changes the picture) |
| `filter-flame` | Flame... |  | Opens the Flame filter on the active layer. (changes the picture) |
| `filter-fragment` | Fragment |  | Opens the Fragment filter on the active layer. (changes the picture) |
| `filter-fx-accentedEdges` | Accented Edges... |  | Opens the Filter Gallery with the Accented Edges effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-angledStrokes` | Angled Strokes... |  | Opens the Filter Gallery with the Angled Strokes effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-basRelief` | Bas Relief... |  | Opens the Filter Gallery with the Bas Relief effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-chalkCharcoal` | Chalk & Charcoal... |  | Opens the Filter Gallery with the Chalk & Charcoal effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-charcoal` | Charcoal... |  | Opens the Filter Gallery with the Charcoal effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-chrome` | Chrome... |  | Opens the Filter Gallery with the Chrome effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-coloredPencil` | Colored Pencil... |  | Opens the Filter Gallery with the Colored Pencil effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-conteCrayon` | Conté Crayon... |  | Opens the Filter Gallery with the Conté Crayon effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-craquelure` | Craquelure... |  | Opens the Filter Gallery with the Craquelure effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-crosshatch` | Crosshatch... |  | Opens the Filter Gallery with the Crosshatch effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-cutout` | Cutout... |  | Opens the Filter Gallery with the Cutout effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-darkStrokes` | Dark Strokes... |  | Opens the Filter Gallery with the Dark Strokes effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-diffuseGlow` | Diffuse Glow... |  | Opens the Filter Gallery with the Diffuse Glow effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-dryBrush` | Dry Brush... |  | Opens the Filter Gallery with the Dry Brush effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-filmGrain` | Film Grain... |  | Opens the Filter Gallery with the Film Grain effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-fresco` | Fresco... |  | Opens the Filter Gallery with the Fresco effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-glass` | Glass... |  | Opens the Filter Gallery with the Glass effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-glowingEdges` | Glowing Edges... |  | Opens the Filter Gallery with the Glowing Edges effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-grain` | Grain... |  | Opens the Filter Gallery with the Grain effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-graphicPen` | Graphic Pen... |  | Opens the Filter Gallery with the Graphic Pen effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-halftonePattern` | Halftone Pattern... |  | Opens the Filter Gallery with the Halftone Pattern effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-inkOutlines` | Ink Outlines... |  | Opens the Filter Gallery with the Ink Outlines effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-mosaicTiles` | Mosaic Tiles... |  | Opens the Filter Gallery with the Mosaic Tiles effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-neonGlow` | Neon Glow... |  | Opens the Filter Gallery with the Neon Glow effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-notePaper` | Note Paper... |  | Opens the Filter Gallery with the Note Paper effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-oceanRipple` | Ocean Ripple... |  | Opens the Filter Gallery with the Ocean Ripple effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-paintDaubs` | Paint Daubs... |  | Opens the Filter Gallery with the Paint Daubs effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-paletteKnife` | Palette Knife... |  | Opens the Filter Gallery with the Palette Knife effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-patchwork` | Patchwork... |  | Opens the Filter Gallery with the Patchwork effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-photocopy` | Photocopy... |  | Opens the Filter Gallery with the Photocopy effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-plaster` | Plaster... |  | Opens the Filter Gallery with the Plaster effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-plasticWrap` | Plastic Wrap... |  | Opens the Filter Gallery with the Plastic Wrap effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-posterEdges` | Poster Edges... |  | Opens the Filter Gallery with the Poster Edges effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-reticulation` | Reticulation... |  | Opens the Filter Gallery with the Reticulation effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-roughPastels` | Rough Pastels... |  | Opens the Filter Gallery with the Rough Pastels effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-smudgeStick` | Smudge Stick... |  | Opens the Filter Gallery with the Smudge Stick effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-spatter` | Spatter... |  | Opens the Filter Gallery with the Spatter effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-sponge` | Sponge... |  | Opens the Filter Gallery with the Sponge effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-sprayedStrokes` | Sprayed Strokes... |  | Opens the Filter Gallery with the Sprayed Strokes effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-stainedGlass` | Stained Glass... |  | Opens the Filter Gallery with the Stained Glass effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-stamp` | Stamp... |  | Opens the Filter Gallery with the Stamp effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-sumiE` | Sumi-e... |  | Opens the Filter Gallery with the Sumi-e effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-texturizer` | Texturizer... |  | Opens the Filter Gallery with the Texturizer effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-tornEdges` | Torn Edges... |  | Opens the Filter Gallery with the Torn Edges effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-underpainting` | Underpainting... |  | Opens the Filter Gallery with the Underpainting effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-waterPaper` | Water Paper... |  | Opens the Filter Gallery with the Water Paper effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-fx-watercolor` | Watercolor... |  | Opens the Filter Gallery with the Watercolor effect on the active layer; with the values parameter (the effect's controls by key) it applies the effect at once, as one undo step. (changes the picture) |
| `filter-gaussianBlur` | Gaussian Blur... |  | Opens the Gaussian Blur filter on the active layer. (changes the picture) |
| `filter-grainPlate` | Grain Plate... |  | Opens the Grain Plate filter on the active layer. (changes the picture) |
| `filter-haze` | Haze by Depth... |  | Opens the Haze by Depth filter on the active layer. (changes the picture) |
| `filter-highPass` | High Pass... |  | Opens the High Pass filter on the active layer. (changes the picture) |
| `filter-hsbHsl` | HSB/HSL... |  | Opens the HSB/HSL filter on the active layer. (changes the picture) |
| `filter-irisBlur` | Iris Blur... |  | Opens the Iris Blur filter on the active layer. (changes the picture) |
| `filter-last` | Last Filter | Mod+F | Repeats the last filter with its settings. (changes the picture) |
| `filter-lensBlur` | Lens Blur... |  | Opens the Lens Blur filter on the active layer. (changes the picture) |
| `filter-lensCorrection` | Lens Correction... | Shift+Mod+R | Opens the Lens Correction filter on the active layer. (changes the picture) |
| `filter-lensFlare` | Lens Flare... |  | Opens the Lens Flare filter on the active layer. (changes the picture) |
| `filter-lightingEffects` | Lighting Effects... |  | Opens the Lighting Effects filter on the active layer. (changes the picture) |
| `filter-liquify` | Liquify... | Shift+Mod+X | Opens the Liquify workspace; on a smart object the result is kept as an editable smart filter. (changes the picture) |
| `filter-maximum` | Maximum... |  | Opens the Maximum filter on the active layer. (changes the picture) |
| `filter-median` | Median... |  | Opens the Median filter on the active layer. (changes the picture) |
| `filter-mezzotint` | Mezzotint... |  | Opens the Mezzotint filter on the active layer. (changes the picture) |
| `filter-minimum` | Minimum... |  | Opens the Minimum filter on the active layer. (changes the picture) |
| `filter-mosaic` | Mosaic... |  | Opens the Mosaic filter on the active layer. (changes the picture) |
| `filter-motionBlur` | Motion Blur... |  | Opens the Motion Blur filter on the active layer. (changes the picture) |
| `filter-neural` | Neural Filters... |  | Opens Neural Filters. (changes the picture) |
| `filter-ntscColors` | NTSC Colors |  | Opens the NTSC Colors filter on the active layer. (changes the picture) |
| `filter-offset` | Offset... |  | Opens the Offset filter on the active layer. (changes the picture) |
| `filter-oilPaint` | Oil Paint... |  | Opens the Oil Paint filter on the active layer. (changes the picture) |
| `filter-pathBlur` | Path Blur... |  | Opens the Path Blur filter on the active layer. (changes the picture) |
| `filter-pictureFrame` | Picture Frame... |  | Opens the Picture Frame filter on the active layer. (changes the picture) |
| `filter-pinch` | Pinch... |  | Opens the Pinch filter on the active layer. (changes the picture) |
| `filter-pointillize` | Pointillize... |  | Opens the Pointillize filter on the active layer. (changes the picture) |
| `filter-polarCoordinates` | Polar Coordinates... |  | Opens the Polar Coordinates filter on the active layer. (changes the picture) |
| `filter-radialBlur` | Radial Blur... |  | Opens the Radial Blur filter on the active layer. (changes the picture) |
| `filter-reduceNoise` | Reduce Noise... |  | Opens the Reduce Noise filter on the active layer. (changes the picture) |
| `filter-relight` | Relight... |  | Starts Relight from the Filter menu: adds a Relight layer above the active layer and opens its lights. (changes the picture) |
| `filter-relight-fal` | Relight with fal... |  | Opens Relight with fal: describe the light and the fal relighting model returns the picture lit that way, as a new layer above the others. (changes the picture) |
| `filter-ripple` | Ripple... |  | Opens the Ripple filter on the active layer. (changes the picture) |
| `filter-scanlines` | Scanlines... |  | Opens the Scanlines filter on the active layer. (changes the picture) |
| `filter-shakeReduction` | Shake Reduction... |  | Opens the Shake Reduction filter on the active layer. (changes the picture) |
| `filter-shapeBlur` | Shape Blur... |  | Opens the Shape Blur filter on the active layer. (changes the picture) |
| `filter-sharpen` | Sharpen |  | Opens the Sharpen filter on the active layer. (changes the picture) |
| `filter-sharpenEdges` | Sharpen Edges |  | Opens the Sharpen Edges filter on the active layer. (changes the picture) |
| `filter-sharpenMore` | Sharpen More |  | Opens the Sharpen More filter on the active layer. (changes the picture) |
| `filter-shear` | Shear... |  | Opens the Shear filter on the active layer. (changes the picture) |
| `filter-smartBlur` | Smart Blur... |  | Opens the Smart Blur filter on the active layer. (changes the picture) |
| `filter-smartSharpen` | Smart Sharpen... |  | Opens the Smart Sharpen filter on the active layer. (changes the picture) |
| `filter-solarize` | Solarize |  | Opens the Solarize filter on the active layer. (changes the picture) |
| `filter-spherize` | Spherize... |  | Opens the Spherize filter on the active layer. (changes the picture) |
| `filter-spinBlur` | Spin Blur... |  | Opens the Spin Blur filter on the active layer. (changes the picture) |
| `filter-surfaceBlur` | Surface Blur... |  | Opens the Surface Blur filter on the active layer. (changes the picture) |
| `filter-tiles` | Tiles... |  | Opens the Tiles filter on the active layer. (changes the picture) |
| `filter-tiltShift` | Tilt-Shift... |  | Opens the Tilt-Shift filter on the active layer. (changes the picture) |
| `filter-tonalContrast` | Tonal Contrast... |  | Opens the Tonal Contrast filter on the active layer. (changes the picture) |
| `filter-traceContour` | Trace Contour... |  | Opens the Trace Contour filter on the active layer. (changes the picture) |
| `filter-tree` | Tree... |  | Opens the Tree filter on the active layer. (changes the picture) |
| `filter-twirl` | Twirl... |  | Opens the Twirl filter on the active layer. (changes the picture) |
| `filter-unsharpMask` | Unsharp Mask... |  | Opens the Unsharp Mask filter on the active layer. (changes the picture) |
| `filter-vanishing-point` | Vanishing Point... | Alt+Mod+V | Opens Vanishing Point. (changes the picture) |
| `filter-wave` | Wave... |  | Opens the Wave filter on the active layer. (changes the picture) |
| `filter-wide-angle` | Adaptive Wide Angle... | Alt+Shift+Mod+A | Opens Adaptive Wide Angle. (changes the picture) |
| `filter-wind` | Wind... |  | Opens the Wind filter on the active layer. (changes the picture) |
| `filter-zigZag` | ZigZag... |  | Opens the ZigZag filter on the active layer. (changes the picture) |
| `filter.apply` | Apply Filter |  | Applies a filter with exact settings to the active layer, inside the selection if there is one. (changes the picture) |
| `height-from-normal` | Height Map from Normal Map |  | Adds a Height Map layer integrated from the active layer, read as a normal map. (changes the picture) |
| `normal-map` | Generate Normal Map... |  | Adds a Normal Map layer built from the active layer's brightness. (changes the picture) |
| `wasm-plugin-example` | Install Example Plug-in |  | Installs the example Tint Mix plug-in, built from examples/wasm-filter in Rust. |
| `wasm-plugin-install` | Install Plug-in... |  | Asks for a .wasm filter plug-in (and its .json schema if the module carries none) and installs it into browser storage, where it is loaded at every start. |
| `wasm-plugin-remove` | Remove Plug-in |  | Removes one installed WebAssembly plug-in by id; smart filters that used it are skipped until it is installed again. (asks first) |
| `wasm-plugin-run` | Run Plug-in |  | Runs an installed WebAssembly plug-in on the active layer with the given parameter values, honoring the selection, as one undo step; on a smart object it joins the smart filters. (changes the picture) |
| `wasm-plugins` | Manage Plug-ins (WebAssembly)... |  | Opens the WebAssembly plug-ins dialog: the installed filter plug-ins with their version and parameters, Install, Remove, the example, and the time and memory limits every run keeps. |

### filter.apply parameters

- `kind`: string; required; Which filter
- `settings`: object; All settings as one object; the settings of the kind may also be given as plain parameters

## Generate

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `boxes-clear` | Clear Boxes |  | Removes every layout box from the picture in one undo step. (changes the picture) |
| `boxes-copy` | Copy Box Rows |  | Copies the layout boxes as plain text rows, one line per box with its kind, rectangle in pixels and description. (changes the picture) |
| `boxes-from-selection` | Selection to Box |  | Makes a New box over the bounds of the selection and switches to the Boxes tool. (changes the picture) |
| `boxes-tool` | Boxes Tool |  | Switches to the Boxes tool: drag on the picture to draw layout boxes, each with a kind and a description. (changes the picture) |
| `generate-panel` | Generate Panel |  | Shows the Generate panel and puts the cursor in its prompt. |
| `generate-remove` | Remove / Repair |  | Fills the selection from its surroundings, or switches to the Remove tool when nothing is selected. (changes the picture) |

## Help

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `copy-frame-trace` | Copy Frame Trace |  | Copies the traced frames as CSV: time, wait for the frame, draw time and whether the GPU or the CPU drew it. |
| `frame-trace` | Frame Trace |  | Starts or stops timing every frame the canvas draws, from the moment it was asked for to the end of the draw, with a live line over the canvas; stopping reports the median, 90th percentile and worst. |
| `help-github` | FormVis on GitHub |  | Opens the formvis project page on GitHub in the browser. |
| `report-issue` | Report an Issue... |  | Opens a report to read and edit: the System Info text and this session's errors under a box for what happened, with Copy Report and a button that opens formvis's issue page. Nothing is sent. |
| `simulate-gpu-loss` | Simulate GPU Device Loss |  | Acts as if the GPU device was lost, so drawing falls back to the CPU renderer for this session. |

## Image

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `adj-addNoise` | Add Noise... |  | Opens Noise and applies it to the pixels of the active layer. (changes the picture) |
| `adj-blackWhite` | Black & White... | Alt+Shift+Mod+B | Opens Black & White and applies it to the pixels of the active layer. (changes the picture) |
| `adj-brightnessContrast` | Brightness/Contrast... |  | Opens Brightness/Contrast and applies it to the pixels of the active layer. (changes the picture) |
| `adj-channelMixer` | Channel Mixer... |  | Opens Channel Mixer and applies it to the pixels of the active layer. (changes the picture) |
| `adj-chromaticShift` | Chromatic Shift... |  | Opens Chromatic Shift and applies it to the pixels of the active layer. (changes the picture) |
| `adj-clarity` | Clarity... |  | Opens Clarity and applies it to the pixels of the active layer. (changes the picture) |
| `adj-colorBalance` | Color Balance... | Mod+B | Opens Color Balance and applies it to the pixels of the active layer. (changes the picture) |
| `adj-colorLookup` | Color Lookup... |  | Opens Color Lookup and applies it to the pixels of the active layer. (changes the picture) |
| `adj-curves` | Curves... | Mod+M | Opens Curves and applies it to the pixels of the active layer. (changes the picture) |
| `adj-dehaze` | Dehaze... |  | Opens Dehaze and applies it to the pixels of the active layer. (changes the picture) |
| `adj-develop` | Develop... |  | Opens Develop and applies it to the pixels of the active layer. (changes the picture) |
| `adj-exposure` | Exposure... |  | Opens Exposure and applies it to the pixels of the active layer. (changes the picture) |
| `adj-filmLook` | Film Look... |  | Opens Film Look and applies it to the pixels of the active layer. (changes the picture) |
| `adj-gaussianBlur` | Gaussian Blur... |  | Opens Gaussian Blur and applies it to the pixels of the active layer. (changes the picture) |
| `adj-glow` | Glow... |  | Opens Glow and applies it to the pixels of the active layer. (changes the picture) |
| `adj-gradientMap` | Gradient Map... |  | Opens Gradient Map and applies it to the pixels of the active layer. (changes the picture) |
| `adj-grain` | Grain... |  | Opens Grain and applies it to the pixels of the active layer. (changes the picture) |
| `adj-halation` | Halation... |  | Opens Halation and applies it to the pixels of the active layer. (changes the picture) |
| `adj-hdrToning` | HDR Toning... |  | Opens HDR Toning and applies it to the pixels of the active layer. (changes the picture) |
| `adj-hsv` | Hue/Saturation... | Mod+U | Opens Hue/Saturation and applies it to the pixels of the active layer. (changes the picture) |
| `adj-invert` | Invert... |  | Opens Invert and applies it to the pixels of the active layer. (changes the picture) |
| `adj-levels` | Levels... | Mod+L | Opens Levels and applies it to the pixels of the active layer. (changes the picture) |
| `adj-light` | Light... |  | Opens Light and applies it to the pixels of the active layer. (changes the picture) |
| `adj-motionBlur` | Motion Blur... |  | Opens Motion Blur and applies it to the pixels of the active layer. (changes the picture) |
| `adj-normalise` | Normalize... |  | Opens Normalize and applies it to the pixels of the active layer. (changes the picture) |
| `adj-photoFilter` | Photo Filter... |  | Opens Photo Filter and applies it to the pixels of the active layer. (changes the picture) |
| `adj-posterize` | Posterize... |  | Opens Posterize and applies it to the pixels of the active layer. (changes the picture) |
| `adj-selectiveColor` | Selective Color... |  | Opens Selective Color and applies it to the pixels of the active layer. (changes the picture) |
| `adj-shadowsHighlights` | Shadows/Highlights... |  | Opens Shadows/Highlights and applies it to the pixels of the active layer. (changes the picture) |
| `adj-splitToning` | Split Toning... |  | Opens Split Toning and applies it to the pixels of the active layer. (changes the picture) |
| `adj-texture` | Texture... |  | Opens Texture and applies it to the pixels of the active layer. (changes the picture) |
| `adj-threshold` | Threshold... |  | Opens Threshold and applies it to the pixels of the active layer. (changes the picture) |
| `adj-vibrance` | Vibrance... |  | Opens Vibrance and applies it to the pixels of the active layer. (changes the picture) |
| `adjust.apply` | Apply Adjustment |  | Applies an adjustment with exact values, to the pixels of the active layer or as an adjustment layer. (changes the picture) |
| `apply-image` | Apply Image... |  | Blends a channel of a layer or the merged image into the active layer. (changes the picture) |
| `apply-redactions` | Apply Redactions |  | Burns the redaction boxes into the pixels. (changes the picture) |
| `assign-profile` | Assign Profile... |  | Opens Assign Profile. (changes the picture) |
| `auto-color` | Auto Color | Shift+Mod+B | Neutralizes color casts automatically. (changes the picture) |
| `auto-contrast` | Auto Contrast | Alt+Shift+Mod+L | Sets contrast automatically without shifting color. (changes the picture) |
| `auto-tone` | Auto Tone | Shift+Mod+L | Sets levels on each channel automatically. (changes the picture) |
| `calculations` | Calculations... |  | Blends two single channels (each a layer or the merged picture, optionally inverted) by a blending mode, opacity and optional mask into a new alpha channel, a new gray document or the selection; with no parameters it only shows a notice until the dialog arrives. (changes the picture) |
| `canvas-size` | Canvas Size... | Alt+Mod+C | Opens Canvas Size. (changes the picture) |
| `color-match` | Color Match... |  | Opens Color Match. (changes the picture) |
| `color-table` | Color Table... |  | Opens the Color Table of an Indexed Color document: edit, load or save its palette. (changes the picture) |
| `compute-depth-map` | Compute Depth Map |  | Reads the depth of what the document shows with Depth Anything V2 Small on this computer and adds it as a gray layer named Depth Map, near bright and far dark. (changes the picture) |
| `compute-depth-map-16` | Compute Depth Map as 16-Bit Document |  | Reads the depth of what the document shows with Depth Anything V2 Small on this computer and opens it as a new 16-bit gray document, near bright and far dark, with 65536 steps instead of 256. (changes the picture) |
| `convert-profile` | Convert to Profile... |  | Opens Convert to Profile. (changes the picture) |
| `count-new-group` | New Count Group |  | Starts a new count group with a name and color; marks placed afterwards go into it. The first group made also takes the marks already placed. (changes the picture) |
| `count-set-group` | Set Count Group |  | Renames, recolors, hides, shows, activates or deletes a count group, found by name or id; the active group when none is named. (changes the picture) |
| `data-set-apply` | Apply Data Set |  | Applies a data set to the document: sets bound layers visible or hidden, replaces bound type text keeping its style, and swaps bound pixel layers, as one undo step. |
| `data-sets-import` | Data Sets... |  | Reads data sets from CSV or tab-separated text whose first row names the variables; each later row is one data set. With no text it opens a file chooser for .csv and .txt. |
| `depth-16` | 16 Bits/Channel |  | Sets 16 bits per channel. (changes the picture) |
| `depth-32` | 32 Bits/Channel |  | Sets 32 bits per channel. (changes the picture) |
| `depth-8` | 8 Bits/Channel |  | Sets 8 bits per channel. (changes the picture) |
| `depth-map-detail` | Depth Map Detail |  | Adds the picture's own fine brightness detail to the Depth Map layer by a percentage, inside the selection when there is one. (changes the picture) |
| `depth-map-farther` | Depth Map Farther |  | Darkens the Depth Map layer by a percentage of its range, inside the selection when there is one. (changes the picture) |
| `depth-map-flatten` | Flatten Depth Map |  | Pulls the Depth Map layer toward mid gray by a percentage, inside the selection when there is one. (changes the picture) |
| `depth-map-from-layer` | Depth Map from Layer |  | Reads the depth of the active layer alone with the local depth model and adds it as a gray layer named Depth Map. (changes the picture) |
| `depth-map-nearer` | Depth Map Nearer |  | Brightens the Depth Map layer by a percentage of its range, inside the selection when there is one. (changes the picture) |
| `depth-map-recompute` | Recompute Depth Map |  | Reads the depth again from what the document shows without the depth layer and replaces the Depth Map layer pixels. (changes the picture) |
| `depth-map-smooth` | Smooth Depth Map |  | Blurs the Depth Map layer by a radius, optionally keeping the picture's own edges sharp. (changes the picture) |
| `depth-map-snap` | Snap Depth Map to Edges |  | Smooths the Depth Map layer without blending across the edges of the picture it was read from. (changes the picture) |
| `desaturate` | Desaturate | Shift+Mod+U | Removes color and keeps the mode. (changes the picture) |
| `duplicate-image` | Duplicate... |  | Opens the dialog that duplicates the document into a new one. |
| `equalize` | Equalize |  | Spreads brightness values evenly. (changes the picture) |
| `equalize-layer-from-selection` | Equalize Entire Layer Based on Selection |  | Equalizes the whole layer using the selected area to set the tones. (changes the picture) |
| `flatten` | Flatten Image |  | Flattens every layer into one. (changes the picture) |
| `flip-canvas-h` | Flip Canvas Horizontal |  | Flips the whole image left to right. (changes the picture) |
| `flip-canvas-v` | Flip Canvas Vertical |  | Flips the whole image top to bottom. (changes the picture) |
| `generative-expand` | Generative Expand... |  | Opens Generative Expand. (changes the picture) |
| `image-crop` | Crop |  | Crops the document to the Crop tool frame when one is open, else to the selection. (changes the picture) |
| `image-size` | Image Size... | Alt+Mod+I | Opens Image Size. (changes the picture) |
| `invert` | Invert | Mod+I | Inverts the colors of the active layer. (changes the picture) |
| `measure-color-sampler` | Color Sampler Tool |  | Picks the Color Sampler tool, which pins up to ten sample points whose colors show in the Info panel, averaged over the chosen sample size. |
| `measure-count` | Count Tool |  | Picks the Count tool, which numbers marks placed on the picture, grouped by name and color. |
| `measure-data-points` | Select Data Points... |  | Chooses which measurements the Measurement Log and its CSV export show (label, scale, area, perimeter, length, angle, count, width, height, gray value and its minimum and maximum, integrated density, centroid, circularity). |
| `measure-log` | Measurement Log... |  | Opens the measurement log: a table of recorded measurements that can be added to, deleted, cleared or exported as CSV. (changes the picture) |
| `measure-record` | Record Measurements |  | Records one measurement from the selection (area, perimeter, size), the Ruler line (length, angle) and the counts, scaled by the measurement scale. (changes the picture) |
| `measure-record-features` | Record Measurements per Feature |  | Records one measurement for each separate part of the selection (area, perimeter, size, gray value, centroid), the Ruler line and the counts going on the first, scaled by the measurement scale. (changes the picture) |
| `measure-ruler` | Ruler Tool |  | Picks the Ruler tool, which measures a distance and an angle, and with Alt-drag from an end a second arm and the angle between. |
| `measure-scale` | Set Measurement Scale... |  | Sets the measurement scale: how many pixels make a logical length in chosen units. Without parameters it opens a dialog prefilled from the Ruler line. (changes the picture) |
| `measure-scale-marker` | Place Scale Marker... |  | Places a scale bar with a text label as a new pixel layer at the bottom left, sized from the measurement scale. (changes the picture) |
| `merge-channels` | Merge Channels... |  | Opens a new RGB document from three grays, one each for red, green and blue, taken from open documents or their channels. (changes the picture) |
| `mode-bitmap` | Bitmap... |  | Opens the Bitmap conversion. (changes the picture) |
| `mode-cmyk` | CMYK Color... |  | Opens the CMYK conversion; with params profile (default for the shipped CMYK profile, else a profile id or name) it converts at once with no dialog, using the color preferences intent. (changes the picture) |
| `mode-convert` | Convert Mode... |  | Opens Convert Mode: change to RGB Color, Grayscale or Lab Color with a chosen profile, rendering intent, black point compensation and dither. (changes the picture) |
| `mode-duotone` | Duotone... |  | Opens Duotone options: one to four inks overprinted on a grayscale document. (changes the picture) |
| `mode-grayscale` | Grayscale |  | Converts the document to grayscale. (changes the picture) |
| `mode-grayscale-from` | Grayscale From Channels... |  | Opens the Grayscale conversion that picks how gray is made: luminosity, Rec. 709, the average, or one channel. (changes the picture) |
| `mode-indexed` | Indexed Color... |  | Opens the Indexed Color conversion. (changes the picture) |
| `mode-lab` | Lab Color |  | Converts the document to Lab color. (changes the picture) |
| `mode-multichannel` | Multichannel |  | Converts the document to Multichannel: gray spot channels with ink colors, shown overprinted on white. (changes the picture) |
| `mode-rgb` | RGB Color |  | Converts the document to RGB. (changes the picture) |
| `par-anamorphic` | Anamorphic 2:1 (2) |  | Sets the pixel aspect ratio to Anamorphic 2:1 (2). (changes the picture) |
| `par-custom` | Custom Pixel Aspect Ratio... |  | Sets a custom pixel aspect ratio, the width of one pixel over its height. Without parameters it asks for the number. (changes the picture) |
| `par-d1-ntsc` | D1/DV NTSC (0.91) |  | Sets the pixel aspect ratio to D1/DV NTSC (0.91). (changes the picture) |
| `par-d1-ntsc-wide` | D1/DV NTSC Widescreen (1.21) |  | Sets the pixel aspect ratio to D1/DV NTSC Widescreen (1.21). (changes the picture) |
| `par-d1-pal` | D1/DV PAL (1.09) |  | Sets the pixel aspect ratio to D1/DV PAL (1.09). (changes the picture) |
| `par-d1-pal-wide` | D1/DV PAL Widescreen (1.46) |  | Sets the pixel aspect ratio to D1/DV PAL Widescreen (1.46). (changes the picture) |
| `par-dvcpro-hd` | DVCPRO HD 1080 (1.5) |  | Sets the pixel aspect ratio to DVCPRO HD 1080 (1.5). (changes the picture) |
| `par-hdv` | HDV 1080 (1.33) |  | Sets the pixel aspect ratio to HDV 1080 (1.33). (changes the picture) |
| `par-square` | Square (1) |  | Sets the pixel aspect ratio to square (1). (changes the picture) |
| `perspective-crop` | Perspective Crop |  | Starts the Crop tool in its four-corner mode: move the corners onto a slanted rectangle and Enter flattens it to an upright picture, at the size and resolution chosen when the ratio is Size. (changes the picture) |
| `profile-info` | Profile Info... |  | Opens Profile Info, which shows the picture profile or a chosen profile file: name, color space, device class, connection space, version and ink limit. |
| `remove-bg` | Remove Background |  | Removes the background of the active layer with the neural model. (changes the picture) |
| `remove-bg-lite` | Remove Background (Lightweight) |  | Removes the background with the lightweight model. (changes the picture) |
| `replace-color` | Replace Color... |  | Opens Replace Color. (changes the picture) |
| `reveal-all` | Reveal All |  | Grows the canvas so every layer is fully inside it. (changes the picture) |
| `rotate-180` | 180° |  | Rotates the whole image 180 degrees. (changes the picture) |
| `rotate-90-ccw` | 90° Counter Clockwise |  | Rotates the whole image 90 degrees counter clockwise. (changes the picture) |
| `rotate-90-cw` | 90° Clockwise |  | Rotates the whole image 90 degrees clockwise. (changes the picture) |
| `rotate-arbitrary` | Arbitrary... |  | Opens the dialog that rotates the whole image by any angle. (changes the picture) |
| `sampler-add` | Add Color Sampler |  | Places a Color Sampler point (ten at most) at document x and y, or the middle of the picture when left out; its color shows in the Info panel as RGB and ink together. (changes the picture) |
| `sampler-clear` | Clear Color Samplers |  | Removes every Color Sampler point from the document. (changes the picture) |
| `sampler-delete` | Delete Color Sampler |  | Removes one Color Sampler point by its number; the last one when no index is given. (changes the picture) |
| `sampler-move` | Move Color Sampler |  | Moves a Color Sampler point, found by the number the Info panel shows; params index, x, y. (changes the picture) |
| `split-channels` | Split Channels |  | Opens one gray document for each color channel of the picture and for each alpha or spot channel. (changes the picture) |
| `trap` | Trap... |  | Overlaps CMYK colors where they meet so press misregistration shows no gap; lighter inks spread under darker ones, black does not. (changes the picture) |
| `trim` | Trim... |  | Opens Trim to cut away transparent or same-color edges. (changes the picture) |
| `upscale-2x` | Upscale 2x... |  | Opens the dialog that enlarges the picture two times. |
| `upscale-4x` | Upscale 4x... |  | Opens the dialog that enlarges the picture four times. |
| `variables-define` | Define Variable... |  | Binds a named variable to a layer: its visibility, a type layer's text, or a pixel layer's image (placed fit, fill, as is or conformed to the layer bounds, aligned to one of nine anchors, clipped to the bounds or not). |

### adjust.apply parameters

- `kind`: string; required; Which adjustment
- `as`: string (pixels | layer); pixels bakes it in; layer adds an editable adjustment layer; pixels by default
- `data`: object; The adjustment data as its project file keeps it, merged over the defaults; for curves and gradientMap

## Layer

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `add-filter-mask` | Add Smart Filter Mask |  | Adds a mask to the smart filters. (changes the picture) |
| `add-mask` | Add Layer Mask |  | Adds a layer mask that reveals everything. (changes the picture) |
| `add-mask-hide` | Add Mask Hiding All |  | Adds a layer mask that hides everything. (changes the picture) |
| `ai-label-add` | Add EU AI Label... |  | Marks the document as AI content: every PNG, JPEG, WebP and TIFF export carries the IPTC digital source type in its XMP, and a visible EU AI label badge layer is added; params kind generated or edited, badge, anchor and style, or a dialog when kind is left out. (changes the picture) |
| `ai-label-info` | EU AI Label Info |  | Says whether the document is marked as AI content and which digital source type it writes. |
| `ai-label-remove` | Remove EU AI Label |  | Removes the document's AI label: the metadata mark and every EU AI label badge layer. (changes the picture) |
| `align-bottom` | Align Bottom Edges |  | Aligns the selected layers to the bottom edge. (changes the picture) |
| `align-hcenter` | Align Horizontal Centers |  | Aligns the selected layers on a vertical center line. (changes the picture) |
| `align-left` | Align Left Edges |  | Aligns the selected layers to the left edge. (changes the picture) |
| `align-right` | Align Right Edges |  | Aligns the selected layers to the right edge. (changes the picture) |
| `align-top` | Align Top Edges |  | Aligns the selected layers to the top edge. (changes the picture) |
| `align-vcenter` | Align Vertical Centers |  | Aligns the selected layers on a horizontal center line. (changes the picture) |
| `apply-mask` | Apply Layer Mask |  | Bakes the layer mask into the pixels. (changes the picture) |
| `artboard-from-group` | Artboard from Group... |  | Opens the dialog that turns a folder into an artboard. (changes the picture) |
| `artboard-from-layers` | Artboard from Layers |  | Makes an artboard from the selected layers. (changes the picture) |
| `artboard-from-layers-dialog` | Artboard from Layers... |  | Opens a dialog to name and color an artboard made from the selected layers. (changes the picture) |
| `artboard-options` | Artboard Options... |  | Opens the options of the selected artboard. (changes the picture) |
| `background-from-layer` | Background from Layer |  | Turns the active pixel layer into the Background: it moves to the bottom, fills the canvas and has the background color behind its transparent parts. (changes the picture) |
| `backward` | Send Backward | Mod+[ | Moves the layer down one place. (changes the picture) |
| `blend-next` | Next Blend Mode | Shift+= | Moves to the next blend mode. (changes the picture) |
| `blend-prev` | Previous Blend Mode | Shift+- | Moves to the previous blend mode. (changes the picture) |
| `bring-front` | Bring to Front | Shift+Mod+] | Moves the layer to the top. (changes the picture) |
| `clear-layer-style` | Clear Layer Style |  | Removes all effects from the layer. (changes the picture) |
| `clip` | Create Clipping Mask | Alt+Mod+G | Clips the layer to the one below. (changes the picture) |
| `convert-smart` | Convert to Smart Object |  | Converts the layer to a smart object. (changes the picture) |
| `copy-layer-style` | Copy Layer Style |  | Copies the layer style. |
| `copy-layers` | Copy Layers |  | Copies the selected layers as objects, with masks, styles, live text and folder contents, for Paste Layers in any open document. |
| `copy-layers-to-document` | Copy Layers to Document |  | Copies the selected layers, with masks, styles, live text and folder contents, into another open document or a new one; params document (name, number from 1, or new), x and y offset. |
| `copy-style-below` | Copy Layer Style to Layer Below |  | Copies the active layer's effects onto the layer below it, replacing that layer's effects. (changes the picture) |
| `create-layers` | Create Layers |  | Turns the layer effects into layers. (changes the picture) |
| `delete-filter-mask` | Delete Smart Filter Mask |  | Deletes the smart filter mask. (changes the picture) |
| `delete-hidden` | Delete Hidden Layers |  | Deletes every hidden layer. (changes the picture) (asks first) |
| `delete-layer` | Delete Layer |  | Deletes the selected layers. (changes the picture) (asks first) |
| `delete-layer-ask` | Delete Layer... |  | Asks, then deletes the selected layers (the Layers panel trash button). (changes the picture) (asks first) |
| `delete-mask` | Delete Layer Mask |  | Removes the layer mask. (changes the picture) |
| `deselect-layers` | Deselect Layers |  | Deselects all layers. |
| `distribute-bottom` | Distribute Bottom Edges |  | Spaces layers evenly by their bottom edges. (changes the picture) |
| `distribute-hcenter` | Distribute Horizontal Centers |  | Spaces layers evenly by their horizontal centers. (changes the picture) |
| `distribute-hspace` | Distribute Horizontal Spacing |  | Makes the gaps between layers equal across. (changes the picture) |
| `distribute-left` | Distribute Left Edges |  | Spaces layers evenly by their left edges. (changes the picture) |
| `distribute-right` | Distribute Right Edges |  | Spaces layers evenly by their right edges. (changes the picture) |
| `distribute-top` | Distribute Top Edges |  | Spaces layers evenly by their top edges. (changes the picture) |
| `distribute-vcenter` | Distribute Vertical Centers |  | Spaces layers evenly by their vertical centers. (changes the picture) |
| `distribute-vspace` | Distribute Vertical Spacing |  | Makes the gaps between layers equal down. (changes the picture) |
| `duplicate` | Layer via Copy | Mod+J | Copies the selected layers above themselves. (changes the picture) |
| `duplicate-dialog` | Duplicate Layer... |  | Opens Duplicate Layer to name the copy or send it to another document. (changes the picture) |
| `edit-adjustment` | Edit Adjustment... |  | Opens the settings of the active adjustment layer. (changes the picture) |
| `edit-contents` | Edit Contents |  | Opens the smart object source for editing. (changes the picture) |
| `edit-relight` | Edit Lighting... |  | Reopens the lights of the selected Relight layer. (changes the picture) |
| `embed-linked` | Embed Linked |  | Embeds the linked file in the document. (changes the picture) |
| `extrude-3d` | New 3D Extrusion from Selected Layer... |  | Extrudes the selected shape, type or pixel layer into 3D with depth, bevel, light and material, rendered to a layer that keeps its settings. (changes the picture) |
| `film-apply-look` | Apply Film Look |  | Adds a Film Look adjustment layer with a named film look (negative, slide, black and white or cine: tone curve, color and speed-based grain); params look, strength and grain. (changes the picture) |
| `film-copy-points` | Copy Film Curve Points |  | Copies the tone curve points of the active Film Look layer. |
| `film-frame` | Frame... |  | Opens Frame to add a film or white border layer. (changes the picture) |
| `film-leak` | Light Leak... |  | Opens Light Leak to add a leak layer. (changes the picture) |
| `film-paste-points` | Paste Film Curve Points |  | Puts the copied curve points on the active Film Look layer. (changes the picture) |
| `find-layers` | Find Layers... | Alt+Shift+Mod+F | Opens the Layers panel filter. |
| `flip-layer-h` | Flip Layer Horizontal |  | Flips the layer left to right. (changes the picture) |
| `flip-layer-v` | Flip Layer Vertical |  | Flips the layer top to bottom. (changes the picture) |
| `forward` | Bring Forward | Mod+] | Moves the layer up one place. (changes the picture) |
| `frame-from-layers` | Frame from Layers |  | Makes an image frame from the selected layers. (changes the picture) |
| `frequency-separation` | Frequency Separation... |  | Splits what is visible into a blurred Low Frequency layer for color and tone and a High Frequency layer for fine detail, stacked so the picture looks unchanged. Takes a blur radius in pixels; the dialog opens when it is left out. (changes the picture) |
| `global-light` | Global Light... |  | Opens the Global Light dialog. (changes the picture) |
| `group` | Group Layers | Mod+G | Puts the selected layers into a new folder. (changes the picture) |
| `group-from-layers` | Group from Layers... |  | Opens the New Group from Layers dialog. (changes the picture) |
| `hide-all-effects` | Hide All Effects |  | Shows or hides all layer effects. (changes the picture) |
| `hide-layers` | Hide Layers |  | Hides or shows the selected layers. (changes the picture) |
| `isolate-layers` | Isolate Layers |  | Shows only the selected layers. |
| `layer-bits-16` | Convert Layer to 16 Bits |  | Holds the selected layers at 16 bits per channel inside a 32 bit document: their pixels snap to 65536 steps and later edits keep them there. (changes the picture) |
| `layer-bits-8` | Convert Layer to 8 Bits |  | Holds the selected layers at 8 bits per channel inside a 16 or 32 bit document: their pixels snap to 256 steps and later edits keep them there. (changes the picture) |
| `layer-comp-apply` | Apply Layer Comp |  | Applies a layer comp by id or name. (changes the picture) |
| `layer-comp-delete` | Delete Layer Comp |  | Deletes the active layer comp. (changes the picture) |
| `layer-comp-duplicate` | Duplicate Layer Comp |  | Copies the active layer comp, placed after it and named with copy. (changes the picture) |
| `layer-comp-last-state` | Last Document State |  | Puts the layers back as they were before the first comp was applied and clears the active comp. (changes the picture) |
| `layer-comp-new` | New Layer Comp |  | Records a layer comp of visibility, position and appearance. (changes the picture) |
| `layer-comp-next` | Next Layer Comp |  | Applies the next layer comp, wrapping. (changes the picture) |
| `layer-comp-options` | Layer Comp Options... |  | Changes the active layer comp's name, comment and what it keeps (visibility, position, appearance), or opens the options dialog when given none. (changes the picture) |
| `layer-comp-previous` | Previous Layer Comp |  | Applies the previous layer comp, wrapping. (changes the picture) |
| `layer-comp-update` | Update Layer Comp |  | Re-records the active layer comp from the layers now, or only the named parts (visibility, position, appearance). (changes the picture) |
| `layer-content-options` | Layer Content Options... |  | Opens the content options of a fill layer. (changes the picture) |
| `layer-export-as` | Export As... |  | Opens Export As for each selected layer (the active one when none is selected) drawn alone, with format, quality, size, matte and a live preview and size estimate. (asks first) |
| `layer-from-background` | Layer from Background... |  | Opens the dialog that turns the Background into a normal layer. (changes the picture) |
| `layer-label-blue` | Blue |  | Labels the selected layers blue in the Layers panel. (changes the picture) |
| `layer-label-gray` | Gray |  | Labels the selected layers gray in the Layers panel. (changes the picture) |
| `layer-label-green` | Green |  | Labels the selected layers green in the Layers panel. (changes the picture) |
| `layer-label-none` | No Color |  | Removes the color label from the selected layers. (changes the picture) |
| `layer-label-orange` | Orange |  | Labels the selected layers orange in the Layers panel. (changes the picture) |
| `layer-label-red` | Red |  | Labels the selected layers red in the Layers panel. (changes the picture) |
| `layer-label-violet` | Violet |  | Labels the selected layers violet in the Layers panel. (changes the picture) |
| `layer-label-yellow` | Yellow |  | Labels the selected layers yellow in the Layers panel. (changes the picture) |
| `layer-quick-export-png` | Quick Export as PNG |  | Exports each selected layer (the active one when none is selected) alone, with its effects and mask, as a PNG file named after the layer. (asks first) |
| `layer-role-background` | Background |  | Marks the selected layers as the Background of the picture, saved with the project. (changes the picture) |
| `layer-role-depth` | Control: Depth |  | Marks the selected layers as a Depth control: the Generate panel sends them to a ComfyUI workflow as the depth guide. (changes the picture) |
| `layer-role-edges` | Control: Edges |  | Marks the selected layers as an Edges control: the Generate panel sends them to a ComfyUI workflow as the edge guide. (changes the picture) |
| `layer-role-none` | No Role |  | Removes the generation role from the selected layers. (changes the picture) |
| `layer-role-pose` | Control: Pose |  | Marks the selected layers as a Pose control: the Generate panel sends them to a ComfyUI workflow as the pose guide. (changes the picture) |
| `layer-role-reference` | Reference |  | Marks the selected layers as Reference: the Generate panel lists them as the reference pictures (@img1, @img2 and on) that a ComfyUI workflow receives. (changes the picture) |
| `layer-role-scribble` | Control: Scribble |  | Marks the selected layers as a Scribble control: the Generate panel sends them to a ComfyUI workflow as the scribble guide. (changes the picture) |
| `layer-role-style` | Style |  | Marks the selected layers as the Style of the picture, saved with the project. (changes the picture) |
| `layer-role-subject` | Subject |  | Marks the selected layers as the Subject of the picture, saved with the project. (changes the picture) |
| `layer-style` | Layer Style... |  | Opens Layer Style. (changes the picture) |
| `layer-via-cut` | Layer via Cut | Shift+Mod+J | Moves the selected pixels to a new layer. (changes the picture) |
| `layer.set` | Set Layer |  | Changes a layer name, visibility, opacity or blend mode; the active layer when id is omitted. (changes the picture) |
| `link-layers` | Link Layers |  | Links the selected layers so they move together. (changes the picture) |
| `link-mask` | Unlink Layer Mask |  | Links or unlinks the mask from its layer. (changes the picture) |
| `lock-layers` | Lock Layers... | Mod+/ | Opens the dialog to lock pixels, position or transparency. (changes the picture) |
| `lock-transparency` | Lock Transparent Pixels | / | Locks the transparent pixels of the selected layers, or unlocks them when every one is already locked. (changes the picture) |
| `mask-all-objects` | Mask All Objects |  | Finds every object and gives each its own masked layer. (changes the picture) |
| `mask-from-transparency` | From Transparency |  | Turns the layer transparency into a mask. (changes the picture) |
| `mask-hide-all` | Hide All |  | Adds a mask that hides the whole layer, or resets the existing mask to black. (changes the picture) |
| `mask-hide-selection` | Hide Selection |  | Adds a mask hiding the selection. (changes the picture) |
| `mask-invert` | Invert Layer Mask |  | Turns the layer mask inside out, showing what it hid. (changes the picture) |
| `mask-properties` | Mask Properties |  | Sets the density and feather of the layer mask or vector mask. (changes the picture) |
| `mask-reveal-all` | Reveal All |  | Adds a mask that reveals the whole layer, or resets the existing mask to white. (changes the picture) |
| `mask-reveal-selection` | Reveal Selection |  | Adds a mask showing only the selection. (changes the picture) |
| `mask-view-alone` | View Mask Alone |  | Shows the active layer mask alone in black and white; again returns to the image. (changes the picture) |
| `mask-view-red` | View Mask as Red Overlay |  | Shows the active layer mask as a red overlay on the image; again returns. (changes the picture) |
| `matting-black` | Remove Black Matte |  | Removes black fringe from a cut-out. (changes the picture) |
| `matting-decontaminate` | Color Decontaminate... |  | Opens Color Decontaminate to clean edge color. (changes the picture) |
| `matting-defringe` | Defringe... |  | Opens Defringe to pull in edge pixels. (changes the picture) |
| `matting-white` | Remove White Matte |  | Removes white fringe from a cut-out. (changes the picture) |
| `merge` | Merge Down | Mod+E | Merges the layer into the one below. (changes the picture) |
| `merge-visible` | Merge Visible |  | Merges every visible layer into one. (changes the picture) |
| `move-out` | Move Out of Folder | Shift+Mod+G | Moves the layer out of its folder. (changes the picture) |
| `move-style-below` | Move Layer Style to Layer Below |  | Moves the active layer's effects onto the layer below it and clears them here. (changes the picture) |
| `new-adj-addNoise` | New Add Noise Layer... |  | Adds a Add Noise Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-blackWhite` | New Black & White Layer... |  | Adds a Black & White Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-brightnessContrast` | New Brightness/Contrast Layer... |  | Adds a Brightness/Contrast Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-channelMixer` | New Channel Mixer Layer... |  | Adds a Channel Mixer Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-chromaticShift` | New Chromatic Shift Layer... |  | Adds a Chromatic Shift Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-clarity` | New Clarity Layer... |  | Adds a Clarity Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-colorBalance` | New Color Balance Layer... |  | Adds a Color Balance Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-colorLookup` | New Color Lookup Layer... |  | Adds a Color Lookup Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-curves` | New Curves Layer... |  | Adds a Curves Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-dehaze` | New Dehaze Layer... |  | Adds a Dehaze Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-develop` | New Develop Layer... |  | Adds a Develop Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-exposure` | New Exposure Layer... |  | Adds a Exposure Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-filmLook` | New Film Look Layer... |  | Adds a Film Look Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-gaussianBlur` | New Gaussian Blur Layer... |  | Adds a Gaussian Blur Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-glow` | New Glow Layer... |  | Adds a Glow Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-gradientMap` | New Gradient Map Layer... |  | Adds a Gradient Map Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-grain` | New Grain Layer... |  | Adds a Grain Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-halation` | New Halation Layer... |  | Adds a Halation Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-hdrToning` | New HDR Toning Layer... |  | Adds a HDR Toning Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-hsv` | New Hue/Saturation Layer... |  | Adds a Hue/Saturation Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-invert` | New Invert Layer... |  | Adds a Invert Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-levels` | New Levels Layer... |  | Adds a Levels Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-light` | New Light Layer... |  | Adds a Light Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-motionBlur` | New Motion Blur Layer... |  | Adds a Motion Blur Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-normalise` | New Normalize Layer... |  | Adds a Normalize Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-photoFilter` | New Photo Filter Layer... |  | Adds a Photo Filter Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-posterize` | New Posterize Layer... |  | Adds a Posterize Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-selectiveColor` | New Selective Color Layer... |  | Adds a Selective Color Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-shadowsHighlights` | New Shadows/Highlights Layer... |  | Adds a Shadows/Highlights Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-splitToning` | New Split Toning Layer... |  | Adds a Split Toning Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-texture` | New Texture Layer... |  | Adds a Texture Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-threshold` | New Threshold Layer... |  | Adds a Threshold Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-adj-vibrance` | New Vibrance Layer... |  | Adds a Vibrance Layer adjustment layer; its dialog opens for the values. (changes the picture) |
| `new-artboard` | New Artboard |  | Adds an artboard. (changes the picture) |
| `new-artboard-dialog` | Artboard... |  | Opens the New Artboard dialog. (changes the picture) |
| `new-dodge-burn-layer` | Dodge & Burn Layer |  | Adds a Soft Light layer filled with 50% gray for dodging and burning. (changes the picture) |
| `new-fill-adjustment` | New Fill or Adjustment Layer |  | Opens the list of fill layers and adjustment layers beside the Layers panel button and adds the one picked. (changes the picture) |
| `new-fill-gradient` | Gradient... |  | Adds a gradient fill layer. (changes the picture) |
| `new-fill-pattern` | Pattern... |  | Adds a pattern fill layer. (changes the picture) |
| `new-fill-solid` | Solid Color... |  | Adds a solid color fill layer. (changes the picture) |
| `new-filter-layer` | New Filter Layer |  | Adds a filter layer that runs any filter on everything below it, limited by its mask, Limit, opacity and blend mode. (changes the picture) |
| `new-folder` | New Folder |  | Adds a layer folder. (changes the picture) |
| `new-folder-dialog` | Group... |  | Opens the New Group dialog. (changes the picture) |
| `new-layer` | New Layer |  | Adds an empty layer above the active one. (changes the picture) |
| `new-layer-dialog` | Layer... | Shift+Mod+N | Opens the New Layer dialog with name, color and mode. (changes the picture) |
| `new-relight-layer` | Relight Layer... |  | Adds a Relight layer that lights what lies beneath it with virtual lights, on this computer. (changes the picture) |
| `new-shape-layer` | Shape Layer |  | Adds a shape layer from a kind (rectangle, ellipse, triangle, polygon, star, line, arrow, heart), a box, fill and stroke colors, stroke width, type, alignment, caps and corners, corner radius, sides or star points, and an optional gradient fill with its angle and end color. (changes the picture) |
| `new-type-layer` | Type Layer |  | Adds a type layer from text, position, size, color, orientation and an optional paragraph box; with no text it starts typing on the canvas. (changes the picture) |
| `panorama-apply-view` | Apply View to Panorama |  | Projects the current panorama edit view back onto its source panorama as a new layer named Panorama edit, one undo step. (changes the picture) |
| `panorama-view` | Spherical Panorama... |  | Opens the active document, taken as an equirectangular picture, as a sphere you turn by dragging, with yaw, pitch and field of view; Edit View makes the current view a new document. (changes the picture) |
| `paste-layer-style` | Paste Layer Style |  | Pastes the copied layer style. (changes the picture) |
| `paste-layers` | Paste Layers |  | Pastes the layers Copy Layers kept onto the top of the current document, in place when the sizes agree, else centered. (changes the picture) |
| `pick-layer-0` |  |  | Selects the layer in this slot from the layers under the pointer (right-click the canvas with the Move tool). |
| `pick-layer-1` |  |  | Selects the layer in this slot from the layers under the pointer (right-click the canvas with the Move tool). |
| `pick-layer-2` |  |  | Selects the layer in this slot from the layers under the pointer (right-click the canvas with the Move tool). |
| `pick-layer-3` |  |  | Selects the layer in this slot from the layers under the pointer (right-click the canvas with the Move tool). |
| `pick-layer-4` |  |  | Selects the layer in this slot from the layers under the pointer (right-click the canvas with the Move tool). |
| `pick-layer-5` |  |  | Selects the layer in this slot from the layers under the pointer (right-click the canvas with the Move tool). |
| `pick-layer-6` |  |  | Selects the layer in this slot from the layers under the pointer (right-click the canvas with the Move tool). |
| `pick-layer-7` |  |  | Selects the layer in this slot from the layers under the pointer (right-click the canvas with the Move tool). |
| `pick-layer-8` |  |  | Selects the layer in this slot from the layers under the pointer (right-click the canvas with the Move tool). |
| `pick-layer-9` |  |  | Selects the layer in this slot from the layers under the pointer (right-click the canvas with the Move tool). |
| `rasterize` | Rasterize Layer |  | Rasterizes the active layer. (changes the picture) |
| `rasterize-all` | Rasterize All Layers |  | Rasterizes every vector, text and smart layer. (changes the picture) |
| `rasterize-fill` | Rasterize Fill Content |  | Turns a fill layer into pixels. (changes the picture) |
| `rasterize-shape` | Rasterize Shape |  | Turns a shape layer into pixels. (changes the picture) |
| `rasterize-smart` | Rasterize Smart Object |  | Turns a smart object into pixels. (changes the picture) |
| `rasterize-style` | Layer Style |  | Draws the layer style of the selected layers into their pixels and clears the style. (changes the picture) |
| `rasterize-type` | Rasterize Type |  | Turns a text layer into pixels. (changes the picture) |
| `rasterize-vmask` | Vector Mask |  | Turns the vector mask into a pixel mask. (changes the picture) |
| `relight.apply` | Apply Relight |  | Adds a Relight layer above the active layer, lit by a Look or by the lights given, rendered at full size on this computer; one history step. (changes the picture) |
| `relink` | Relink to File... |  | Relinks a smart object to another file. (changes the picture) |
| `rename` | Rename Layer |  | Starts renaming the active layer in the Layers panel. |
| `replace-contents` | Replace Contents... |  | Replaces the smart object source with a file. (changes the picture) |
| `reverse-layers` | Reverse |  | Reverses the order of the selected layers. (changes the picture) |
| `scale-effects` | Scale Effects... |  | Opens the dialog that scales layer effects. (changes the picture) |
| `select-all-layers` | All Layers | Alt+Mod+A | Selects every layer. |
| `select-layer-bottom` | Bottom Layer | Alt+, | Makes the bottom layer active. (changes the picture) |
| `select-layer-down` | Backward Layer | Alt+[ | Makes the layer below the active one active, among the layers the Layers panel shows. (changes the picture) |
| `select-layer-down-add` | Add Backward Layer to Selection | Alt+Shift+[ | Adds the layer below the active one to the layer selection and makes it active. (changes the picture) |
| `select-layer-top` | Top Layer | Alt+. | Makes the top layer active. (changes the picture) |
| `select-layer-up` | Forward Layer | Alt+] | Makes the layer above the active one active, among the layers the Layers panel shows. (changes the picture) |
| `select-layer-up-add` | Add Forward Layer to Selection | Alt+Shift+] | Adds the layer above the active one to the layer selection and makes it active. (changes the picture) |
| `select-linked` | Select Linked Layers |  | Selects the layers linked to the active one. |
| `send-back` | Send to Back | Shift+Mod+[ | Moves the layer to the bottom. (changes the picture) |
| `set-filter-layer` | Set Filter Layer |  | Changes the settings of the active filter layer by key. (changes the picture) |
| `shape-color` | Shape Color from Foreground |  | Sets the shape fill from the foreground color. (changes the picture) |
| `shape-corners` | Corner Radii... |  | Opens the corner radii of a rectangle shape. (changes the picture) |
| `shape-style` | Shape Fill and Stroke... |  | Opens the shape fill and stroke dialog. (changes the picture) |
| `shape-style-copy` | Copy Shape Fill and Stroke |  | Copies the active shape layer's fill and stroke. (changes the picture) |
| `shape-style-paste` | Paste Shape Fill and Stroke |  | Pastes the copied fill and stroke onto the active shape layer. (changes the picture) |
| `shapes-exclude` | Exclude Overlapping Shapes |  | Removes where shapes overlap and keeps the rest. (changes the picture) |
| `shapes-intersect` | Intersect Shape Areas |  | Keeps only where shapes overlap. (changes the picture) |
| `shapes-merge` | Merge Shape Components |  | Merges shape components into one path. (changes the picture) |
| `shapes-subtract` | Subtract Front Shape |  | Cuts the front shape out of the one behind. (changes the picture) |
| `shapes-unite` | Unite Shapes |  | Unites the selected shape layers into one shape. (changes the picture) |
| `show-all-layers` | Show All Layers |  | Shows every hidden layer in the document as one history step. (changes the picture) |
| `show-only-layer` | Show Only This Layer |  | Hides every other layer so only the active one (and the folders holding it) shows; run it again on the same layer to bring the others back. Alt-click an eye does the same. (changes the picture) |
| `smart-convert-to-layers` | Convert to Layers |  | Replaces the active smart object with a pixel layer holding its source at its current placement, without the smart filters. (changes the picture) |
| `smart-convert-to-linked` | Convert to Linked... |  | Saves an embedded smart object as a PNG file and links the layer to it. (changes the picture) |
| `smart-export-contents` | Export Contents... |  | Saves the active smart object source as a PNG file named after the layer. (changes the picture) |
| `smart-filters` | Smart Filters... |  | Opens the smart filter stack of the active layer. (changes the picture) |
| `smart-filters-clear` | Clear Smart Filters |  | Removes every smart filter of the active smart object. (changes the picture) |
| `smart-filters-disable` | Disable Smart Filters |  | Turns every filter of the active smart object off, or back on when all are off. (changes the picture) |
| `smart-new-via-copy` | New Smart Object via Copy |  | Duplicates the active smart object as a new, independent smart object above it. (changes the picture) |
| `smart-reveal-linked` | Reveal in File Manager |  | Shows the active linked smart object's file in the system file manager. |
| `smart-warp-reset` | Reset Warp |  | Drops the active smart object's Warp, Puppet Warp or Perspective Warp and shows its render where it sat before; the source and smart filters stay. (changes the picture) |
| `stack-mode-entropy` | Entropy |  | Set the stack mode of a stacked smart object to Entropy (changes the picture) |
| `stack-mode-kurtosis` | Kurtosis |  | Set the stack mode of a stacked smart object to Kurtosis (changes the picture) |
| `stack-mode-majority` | Majority |  | Set the stack mode of a stacked smart object to Majority, the most common value (changes the picture) |
| `stack-mode-maximum` | Maximum |  | Set the stack mode of a stacked smart object to Maximum (changes the picture) |
| `stack-mode-mean` | Mean |  | Set the stack mode of a stacked smart object to Mean (changes the picture) |
| `stack-mode-median` | Median |  | Set the stack mode of a stacked smart object to Median (changes the picture) |
| `stack-mode-minimum` | Minimum |  | Set the stack mode of a stacked smart object to Minimum (changes the picture) |
| `stack-mode-none` | None |  | Set the stack mode of a stacked smart object to None, showing the top layer (changes the picture) |
| `stack-mode-range` | Range |  | Set the stack mode of a stacked smart object to Range (changes the picture) |
| `stack-mode-skewness` | Skewness |  | Set the stack mode of a stacked smart object to Skewness (changes the picture) |
| `stack-mode-stddev` | Standard Deviation |  | Set the stack mode of a stacked smart object to Standard Deviation (changes the picture) |
| `stack-mode-summation` | Summation |  | Set the stack mode of a stacked smart object to Summation (changes the picture) |
| `stack-mode-variance` | Variance |  | Set the stack mode of a stacked smart object to Variance (changes the picture) |
| `stamp-down` | Stamp Down | Alt+Mod+E | Merges a copy of the active layer into the pixel layer below it, or copies of several selected layers into a new layer above them; the originals stay. (changes the picture) |
| `stamp-visible` | Stamp Visible | Alt+Shift+Mod+E | Adds a new layer holding everything visible merged, above the active layer; the other layers stay as they are. (changes the picture) |
| `style-bevel` | Bevel & Emboss... |  | Opens Layer Style at Bevel and Emboss. (changes the picture) |
| `style-blending` | Blending Options... |  | Opens Layer Style at Blending Options. (changes the picture) |
| `style-color-overlay` | Color Overlay... |  | Opens Layer Style at Color Overlay. (changes the picture) |
| `style-drop-shadow` | Drop Shadow... |  | Opens Layer Style at Drop Shadow. (changes the picture) |
| `style-gradient-overlay` | Gradient Overlay... |  | Opens Layer Style at Gradient Overlay. (changes the picture) |
| `style-inner-glow` | Inner Glow... |  | Opens Layer Style at Inner Glow. (changes the picture) |
| `style-inner-shadow` | Inner Shadow... |  | Opens Layer Style at Inner Shadow. (changes the picture) |
| `style-outer-glow` | Outer Glow... |  | Opens Layer Style at Outer Glow. (changes the picture) |
| `style-pattern-overlay` | Pattern Overlay... |  | Opens Layer Style at Pattern Overlay. (changes the picture) |
| `style-satin` | Satin... |  | Opens Layer Style at Satin. (changes the picture) |
| `style-stroke` | Stroke... |  | Opens Layer Style at Stroke. (changes the picture) |
| `toggle-filter-mask` | Toggle Filter Mask |  | Disables or enables the smart filter mask. (changes the picture) |
| `toggle-layer-effects` | Toggle Layer Effects |  | Shows or hides the layer style of the selected layers only. (changes the picture) |
| `toggle-mask` | Toggle Mask |  | Disables or enables the layer mask. (changes the picture) |
| `ungroup` | Ungroup Layers |  | Dissolves the selected folder and keeps its layers. (changes the picture) |
| `update-linked` | Update Modified Content |  | Updates linked smart objects whose files changed. (changes the picture) |
| `video-delete-frame` | Delete Frame |  | Removes the playhead frame from the video layer. (changes the picture) |
| `video-duplicate-frame` | Duplicate Frame |  | Copies the playhead frame of the video layer after itself. (changes the picture) |
| `video-insert-blank-frame` | Insert Blank Frame |  | Inserts an empty frame after the playhead in the video layer. (changes the picture) |
| `video-interpret-footage` | Interpret Footage... |  | Sets the active video layer's own frame rate, how many times it loops and how its alpha is read (straight, ignored, or premultiplied with a matte). (changes the picture) |
| `video-layer-blank` | New Blank Video Layer |  | Adds a video layer of empty frames the length of the timeline. (changes the picture) |
| `video-layer-from-file` | New Video Layer from File... |  | Adds a video file as a layer with one frame per video frame. (changes the picture) |
| `video-rasterize` | Rasterize Video Layer |  | Turns the video layer into a pixel layer of the playhead frame. (changes the picture) |
| `video-reload-frame` | Reload Frame... |  | Reads the playhead frame again from a clip or pictures you choose, painted frame and original both. (changes the picture) |
| `video-replace-footage` | Replace Footage... |  | Swaps the active video layer's footage for a chosen clip, keeping its place on the timeline. (changes the picture) |
| `video-restore-all` | Restore All Frames |  | Puts every frame of the video layer back to the footage as loaded. (changes the picture) |
| `video-restore-frame` | Restore Frame |  | Puts the playhead frame back to the footage as loaded. (changes the picture) |
| `video-show-altered` | Show Altered Video |  | Shows or hides the painted frames of the active video layer; hidden, the footage as loaded shows in their place and nothing is lost. (changes the picture) |
| `vmask-current-path` | Current Path |  | Makes a vector mask from the current path. (changes the picture) |
| `vmask-delete` | Delete |  | Deletes the vector mask. (changes the picture) |
| `vmask-enable` | Disable Vector Mask |  | Disables or enables the vector mask. (changes the picture) |
| `vmask-hide-all` | Hide All |  | Adds a vector mask hiding everything. (changes the picture) |
| `vmask-invert` | Invert Vector Mask |  | Swaps the shown and hidden parts of the vector mask. (changes the picture) |
| `vmask-link` | Unlink Vector Mask |  | Links or unlinks the vector mask. (changes the picture) |
| `vmask-reveal-all` | Reveal All |  | Adds a vector mask showing everything. (changes the picture) |

### layer.set parameters

- `id`: string; Layer id from the document; the active layer when omitted
- `name`: string; New name
- `visible`: boolean; Show or hide
- `opacity`: number 0 to 1; Opacity from 0 to 1
- `blend`: string; Blend mode
- `active`: boolean; Make it the active layer

### relight.apply parameters

- `look`: string; A ready-made Look; its lights are used unless lights is given
- `lights`: array; Up to 8 lights: [{type: point/spot/sun/area/strip/ring, kelvin (1000 to 12000) or color {r,g,b}, intensity, softness, diffusion, distance (0 close to 100 far), pos {x,y} and aim {x,y} as fractions of the canvas, near and far (0 to 100, the depth band lit), pattern {kind: none/blinds/strip/window/leaves/caustics/lattice/arch/dapple/circle, scale, width, slats, opening, length, feather, rotation, invert, center {x,y} where the pattern sits, the aim when omitted}}]
- `original`: number 0 to 100; Percent of the original lighting kept
- `shine`: number 0 to 100; Highlights on glossy forms
- `delight`: number 0 to 100; Percent of the original light and shade flattened before the new lights
- `shadows`: number 0 to 100; Strength of cast shadows (with the depth model)
- `roomOriginal`: number 0 to 100; Room light: percent of the room's own light kept around the subject (Original lighting when omitted)
- `roomLight`: number 0 to 200; Light on room: percent of the lights that reach the room around the subject
- `roomShadows`: number 0 to 100; Room shadows: strength of the subject's shadows on the room
- `roomDepth`: number 25 to 300; Room depth: percent of the solved distance between the subject and the room behind
- `ambient`: string; Color of the kept original light, like #ffe8d0
- `split`: string (auto | marigold | classic | off); How the photo's own light is taken out before the new lights: auto or classic (per-material shading, the subject's own detail kept), marigold (learned albedo, repaints surfaces, only when asked), or off (add light on top)

## Paint

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `paint.stroke` | Paint Stroke |  | Draws one stroke through the points with the active painting tool, its size, color and dynamics, on the active layer; one history step. (changes the picture) |

### paint.stroke parameters

- `points`: array; required; Points in document pixels: [{x, y, pressure?}] with pressure 0 to 1, or [x, y, pressure?] triples
- `tool`: string (brush | pencil | eraser | mixer | colorReplace | smear | dodge | burn | sponge); Painting tool to use; the active tool when omitted

## Paths

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `clipping-path` | Clipping Path... |  | Opens the dialog that marks a saved path as the clipping path, with a flatness. (changes the picture) |
| `delete-path` | Delete Path |  | Deletes the current path. (changes the picture) |
| `fill-path` | Fill Path |  | Fills the path with the foreground color. (changes the picture) |
| `fill-path-dialog` | Fill Path... |  | Opens Fill Path. (changes the picture) |
| `new-path` | New Path |  | Starts a new empty path. (changes the picture) |
| `new-shape-path` | New Shape Layer from Path |  | Makes a shape layer from the current path. (changes the picture) |
| `path-fill-rule` | Path Fill Rule: Even-Odd |  | Switches the current path between the non-zero and the even-odd fill rule, which decides which overlapping areas are inside when it is filled, stroked or made a selection. (changes the picture) |
| `path-selection` | Make Selection from Path | Mod+Enter | Makes a selection from the current path, with an optional feather radius, anti-alias choice and operation (replace, add, subtract, intersect). (changes the picture) |
| `path-selection-dialog` | Make Selection from Path... |  | Opens Make Selection from Path, with Feather Radius, Anti-aliased and the operation. (changes the picture) |
| `selection-to-work-path` | Make Work Path from Selection |  | Traces the selection's outline into the Work Path in the Paths panel, simplified within a tolerance in pixels. (changes the picture) |
| `stroke-path` | Stroke Path |  | Strokes the path with the current brush. (changes the picture) |
| `stroke-path-dialog` | Stroke Path... |  | Opens Stroke Path. (changes the picture) |

## Select

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `auto-select-sample-all` | Sample All Layers |  | Toggles whether Subject, Sky and Object in Selection look at the whole picture or the active layer alone. |
| `border` | Border... |  | Opens Border to select a band along the edge. (changes the picture) |
| `channel-down` | Move Channel Down |  | Moves a channel one place down the list. (changes the picture) |
| `channel-options` | Channel Options... |  | Sets a channel name, overlay color and opacity. (changes the picture) |
| `channel-up` | Move Channel Up |  | Moves a channel one place up the list. (changes the picture) |
| `color-range` | Color Range... |  | Opens Color Range. (changes the picture) |
| `contract` | Contract by 1 px... |  | Contracts the selection by the given pixels, or opens Contract when none are given. (changes the picture) |
| `convert-to-shape` | Convert to Shape |  | Turns the selection into a shape layer. (changes the picture) |
| `convert-to-shape-tolerance` | Convert to Shape Tolerance... |  | Asks for a Tolerance, then turns the selection into a shape layer with that much simplifying. (changes the picture) |
| `deselect` | Deselect | Mod+D | Clears the selection. (changes the picture) |
| `duplicate-channel` | Duplicate Channel |  | Copies a channel. (changes the picture) |
| `expand` | Expand by 1 px... |  | Expands the selection by the given pixels, or opens Expand when none are given. (changes the picture) |
| `feather` | Feather... | Shift+F6 | Softens the selection edge by the given radius, or opens Feather when none is given. (changes the picture) |
| `focus-area` | Focus Area... |  | Selects what is in focus; with range, noise, soften, mode or sampleAll it runs at once, without them it opens the Focus Area dialog. (changes the picture) |
| `grow` | Grow |  | Grows the selection over similar neighboring colors. (changes the picture) |
| `inverse` | Inverse | Shift+Mod+I | Inverts the selection. (changes the picture) |
| `layer-pixels` | Layer's Pixels |  | Selects the layer's non-transparent pixels. (changes the picture) |
| `load-luminosity` | Load Luminosity | Alt+Mod+2 | Selects the picture by its brightness. (changes the picture) |
| `load-selection` | Load Selection... |  | Opens the dialog that loads a saved selection. (changes the picture) |
| `load-selection-vector-mask` | Vector Mask to Selection |  | Turns the layer's vector mask into a selection. (changes the picture) |
| `mask-black` | Mask's Black Areas |  | Selects the mask's black areas. (changes the picture) |
| `new-channel` | New Channel |  | Adds an empty channel, black or white. (changes the picture) |
| `new-spot-channel` | New Spot Channel |  | Adds a spot channel with an ink color and a solidity; opens Channel Options when given no parameters. (changes the picture) |
| `quick-mask` | Edit in Quick Mask Mode | Q | Turns Quick Mask on or off; painting in it makes the selection. (changes the picture) |
| `reselect` | Reselect |  | Brings back the last selection. (changes the picture) |
| `save-selection` | Save Selection... |  | Opens the dialog that saves the selection to a channel. (changes the picture) |
| `save-selection-channel` | Save Selection as Channel |  | Saves the selection as a new channel. (changes the picture) |
| `select-all` | All | Mod+A | Selects the whole canvas. (changes the picture) |
| `select-and-mask` | Select and Mask... | Alt+Mod+R | Opens Select and Mask on the main canvas: view modes, refine tools on the picture and the properties beside it, applied as one step; a dialog where the workspace cannot open. (changes the picture) |
| `select-and-mask-dialog` | Select and Mask Dialog... |  | Opens Select and Mask as a dialog with its own preview instead of on the main canvas. (changes the picture) |
| `select-by-depth` | Select by Depth... |  | Selects the pixels between a far and a near depth of the document's shared depth map, with a feather, combined with the selection as asked. (changes the picture) |
| `select-color-range` | Select Color Range |  | Selects by sampled color, hue family, tone, skin tones or the Depth Map layer, combined with the selection as asked. (changes the picture) |
| `select-drop` | Drop Floating Pixels |  | Drops the floating selection onto its layer as one step. (changes the picture) |
| `select-float` | Float Selected Pixels |  | Lifts the selected pixels of the active layer into a floating selection that takes the Move tool's handles, until dropped. (changes the picture) |
| `select-object` | Object in Selection |  | Selects the object inside the current selection. (changes the picture) |
| `select-sky` | Sky |  | Selects the sky. (changes the picture) |
| `select-subject` | Subject |  | Selects the main subject. (changes the picture) |
| `select-subject-text` | Subject by Text... |  | Opens Subject by Text: name what to select and the fal segmentation model returns the mask, which becomes the selection. (changes the picture) |
| `select.ellipse` | Elliptical Selection |  | Selects the ellipse inside a box in document pixels. (changes the picture) |
| `select.lasso` | Lasso Selection |  | Selects the polygon through the points. (changes the picture) |
| `select.rect` | Rectangular Selection |  | Selects a rectangle in document pixels. (changes the picture) |
| `similar` | Similar |  | Selects all pixels in the picture similar to the selection. (changes the picture) |
| `sky-sensitivity` | Sky Sensitivity... |  | Asks for Sky's Sensitivity, how readily faint sky counts. |
| `sky-softness` | Sky Edge Softness... |  | Asks for the edge softness Select Sky feathers by. |
| `smooth` | Smooth... |  | Opens Smooth to round the selection corners. (changes the picture) |
| `transform-selection` | Transform Selection |  | Starts transforming the selection outline. (changes the picture) |
| `transform-selection-numeric` | Transform Selection Numerically... |  | Skews, puts in perspective, distorts to four corners or carries the selection outline through a matrix about a reference point, from numbers (ref, moveX, moveY, scaleX, scaleY, angle, skewH, skewV, perspH, perspV, matrix, quad); without arguments it opens the dialog. (changes the picture) |

### select.ellipse parameters

- `x`: number -30000 to 60000; required; Left edge in document pixels
- `y`: number -30000 to 60000; required; Top edge in document pixels
- `width`: number 1 to 60000; required; Width in pixels
- `height`: number 1 to 60000; required; Height in pixels
- `mode`: string (replace | add | subtract | intersect); How the new selection combines with the current one; replace by default

### select.lasso parameters

- `points`: array; required; Corners of the polygon, at least 3: [{x, y}] or [x, y] pairs
- `mode`: string (replace | add | subtract | intersect); How the new selection combines with the current one; replace by default
- `antialias`: boolean; Smooth the edge; true by default

### select.rect parameters

- `x`: number -30000 to 60000; required; Left edge in document pixels
- `y`: number -30000 to 60000; required; Top edge in document pixels
- `width`: number 1 to 60000; required; Width in pixels
- `height`: number 1 to 60000; required; Height in pixels
- `mode`: string (replace | add | subtract | intersect); How the new selection combines with the current one; replace by default

## Tool options

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `tool.options.artHistory.hardness` | Art History Brush: Hardness |  | Sets Hardness for the Art History Brush tool. |
| `tool.options.artHistory.maskPaint` | Art History Brush: Mask paint |  | Sets Mask paint for the Art History Brush tool. |
| `tool.options.artHistory.opacity` | Art History Brush: Opacity |  | Sets Opacity for the Art History Brush tool. |
| `tool.options.artHistory.pressureCurve` | Art History Brush: Pressure curve |  | Sets Pressure curve for the Art History Brush tool. |
| `tool.options.artHistory.pressureOpacity` | Art History Brush: Pressure: opacity |  | Sets Pressure: opacity for the Art History Brush tool. |
| `tool.options.artHistory.pressureSize` | Art History Brush: Pressure: size |  | Sets Pressure: size for the Art History Brush tool. |
| `tool.options.artHistory.size` | Art History Brush: Size |  | Sets Size for the Art History Brush tool. |
| `tool.options.artHistory.style` | Art History Brush: Style |  | Sets Style for the Art History Brush tool. |
| `tool.options.artHistory.symmetry` | Art History Brush: Symmetry |  | Sets Symmetry for the Art History Brush tool. |
| `tool.options.artHistory.symmetryX` | Art History Brush: Symmetry X |  | Sets Symmetry X for the Art History Brush tool. |
| `tool.options.artHistory.symmetryY` | Art History Brush: Symmetry Y |  | Sets Symmetry Y for the Art History Brush tool. |
| `tool.options.artHistory.tolerance` | Art History Brush: Tolerance |  | Sets Tolerance for the Art History Brush tool. |
| `tool.options.artboard.height` | Artboard: Height |  | Sets Height for the Artboard tool. |
| `tool.options.artboard.orientation` | Artboard: Orientation |  | Sets Orientation for the Artboard tool. |
| `tool.options.artboard.size` | Artboard: Size |  | Sets Size for the Artboard tool. |
| `tool.options.artboard.width` | Artboard: Width |  | Sets Width for the Artboard tool. |
| `tool.options.backgroundEraser.hardness` | Background Eraser: Hardness |  | Sets Hardness for the Background Eraser tool. |
| `tool.options.backgroundEraser.limits` | Background Eraser: Limits |  | Sets Limits for the Background Eraser tool. |
| `tool.options.backgroundEraser.maskPaint` | Background Eraser: Mask paint |  | Sets Mask paint for the Background Eraser tool. |
| `tool.options.backgroundEraser.protectForegroundColor` | Background Eraser: Protect Foreground Color |  | Sets Protect Foreground Color for the Background Eraser tool. |
| `tool.options.backgroundEraser.sampling` | Background Eraser: Sampling |  | Sets Sampling for the Background Eraser tool. |
| `tool.options.backgroundEraser.size` | Background Eraser: Size |  | Sets Size for the Background Eraser tool. |
| `tool.options.backgroundEraser.symmetry` | Background Eraser: Symmetry |  | Sets Symmetry for the Background Eraser tool. |
| `tool.options.backgroundEraser.symmetryX` | Background Eraser: Symmetry X |  | Sets Symmetry X for the Background Eraser tool. |
| `tool.options.backgroundEraser.symmetryY` | Background Eraser: Symmetry Y |  | Sets Symmetry Y for the Background Eraser tool. |
| `tool.options.backgroundEraser.tolerance` | Background Eraser: Tolerance |  | Sets Tolerance for the Background Eraser tool. |
| `tool.options.boxes.kind` | Boxes: Kind |  | Sets Kind for the Boxes tool. |
| `tool.options.brush.adjustForZoom` | Brush: Adjust for zoom |  | Sets Adjust for zoom for the Brush tool. |
| `tool.options.brush.airbrush` | Brush: Airbrush |  | Sets Airbrush for the Brush tool. |
| `tool.options.brush.angle` | Brush: Angle |  | Sets Angle for the Brush tool. |
| `tool.options.brush.angleJitter` | Brush: Angle jitter |  | Sets Angle jitter for the Brush tool. |
| `tool.options.brush.buildUpInterval` | Brush: Build-up interval |  | Sets Build-up interval for the Brush tool. |
| `tool.options.brush.catchUpOnStrokeEnd` | Brush: Catch-up on stroke end |  | Sets Catch-up on stroke end for the Brush tool. |
| `tool.options.brush.count` | Brush: Count |  | Sets Count for the Brush tool. |
| `tool.options.brush.flipX` | Brush: Flip X |  | Sets Flip X for the Brush tool. |
| `tool.options.brush.flipY` | Brush: Flip Y |  | Sets Flip Y for the Brush tool. |
| `tool.options.brush.flow` | Brush: Flow |  | Sets Flow for the Brush tool. |
| `tool.options.brush.hardness` | Brush: Hardness |  | Sets Hardness for the Brush tool. |
| `tool.options.brush.importMode` | Brush: Import mode |  | Sets Import mode for the Brush tool. |
| `tool.options.brush.maskPaint` | Brush: Mask paint |  | Sets Mask paint for the Brush tool. |
| `tool.options.brush.minFlow` | Brush: Min flow |  | Sets Min flow for the Brush tool. |
| `tool.options.brush.minSize` | Brush: Min size |  | Sets Min size for the Brush tool. |
| `tool.options.brush.mode` | Brush: Mode |  | Sets Mode for the Brush tool. |
| `tool.options.brush.noise` | Brush: Noise |  | Sets Noise for the Brush tool. |
| `tool.options.brush.opacity` | Brush: Opacity |  | Sets Opacity for the Brush tool. |
| `tool.options.brush.preset` | Brush: Preset |  | Sets Preset for the Brush tool. |
| `tool.options.brush.pressureCurve` | Brush: Pressure curve |  | Sets Pressure curve for the Brush tool. |
| `tool.options.brush.pressureFlow` | Brush: Pressure: flow |  | Sets Pressure: flow for the Brush tool. |
| `tool.options.brush.pressureOpacity` | Brush: Pressure: opacity |  | Sets Pressure: opacity for the Brush tool. |
| `tool.options.brush.pressureSize` | Brush: Pressure: size |  | Sets Pressure: size for the Brush tool. |
| `tool.options.brush.quickShape` | Brush: Quick Shape |  | Sets Quick Shape for the Brush tool. |
| `tool.options.brush.rightClick` | Brush: Right-click |  | Sets Right-click for the Brush tool. |
| `tool.options.brush.roundness` | Brush: Roundness |  | Sets Roundness for the Brush tool. |
| `tool.options.brush.scatter` | Brush: Scatter |  | Sets Scatter for the Brush tool. |
| `tool.options.brush.selectFirstOnImport` | Brush: Select first on import |  | Sets Select first on import for the Brush tool. |
| `tool.options.brush.size` | Brush: Size |  | Sets Size for the Brush tool. |
| `tool.options.brush.sizeJitter` | Brush: Size jitter |  | Sets Size jitter for the Brush tool. |
| `tool.options.brush.smoothing` | Brush: Smoothing |  | Sets Smoothing for the Brush tool. |
| `tool.options.brush.smoothingMode` | Brush: Smoothing mode |  | Sets Smoothing mode for the Brush tool. |
| `tool.options.brush.spacing` | Brush: Spacing |  | Sets Spacing for the Brush tool. |
| `tool.options.brush.symmetry` | Brush: Symmetry |  | Sets Symmetry for the Brush tool. |
| `tool.options.brush.symmetryX` | Brush: Symmetry X |  | Sets Symmetry X for the Brush tool. |
| `tool.options.brush.symmetryY` | Brush: Symmetry Y |  | Sets Symmetry Y for the Brush tool. |
| `tool.options.brush.wetEdges` | Brush: Wet edges |  | Sets Wet edges for the Brush tool. |
| `tool.options.bucket.antiAlias` | Paint Bucket: Anti-alias |  | Sets Anti-alias for the Paint Bucket tool. |
| `tool.options.bucket.contiguous` | Paint Bucket: Contiguous |  | Sets Contiguous for the Paint Bucket tool. |
| `tool.options.bucket.mode` | Paint Bucket: Mode |  | Sets Mode for the Paint Bucket tool. |
| `tool.options.bucket.opacity` | Paint Bucket: Opacity |  | Sets Opacity for the Paint Bucket tool. |
| `tool.options.bucket.pattern` | Paint Bucket: Pattern |  | Sets Pattern for the Paint Bucket tool. |
| `tool.options.bucket.patternAngle` | Paint Bucket: Pattern angle |  | Sets Pattern angle for the Paint Bucket tool. |
| `tool.options.bucket.patternScale` | Paint Bucket: Pattern scale |  | Sets Pattern scale for the Paint Bucket tool. |
| `tool.options.bucket.sampleAllLayers` | Paint Bucket: Sample all layers |  | Sets Sample all layers for the Paint Bucket tool. |
| `tool.options.bucket.source` | Paint Bucket: Source |  | Sets Source for the Paint Bucket tool. |
| `tool.options.bucket.tolerance` | Paint Bucket: Tolerance |  | Sets Tolerance for the Paint Bucket tool. |
| `tool.options.burn.exposure` | Burn: Exposure |  | Sets Exposure for the Burn tool. |
| `tool.options.burn.hardness` | Burn: Hardness |  | Sets Hardness for the Burn tool. |
| `tool.options.burn.maskPaint` | Burn: Mask paint |  | Sets Mask paint for the Burn tool. |
| `tool.options.burn.pressureCurve` | Burn: Pressure curve |  | Sets Pressure curve for the Burn tool. |
| `tool.options.burn.pressureOpacity` | Burn: Pressure: opacity |  | Sets Pressure: opacity for the Burn tool. |
| `tool.options.burn.pressureSize` | Burn: Pressure: size |  | Sets Pressure: size for the Burn tool. |
| `tool.options.burn.protectTones` | Burn: Protect Tones |  | Sets Protect Tones for the Burn tool. |
| `tool.options.burn.range` | Burn: Range |  | Sets Range for the Burn tool. |
| `tool.options.burn.sample` | Burn: Sample |  | Sets Sample for the Burn tool. |
| `tool.options.burn.size` | Burn: Size |  | Sets Size for the Burn tool. |
| `tool.options.burn.strength` | Burn: Strength |  | Sets Strength for the Burn tool. |
| `tool.options.burn.symmetry` | Burn: Symmetry |  | Sets Symmetry for the Burn tool. |
| `tool.options.burn.symmetryX` | Burn: Symmetry X |  | Sets Symmetry X for the Burn tool. |
| `tool.options.burn.symmetryY` | Burn: Symmetry Y |  | Sets Symmetry Y for the Burn tool. |
| `tool.options.cloneStamp.aligned` | Clone Stamp: Aligned |  | Sets Aligned for the Clone Stamp tool. |
| `tool.options.cloneStamp.autoHide` | Clone Stamp: Auto Hide |  | Sets Auto Hide for the Clone Stamp tool. |
| `tool.options.cloneStamp.clipped` | Clone Stamp: Clipped |  | Sets Clipped for the Clone Stamp tool. |
| `tool.options.cloneStamp.flipHorizontal` | Clone Stamp: Flip horizontal |  | Sets Flip horizontal for the Clone Stamp tool. |
| `tool.options.cloneStamp.flipVertical` | Clone Stamp: Flip vertical |  | Sets Flip vertical for the Clone Stamp tool. |
| `tool.options.cloneStamp.flow` | Clone Stamp: Flow |  | Sets Flow for the Clone Stamp tool. |
| `tool.options.cloneStamp.hardness` | Clone Stamp: Hardness |  | Sets Hardness for the Clone Stamp tool. |
| `tool.options.cloneStamp.invertOverlay` | Clone Stamp: Invert Overlay |  | Sets Invert Overlay for the Clone Stamp tool. |
| `tool.options.cloneStamp.maskPaint` | Clone Stamp: Mask paint |  | Sets Mask paint for the Clone Stamp tool. |
| `tool.options.cloneStamp.mode` | Clone Stamp: Mode |  | Sets Mode for the Clone Stamp tool. |
| `tool.options.cloneStamp.opacity` | Clone Stamp: Opacity |  | Sets Opacity for the Clone Stamp tool. |
| `tool.options.cloneStamp.overlayMode` | Clone Stamp: Overlay mode |  | Sets Overlay mode for the Clone Stamp tool. |
| `tool.options.cloneStamp.overlayOpacity` | Clone Stamp: Overlay opacity |  | Sets Overlay opacity for the Clone Stamp tool. |
| `tool.options.cloneStamp.pressureCurve` | Clone Stamp: Pressure curve |  | Sets Pressure curve for the Clone Stamp tool. |
| `tool.options.cloneStamp.pressureOpacity` | Clone Stamp: Pressure: opacity |  | Sets Pressure: opacity for the Clone Stamp tool. |
| `tool.options.cloneStamp.pressureSize` | Clone Stamp: Pressure: size |  | Sets Pressure: size for the Clone Stamp tool. |
| `tool.options.cloneStamp.sample` | Clone Stamp: Sample |  | Sets Sample for the Clone Stamp tool. |
| `tool.options.cloneStamp.showOverlay` | Clone Stamp: Show Overlay |  | Sets Show Overlay for the Clone Stamp tool. |
| `tool.options.cloneStamp.size` | Clone Stamp: Size |  | Sets Size for the Clone Stamp tool. |
| `tool.options.cloneStamp.source` | Clone Stamp: Source |  | Sets Source for the Clone Stamp tool. |
| `tool.options.cloneStamp.sourceAngle` | Clone Stamp: Source angle |  | Sets Source angle for the Clone Stamp tool. |
| `tool.options.cloneStamp.sourceScale` | Clone Stamp: Source scale |  | Sets Source scale for the Clone Stamp tool. |
| `tool.options.cloneStamp.symmetry` | Clone Stamp: Symmetry |  | Sets Symmetry for the Clone Stamp tool. |
| `tool.options.cloneStamp.symmetryX` | Clone Stamp: Symmetry X |  | Sets Symmetry X for the Clone Stamp tool. |
| `tool.options.cloneStamp.symmetryY` | Clone Stamp: Symmetry Y |  | Sets Symmetry Y for the Clone Stamp tool. |
| `tool.options.colorReplace.hardness` | Color Replacement: Hardness |  | Sets Hardness for the Color Replacement tool. |
| `tool.options.colorReplace.maskPaint` | Color Replacement: Mask paint |  | Sets Mask paint for the Color Replacement tool. |
| `tool.options.colorReplace.mode` | Color Replacement: Mode |  | Sets Mode for the Color Replacement tool. |
| `tool.options.colorReplace.opacity` | Color Replacement: Opacity |  | Sets Opacity for the Color Replacement tool. |
| `tool.options.colorReplace.pressureCurve` | Color Replacement: Pressure curve |  | Sets Pressure curve for the Color Replacement tool. |
| `tool.options.colorReplace.pressureOpacity` | Color Replacement: Pressure: opacity |  | Sets Pressure: opacity for the Color Replacement tool. |
| `tool.options.colorReplace.pressureSize` | Color Replacement: Pressure: size |  | Sets Pressure: size for the Color Replacement tool. |
| `tool.options.colorReplace.sampling` | Color Replacement: Sampling |  | Sets Sampling for the Color Replacement tool. |
| `tool.options.colorReplace.size` | Color Replacement: Size |  | Sets Size for the Color Replacement tool. |
| `tool.options.colorReplace.symmetry` | Color Replacement: Symmetry |  | Sets Symmetry for the Color Replacement tool. |
| `tool.options.colorReplace.symmetryX` | Color Replacement: Symmetry X |  | Sets Symmetry X for the Color Replacement tool. |
| `tool.options.colorReplace.symmetryY` | Color Replacement: Symmetry Y |  | Sets Symmetry Y for the Color Replacement tool. |
| `tool.options.colorReplace.tolerance` | Color Replacement: Tolerance |  | Sets Tolerance for the Color Replacement tool. |
| `tool.options.colorSampler.sampleSize` | Color Sampler: Sample Size |  | Sets Sample Size for the Color Sampler tool. |
| `tool.options.contentAwareMove.angle` | Content-Aware Move: Angle |  | Sets Angle for the Content-Aware Move tool. |
| `tool.options.contentAwareMove.blend` | Content-Aware Move: Blend |  | Sets Blend for the Content-Aware Move tool. |
| `tool.options.contentAwareMove.color` | Content-Aware Move: Color |  | Sets Color for the Content-Aware Move tool. |
| `tool.options.contentAwareMove.flipHorizontal` | Content-Aware Move: Flip horizontal |  | Sets Flip horizontal for the Content-Aware Move tool. |
| `tool.options.contentAwareMove.flipVertical` | Content-Aware Move: Flip vertical |  | Sets Flip vertical for the Content-Aware Move tool. |
| `tool.options.contentAwareMove.mode` | Content-Aware Move: Mode |  | Sets Mode for the Content-Aware Move tool. |
| `tool.options.contentAwareMove.sampleAllLayers` | Content-Aware Move: Sample All Layers |  | Sets Sample All Layers for the Content-Aware Move tool. |
| `tool.options.contentAwareMove.scale` | Content-Aware Move: Scale |  | Sets Scale for the Content-Aware Move tool. |
| `tool.options.contentAwareMove.structure` | Content-Aware Move: Structure |  | Sets Structure for the Content-Aware Move tool. |
| `tool.options.contentAwareMove.transformOnDrop` | Content-Aware Move: Transform On Drop |  | Sets Transform On Drop for the Content-Aware Move tool. |
| `tool.options.count.group` | Count: Group |  | Sets Group for the Count tool. |
| `tool.options.count.groupColor` | Count: Group Color |  | Sets Group Color for the Count tool. |
| `tool.options.count.hideGroup` | Count: Hide Group |  | Sets Hide Group for the Count tool. |
| `tool.options.count.labelSize` | Count: Label Size |  | Sets Label Size for the Count tool. |
| `tool.options.count.markerSize` | Count: Marker Size |  | Sets Marker Size for the Count tool. |
| `tool.options.crop.autoAdjustOpacity` | Crop: Auto Adjust Opacity |  | Sets Auto Adjust Opacity for the Crop tool. |
| `tool.options.crop.classicMode` | Crop: Classic Mode |  | Sets Classic Mode for the Crop tool. |
| `tool.options.crop.contentAware` | Crop: Content-Aware |  | Sets Content-Aware for the Crop tool. |
| `tool.options.crop.deleteCroppedPixels` | Crop: Delete Cropped Pixels |  | Sets Delete Cropped Pixels for the Crop tool. |
| `tool.options.crop.fill` | Crop: Fill |  | Sets Fill for the Crop tool. |
| `tool.options.crop.h` | Crop: H |  | Sets H for the Crop tool. |
| `tool.options.crop.overlay` | Crop: Overlay |  | Sets Overlay for the Crop tool. |
| `tool.options.crop.perspective` | Crop: Perspective |  | Sets Perspective for the Crop tool. |
| `tool.options.crop.preset` | Crop: Preset |  | Sets Preset for the Crop tool. |
| `tool.options.crop.ratio` | Crop: Ratio |  | Sets Ratio for the Crop tool. |
| `tool.options.crop.ratioH` | Crop: Ratio H |  | Sets Ratio H for the Crop tool. |
| `tool.options.crop.ratioW` | Crop: Ratio W |  | Sets Ratio W for the Crop tool. |
| `tool.options.crop.resolution` | Crop: Resolution |  | Sets Resolution for the Crop tool. |
| `tool.options.crop.shieldColor` | Crop: Shield color |  | Sets Shield color for the Crop tool. |
| `tool.options.crop.shieldOpacity` | Crop: Shield opacity |  | Sets Shield opacity for the Crop tool. |
| `tool.options.crop.showCroppedArea` | Crop: Show Cropped Area |  | Sets Show Cropped Area for the Crop tool. |
| `tool.options.crop.showOverlay` | Crop: Show overlay |  | Sets Show overlay for the Crop tool. |
| `tool.options.crop.snapGrid` | Crop: Snap grid |  | Sets Snap grid for the Crop tool. |
| `tool.options.crop.straighten` | Crop: Straighten |  | Sets Straighten for the Crop tool. |
| `tool.options.crop.unit` | Crop: Unit |  | Sets Unit for the Crop tool. |
| `tool.options.crop.w` | Crop: W |  | Sets W for the Crop tool. |
| `tool.options.dodge.exposure` | Dodge: Exposure |  | Sets Exposure for the Dodge tool. |
| `tool.options.dodge.hardness` | Dodge: Hardness |  | Sets Hardness for the Dodge tool. |
| `tool.options.dodge.maskPaint` | Dodge: Mask paint |  | Sets Mask paint for the Dodge tool. |
| `tool.options.dodge.pressureCurve` | Dodge: Pressure curve |  | Sets Pressure curve for the Dodge tool. |
| `tool.options.dodge.pressureOpacity` | Dodge: Pressure: opacity |  | Sets Pressure: opacity for the Dodge tool. |
| `tool.options.dodge.pressureSize` | Dodge: Pressure: size |  | Sets Pressure: size for the Dodge tool. |
| `tool.options.dodge.protectTones` | Dodge: Protect Tones |  | Sets Protect Tones for the Dodge tool. |
| `tool.options.dodge.range` | Dodge: Range |  | Sets Range for the Dodge tool. |
| `tool.options.dodge.sample` | Dodge: Sample |  | Sets Sample for the Dodge tool. |
| `tool.options.dodge.size` | Dodge: Size |  | Sets Size for the Dodge tool. |
| `tool.options.dodge.strength` | Dodge: Strength |  | Sets Strength for the Dodge tool. |
| `tool.options.dodge.symmetry` | Dodge: Symmetry |  | Sets Symmetry for the Dodge tool. |
| `tool.options.dodge.symmetryX` | Dodge: Symmetry X |  | Sets Symmetry X for the Dodge tool. |
| `tool.options.dodge.symmetryY` | Dodge: Symmetry Y |  | Sets Symmetry Y for the Dodge tool. |
| `tool.options.eraser.eraseToHistory` | Eraser: Erase to History |  | Sets Erase to History for the Eraser tool. |
| `tool.options.eraser.flow` | Eraser: Flow |  | Sets Flow for the Eraser tool. |
| `tool.options.eraser.hardness` | Eraser: Hardness |  | Sets Hardness for the Eraser tool. |
| `tool.options.eraser.maskPaint` | Eraser: Mask paint |  | Sets Mask paint for the Eraser tool. |
| `tool.options.eraser.mode` | Eraser: Mode |  | Sets Mode for the Eraser tool. |
| `tool.options.eraser.opacity` | Eraser: Opacity |  | Sets Opacity for the Eraser tool. |
| `tool.options.eraser.pressureCurve` | Eraser: Pressure curve |  | Sets Pressure curve for the Eraser tool. |
| `tool.options.eraser.pressureOpacity` | Eraser: Pressure: opacity |  | Sets Pressure: opacity for the Eraser tool. |
| `tool.options.eraser.pressureSize` | Eraser: Pressure: size |  | Sets Pressure: size for the Eraser tool. |
| `tool.options.eraser.quickShape` | Eraser: Quick Shape |  | Sets Quick Shape for the Eraser tool. |
| `tool.options.eraser.size` | Eraser: Size |  | Sets Size for the Eraser tool. |
| `tool.options.eraser.symmetry` | Eraser: Symmetry |  | Sets Symmetry for the Eraser tool. |
| `tool.options.eraser.symmetryX` | Eraser: Symmetry X |  | Sets Symmetry X for the Eraser tool. |
| `tool.options.eraser.symmetryY` | Eraser: Symmetry Y |  | Sets Symmetry Y for the Eraser tool. |
| `tool.options.eyedropper.sample` | Eyedropper: Sample |  | Sets Sample for the Eyedropper tool. |
| `tool.options.eyedropper.sampleRing` | Eyedropper: Sample Ring |  | Sets Sample Ring for the Eyedropper tool. |
| `tool.options.eyedropper.sampleSize` | Eyedropper: Sample Size |  | Sets Sample Size for the Eyedropper tool. |
| `tool.options.frame.shape` | Frame: Shape |  | Sets Shape for the Frame tool. |
| `tool.options.freeformPen.contrast` | Freeform Pen: Contrast |  | Sets Contrast for the Freeform Pen tool. |
| `tool.options.freeformPen.curveFit` | Freeform Pen: Curve fit |  | Sets Curve fit for the Freeform Pen tool. |
| `tool.options.freeformPen.magnetic` | Freeform Pen: Magnetic |  | Sets Magnetic for the Freeform Pen tool. |
| `tool.options.freeformPen.width` | Freeform Pen: Width |  | Sets Width for the Freeform Pen tool. |
| `tool.options.gradient.colors` | Gradient: Colors |  | Sets Colors for the Gradient tool. |
| `tool.options.gradient.dither` | Gradient: Dither |  | Sets Dither for the Gradient tool. |
| `tool.options.gradient.liveFillLayer` | Gradient: Live Fill Layer |  | Sets Live Fill Layer for the Gradient tool. |
| `tool.options.gradient.method` | Gradient: Method |  | Sets Method for the Gradient tool. |
| `tool.options.gradient.mode` | Gradient: Mode |  | Sets Mode for the Gradient tool. |
| `tool.options.gradient.opacity` | Gradient: Opacity |  | Sets Opacity for the Gradient tool. |
| `tool.options.gradient.reverse` | Gradient: Reverse |  | Sets Reverse for the Gradient tool. |
| `tool.options.gradient.shape` | Gradient: Shape |  | Sets Shape for the Gradient tool. |
| `tool.options.gradient.smoothness` | Gradient: Smoothness |  | Sets Smoothness for the Gradient tool. |
| `tool.options.gradient.transparency` | Gradient: Transparency |  | Sets Transparency for the Gradient tool. |
| `tool.options.hand.scrollAllWindows` | Hand: Scroll All Windows |  | Sets Scroll All Windows for the Hand tool. |
| `tool.options.healingBrush.aligned` | Healing Brush: Aligned |  | Sets Aligned for the Healing Brush tool. |
| `tool.options.healingBrush.diffusion` | Healing Brush: Diffusion |  | Sets Diffusion for the Healing Brush tool. |
| `tool.options.healingBrush.hardness` | Healing Brush: Hardness |  | Sets Hardness for the Healing Brush tool. |
| `tool.options.healingBrush.maskPaint` | Healing Brush: Mask paint |  | Sets Mask paint for the Healing Brush tool. |
| `tool.options.healingBrush.mode` | Healing Brush: Mode |  | Sets Mode for the Healing Brush tool. |
| `tool.options.healingBrush.opacity` | Healing Brush: Opacity |  | Sets Opacity for the Healing Brush tool. |
| `tool.options.healingBrush.pattern` | Healing Brush: Pattern |  | Sets Pattern for the Healing Brush tool. |
| `tool.options.healingBrush.pressureCurve` | Healing Brush: Pressure curve |  | Sets Pressure curve for the Healing Brush tool. |
| `tool.options.healingBrush.pressureOpacity` | Healing Brush: Pressure: opacity |  | Sets Pressure: opacity for the Healing Brush tool. |
| `tool.options.healingBrush.pressureSize` | Healing Brush: Pressure: size |  | Sets Pressure: size for the Healing Brush tool. |
| `tool.options.healingBrush.sample` | Healing Brush: Sample |  | Sets Sample for the Healing Brush tool. |
| `tool.options.healingBrush.size` | Healing Brush: Size |  | Sets Size for the Healing Brush tool. |
| `tool.options.healingBrush.source` | Healing Brush: Source |  | Sets Source for the Healing Brush tool. |
| `tool.options.healingBrush.symmetry` | Healing Brush: Symmetry |  | Sets Symmetry for the Healing Brush tool. |
| `tool.options.healingBrush.symmetryX` | Healing Brush: Symmetry X |  | Sets Symmetry X for the Healing Brush tool. |
| `tool.options.healingBrush.symmetryY` | Healing Brush: Symmetry Y |  | Sets Symmetry Y for the Healing Brush tool. |
| `tool.options.historyBrush.hardness` | History Brush: Hardness |  | Sets Hardness for the History Brush tool. |
| `tool.options.historyBrush.maskPaint` | History Brush: Mask paint |  | Sets Mask paint for the History Brush tool. |
| `tool.options.historyBrush.opacity` | History Brush: Opacity |  | Sets Opacity for the History Brush tool. |
| `tool.options.historyBrush.pressureCurve` | History Brush: Pressure curve |  | Sets Pressure curve for the History Brush tool. |
| `tool.options.historyBrush.pressureOpacity` | History Brush: Pressure: opacity |  | Sets Pressure: opacity for the History Brush tool. |
| `tool.options.historyBrush.pressureSize` | History Brush: Pressure: size |  | Sets Pressure: size for the History Brush tool. |
| `tool.options.historyBrush.size` | History Brush: Size |  | Sets Size for the History Brush tool. |
| `tool.options.historyBrush.symmetry` | History Brush: Symmetry |  | Sets Symmetry for the History Brush tool. |
| `tool.options.historyBrush.symmetryX` | History Brush: Symmetry X |  | Sets Symmetry X for the History Brush tool. |
| `tool.options.historyBrush.symmetryY` | History Brush: Symmetry Y |  | Sets Symmetry Y for the History Brush tool. |
| `tool.options.lasso.antiAlias` | Lasso: Anti-alias |  | Sets Anti-alias for the Lasso tool. |
| `tool.options.lasso.feather` | Lasso: Feather |  | Sets Feather for the Lasso tool. |
| `tool.options.lasso.growBy` | Lasso: Grow by |  | Sets Grow by for the Lasso tool. |
| `tool.options.lasso.kind` | Lasso: Kind |  | Sets Kind for the Lasso tool. |
| `tool.options.lasso.mode` | Lasso: Mode |  | Sets Mode for the Lasso tool. |
| `tool.options.magicEraser.antiAlias` | Magic Eraser: Anti-alias |  | Sets Anti-alias for the Magic Eraser tool. |
| `tool.options.magicEraser.contiguous` | Magic Eraser: Contiguous |  | Sets Contiguous for the Magic Eraser tool. |
| `tool.options.magicEraser.opacity` | Magic Eraser: Opacity |  | Sets Opacity for the Magic Eraser tool. |
| `tool.options.magicEraser.sampleAllLayers` | Magic Eraser: Sample All Layers |  | Sets Sample All Layers for the Magic Eraser tool. |
| `tool.options.magicEraser.tolerance` | Magic Eraser: Tolerance |  | Sets Tolerance for the Magic Eraser tool. |
| `tool.options.markup.color` | Markup: Color |  | Sets Color for the Markup tool. |
| `tool.options.markup.mark` | Markup: Mark |  | Sets Mark for the Markup tool. |
| `tool.options.markup.width` | Markup: Width |  | Sets Width for the Markup tool. |
| `tool.options.marquee.antiAlias` | Marquee: Anti-alias |  | Sets Anti-alias for the Marquee tool. |
| `tool.options.marquee.feather` | Marquee: Feather |  | Sets Feather for the Marquee tool. |
| `tool.options.marquee.growBy` | Marquee: Grow by |  | Sets Grow by for the Marquee tool. |
| `tool.options.marquee.height` | Marquee: Height |  | Sets Height for the Marquee tool. |
| `tool.options.marquee.height2` | Marquee: Height |  | Sets Height for the Marquee tool. |
| `tool.options.marquee.mode` | Marquee: Mode |  | Sets Mode for the Marquee tool. |
| `tool.options.marquee.shape` | Marquee: Shape |  | Sets Shape for the Marquee tool. |
| `tool.options.marquee.style` | Marquee: Style |  | Sets Style for the Marquee tool. |
| `tool.options.marquee.width` | Marquee: Width |  | Sets Width for the Marquee tool. |
| `tool.options.marquee.width2` | Marquee: Width |  | Sets Width for the Marquee tool. |
| `tool.options.mixer.cleanTheBrushAfterEachStroke` | Mixer Brush: Clean the brush after each stroke |  | Sets Clean the brush after each stroke for the Mixer Brush tool. |
| `tool.options.mixer.flow` | Mixer Brush: Flow |  | Sets Flow for the Mixer Brush tool. |
| `tool.options.mixer.hardness` | Mixer Brush: Hardness |  | Sets Hardness for the Mixer Brush tool. |
| `tool.options.mixer.load` | Mixer Brush: Load |  | Sets Load for the Mixer Brush tool. |
| `tool.options.mixer.loadTheBrushAfterEachStroke` | Mixer Brush: Load the brush after each stroke |  | Sets Load the brush after each stroke for the Mixer Brush tool. |
| `tool.options.mixer.maskPaint` | Mixer Brush: Mask paint |  | Sets Mask paint for the Mixer Brush tool. |
| `tool.options.mixer.mix` | Mixer Brush: Mix |  | Sets Mix for the Mixer Brush tool. |
| `tool.options.mixer.opacity` | Mixer Brush: Opacity |  | Sets Opacity for the Mixer Brush tool. |
| `tool.options.mixer.pressureCurve` | Mixer Brush: Pressure curve |  | Sets Pressure curve for the Mixer Brush tool. |
| `tool.options.mixer.pressureOpacity` | Mixer Brush: Pressure: opacity |  | Sets Pressure: opacity for the Mixer Brush tool. |
| `tool.options.mixer.pressureSize` | Mixer Brush: Pressure: size |  | Sets Pressure: size for the Mixer Brush tool. |
| `tool.options.mixer.sampleAllLayers` | Mixer Brush: Sample All Layers |  | Sets Sample All Layers for the Mixer Brush tool. |
| `tool.options.mixer.size` | Mixer Brush: Size |  | Sets Size for the Mixer Brush tool. |
| `tool.options.mixer.symmetry` | Mixer Brush: Symmetry |  | Sets Symmetry for the Mixer Brush tool. |
| `tool.options.mixer.symmetryX` | Mixer Brush: Symmetry X |  | Sets Symmetry X for the Mixer Brush tool. |
| `tool.options.mixer.symmetryY` | Mixer Brush: Symmetry Y |  | Sets Symmetry Y for the Mixer Brush tool. |
| `tool.options.mixer.wet` | Mixer Brush: Wet |  | Sets Wet for the Mixer Brush tool. |
| `tool.options.move.alignTo` | Move: Align To |  | Sets Align To for the Move tool. |
| `tool.options.move.angle` | Move: Angle |  | Sets Angle for the Move tool. |
| `tool.options.move.autoSelect` | Move: Auto-Select |  | Sets Auto-Select for the Move tool. |
| `tool.options.move.autoSelectTarget` | Move: Auto-Select Target |  | Sets Auto-Select Target for the Move tool. |
| `tool.options.move.bend` | Move: Bend |  | Sets Bend for the Move tool. |
| `tool.options.move.expansion` | Move: Expansion |  | Sets Expansion for the Move tool. |
| `tool.options.move.h` | Move: H |  | Sets H for the Move tool. |
| `tool.options.move.horizontalDistortion` | Move: Horizontal distortion |  | Sets Horizontal distortion for the Move tool. |
| `tool.options.move.interpolation` | Move: Interpolation |  | Sets Interpolation for the Move tool. |
| `tool.options.move.keepProportions` | Move: Keep proportions |  | Sets Keep proportions for the Move tool. |
| `tool.options.move.perspectiveWarp` | Move: Perspective Warp |  | Sets Perspective Warp for the Move tool. |
| `tool.options.move.pinDepth` | Move: Pin depth |  | Sets Pin depth for the Move tool. |
| `tool.options.move.pinRotation` | Move: Pin rotation |  | Sets Pin rotation for the Move tool. |
| `tool.options.move.puppetDensity` | Move: Puppet density |  | Sets Puppet density for the Move tool. |
| `tool.options.move.puppetMode` | Move: Puppet mode |  | Sets Puppet mode for the Move tool. |
| `tool.options.move.referencePoint` | Move: Reference point |  | Sets Reference point for the Move tool. |
| `tool.options.move.scale` | Move: Scale |  | Sets Scale for the Move tool. |
| `tool.options.move.showMesh` | Move: Show mesh |  | Sets Show mesh for the Move tool. |
| `tool.options.move.showTransformControls` | Move: Show Transform Controls |  | Sets Show Transform Controls for the Move tool. |
| `tool.options.move.skewH` | Move: Skew H |  | Sets Skew H for the Move tool. |
| `tool.options.move.skewV` | Move: Skew V |  | Sets Skew V for the Move tool. |
| `tool.options.move.snap` | Move: Snap |  | Sets Snap for the Move tool. |
| `tool.options.move.verticalDistortion` | Move: Vertical distortion |  | Sets Vertical distortion for the Move tool. |
| `tool.options.move.w` | Move: W |  | Sets W for the Move tool. |
| `tool.options.move.warpDirection` | Move: Warp direction |  | Sets Warp direction for the Move tool. |
| `tool.options.move.warpGrid` | Move: Warp grid |  | Sets Warp grid for the Move tool. |
| `tool.options.move.warpStyle` | Move: Warp style |  | Sets Warp style for the Move tool. |
| `tool.options.move.x` | Move: X |  | Sets X for the Move tool. |
| `tool.options.move.y` | Move: Y |  | Sets Y for the Move tool. |
| `tool.options.objectSelect.antiAlias` | Object Selection: Anti-alias |  | Sets Anti-alias for the Object Selection tool. |
| `tool.options.objectSelect.edgeOffset` | Object Selection: Edge Offset |  | Sets Edge Offset for the Object Selection tool. |
| `tool.options.objectSelect.growBy` | Object Selection: Grow by |  | Sets Grow by for the Object Selection tool. |
| `tool.options.objectSelect.mode` | Object Selection: Mode |  | Sets Mode for the Object Selection tool. |
| `tool.options.objectSelect.objectFinder` | Object Selection: Object Finder |  | Sets Object Finder for the Object Selection tool. |
| `tool.options.objectSelect.sampleAllLayers` | Object Selection: Sample All Layers |  | Sets Sample All Layers for the Object Selection tool. |
| `tool.options.patch.color` | Patch: Color |  | Sets Color for the Patch tool. |
| `tool.options.patch.diffusion` | Patch: Diffusion |  | Sets Diffusion for the Patch tool. |
| `tool.options.patch.from` | Patch: From |  | Sets From for the Patch tool. |
| `tool.options.patch.patch` | Patch: Patch |  | Sets Patch for the Patch tool. |
| `tool.options.patch.pattern` | Patch: Pattern |  | Sets Pattern for the Patch tool. |
| `tool.options.patch.sampleAllLayers` | Patch: Sample All Layers |  | Sets Sample All Layers for the Patch tool. |
| `tool.options.patch.structure` | Patch: Structure |  | Sets Structure for the Patch tool. |
| `tool.options.patch.transparent` | Patch: Transparent |  | Sets Transparent for the Patch tool. |
| `tool.options.pathSelect.operation` | Path Selection: Operation |  | Sets Operation for the Path Selection tool. |
| `tool.options.patternStamp.aligned` | Pattern Stamp: Aligned |  | Sets Aligned for the Pattern Stamp tool. |
| `tool.options.patternStamp.angle` | Pattern Stamp: Angle |  | Sets Angle for the Pattern Stamp tool. |
| `tool.options.patternStamp.hardness` | Pattern Stamp: Hardness |  | Sets Hardness for the Pattern Stamp tool. |
| `tool.options.patternStamp.maskPaint` | Pattern Stamp: Mask paint |  | Sets Mask paint for the Pattern Stamp tool. |
| `tool.options.patternStamp.opacity` | Pattern Stamp: Opacity |  | Sets Opacity for the Pattern Stamp tool. |
| `tool.options.patternStamp.pattern` | Pattern Stamp: Pattern |  | Sets Pattern for the Pattern Stamp tool. |
| `tool.options.patternStamp.pressureCurve` | Pattern Stamp: Pressure curve |  | Sets Pressure curve for the Pattern Stamp tool. |
| `tool.options.patternStamp.pressureOpacity` | Pattern Stamp: Pressure: opacity |  | Sets Pressure: opacity for the Pattern Stamp tool. |
| `tool.options.patternStamp.pressureSize` | Pattern Stamp: Pressure: size |  | Sets Pressure: size for the Pattern Stamp tool. |
| `tool.options.patternStamp.scale` | Pattern Stamp: Scale |  | Sets Scale for the Pattern Stamp tool. |
| `tool.options.patternStamp.size` | Pattern Stamp: Size |  | Sets Size for the Pattern Stamp tool. |
| `tool.options.patternStamp.symmetry` | Pattern Stamp: Symmetry |  | Sets Symmetry for the Pattern Stamp tool. |
| `tool.options.patternStamp.symmetryX` | Pattern Stamp: Symmetry X |  | Sets Symmetry X for the Pattern Stamp tool. |
| `tool.options.patternStamp.symmetryY` | Pattern Stamp: Symmetry Y |  | Sets Symmetry Y for the Pattern Stamp tool. |
| `tool.options.pen.autoAddDelete` | Pen: Auto Add/Delete |  | Sets Auto Add/Delete for the Pen tool. |
| `tool.options.pen.mode` | Pen: Mode |  | Sets Mode for the Pen tool. |
| `tool.options.pencil.adjustForZoom` | Pencil: Adjust for zoom |  | Sets Adjust for zoom for the Pencil tool. |
| `tool.options.pencil.autoErase` | Pencil: Auto Erase |  | Sets Auto Erase for the Pencil tool. |
| `tool.options.pencil.catchUpOnStrokeEnd` | Pencil: Catch-up on stroke end |  | Sets Catch-up on stroke end for the Pencil tool. |
| `tool.options.pencil.maskPaint` | Pencil: Mask paint |  | Sets Mask paint for the Pencil tool. |
| `tool.options.pencil.mode` | Pencil: Mode |  | Sets Mode for the Pencil tool. |
| `tool.options.pencil.opacity` | Pencil: Opacity |  | Sets Opacity for the Pencil tool. |
| `tool.options.pencil.pressureCurve` | Pencil: Pressure curve |  | Sets Pressure curve for the Pencil tool. |
| `tool.options.pencil.pressureOpacity` | Pencil: Pressure: opacity |  | Sets Pressure: opacity for the Pencil tool. |
| `tool.options.pencil.pressureSize` | Pencil: Pressure: size |  | Sets Pressure: size for the Pencil tool. |
| `tool.options.pencil.quickShape` | Pencil: Quick Shape |  | Sets Quick Shape for the Pencil tool. |
| `tool.options.pencil.size` | Pencil: Size |  | Sets Size for the Pencil tool. |
| `tool.options.pencil.smoothing` | Pencil: Smoothing |  | Sets Smoothing for the Pencil tool. |
| `tool.options.pencil.smoothingMode` | Pencil: Smoothing mode |  | Sets Smoothing mode for the Pencil tool. |
| `tool.options.pencil.symmetry` | Pencil: Symmetry |  | Sets Symmetry for the Pencil tool. |
| `tool.options.pencil.symmetryX` | Pencil: Symmetry X |  | Sets Symmetry X for the Pencil tool. |
| `tool.options.pencil.symmetryY` | Pencil: Symmetry Y |  | Sets Symmetry Y for the Pencil tool. |
| `tool.options.quickSelect.enhanceEdge` | Quick Selection: Enhance Edge |  | Sets Enhance Edge for the Quick Selection tool. |
| `tool.options.quickSelect.growBy` | Quick Selection: Grow by |  | Sets Grow by for the Quick Selection tool. |
| `tool.options.quickSelect.sampleAllLayers` | Quick Selection: Sample all layers |  | Sets Sample all layers for the Quick Selection tool. |
| `tool.options.quickSelect.selection` | Quick Selection: Selection |  | Sets Selection for the Quick Selection tool. |
| `tool.options.quickSelect.size` | Quick Selection: Size |  | Sets Size for the Quick Selection tool. |
| `tool.options.redEye.darkenAmount` | Red Eye: Darken Amount |  | Sets Darken Amount for the Red Eye tool. |
| `tool.options.redEye.pupilSize` | Red Eye: Pupil Size |  | Sets Pupil Size for the Red Eye tool. |
| `tool.options.remove.collectStrokesEnterFills` | Remove: Collect strokes (Enter fills) |  | Sets Collect strokes (Enter fills) for the Remove tool. |
| `tool.options.remove.hardness` | Remove: Hardness |  | Sets Hardness for the Remove tool. |
| `tool.options.remove.lamaWhenDownloadedNewLayer` | Remove: LaMa when downloaded (new layer) |  | Sets LaMa when downloaded (new layer) for the Remove tool. |
| `tool.options.remove.maskPaint` | Remove: Mask paint |  | Sets Mask paint for the Remove tool. |
| `tool.options.remove.opacity` | Remove: Opacity |  | Sets Opacity for the Remove tool. |
| `tool.options.remove.sample` | Remove: Sample |  | Sets Sample for the Remove tool. |
| `tool.options.remove.size` | Remove: Size |  | Sets Size for the Remove tool. |
| `tool.options.remove.symmetry` | Remove: Symmetry |  | Sets Symmetry for the Remove tool. |
| `tool.options.remove.symmetryX` | Remove: Symmetry X |  | Sets Symmetry X for the Remove tool. |
| `tool.options.remove.symmetryY` | Remove: Symmetry Y |  | Sets Symmetry Y for the Remove tool. |
| `tool.options.rotateView.rotationAngle` | Rotate View: Rotation Angle |  | Sets Rotation Angle for the Rotate View tool. |
| `tool.options.ruler.useMeasurementScale` | Ruler: Use Measurement Scale |  | Sets Use Measurement Scale for the Ruler tool. |
| `tool.options.selectionBrush.hardness` | Selection Brush: Hardness |  | Sets Hardness for the Selection Brush tool. |
| `tool.options.selectionBrush.maskPaint` | Selection Brush: Mask paint |  | Sets Mask paint for the Selection Brush tool. |
| `tool.options.selectionBrush.pressureCurve` | Selection Brush: Pressure curve |  | Sets Pressure curve for the Selection Brush tool. |
| `tool.options.selectionBrush.pressureOpacity` | Selection Brush: Pressure: opacity |  | Sets Pressure: opacity for the Selection Brush tool. |
| `tool.options.selectionBrush.pressureSize` | Selection Brush: Pressure: size |  | Sets Pressure: size for the Selection Brush tool. |
| `tool.options.selectionBrush.size` | Selection Brush: Size |  | Sets Size for the Selection Brush tool. |
| `tool.options.selectionBrush.symmetry` | Selection Brush: Symmetry |  | Sets Symmetry for the Selection Brush tool. |
| `tool.options.selectionBrush.symmetryX` | Selection Brush: Symmetry X |  | Sets Symmetry X for the Selection Brush tool. |
| `tool.options.selectionBrush.symmetryY` | Selection Brush: Symmetry Y |  | Sets Symmetry Y for the Selection Brush tool. |
| `tool.options.shape.align` | Shape: Align |  | Sets Align for the Shape tool. |
| `tool.options.shape.caps` | Shape: Caps |  | Sets Caps for the Shape tool. |
| `tool.options.shape.cornerRadius` | Shape: Corner radius |  | Sets Corner radius for the Shape tool. |
| `tool.options.shape.corners` | Shape: Corners |  | Sets Corners for the Shape tool. |
| `tool.options.shape.customShape` | Shape: Custom shape |  | Sets Custom shape for the Shape tool. |
| `tool.options.shape.fill` | Shape: Fill |  | Sets Fill for the Shape tool. |
| `tool.options.shape.gradient` | Shape: Gradient |  | Sets Gradient for the Shape tool. |
| `tool.options.shape.gradientAngle` | Shape: Gradient angle |  | Sets Gradient angle for the Shape tool. |
| `tool.options.shape.headLength` | Shape: Head length |  | Sets Head length for the Shape tool. |
| `tool.options.shape.headWidth` | Shape: Head width |  | Sets Head width for the Shape tool. |
| `tool.options.shape.indent` | Shape: Indent |  | Sets Indent for the Shape tool. |
| `tool.options.shape.miterLimit` | Shape: Miter limit |  | Sets Miter limit for the Shape tool. |
| `tool.options.shape.mode` | Shape: Mode |  | Sets Mode for the Shape tool. |
| `tool.options.shape.pathOperation` | Shape: Path operation |  | Sets Path operation for the Shape tool. |
| `tool.options.shape.points` | Shape: Points |  | Sets Points for the Shape tool. |
| `tool.options.shape.shape` | Shape: Shape |  | Sets Shape for the Shape tool. |
| `tool.options.shape.sides` | Shape: Sides |  | Sets Sides for the Shape tool. |
| `tool.options.shape.smoothCorners` | Shape: Smooth corners |  | Sets Smooth corners for the Shape tool. |
| `tool.options.shape.stroke` | Shape: Stroke |  | Sets Stroke for the Shape tool. |
| `tool.options.shape.strokeType` | Shape: Stroke Type |  | Sets Stroke Type for the Shape tool. |
| `tool.options.shape.weight` | Shape: Weight |  | Sets Weight for the Shape tool. |
| `tool.options.shape.width` | Shape: Width |  | Sets Width for the Shape tool. |
| `tool.options.slice.height` | Slice: Height |  | Sets Height for the Slice tool. |
| `tool.options.slice.lockSlices` | Slice: Lock Slices |  | Sets Lock Slices for the Slice tool. |
| `tool.options.slice.showAutoSlices` | Slice: Show Auto Slices |  | Sets Show Auto Slices for the Slice tool. |
| `tool.options.slice.style` | Slice: Style |  | Sets Style for the Slice tool. |
| `tool.options.slice.width` | Slice: Width |  | Sets Width for the Slice tool. |
| `tool.options.smear.hardness` | Smear: Hardness |  | Sets Hardness for the Smear tool. |
| `tool.options.smear.maskPaint` | Smear: Mask paint |  | Sets Mask paint for the Smear tool. |
| `tool.options.smear.mode` | Smear: Mode |  | Sets Mode for the Smear tool. |
| `tool.options.smear.pressureCurve` | Smear: Pressure curve |  | Sets Pressure curve for the Smear tool. |
| `tool.options.smear.pressureOpacity` | Smear: Pressure: opacity |  | Sets Pressure: opacity for the Smear tool. |
| `tool.options.smear.pressureSize` | Smear: Pressure: size |  | Sets Pressure: size for the Smear tool. |
| `tool.options.smear.radius` | Smear: Radius |  | Sets Radius for the Smear tool. |
| `tool.options.smear.sampleAllLayers` | Smear: Sample All Layers |  | Sets Sample All Layers for the Smear tool. |
| `tool.options.smear.size` | Smear: Size |  | Sets Size for the Smear tool. |
| `tool.options.smear.strength` | Smear: Strength |  | Sets Strength for the Smear tool. |
| `tool.options.smear.symmetry` | Smear: Symmetry |  | Sets Symmetry for the Smear tool. |
| `tool.options.smear.symmetryX` | Smear: Symmetry X |  | Sets Symmetry X for the Smear tool. |
| `tool.options.smear.symmetryY` | Smear: Symmetry Y |  | Sets Symmetry Y for the Smear tool. |
| `tool.options.smear.tool` | Smear: Tool |  | Sets Tool for the Smear tool. |
| `tool.options.sponge.flow` | Sponge: Flow |  | Sets Flow for the Sponge tool. |
| `tool.options.sponge.hardness` | Sponge: Hardness |  | Sets Hardness for the Sponge tool. |
| `tool.options.sponge.maskPaint` | Sponge: Mask paint |  | Sets Mask paint for the Sponge tool. |
| `tool.options.sponge.mode` | Sponge: Mode |  | Sets Mode for the Sponge tool. |
| `tool.options.sponge.pressureCurve` | Sponge: Pressure curve |  | Sets Pressure curve for the Sponge tool. |
| `tool.options.sponge.pressureOpacity` | Sponge: Pressure: opacity |  | Sets Pressure: opacity for the Sponge tool. |
| `tool.options.sponge.pressureSize` | Sponge: Pressure: size |  | Sets Pressure: size for the Sponge tool. |
| `tool.options.sponge.sample` | Sponge: Sample |  | Sets Sample for the Sponge tool. |
| `tool.options.sponge.size` | Sponge: Size |  | Sets Size for the Sponge tool. |
| `tool.options.sponge.strength` | Sponge: Strength |  | Sets Strength for the Sponge tool. |
| `tool.options.sponge.symmetry` | Sponge: Symmetry |  | Sets Symmetry for the Sponge tool. |
| `tool.options.sponge.symmetryX` | Sponge: Symmetry X |  | Sets Symmetry X for the Sponge tool. |
| `tool.options.sponge.symmetryY` | Sponge: Symmetry Y |  | Sets Symmetry Y for the Sponge tool. |
| `tool.options.sponge.vibrance` | Sponge: Vibrance |  | Sets Vibrance for the Sponge tool. |
| `tool.options.spotHealing.hardness` | Spot Healing: Hardness |  | Sets Hardness for the Spot Healing tool. |
| `tool.options.spotHealing.maskPaint` | Spot Healing: Mask paint |  | Sets Mask paint for the Spot Healing tool. |
| `tool.options.spotHealing.mode` | Spot Healing: Mode |  | Sets Mode for the Spot Healing tool. |
| `tool.options.spotHealing.opacity` | Spot Healing: Opacity |  | Sets Opacity for the Spot Healing tool. |
| `tool.options.spotHealing.sampleAllLayers` | Spot Healing: Sample All Layers |  | Sets Sample All Layers for the Spot Healing tool. |
| `tool.options.spotHealing.size` | Spot Healing: Size |  | Sets Size for the Spot Healing tool. |
| `tool.options.spotHealing.symmetry` | Spot Healing: Symmetry |  | Sets Symmetry for the Spot Healing tool. |
| `tool.options.spotHealing.symmetryX` | Spot Healing: Symmetry X |  | Sets Symmetry X for the Spot Healing tool. |
| `tool.options.spotHealing.symmetryY` | Spot Healing: Symmetry Y |  | Sets Symmetry Y for the Spot Healing tool. |
| `tool.options.spotHealing.type` | Spot Healing: Type |  | Sets Type for the Spot Healing tool. |
| `tool.options.type.align` | Type: Align |  | Sets Align for the Type tool. |
| `tool.options.type.antiAliasing` | Type: Anti-aliasing |  | Sets Anti-aliasing for the Type tool. |
| `tool.options.type.color` | Type: Color |  | Sets Color for the Type tool. |
| `tool.options.type.font` | Type: Font |  | Sets Font for the Type tool. |
| `tool.options.type.fontStyle` | Type: Font Style |  | Sets Font Style for the Type tool. |
| `tool.options.type.hyphenate` | Type: Hyphenate |  | Sets Hyphenate for the Type tool. |
| `tool.options.type.kerning` | Type: Kerning |  | Sets Kerning for the Type tool. |
| `tool.options.type.language` | Type: Language |  | Sets Language for the Type tool. |
| `tool.options.type.languageOptions` | Type: Language Options |  | Sets Language Options for the Type tool. |
| `tool.options.type.leading` | Type: Leading |  | Sets Leading for the Type tool. |
| `tool.options.type.opentype` | Type: OpenType |  | Sets OpenType for the Type tool. |
| `tool.options.type.orientation` | Type: Orientation |  | Sets Orientation for the Type tool. |
| `tool.options.type.size` | Type: Size |  | Sets Size for the Type tool. |
| `tool.options.type.tracking` | Type: Tracking |  | Sets Tracking for the Type tool. |
| `tool.options.wand.antiAlias` | Magic Wand: Anti-alias |  | Sets Anti-alias for the Magic Wand tool. |
| `tool.options.wand.contiguous` | Magic Wand: Contiguous |  | Sets Contiguous for the Magic Wand tool. |
| `tool.options.wand.growBy` | Magic Wand: Grow by |  | Sets Grow by for the Magic Wand tool. |
| `tool.options.wand.mode` | Magic Wand: Mode |  | Sets Mode for the Magic Wand tool. |
| `tool.options.wand.sampleAllLayers` | Magic Wand: Sample all layers |  | Sets Sample all layers for the Magic Wand tool. |
| `tool.options.wand.sampleSize` | Magic Wand: Sample Size |  | Sets Sample Size for the Magic Wand tool. |
| `tool.options.wand.tolerance` | Magic Wand: Tolerance |  | Sets Tolerance for the Magic Wand tool. |
| `tool.options.zoom.scrubbyZoom` | Zoom: Scrubby Zoom |  | Sets Scrubby Zoom for the Zoom tool. |

## Tools

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `tool.select.artHistory` | Art History Brush Tool |  | Makes the Art History Brush tool the active tool (key Y). Paint stylized strokes in the colors of the source snapshot (History panel) · [ ] size |
| `tool.select.artboard` | Artboard Tool |  | Makes the Artboard tool the active tool (key V). Drag on empty canvas to make an artboard · Click its name to select it · Drag inside to move it with its contents · Handles resize · "+" adds one beside it, Alt-click it to copy the contents too |
| `tool.select.backgroundEraser` | Background Eraser Tool |  | Makes the Background Eraser tool the active tool (key E). Drag with the center over the color to erase · Tolerance widens it · Protect Foreground keeps the foreground color |
| `tool.select.boxes` | Boxes Tool |  | Makes the Boxes tool the active tool (key I). Drag to draw a box · Click one to select it, drag to move, drag a handle to resize · Double-click or Enter to describe it · Delete, Mod+D, arrows, Tab |
| `tool.select.brush` | Brush Tool |  | Makes the Brush tool the active tool (key B). Drag to paint · Shift-click draws a line from the last point · [ ] size · Shift+[ ] hardness · 1-0 opacity · E eraser · B brush · Space pans |
| `tool.select.bucket` | Paint Bucket Tool |  | Makes the Paint Bucket tool the active tool (key G). Click to fill the area of similar color with the foreground color · Tolerance sets how similar · Stays inside the selection |
| `tool.select.burn` | Burn Tool |  | Makes the Burn tool the active tool (key O). Paint to darken, most in the chosen tonal range · [ ] size |
| `tool.select.cloneStamp` | Clone Stamp Tool |  | Makes the Clone Stamp tool the active tool (key S). Alt-click sets the source, then paint to copy from it · Aligned keeps the offset between strokes · Sample All Layers copies what you see · [ ] size |
| `tool.select.colorReplace` | Color Replacement Tool |  | Makes the Color Replacement tool the active tool (key B). Drag over a color to replace it with the foreground color · Tolerance sets how far from it colors match · [ ] size |
| `tool.select.colorSampler` | Color Sampler Tool |  | Makes the Color Sampler tool the active tool (key I). Click to place a sampler (up to ten) · Drag one to move it · Alt-click one or drag it off the canvas to remove it · Its color shows in Window > Info |
| `tool.select.contentAwareMove` | Content-Aware Move Tool |  | Makes the Content-Aware Move tool the active tool (key J). Draw around what to move, then drag it: the hole it leaves is filled from around it |
| `tool.select.convertPoint` | Convert Point Tool |  | Makes the Convert Point tool the active tool (key P). Click a smooth point to make it a corner · Drag from a point to pull out smooth handles · Drag a handle to move it alone |
| `tool.select.count` | Count Tool |  | Makes the Count tool the active tool (key I). Click to count · Drag a mark to move it · Alt-click a mark to remove it · New Group in the bar starts another count |
| `tool.select.crop` | Crop Tool |  | Makes the Crop tool the active tool (key C). Drag a frame · Drag inside to move it · Handles resize · Alt keeps the center · Edges snap to the canvas and layer edges · Enter crops · Escape cancels |
| `tool.select.curvaturePen` | Curvature Pen Tool |  | Makes the Curvature Pen tool the active tool (key P). Click to place points; the curve runs smoothly through them · Alt-click for a corner · drag a point to move it · double-click a point to toggle corner · click the first point to close · Enter ends |
| `tool.select.directSelect` | Direct Selection Tool |  | Makes the Direct Selection tool the active tool (key A). Click a point to select it, Shift to add, or drag a box · Drag points to move them, handles to reshape · Alt-drag a point to pull out handles, a handle to break it · Alt-click a segment to select its whole path · Arrows nudge |
| `tool.select.dodge` | Dodge Tool |  | Makes the Dodge tool the active tool (key O). Paint to lighten, most in the chosen tonal range · [ ] size |
| `tool.select.eraser` | Eraser Tool |  | Makes the Eraser tool the active tool (key E). Drag to erase · Shift-click erases a line from the last point · [ ] size · Shift+[ ] hardness |
| `tool.select.eyedropper` | Eyedropper Tool |  | Makes the Eyedropper tool the active tool (key I). Click or drag to sample the foreground color from the visible image · Alt-click samples the background color |
| `tool.select.frame` | Frame Tool |  | Makes the Frame tool the active tool (key K). Drag to draw a frame · Shift for a square or circle · Alt to draw from the center · Import an image with the frame selected to fill it |
| `tool.select.freeformPen` | Freeform Pen Tool |  | Makes the Freeform Pen tool the active tool (key P). Drag to draw a path freehand · end near the start to close it · Alt-click for straight segments · Curve Fit sets how closely it follows · Magnetic hugs the edges within Width |
| `tool.select.gradient` | Gradient Tool |  | Makes the Gradient tool the active tool (key G). Drag to draw a gradient · Drag either end to adjust it · Click the line to add a color stop, drag stops and midpoints, Alt-click a stop to remove it, Ctrl-click to give it the foreground color · On a Gradient Fill layer the same handles edit the layer · Shift snaps to 45 degrees · Enter applies · Escape cancels · Switching tools applies |
| `tool.select.hand` | Hand Tool |  | Makes the Hand tool the active tool (key H). Drag to pan · Scroll pans · Cmd/Ctrl + scroll zooms · Hold Space to pan with any tool |
| `tool.select.healingBrush` | Healing Brush Tool |  | Makes the Healing Brush tool the active tool (key J). Alt-click to set the source, then paint; on release the copied texture blends into its surroundings · Aligned keeps the offset between strokes · Shift+J cycles the healing tools · [ ] size |
| `tool.select.historyBrush` | History Brush Tool |  | Makes the History Brush tool the active tool (key Y). Paint to bring back the layer as it was in the source snapshot or history state (History panel) · [ ] size |
| `tool.select.lasso` | Lasso Tool |  | Makes the Lasso tool the active tool (key L). Drag around an area · Shift adds · Alt subtracts · Release the mouse with Alt held to click straight segments · A click deselects · Shift+L switches to polygonal |
| `tool.select.magicEraser` | Magic Eraser Tool |  | Makes the Magic Eraser tool the active tool (key E). Click an area to erase it and the colors like it · Tolerance widens the match · Contiguous keeps to the connected area |
| `tool.select.markup` | Markup Tool |  | Makes the Markup tool the active tool (key I). Drag from the tail of the arrow to its tip |
| `tool.select.marquee` | Marquee Tool |  | Makes the Marquee tool the active tool (key M). Drag a rectangle · Shift adds · Alt subtracts · Shift after starting constrains · Alt after starting grows from the center · Drag inside to move the outline · Shift+M switches shape · A click, Escape or Cmd or Ctrl+D deselects |
| `tool.select.mixer` | Mixer Brush Tool |  | Makes the Mixer Brush tool the active tool (key B). Drag to paint with wet paint that picks up and mixes the colors under it · [ ] size · Alt-click loads the reservoir from the canvas |
| `tool.select.move` | Move Tool |  | Makes the Move tool the active tool (key V). Drag to move · Drag inside a selection to move its pixels, Alt to duplicate them · Handles resize · Outside a corner rotates · Shift constrains · Alt resizes from the center · Alt-drag inside the box copies the layers · Cmd or Ctrl flips Auto-Select for the drag · Arrows nudge · 1-0 set layer opacity |
| `tool.select.note` | Note Tool |  | Makes the Note tool the active tool (key I). Click to pin a note · Click a note to edit it · Drag it to move it · Alt-click it to delete it |
| `tool.select.objectSelect` | Object Selection Tool |  | Makes the Object Selection tool the active tool (key W). Click an object, or drag a box round it · Shift adds · Alt subtracts · Rest the pointer to see the object it finds · The first use on an image takes a few seconds |
| `tool.select.patch` | Patch Tool |  | Makes the Patch tool the active tool (key J). Draw around the area to fix, then drag the selection onto the area to copy from · Shift+J cycles the healing tools |
| `tool.select.pathSelect` | Path Selection Tool |  | Makes the Path Selection tool the active tool (key A). Click a path to select it whole · drag to move it · Alt-drag to copy · Delete removes it · arrows nudge |
| `tool.select.patternStamp` | Pattern Stamp Tool |  | Makes the Pattern Stamp tool the active tool (key S). Drag to paint the pattern · Choose it in the options bar · [ ] size · Shift+[ ] hardness |
| `tool.select.pen` | Pen Tool |  | Makes the Pen tool the active tool (key P). Click for corner points, drag for curves · Click the first point to close · Enter ends an open path, Backspace removes the last point · Between paths, click the path to add a point or a point to delete it · Ctrl+Enter makes a selection |
| `tool.select.pencil` | Pencil Tool |  | Makes the Pencil tool the active tool (key B). Drag to draw hard-edged, pixel-exact lines · Shift-click draws a line from the last point · [ ] size |
| `tool.select.quickSelect` | Quick Selection Tool |  | Makes the Quick Selection tool the active tool (key W). Drag over an area to select it; the selection grows to similar color and stops at edges · Alt-drag subtracts · [ ] size |
| `tool.select.redEye` | Red Eye Tool |  | Makes the Red Eye tool the active tool (key J). Click the red of a pupil |
| `tool.select.relight` | Relight Tool |  | Makes the Relight tool the active tool. Click the Relight tool to light the picture with virtual lights, or open Filter > Relight. |
| `tool.select.remove` | Remove Tool |  | Makes the Remove tool the active tool (key J). Paint over what to remove; it is filled from its surroundings when you release · [ ] size |
| `tool.select.rotateView` | Rotate View Tool |  | Makes the Rotate View tool the active tool (key R). Drag to turn the view · Shift for 15 degree steps · Double-click or Escape straightens it |
| `tool.select.ruler` | Ruler Tool |  | Makes the Ruler tool the active tool (key I). Drag to measure · Drag an end to adjust · Alt-drag from an end for a second arm and the angle between · Straighten Layer levels the layer along the line |
| `tool.select.selectionBrush` | Selection Brush Tool |  | Makes the Selection Brush tool the active tool (key W). Paint to add to the selection · Alt-paint to take away · Shift+Alt-paint to keep only what is painted over the selection · [ ] size · Shift+[ ] hardness |
| `tool.select.shape` | Shape Tool |  | Makes the Shape tool the active tool (key U). Drag to draw a rectangle (on a new shape layer) · Shift after starting keeps it square · Alt after starting grows from the center · Shift+U switches shape |
| `tool.select.slice` | Slice Tool |  | Makes the Slice tool the active tool (key C). Drag a rectangle to add a slice · Shift makes it square · Slices are numbered in reading order |
| `tool.select.smear` | Smear Tool |  | Makes the Smear tool the active tool. Paint to soften; another stroke over the same place softens more · Radius 0 makes the blur follow the brush size · [ ] size |
| `tool.select.sponge` | Sponge Tool |  | Makes the Sponge tool the active tool (key O). Paint to take color out, or with Saturate, to strengthen it · [ ] size |
| `tool.select.spotHealing` | Spot Healing Tool |  | Makes the Spot Healing tool the active tool (key J). Paint over a spot and it heals on release · Content-Aware copies a matching patch nearby · Create Texture fills smoothly with matching grain · Proximity Match prefers the nearest patch · [ ] size |
| `tool.select.type` | Type Tool |  | Makes the Type tool the active tool (key T). Click to add point text · Drag a box for paragraph text · Click a type layer to edit its text |
| `tool.select.wand` | Magic Wand Tool |  | Makes the Magic Wand tool the active tool (key W). Click to select similar colors · Shift adds · Alt subtracts · Tolerance sets how alike · With a layer mask targeted it samples the mask · Arrows nudge the outline |
| `tool.select.zoom` | Zoom Tool |  | Makes the Zoom tool the active tool (key Z). Click zooms in · Alt-click zooms out · Drag right or left to zoom smoothly · Space pans |

## Type

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `add-font-files` | Add Font Files... |  | Opens a file picker for font files (ttf, otf, woff, woff2) and adds each to the font menus for this session. |
| `add-web-font` | Add Web Font... |  | Loads a font file from a web address and adds it to the font menus under the given family name. |
| `character-styles` | Character Styles... |  | Opens Character Styles. |
| `check-spelling` | Check Spelling... |  | Checks the words of every type layer against a dictionary and steps through the unknown ones with suggestions. (changes the picture) |
| `convert-paragraph-text` | Convert to Paragraph Text |  | Turns the active point text into paragraph text in a box around its current size. (changes the picture) |
| `convert-point-text` | Convert to Point Text |  | Turns the active paragraph text into point text with no box. (changes the picture) |
| `edit-text` | Edit Type... |  | Opens the text of the active type layer for editing. (changes the picture) |
| `find-replace-text` | Find and Replace Text... |  | Finds text in type layers and replaces it, with case and whole word options. (changes the picture) |
| `font-preview-extra` | Extra Large |  | Draws each family in the font menus in its own face, extra large. |
| `font-preview-huge` | Huge |  | Draws each family in the font menus in its own face, huge. |
| `font-preview-large` | Large |  | Draws each family in the font menus in its own face, large. |
| `font-preview-medium` | Medium |  | Draws each family in the font menus in its own face, medium (the default). |
| `font-preview-none` | None |  | Shows the font menus plainly, each family in the interface font. |
| `font-preview-small` | Small |  | Draws each family in the font menus in its own face, small. |
| `language-default` | Default Features |  | Sets the active type layer, and new type, to the browser's default shaping. (changes the picture) |
| `language-east-asian` | East Asian Features |  | Sets the active type layer, and new type, to East Asian features: Japanese glyph forms by default and legibility-first shaping. (changes the picture) |
| `language-middle-eastern` | Middle Eastern Features |  | Sets the active type layer, and new type, to Middle Eastern features: right-to-left base direction, Arabic shaping by default. (changes the picture) |
| `language-south-asian` | Middle Eastern and South Asian Features |  | Sets the active type layer, and new type, to Middle Eastern and South Asian features: complex-script shaping with Hindi forms by default and a base direction that follows the text. (changes the picture) |
| `list-fonts` | List Fonts |  | Returns the font families the type menus offer, the four faces each has and the family new text uses. (changes the picture) |
| `load-default-type-styles` | Load Default Type Styles |  | Adds the saved default type styles (else Heading 1, Heading 2, Body and Caption) to the document and takes the saved Type settings for new type. (changes the picture) |
| `paragraph-styles` | Paragraph Styles... |  | Opens Paragraph Styles. |
| `paste-lorem-ipsum` | Paste Lorem Ipsum |  | Puts a Lorem Ipsum paragraph at the caret while typing, or at a character position or the end of the active type layer, or starts a new paragraph type layer when none is active or new_layer is true. (changes the picture) |
| `replace-missing-fonts` | Replace All Missing Fonts |  | Sets every type layer whose font is not installed to the default font in one undo step. (changes the picture) |
| `reset-character` | Reset Character |  | Puts the active type layer, and new type, back to the factory character attributes: font, size, style, leading, tracking, kerning, OpenType features, caps, scale, baseline shift and variable axes. (changes the picture) |
| `reset-paragraph` | Reset Paragraph |  | Puts the active type layer, and new type, back to the factory paragraph attributes: left alignment, no indents, no space before or after, no hyphenation. (changes the picture) |
| `resolve-missing-fonts` | Resolve Missing Fonts... |  | Lists the fonts type layers use that are not installed and replaces each with an installed family. (changes the picture) |
| `save-default-type-styles` | Save Default Type Styles |  | Keeps the current Type settings and this document's paragraph and character styles on this computer as the defaults Load Default Type Styles brings back. |
| `type-aa-crisp` | Crisp |  | Sets the type anti-aliasing to Crisp: steeper edges, centered a little lower. (changes the picture) |
| `type-aa-none` | None |  | Sets the type anti-aliasing to None: every edge pixel fully on or off. (changes the picture) |
| `type-aa-sharp` | Sharp |  | Sets the type anti-aliasing to Sharp: steeper edges. (changes the picture) |
| `type-aa-smooth` | Smooth |  | Sets the type anti-aliasing to Smooth: the canvas's own edges (the default). (changes the picture) |
| `type-aa-strong` | Strong |  | Sets the type anti-aliasing to Strong: steeper edges that read heavier. (changes the picture) |
| `type-aa-windows` | Windows |  | Sets the type anti-aliasing to Windows: a coverage gamma on grayscale edges. (changes the picture) |
| `type-aa-windows-lcd` | Windows LCD |  | Sets the type anti-aliasing to Windows LCD: each edge averaged with its horizontal neighbors. (changes the picture) |
| `type-all-caps` | All Caps |  | Sets the active type layer, and new type, in capital letters, or back to as typed. (changes the picture) |
| `type-angle` | Type Angle |  | Turns the active type layer by an angle in degrees, clockwise, drawing the glyphs at that angle so the edges stay sharp; 0 sets it straight. (changes the picture) |
| `type-direction-auto` | Follow Language Options |  | Sets the active type layer, and new type, to take its base direction from Language Options. (changes the picture) |
| `type-direction-ltr` | Left to Right |  | Sets the active type layer, and new type, to a left-to-right base direction. (changes the picture) |
| `type-direction-rtl` | Right to Left |  | Sets the active type layer, and new type, to a right-to-left base direction: the order of runs and the side punctuation falls on follow it. (changes the picture) |
| `type-features` | OpenType Features |  | Turns OpenType features (ligatures, small caps, oldstyle figures, swash and more) on or off for the active type layer. (changes the picture) |
| `type-horizontal` | Horizontal |  | Sets the active type layer to horizontal lines of type. (changes the picture) |
| `type-on-arc` | Type on Arc... |  | Sets text on an arc, live and editable. (changes the picture) |
| `type-on-circle` | Type on Circle... |  | Sets text round a full circle, live and editable. (changes the picture) |
| `type-on-path` | Type on Path... |  | Opens Type on Path. (changes the picture) |
| `type-ot-calt` | Contextual Alternates |  | Turns the OpenType contextual alternates on or off for the characters selected while typing, else a start to end range of the selected type layers, else the whole layers, else new type. (changes the picture) |
| `type-ot-dlig` | Discretionary Ligatures |  | Turns the OpenType discretionary ligatures on or off for the characters selected while typing, else a start to end range of the selected type layers, else the whole layers, else new type. (changes the picture) |
| `type-ot-frac` | Fractions |  | Turns the OpenType fractions on or off for the characters selected while typing, else a start to end range of the selected type layers, else the whole layers, else new type. (changes the picture) |
| `type-ot-liga` | Standard Ligatures |  | Turns the OpenType standard ligatures (fi, fl and the like) on or off for the characters selected while typing, else a start to end range of the selected type layers, else the whole layers, else new type. (changes the picture) |
| `type-ot-onum` | Oldstyle |  | Turns the OpenType oldstyle figures on or off for the characters selected while typing, else a start to end range of the selected type layers, else the whole layers, else new type. (changes the picture) |
| `type-ot-ordn` | Ordinals |  | Turns the OpenType ordinals on or off for the characters selected while typing, else a start to end range of the selected type layers, else the whole layers, else new type. (changes the picture) |
| `type-ot-ornm` | Ornaments |  | Turns the OpenType ornaments on or off for the characters selected while typing, else a start to end range of the selected type layers, else the whole layers, else new type. (changes the picture) |
| `type-ot-salt` | Stylistic Alternates |  | Turns the OpenType stylistic alternates on or off for the characters selected while typing, else a start to end range of the selected type layers, else the whole layers, else new type. (changes the picture) |
| `type-ot-swsh` | Swash |  | Turns the OpenType swash forms on or off for the characters selected while typing, else a start to end range of the selected type layers, else the whole layers, else new type. (changes the picture) |
| `type-ot-titl` | Titling Alternates |  | Turns the OpenType titling alternates on or off for the characters selected while typing, else a start to end range of the selected type layers, else the whole layers, else new type. (changes the picture) |
| `type-path-flip` | Flip Type on Path |  | Moves type set on a path to the other side of the path. (changes the picture) |
| `type-path-release` | Release Type from Path |  | Releases type from its path: the same words become straight point text. (changes the picture) |
| `type-range-character-style` | Apply Character Style to Range |  | Applies a saved character style (by name or id) to a character range of the selected type layers, or to the letters selected while typing, as per-range overrides. (changes the picture) |
| `type-range-style` | Character Range Style |  | Sets size, color, font family, weight, bold, italic, baseline shift, tracking, language, underline, strikethrough, caps, horizontal scale (scale_x) or vertical scale (scale_y) on a character range of the selected type layers (the whole text when no range is given), or on the letters selected while typing; clear true takes the range back to the layer's own look. (changes the picture) |
| `type-small-caps` | Small Caps |  | Sets the active type layer, and new type, in small capitals, or back to as typed. (changes the picture) |
| `type-strikethrough` | Strikethrough |  | Strikes through the active type layer and new type, or removes it. (changes the picture) |
| `type-to-shape` | Convert to Shape |  | Turns the active type layer into a shape layer in the text color, in the place of the type layer; the type layer is removed, and Undo brings it back. (changes the picture) |
| `type-underline` | Underline |  | Underlines the active type layer and new type, or removes it. (changes the picture) |
| `type-vertical` | Vertical |  | Sets the active type layer to vertical columns of type, running right to left. (changes the picture) |
| `type-work-path` | Create Work Path |  | Traces the active type layer's outlines from its rendered pixels into the Work Path. (changes the picture) |
| `update-all-text` | Update All Text Layers |  | Re-renders every type layer from its own settings. (changes the picture) |
| `warp-text` | Warp Text... |  | Opens Warp Text. (changes the picture) |

## View

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `actual` | Actual Pixels | Mod+1 | Zooms to 100 percent. |
| `canvas-scrollbars` | Canvas Scrollbars |  | Shows or hides thin scroll indicators over the canvas that also drag the view; they cover the picture plus half a view of room on each side. |
| `clear-artboard-guides` | Clear Selected Artboard Guides |  | Removes the guides that belong to the selected artboard and keeps the others. (changes the picture) |
| `clear-guides` | Clear Guides |  | Removes every guide. (changes the picture) |
| `clear-slices` | Clear Slices |  | Removes every user slice. (changes the picture) |
| `custom-title-bar` | Custom Title Bar |  | Draws formvis's own title bar with Minimize, Maximize or Restore and Close buttons at its right end in place of the system frame (desktop app on Windows and Linux). The choice is kept. |
| `delete-selected-guides` | Delete Selected Guides |  | Deletes the guides picked with the Move tool. (changes the picture) |
| `delete-slice` | Delete Slice |  | Removes the selected user slice and keeps the others. (changes the picture) |
| `depth-map-show` | Show Depth Map |  | Shows the Depth Map layer alone on the canvas, or the picture again. |
| `divide-slice` | Divide Slice... |  | Cuts the selected slice into equal slices across and down. (changes the picture) |
| `edit-selected-guides` | Edit Selected Guides... |  | Opens a dialog for the picked guides: orientation and position in any unit for one guide, and a color for any number. |
| `fit` | Fit on Screen | Mod+0 | Zooms so the picture fits the window. |
| `fit-artboard` | Fit Artboard on Screen |  | Zooms so the artboard holding the active layer fills the window. |
| `fit-layers` | Fit Layer(s) on Screen |  | Zooms so the selected layers' content fills the window. |
| `flip-view-h` | Flip Horizontal |  | Mirrors the view of the document left to right, for this document only; the pixels are not changed and the pointer still lands on the right pixel. |
| `gamut-warning` | Gamut Warning | Shift+Mod+Y | Turns the gamut warning on or off. |
| `grid-settings` | Grid Settings... |  | Opens Preferences on Guides & Grid at the side, with the canvas still usable through it so the grid changes live: the grid color with presets, line style, opacity, spacing and subdivisions, with Restore Defaults. |
| `guide-layout` | New Guide Layout... |  | Opens New Guide Layout: columns and rows with gutters inside margins, placed as guides in one step. (changes the picture) |
| `guides-from-shape` | New Guides From Shape |  | Places guides on the edges, the center or both of the active shape layer or of the selection; the source, edges and center can be chosen. |
| `guides-from-shape-centre` | New Guides From Shape Center |  | Places one vertical and one horizontal guide through the center of the active shape layer, or of the selection. |
| `interface-rtl` | Right-to-Left Layout |  | Mirrors the window for right-to-left reading: the toolbar, the panels and the menu bar swap sides. The choice is kept. |
| `interface-zoom-in` | Interface Zoom In | Alt+Mod+= | Makes the whole window larger by one step (80, 90, 100, 110, 125, 150, 175, 200 percent); the choice is kept. |
| `interface-zoom-out` | Interface Zoom Out | Alt+Mod+- | Makes the whole window smaller by one step; the choice is kept. |
| `interface-zoom-reset` | Reset Interface Zoom | Alt+Mod+0 | Returns the window to 100 percent interface zoom. |
| `layer-based-slice` | New Layer Based Slice |  | Adds a slice over the visible pixels of the active layer, tied to that layer. (changes the picture) |
| `lock-guides` | Lock Guides | Alt+Mod+; | Locks or unlocks guides so they cannot be dragged. |
| `lock-slices` | Lock Slices |  | Locks or unlocks the slices so the Slice and Slice Select tools cannot add, move, resize or delete them. |
| `menus-in-window` | Menus in Window |  | Keeps the menus in the window instead of the macOS menu bar (desktop app on macOS). The choice is kept and applies at the next start. |
| `new-guide` | New Guide... |  | Opens the New Guide dialog to place a guide at a position. (changes the picture) |
| `next-favourite-theme` | Next Favorite Theme |  | Switches to the next theme marked as a favorite in Preferences > Interface (right-click a theme swatch to mark it). |
| `no-tool` | No Tool |  | Switches to no tool at all, so a click or drag on the canvas does nothing. |
| `os-full-screen` | Full Screen | F11 | Puts the whole window into the operating system full screen, or leaves it. |
| `par-correction` | Pixel Aspect Ratio Correction |  | Shows or hides the pixel aspect correction, which stretches the canvas and the Navigator preview by the pixel shape; tools and the pointer keep working in document pixels. |
| `pasteboard-black` | Pasteboard: Black |  | Makes the pasteboard around the picture black. |
| `pasteboard-dark` | Pasteboard: Dark Gray |  | Makes the pasteboard around the picture dark gray. |
| `pasteboard-default` | Pasteboard: Theme Default |  | Gives the pasteboard around the picture the color of the current theme. |
| `pasteboard-light` | Pasteboard: Light Gray |  | Makes the pasteboard around the picture light gray. |
| `pasteboard-mid` | Pasteboard: Medium Gray |  | Makes the pasteboard around the picture medium gray. |
| `pattern-preview` | Pattern Preview |  | Shows or hides eight copies of the document around it, to check that a tile repeats. |
| `performance-hud` | Performance HUD |  | Shows or hides a small panel over the canvas with the canvas frame time (median and worst of the last frames), the graphics processor pass time from a timer query where the browser offers one, and the render path in use (WebGPU, WebGL2, native or CPU). |
| `pixel-art-preview` | Pixel Art Preview |  | Shows or hides a crisp, nearest-neighbor view of the document at every zoom. |
| `pixel-grid` | Pixel Grid |  | Shows or hides the pixel grid at high zoom. |
| `preview-32` | 32-bit Preview Options... |  | Opens 32-bit Preview Options, exposure and gamma for how a 32-bit picture is shown. |
| `print-size` | Print Size |  | Zooms so the picture shows at its printed size on screen, from the document resolution (96 screen pixels to the inch). |
| `proof-colors` | Proof Colors |  | Turns Proof Colors on or off. |
| `proof-preset-black` | Working Black Plate |  | Shows the working CMYK black plate as a gray image and turns Proof Colors on. |
| `proof-preset-cmy` | Working CMY Plates |  | Shows the working CMYK cyan, magenta and yellow plates together, without black, and turns Proof Colors on. |
| `proof-preset-cmyk` | Working CMYK |  | Previews the picture as the working CMYK profile prints it and turns Proof Colors on. |
| `proof-preset-cyan` | Working Cyan Plate |  | Shows the working CMYK cyan plate as a gray image and turns Proof Colors on. |
| `proof-preset-deuteranopia` | Color Blindness - Deuteranopia-type |  | Simulates deuteranopia, green-blind color vision, and turns Proof Colors on. |
| `proof-preset-internet` | Internet Standard RGB (sRGB) |  | Previews the picture as a standard sRGB screen shows it and turns Proof Colors on. |
| `proof-preset-macrgb` | Legacy Macintosh RGB (Gamma 1.8) |  | Previews the picture on an older Macintosh screen, gamma 1.8, and turns Proof Colors on. |
| `proof-preset-magenta` | Working Magenta Plate |  | Shows the working CMYK magenta plate as a gray image and turns Proof Colors on. |
| `proof-preset-monitor` | Monitor RGB |  | Shows the picture with its color numbers sent to the screen as they are, without the profile conversion, and turns Proof Colors on. |
| `proof-preset-protanopia` | Color Blindness - Protanopia-type |  | Simulates protanopia, red-blind color vision, and turns Proof Colors on. |
| `proof-preset-yellow` | Working Yellow Plate |  | Shows the working CMYK yellow plate as a gray image and turns Proof Colors on. |
| `proof-setup` | Proof Setup... |  | Opens Proof Setup. |
| `rail-columns` | Tools in Two Columns |  | Lays the toolbar out in one or two columns. |
| `screen-full` | Full Screen Mode |  | Full screen with no menu bar. |
| `screen-menu` | Full Screen Mode with Menu Bar |  | Full screen with the menu bar kept. |
| `screen-next` | Change Screen Mode | F | Steps through standard, menu and full screen modes. |
| `screen-standard` | Standard Screen Mode |  | Shows the normal window with its title bar. |
| `selection-display-tint` | Selection Display: Tint |  | Switches the selection display between marching ants and a red tint over what is not selected, outside Quick Mask; the choice is remembered on this device. |
| `show-all-extras` | Show All |  | Shows every canvas helper: guides, grid, slices, notes, counts, selection edges and layer edges. |
| `show-artboard-guides` | Artboard Guides |  | Shows or hides the guides that belong to an artboard. |
| `show-brush-preview` | Brush Preview |  | Shows or hides the tint that fills the brush tip while its size or hardness is dragged. |
| `show-comfy-dot` | ComfyUI Connection |  | Shows or hides the ComfyUI connection dot on the title bar icon; it asks your own ComfyUI address every 30 seconds. |
| `show-counts` | Show Count |  | Shows or hides the count numbers on the canvas. |
| `show-edit-pins` | Edit Pins |  | Shows or hides the pins placed on a layer during Puppet Warp. |
| `show-extras-options` | Show Extras Options... |  | Opens a dialog with a check box for each canvas helper that View > Extras shows: notes, count, selection edges, layer edges, target path, brush preview, mesh and edit pins. |
| `show-layer-edges` | Show Layer Edges |  | Shows or hides a box around the active layer's bounds. |
| `show-mesh` | Mesh |  | Shows or hides the mesh lines drawn over a layer during Puppet Warp and Warp. |
| `show-no-extras` | Show None |  | Hides every canvas helper: guides, grid, slices, notes, counts, selection edges and layer edges. |
| `show-notes` | Show Notes |  | Shows or hides the note markers on the canvas. |
| `show-selection-edges` | Show Selection Edges |  | Shows or hides the marching outline of the selection. |
| `show-smart-guides` | Smart Guides |  | Turns the alignment lines drawn while moving or transforming on or off; snapping itself is kept. |
| `show-target-path` | Target Path |  | Shows or hides the outline of the current work path while a tool other than the pen tools is active. |
| `slice-options` | Slice Options... |  | Opens the active slice's name, URL, alt text and exact position and size for editing. (changes the picture) |
| `slices-from-guides` | Slices From Guides |  | Replaces the user slices with one slice per cell between the guides. (changes the picture) |
| `snap` | Snap | Shift+Mod+; | Turns snapping on or off for moving and transforming; the Snap To choices are kept. |
| `snap-all` | Snap To All |  | Turns every Snap To target on, or all off when they are all on. |
| `snap-bounds` | Snap To Document Bounds |  | Turns snapping to the document edges and center on or off. |
| `snap-grid` | Snap To Grid |  | Turns snapping to the visible grid on or off. |
| `snap-guides` | Snap To Guides |  | Turns snapping to visible guides on or off. |
| `snap-layers` | Snap To Layers |  | Turns snapping to the edges and centers of other visible layers on or off. |
| `snap-selection` | Snap To Selection |  | Turns snapping to the edges and center of the current selection on or off. |
| `snap-slices` | Snap To Slices |  | Turns snapping to the edges of shown slices on or off. |
| `task-bar-pin` | Pin Task Bar |  | Pins the Contextual Task Bar where it stands, or lets it follow the selection again. |
| `task-bar-reset` | Reset Task Bar Position |  | Puts the Contextual Task Bar back at the bottom center of the canvas. |
| `tile-grid` | Tile Grid |  | Shows or hides a dashed grid of the 256 pixel tiles the GPU and giant layers work in. |
| `toggle-auto-slices` | Toggle Auto Slices |  | Shows or hides the dashed auto slices that fill the space between user slices. |
| `toggle-dock-panels` | Toggle Dock Panels | Shift+Tab | Shows or hides the panel column and the properties column, and keeps the toolbar and the options bar. |
| `toggle-extras` | Toggle Extras |  | Turns every canvas helper on or off at once: notes, counts, selection edges and layer edges. |
| `toggle-grid` | Toggle Grid | Mod+' | Shows or hides the grid. |
| `toggle-guides` | Toggle Guides | Mod+; | Shows or hides guides. |
| `toggle-panels` | Toggle Panels | Tab | Shows or hides every panel and the toolbar; in Full Screen Mode it returns to the standard screen. |
| `toggle-rulers` | Toggle Rulers | Mod+R | Shows or hides the rulers. |
| `toggle-show-slices` | Toggle Show Slices |  | Shows or hides the slice rectangles and their numbers. |
| `toggle-task-bar` | Toggle Task Bar |  | Shows or hides the Contextual Task Bar, the pill over the canvas with the next likely steps (Generative Fill, Select Subject, Remove Background). |
| `transform-controls` | Transform Controls |  | Shows or hides transform handles on the layer. |
| `zoom-in` | Zoom In | Mod+= | Zooms in. |
| `zoom-out` | Zoom Out | Mod+- | Zooms out. |

## Window

| Id | Name | Keys | Does |
| --- | --- | --- | --- |
| `about` | About FormVis |  | Opens the About dialog. |
| `action-stop` | Stop Recording |  | Stops recording an action. |
| `actions` | Actions... |  | Opens the Actions panel to record and play steps. |
| `agent.chat` | Chat with Claude |  | Shows the terminal dock on its Chat tab, a conversation with Claude about the open picture that works through formvis's tools, or hides the dock while that tab is showing. |
| `agent.claude.open` | Claude Code |  | Shows the terminal dock on a Claude Code tab (opening one if none is running), or hides the dock while that tab is showing. |
| `agent.connect.copy-claude-code` | Copy Claude Code Connect Line |  | Copies the claude mcp add line that registers formvis in Claude Code. |
| `agent.connect.copy-claude-desktop` | Copy Claude Desktop Connect JSON |  | Copies the mcpServers JSON, with this copy of formvis installed path, for Claude Desktop settings. |
| `agent.connect.open` | Agent Connect |  | Shows or hides Agent Connect: which outside agents may act, their policy, approvals and activity. |
| `arrange-2up-h` | 2-up Horizontal |  | Shows the active document and one other stacked top and bottom; the other is a read-only view tile. |
| `arrange-2up-v` | 2-up Vertical |  | Shows the active document and one other side by side; the other is a read-only view tile. |
| `arrange-3up` | 3-up |  | Shows the active document with two others as read-only view tiles. |
| `arrange-3up-h` | 3-up Horizontal |  | Shows the active document with two others in three rows; the others are read-only view tiles. |
| `arrange-3up-v` | 3-up Vertical |  | Shows the active document with two others in three columns; the others are read-only view tiles. |
| `arrange-4up` | 4-up |  | Shows the active document with three others as read-only view tiles. |
| `arrange-6up` | 6-up |  | Shows the active document with five others as read-only view tiles. |
| `arrange-cascade` | Cascade |  | Puts every floating window back in a stepped stack from the top left, all one size, so none is lost off screen. |
| `arrange-tabs` | Consolidate All to Tabs |  | Returns every open document to the tab strip, one at a time on the Stage; closes the floating windows and extra views. |
| `arrange-tile` | Tile |  | Picks the layout that fits the number of open documents: two side by side, 3-up for three, 4-up for four and 6-up for five or more. |
| `arrange-tile-h` | Tile All Horizontally |  | Tiles every open document stacked in rows of equal height, however many are open; the active one is the live Stage and the rest are read-only view tiles. |
| `arrange-tile-v` | Tile All Vertically |  | Tiles every open document side by side in columns of equal width, however many are open; the active one is the live Stage and the rest are read-only view tiles. |
| `assistant` | Assistant | Alt+Mod+J | Shows or hides the Assistant panel. |
| `benchmark` | Performance Benchmark... |  | Opens the performance benchmark. |
| `brush-harder` | Increase Brush Hardness |  | Makes the paint brush 25 percent harder. |
| `brush-settings` | Brush Settings... | F5 | Opens Brush Settings. |
| `brush-size-down` | Decrease Brush Size |  | Makes the paint brush one step smaller, the step growing with the size. |
| `brush-size-up` | Increase Brush Size |  | Makes the paint brush one step larger, the step growing with the size. |
| `brush-softer` | Decrease Brush Hardness |  | Makes the paint brush 25 percent softer. |
| `check-for-updates` | Check for Updates... |  | Asks the update server whether a newer formvis is available and offers to install it and restart; says so when this build has no update key. |
| `console-log` | Console... |  | Opens the Console, a viewer of this window’s errors and the end of the engine log with a level filter, a text filter, copy, clear and the log path. |
| `copy-engine-log` | Copy Engine Log |  | Copies the end of the engine's log file (Logs/formvis-engine.log in the data folder) to the clipboard. |
| `copy-error-log` | Copy Error Log |  | Copies the error log to the clipboard. |
| `delete-brush-preset` | Delete Brush Preset |  | Deletes a saved or imported brush preset by id; the built-in presets stay. |
| `delete-frame` | Delete Frame |  | Deletes the current animation frame. (changes the picture) |
| `delete-workspace` | Delete Workspace |  | Deletes the saved workspace chosen in the title bar and returns to Essentials; the built-in workspaces cannot be deleted. |
| `demo-design` | Type and design |  | Opens the design demo as a new, unsaved document: an event kit on three artboards with live type, shape layers, layer styles and Smart Filters. |
| `demo-open` | Open a Demo |  | Opens one of the three demos by id (paint, retouch, design) as new, unsaved documents; nothing open is replaced. Param id. |
| `demo-paint` | Painting and photo editing |  | Opens the painting demo as new, unsaved documents: a landscape painted with the brush over masks, adjustment layers and type, the poster Above the Clouds and five photographs. |
| `demo-retouch` | Selections and retouching |  | Opens the retouching demo as new, unsaved documents: a portrait retouched with Spot Healing, Clone Stamp and Selection-Aware Fill with a refined subject selection, and a photograph with a chain selected for Remove. |
| `developer-tools` | Developer Tools |  | Opens the web inspector of the desktop window; in a browser tab it says to use the browser's own developer tools. |
| `float-all-windows` | Float All in Windows |  | Gives every open document a floating window of its own. |
| `float-window` | Float in Window |  | Detaches a view of the current document into a floating window inside the app, with its own zoom, pan and rotation; drag its title to move it and its edges to resize it. |
| `get-brush` | Get Brush Settings |  | Returns the brush: size, hardness, opacity, flow, mode, preset, tip shape, jitters, scatter, texture, dual brush, color dynamics and transfer. |
| `glyphs` | Glyphs |  | Opens Glyphs, a grid of Unicode characters to add to a type layer. |
| `help` | formvis Help | F1 | Opens the formvis manual. |
| `interface-darken` | Darken Interface | Shift+Mod+F1 | Switches to the next darker interface theme, ordered by the theme background; does nothing at the darkest. |
| `interface-lighten` | Lighten Interface | Shift+Mod+F2 | Switches to the next lighter interface theme, ordered by the theme background; does nothing at the lightest. |
| `jobs-list` | Jobs |  | Opens or closes the list of running background jobs (opening a giant PSB, saving, exporting in parts, banded filters), each with its name, progress bar, percent and its own Stop. |
| `manage-plugins` | Manage Plugins... |  | Opens the plugins dialog, which lists each plugin with whether it runs, its commands, their keys and its latest error. |
| `match-all` | Match All |  | Matches zoom, location and rotation across open documents. (changes the picture) |
| `match-location` | Match Location |  | Centers every open document on the same point as the current one. (changes the picture) |
| `match-rotation` | Match Rotation |  | Gives every open document the current view rotation. (changes the picture) |
| `match-zoom` | Match Zoom |  | Gives every open document the current zoom. (changes the picture) |
| `merge-columns` | Merge Panel Columns |  | Merges the panel columns into one. |
| `move-brush-preset` | Move Brush Preset |  | Moves a saved or imported brush preset into a folder, before another preset when before is given, else last. |
| `new-frame` | New Frame |  | Adds a frame to the frame animation. (changes the picture) |
| `new-window` | New Window for Document |  | Opens a second view of the current document, titled name (2), as a tile with its own zoom, pan and rotation; edits show in both views. |
| `new-workspace` | New Workspace... |  | Asks for a name and saves the panel arrangement as it is now, which of them show and in what order, as a workspace in the title bar list. |
| `next-appearance` | Next Appearance Mode |  | Cycles the appearance between Dark, Light and Auto, where Auto follows the system scheme. |
| `next-document` | Next Document | Mod+Tab | Switches to the next open document in the tab strip, wrapping from the last to the first. |
| `notices` | Notices... |  | Opens the list of the notices shown so far, newest first, with the time and a count for repeats; Clear empties it. |
| `open-plugins-folder` | Open Plugins Folder |  | Shows the plugins folder in the system file manager. |
| `panel-actions` | Actions | Alt+F9 | Shows or hides the Actions panel (Alt+F9): the actions as a list or as colored buttons, with Record, Stop, Play and the steps of the chosen action. |
| `panel-activate` | Activate Panel |  | Shows a panel if it is hidden, opens it if folded, brings a floating one to the front and, given a tab id, puts that tab in front of its group; params panel. |
| `panel-adjustments` | Adjustments |  | Shows or hides the Adjustments panel. |
| `panel-brushes` | Brushes |  | Shows or hides the Brushes panel. |
| `panel-channels` | Channels |  | Shows the Channels tab, opening the layers panel group if it is hidden. |
| `panel-character` | Character |  | Shows or hides the Character panel. |
| `panel-clone-source` | Clone Source |  | Shows or hides the Clone Source panel. |
| `panel-close-group` | Close Panel Group |  | Closes a whole panel group, every tab in it, by hiding it; param panel is a group id or a tab id; the Window menu shows it again. |
| `panel-color` | Color | F6 | Shows the Color picker, opening its panel group if it is hidden. |
| `panel-comfyui` | ComfyUI |  | Shows or hides the ComfyUI panel, ComfyUI's own page inside the window, with a Save graph bar that keeps the graph ComfyUI ran last as a recipe (new, or replacing one) and reports the nodes and models ComfyUI lacks. |
| `panel-develop` | Camera Raw |  | Opens or closes Camera Raw (the Develop filter) as a dock panel that tears off and docks back like the other panels, with its controls kept as they are. |
| `panel-dock` | Dock Panel |  | Returns a floating panel to its place in its column; params panel. |
| `panel-extensions` | Extensions |  | Shows or hides the Extensions panel: every Form extension FormPortal installed or form.ext runs here, with its version, source, permissions and state, and Open for its panels. |
| `panel-float` | Float Panel |  | Lifts a panel out of its column into a window of its own that can be moved and resized; params panel (group id or tab id), x, y, w, h. Where it stands is remembered. |
| `panel-generate` | Generate |  | Shows or hides the Generate panel. |
| `panel-gradients` | Gradients |  | Shows or hides the Gradients panel. |
| `panel-group` | Change Panel Group |  | Moves a tab into another panel group; params tab and group; a group holds seven tabs at most. |
| `panel-histogram` | Histogram |  | Shows or hides the Histogram panel. |
| `panel-history` | History |  | Shows or hides the History panel. |
| `panel-info` | Info |  | Shows or hides the Info panel. |
| `panel-layer-comps` | Layer Comps |  | Shows or hides the Layer Comps panel. |
| `panel-layers` | Layers | F7 | Shows or hides the Layers panel. |
| `panel-measurement-log` | Measurement Log |  | Shows or hides the Measurement Log panel. |
| `panel-modifier-keys` | Modifier Keys |  | Shows or hides the Modifier Keys panel. |
| `panel-navigator` | Navigator |  | Shows or hides the Navigator panel. |
| `panel-notes` | Notes |  | Shows or hides the Notes panel. |
| `panel-options` | Options |  | Shows or hides the options bar on its own, leaving the tool rail and the panels; the choice is remembered. |
| `panel-paragraph` | Paragraph |  | Shows or hides the Paragraph panel. |
| `panel-paths` | Paths |  | Shows or hides the Paths panel. |
| `panel-patterns` | Patterns |  | Shows or hides the Patterns panel. |
| `panel-properties` | Properties |  | Shows or hides the Properties panel. |
| `panel-properties-col` | Properties Column |  | Shows or hides the Properties column. |
| `panel-reference` | Reference |  | Shows or hides the Reference panel. |
| `panel-shapes` | Shapes |  | Shows or hides the Shapes panel. |
| `panel-styles` | Styles |  | Shows or hides the Styles panel. |
| `panel-swatches` | Swatches |  | Shows or hides the Swatches panel. |
| `panel-timeline` | Timeline |  | Shows or hides the Timeline panel. |
| `panel-tools` | Tools |  | Shows or hides the tool rail on its own; the choice is remembered. |
| `play-animation` | Play Animation |  | Plays or stops the frame animation. |
| `pref-home-last-close` | Show Home Screen When the Last Document Closes |  | Turns the Home screen after the last document closes on or off (Preferences > General); off, closing the last document leaves the empty workspace. |
| `pref-home-launch` | Show Home Screen at Launch |  | Turns the Home screen at launch on or off (Preferences > General); on shows it while no document is open at start. |
| `pref-whats-new-auto` | Show What's New Once After an Update |  | Turns on or off opening What's New once after an update (Preferences > General). |
| `previous-document` | Previous Document | Shift+Mod+Tab | Switches to the previous open document in the tab strip, wrapping from the first to the last. |
| `record-performance` | Record Performance... |  | Records 10 seconds of real use and reports what took the time: canvas draws, engine events, input handlers, pixel reads and uploads, frame gaps. |
| `reload-plugins` | Reload Plugins |  | Drops every running plugin and loads the enabled ones in the plugins folder again from disk. |
| `reload-window` | Reload Window |  | Reloads the app window after asking when a document has unsaved changes; open documents return through the Restore Session preference. |
| `rename-brush-group` | Rename Brush Folder |  | Renames a folder of saved or imported brush presets. |
| `rename-brush-preset` | Rename Brush Preset |  | Renames a saved or imported brush preset by id. |
| `reset-panels` | Reset Panels |  | Restores the default panel layout. |
| `save-brush-preset` | Save Brush Preset |  | Saves the current brush as a preset in a folder (My Brushes unless group is given) and selects it. |
| `script-console` | Script Console... |  | Opens the Script Console, a log with a one-line input that runs JavaScript with formvis.run to run any catalogue command, formvis.commands to list them and formvis.api, the plugin API. |
| `search` | Search... | Mod+K | Opens the command palette; tool modes such as Polygonal Lasso are listed on their own and a switch shows On or Off. |
| `set-brush` | Set Brush Settings |  | Sets any of the brush values by name (size, hardness, opacity, flow, mode, preset, angle, roundness, spacing, jitters, scatter, count, flips, noise, wet edges, texture, dual brush, color dynamics, transfer) and returns the brush as it is after. |
| `settings` | Preferences... | Mod+, | Opens Preferences. |
| `sheet-panels` | Panels Sheet |  | Opens the Panels sheet on narrow screens. |
| `sheet-props` | Properties Sheet |  | Opens the Properties sheet on narrow screens. |
| `sheet-tools` | Tools Sheet |  | Opens the Tools sheet on narrow screens. |
| `shortcuts` | Keyboard Shortcuts... | Alt+Shift+Mod+K Shift+/ | Opens the Keyboard Shortcuts editor. |
| `system-info` | System Info... |  | Shows the version, system, graphics adapter, monitor, the engine's memory use as the operating system counts it, the data folder, the engine log and the start switches, with a Copy button. |
| `terminal.new` | New Terminal |  | Opens a new terminal tab. |
| `terminal.toggle` | Terminal | Mod+J | Shows or hides the terminal dock. |
| `theme-adwaita-dark` | Theme: Adwaita Dark |  | Switches the window to the Adwaita Dark theme; nothing in the window is rebuilt. |
| `theme-adwaita-light` | Theme: Adwaita Light |  | Switches the window to the Adwaita Light theme; nothing in the window is rebuilt. |
| `theme-breeze-dark` | Theme: Breeze Dark |  | Switches the window to the Breeze Dark theme; nothing in the window is rebuilt. |
| `theme-classic` | Theme: Classic |  | Switches the window to the Classic theme; nothing in the window is rebuilt. |
| `theme-contrast` | Theme: High Contrast |  | Switches the window to the High Contrast theme; nothing in the window is rebuilt. |
| `theme-duck` | Theme: Duck |  | Switches the window to the Duck theme; nothing in the window is rebuilt. |
| `theme-ember` | Theme: Ember |  | Switches the window to the Ember theme; nothing in the window is rebuilt. |
| `theme-forest` | Theme: Forest |  | Switches the window to the Forest theme; nothing in the window is rebuilt. |
| `theme-github-dark` | Theme: GitHub Dark |  | Switches the window to the GitHub Dark theme; nothing in the window is rebuilt. |
| `theme-light` | Theme: Light |  | Switches the window to the Light theme; nothing in the window is rebuilt. |
| `theme-midnight` | Theme: Midnight Blue |  | Switches the window to the Midnight Blue theme; nothing in the window is rebuilt. |
| `theme-mono` | Theme: Mono Ink |  | Switches the window to the Mono Ink theme; nothing in the window is rebuilt. |
| `theme-nineties` | Theme: 90s |  | Switches the window to the 90s theme; nothing in the window is rebuilt. |
| `theme-nodemode-dark` | Theme: NodeMode Dark |  | Switches the window to the NodeMode Dark theme; nothing in the window is rebuilt. |
| `theme-ocean` | Theme: Deep Ocean |  | Switches the window to the Deep Ocean theme; nothing in the window is rebuilt. |
| `theme-pro-dark` | Theme: Pro Dark |  | Switches the window to the Pro Dark theme; nothing in the window is rebuilt. |
| `theme-pro-light` | Theme: Pro Light |  | Switches the window to the Pro Light theme; nothing in the window is rebuilt. |
| `theme-pro-light-grey` | Theme: Pro Light Gray |  | Switches the window to the Pro Light Gray theme; nothing in the window is rebuilt. |
| `theme-pro-medium-grey` | Theme: Pro Medium Gray |  | Switches the window to the Pro Medium Gray theme; nothing in the window is rebuilt. |
| `theme-rose` | Theme: Rose Noir |  | Switches the window to the Rose Noir theme; nothing in the window is rebuilt. |
| `theme-sand` | Theme: Sand (light) |  | Switches the window to the Sand (light) theme; nothing in the window is rebuilt. |
| `theme-slate` | Theme: Slate |  | Switches the window to the Slate theme; nothing in the window is rebuilt. |
| `theme-soft-dark` | Theme: Soft Dark |  | Switches the window to the Soft Dark theme; nothing in the window is rebuilt. |
| `theme-soft-light` | Theme: Soft Light |  | Switches the window to the Soft Light theme; nothing in the window is rebuilt. |
| `theme-solarized-dark` | Theme: Solarized Dark |  | Switches the window to the Solarized Dark theme; nothing in the window is rebuilt. |
| `theme-studio` | Theme: Studio Dark |  | Switches the window to the Studio Dark theme; nothing in the window is rebuilt. |
| `theme-sync-system` | Sync Theme with System |  | Follows the system light or dark scheme: the theme becomes Light when the system is light and Studio Dark when it is dark, and changes live with the system. |
| `theme-terminal` | Theme: Terminal Green |  | Switches the window to the Terminal Green theme; nothing in the window is rebuilt. |
| `theme-violet` | Theme: Violet Haze |  | Switches the window to the Violet Haze theme; nothing in the window is rebuilt. |
| `tool-preset-apply` | Apply Tool Preset |  | Applies a saved tool preset by name: switches to its tool and sets its options. |
| `tool-presets` | Tool Presets |  | Opens Tool Presets, saved sets of a tool's options. |
| `tween-frames` | Tween... |  | Opens the Tween dialog to add in-between frames. (changes the picture) |
| `whats-new` | What's New... |  | Opens What's New: the additions of the current and recent releases, each with a Show Me button that runs its command. |
| `workspace-pixelart` | Pixel Art Workspace |  | Arranges the panels for pixel work: swatches and navigator first, then layers, the timeline and history. |
