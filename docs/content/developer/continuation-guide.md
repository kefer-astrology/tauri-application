---
title: 'Continuation guide'
weight: 30
---

## Safe continuation loop

1. Read `/developer/project-context/`.
2. Read `/developer/specs-workflow/`.
3. Look in `/developer/` for a task-specific contract or operating note before inferring behavior from descriptive material.
4. If the task affects compute architecture, backend ownership, zodiac/house semantics, or long-term migration, read `/developer/development-driver/`.
5. Read the most relevant architecture or implementation guide for the task area.
6. Inspect current uncommitted changes before editing.
7. Rebuild generated site assets with `npm run docs:prepare` when frontend build output changes.
8. Avoid editing copied frontend files in `docs/static/apps/`; change the source app instead.
9. Prefer shared `static/` assets over app-local assets whenever a resource can belong to both frontends.
10. Before adding new code, check whether an equivalent helper, hook, layout shell, or shared component already exists.
11. If two features or screens are structurally similar, prefer extracting a shared container or reusable building block instead of duplicating them.

## Contract rule

- Always look for the spec in `/developer/` first.
- Use `/developer/` as descriptive system documentation and current-behavior reference.
- Use `/developer/development-driver/` when the task touches long-term compute architecture or backend direction.
- If a task has no explicit `/developer/` spec, derive the narrowest safe interpretation from `/developer/` plus live code and record assumptions.
- When architecture direction changes, update the relevant `/developer/` spec in the same change set.

## Docs publishing contract

- Hugo source lives in `docs/`.
- Frontend artifacts are copied into `docs/static/apps/<app>/`.
- GitHub Pages should publish the Hugo output, not the raw source directory.
- Lowercase filenames are preferred for docs content and URLs.
