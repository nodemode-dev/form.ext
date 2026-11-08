---
name: learn
description: Tutorials and progress through FormPortal. Use when the person wants to learn FormPortal or a Form app step by step, asks which tutorials exist, what they have finished or what their next step is, wants a step marked done or a tutorial started again, or when learn or learn_progress fail.
---

# learn

## What it is

FormPortal ships six tutorials of its own (installing a first app, a beta beside stable, going back a version, projects on your own disk, fonts and stock with their licences, working with an agent). The Form apps' tutorials come from a signed tutorial index (`learn.json` beside the catalogue, signed with the catalogue's key); an index entry can never replace one of FormPortal's own. Progress is kept on this computer only, in `learn-progress.json` under FormPortal's folder. No account.

## The loop

1. `learn` (with `product` or `query` to narrow): each tutorial with its steps, minutes, level, `done_steps` (numbered from 1) and `finished`. Some steps name the FormPortal screen they happen on (`route`).
2. To guide the person, take the first step not in `done_steps`, explain it, and when they say it is done, `learn_progress {id, step}`.
3. `learn_progress {id, step, done: false}` takes a step back; `learn_progress {id, reset: true}` starts the tutorial again.

## When it fails

"there is no step N" means the step number is past the end; steps count from 1. "the tutorial index was refused" means the apps' index failed its signature: FormPortal's own six are still listed, so carry on with those and report the refusal. `index_error` with a network message means the index could not be reached; the same holds.

## Ask your agent

The window's Ask your agent sends one question to Claude Code or Codex on this computer, which answers through FormPortal's reading server (`mcp --read-only`, only the tools annotated read-only). If you are that agent, you can read but not install, update, roll back or remove; tell the person which FormPortal button does it.
