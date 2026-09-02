---
title: 'Developer Manual'
description: 'Architecture, contracts, implementation guidance, and project direction for people and coding agents.'
weight: 20
---

The Developer Manual is the shared technical source of truth for contributors and coding agents. Read normative contracts before inferring behavior from an implementation or historical note.

## Start here

- **[Project context](./project-context/)** — repository shape, technology choices, and reliable entry points.
- **[Development driver](./development-driver/)** — current direction and definition of done.
- **[Contract workflow](./specs-workflow/)** — how to distinguish binding behavior from guidance and plans.
- **[Continuation guide](./continuation-guide/)** — the shortest safe path for resuming work.

## Contracts

- **[Workspace YAML contract](./workspace-yaml/)** — complete project tree,
  schools/models, settings inheritance, chart overrides, presentation, and
  persisted transit intent.
- **[Tauri command contracts](./tauri-command-contracts/)** — frontend-facing native commands.
- **[Rust workspace contract](./rust-workspace-contract/)** — persistence and no-sidecar rules.
- **[Frontend workflow baseline](./frontend-workflow-baseline/)** — workflows both frontends are measured against.
- **[Chart datetime contract](./chart-datetime-contract/)** — canonical timestamps.
- **[Transit series contract](./transit-series-contract/)** — transit computation payload and result.
- **[Import chart contract](./import-chart-contract/)** — supported import behavior.
- **[Radix render contract](./radix-render-contract/)** — computed output required for a radix view.

## Architecture and computation

- **[System architecture](./architecture/)** describes the overview;
  **[backend structure](./backend-structure/)** describes implementation
  boundaries without redefining the YAML format.
- **[SPICE backend](./spice-backend/)**, **[ephemeris manager](./ephemeris-manager/)**, and **[Python package](./python-package/)** describe computation backends.
- **[House systems](./house-systems/)**, **[lunar phase](./lunar-phase/)**, and **[physical properties](./physical-properties/)** document domain calculations and data.

## Frontend and interface

- **[React frontend](./frontend-react/)** — the primary desktop interface.
- **[Svelte frontend](./frontend-svelte/)** — the alternate implementation and parity surface.
- **[Guided Tour contract](./guided-tour/)** — tour mode, stable anchors, and overlay behavior.
- **[UI conventions](./ui-conventions/)** and **[time navigation](./time-navigation/)** — shared interaction rules.

## Plans, automation, and historical context

- **[Frontend gap implementation plan](./frontend-gap-implementation-plan/)** and **[CI todo](./ci-todo/)** are forward-looking work plans, not current contracts.
- **[Versioning](./versioning/)** defines the release-number policy.
- **[Discussion summary](./discussion-summary/)** preserves historical context and is explicitly non-normative.
