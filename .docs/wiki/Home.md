# form.ext

The extension studio of the Form family. form.ext makes extensions for every Form app that loads them (FormVis, FormCut, FormWav, FormPDF, FormDeck, FormLit, Form.md, FormEncoder, FormVFX, FormMCP, FormTray and FormSkills): it writes a working project from a starter, edits it with the manifest kept in sync, runs it in a simulated copy of the app, checks it against the Form Extension Contract, loads it live in the real app, builds and signs the deterministic `.formpkg`, and prepares it for FormPortal and formai.studio.

Every step is also a command line command and an MCP tool, so Claude Code and other agents make extensions the same way people do.

## Pages

- [Getting Started](Getting-Started) · install, run, the first extension
- [Making Extensions](Making-Extensions) · Home, New, Edit, Preview, Check, Library
- [Shipping](Shipping) · Run in App, Package and Sign, Publish
- [Contract](Contract) · the Form Extension Contract, API 1, and each app's API
- [SDK](SDK) · `@formai/ext`, the client extensions use
- [Agents](Agents) · the command line, the MCP server, the skills
- [Form Family](Form-Family) · FormPortal, formai.studio and the twelve hosts
- [Architecture](Architecture) · the engine, the interface, the shell
- [Desktop](Desktop) · the Tauri app and the frozen engine
- [Releasing](Releasing) · versions and the release commit

The whole manual is `docs/MANUAL.md`, also under Docs in the app.
