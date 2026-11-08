---
name: organisations
description: FormPortal on computers an organisation manages. Use when an install, preference change or extension is refused by a policy, the person asks who manages FormPortal or why a setting is locked, or an administrator wants to lock the catalogue, force update settings, limit which apps or channels install, turn extensions off, deploy FormPortal silently or build one managed package with formportal cli org-package, or mirror the catalogue and its files to an internal server with formportal cli mirror.
---

# organisations

## Read the policy first

`policy` (or `./formportal cli policy`) says whether this computer is managed, by whom, from which file, which settings are `locked`, which apps and channels may be installed, and whether extensions and sideloaded packages are allowed. `status` carries the same summary under `managed`. Read it before suggesting anything a policy would refuse.

The binding policy is a system file an ordinary account cannot change:

| System | Path |
| --- | --- |
| Linux | `/etc/formportal/policy.json` |
| macOS | `/Library/Application Support/FormPortal/policy.json` |
| Windows | `%ProgramData%\FormPortal\policy.json` |

`FORMPORTAL_POLICY` points at a policy file only when no system file exists; it is for trying a policy out, and `policy` reports it as a test policy.

## What a policy can fix

```json
{
  "format": "formportal-policy",
  "managed_by": "Example IT",
  "catalog": "https://apps.example.internal/formportal/apps.json",
  "catalog_keys": ["base64 Ed25519 public key of the mirror"],
  "allow_unsigned": false,
  "auto_update": true,
  "auto_update_beta": false,
  "only_when_closed": true,
  "keep_previous": true,
  "apps": ["formcut", "formvis"],
  "channels": ["stable"],
  "extensions": true,
  "sideload": false
}
```

Every field but `format` is optional; a field left out stays the person's own choice. `catalog` replaces whatever address is asked for; `catalog_keys` adds trusted keys; `allow_unsigned: false` refuses unsigned catalogues even with the developer setting; an update field fixes that preference (`auto_update` also clears the per-app choices); `apps` and `channels` limit what installs; `extensions: false` turns extensions off and `sideload: false` refuses packages installed from a file. An unknown field or a broken file refuses every install until it is fixed, by design.

## When something is refused

The sentence names the policy ("Example IT's policy does not allow formlit on this computer", "auto_update is set by the organisation's policy and cannot be changed here"). Report it as it is and point the person to whoever manages their computer. Never suggest editing or removing the policy file, and never route around it with `FORMPORTAL_POLICY`, a different catalogue or `allow_unsigned`.

## Mirroring for an internal server

For an administrator, not on a person's behalf without being asked:

1. Make an Ed25519 pair for the mirror (formai_dev's `python -m app.signing` makes one) and keep the seed private.
2. `FORMPORTAL_MIRROR_KEY=SEED ./formportal cli mirror --to /srv/formportal --base-url https://apps.example.internal/formportal [--platforms windows,macos] [--channels stable] [--history]`. It reads and verifies the public catalogue, downloads every file it names and checks each SHA-256, rewrites the addresses to the base address, and signs the new `apps.json`.
3. Serve the folder at the base address, and put its `address` and `public_key` (from the result) into the policy as `catalog` and `catalog_keys`.

Without a key the mirror is unsigned and computers refuse it unless the developer setting is on, which a policy usually forbids.

## Silent deployment

For an administrator, `org-package` makes one folder to deploy:

```
./formportal cli org-package --policy policy.json --installer FormPortal_[version]_x64_en-US.msi --to formportal-managed
```

It refuses a policy FormPortal would refuse, then writes the installer, `policy.json`, `SHA256SUMS`, `README.txt` and the script: `install.cmd` with `install.ps1` for the msi, `install.sh` for the dmg, deb, rpm or AppImage. Run as administrator or root, the script stops if a file changed, puts the policy at the system path first, then installs silently. On Windows only the msi is taken: it installs for every user, while the NSIS setup installs only for the account that runs it, so the command refuses it. The Linux deb package has been run end to end; the Windows and macOS scripts have not yet been run on a managed computer, so say so if asked.
