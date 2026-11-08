# Contributing to form.ext

Thank you for helping. form.ext is the studio people use to make extensions for the Form apps: it makes, previews,
checks, packages, signs and publishes `.formpkg` extensions against the Form Extension Contract. Contributing here
is different from contributing to a Form app, and different again from publishing an extension, so first find which
of these you want to do.

## Which repository your change belongs in

| You want to | Where it goes |
| --- | --- |
| Publish an extension you made, or update one | **Not here.** Submit it to [form.ext-registry](https://github.com/nodemode-dev/form.ext-registry): form.ext's Publish step has **Submit to Registry**, and the registry's [SUBMITTING.md](https://github.com/nodemode-dev/form.ext-registry/blob/main/SUBMITTING.md) has the steps by hand. Pull requests here that add someone's extension are closed with a link to the registry. |
| Fix or improve the studio: the window, the panes, the engine, the command line, the MCP server, the desktop shell | Here, as described below. |
| Add or improve a starter (`templates/<app>/`) or the `@formai/ext` SDK (`sdk/`) | Here. These folders stay under the Apache License 2.0 so that what people make from them is theirs. |
| Change the contract itself: the manifest, permissions, the host bridge, `formpkg` (`contract/`) | **Not here first.** `contract/` is the Form Extension Contract kit, vendored unchanged in every Form app and in the registry. Open an issue that describes the change; once the kit changes, the maintainers copy the whole kit into every repository, this one included. A pull request that edits `contract/` alone is closed. |
| Change how a Form app hosts extensions | In that app's repository; its host skill under `.claude/skills` here is copied from it unchanged and is never edited here. |

## Where to start

- **Use it and report what goes wrong.** Make an extension from a starter, try it in Preview, run Check and Package,
  and open an issue with the steps, the version (`./formext version`) and your platform when something breaks.
- **Look at the open issues.** Comment on one before starting larger work, so nobody builds the same thing twice.
- **Starters are welcome.** A good starter works the moment it is made, uses only the permissions it needs, and
  passes Check with no warnings; every Form app should have one for each kind of extension it hosts.

## Setting up

Clone the repository and run `./formext_oc_install`, then `./formext` (or `formext_oc_install.bat` and `formext.bat`
on Windows). The first installs the engine's virtual environment and the interface's packages; the second starts the
engine on 127.0.0.1:8640 and the interface on http://localhost:5640. `./formext help` lists every command and
`./formext doctor` checks the toolchain. `./formext agents install` sets up Claude Code, Codex and Cursor for working
on extensions in plain language; for working on form.ext itself, they load the `formext-skillset` skill.

The code lives in:

| Folder | What is there |
| --- | --- |
| `frontend/src` | the interface (vanilla TypeScript, Vite): the shell in `shell/`, one folder per pane in `panes/`, the simulated hosts in `sim/` |
| `backend/app` | the engine (Python, FastAPI): one router per file in `routers/`, the work in `services/`, the command line and MCP server |
| `templates` | the starters, one folder per Form app (Apache-2.0) |
| `sdk` | the `@formai/ext` SDK extensions are built with (Apache-2.0) |
| `contract` | the Form Extension Contract kit, vendored unchanged (Apache-2.0) |
| `src-tauri` | the desktop shell (Rust, Tauri 2) and its frozen engine sidecar |
| `setup` | install, build and agent scripts (`setup/agents.py`) |
| `.claude/skills`, `.agents` | the formext skills and the Form apps' host skills, mirrored for agents that do not read `.claude` |

## Before you open a pull request

Run the same checks CI runs (the `frontend` and `engine` jobs, both required on `main`):

```sh
(cd frontend && npm ci && npm run build)
(cd backend && pip install -r requirements.txt && python formext_engine.py --selfcheck)
./formext agents sync --check
```

The build type checks the interface and builds it; the self check imports every router and finds the contract kit
and the interface. After changing the MCP tools, the command line or a skill, run `./formext agents sync` so the
skill references and the `.agents` mirror follow.

Then make an extension the way a person would: a new project from a starter, Preview in its simulated app, Check,
and Package twice (the two packages must have the same SHA-256). A change to Check, Package or Sign must keep the
studio's results equal to the registry's `tools/check.py` for the same folder, or a person's extension would pass
here and fail there.

- Keep each pull request to one change.
- Write commit subjects the way the history does, in Conventional Commits: `feat(engine): ...`, `fix(frontend): ...`,
  `docs(...)`. Leave the version and `CHANGELOG.md` alone; a maintainer does both when releasing.
- Edits are surgical and made by hand: no codemods or scripted rewrites of source.
- The window never flashes or shifts: every container exists in its final layout before the first paint, colours,
  sizes and every `z-index` come from `frontend/src/styles/tokens.css`, and icons are inline `currentColor` SVG.
- No emoji anywhere, no em dash in Markdown, no commented-out code.
- Every dependency that ships gets a row in `NOTICE.md` with its licence before it is used.
- Nothing here weakens the sandbox: Preview, Check and Package must refuse what the contract refuses (native code,
  remote scripts, dynamic code, permissions an extension does not use), and the engine stays on loopback.
- Never commit a private key, a `.formpkg` signed with one, or anything from your data folder (`FORMEXT_HOME`).

## Maintainers

form.ext is maintained by:

- the [nodemode-dev](https://github.com/nodemode-dev) organisation on GitHub
- [@nodemode-ai](https://github.com/nodemode-ai)
- [@gbarnai](https://github.com/gbarnai)

Reach them through issues and pull requests. They own every file (`.github/CODEOWNERS`).

## How changes land

Only a maintainer pushes to `main`, and only through a pull request. Everyone else forks the repository and opens a
pull request into `main`. A pull request merges when the `frontend` and `engine` checks pass on an up-to-date branch
and a maintainer has approved it after its last push. Pull requests are merged with a merge commit, so signed
commits keep their signatures.

## Releases

A release is a version, and only a maintainer makes one: the version moves in every place together and the
`CHANGELOG.md` entry is written in the release commit, the last one on its pull request. The desktop builds are made
by FormCompiler. No push from a contributor starts a release.

## Licensing

form.ext is licensed under the GNU General Public License v3.0 ([LICENSE](LICENSE), SPDX `GPL-3.0-only`). By
contributing to it, you agree that your contribution is licensed under the same terms.

The Form Extension Contract kit (`contract/`), the `@formai/ext` SDK (`sdk/`) and the starters (`templates/`) stay
under the Apache License 2.0, so that the extensions people make with form.ext are theirs to license as they choose.
A contribution to one of those folders is licensed under Apache-2.0. Do not move code from the GPL part of the
repository into them.

Only add code you have the right to contribute, and name any third-party code and its licence in the pull request.

## Other people's names and work

Starters and examples describe what they do in their own words. They never copy another product's help text, icons,
presets, sample files or stock media, and no starter, template or command takes another product's feature name.
Test fixtures and screenshots come from this repository's own starters and examples.

## Conduct

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Security problems go through
[SECURITY.md](SECURITY.md), never a public issue.
