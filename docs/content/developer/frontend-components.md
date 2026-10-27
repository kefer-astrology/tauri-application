---
title: 'React component catalog'
description: 'Component categories, dependency rules, and the shared React views.'
weight: 22
doc_kind: policy
status: evolving
authority: normative
---

The catalog of shareable components in the React frontend
(`apps/web-react/src`). It defines which category every component belongs to,
what each category may depend on, and the contract of each shared view. Styling,
theme, and i18n rules stay in [UI conventions](../ui-conventions/); runtime
wiring stays in the [React frontend](../frontend-react/) reference.

## Categories and layout

| Category     | Folder                      | Knows about                                     |
| ------------ | --------------------------- | ----------------------------------------------- |
| Primitives   | `app/components/ui/`        | Nothing domain-specific                         |
| Data views   | `app/views/data/`           | Generic data shapes (rows, series, time)        |
| Domain views | `app/views/domain/`         | Astrology catalogs, glyphs, positions, aspects  |
| Features     | `app/features/<feature>/`   | One workflow, its provider, and Tauri commands  |
| Shell        | `app/shell/`                | Navigation, layout chrome, and feature routing  |

Non-visual code (catalogs, calculations, formatting, the Tauri bridge) stays in
`src/lib/`.

### Dependency rules

Each category may import only from the categories above it in this list, plus
`src/lib/`:

1. **Primitives** — no imports from any other category.
2. **Data views** — primitives only. They take all copy (labels, empty-state
   text) as props and do not import `lib/astrology/` or `lib/tauri/`.
3. **Domain views** — primitives, data views, `lib/astrology/`. They take data
   and callbacks as props. They do not read feature providers or call Tauri
   commands.
4. **Features** — everything above, their own provider, and `lib/tauri/`.
   Features do not import each other; anything two features need belongs in a
   view category.
5. **Shell** — composes features. It does not render domain views directly.

### Shared context

- `Theme` and related types live in `src/lib/theme.ts`, not in a component
  file.
- An app-level provider exposes `useAppTheme()` → `{ theme, glyphSet }`. Views
  read it from there instead of taking `theme` and `glyphSet` props.

## Primitives

