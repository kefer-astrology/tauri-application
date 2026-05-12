---
title: "Project documentation"
description: "Chaptered map of the current Kefer Astrology stack."
weight: 10
---

## Architecture foundation

- **[System architecture](./architecture/)** — cross-layer model definition.
- **[Tauri command contracts](./tauri-command-contracts/)** — normative frontend-facing command contract.

## Backend and astronomy engine

- **[SPICE backend](./spice-backend/)** — JPL/SPICE architecture, licensing rationale, and runtime status.
- **[Ephemeris manager](./ephemeris-manager/)** — BSP catalog ownership, downloads, chaining, and asteroid support.
- **[Python package](./python-package/)** — optional Python compute seam and subprocess contract.

## Frontend shells and UI behavior

- **[React frontend](./frontend-react/)** — primary desktop shell, workspace flows, Tauri integration, and docs/i18n workflow.
- **[Svelte frontend](./frontend-svelte/)** — alternate shell, parity status, and publication behavior.
- **[UI conventions](./ui-conventions/)** — shared theme palette, component rules, and translation workflow.
- **[Time navigation](./time-navigation/)** — precise stepping, range selection, and time-series behavior.

## Data, contracts, and reference material

- **[Physical properties](./physical-properties/)** — JPL-derived physical fields and richer astronomy payload notes.

## Build and automation notes

- **[CI todo](./ci-todo/)** — planned automation around i18n sync and docs/build verification.
- `npm run docs:prepare` rebuilds frontend workspaces, copies `apps/*/dist` into `docs/static/apps/`, and regenerates `docs/data/generated/frontends.json`.

## Historical context

- **[Discussion summary](./discussion-summary/)** — archival notes from the earlier UI phase.
- Root-level **[`MIGRATION.md`](../../../MIGRATION.md)** — remaining backend migration work and long-term JPL-centered direction.

## Folder structure description

| Layer | Role |
| --- | --- |
| **Frontends** (`apps/web-react/`, `apps/web-svelte/`) | UI workspaces. React is the current primary shell; Svelte is the alternate shell and parity target. |
| **Documentation** (`docs/content/`, `docs/public/`) | Internal documentation sources and generated doc pages. |
| **Tauri** (`src-tauri/`) | Native window, `invoke` commands, workspace orchestration, and local compute routing. |
| **Python** (`backend-python/`) | Optional computation sidecar and compatibility path; not the sole compute owner. |
| **Static assets** (`static/`) | Shared app-shell assets and astrology glyphs copied into frontend builds. |
