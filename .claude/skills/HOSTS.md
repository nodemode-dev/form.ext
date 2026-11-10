# Host app skills

Skills copied byte for byte from the Form apps' own repositories (`https://github.com/nodemode-dev/[repo]`, branch main), so an agent working in form.ext understands each host app it makes extensions for and can drive the app. They are not edited here: change a skill in its own repository, then fetch it again and update this table. Each folder keeps its name. `./formext agents sync` mirrors them to `.agents/skills`, and `./formext agents install` puts them in the user account with the formext skills.

| Skill | Host app | Source repository | Commit | Licence of the source |
| --- | --- | --- | --- | --- |
| `formvis-driving` | FormVis | `formvis` | `9a84f697ba5fee5a620b7188038decd0b11c2e5e` | Apache-2.0 |
| `formcut-mcp` | FormCut | `formcut` | `8fc8639e8dbd3291f247c74a452eda59247e3056` | Apache-2.0 |
| `formwav-harness` | FormWav | `formwav` | `aa95abef437b54c14743788c4301c694ea2d4c40` | Apache-2.0 |
| `formpdf-harness` | FormPDF | `formpdf` | `859577b4645b2eecc3e85eabc79579f4f0a1394e` | Apache-2.0 |
| `formdeck-harness` | FormDeck | `formdeck` | `29786a4defb49f0ccb0304b53e5ff19cab8f8579` | Apache-2.0 |
| `formlit-driving` | FormLit | `formlit` | `3d81df7455f43627deee426e8a7ad97adc14201b` | Apache-2.0 |
| `formencoder-harness` | FormEncoder | `formencoder` | `f228f47e1e5234a404a676b462fdc31700c7904a` | Apache-2.0 |
| `formvfx-harness` | FormVFX | `formvfx` | `b6dc607cf968c8234515b5ca59f53d3fadc12f46` | Apache-2.0 |
| `formmcp-harness` | formMCP (the family hub) | `formmcp` | `6c6f54140d59d7c5ca219a9b549bb8ef4f892d2e` | GPL-3.0 (`LICENSE` of that repository) |
| `formportal-harness` | FormPortal (installs and updates the apps) | `formportal` | `997d17431616e345f0525d495224605da536a39b` | GPL-3.0 (`LICENSE` of that repository) |

Left out on purpose: the skillsets (`*-skillset`, and `formvis-harness` and `formlit-harness`, which are for changing an app's own code), `formvis-editing` (superseded by `formvis-driving`) and `formvis-colour-science`.

Host apps with no skill that teaches an agent to use them yet: form.md (its only skill, `contextual-compression`, is about compression policy, not driving the app), formtray and formskills. For these, read the app's API page through the formext `docs` tool, pull its source with the `source` tool and read the files it names, and, when formMCP is installed, use its `app_tools` (form.md has its own MCP server; formtray and formskills have none).

The same copies can be taken from form.ext's own source store: `./formext cli source [app]` pulls an app's repository into the data folder (`sources/[repository]/`), and its `.claude/skills` there is the origin for a refresh.

To refresh: clone each repository with `git clone --depth 1 --filter=blob:none --sparse`, run `git sparse-checkout set --no-cone /.claude/ /.agents/ /.mcp.json /AGENTS.md /LICENSE`, copy the skill folders again, update the commits above and run `./formext agents sync`.
