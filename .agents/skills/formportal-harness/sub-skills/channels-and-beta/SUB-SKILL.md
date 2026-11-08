---
name: channels-and-beta
description: Beta and nightly builds of Form apps beside the stable ones. Use when the person asks for a beta, a preview, early access, a nightly, wants to try the next version without losing the current one, or wants a beta removed.
---

# channels-and-beta

- A channel is a separate install: `install {product, channel: "beta"}` puts the beta in its own folder and leaves stable untouched. Both can be installed and opened.
- `apps` shows per channel what is offered; most products have no beta until their maker publishes one. When the beta is `no-release`, say so.
- Rollback and remove act on one channel only. Removing the beta never touches stable.
- Updating stable never updates beta, and the reverse.
- A beta may lose work: say so the first time a beta is installed for the person.
- Nightly works the same way and is rarer still.
