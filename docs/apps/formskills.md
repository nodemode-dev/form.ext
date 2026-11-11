# Extensions in formskills

formskills hosts extensions under the Form Extension Contract, API 1 (`api: "1"`). This page is the formskills part of the contract: what `document.read` returns, which commands `document.apply` and `app.run` take, which events the window sends, and where extensions appear. Product id `formskills`, app name `FormSkills`. Extensions arrive with formskills 0.9.0, so use `"minimum_app": "0.9.0"`.

## The document

formskills' document is the library of the Form apps' released skills, the skill the person is reading, their edited copies and their own skills. Released skills are read-only: an extension changes only the person's own copies (`edit-start`, `edit-write`) and their own skills (`own-new`), exactly as the window does.

`document.read` takes `{ what }`. Without `what` it answers `view`.

| `what` | Answer |
| --- | --- |
| `view` | what the window shows: the chosen app, the open skill and file, the filter, the search words, the pane on show |
| `selection` | the chosen app and the open skill and file only |
| `library` | every app with its source and its skills (name, description, licence, format check, script count, files) |
| `skill` | the open skill in full, with your copy's record when there is one; `null` when no skill is open |
| `file` | the open file's text: your copy's text while editing, the released text otherwise; `null` when no skill is open |
| `edits` | your edited copies, what you changed and whether the original changed since |
| `own` | your own skills |

A real `view` snapshot, read by a test extension's dock panel in the window (before the 0.9.0 bump) with FormVis chosen and its colour-science skill open:

```json
{
  "what": "view",
  "app": "formskills",
  "version": "0.8.3",
  "chosen": { "id": "formvis", "name": "FormVis" },
  "pane": "panel",
  "reading": { "app": "formvis", "folder": "formvis-colour-science", "name": "formvis-colour-science", "path": "SKILL.md", "editing": false },
  "filter": "all",
  "search": ""
}
```

Opening the Extensions panel or an extension's dock panel keeps the open skill: `reading` stays set while `pane` is `extensions` or `panel`.

`pane` is one of `apps`, `app`, `reader`, `own`, `results`, `install`, `installed`, `trust`, `guide`, `extensions`, `panel`.

A `library` answer (one app shown, trimmed):

```json
{
  "what": "library",
  "catalogue": "the family catalogue was not used: no copy kept by FormPortal",
  "dev": true,
  "apps": [
    {
      "id": "formvis",
      "name": "FormVis",
      "source": { "kind": "dev", "path": "/home/me/repos/formvis/.claude/skills" },
      "releases": [],
      "pin": null,
      "skills": [
        {
          "folder": "formvis-harness",
          "name": "formvis-harness",
          "description": "Drive FormVis from an agent ...",
          "license": "",
          "check": { "errors": 0, "warnings": 1 },
          "scripts": 0,
          "files": [{ "path": "SKILL.md", "bytes": 5120, "kind": "skill" }]
        }
      ]
    }
  ]
}
```

`source.kind` is `release`, `kept`, `dev` or `missing`, as in `formskills-cli skills`. A `file` answer is `{ "what": "file", "app", "folder", "path", "editing", "bytes", "text" }`, with `text` `null` for a file that is not text.

## Commands

`app.commands` lists these, and `document.apply` and `app.run` take them. They are the window's own actions and the engine commands behind them (the same ones `formskills-cli` runs), so an extension can do nothing the window cannot.

| Command | Args | Result |
| --- | --- | --- |
| `choose` | `{ app }`: an app id, or `yours` | the `view` snapshot |
| `open-skill` | `{ app, skill }` | the `view` snapshot |
| `open-file` | `{ path }`, a path in the open skill | the `view` snapshot |
| `filter` | `{ filter }`: `all`, `topic:<Topic>` or an app id | the `view` snapshot |
| `search` | `{ query }`, two characters or more | the hits: `[{ app, folder, name, description, score, matched, path, snippet }]` |
| `read-file` | `{ app, path }`, the path with the skill folder first | `{ path, bytes, text, note }` |
| `check` | `{ app, skill, copy?: false }` | the format report: `{ folder, name, license, fields, errors, warnings, findings, spec }` |
| `edit-start` | `{ app, skill }` | your copy's record (made if it did not exist) |
| `edit-read` | `{ app, skill, path }` | `{ path, bytes, text, note }` from your copy |
| `edit-write` | `{ app, skill, path, text }`, a file that is in your copy | your copy's record |
| `own-new` | `{ name, description? }` | the new skill's record; `name` follows the skill format |
| `edits` | `{}` | your copies |
| `own` | `{}` | your own skills |
| `download` | `{ app, skill? }` | `{ path, name, skills, files, bytes }`, the zip saved in Downloads |
| `refresh` | `{}` | the `library` snapshot after checking every app's latest release again |
| `demo-open` | `{ demo }`: `explore`, `author` or `install` | `{ demo, opened }`; the demo opens over the window in a sandbox on sample skills, and Exit Demo returns to the window as it was |

Your own skills use the app id `yours` in `edit-read`, `edit-write` and `check` (`copy: true`).

Not offered to extensions: installing into agents' folders, pinning a release, discarding a copy, and marking a changed original as seen. Those stay with the person.

