---
title: "UI conventions"
description: "Theme, layout, and i18n rules for the React shell."
weight: 30
---

# UI conventions

Crisp reference for **themes**, **secondary navigation**, **shared component strategy**, and **i18n** so new work stays aligned with the app themes and a single source of styling truth.

## Component baseline

- Prefer the repo’s existing shadcn-style component systems before building bespoke controls.
- In React, start with `src/app/components/ui/`.
- In Svelte, start with `src/lib/components/ui/`.
- Treat those as the default styling surface for forms, overlays, panels, selectors, and interactive controls.
- When visuals need tuning, prefer variants, theme tokens, spacing, and composition over isolated per-component CSS forks.

## Four app themes

The product uses exactly four named themes (no ad‑hoc palettes in feature code):

| Theme      | Role (typical)                                  |
| ---------- | ----------------------------------------------- |
| `sunrise`  | Light, cool sky gradient                        |
| `noon`     | Neutral light                                   |
| `twilight` | Dark blue glass (photo background in main area) |
| `midnight` | Dark radial / slate glass                       |

**Type:** `Theme` in `src/app/components/astrology-sidebar.tsx`.

**Where they apply**

1. **Main window background** — `src/app/App.tsx` maps each theme to Tailwind classes and, for `twilight` / `midnight`, to **document-level** background (`backgroundImage` or radial gradient). Those are intentional “scene” backgrounds for the content area.
2. **Chrome (sidebars and rails)** — **`sidebarThemeStyles`** in the same file: exported `Record<Theme, SidebarThemeBlock>` with `bg`, `border`, `text`, `hover`, `active`, `separator`, etc. For `twilight` and `midnight`, **`customStyle`** adds gradient, blur, and border color so the rail matches the main sidebar.

**Rule:** Do not introduce one-off hex colors or `isDark ? … : …` forks for rails or primary navigation. Use `sidebarThemeStyles[theme]` (or extend that object if a new surface is needed).

## Secondary navigation (`SecondaryNavPanel`)

**File:** `src/app/components/secondary-nav-panel.tsx`

Used for:

- **Transits** — `TransitsSecondarySidebar` wraps it (section titles from i18n).
- **Settings** — `SettingsView` places it in a **grid** next to the settings card: `lg:grid-cols-[14rem_minmax(0,1fr)]`, `gap-6`, `items-stretch`.

The panel consumes **`sidebarThemeStyles[theme]`** for surface, borders, text, hover, and active button states. **Twilight / midnight** reuse the same **`customStyle`** as the main sidebar (not separate inline colors in this component).

Optional **`className`** on the panel (e.g. max-height + scroll on the settings rail) is for layout only, not alternate palettes.

## Transits layout (shell)

In **`App.tsx`**, when `activeView === 'tranzity'`, the transits **secondary** rail is a sibling of the main content column (same flex row as `AstrologySidebar`). Content is **`TransitsContent`** with a `section` driven by the rail.

Adding another “second column” view should follow the same pattern: sibling rail + main, theme passed through.

## Internationalization (i18n)

| Item              | Location                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Source of truth   | Repo root **`translations.csv`** (`internal_name` + `czech`, `english`, `french`, `spanish`) |
| Generated bundles | **`src/locales/*.json`** — **do not edit by hand** for routine changes                       |
| Sync command      | **`npm run i18n:sync`** (runs `scripts/csv-to-locales.mjs`)                                  |
| Runtime           | React and Svelte both consume generated locale packs; keys are CSV `internal_name` values    |

**Workflow for new copy:** add or edit a row in **`translations.csv`**, run **`npm run i18n:sync`**, then use **`t('internal_name')`** in components.

Transits-related keys use the `transits_*` prefix where grouped; shared labels reuse global keys (e.g. `planet_*`, `aspect_*`, `button_*`).

## Form fields (shared theme helper)

**`src/app/components/form-field-theme.ts`** exports `getAppFormFieldTheme(theme)` — labels, inputs, selects, date-picker surfaces, advanced panel, switches, and footer actions (rounded-lg, blue glass on twilight/midnight, indigo primaries).

**Create new chart** (`new-horoscope.tsx`) and **Settings** both use this helper on top of shadcn **`Card`**, **`Input`**, **`Label`**, **`Select`**, **`Switch`**, and native **`<button>`**s for the wide footer actions (same pattern as settings).

## Related docs

- **[frontend-react](./frontend-react/)** — Commands, folder layout, Tauri bridge, glyphs.
- **[architecture](./architecture/)** — Workspace and storage (backend-oriented).
