---
title: "Continuation guide"
weight: 30
---

## Safe continuation loop

1. Read `/llm/project-context/`.
2. Read `/llm/specs-workflow/`.
3. Look in `/llm/` for any task-specific spec or operating note before treating `/docs/` as the spec source.
4. If the task affects compute architecture, backend ownership, zodiac/house semantics, or long-term migration, read `/MIGRATION.md`.
5. Read `/docs/` and then the most relevant guide for the task area.
5. Inspect current uncommitted changes before editing.
6. Rebuild generated docs assets with `npm run docs:prepare` when frontend build output changes.
7. Avoid editing copied frontend files in `docs/static/apps/`; change the source app instead.
8. Prefer shared `static/` assets over app-local assets whenever a resource can belong to both frontends.
9. Before adding new code, check whether an equivalent helper, hook, layout shell, or shared component already exists.
10. If two features or screens are structurally similar, prefer extracting a shared container or reusable building block instead of duplicating them.

## Codex rule

- Always look for the spec in `/llm/` first.
- Use `/docs/` as descriptive system documentation and current-behavior reference.
- Use `/MIGRATION.md` when the task touches long-term compute architecture or backend direction.
- If a task has no explicit `/llm/` spec, derive the narrowest safe interpretation from `/docs/` plus live code and record assumptions.
- When architecture direction changes, update the relevant `/llm/` spec in the same change set.

## Docs publishing contract

- Hugo source lives in `docs/`.
- Frontend artifacts are copied into `docs/static/apps/<app>/`.
- GitHub Pages should publish the Hugo output, not the raw source directory.
- Lowercase filenames are preferred for docs content and URLs.
