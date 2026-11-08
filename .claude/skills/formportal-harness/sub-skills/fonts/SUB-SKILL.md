---
name: fonts
description: Fonts through FormPortal. Use when the person wants a font found, installed (a whole family or one style) or removed, wants to add their own TTF or OTF file so every app can use it, asks which fonts FormPortal installed or where they went, or when fonts, font_install or font_remove fail.
---

# fonts

## What it is

An open font index (`fonts.json` beside the catalogue, signed the same way) lists families with foundry, licence, kind and styles. FormPortal installs only OFL-1.1, Apache-2.0 and MIT fonts, checks each file's SHA-256 and that it really is a TrueType or OpenType font, and puts it in the person's own font folder (Linux `~/.local/share/fonts/FormPortal`, macOS `~/Library/Fonts`, Windows the per-user fonts folder and its registry entry). No administrator, nothing system-wide. Apps usually see new fonts after they restart.

## The loop

1. `fonts` (with `query` to narrow): families, each style marked installed or not, and everything FormPortal installed.
2. `font_install {id}` for a family, or `{id, style}` for one style, after the person agrees.
3. Their own file: `font_install {path, rights_confirmed: true}` only after the person has said they have the right to use that font on this computer. Never set `rights_confirmed` on their behalf. Web fonts (WOFF, WOFF2) are refused; they need the TTF or OTF.
4. `font_remove {family}` (or with `style`) removes what FormPortal installed; it never touches other fonts.

## Updates

`fonts` also returns `updates`: styles FormPortal installed whose file in the index has changed since. Tell the person which families, and after they agree, `font_install {id, style}` for each listed style installs the new file over the old one. Apps see the new version after they restart.

## When it fails

"is licensed ..., not an open font licence" means the index offers something FormPortal will not install; say so. "the font index was refused" means its signature did not match; stop and report it.
