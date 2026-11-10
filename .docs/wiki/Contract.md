# Contract

form.ext builds against the Form Extension Contract, API 1, the same kit every Form app vendors. It is in `contract/` unchanged:

| Path | What |
| --- | --- |
| `contract/CONTRACT.md` | the spec: the package, where apps find extensions, serving files, the sandbox, the protocol, permissions and consent, what every host shows |
| `contract/sdk/formext.ts` | the extension side, published as [`@formai/ext`](SDK) |
| `contract/host/host-bridge.ts` | the host side; form.ext's Preview runs extensions through it |
| `contract/host/python/formext_host.py` | resolver, manifest checks and safe file serving; the engine imports it |
| `contract/tools/formpkg.py` | validate and build the deterministic `.formpkg`; Check and Package import it |
| `contract/schema/` | the package, index, `enabled.json` and `dev.json` schemas |
| `contract/examples/hello` | the smallest working extension |

A change to the contract is made in the kit first, then copied here with `cp`.

## Each app's API

What `document.read` returns, which commands `document.apply` and `app.run` take, which events arrive and where extensions appear differ per app. Each app documents them in its own `docs/EXTENSIONS.md`; form.ext keeps copies in `docs/apps/<product>.md` (copied with `cp`, never edited here) and shows them under Docs, with search and a table of contents. A pulled source also works as the origin (`[data folder]/sources/[repo]/docs/EXTENSIONS.md`), and `docs` answers from the pulled source when it is newer than the copy here. Refresh a copy when an app's page changes:

```bash
cp ../formcut/docs/EXTENSIONS.md docs/apps/formcut.md
```

The repositories are `formvis`, `formcut`, `formwav`, `formpdf`, `formdeck`, `formlit`, `form.md` (product `formmd`), `formencoder`, `formvfx`, `formMCP` (product `formmcp`), `formtray` and `formskills`. The New starters and the Preview's simulated documents follow the same pages.
