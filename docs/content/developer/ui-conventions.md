---
title: 'UI conventions'
description: 'Theme, layout, component, and i18n rules for the frontend shells.'
weight: 30
doc_kind: policy
status: evolving
authority: normative
---

Crisp reference for **themes**, **secondary navigation**, **shared component strategy**, and **i18n** so new work stays aligned with the app themes and a single source of styling truth.

## Persistence boundary

Visual semantics belong to the UI. Theme, glyph set, element/body/aspect colors,
line styling, language, and layout appearance may be persisted in
`workspace.yaml:presentation` when they should travel with a project, or in
frontend local storage when they are device/session preferences. They must not
change astronomical or astrological computation.

The computation contract owns schools/models, engines, zodiac and ayanamsa,
house systems, selected bodies/aspects, aspect angles/orbs/contexts, subject
time/location, and transit intent. See the
[Workspace YAML contract](../workspace-yaml/) for the exact boundary. Legacy
model glyph/color fields remain readable during migration but are not the new
source of truth.

The React wheel-orientation choice (`ascendant` or `aries`) is likewise
presentation-only: it changes the longitude pinned to the left edge of the
rendered radix, not house cusps, axes, positions, or aspects. It is currently
stored under `wheel_orientation` in browser local storage, rather than in
workspace presentation YAML. The user-facing behavior is documented in
[Settings and appearance](../../manual/settings-and-appearance/#radix-wheel-orientation).

## UI View Modes

- **Radix View**: circular chart, houses, aspects (derived).
- **Table View**: positions table with optional JPL columns.
- **Statistics View**: aggregated counts.
- **Interpretations View**: text-based meanings.

## Component baseline

- Prefer the repo’s existing shadcn-style component systems before building bespoke controls.
- In React, start with `apps/web-react/src/app/components/ui/`.
- In Svelte, start with `apps/web-svelte/src/lib/components/ui/`.
- Treat those as the default styling surface for forms, overlays, panels, selectors, and interactive controls.
- When visuals need tuning, prefer variants, theme tokens, spacing, and composition over isolated per-component CSS forks.
- Feature-level UI should not introduce raw native controls (`<button>`, `<select>`, checkbox `<input>`, or a hand-rolled wrapper around a text `<input>` such as a search box, tag field, or icon-prefixed field) when a shared primitive exists.
- If a required primitive is missing, add it to that frontend's shared `ui/` layer first, then consume it from feature components. This includes compound fields (icon + input, input + trailing button/clear action) — wrap the shared `Input` rather than reinventing the border/background/focus styling on a bare `<input>`.

## Shared primitive baseline

Both frontend workspaces should keep these shared primitive families available before feature work adds custom controls:

- React: `Button`, `Input`, `Textarea`, `Checkbox`, `ColorInput`, `Label`, `Select`, `Card`, `Dialog`, `Sheet` / `Drawer`, `Accordion`, `Tooltip`, `Breadcrumb`, `Badge`, `Separator`, and `Table`.
- Svelte: `Button`, `Input`, `Textarea`, `Checkbox`, `ColorInput`, `Label`, `Select`, `Card`, `Dialog`, `Accordion`, `Tooltip`, `Breadcrumb`, `Badge`, `Separator`, and `Table`.

Native control tags are allowed inside the shared primitive implementations
themselves. In feature components they are drift unless no suitable primitive
exists. Framework-specific implementation status belongs in the
[React](../frontend-react/) and [Svelte](../frontend-svelte/) references;
unfinished alignment work belongs in the
[Development roadmap](../development-driver/).

## Focus and selected state

- The focused/selected "glow" (tinted border + soft outer ring) is owned entirely by the shared primitives (`ui/input.tsx`, `ui/select.tsx`, `ui/checkbox.tsx`, and any future primitive with a value state) — never redefine it in a feature component or in `form-field-theme.ts`.
- These primitives gate the ring on plain `:focus`, not `:focus-visible`. This is a deliberate choice, not an oversight: browsers only match `:focus-visible` on a `<button>`-based control (Select trigger, Checkbox) via keyboard, never on an ordinary mouse click, which made those controls look inert or "flatter" than text inputs (which always match `:focus-visible`). Using `:focus` keeps the same glow consistent across every input modality and every control type. Don't revert this to `:focus-visible` to "match standard practice" — it was tried and produced the inconsistency this rule exists to prevent.
- A compound field (icon + input, input + trailing button, tag input, date/time picker) that wraps the shared `Input` in its own bordered container must reuse the same tokens on the wrapper via `focus-within:`, e.g. `focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]`. Do not invent a different width, color, or opacity for these wrappers — see `date-picker-input.tsx` / `time-roller-picker.tsx` for the reference pattern. The inner `Input` then suppresses its own ring with `focus:ring-0` so only the wrapper glows.
- `form-field-theme.ts` may style borders, backgrounds, radii, and shadows, but must not add its own `focus:`/`focus-visible:` ring or border-color rules — those compete with the primitive's own focus classes and silently win or lose depending on control type, which is exactly how this inconsistency happened previously.
- The Svelte frontend's primitives currently still gate on `focus-visible:` only (it never accumulated the competing-override problem React did). If Svelte's controls are audited for the same "flat on click" issue, apply the same `:focus` change there for parity.

## Interior surfaces

- Avoid stacking borders on most nested blocks inside a screen; it tends to create awkward visual margins and padding relationships across the whole layout.
- Prefer a single outer surface for a major region, then use spacing, softer background layers, typography, and occasional separators to organize content inside it.
- Use inner borders sparingly for true boundaries or strong interactive affordances, not as the default way to separate every subsection.
- Focus/selected indication is a `box-shadow` ring that extends a few pixels past a control's border. Any ancestor with `overflow-hidden` and no padding buffer will clip that ring wherever a control sits flush against its edge — this bit `AccordionContent` (needed `overflow-hidden` for its collapse animation, had zero padding). Settings is built almost entirely out of accordions, so treat this as a recurring hazard, not a one-off: any `overflow-hidden` container that can host a bordered/ring-bearing child needs a small (`p-1`) padding buffer.
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
- `--ring` (the shadcn/Tailwind focus-ring color token) is deliberately mapped to `palette.accent` in `themePaletteVars()`, the same value as `--theme-accent`. This keeps the shared primitives' `ring-ring/50` focus glow on-theme without any per-component override — don't redefine `--ring` separately from `--theme-accent`, and don't reintroduce a component-level `ring-[var(--theme-accent)]` override thinking `--ring` is an unrelated generic default.
- Hover policy: use `--token-hover-subtle` for lightweight affordances and `--token-hover-strong` for primary navigation and dense selectable rows where higher contrast feedback is needed.

## Internationalization (i18n)

| Item              | Location                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Source of truth   | Repo root **`translations.csv`** (`internal_name` + `czech`, `english`, `french`, `spanish`)          |
| Generated bundles | **`src/locales/*.json`** — **do not edit by hand** for routine changes                                |
| Sync command      | **`npm run i18n:sync`** (runs `scripts/csv-to-locales.mjs`)                                           |
| Prune checker     | **`npm run i18n:prune:dry`** / **`npm run i18n:prune`** (runs `scripts/prune-unused-translations.py`) |
| Runtime           | React and Svelte both consume generated locale packs; keys are CSV `internal_name` values             |

**Workflow for new copy:** add or edit a row in **`translations.csv`**, run **`npm run i18n:sync`**, then use **`t('internal_name')`** in components.

**Cleanup workflow:** run **`npm run i18n:prune:dry`** first. If the reported keys are truly unused in both `apps/web-react/src` and `apps/web-svelte/src`, run **`npm run i18n:prune`**, then **`npm run i18n:sync`** so both frontend bundles match the CSV.

The CSV is the local source of truth for now. It is intended to mirror an externally maintained public Google Sheet later; when that is added, the import/export step should update `translations.csv` first, then keep the existing prune/sync flow unchanged.

Transits-related keys use the `transits_*` prefix where grouped; shared labels reuse global keys (e.g. `planet_*`, `aspect_*`, `button_*`).

## Form fields (shared theme helper)

**`src/app/components/form-field-theme.ts`** exports `getAppFormFieldTheme(theme)` — labels, inputs, selects, date-picker surfaces, advanced panel, switches, and footer actions using shared `--theme-*` and `--token-*` variables.

**Create new chart** (`new-horoscope.tsx`) and **Settings** both use this helper on top of shadcn **`Card`**, **`Input`**, **`Label`**, **`Select`**, **`Switch`**, and **`Button`** primitives.

Focus/selected-state classes are explicitly out of scope for this helper — see [Focus and selected state](#focus-and-selected-state).

## Related docs

- **[frontend-react](../frontend-react/)** — Commands, folder layout, Tauri bridge, glyphs.
- **[frontend-svelte](../frontend-svelte/)** — Svelte-specific structure and bridge.
- **[frontend workflow baseline](../frontend-workflow-baseline/)** — shared workflow behavior and parity.
- **[architecture](../architecture/)** — Workspace and storage (backend-oriented).