### One undoable step

formskills had no undo before extensions. Each `document.apply` call, and each `app.run` of `edit-start`, `edit-write` or `own-new`, is one step: the status line says `<label> (Extension name)` with an Undo button, and Undo puts every file the step wrote back to its text before the step and deletes a copy or skill the step made. One step is kept; the next step replaces it. When an op fails, the ops before it stay applied and still form the step, and the call fails with -32004 and the app's own message.

```js
await call('document.apply', {
  label: 'Add a licence line',
  ops: [
    { command: 'edit-start', args: { app: 'formvis', skill: 'formvis-harness' } },
    { command: 'edit-write', args: { app: 'formvis', skill: 'formvis-harness', path: 'SKILL.md', text: '---\nname: formvis-harness\n...' } },
  ],
});
```

When the window is showing the file an op writes, the editor takes the new text in place.

## Events

`ext.event` names sent to every open extension frame:

| Name | Data | When |
| --- | --- | --- |
| `document.changed` | `{ reason }`: `library`, `edit`, `own` or `undo` | the library was read, a copy was saved (by the person or an extension), your skills changed, an Undo ran |
| `selection.changed` | the `selection` snapshot | another app was chosen, a skill or file was opened or closed |

`ext.theme` is sent when the system switches between dark and light. The tokens are formskills' Studio Dark tokens under the contract's names: `--bg` (ground), `--panel` (pane), `--text` (ink), `--muted` (soft ink), `--accent` (orange), `--border` (edge), `--radius` (small radius), plus `--float`, `--control`, `--fault` and `--live`.

## Files and network

- `files.open`: yes. The person picks through a file chooser opened by the window (the system picker in the app, the browser's picker in a browser).
- `files.save`: yes, the way formskills saves everything: into the Downloads folder (or `FORMSKILLS_DOWNLOADS`), after the person agrees in formskills' own dialog, which names the file. In a browser it is the browser's download.
- `net.fetch`: not available (-32003). The window never reaches the network; only the engine reads the signed family catalogue.
- `storage.*`: yes, 256 KB per extension, kept in the window's storage.

## Where extensions appear

- **Extensions menu**: the Extensions button in the header bar, beside Installed, Trust and Skill format (formskills has no menu bar; the header holds its other commands). It lists each contributed command as `Name: Title`, then Extensions Panel, Reload Extensions and Manage in FormPortal (`formai://extensions?product=formskills`).
- **Extensions panel**: opens in the detail pane, where formskills shows its other panes. One row per extension: name, version, source (Catalogue, File, Development), permission chips, state (Ready, Needs Permission, Refused with the reason), Open for each panel, and the folder of a development extension.
- **Dock panels** (`location: "dock"`) open in the detail pane with the title `Extension name: Panel title` and a Close button; the frame stays alive while the person looks at another pane.
- **Dialog panels** (`location: "dialog"`) open as a modal in formskills' dialog style.
- formskills has no command palette; contributed commands are in the Extensions menu and on the command line.

## Running one

From a folder: form.ext's Run in App writes `extensions/formskills/dev.json` under FormPortal's root, `{ "format": "formext-dev-extensions", "format_version": 1, "product": "formskills", "extensions": [{ "id", "path", "added" }] }`. formskills reads it within 2 s while its window has focus, or at once on Reload Extensions, and lists the extension with the source Development. A development extension's version is its manifest's.

Installed: FormPortal unpacks a `.formpkg` and lists it in `extensions/formskills/enabled.json`; formskills shows it with the source Catalogue, or File when side-loaded.

FormPortal's root is `FORMPORTAL_ROOT` when set; otherwise `~/Library/Application Support/studio.formai.portal` on macOS (`dev.formai.portal` when only that exists), `%LOCALAPPDATA%\FormPortal` on Windows, `$XDG_DATA_HOME/formportal` or `~/.local/share/formportal` elsewhere.

In the app, extension files are served on the `formext://` protocol (`formext://{id}/{version}/{path}`; Windows webviews reach it as `http://formext.localhost/{id}/{version}/{path}`). In the browser build they are served by the Vite dev server at `/api/extensions/files/{id}/{version}/{path}`, with the list at `/api/extensions`.

## Agents and the command line

```sh
./formskills cli extensions list                      # id, name, version, source, state, reason, commands (JSON)
./formskills cli extensions command <id> <command> ['{"args":1}']   # asks the open window to run it
```

`extensions command` hands the request to the formskills window, which runs it with the same consent as its menu: an extension that was never allowed asks the person first, and a refusal fails. It fails at once when no window takes the request within 10 s.

## Testing in a browser

```sh
cargo build -p formskills-cli
cd frontend && FORMSKILLS_ENGINE=1 FORMSKILLS_DEV=1 FORMSKILLS_DEV_ROOTS=/path/to/checkouts FORMPORTAL_ROOT=/tmp/portal npm run dev
```

`FORMSKILLS_ENGINE=1` makes the Vite dev server answer the window's engine calls through `formskills-cli` (`FORMSKILLS_CLI` names another binary), so the browser window reads real skills and real extensions with the same Rust resolver the app uses.
