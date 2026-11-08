# Tool families

Every tool in the formvis MCP catalogue (`TOOLS` in `backend/app/routers/mcp.py`, 50 at 1.67.3) and the sub-skill that covers it. Parameters and notes for each are in `../../formvis-editing/references/tools.md`, which `./formvis agents sync` generates from the catalogue.

| Sub-skill | Tools |
| --- | --- |
| `documents-and-files` | `get_document`, `get_image`, `new_document`, `open_file`, `switch_document`, `undo`, `redo` |
| `layers-and-masks` | `add_layer`, `place_image`, `duplicate_layer`, `set_layer`, `move_layer`, `delete_layer`, `merge_layers`, `flatten_image`, `rasterize_layer`, `remove_background` |
| `selections` | `select`, `select_subject`, `select_color_range` |
| `painting-and-brushes` | `fill` (and `draw_shape`, `generative_fill` for flat or prompted painting) |
| `adjustments-and-filters` | `add_adjustment`, `set_adjustment`, `apply_filter`, `add_film_layer`, `color_match` |
| `colour-and-modes` | `get_document` (mode, depth, profile), `color_match`, `add_adjustment` |
| `type-and-shapes` | `add_text`, `draw_shape` |
| `transform-and-warp` | `transform_layer`, `flip_canvas`, `resize_image`, `resize_canvas`, `crop` |
| `generation-and-ai` | `generative_fill`, `generative_expand`, `generate_image`, `upscale` |
| `steering-selection-aware-fill` | `select`, `run_command` (`content-fill` with `prefer` and `strength`, `clone-source-set`, `paint.stroke`), `get_image`, `undo` |
| `timeline-and-video` | `timeline_get`, `timeline_create`, `timeline_delete`, `timeline_set`, `timeline_go_to`, `timeline_clip`, `timeline_split`, `timeline_keyframe`, `timeline_transition`, `timeline_frame_image`, `timeline_render` |
| `export` | `export_image`, `save_project`, `timeline_render` |
| `terminal` | `list_commands`, `describe_command`, `run_command`, `run_commands` (the command catalogue); no terminal tool |

The server also offers one prompt, `edit_strategy`: the ten-step decision tree for these tools.

## Extensions

Form extensions (installed by FormPortal, or run from a folder by form.ext) add commands of their own. `extensions_list` gives each one's id, version, source, state (`ready`, `needs-permission`, `refused` with the reason) and its commands; `extension_command` with `id`, `command` and optional `args` runs one and waits up to 120 seconds for its result. The first run of an extension version asks the person in the formvis window; while they have not allowed it, the call fails, so say so and let them choose. Its changes are undo steps like any other. From a terminal: `./formvis cli extensions list` and `./formvis cli extensions run [id] [command] key=value`. What extensions themselves may call is in `docs/EXTENSIONS.md`.

## Keeping this in step

When a tool is added, renamed or removed in `mcp.py`, update the matching sub-skill's table and this file in the same change (see `formvis-harness`, sub-skill `agent-bridge`). The generated `tools.md` follows by itself after `./formvis agents sync`. Compare names with:

```text
PATH=$PWD/backend/venv/bin:$PATH python3 -c "import sys; sys.path.insert(0,'backend'); from app.routers.mcp import TOOLS; print(len(TOOLS), [t['name'] for t in TOOLS])"
```
