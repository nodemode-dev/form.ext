# FormPortal concepts

Read once per session.

## Ids and names

Product ids are lowercase and come from the registry (`apps`): `formcut`, `formvis`, `formlit`, `formdesign`, `formpath`, `formvfx`, `formencoder`, `formwav`, `formmd` (form.md), `formdam`, `formslide` (FormDeck), `formpdf`, `formtxt`, `formcel`, `formref`, `formsculpt`, `format` (FormAT), `formsurface`, `formweb`, `formmcp` (FormMCP), `formskills` (FormSkills), `formtray`, and `formai` (FormPortal itself, the id the family catalogue uses). Display names keep the owner's spelling: FormCut, form.md.

## Channels

`stable` (default), `beta`, `nightly`. Each channel of a product is a separate install with its own folder, so a beta never replaces the stable build. Whether a product has a beta is the catalogue's answer, not a guess.

## Where installs live

| System | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/studio.formai.portal` |
| Windows | `%LOCALAPPDATA%\FormPortal` |
| Linux | `$XDG_DATA_HOME/formportal` (usually `~/.local/share/formportal`) |

Inside: `apps/[product]/[channel]/[version]/`, `downloads/`, `catalog/apps.json` (the last good catalogue, with its signature) and `installed.json` (the record `installs` reads). `FORMPORTAL_ROOT` moves all of it; use a scratch folder for experiments.

## Trust

- The catalogue must carry a detached Ed25519 signature (`apps.json.sig`) made with a key FormPortal trusts. Without one it is refused with "it is not signed". A catalogue given as a file path is checked the same way, against `apps.json.sig` beside it. `FORMPORTAL_ALLOW_UNSIGNED=1`, set by the person, or `--allow-unsigned` on the command line accepts an unsigned catalogue; it exists for local development catalogues only, and the MCP tools ignore an `allow_unsigned` argument.
- Every artifact is hashed after download and refused unless its SHA-256 equals the catalogue's. Nothing is unpacked before that.
- Only https addresses are fetched, plus http on this computer (127.0.0.1, localhost).
- When the network fails, the last good catalogue is used and says so. When the download store's catalogue cannot be fetched, formcompiler's signed copy on GitHub is tried first.
- Newer releases come from each app's own GitHub release: for a product whose signed `repository` is on GitHub, FormPortal reads the newest published release's `form-app.json` and `SHA256SUMS.txt`, and offers it when it is newer than the catalogue's, names the same repository, is a plain `x.y.z`, is not in formcompiler's `yanked.json`, and the sums carry the manifest's own digest. Its files are hashed against those sums like any other. `info` shows `"origin": "github"` on such a release, and the catalogue's own release moves to its history. `FORMPORTAL_RELEASES=off` or an organisation's `github_releases: false` turns this off; a policy that names its own catalogue has it off unless it says `true`.

## Errors, in FormPortal's words

| Message starts with | Meaning | Do |
| --- | --- | --- |
| the catalogue was refused: it is not signed | no signature next to the catalogue | wrong source, or a development catalogue; only the person can accept it, with `FORMPORTAL_ALLOW_UNSIGNED=1` |
| the catalogue was refused: this build trusts no catalogue key yet | `core/catalog_keys.txt` was empty when this build was made and `FORMAI_CATALOG_PUBKEY` is not set (`status` shows `trusted_keys`); normal builds trust formcompiler's catalogue key from that file | tell the person; the fix is formcompiler's public key in that file and FormPortal rebuilt, or the key in `FORMAI_CATALOG_PUBKEY` |
| the catalogue was refused | the signature does not verify | stop; report it |
| the extension index was refused: this build trusts no registry key yet | `core/registry_keys.txt` holds no form.ext-registry key in this build and `FORMEXT_REGISTRY_PUBKEY` is not set; catalogue keys never verify extensions | tell the person; only the developer setting lists the registry without a key |
| the extension index was refused / the block list was refused | the registry's signature does not verify | stop; report it |
| the registry is private or unreachable | form.ext-registry answered 404 (private while tested) or the network is down | tell the person plainly; nothing to fix here |
| [file] does not match the catalogue: expected SHA-256 | the download differs from the release | stop; report it; do not retry from elsewhere |
| the catalogue offers this computer nothing for | unreleased, no release on that channel, or no file for this system | read `apps` for which one, and the registry status |
| refused address | not https and not this computer | use the https address |
| this build cannot install a [kind] file yet | the release is a phone package (apk, ipa); zip, AppImage, dmg, deb, rpm, msi and NSIS all install | tell the person |
| unpacking a [kind] needs [tool], which this computer does not have | rpm needs bsdtar or rpm2cpio and cpio; deb needs dpkg-deb | name the tool to the person |
| [app] is open (process ...); close it first | remove, or reinstalling the version that is running | ask the person to close the app; never end the process yourself |
| ... It was not installed (an extension) | a package's signature, manifest or native-code rule failed | report the sentence; see `sub-skills/extensions/SUB-SKILL.md` |
| ...'s policy does not allow, or is set by the organisation's policy | an organisation manages this computer | report it; see `sub-skills/organisations/SUB-SKILL.md`; never work around it |
| the organisation's policy at ... is not valid | a broken policy file; every install is refused until it is fixed | tell the person to contact whoever manages the computer |
| no product was given, or there is no channel | a parameter is missing or wrong | fix the call from `apps` |
| a file could not be read or written | disk or permission problem in the install folder | report the path |

## Environment variables

| Variable | Effect |
| --- | --- |
| `FORMPORTAL_ROOT` | install folder |
| `FORMPORTAL_CATALOG` | default catalogue source (https address or local file) |
| `FORMPORTAL_ALLOW_UNSIGNED` | `1` accepts unsigned catalogues |
| `FORMAI_CATALOG_PUBKEY` | an extra trusted catalogue key (base64), for a fork that signs its own catalogue |
| `FORMPORTAL_POLICY` | a policy file to try, read only when no system policy exists |
| `FORMPORTAL_MIRROR_KEY` | the base64 Ed25519 seed `mirror` signs the mirrored catalogue with |
