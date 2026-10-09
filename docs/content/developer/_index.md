---
title: 'Developer Manual'
description: 'Architecture, contracts, implementation references, and verification for contributors.'
weight: 20
doc_kind: index
status: current
authority: informative
---

Use this section by the question you need to answer. The **[Manual](../manual/)**
is the authoritative task guide for application users; the **[Guides](../guides/)**
are interactive previews and walkthroughs, not a second manual.

Current contracts describe behavior an implementation or consumer may rely on.
Implementation references explain the current code and evidence. The
**[roadmap](./development-driver/)** describes planned work only.

## Start here

- **[Repository and contribution guide](./project-context/)** — repository map,
  document roles, change workflow, and definition of done.
- **[System architecture](./architecture/)** — runtime boundaries, actual flows,
  ownership, and known debt.
- **[Testing strategy](./testing-strategy/)** — test levels, fixtures,
  traceability, and the evidence required for a change.

## Build or change astronomical calculation

1. **[Astronomy coordinate contract](./astronomy-coordinate-contract/)** is the
   normative source for time scales, frames, corrections, longitudes, motion,
   artifacts, and the topocentric limitation.
2. **[SPICE calculation backend](./spice-backend/)** explains the JPL/ANISE
   implementation and provider boundary. It does not redefine the contract.
3. **[Ephemerides and coverage](./ephemeris-manager/)** is the source for BSP
   acquisition, installation, selection/precedence, usable versus raw coverage,
   and offline operation.
4. **[Validation and performance](./ephemeris-validation/)** records fixtures,
   independent references, tests, benchmarks, measured errors, and gaps. Passing
   tests are scoped evidence, not a general accuracy claim.

For domain-specific work, use **[house systems](./house-systems/)**,
**[lunar phase](./lunar-phase/)**, and **[physical properties](./physical-properties/)**.

## Change persisted workspaces, settings, or commands

- **[Workspace YAML contract](./workspace-yaml/)** — portable workspace tree,
  inheritance, chart overrides, presentation boundary, and persisted transit intent.
- **[Configuration reference](./configuration-reference/)** — implemented
  calculation settings, serialized values, and inactive persisted settings.
- **[Tauri command contracts](./tauri-command-contracts/)** — frontend-facing
  command inputs and outputs.
- **[Chart datetime contract](./chart-datetime-contract/)** — canonical time
  handling; workspace lifecycle and loading are part of the Workspace YAML contract.

## Implement a feature or frontend workflow

- **[Domain model and extensibility](./domain-model/)** — canonical concepts,
  catalog ownership, and extension points.
- **[Frontend workflow baseline](./frontend-workflow-baseline/)** — workflows
  both shells must support; use the React or Svelte reference for shell details.
- **[React frontend](./frontend-react/)** / **[Svelte frontend](./frontend-svelte/)** —
  supported implementation differences and current limitations.
- **[Transit series contract](./transit-series-contract/)**,
  **[radix render contract](./radix-render-contract/)**, and
  **[import chart contract](./import-chart-contract/)** — feature-level payload
  and output contracts.
- **[UI conventions](./ui-conventions/)**, **[time navigation](./time-navigation/)**,
  and **[Guided Tour contract](./guided-tour/)** — interaction, presentation,
  and stable tour-anchor rules.

## Code maps, plans, and history

- **[Rust code structure](./rust-code-structure/)** — current module and
  responsibility map; system ownership is in Architecture.
- **[Python package](./python-package/)** and **[shared core](./shared-core/)** —
  optional-sidecar reality and a proposed extraction boundary, respectively.
- **[Development roadmap](./development-driver/)** and **[CI todo](./ci-todo/)** —
  planned work; neither changes a current contract.
- **[Versioning](./versioning/)** — release-number policy.

Historical material is intentionally outside this reading path in the
**[archive](./archive/)**.
