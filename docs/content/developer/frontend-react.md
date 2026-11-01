---
title: 'React frontend'
description: 'React-specific structure, runtime wiring, and current limitations.'
weight: 20
doc_kind: implementation-reference
status: current
authority: informative
---

React is the default desktop shell and the primary reference for app-shell
decomposition and reusable input primitives. Shared workflow requirements live
in the [Frontend workflow baseline](../frontend-workflow-baseline/); shared
visual and asset rules live in [UI conventions](../ui-conventions/).

## Commands

From the repository root:

```bash
npm run dev
npm run tauri:dev
npm run build
npm run tauri:build
npm run check
npm test
npm run build:react:docs
```

Cross-frontend lint, translation, and documentation commands are defined in the
[Repository and contribution guide](../project-context/).

## Source structure

- `apps/web-react/src/main.tsx` — React root and global providers.
- `apps/web-react/src/app/` — application composition.
- `apps/web-react/src/app/providers/` — appearance, workspace state, and chart actions.
- `apps/web-react/src/app/shell/` — navigation and application shell.
- `apps/web-react/src/app/features/` — feature screens and their components.
- `apps/web-react/src/app/views/domain/` — shared chart/domain views.
- `apps/web-react/src/app/components/` — feature-facing UI.
- `apps/web-react/src/app/components/ui/` — React primitive layer.
- `apps/web-react/src/ui/` — cross-feature presentational wrappers.
- `apps/web-react/src/lib/` — Tauri bridge, payload mapping, i18n, theme, and asset helpers.
- `apps/web-react/src/styles/` — Tailwind and semantic token layers.

## Runtime ownership

- `App.tsx` composes `AppearanceProvider`, `WorkspaceProvider`, and `AppShell`.
  Providers own shared state and actions; the shell owns navigation.
- `openWorkspaceFolder()` chooses a folder, loads its workspace and model
  report, merges defaults, and returns the computed charts (one batch call).
- Workspace and chart persistence use the typed bridge under `src/lib/tauri/`.
- `chartPayload.ts` maps `AppChart` and workspace defaults into backend-neutral
  calculation payloads.
- Chart-level bodies, aspects, orbs, ayanamsha, and time-system values override
  workspace defaults during payload construction.
- Real chart and transit views consume Tauri calculation results. Static docs
  mode may demonstrate interface structure but must not fabricate backend data.
- `main.tsx` loads the built-in Rust domain catalog before mounting React;
  `tauri/workspace.ts` refreshes it when `getCurrentModelReport()` is called.
  Workspace opening calls this helper without a chart ID; chart selection
  does not currently refresh the catalog. See
  [Architecture](../architecture/#bootstrap-and-catalog-lifecycle) for the gap.
- `astrology/domainCatalog.ts` and `observableObjects.ts` project catalog IDs
  into UI state. Translation keys, glyph assets, colors, and visual grouping
  remain React presentation concerns.

## React-specific conventions

- Keep `App.tsx` and `AppShell` focused on composition; feature behavior belongs in focused
  components or non-visual helpers.
- Begin interactive controls with the primitives in
  `src/app/components/ui/`.
- Use `AppMainContentRoot` and `AppMainContentContainer` for top-level content
  layout.
- Secondary navigation is a sibling of the main content column. Reuse
  `SecondaryNavPanel` rather than constructing feature-local rails.
- Use `useAppFormFieldTheme()` for themed form surfaces.
- Resolve shared shell assets through `src/lib/app-shell.ts` and
  `src/ui/app-shell-icon.tsx`.

Do not duplicate theme, glyph, translation, or shared-component policy here;
[UI conventions](../ui-conventions/) is authoritative for both frontends.

## Current limitations

- Some secondary views remain presentational or prototype-oriented.
- `InformationView` is not yet a complete chart-backed analysis surface.
- React has Vitest tests for helpers, shell, and feature rendering. Automated
  React/Svelte parity and full desktop workflows remain gaps in
  [Testing strategy](../testing-strategy/).

## Related contracts

- [React component catalog](../frontend-components/)
- [Tauri command contracts](../tauri-command-contracts/)
- [Radix render contract](../radix-render-contract/)
- [Transit series contract](../transit-series-contract/)
- [Chart datetime contract](../chart-datetime-contract/)
