---
title: "React frontend"
description: "Operational guide for the React + Vite + Tauri UI workspace."
weight: 20
---

# React frontend (Tauri 2)

Operational guide for the Kefer desktop UI (React + Vite + Tauri).

## Current status

- React is the default desktop shell.
- The main horoscope workflow is wired to real Tauri compute commands.
- Workspace open/save/defaults persistence are wired.
- The create-new flow uses app-owned popover controls for time and location search.
- Some secondary views are still presentational or prototype-oriented rather than fully chart-backed.
- React does not currently expose the deepest feature coverage in the repo; Svelte still carries some richer screens and interactions.

## Prerequisites

- Node.js (see team `.nvmrc` or local convention).
- Rust toolchain for `cargo tauri build` / `cargo tauri dev`.
- Python sidecar: optional for the current baseline. If a built binary is staged at `src-tauri/binaries/kefer-backend`, Tauri can bundle it; if not, the app should still run supported flows through the Rust/no-sidecar path.

### Workspace-only storage compatibility

The Rust desktop app does not persist computed chart data. **`src-tauri/src/commands/storage.rs`** still exposes compatibility commands (`init_storage`, `query_positions`, etc.) so existing frontend `invoke` calls continue to work, but those commands do not store calculated data. Workspace data still flows through YAML plus in-memory compute results.

## Commands

