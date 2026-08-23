---
title: 'Svelte frontend'
description: 'Operational guide for the alternate Svelte + Vite + Tauri workspace.'
weight: 25
---

## Current status

- Svelte is the alternate desktop shell.
- It has real workspace open/load/save wiring and workspace-default persistence.
- Radix rendering, settings, location resolution, transit-series compute, and workspace query flows are routed through the Svelte Tauri bridge.
- `stores/data.svelte.ts` keeps in-memory/static-mode fallbacks, but no longer owns Tauri query invocation.
- `App.svelte` remains the biggest orchestration surface and should keep being decomposed.
- Workspace open resolves the backend's model report (`get_current_model_report`); chart-level settings persist across a reload using the same shape as React.
- The Aspects tab computes house placement from real house cusps, and the aspect matrix shows an empty state rather than fabricated positions (see [radix-render-contract](../radix-render-contract/)).

## Commands

Svelte is the alternate frontend flow. Keep its build, check, and Tauri commands separate from the React defaults.

```bash
npm install
npm run dev:svelte
npm run tauri:dev:svelte
npm run build:svelte
npm run tauri:build:svelte
npm run check:svelte
npm run lint
npm run i18n:sync
npm run docs:prepare
```

Docs builds use the same Svelte app with a relative asset base:

```bash
npm run build:svelte:docs
```

## Workspace shape

- `apps/web-svelte/src/App.svelte` — main integration shell.
- `apps/web-svelte/src/lib/components/` — feature-facing Svelte UI and workspace operations.
- `apps/web-svelte/src/lib/components/ui/` — shared Svelte primitive layer.
- `apps/web-svelte/src/lib/state/` — rune-backed application state (`layout`, `theme`).
- `apps/web-svelte/src/lib/stores/` — glyph/icon/data/time-navigation helpers.
- `apps/web-svelte/src/lib/tauri/` — typed Svelte Tauri bridge, aligned with the React bridge shape.
- `apps/web-svelte/src/lib/themes/presets/` — preset palette JSON files.
- `apps/web-svelte/src/lib/i18n/` — generated locale JSON plus runtime helper.

## UI rules

- Prefer shared Svelte UI primitives before bespoke controls.
- Treat `App.svelte` as orchestration glue, not the ideal home for more feature logic.
- Extract new feature UI into focused components instead of extending `App.svelte` with another large conditional branch.
- Prefer shared tokens, variants, spacing, and wrappers over one-off component CSS.
- Avoid introducing raw native controls when an existing primitive exists in `src/lib/components/ui/`.

## Runtime behavior

- `OpenWorkspaceView.svelte` handles open/save flows through `src/lib/tauri/workspace.ts` and computes loaded charts.
- `SettingsView.svelte` persists workspace defaults through the same bridge and can recompute loaded charts after defaults changes.
- `LocationSelector.svelte` uses the bridge location search/resolve commands so new-chart and settings location inputs can sync typed places to coordinates.
- `App.svelte` computes transit series through the Svelte Tauri bridge and updates in-app results state.
- `layout.svelte.ts` is the canonical in-memory shape for contexts, workspace defaults, mode, and payload mapping.
- `stores/data.svelte.ts` consumes bridge query helpers and falls back to in-memory computed positions when no persisted query rows exist.

## Important current files

- `apps/web-svelte/src/App.svelte`
- `apps/web-svelte/src/lib/components/OpenWorkspaceView.svelte`
- `apps/web-svelte/src/lib/components/SettingsView.svelte`
- `apps/web-svelte/src/lib/components/LocationSelector.svelte`
- `apps/web-svelte/src/lib/components/MiddleContent.svelte`
- `apps/web-svelte/src/lib/components/RadixChart.svelte`
- `apps/web-svelte/src/lib/components/TimeNavigationPanel.svelte`
- `apps/web-svelte/src/lib/state/layout.svelte.ts`
- `apps/web-svelte/src/lib/state/theme.svelte.ts`
- `apps/web-svelte/src/lib/stores/data.svelte.ts`
- `apps/web-svelte/src/lib/stores/timeNavigation.svelte.ts`
- `apps/web-svelte/src/lib/tauri/types.ts`
- `apps/web-svelte/src/lib/tauri/workspace.ts`

## Shared assets

Svelte uses the same repo-root `static/` source assets as React:

- `static/app-shell/`
- `static/glyphs/`
- shared logos and favicon

Normalization happens in the frontend render layer, especially through:

- `apps/web-svelte/src/lib/stores/app-shell-icons.svelte.ts`
- `apps/web-svelte/src/lib/stores/glyphs.svelte.ts`
- `apps/web-svelte/src/lib/components/SharedSvgIcon.svelte`

Asset note:

- `apps/web-svelte/src/lib/icons/` is not the source of truth for shared shell or glyph assets.

## Theming

- Theme mode and preset state are owned by `apps/web-svelte/src/lib/state/theme.svelte.ts`.
- Presets are loaded from `apps/web-svelte/src/lib/themes/presets/`.
- Settings → Appearance applies presets and persists them in local storage.
- Element color overrides are applied as CSS variables (`--element-fire`, `--element-earth`, `--element-air`, `--element-water`).
- `App.svelte` reapplies the current preset on startup and when root theme class changes.

## i18n

- Source of truth: repo-root `translations.csv`.
- Regeneration command: `npm run i18n:sync`.
- Generated output includes `apps/web-svelte/src/lib/i18n/*.json` and the matching React locale files.
- Author new copy in `translations.csv`, not in generated JSON.

See [ui-conventions](../ui-conventions/) for the shared translation workflow and UI copy rules.

## Docs integration

- `npm run docs:prepare` builds frontend workspaces for docs mode.
- Built Svelte output is copied into `docs/static/apps/web-svelte/`.
- `docs/data/generated/frontends.json` is regenerated by the same pipeline.
- Treat both as generated artifacts.

## Tauri integration

- Svelte workspace, chart compute, transit-series, and storage-query commands are centralized in `apps/web-svelte/src/lib/tauri/workspace.ts`.
- Tauri response shapes live in `apps/web-svelte/src/lib/tauri/types.ts`.
- Feature components should consume bridge helpers rather than importing `@tauri-apps/api/core` directly.
- `openWorkspaceFolder()` calls `get_current_model_report` and seeds workspace defaults from `effective_settings` (`mergeModelReportDefaults` in `layout.svelte.ts`) before the workspace-level DTO is applied.
- Chart-level `observableObjects`/`aspectOrbs`/`selectedAspects`/`ayanamsa`/`timeSystem` round-trip through `ChartData` and take precedence over workspace defaults in `chartDataToComputePayload`.
- Tauri frontend target switching uses:
  - `src-tauri/tauri.react.conf.json`
  - `src-tauri/tauri.svelte.conf.json`

## Known limits

- `App.svelte` still carries broad mode branching and should continue to shrink.
- Some secondary views remain spec-gated or more placeholder-oriented than end-to-end compute surfaces.
- In-memory fallback rendering remains for docs/static mode and for workspaces without persisted computed query rows.
- React remains a useful reference for shell decomposition and richer form/input UX patterns, while the Tauri bridge shape is now aligned across both frontends.

## Related docs

- [architecture](../architecture/) — app-level architecture and routing.
- [frontend-react](../frontend-react/) — current primary-shell reference.
- [ui-conventions](../ui-conventions/) — theme, component, and i18n rules.
- [time-navigation](../time-navigation/) — shared navigation model.
