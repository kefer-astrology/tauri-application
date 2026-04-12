---
title: "Svelte frontend"
description: "Operational guide for the alternate Svelte + Vite + Tauri workspace."
weight: 25
---

# Svelte frontend (alternate Tauri shell)

`apps/web-svelte` is the Svelte port of the app. It currently carries more feature depth than the React shell, so it is useful both as an implementation reference and as an alternate desktop target.

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

## UI component strategy

- Prefer the shared Svelte UI primitives under `apps/web-svelte/src/lib/components/ui/` before introducing bespoke controls.
- Those primitives are the Svelte-side equivalent of the repo’s shadcn-style component layer and should be the first place to extend styling behavior.
- Styling should flow through shared tokens, variants, spacing, and wrappers before adding one-off component CSS.

## Shared static assets

Both frontends consume the same repo-root `static/` tree:

- `static/app-shell/icons/default/*.svg`
- `static/app-shell/icons/modern/*.svg`
- `static/app-shell/logo-full-*.svg`
- `static/app-shell/logo-mark-*.svg`
- `static/glyphs/default/{planets,zodiac}/*.svg`
- `static/glyphs/classic/{planets,zodiac}/*.svg`

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
