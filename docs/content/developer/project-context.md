---
title: 'Repository and contribution guide'
description: 'Repository map, documentation rules, and the contract-first contribution workflow.'
weight: 20
doc_kind: guide
status: current
authority: normative
aliases:
  - /developer/specs-workflow/
  - /developer/continuation-guide/
---

This is the starting point for implementation work. The user-facing
**[Manual](../../manual/)** explains how to use the application; the Developer
Manual defines how it is designed, implemented, extended, and verified.

## Repository map

- `apps/web-react/` — React + Vite frontend and the default desktop shell.
- `apps/web-svelte/` — alternate Svelte + Vite frontend.
- `src-tauri/` — Tauri shell, Rust commands, application services, and the
  no-sidecar computation path.
- `backend-python/` — optional local Python computation and service code. It may
  be extracted or omitted while the Rust-supported flows remain functional.
- `contracts/` — language-neutral fixtures shared by Rust and Python.
- `static/` — shared frontend assets.
- `docs/` — Hugo source for the Manual, Developer Manual, and Guided Tour.

## Source and generated files

Edit source files, not generated copies:

- shared logos and shell icons: `static/app-shell/`
- shared astrology glyphs: `static/glyphs/`
- translated copy: `translations.csv`
- documentation source: `docs/content/`
- generated frontend documentation builds: `docs/static/apps/`
- generated documentation data: `docs/data/generated/`
- generated Hugo output: `docs/public/` or `dist-docs/`

Run `npm run i18n:sync` after changing translated copy. Run
`npm run docs:prepare` when frontend output embedded in the documentation
changes.

## Starting a task

1. Inspect current uncommitted changes and preserve unrelated work.
2. Read this guide and the [Developer Manual index](/developer/).
3. Read the task-specific current contract.
4. Read architecture and implementation references needed to understand the
   affected boundary.
5. Read the [Development roadmap](../development-driver/) only when the task
   changes planned direction or closes an active gap.
6. Find the corresponding IDs in the [Testing strategy](../testing-strategy/).
7. Change the contract, implementation, tests, and documentation together when
   behavior changes.

When a current contract and a roadmap differ, preserve the current contract
unless the task explicitly advances the implementation and updates both.

## Document roles

Developer pages declare three front-matter fields:

| Field | Meaning |
| --- | --- |
| `doc_kind` | Contract, architecture, implementation reference, guide/policy, roadmap, or archive |
| `status` | Current, evolving, active, proposed, or historical |
| `authority` | Normative or informative/non-normative |

A current normative contract wins over implementation commentary, roadmap
language, examples, and historical notes.

## Usable contract checklist

A task-specific contract should define:

- scope and non-goals
- inputs and preconditions
- required behavior and invariants
- failure and empty-state behavior
- outputs and observable side effects
- compatibility or migration behavior
- acceptance criteria
- stable test IDs, or an explicitly recorded automation gap

If those are absent, inspect the current code and related contracts, choose the
narrowest compatible behavior, and record assumptions before expanding scope.

## Implementation principles

- Keep frontend-facing and cross-language data contracts backend-neutral.
- Keep schools and models independent of a particular astronomy provider.
- Keep domain rules free of Tauri, HTTP, filesystem, YAML, and process concerns.
- Reuse shared assets, component primitives, typed bridges, and application
  services instead of creating parallel implementations.
- Values that affect calculation belong in resolved workspace/chart/operation
  state, not frontend-only widget state.
- React and Svelte must implement the same frontend-visible contract, or the
  current spec must name the intentional gap and its acceptance criteria.
- Preserve no-sidecar Rust operation for supported flows.

Frontend styling, assets, themes, and translation details have one owner:
[UI conventions](../ui-conventions/). Framework-specific wiring belongs in
[React frontend](../frontend-react/) and [Svelte frontend](../frontend-svelte/).

## Verification and definition of done

At minimum, a completed change has:

- an updated normative contract when observable behavior changed
- a test-matrix entry or an explicit recorded gap
- focused tests for the affected layer
- Rust/Python or React/Svelte parity checks when the shared boundary changed
- successful type/build checks for affected packages
- regenerated documentation assets only when their source changed

Use the exact commands and coverage inventory in the
[Testing strategy](../testing-strategy/).

## Documentation publishing

- Hugo source lives under `docs/`.
- Frontend artifacts embedded in docs are generated under
  `docs/static/apps/<app>/`.
- GitHub Pages publishes Hugo output, not raw source content.
- Lowercase filenames and URLs are preferred.

## Reliable entry points

- [Domain model and extensibility](../domain-model/) — schools, models, providers, and extension points.
- [System architecture](../architecture/) — cross-layer runtime flow.
- [Backend structure](../backend-structure/) — Rust/Python ownership and migration boundaries.
- [Workspace YAML contract](../workspace-yaml/) — portable persistence.
- [Tauri command contracts](../tauri-command-contracts/) — frontend-visible API.
- [Frontend workflow baseline](../frontend-workflow-baseline/) — shared user-facing workflows.
- [Testing strategy](../testing-strategy/) — contract traceability and commands.
