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

Developer pages declare three front-matter fields. The values below are the
complete set currently used under `docs/content/developer/`:

| Field | Meaning |
| --- | --- |
| `doc_kind` | `index` for navigation; `contract` for behavior consumers rely on; `architecture` for boundaries and rationale; `implementation-reference` for current code structure; `guide` for contributor workflow; `policy` for repository-wide rules; `roadmap` for proposed work; `archive` for historical context |
| `status` | `current`, `evolving`, `active`, `proposed`, or `historical` |
| `authority` | `normative` means the page is binding; `informative` describes current behavior or implementation; `non-normative` is context, proposal, roadmap, or history and must not override a contract |

A page may be informative while still being current, and a policy page may be
normative without being a serialized application contract. `status` describes
the page's lifecycle; `authority` describes how conflicts are resolved.

A current normative contract or policy wins over implementation commentary,
roadmap language, examples, and historical notes. The Developer Manual index is
navigation metadata, not an authority source.

## Architecture documentation responsibility matrix

| Page | Owns | Does not repeat |
| --- | --- | --- |
| [Architecture](../architecture/) | Current system boundaries, runtime flows, implementation debt | YAML fields or source map |
| [Domain model](../domain-model/) | Semantic concepts and runtime catalog/presentation ownership | Workspace lifecycle |
| [Rust code structure](../rust-code-structure/) | Current module map and mixed command responsibilities | Target-layer promises |
| [Workspace YAML contract](../workspace-yaml/) | Portable format, lifecycle, loaders, resolution, and catalog propagation | Framework-specific UI behavior |
| [Architecture](../architecture/) | Runtime boundaries, result lifecycle, persistence/provenance ownership | Command-by-command source map |
| [Configuration reference](../configuration-reference/) | Implemented user-visible settings, values, and scope semantics | Catalog architecture |
| [Testing strategy](../testing-strategy/) | Existing test layers, commands, fixtures, and named gaps | Architecture design |
| This guide | Documentation taxonomy, authority, contribution orientation | Runtime behavior |

When an architectural behavior changes, update its owning page and replace any
contradictory statement elsewhere with a link rather than duplicating it.

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
- [Architecture](../architecture/) — Rust/Python ownership, persistence, and migration boundaries.
- [Workspace YAML contract](../workspace-yaml/) — portable persistence.
- [Tauri command contracts](../tauri-command-contracts/) — frontend-visible API.
- [Frontend workflow baseline](../frontend-workflow-baseline/) — shared user-facing workflows.
- [Testing strategy](../testing-strategy/) — contract traceability and commands.
