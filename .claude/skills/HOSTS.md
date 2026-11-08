# Host app skills

Skills copied byte for byte from the Form apps' own repositories (`https://github.com/nodemode-dev/[repo]`, branch main), so an agent working in form.ext understands each host app it makes extensions for and can drive the app. They are not edited here: change a skill in its own repository, then fetch it again and update this table. Each folder keeps its name. `./formext agents sync` mirrors them to `.agents/skills`, and `./formext agents install` puts them in the user account with the formext skills.

| Skill | Host app | Source repository | Commit | Licence of the source |
| --- | --- | --- | --- | --- |
| `formvis-driving` | FormVis | `formvis` | `9d69d289634bec8caa595c28625f1db3ce40d7c1` | Apache-2.0 |
| `formcut-mcp` | FormCut | `formcut` | `9b412f0b2bb9a6dbdffcb65ab09997477f9fac6a` | Apache-2.0 |
| `formwav-harness` | FormWav | `formwav` | `fcf232728467dafdc7d425aab1e5eda32e7676b0` | Apache-2.0 |
| `formpdf-harness` | FormPDF | `formpdf` | `cf240abd01bb5b60c9094f257175cd95a1fb37eb` | Apache-2.0 |
| `formdeck-harness` | FormDeck | `formdeck` | `f0bfb2d38844a4b9a1b7b079164746eecfc98106` | Apache-2.0 |
| `formlit-driving` | FormLit | `formlit` | `ad207ba231b89dc162297b12184e6c359592ab9a` | Apache-2.0 |
| `formencoder-harness` | FormEncoder | `formencoder` | `4f05ed99811dc203f461389bc4066370cc4acc63` | Apache-2.0 |
| `formvfx-harness` | FormVFX | `formvfx` | `78c61c537f06f5073e4b9eeb927fc88c42d6e7ec` | Apache-2.0 |
| `formmcp-harness` | formMCP (the family hub) | `formmcp` | `d440619c031207809dd5a666ed2004f7d8e0fbcf` | GPL-3.0 (`LICENSE` of that repository) |
| `formportal-harness` | FormPortal (installs and updates the apps) | `formportal` | `251a7c45c1490d9febcfa083e6355549fb571f4a` | GPL-3.0 (`LICENSE` of that repository) |

Left out on purpose: the skillsets (`*-skillset`, and `formvis-harness` and `formlit-harness`, which are for changing an app's own code), `formvis-editing` (superseded by `formvis-driving`) and `formvis-colour-science`.

Host apps with no skill that teaches an agent to use them yet: form.md (its only skill, `contextual-compression`, is about compression policy, not driving the app), formtray and formskills. For these, read the app's API page through the formext `docs` tool and, when formMCP is installed, its `app_tools`.

To refresh: clone each repository with `git clone --depth 1 --filter=blob:none --sparse`, run `git sparse-checkout set --no-cone /.claude/ /.agents/ /.mcp.json /AGENTS.md /LICENSE`, copy the skill folders again, update the commits above and run `./formext agents sync`.
