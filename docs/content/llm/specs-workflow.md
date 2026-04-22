---
title: "Specs workflow"
weight: 25
---

# Specs workflow

This page defines the LLM-facing workflow for specs-driven development in this repo.

The main rule is:

- Always look for the spec in `docs/content/llm/` first.
- Use `docs/content/docs/` to understand the system, architecture, and current implementation behavior.
- Use `MIGRATION.md` when the task affects long-term compute architecture, backend boundaries, or staged migration decisions.
- When a migration task lands, update the progress ledger in `MIGRATION.md` in the same change set.

## Codex rule

When starting a task, follow this order:

1. Read `/llm/project-context/`.
2. Read `/llm/specs-workflow/`.
3. Look in `/llm/` for a task-specific spec or workflow note.
4. Read `/MIGRATION.md` if the task affects backend ownership, astrology layering, or migration sequencing.
5. Use `/docs/` to understand how the system fits together and to confirm current implementation details.

For workspace import work, use `/llm/import-chart-contract/` as the task-specific spec before inferring behavior from code.
For radix rendering work, use `/llm/radix-render-contract/` before inferring frontend geometry from existing components.

When a runtime decision rule is established in `/llm/`, prefer carrying that rule through the whole app consistently instead of reintroducing per-feature ad hoc checks.

When `/llm/` describes the current contract and `MIGRATION.md` describes the target direction, preserve the current contract unless the task explicitly moves the implementation forward and updates the relevant specs in the same change set.

## Repository split

- `docs/content/llm/`: Codex-facing workflow, specs, continuation rules, and task guidance.
- `docs/content/docs/`: Human-facing project documentation and descriptive technical references.

## What counts as a usable spec

A task is properly specified when the material defines:

- scope
- non-goals
- inputs
- required behavior
- failure and empty-state behavior
- outputs
- acceptance criteria

If those are missing, the task is only partially specified.

## How to use `/docs/`

Use `/docs/` for:

- architecture and boundaries
- current command and integration behavior
- storage and data-shape descriptions
- UI conventions and existing patterns

Do not treat an example, migration note, or discussion summary as the implementation spec unless an `/llm/` page says to.

## When no spec exists in `/llm/`

If no task-specific spec exists in `/llm/`:

1. Read the relevant `/docs/` pages and the live code.
2. Infer the narrowest safe behavior from the current system.
3. State assumptions clearly.
4. Prefer adding or updating an `/llm/` spec note when the task introduces new behavior or decisions.

## Current behavior references

These `/docs/` pages are especially useful as current behavior references:

- `/docs/frontend-react/`
- `/docs/ui-conventions/`
- `/docs/architecture/`
- `/docs/tauri-command-contracts/`
- `/docs/python-package/`
