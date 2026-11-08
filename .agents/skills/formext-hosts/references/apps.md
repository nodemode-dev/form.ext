# The twelve host apps

Source: `docs/apps/[app].md` and `contract/CONTRACT.md`. The page of each app is the authority; this table is the map. "Read" is `document.read {what}`. "Change" is `document.apply` ops or `app.run` commands. Every app lists its commands with `app.commands`.

| App | Host skill to load | Read (`what`) | Change (commands, examples) | Where it appears |
| --- | --- | --- | --- | --- |
| formvis | `formvis-driving` | document, layers, selection, history, image, file | catalogue commands of the palette, and `tool:[name]` window tools | Extensions menu after Plugins; panel in the dock; palette group Extensions |
| formcut | `formcut-mcp` | project, timeline, selection, media, markers, full | marker.add, clip.add, text.add, captions.add and the rest of the edit commands | Extensions menu after View; Extensions tab of the left pane; no palette; tools formcut_extensions_list and formcut_extension_command |
| formwav | `formwav-harness` | session, selection, markers, media, transport | add-marker, add-region, set-loop, add-track, set-track-gain, move-clip, split-clip, set-clip-fades, set-tempo and more; positions in samples and seconds, levels in dB | Extensions menu between Transport and Settings; Extensions panel under More; palette (Cmd or Ctrl K) |
| formpdf | `formpdf-harness` | summary, text, fields, comments, selection, file | command, page_numbers, header_footer, watermark, annotate, fill, form, organize, crop, redact, metadata, compress, sanitize, ocr | Extensions menu between Tools and Window; last tab Extensions; Mod+K |
| formdeck | `formdeck-harness` | deck, slide, slide with id or number, selection, json | apply-ops (set, ins, del, move on the deck JSON), new-slide, duplicate-slide, set-font, align and distribute commands | Extensions menu between Present and Help; right side pane; Shift+Mod+P |
| formlit | `formlit-driving` | summary, selection, photo, catalog | photo.addKeywords, photo.rate, photo.flag, photo.label, collection.create, develop.set, develop.auto, preset.apply, library.select | Extensions menu between Window and Help; right column in every module |
| form.md | none (read the app page) | all, blocks, markdown, selection, outline, page, file | doc.insertMarkdown, doc.replaceBlock, doc.setBlockText, doc.replaceText, doc.markText, page.new, page.newDatabase, page.find | Extensions item in the sidebar foot; Mod+Shift+P; right-side pane |
| formencoder | `formencoder-harness` | queue, selection, watch, presets, formats, history | queue.addSource, queue.setPreset, queue.setSettings, queue.start, encode.estimate, encode.verify, preset.create, captions.convert, watch.add | Extensions menu between Effects and Window; right dock group; Cmd or Ctrl K |
| formvfx | `formvfx-harness` | summary, project, comp, layers, selection, file | comp.new, layer.newSolid, layer.newText, layer.setTransform, prop.set, prop.addKey, effect.apply, keys.easyEase, time.set | Extensions menu between Window and Help; right panel group; Cmd+K |
| formmcp | `formmcp-harness` | its own state (see the page) | set_for, set_expose, set_start, set_tool, tool_list, profile_save, profile_use, select_agent, refresh | Extensions button in the filter row; section under the filter row; no palette |
| formtray | none (read the app page) | all, apps, board, pinned, hidden, updates, view | board.add, group.create, stack.pin, app.hide, app.open, view.show, apps.rescan | Extensions submenu of the tray menu; sheet over the panel; dock panels become Widgets tiles |
| formskills | none (read the app page) | view, selection, library, skill, file, edits, own | choose, open-skill, open-file, filter, search, read-file, check, edit-start, edit-write, own-new | Extensions button in the header; detail pane; no palette |

## Agents and tools per app

Each app exposes `extensions_list` and `extension_command {id, command, args}` as MCP tools (formcut and formwav prefix them with the app name). Command line: `./formdeck cli extensions`, `./formencoder extensions`, `./formlit cli extensions.list`, `./formvfx extensions`, `formmcp cli extensions`, `./formvis cli extensions list`. FormPortal's folder and `dev.json` are the same for all twelve: `extensions/[product]/dev.json`.

## Which host skill answers which question

- How the app models its document, which commands exist, how to drive it: the host skill in the table.
- Which permission an extension needs, the manifest and the sandbox: `formext-harness/sub-skills/writing-extensions`.
- Installing and updating the apps themselves: `formportal-harness`.
- Reaching every installed app's tools with one entry: `formmcp-harness`.
