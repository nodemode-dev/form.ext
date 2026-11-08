---
name: verification
description: Proving a FormPortal change before reporting it. Use after any install, update, rollback or remove, when the person asks whether something worked, or when a tool's answer and the person's description disagree.
---

# verification

- **After install or update:** `installs` shows the product and channel with the expected `current.version`, and `current.sha256` equals the catalogue's for that artifact (`app_info`). The `previous` entry is the version that was replaced.
- **After rollback:** `installs` shows the older version as current and the newer one as previous.
- **After remove:** the product and channel are gone from `installs`.
- **After open:** a process id came back. Whether the window appeared is the person's to confirm; ask.
- **Report only what these show.** A tool that returned without error is not proof by itself; `installs` is the record.
