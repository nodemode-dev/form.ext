---
name: timeline-and-video
description: Building a video timeline in formvis through its MCP tools. Use to make a short animation or video from layers, set frame rate and length, place and trim clips, split a clip, fade in or out, cross fade between layers, keyframe a layer's position, opacity, fill or style, preview a single frame, and render to mp4, gif or numbered PNG frames; the timeline_get, timeline_create and the other timeline tools.
---

# timeline-and-video

A video timeline gives every layer a track: a clip (where it starts and how long it lasts), fades and keyframes. Frames are counted from 0. Every edit is one undoable step; moving the playhead is not an edit. A document has a video timeline or a frame animation, not both.

## Tools

| Tool | Parameters | Notes |
| --- | --- | --- |
| `timeline_get` | none | Read-only. `fps`, `frames`, `seconds`, `current` (playhead), `work_in`, `work_out`, `loops`, and `tracks` top layer first: `id`, `name`, `start`, `length`, `fade_in`, `fade_out`, fade colours, `keyframes`. Says so if there is no timeline |
| `timeline_create` | `fps` (1 to 240, default 30), `seconds` (0.1 to 3600, default 5) | A track per layer. Fails if a timeline or a frame animation exists |
| `timeline_delete` | none | Removes clips, keyframes and transitions; the layers stay |
| `timeline_set` | `fps`, `seconds`, `work_in`, `work_out` (frames, `work_out` excluded), `loops` (0 is forever) | Changes frame rate, length, the work area (what renders) or looping |
| `timeline_go_to` | `frame` | Moves the playhead; the window shows that moment |
| `timeline_clip` | `id`, `start`, `length` | Moves or trims a layer's clip. Outside its clip a layer does not show |
| `timeline_split` | `id`, `frame` (default playhead) | The clip ends at the frame; a copy of the layer carries on with the rest and the same keyframes; returns the copy's id |
| `timeline_keyframe` | `id`, `property` (`x`, `y`, `opacity`, `fill`, `style`), `frame`, `value`, `interpolation` (`linear`, `hold`), `delete`, `clear` | `x`, `y` in pixels, `opacity` and `fill` 0 to 1, `style` 1 or 0. `delete` removes the keyframe at that frame; `clear` removes all of the property's keyframes |
| `timeline_transition` | `id`, `kind` (`fade_in`, `fade_out`, `fade`, `cross_fade`, `remove`), `seconds` (default 1), `color` (`transparent`, `black`, `white`) | Fades over `seconds`; `cross_fade` needs the clip to start or end within another; only the upper layer fades so the picture never dips |
| `timeline_frame_image` | `frame`, `max_size` | One frame as a PNG; check animation without rendering |
| `timeline_render` | `path` (absolute `.mp4`, `.gif` or `.zip`), `from`, `to` (frames, `to` excluded), `scale` (1, 0.5, 0.25) | `.mp4` is H.264, `.zip` holds numbered PNG frames. Replaces a file there; the folder must exist |

## Recipes

### Title that fades in over a photo (5 seconds)
1. `new_document` 1920 by 1080, or `open_file` a photo; add the title with `add_text` (see `type-and-shapes`).
2. `timeline_create` `fps: 30`, `seconds: 5`.
3. `timeline_get` to see the tracks and ids.
4. `timeline_transition` on the title `id`, `kind: "fade_in"`, `seconds: 1`.
5. `timeline_frame_image` at `frame: 0`, `frame: 30` and `frame: 90` to check.
6. `timeline_render` `path: "/Users/me/Videos/title.mp4"`.

### Slide a layer across
1. `timeline_keyframe` the layer `id`, `property: "x"`, `frame: 0`, `value: -400` (off the left edge).
2. `timeline_keyframe` the same `property: "x"`, `frame: 60`, `value: 200`, `interpolation: "linear"`.
3. `timeline_frame_image` at frames 0, 30 and 60.

### Pulse (opacity)
`timeline_keyframe` `property: "opacity"` at frames 0, 15, 30 with values 1, 0.4, 1.

### A cut between two shots
1. Put each shot on its own layer (`place_image`).
2. `timeline_clip` shot A `start: 0`, `length: 90`; shot B `start: 90`, `length: 90`.
3. For a dissolve, start B a little early (`start: 75`) and `timeline_transition` B `kind: "cross_fade"`.

### Hold a value (a hard cut in a property)
`timeline_keyframe` with `interpolation: "hold"` keeps the value until the next keyframe.

### Export a GIF of part of it
1. `timeline_render` `path` ending `.gif`, `from: 0`, `to: 60`, `scale: 0.5` (smaller file).

## Habits

- Use `timeline_get` before editing: ids, clip lengths and keyframes come from it.
- Preview with `timeline_frame_image` rather than rendering to check.
- `timeline_render` can take a long time; the window must stay open. A "did not answer in time" error means the window may still be working: look before retrying.
- Time is frames: `frames = fps * seconds`. 1 second at 30 fps is 30 frames.
- To remove everything and start over, `timeline_delete`; the layers stay.
- `undo` steps back timeline edits like any other.
