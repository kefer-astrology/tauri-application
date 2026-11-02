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

These describe view families, not a claim that every analysis mode is complete.
The [React reference](../frontend-react/#current-limitations) records current
prototype boundaries.

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

- React: `Text`, `Heading`, `Button`, `Input`, `InputGroup`, `Textarea`, `Checkbox`, `ColorInput`, `Label`, `Select`, `Card`, `Dialog`, `Sheet` / `Drawer`, `Accordion`, `Tooltip`, `Breadcrumb`, `Badge`, `Separator`, and `Table`.
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
- A compound field (icon + input, input + trailing button, tag input, date/time picker) that wraps the shared `Input` in its own bordered container must reuse the same tokens on the wrapper via `focus-within:`, e.g. `focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]`. Do not invent a different width, color, or opacity for these wrappers — use `InputGroup` (`ui/input-group.tsx`), as the date and time pickers do. The inner `Input` then suppresses its own ring with `focus:ring-0` so only the wrapper glows.
- Form primitives and `ui/form-variants.ts` own field appearance and focus styles. `form-field-theme.ts` retains text and layout helpers; it must not reintroduce field, dropdown, button, or focus overrides.
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

| Theme      | Current default appearance                |
| ---------- | ----------------------------------------- |
| `sunrise`  | Light canvas gradient with blue accent    |
| `noon`     | Neutral light canvas with purple accent   |
| `twilight` | Neutral dark canvas with cyan accent      |
| `midnight` | Neutral dark canvas with pale blue accent |

**Type:** `Theme` in `apps/web-react/src/lib/theme.ts`; the active value is read with `useAppTheme()`.

The React app starts in `noon`; the chosen theme is not currently restored on
restart. Saved custom palettes are retained locally. Resetting the current
palette restores the built-in defaults for that theme. Light/dark component
behavior follows canvas luminance, including custom palettes, rather than only
the theme name.

**Current source of truth**

- Shared palette model: `apps/web-react/src/lib/themePalettes.ts`
- App shell / CSS variable application: `apps/web-react/src/app/providers/appearance.tsx`
- Shared form variants: `apps/web-react/src/app/components/ui/form-variants.ts`
- Typography roles: `apps/web-react/src/app/components/ui/typography.tsx`
- Main sidebar theme adapter: `apps/web-react/src/app/shell/astrology-sidebar.tsx`
- Secondary rail theme adapter: `apps/web-react/src/app/views/data/secondary-nav-panel.tsx`
- Remaining text/layout helper: `apps/web-react/src/app/components/form-field-theme.ts`

**Where they apply**

1. **Palette values** live in `themePalettes.ts` and are persisted from Settings → Appearance.
2. **App shell** applies the active palette as CSS variables in `AppearanceProvider` (`app/providers/appearance.tsx`).
3. **Chrome (sidebars and rails)** adapts those variables through `sidebarThemeStyles` and `SecondaryNavPanel`.
4. **Content controls and typography** read the palette CSS variables through shared primitives and recipes. `useAppFormFieldTheme()` retains compatibility for text and page/context layout; field appearance belongs to the primitives.

**Rule:** Do not introduce one-off hex colors or ad-hoc theme forks for rails, content surfaces, or layout chrome. Extend the shared palette model first, then consume it through the existing adapters/helpers and CSS variables (`--theme-*`).

### Semantic token layer

- Use a thin semantic token layer derived from theme palette variables for component-level styling:
  - surface/border interaction: `--token-surface-subtle`, `--token-border-subtle`, `--token-hover-subtle`, `--token-hover-strong`
  - wheel/chart semantics: `--token-wheel-*`
  - visualization accents: `--token-viz-1..4`
- Keep these semantic tokens defined in `themePaletteVars()` and consume them in feature components rather than hardcoding `blue-*`/`gray-*`/hex values in view files.
- `--ring` (the shadcn/Tailwind focus-ring color token) is an alias of `--theme-accent` in `styles/theme.css`. This keeps the shared primitives' `ring-ring/50` focus glow on-theme without any per-component override — don't redefine `--ring` separately from `--theme-accent`, and don't reintroduce a component-level `ring-[var(--theme-accent)]` override thinking `--ring` is an unrelated generic default.
- Hover policy: use `--theme-hover-bg`; the legacy `--token-hover-subtle` and `--token-hover-strong` names resolve to that same configured color. Selected states use `--theme-selected-bg`.
- Semantic status colors (`--destructive`, `--warning`) and neutral shadow/scrim
  effects are centralized in `styles/theme.css`; domain glyph/element/aspect
  colors have separate presentation settings. These are intentional color
  sources, not evidence of feature-level palette hardcodes.
- Form fields and menus use opaque surfaces. Default selected-state transparency is enabled only for `sunrise`; hover transparency is enabled in all four palettes. Do not infer surface translucency from either interaction setting.

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

## React choice and chart controls

`ui/choice.tsx` provides `ChoiceButton`, `ChoiceLabel` and passive `Chip` components.
Their geometry and selection colors live in `ui/choice-variants.ts`. Use these
for interactive chips, selectable menu rows, segmented options and checkbox rows
rather than rebuilding state colors in a feature.

- `ChoiceButton` variants are `chip`, `row`, `segment` and `cell`. The caller owns
  selection behavior and supplies `selected`. Selected state takes precedence
  over `preview`; a hover preview must not report itself as a selection.
- A selectable button reports `aria-pressed`; a `role="option"` reports
  `aria-selected` instead. Omitting `selected` leaves a plain action without
  toggle semantics. Preserve each control's existing keyboard and listbox logic.
- `ChoiceLabel` variants are `chip` and `row`. Keep its `htmlFor` or nested
  checkbox association, and pass checked/disabled state to the actual `Checkbox`.
  The label's selected/disabled props control appearance and indication; they do
  not replace the checkbox's value/change contract. Custom trailing controls
  stay outside the clickable label.
- `Chip` renders a span. A removable tag may contain a separate remove button;
  do not nest a remove button inside a selectable `ChoiceButton`.
- `SegmentedControl` composes choice buttons and retains its optional
  deselection behavior. `ModeSwitcher` keeps its existing two-label-plus-switch
  interaction and uses shared `Button variant="mode-label"` styling.

Hover and preview states use the configured hover background; selected states use
`--theme-selected-bg` and retain it on hover. Default selected-state transparency
therefore remains limited to Sunrise. Do not substitute the soft surface tint or
accent-button fill for a selected row. Focus indication still belongs to the
primitive. The optional outline/inset emphasis describes selection, not a new
feature-level focus rule.

Chart toolbar actions use `Button variant="toolbar"` with `size="toolbar"` or
`toolbar-icon`. Keep chart dimensions, aspect glyph colors, zoom calculations and
other domain behavior in the feature. `TableRow` owns selected/hover appearance;
`DataTable` supplies `data-state="selected"` instead of copying row colors.
Navigation continues to use its shared sidebar adapter and navigation text
colors, rather than content text colors.

Tag fields compose `InputGroup` and passive chips. Their suggestion input uses
its embedded mode; the group deliberately allows overflow so its inline
suggestions remain visible. Dropdown surfaces remain opaque.

Behavior checks in `ui/choice.test.tsx` cover segmented deselection, checkbox
label activation, disabled options, option/toggle semantics, passive chip removal
and mode-label/switch synchronization. Visual acceptance and keyboard/touch
coverage beyond those interactions remain in the
[styling roadmap](../development-driver/#react-styling-consolidation).

## React container variants

`app/components/ui/container.tsx` owns `Surface`, `Toolbar`, `ActionBar` and their
appearance/spacing recipes. Container appearance must not depend on a theme name:
primary panel and menu surfaces read the active palette CSS variables and remain
opaque. Nested `soft`/`inset` surfaces use palette-derived tints.

| Primitive   | Responsibility                                             | Main options                                                                                                                       |
| ----------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Surface`   | A generic panel, nested group, note or section boundary    | `variant="panel"`, `soft`, `inset` or `plain`; `padding="none"`, `compact`, `default` or `relaxed`; optional divider and elevation |
| `Card`      | A structured surface containing header, content and footer | `variant="default"`, `ghost`, `soft` or `inset`; `spacing="default"`, `compact` or `flush`; optional raised elevation              |
| `Toolbar`   | A horizontal header or control strip                       | Bottom divider by default; explicit padding, alignment, wrapping and surface                                                       |
| `ActionBar` | Footer actions or a bottom strip                           | Top divider and end alignment by default; `layout="responsive"` stacks actions on narrow screens                                   |

`Surface` starts without padding so each composition chooses its density. Its
padding presets are 0, 0.75rem, 1rem and 1.5rem. Toolbar/action-bar presets account
for horizontal strips: compact uses 0.75rem horizontal / 0.5rem vertical; default
uses 1rem / 0.75rem; relaxed uses 1.5rem / 1rem. Keep pane widths, height constraints,
positioning, scrolling and data-driven grid tracks in the caller.

Card header/content/footer sections accept `density="default"`, `compact` or
`none`. Default uses the existing 1.5rem horizontal card rhythm; compact uses
0.75rem for narrow information rails. Use `spacing="flush"` for a card composed
of bars and a scrolling body rather than overriding `gap-0` at each call site.
The old `Card variant="themed"` / per-theme card-class path has been removed;
the default card already uses the active palette.

Cards do not clip by default. Use `clip` only for content that needs it, and give
focusable children a padding buffer where their focus ring approaches the clipped
edge. Surface and bar primitives do not silently introduce scroll containers.
`Toolbar` is a visual composition, not an ARIA toolbar: it does not add keyboard
navigation semantics to its children.

For settings and transit setup, `SecondaryNavPanel` is a 220px rail from 1280px
up and a horizontal section strip below that breakpoint. Keep the strip's own
scrolling separate from the page body and synchronize the native titlebar's rail
measurement with the same breakpoint. Dense groups should choose columns from
their available content width (for example, auto-fit/minmax tracks), accounting
for sidebar and nested panel padding. A viewport breakpoint alone does not
guarantee enough room for a compound field or long translated label. Allow a tab
strip to wrap when its controls exceed the available width.

The horoscope dashboard uses `ChartWorkspaceLayout`. It measures the workspace,
including the effect of the main sidebar. At least 960px shows the 288px details
rail and 224px positions rail alongside the wheel, without panel toggle buttons.
Below 960px only the left details move into a modal sheet, opened by a button
that appears in this smaller layout. The sheet slides in from the right edge
and overlays Poloha while open. Escape/close restores focus to its trigger. Resizing into inline layout closes
the sheet and restores the inline details automatically.

Poloha (positions) always remains on the right. Its heading button folds or
unfolds the body using `aria-expanded` and `aria-controls`; the heading and edit
action remain visible when folded. In compact layouts its track adapts between
10rem and 14rem; its contents scroll independently. Do not mount duplicate panel
content, and preserve the dashboard's chart/action state. Poloha folding lasts
for the mounted dashboard view; it is not a persisted workspace preference.

`ModeSwitcherDetails surface="soft"` owns the nested surface of advanced options;
its animation wrapper keeps the focus-ring buffer. `SheetFooter variant="actions"`
reuses the action-bar recipe. `form-field-theme.ts` no longer defines
`advancedPanel`, `footerBorder` or `contextRail` container aliases.

### Export overlay

Export opens in the shared right-hand `DetailSidePanel` over the current screen.
Keep the originating view mounted, including its form draft and selected section;
Export must not change the active navigation route. Its sheet owns the title and
scrolling body, while the export feature owns the format/include controls.
Closing restores focus to the control that opened it. Output generation remains
a placeholder, documented in the [manual](../../manual/charts-and-workspaces/#export).

## React form variants

Use `Input variant="form"` and `density="compact"` for compact fields. Select
triggers, contents and items accept `variant="form"`; triggers also accept compact
density. `Button` provides `form-primary` and `form-secondary` variants, with
`size="form"` for full form actions. Keep widths, flex behavior and positioning in
the calling layout.

`InputGroup`, `InputGroupInput` and `InputGroupButton` own the single surface,
focus ring and disabled state of date/time compound fields. `PopoverContent variant="form"` owns their opaque menu surface. Do not rebuild these styles in a
feature or add field appearance back to `form-field-theme.ts`.

When the time popover opens, each column reveals its selected value. Preserve
that behavior when changing its scroll container or choice controls.

## React typography

`app/components/ui/typography.tsx` is the source for `Text`, `Heading` and
`typographyVariants`. `Label`, `CardTitle`, `DialogTitle`, `SheetTitle` and their
descriptions reuse these roles.

| Role           | Size at the default 16px root | Use                                              |
| -------------- | ----------------------------- | ------------------------------------------------ |
| `pageTitle`    | 1.25rem / 20px                | Page heading                                     |
| `sectionTitle` | 1.125rem / 18px               | Sections and dialog/sheet titles                 |
| `panelTitle`   | 0.875rem / 14px               | Compact panel headings and card titles           |
| `body`         | 0.875rem / 14px               | Descriptions and ordinary prose                  |
| `label`        | 0.875rem / 14px               | Form labels                                      |
| `compactLabel` | 0.75rem / 12px                | Dense field labels and short emphasized captions |
| `caption`      | 0.75rem / 12px                | Metadata, hints and supporting text              |
| `eyebrow`      | 0.75rem / 12px                | Uppercase group labels                           |

Choose the HTML heading level from document structure, independently of visual
size. `Heading level={3} variant="panelTitle"` remains an `h3`. `Text` renders a
paragraph by default; use `as="span"` for inline content. Keep form labels as
`Label` so their `htmlFor` association remains intact. Label variants are
`default`, `compact` and `eyebrow`.

Text tones are `primary`, `secondary`, `muted` and `inherit`, all using the active
palette or inherited context. Font size must not encode a theme. Retain
`tabular-nums` for comparable numeric values and `font-mono` for technical values
where appropriate.

Use the shared rem scale for HTML text, with 0.75rem as the caption floor. Do not
add new 8–11px interface labels or isolated uppercase letter-spacing recipes.
Size, weight and line-height belong to the text role; margins, widths, alignment
and wrapping remain layout concerns. Multi-line labels use a readable line-height
rather than `leading-none`.

SVG/canvas text and astrology glyph fallback sizes are geometry-dependent and
remain a separate chart-rendering concern. Their label collisions and zoom
behavior need chart-specific visual review. HTML captions around a chart still
follow the shared typography scale.

The source migration does not establish visual acceptance. Track category status
and open contrast, persistence and verification work in the
[Development roadmap](../development-driver/#react-styling-consolidation).

## Related docs

- **[frontend-react](../frontend-react/)** — Commands, folder layout, Tauri bridge, glyphs.
- **[frontend-components](../frontend-components/)** — React component categories and shared views.
- **[frontend-svelte](../frontend-svelte/)** — Svelte-specific structure and bridge.
- **[frontend workflow baseline](../frontend-workflow-baseline/)** — shared workflow behavior and parity.
- **[architecture](../architecture/)** — Workspace and storage (backend-oriented).
