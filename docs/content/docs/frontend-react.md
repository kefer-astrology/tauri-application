---
title: "React frontend"
description: "Operational guide for the React + Vite + Tauri UI workspace."
weight: 20
---

# React frontend (Tauri 2)

Operational guide for the Kefer desktop UI (React + Vite + Tauri).

## Prerequisites

- Node.js (see team `.nvmrc` or local convention).
- Rust toolchain for `cargo tauri build` / `cargo tauri dev`.
- Python sidecar: built binary expected at `src-tauri/binaries/kefer-backend` (see Tauri `bundle.resources` in `src-tauri/tauri.conf.json`).

### Workspace DuckDB storage (currently off)

The `duckdb` crate and `src-tauri/src/storage/duckdb.rs` were removed to avoid heavy native builds during UI work. **`src-tauri/src/commands/storage.rs`** still exposes the same Tauri commands (`init_storage`, `query_positions`, etc.); they are **no-ops** or return **empty lists** (see file header). Chart data still flows through YAML + Python compute; only the DuckDB time-series layer is inactive. To restore, re-add the `duckdb` dependency, bring back `storage/duckdb.rs` from version control history, and wire `commands/storage.rs` to `DuckDBStorage` again.

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
| `apps/web-react/src/app/App.tsx`     | Main shell: sidebar, views, **workspace open/save** handlers.                                                                                    |
| `apps/web-react/src/app/components/` | Feature components and the shared React UI layer. Prefer the Radix/shadcn-style primitives under `ui/`.                                         |
| `apps/web-react/src/styles/`         | `index.css` → Tailwind 4, theme tokens, fonts.                                                                                                   |
| `apps/web-react/src/lib/tauri/`      | **Tauri bridge**: types, chart payloads, workspace helpers.                                                                                      |
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
- **Settings UI**: **`apps/web-react/src/app/components/settings-view.tsx`** — language, location, house system, aspects, appearance, manual, plus **Cancel / Confirm** footer. Language is stored under **`kefer-language`**; glyph set choice writes **`glyph_set`** in `localStorage`. Other fields are UI state until workspace/theme hooks are ported. Open settings from the sidebar’s **last main nav item** (translated `settings`).
- **Conventions**: See **[ui-conventions](./ui-conventions/)** for the full i18n workflow and transits/settings layout notes.

## Tauri bridge (`apps/web-react/src/lib/tauri/`)

- **`types.ts`** — TypeScript shapes aligned with common `invoke` responses (workspace, chart details, compute result).
- **`chartPayload.ts`** — `AppChart`, workspace defaults, `chartDataToComputePayload()` (JSON shape expected by `save_workspace`).
- **`workspace.ts`** — `openFolderDialog`, `loadWorkspace`, `initStorage`, `getWorkspaceDefaults`, `getChartDetails`, `computeChart`, `saveWorkspace`, and **`openWorkspaceFolder()`** (full open flow: load charts, init storage, compute each chart).

### Wired in the UI

In **`App.tsx`**, sidebar actions:

- **Otevřít** (`otevrit`) — runs `openWorkspaceFolder()` after `open_folder_dialog`; merges workspace defaults; stores charts in React state; toasts success/failure.
- **Uložit** (`ulozit`) — if there are in-memory charts, saves via `save_workspace` + `init_storage`; prompts for folder when no `workspacePath` yet.

Other views (horoscope dashboard, transits, aspectarium) are still mostly presentational until you thread `charts` / `computed` state into them.

## Shared static assets

Keep shared source assets under repo-root `static/`. `apps/web-react` points Vite `publicDir` at that folder, so assets are copied into the app build and resolved through the active Vite base path.

Current source-of-truth layout:

- `static/app-shell/icons/default/*.svg`
- `static/app-shell/icons/modern/*.svg`
- `static/app-shell/logo-full-*.svg`
- `static/app-shell/logo-mark-*.svg`
- `static/glyphs/default/planets/*.svg`
- `static/glyphs/default/zodiac/*.svg`
- `static/glyphs/classic/planets/*.svg`
- `static/glyphs/classic/zodiac/*.svg`

For docs builds, the app is published under `/apps/web-react/`, so shared asset URLs must be based on `import.meta.env.BASE_URL` rather than hard-coded root-absolute paths.

Example glyph paths:

```tsx
<img src={`${import.meta.env.BASE_URL}glyphs/default/planets/sun.svg`} alt="" />
<img src={`${import.meta.env.BASE_URL}glyphs/classic/zodiac/aries.svg`} alt="" />
```

Do not rely on old `dist/` copies for source of truth; `dist/` is build output and is gitignored.

## Theming

- **App-level themes** (`sunrise` | `noon` | `twilight` | `midnight`) are local React state in `App.tsx` and the sidebar. Main content backgrounds (including twilight image and midnight radial) live in **`App.tsx`**; **sidebar and secondary rails** share **`sidebarThemeStyles`** exported from **`apps/web-react/src/app/components/astrology-sidebar.tsx`** (see **[ui-conventions](./ui-conventions/)**).
- **`apps/web-react/src/styles/theme.css`** holds CSS variables for shadcn-style components. `apps/web-react/index.html` includes a small script to set `dark` on `<html>` from `localStorage` / `prefers-color-scheme` for future use.
- **`sonner`**: `apps/web-react/src/app/components/ui/sonner.tsx` does **not** use `next-themes`; it uses the `dark` class on `<html>` for toast theme.

## Figma / Make export fixes

`figma:asset/....png` style imports are replaced with **`@/assets/....png`** (Vite resolves `@` → `apps/web-react/src/`). PNG files live in `apps/web-react/src/assets/`.

## TypeScript strictness

`apps/web-react/tsconfig.app.json` uses `noUnusedLocals: false` and `noUnusedParameters: false` to keep the large UI tree building cleanly. Tighten these when you refactor unused Figma placeholders.

## Related backend docs

- **[architecture](./architecture/)** — workspace YAML, DuckDB, command responsibilities.
- **[integration-examples](./integration-examples/)** — `invoke` examples (`@tauri-apps/api/core`; same from React).