```bash
npm install
npm run dev              # Vite only, http://localhost:1420
npm run tauri dev        # Desktop app with hot reload
npm run build            # Frontend → apps/web-react/dist/
npm run tauri build      # Full app bundle
npm run check            # TypeScript (app + vite config)
npm run lint             # Prettier + ESLint
npm run i18n:sync        # Regenerate `apps/web-react/src/locales/*.json` from `translations.csv`
```

## Layout

| Path                                 | Purpose                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web-react/src/main.tsx`        | React root; mounts `<App />` and `<Toaster />` (sonner).                                                                                         |
| `apps/web-react/src/app/`            | App composition layer: `App.tsx`, app-scoped providers, and feature wiring.                                                                      |
| `apps/web-react/src/app/components/` | Feature components for the React app shell. Prefer the Radix/shadcn-style primitives under `ui/`.                                               |
| `apps/web-react/src/ui/`             | Cross-cutting presentational primitives shared by features, such as app-shell renderers and masked SVG wrappers.                                |
| `apps/web-react/src/styles/`         | `index.css` → Tailwind 4, theme tokens, fonts.                                                                                                   |
| `apps/web-react/src/lib/`            | Non-visual logic and infrastructure: Tauri bridge, i18n setup, app-shell metadata/path helpers.                                                 |
| `static/` (repo root)                | **Shared public assets**: `app-shell/**`, `glyphs/**`, `favicon.png`. Used by Vite `publicDir` and copied into `dist/` on build.                |
| `apps/web-react/src/locales/`        | **i18n JSON** (`cs`, `en`, `fr`, `es`) — generated from `translations.csv`; imported by the app (not served from `static/`).                     |
| `apps/web-react/src/lib/i18n/`       | **i18next** init, `LANGUAGE_STORAGE_KEY` (`kefer-language` in `localStorage`).                                                                   |

## UI component strategy

- Prefer the existing shadcn-style primitives in `apps/web-react/src/app/components/ui/` before building custom controls.
- Styling work should usually happen through tokens, variants, composition, and shared wrappers.
- Reach for bespoke component CSS only when the shared component layer cannot express the needed behavior.

## Internationalization (i18n)

**Do you need JSON under `static/`?** No. Locale files live in **`apps/web-react/src/locales/`** and are bundled by Vite, which works offline in Tauri and avoids extra `fetch` / CSP concerns. Reserve **repo root `static/`** (shared across frontends) for assets you reference by URL (glyphs, favicon).

- **Source of truth**: repo root **`translations.csv`** (columns `internal_name`, `czech`, `english`, `french`, `spanish`). In a collaborative setup, maintain the sheet in **Google Sheets**, then **File → Download → CSV** (or a scheduled export) and replace `translations.csv` in the repo.
- **Regenerate JSON**: `npm run i18n:sync` runs `scripts/csv-to-locales.mjs`, which writes the same four locale files to **every** path listed in `localeOutputDirs` (React and Svelte today). One command keeps all frontends on the same keys and strings.
- **Staying in sync**: After updating the CSV, run `npm run i18n:sync` and commit **both** `translations.csv` and the generated `**/locales/*.json`. Optionally add CI that fails if someone edits JSON by hand without syncing, or that runs the script and checks for a clean `git diff`.
- **Runtime**: `react-i18next` + `i18next`; wrap is in **`apps/web-react/src/main.tsx`** (`I18nextProvider`). Use `useTranslation()` and `t('key')` where `key` is `internal_name` from the CSV.
- **Settings UI**: **`apps/web-react/src/app/components/settings-view.tsx`** — language, location, house system, aspects, appearance, manual, plus **Cancel / Confirm** footer. Language is stored under **`kefer-language`**; glyph set choice writes **`glyph_set`** in `localStorage` (`default` \| `modern`, mapped to **`static/glyphs/default/**` and **`static/glyphs/modern/**`**). Other fields are UI state until workspace/theme hooks are ported. Open settings from the sidebar’s **last main nav item** (translated `settings`).
- **Conventions**: See **[ui-conventions](./ui-conventions/)** for the full i18n workflow and transits/settings layout notes.

## Tauri bridge (`apps/web-react/src/lib/tauri/`)

- **`types.ts`** — TypeScript shapes aligned with common `invoke` responses (workspace, chart details, compute result).
- **`chartPayload.ts`** — `AppChart`, workspace defaults, `chartDataToComputePayload()` (JSON shape expected by `save_workspace`).
- **`workspace.ts`** — `openFolderDialog`, `loadWorkspace`, `initStorage`, `getWorkspaceDefaults`, `getChartDetails`, `computeChart`, `saveWorkspace`, and **`openWorkspaceFolder()`** (full open flow: load charts, init storage, compute each chart).

### Wired in the UI

In **`App.tsx`**, sidebar actions:

- **Otevřít** (`otevrit`) — runs `openWorkspaceFolder()` after `open_folder_dialog`; merges workspace defaults; stores charts in React state; toasts success/failure.
- **Uložit** (`ulozit`) — if there are in-memory charts, saves via `save_workspace` + `init_storage`; prompts for folder when no `workspacePath` yet.

Current React surface by state:

- **Horoscope dashboard**: wired to selected chart state and real computed chart payloads.
- **Create new dialog**: wired to real chart creation / compute flow, with Tauri-backed location resolution.
- **Settings**: workspace defaults persistence is wired through `save_workspace_defaults(...)`.
- **Information view**: still explicitly prototype-oriented.
- **Transits / secondary analysis views**: not all screens are yet wired as full end-to-end compute views.

## Structure conventions

- `src/app/` is the app composition layer: route-level or shell-level wiring, app-scoped providers, and feature assembly.
- `src/app/components/` is for feature-facing React UI used by this app.
- `src/ui/` is for shared presentational primitives that are reused across features and are not tied to one screen.
- `src/lib/` is for non-visual logic only: storage keys, asset metadata, Tauri helpers, and i18n/runtime glue.

Examples in the current tree:

- `src/lib/app-shell.ts` holds app-shell types, storage keys, asset selection, and normalization metadata.
- `src/ui/app-shell-icon.tsx` and `src/ui/shared-svg-icon.tsx` render that metadata into actual React elements.
- `src/app/providers/workspace-charts.tsx` is app-scoped state wiring for loaded workspace charts.

## Shared static assets

Keep shared source assets under repo-root `static/`. `apps/web-react` points Vite `publicDir` at that folder, so assets are copied into the app build and resolved through the active Vite base path.

The current React workspace keeps no local source assets. Shared shell icons, logos, and glyph families live in repo-root `static/`, and theme-only backgrounds should prefer CSS gradients or tokens when possible.

Current source-of-truth layout:

- `static/app-shell/icons/default/*.svg`
- `static/app-shell/icons/modern/*.svg`
- `static/app-shell/logo-full-*.svg`
- `static/app-shell/logo-mark-*.svg`
- `static/glyphs/default/planets/*.svg`
- `static/glyphs/default/zodiac/*.svg`
- `static/glyphs/modern/planets/*.svg`
- `static/glyphs/modern/zodiac/*.svg`

### App-shell normalization

The app-shell SVG files are shared, but they are not all authored with the same intrinsic geometry:

- most `default` set icons use a `209 x 209` viewBox and filled silhouettes
- `modern` set icons mostly use a `24 x 24` stroke-based Lucide-style box
- full logos are wide rectangles, not square icons

Because of that, visual normalization happens in the frontend render helpers, not in the raw asset files:

- React metadata: `apps/web-react/src/lib/app-shell.ts`
- React rendering: `apps/web-react/src/ui/app-shell-icon.tsx`
- Svelte: `apps/web-svelte/src/lib/stores/app-shell-icons.svelte.ts`
- shared mask wrapper: `SharedSvgIcon` in each frontend

Those helpers apply the active base URL, preserve rectangular logo aspect ratios, and use per-icon mask scaling so icons within the same family land on a more even visual footprint.

For docs builds, the app is published under `/apps/web-react/`, so shared asset URLs must be based on `import.meta.env.BASE_URL` rather than hard-coded root-absolute paths.

Example glyph paths:

```tsx
<img src={`${import.meta.env.BASE_URL}glyphs/default/planets/sun.svg`} alt="" />
<img src={`${import.meta.env.BASE_URL}glyphs/modern/zodiac/aries.svg`} alt="" />
```

**In-app usage**: Prefer **`apps/web-react/src/ui/astrology-glyph.tsx`** (`AstrologyGlyph`), which resolves URLs through **`apps/web-react/src/lib/astrology/glyphs.ts`** (`getAstrologyGlyphSrc` for planets, `getZodiacGlyphSrc` for signs, `readStoredGlyphSet` / `persistGlyphSet`). `SharedSvgIcon` masks the SVG with `currentColor` so glyphs follow theme text color. **`HoroscopeWheel`**: planets use native **`<image>`** (light themes: `feFlood` tint to resolved `--color-primary`; dark: invert filter); the zodiac ring uses the same **`<image>`** + per-sign `feFlood` tints from element colors when a glyph set is active, otherwise **Unicode** with the same palette from **`apps/web-react/src/lib/astrology/elementColors.ts`** (`readStoredElementColors` / `persistElementColors`, pickers under Settings → Appearance). **Do not** embed HTML/`foreignObject` in the wheel—Chromium/Tauri often mis-maps those coordinates. The horoscope dashboard list, settings observable-objects, Aspectarium, transits body lists, and Information-view badges use `AstrologyGlyph`. Bodies without files (e.g. Chiron, asteroids) still pass a Unicode `fallback` string.

Do not rely on old `dist/` copies for source of truth; `dist/` is build output and is gitignored.

## Theming

- **App-level themes** (`sunrise` | `noon` | `twilight` | `midnight`) are local React state in `App.tsx` and the sidebar. Main content backgrounds (including twilight image and midnight radial) live in **`App.tsx`**; **sidebar and secondary rails** share **`sidebarThemeStyles`** exported from **`apps/web-react/src/app/components/astrology-sidebar.tsx`** (see **[ui-conventions](./ui-conventions/)**).
- **`apps/web-react/src/styles/theme.css`** holds CSS variables for shadcn-style components. `apps/web-react/index.html` includes a small script to set `dark` on `<html>` from `localStorage` / `prefers-color-scheme` for future use.
- **`sonner`**: `apps/web-react/src/app/components/ui/sonner.tsx` does **not** use `next-themes`; it uses the `dark` class on `<html>` for toast theme.

## Figma / Make export fixes

Older `figma:asset/....png` imports should not be reintroduced as local source files. If an exported raster is truly needed, treat it as an explicit exception; otherwise prefer shared `static/` assets or CSS-defined visuals.

## TypeScript strictness

`apps/web-react/tsconfig.app.json` uses `noUnusedLocals: false` and `noUnusedParameters: false` to keep the large UI tree building cleanly. Tighten these when you refactor unused Figma placeholders.

## Related backend docs

- **[architecture](./architecture/)** — workspace YAML, compute flow, command responsibilities.
- **[integration-examples](./integration-examples/)** — `invoke` examples (`@tauri-apps/api/core`; same from React).
