---
name: catalog-and-registry
description: Which Form apps exist and what is released. Use when the person asks what the Form family contains, what an app replaces (Photoshop, Lightroom, InDesign, Illustrator, After Effects, Media Encoder, CapCut, Notion, GitHub and others), which apps are available or in progress, what version is out, release notes, file sizes or minimum OS.
---

# catalog-and-registry

## Two sources, two questions

- **What exists:** the registry, inside every `apps` row: `name`, `alt_of` (what it replaces), `group` (`adobe`, `other`, `next`), `status` (`available`, `in-progress`, `in-development`), `summary`, `repository`. It answers offline.
- **What is released for this computer:** the catalogue, per channel: `offered.availability`, `offered.version`, `offered.bytes`. `app_info` adds the release notes, every artifact (system, processor, kind, size, SHA-256, minimum OS) and the publish date.

## Answering

- Group answers the way the family groups itself: Adobe alternatives, other alternatives, on the way.
- Quote the summary and `alt_of` as written; do not invent features.
- "Is X out?": available in the registry and `available` in the catalogue means yes, with the version. In progress or unreleased means not yet; say which.
- Releases change without FormPortal changing: re-run `apps` rather than relying on an earlier answer in the conversation.
