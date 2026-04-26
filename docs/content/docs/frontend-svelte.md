---
title: "Svelte frontend"
description: "Operational guide for the alternate Svelte + Vite + Tauri workspace."
weight: 25
---

# Svelte frontend (alternate Tauri shell)

`apps/web-svelte` is the Svelte port of the app. It currently carries more feature depth than the React shell, so it is useful both as an implementation reference and as an alternate desktop target.

## Current status

- Svelte currently exposes a broader interactive surface than React in several areas.
- It includes a wired transit compute flow through Tauri `compute_transit_series`.
- It also still carries more compatibility-era assumptions than React in some places, especially around storage/query helpers.
- Treat it as a valuable functional reference, but not as a guarantee that every internal path is already on the final desktop persistence model.

## Commands

```bash
npm install
npm run dev:svelte            # Vite only, http://localhost:1422
npm run check:svelte          # Svelte type/check pass
npm run build:svelte          # Frontend -> apps/web-svelte/dist/
npm run tauri:dev:svelte      # Desktop app using the Svelte frontend
npm run tauri:build:svelte    # Desktop bundle with Svelte as foreground
npm run docs:prepare          # Builds all frontends and copies them into docs/static/apps/
```

## Layout

| Path                           | Purpose                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `apps/web-svelte/src/App.svelte` | Main shell for panels, radix/chart interactions, settings, and transit controls.                         |
| `apps/web-svelte/src/lib/`     | Svelte state, i18n, glyphs, shared UI primitives, and Tauri `invoke` usage.                             |
| `apps/web-svelte/src/lib/i18n/` | Generated locale JSON (`cs`, `en`, `fr`, `es`) plus the Svelte runtime helper.                           |
| `apps/web-svelte/vite.config.ts` | Shared static root, docs-safe base path support, and the alternate Vite/Tauri dev ports (`1422`/`1423`). |

## Structure conventions

- `src/App.svelte` is currently a large integration shell. Treat it as orchestration glue, not as the preferred home for new feature logic.
- New feature UI should usually be extracted into `src/lib/components/` instead of extending `App.svelte` with another large conditional branch.
- Shared Svelte UI primitives belong under `src/lib/components/ui/`.
- Rune-backed global state should live in `src/lib/state/*.svelte.ts`, with plain `.ts` wrappers only when needed for cleaner imports.
- Shared visual asset resolution belongs in dedicated helpers such as:
  - `src/lib/stores/app-shell-icons.svelte.ts`
  - `src/lib/stores/glyphs.svelte.ts`
- Do not add or revive app-local icon families under `src/lib/icons/` for app-shell style navigation. That directory is legacy; shared app-shell icons and logos come from repo-root `static/`.

## UI component strategy

- Prefer the shared Svelte UI primitives under `apps/web-svelte/src/lib/components/ui/` before introducing bespoke controls.
- Those primitives are the Svelte-side equivalent of the repo’s shadcn-style component layer and should be the first place to extend styling behavior.
- Styling should flow through shared tokens, variants, spacing, and wrappers before adding one-off component CSS.
- When two views are structurally similar, prefer extracting a shared panel, menu, or content container rather than repeating another mode-specific block inside `App.svelte`.

## Shared static assets

Both frontends consume the same repo-root `static/` tree:

- `static/app-shell/icons/default/*.svg`
- `static/app-shell/icons/modern/*.svg`
- `static/app-shell/logo-full-*.svg`
- `static/app-shell/logo-mark-*.svg`
- `static/glyphs/default/{planets,zodiac}/*.svg`
- `static/glyphs/modern/{planets,zodiac}/*.svg`

App-shell SVGs are shared source assets, but they are not intrinsically uniform:

- the `default` icon family is mostly filled artwork authored in a `209 x 209` box
- the `modern` family is mostly `24 x 24` stroke-based artwork
- full logos are rectangular and must not be rendered through a square-only assumption

Normalization therefore happens in the frontend render layer:

- Svelte paths and logo ratios live in `apps/web-svelte/src/lib/stores/app-shell-icons.svelte.ts`
- the shared masked renderer is `apps/web-svelte/src/lib/components/SharedSvgIcon.svelte`
- React mirrors the same behavior in its own app-shell helper and shared SVG wrapper

That render-layer normalization is per icon, not just per family, because several icons within the same set occupy meaningfully different visual area.

Legacy note:

- `apps/web-svelte/src/lib/icons/` should be treated as obsolete local icon residue, not as the source of truth for the app shell.
- Shared shell visuals should continue to resolve through the repo-root `static/` assets and the corresponding Svelte helper stores.

Svelte resolves these through `import.meta.env.BASE_URL`, so the same code works for:

- normal app builds and Tauri builds
- docs publishing under `/apps/web-svelte/`

## Static docs build

`npm run docs:prepare` already builds every workspace under `apps/*` and copies each finished `dist/` into `docs/static/apps/<app>/`. That means the Svelte app is automatically published under the docs artifact alongside React, with no extra per-app copy step.

Published static entry points:

- Svelte: `apps/web-svelte/`
- React: `apps/web-react/`

## Tauri targeting

The base `src-tauri/tauri.conf.json` still points at React by default. Use the override configs when you want the desktop shell to foreground Svelte instead:

- `src-tauri/tauri.react.conf.json`
- `src-tauri/tauri.svelte.conf.json`

The root scripts wrap those configs so you can switch foregrounds without editing Tauri config files by hand.

## Data-path note

- Svelte can render from real computed chart payloads returned by Tauri.
- Some Svelte data helpers also call storage compatibility commands such as `query_positions`.
- In the current desktop app, those storage commands do not persist computed data in Rust, so Svelte may fall back to in-memory chart computation results when query calls return empty data.
