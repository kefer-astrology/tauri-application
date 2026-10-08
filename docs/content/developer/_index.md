---
title: 'Developer Manual'
description: 'Architecture, contracts, implementation guidance, and verification for contributors and coding agents.'
weight: 20
doc_kind: index
status: current
authority: informative
---

The Developer Manual explains how Kefer Astrology is designed, implemented,
extended, and verified. The separate **[Manual](../manual/)** describes the
application from a user's point of view.

Developer pages have distinct roles:

- **Contract** — normative behavior that implementations and consumers may rely on.
- **Architecture** — system boundaries, ownership, and design rationale.
- **Implementation reference** — where and how current code realizes a contract.
- **Guide** — how contributors work in this repository.
- **Policy** — repository-wide rules that govern changes or presentation.
- **Roadmap** — desired work that is not yet a current contract.
- **Archive** — historical context only.
- **Index** — navigation and page discovery; it is not a behavioral authority.

When pages disagree, follow a current normative contract. Do not infer current
behavior from a roadmap or archive page.

## Contributing

- **[Repository and contribution guide](./project-context/)** — repository map,
  document roles, contract workflow, and definition of done.
- **[Testing strategy](./testing-strategy/)** — test levels, shared fixtures, parity, and traceability.

## Architecture

- **[System architecture](./architecture/)** — cross-layer runtime overview.
- **[Domain model and extensibility](./domain-model/)** — canonical concepts,
  the Rust-owned runtime domain catalog, calculations, providers, and extension points.
- **[Shared astrology core](./shared-core/)** — the planned boundary shared by
  Rust and the separately extractable Python sidecar.
- **[Backend structure](./backend-structure/)** — current persistence, provenance, and backend mechanisms.
- **[Rust code structure](./rust-code-structure/)** — current Rust module and
  responsibility map.

## Contracts

- **[Astronomy coordinate contract](./astronomy-coordinate-contract/)** — normative
  frame, origin, correction, motion, and ephemeris-artifact rules for computed longitudes.
- **[Configuration reference](./configuration-reference/)** — implemented calculation
  settings, serialized values, and presentation boundary.
- **[Workspace YAML contract](./workspace-yaml/)** — complete project tree,
  schools/models, settings inheritance, chart overrides, presentation, and
  persisted transit intent.
- **[Tauri command contracts](./tauri-command-contracts/)** — frontend-facing native commands.
- **[Rust workspace contract](./rust-workspace-contract/)** — workspace lifecycle,
  manifest/chart boundaries, catalog loading, and no-sidecar rules.
- **[Frontend workflow baseline](./frontend-workflow-baseline/)** — workflows both frontends are measured against.
- **[Chart datetime contract](./chart-datetime-contract/)** — canonical timestamps.
- **[Transit series contract](./transit-series-contract/)** — transit computation payload and result.
- **[Import chart contract](./import-chart-contract/)** — supported import behavior.
- **[Radix render contract](./radix-render-contract/)** — computed output required for a radix view.

## Implementation reference

- **[SPICE backend](./spice-backend/)**, **[ephemeris manager](./ephemeris-manager/)**,
  **[ephemeris validation](./ephemeris-validation/)**, and **[Python package](./python-package/)**
  describe computation backends and their reproducible checks.
- **[House systems](./house-systems/)**, **[lunar phase](./lunar-phase/)**, and **[physical properties](./physical-properties/)** document domain calculations and data.
- **[React frontend](./frontend-react/)** — the primary desktop interface.
- **[Svelte frontend](./frontend-svelte/)** — the alternate implementation and parity surface.
- **[Guided Tour contract](./guided-tour/)** — tour mode, stable anchors, and overlay behavior.
- **[UI conventions](./ui-conventions/)** and **[time navigation](./time-navigation/)** — shared interaction rules.

## Roadmap and history

- **[Development roadmap](./development-driver/)** — active implementation and architecture gaps.
- **[CI todo](./ci-todo/)** records remaining automation work.
- **[Versioning](./versioning/)** defines the release-number policy.
- **[Discussion summary](./discussion-summary/)** preserves historical context and is explicitly non-normative.
