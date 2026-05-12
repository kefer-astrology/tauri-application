---
title: "UI conventions"
description: "Theme, layout, and i18n rules for the React shell."
weight: 30
---

# UI conventions

Crisp reference for **themes**, **secondary navigation**, **shared component strategy**, and **i18n** so new work stays aligned with the app themes and a single source of styling truth.

## UI View Modes

- **Radix View**: circular chart, houses, aspects (derived).
- **Table View**: positions table with optional JPL columns.
- **Statistics View**: aggregated counts.
- **Interpretations View**: text-based meanings.

## Component baseline

- Prefer the repo’s existing shadcn-style component systems before building bespoke controls.
- In React, start with `src/app/components/ui/`.
- In Svelte, start with `src/lib/components/ui/`.
- Treat those as the default styling surface for forms, overlays, panels, selectors, and interactive controls.
- When visuals need tuning, prefer variants, theme tokens, spacing, and composition over isolated per-component CSS forks.
- Feature-level UI should not introduce raw native controls (`<button>`, `<select>`, checkbox `<input>`) when a shared primitive exists.
- If a required primitive is missing, add it to `src/app/components/ui/` first, then consume it from feature components.

## Interior surfaces

- Avoid stacking borders on most nested blocks inside a screen; it tends to create awkward visual margins and padding relationships across the whole layout.
- Prefer a single outer surface for a major region, then use spacing, softer background layers, typography, and occasional separators to organize content inside it.
- Use inner borders sparingly for true boundaries or strong interactive affordances, not as the default way to separate every subsection.
- Current React baseline follows this in `Aspectarium` and `Settings`: one primary card/sheet surface, soft interior backgrounds, and `Separator` for semantic section breaks.
- `OpenWorkspaceView` and `InformationView` should use shared `Button`/`Badge` primitives for interactive chips, toggles, and list actions instead of ad-hoc raw button styling.

## Four app themes

The product uses exactly four named themes (no ad‑hoc palettes in feature code):

| Theme      | Role (typical)                                  |
| ---------- | ----------------------------------------------- |
| `sunrise`  | Light, cool sky gradient                        |
| `noon`     | Neutral light                                   |
| `twilight` | Dark blue glass (photo background in main area) |
| `midnight` | Dark radial / slate glass                       |

**Type:** `Theme` in `src/app/components/astrology-sidebar.tsx`.

**Current source of truth**

- Shared palette model: `apps/web-react/src/lib/themePalettes.ts`
- App shell / CSS variable application: `apps/web-react/src/app/App.tsx`
- Shared themed form/control classes: `apps/web-react/src/app/components/form-field-theme.ts`
- Main sidebar theme adapter: `apps/web-react/src/app/components/astrology-sidebar.tsx`
- Secondary rail theme adapter: `apps/web-react/src/app/components/secondary-nav-panel.tsx`
- Content/form surface theme helper: `apps/web-react/src/app/components/form-field-theme.ts`

**Where they apply**

1. **Palette values** live in `themePalettes.ts` and are persisted from Settings → Appearance.
2. **App shell** applies the active palette as CSS variables in `App.tsx`.
3. **Chrome (sidebars and rails)** adapts those variables through `sidebarThemeStyles` and `SecondaryNavPanel`.
4. **Content surfaces** (inputs, selects, labels, footer actions, context rails) read the same active palette through `useAppFormFieldTheme()`.

**Rule:** Do not introduce one-off hex colors or ad-hoc theme forks for rails, content surfaces, or layout chrome. Extend the shared palette model first, then consume it through the existing adapters/helpers and CSS variables (`--theme-*`).

### Semantic token layer

- Use a thin semantic token layer derived from theme palette variables for component-level styling:
  - surface/border interaction: `--token-surface-subtle`, `--token-border-subtle`, `--token-hover-subtle`, `--token-hover-strong`
  - wheel/chart semantics: `--token-wheel-*`
  - visualization accents: `--token-viz-1..4`
- Keep these semantic tokens defined in `themePaletteVars()` and consume them in feature components rather than hardcoding `blue-*`/`gray-*`/hex values in view files.
- Hover policy: use `--token-hover-subtle` for lightweight affordances and `--token-hover-strong` for primary navigation and dense selectable rows where higher contrast feedback is needed.