The shadcn/Radix layer in `app/components/ui/`: `Button`, `Input`, `Checkbox`,
`ColorInput`, `Label`, `Select`, `Switch`, `Card`, `Dialog`, `Sheet`,
`Popover`, `Command`, `Accordion`, `Tabs`, `ScrollArea`, `Breadcrumb`, `Badge`,
`Separator`, `Table`, `Calendar`, `ModeSwitcher`, `KeferLoader`. Primitives
are the only place native control tags may appear
(see [UI conventions](../ui-conventions/#component-baseline)).

## Data views

### `DataTable`

Sortable table built on `@tanstack/react-table` and the `Table` primitive.
Every tabular view uses it; features supply only column definitions and rows.

| Prop                         | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `columns: ColumnDef<T>[]`    | Column definitions, including cell renderers and `size`.    |
| `data: T[]`                  | Rows.                                                       |
| `getRowId(row)`              | Stable row key.                                             |
| `sorting`, `onSortingChange` | Optional controlled sorting (e.g. for persisted sort).      |
| `selectedRowId`              | Row drawn with the selected-state background.               |
| `onRowClick(row)`            | Makes rows interactive (pointer cursor, hover state).       |
| `empty`                      | Node rendered when `data` is empty.                         |
| `density`                    | `'comfortable'` (default) or `'compact'` for dense data.    |
| `maxHeight`                  | Scrolls the body under a sticky header.                     |

The table owns sticky headers, the sort toggle and its icon, header/row theme
tokens, and hover/selected states.

Used by: the workspace chart list, the transit hits table, the aspectarium
aspect and midpoint tables, and the folded-angle sample table.

### `TimeSeriesChart`

SVG line chart over a shared, ascending time axis (epoch milliseconds).

Base props:

| Prop                        | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `categories: number[]`      | Shared X values.                                                 |
| `series`                    | `{ id, label, color }[]`, colors assigned in fixed order.        |
| `values`                    | `series.id → (number \| null)[]`; `null` breaks the line.        |
| `markers`                   | `{ seriesId, index, kind: 'hit' \| 'entry' \| 'exit' }[]`.       |
| `tooltipExtra`              | Extra tooltip line per hovered point.                            |
| `area`, `invertY`           | Area fill to baseline; flip the Y mapping.                       |
| `yDomain`, `yTicks`         | Y scale.                                                         |
| `formatX`, `formatY`        | Axis and tooltip formatting (default: shared time formatters).   |
| `height`                    | Fixed height, or fill the sized parent when omitted.             |

Optional interaction props, all opt-in:

| Prop                                       | Purpose                                         |
| ------------------------------------------ | ----------------------------------------------- |
| `visibleRange`, `onVisibleRangeChange`     | Zoom and pan over the X window.                 |
| `highlightedSeriesId`, `onHighlightChange` | Emphasize one series, dim the rest.             |
| `onActivate(seriesId)`                     | Click on the highlighted series (open details). |

Domain-specific charts (for example the transit resonance chart) are thin
wrappers that map their data to these props; they do not reimplement scales,
paths, or tooltips.

Used by: the folded-angle view and the transit resonance chart.

### `TimeTicker`

A compact horizontal time strip that marks events (exact hits, ingresses) on a
time axis, sharing the time formatters with `TimeSeriesChart`.

Used by: transit results.

### Time formatting

`src/lib/time/format.ts` provides the date, time, axis-tick, and range
formatters used by all time-based views, so the same instant is shown the same
way everywhere.

## Domain views

### `ObservableObjectList`

A list of observable objects from the domain catalog
(`lib/astrology/observableObjects.ts`), optionally grouped by category, with
search and selection.

| Prop                                 | Purpose                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| `items`                              | Objects to show; defaults to the full catalog.                |
| `groupBy`                            | `'category'` (collapsible groups) or `'none'`.                |
| `searchable`                         | Shows the search field (label, fallback, and alt names).      |
| `selection`                          | `'none'`, `'single'`, or `'multi'`.                           |
| `selectedIds`, `onSelectedIdsChange` | Controlled selection.                                         |
| `highlightedId`, `onItemClick`       | Focus a row and react to clicks without selecting.            |
| `renderTrailing(item)`               | Per-row trailing slot (color picker, value, badge).           |
| `filters`                            | Optional fixed-star filters (hemisphere, significance, sign). |

Rows are rendered with `ObservableObjectRow`.

Used by: the body selectors (settings, horoscope, transits), the glyph manager,
and the folded-angle body picker.

### `ObservableObjectRow`

The single row building block: glyph, localized label, optional leading
checkbox, and trailing slot, with the shared hover and selected states. Every
object-per-row view uses it.

### `AspectList`

The aspect counterpart of `ObservableObjectList`: grouped by aspect type or by
harmonic, with search, selection, and a trailing slot (orb).

Used by: the aspect selectors (settings, transits).

### `PositionsList`

Computed positions for a chart: object glyph, sign glyph, degrees/minutes,
and retrograde flag, built on `ObservableObjectRow`, with selection linked to
the wheel.

Used by: the horoscope dashboard.

### `HoroscopeWheel`

The radix wheel. Its render rules are defined in the
[Radix render contract](../radix-render-contract/).

Used by: the horoscope dashboard and the information view.

### Detail panels

- `DetailSidePanel` — the container for object, aspect, and cycle details.
- `ObjectDetailPanel` / `ObjectDetailSections` — the details of one object.
- `AspectDetailPanel` — the details of one aspect, including both objects.

## Features

Each feature folder contains its screens, its provider, and any components no
other feature uses.

| Feature    | Screens                                                       |
| ---------- | ------------------------------------------------------------- |
| Horoscope  | Horoscope dashboard, new horoscope, aspectarium, information  |
| Transits   | Transit setup, transit results, transit layers, cycle analysis, folded angle |
| Synastry   | Synastry view                                                 |
| Revolution | Revolution view                                               |
| Workspace  | Open workspace, export workspace                              |
| Settings   | Settings view, glyph manager                                  |

Inputs shared by several features are not feature components: the date picker
and time roller are primitives, and the location selector is a domain view.

## Shell

`App`, `AstrologySidebar`, `WindowTitlebar`, `SecondaryNavPanel`,
`AppMainContentRoot` / `AppMainContentContainer`, `HoroscopeContextTabs`, and
`GuidedTour`. Feature-specific secondary sidebars belong to their feature and
are mounted through `SecondaryNavPanel`.

## Adding a component

1. Place it in the lowest category that fits its dependencies.
2. If a second feature needs a feature-local component, move it down to a view
   category rather than importing across features.
3. Add it to this catalog with its props and consumers.
