---
title: "Project docs"
description: "Core architecture, frontend, Python, integration, and planning notes."
weight: 10
---

# Documentation index

Start here for how the Kefer desktop app is structured and how to work on it.

## Current stack

| Layer                                      | Role                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Frontends** (`apps/web-react/`, `apps/web-svelte/`) | UI workspaces. React is the current primary shell; Svelte is the more advanced alternate build. |
| **Tauri** (`src-tauri/`)                   | Native window, `invoke` commands, Python sidecar lifecycle.                                |
| **Python** (`backend-python/`)             | Ephemeris / chart computation (sidecar binary bundled in `src-tauri/binaries/`).           |
| **Static assets** (`static/` at repo root) | Shared public assets for both frontends: `app-shell/**`, `glyphs/**`, favicon, and shared SVG families copied into each frontend build. |

## Frontend rules

- Prefer the existing shadcn-style component systems before inventing custom controls.
- React work should start from `apps/web-react/src/app/components/ui/`.
- Svelte work should start from `apps/web-svelte/src/lib/components/ui/`.
- Restyling should usually happen through shared variants, theme tokens, spacing, and composition rather than one-off component CSS forks.

## Guides (read in this order)

1. **[frontend-react](./frontend-react/)** — React + Vite + Tauri wiring, Tauri API layer, assets, dev commands.
2. **[frontend-svelte](./frontend-svelte/)** — Svelte workspace layout, docs build behavior, and alternate Tauri scripts.
3. **[ui-conventions](./ui-conventions/)** — Four themes, `sidebarThemeStyles`, secondary nav (transits/settings), i18n workflow (`translations.csv` → `npm run i18n:sync`).
4. **[architecture](./architecture/)** — Workspace layout, storage model, data flow (Rust/Python).
5. **[python-package](./python-package/)** — Python module and CLI.
6. **[time-navigation](./time-navigation/)** — Time navigation design (reference; implement with React state/hooks).
7. **[physical-properties](./physical-properties/)** — JPL / physical fields.
8. **[integration-examples](./integration-examples/)** — `invoke` patterns and examples (some older snippets are illustrative only).

## Historical / planning notes

- **[discussion-summary](./discussion-summary/)** and **[implementation-plan](./implementation-plan/)** predate the React shell. Use them for background only; prefer **[frontend-react](./frontend-react/)** and **[ui-conventions](./ui-conventions/)** for the live codebase.

## Automation (todo)

- **[ci-todo](./ci-todo/)** — Planned GitHub Actions: i18n sync verification, Rust/Tauri matrix builds, optional follow-ups.