## Secondary navigation (`SecondaryNavPanel`)

**File:** `src/app/components/secondary-nav-panel.tsx`

Used for:

- **Transits** — `TransitsSecondarySidebar` wraps it (section titles from i18n).
- **Settings** — `SettingsView` places it in a **grid** next to the settings card: `lg:grid-cols-[14rem_minmax(0,1fr)]`, `gap-6`, `items-stretch`.

The panel consumes the active theme palette through the same shared sidebar adapter, and its background is driven from the **secondary sidebar** palette values rather than a separate hardcoded preset.

Optional **`className`** on the panel (e.g. max-height + scroll on the settings rail) is for layout only, not alternate palettes.

## Transits layout (shell)

In **`App.tsx`**, when `activeView === 'tranzity'`, the transits **secondary** rail is a sibling of the main content column (same flex row as `AstrologySidebar`). Content is **`TransitsContent`** with a `section` driven by the rail.

Adding another “second column” view should follow the same pattern: sibling rail + main, theme passed through.

## Aspectarium target layout

The current React `Aspectarium` (`apps/web-react/src/app/components/aspectarium.tsx`) is still a prototype. The target shape should follow the imported vision from `inspiration-source/aspektarium/Kefer - Aspektárium/` while still using the app’s existing shell and shared primitives.

**Data and geometry rules**

- The left matrix rows should correspond to the current list of selected objects to compute, using the same object-selection source as the radix position report rather than a hardcoded planet list.
- The diagonal should repeat the same objects used in the rows so the matrix is self-describing.
- For a single-chart aspectarium, render the lower-triangle relationship grid.
- For transit/event-range computation, allow the same structure to expand into a square where the diagonal-adjacent edges represent the beginning and ending event times.
- Visible aspect cells should correspond only to the aspects enabled in settings and the aspects actually computed by the backend.

**Interaction rules**

- Clicking any populated aspect cell should open the aspect detail view on the right.
- The detail view should be driven by the selected relation, not by hover-only state.
- The detail view should be able to describe both bodies/points involved and the computed aspect metadata that produced that cell.
- The detail surface should appear only after explicit user action; it should not reserve permanent layout space when nothing is selected.

**Layout rules**

- The matrix should keep the full content width until the user opens a detail relation.
- When opened, the detail view should come from the right as a unified side popup rather than as a permanently visible second column.
- Desktop width for that popup should stay roughly in the 20% range of the workspace, capped to a practical reading width.
- On narrow screens, use the same popup pattern through `Sheet` or `Drawer` instead of introducing a separate mobile-only layout family.

**Component strategy**

- Reuse the shared shell and theme tokens first; do not build the aspectarium as a one-off visual island.
- Prefer existing shadcn primitives already present in the repo:
  - `Card` / `CardContent` for the matrix and detail surfaces
  - `ScrollArea` for long detail content
  - `Button` (styled as icon/cell controls where needed) for interactive aspect entries
  - `Separator` for section breaks inside the detail panel
- Prefer one reusable right-side detail panel component for repeated click-to-inspect flows across the app instead of re-implementing fixed right columns per screen.
- If a reusable matrix-specific primitive is still missing, add a new focused component in `apps/web-react/src/app/components/` or `.../ui/` rather than embedding bespoke table behavior directly into `App.tsx`.
- New styling should inherit the active theme palette through the same shared adapters/helpers used by other content surfaces.

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

**`src/app/components/form-field-theme.ts`** exports `getAppFormFieldTheme(theme)` — labels, inputs, selects, date-picker surfaces, advanced panel, switches, and footer actions using shared `--theme-*` and `--token-*` variables.

**Create new chart** (`new-horoscope.tsx`) and **Settings** both use this helper on top of shadcn **`Card`**, **`Input`**, **`Label`**, **`Select`**, **`Switch`**, and **`Button`** primitives.

## Related docs

- **[frontend-react](../frontend-react/)** — Commands, folder layout, Tauri bridge, glyphs.
- **[architecture](../architecture/)** — Workspace and storage (backend-oriented).
