---
name: stock-and-templates
description: Stock media and Form app templates through FormPortal. Use when the person wants an open-licensed image, video clip, sound or template found, saved to their Library with its credit, wants to start a project from a template in FormCut, FormVis or FormWav, asks what they saved and under which licence, wants the credit line to paste, or when media, media_save or media_remove fail.
---

# stock-and-templates

## What it is

An open media index (`media.json` beside the catalogue, signed with the catalogue's key) lists images, video, audio and Form app templates. Each item names its creator, licence, source page and SHA-256. FormPortal saves only items under CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0, Apache-2.0, MIT or OFL-1.1, into the person's Library (`Documents/Form/Library`, or `FORMPORTAL_LIBRARY`). It writes the credit line beside each file (the file's name plus `.credit.txt`) and into `credits.json`. There is no generative AI here and no paid stock; that is deliberate.

## The loop

1. `media` (with `query` and `kind`: image, video, audio, template): items with their credit line and whether each is saved, plus everything already in the Library.
2. `media_save {id}` after the person agrees. The file is checked against its SHA-256 before it is kept.
3. A template: `media_save {id, use: true}` also copies it into the first projects folder (or `folder`) and opens it in its app. A second copy gets a number (`Social cut 2.fc`). If the app is not installed, the copy is still made; offer to install the app.
4. `media_remove {id}` removes the Library copy and its credit file. Copies already in projects folders are the person's and are never touched.

## Credits

CC BY and CC BY-SA need the credit line wherever the item is used; give the person the line from `media` or the `.credit.txt` file. CC BY-SA also asks that adapted work be shared under the same licence; say so when they plan to change it. CC0 needs no credit, but the line is kept anyway.

## When it fails

"is licensed ..., not an open licence FormPortal saves; it was not saved" means the index lists something FormPortal will not keep; say so and suggest another item. "the media index was refused" means its signature did not match; stop and report it. On a managed computer the index follows the locked catalogue and cannot be pointed elsewhere.
