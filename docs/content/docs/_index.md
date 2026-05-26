---
title: 'Project documentation'
description: 'Chaptered map of the current Kefer Astrology stack.'
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
- React is the main app flow: `npm run dev`, `npm run tauri:dev`, `npm run build`, `npm run tauri:build`, and `npm run check`.
- Svelte is a separate alternate app flow: `npm run dev:svelte`, `npm run tauri:dev:svelte`, `npm run build:svelte`, `npm run tauri:build:svelte`, and `npm run check:svelte`.
- `npm run docs:prepare` rebuilds both frontend workspaces for static docs mode, copies `apps/*/dist` into `docs/static/apps/`, and regenerates `docs/data/generated/frontends.json`.
- `npm run docs:dev` prepares those generated docs assets and starts Hugo locally; `npm run docs:build` prepares them and writes the production site to `dist-docs/`.
- `translations.csv` feeds both frontend locale trees via `npm run i18n:sync`; `npm run i18n:prune:dry` and `npm run i18n:prune` check/remove keys unused by both frontends before syncing.

## Folder structure description

| Layer                                                 | Role                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Frontends** (`apps/web-react/`, `apps/web-svelte/`) | UI workspaces. React is the current primary shell; Svelte is the alternate shell and parity target. |
| **Documentation** (`docs/content/`, `docs/public/`)   | Internal documentation sources and generated doc pages.                                             |
| **Tauri** (`src-tauri/`)                              | Native window, `invoke` commands, workspace orchestration, and local compute routing.               |
| **Python** (`backend-python/`)                        | Optional sidecar source when present; not the sole compute owner.                                   |
| **Static assets** (`static/`)                         | Shared app-shell assets and astrology glyphs copied into frontend builds.                           |
