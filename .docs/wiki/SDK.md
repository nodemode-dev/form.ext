# SDK

`sdk/` is `@formai/ext`, the extension side of the contract as a publishable npm package:

| File | What |
| --- | --- |
| `src/formext.ts` | the kit's `contract/sdk/formext.ts`, unchanged (copied with `cp`) |
| `dist/formext.js` | ES2020 module built from it |
| `dist/formext.d.ts` | its types |
| `README.md` | the reference: every method, its permission, time-out and errors; also under Docs in the app |
| `package.json`, `tsconfig.json`, `LICENSE` | Apache-2.0 |

```bash
cd sdk && npm run build      # tsc -p tsconfig.json, writes dist/
npm pack --dry-run           # what npm would publish
```

Extensions without a build step copy `dist/formext.js` into their package and import it from their own module. Check recognises the file as the SDK and does not lint it. The New starters ship `ui/formext.js`, a plain JavaScript translation of the same file, so a starter needs no build step either.

When the kit's `sdk/formext.ts` changes, copy it to `contract/sdk/` and `sdk/src/`, rebuild, and raise the package version.
