---
title: 'Contract workflow'
weight: 25
---

This page defines the shared workflow for contract-driven development in this repository. It applies equally to people and coding agents.

The main rule is:

- Always look for the spec in `docs/content/developer/` first.
- Use `docs/content/developer/` to understand the system, architecture, and current implementation behavior.
- Use `development-driver.md` when the task affects long-term compute architecture, backend boundaries, or staged migration decisions.
- When a migration task lands, update the development driver or the relevant task-specific `/developer/` contract in the same change set.

## Starting a task

When starting a task, follow this order:

1. Read `/developer/project-context/`.
2. Read `/developer/specs-workflow/`.
3. Look in `/developer/` for a task-specific spec or workflow note.
4. Read `/developer/development-driver/` if the task affects backend ownership, astrology layering, or migration sequencing.
5. Use `/developer/` to understand how the system fits together and to confirm current implementation details.

For workspace import work, use `/developer/import-chart-contract/` as the task-specific spec before inferring behavior from code.
For radix rendering work, use `/developer/radix-render-contract/` before inferring frontend geometry from existing components.

When a runtime decision rule is established in `/developer/`, prefer carrying that rule through the whole app consistently instead of reintroducing per-feature ad hoc checks.

When one `/developer/` page describes the current contract and another describes the target direction, preserve the current contract unless the task explicitly moves the implementation forward and updates the relevant specs in the same change set.

## Documentation roles

- `/manual/` describes user tasks and product behavior without implementation detail.
- `/developer/` contains technical contracts, architecture, workflows, plans, and historical context.
- Contract pages are normative; plans and historical notes are not.

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

## How to use `/developer/`

Use `/developer/` for:

- architecture and boundaries
- current command and integration behavior
- storage and data-shape descriptions
- UI conventions and existing patterns

Do not treat an example, migration note, or discussion summary as the implementation contract unless a contract page says to.

## When no spec exists in `/developer/`

If no task-specific spec exists in `/developer/`:

1. Read the relevant `/developer/` pages and the live code.
2. Infer the narrowest safe behavior from the current system.
3. State assumptions clearly.
4. Prefer adding or updating an `/developer/` spec note when the task introduces new behavior or decisions.

## Current behavior references

These `/developer/` pages are especially useful as current behavior references:

- `/developer/frontend-react/`
- `/developer/ui-conventions/`
- `/developer/architecture/`
- `/developer/tauri-command-contracts/`
- `/developer/python-package/`
