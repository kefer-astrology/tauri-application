---
title: 'Svelte frontend'
description: 'Svelte-specific structure, runtime wiring, and current limitations.'
weight: 25
doc_kind: implementation-reference
status: current
authority: informative
---

Svelte is the alternate desktop shell. It consumes the same workflow and Tauri
contracts as React while retaining framework-specific state and component
structure. Shared rules are defined in the
[Frontend workflow baseline](../frontend-workflow-baseline/) and
[UI conventions](../ui-conventions/).

## Commands

From the repository root:

```bash
npm run dev:svelte
npm run tauri:dev:svelte
npm run build:svelte
npm run tauri:build:svelte
npm run check:svelte
npm run build:svelte:docs
```

Cross-frontend lint, translation, and documentation commands are defined in the
[Repository and contribution guide](../project-context/).

## Source structure

- `apps/web-svelte/src/App.svelte` — main integration shell.
- `apps/web-svelte/src/lib/components/` — feature components and workspace operations.
- `apps/web-svelte/src/lib/components/ui/` — Svelte primitive layer.
- `apps/web-svelte/src/lib/state/` — rune-backed application state.
- `apps/web-svelte/src/lib/stores/` — glyph, icon, data, and time-navigation helpers.
- `apps/web-svelte/src/lib/tauri/` — typed bridge aligned with the React command shape.
- `apps/web-svelte/src/lib/themes/presets/` — Svelte palette presets.

## Runtime ownership

- `OpenWorkspaceView.svelte` owns the open/save interaction and computes loaded charts through the bridge.
- `SettingsView.svelte` persists workspace defaults and can recompute loaded charts.
- `LocationSelector.svelte` uses the location search and resolution commands.
- `App.svelte` coordinates transit-series requests and application result state.
- `layout.svelte.ts` owns the canonical Svelte-side context, defaults, mode, and payload mapping.
- `stores/data.svelte.ts` consumes compatibility query commands and falls back
  to in-memory computed positions. Rust returns empty rows from those queries;
  it does not persist computed results in a database.
- Chart-level calculation settings override workspace defaults through the same
  payload precedence used by React.
- `main.ts` loads the built-in Rust domain catalog before mounting Svelte;
  `tauri/workspace.ts` refreshes it when `getCurrentModelReport()` is called.
  Workspace opening calls this helper without a chart ID; chart selection
  does not currently refresh the catalog. See
  [Architecture](../architecture/#bootstrap-and-catalog-lifecycle) for the gap.
- `astrology/domainCatalog.ts` and `observableObjects.ts` project catalog IDs
  into UI state. Translation strings, glyph assets, colors, and visual grouping
  remain Svelte presentation concerns.

## Svelte-specific conventions

- Keep shrinking broad mode branching in `App.svelte`; new feature behavior
  belongs in focused components.
- Begin interactive controls with the primitives in `src/lib/components/ui/`.
- Resolve shared shell icons through `stores/app-shell-icons.svelte.ts` and
  astrology glyphs through `stores/glyphs.svelte.ts`.
- Keep Tauri invocation centralized in `src/lib/tauri/`; feature components
  should not import `@tauri-apps/api/core` directly.
- Desktop target switching uses `src-tauri/tauri.svelte.conf.json`.

Do not duplicate theme, glyph, translation, or shared-component policy here;
[UI conventions](../ui-conventions/) is authoritative for both frontends.

## Current limitations

- `App.svelte` still owns broad orchestration and mode branching.
- Some secondary views remain intentionally spec-gated or presentational.
- Position rendering uses available in-memory calculation results when the
  compatibility queries return no rows. A static preview has no native calculation service.
- Transit controls support sampled series only. Event/configuration search and
  transit-setup persistence remain React-only; see the
  [transit parity scope](../transit-series-contract/#current-parity-scope).
- Frontend behavioral test automation remains a documented gap in
  [Testing strategy](../testing-strategy/).

## Related contracts

- [Tauri command contracts](../tauri-command-contracts/)
- [Radix render contract](../radix-render-contract/)
- [Transit series contract](../transit-series-contract/)
- [Time navigation](../time-navigation/)
