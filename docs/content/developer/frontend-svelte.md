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
- `stores/data.svelte.ts` consumes bridge queries and may use in-memory computed
  positions when persisted query rows are unavailable.
- Chart-level calculation settings override workspace defaults through the same
  payload precedence used by React.

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
- In-memory fallback rendering remains for static mode and workspaces without
  persisted computed-query rows.
- Frontend behavioral test automation remains a documented gap in
  [Testing strategy](../testing-strategy/).

## Related contracts

- [Tauri command contracts](../tauri-command-contracts/)
- [Radix render contract](../radix-render-contract/)
- [Transit series contract](../transit-series-contract/)
- [Time navigation](../time-navigation/)
