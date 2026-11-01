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

| Category     | Folder                    | Knows about                                    |
| ------------ | ------------------------- | ---------------------------------------------- |
| Primitives   | `app/components/ui/`      | Nothing domain-specific                        |
| Data views   | `app/views/data/`         | Generic data shapes (rows, series, time)       |
| Domain views | `app/views/domain/`       | Astrology catalogs, glyphs, positions, aspects |
| Features     | `app/features/<feature>/` | One workflow, its provider, and Tauri commands |
| Shell        | `app/shell/`              | Navigation, layout chrome, and feature routing |

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

- `Theme` and `THEME_ORDER` live in `src/lib/theme.ts`.
- `AppThemeProvider` (`app/providers/app-theme.tsx`) wraps the app and exposes
  `useAppTheme()` → `{ theme, glyphSet }`. Components read these from the hook
  and never take them as props.
- `useAppFormFieldTheme()` and `AstrologyGlyph` read the same context.
  `AstrologyGlyph` still accepts an explicit `glyphSet` for one-off overrides.
- To preview a different value for a subtree, nest a second
  `AppThemeProvider` (Settings does this for the unsaved glyph-set choice).
- `AppearanceProvider` owns theme and glyph-set state and feeds
  `AppThemeProvider`; controls that change it (`AstrologySidebar`,
  `SettingsView`) keep explicit value/`onChange` props.
- `useAppearance()` (device preferences) and `useWorkspace()` (workspace state
  and actions) are the app-wide providers; `useWorkspaceCharts()` exposes the
  chart list and selection. Features read these instead of receiving the state
  from the shell.

## Primitives

The shadcn/Radix layer in `app/components/ui/`: `Button`, `Input`, `Checkbox`,
`ColorInput`, `Label`, `Select`, `Switch`, `Card`, `Dialog`, `Sheet`,
`Popover`, `Command`, `Accordion`, `Tabs`, `ScrollArea`, `Breadcrumb`, `Badge`, `SegmentedControl`,
`SearchField` (icon + `Input` + clear button), `Combobox` (searchable single select over a
long string list, e.g. time zones), `HighlightText`,
`Separator`, `Table`, `Calendar`, `ModeSwitcher`, `RadioGroup` / `RadioGroupItem`
(native radios sharing a name), `KeferLoader`, the page containers
`AppMainContentRoot` / `AppMainContentContainer` (`app-main-content.tsx`), the
date and time inputs `DatePickerInput` and `TimeRollerPicker`, and the
navigation rail styling `sidebarThemeStyles` / `sidebarNavMenuRowClassName`
(`sidebar-theme.ts`). Primitives
are the only place native control tags may appear
(see [UI conventions](../ui-conventions/#component-baseline)).

## Data views

### `DataTable`

`app/views/data/data-table.tsx` — sortable table built on
`@tanstack/react-table` and the `Table` primitive. Every tabular view uses it;
features supply only column definitions, rows, and callbacks.

| Prop                                       | Purpose                                                               |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `columns: ColumnDef<T>[]`                  | Column definitions, including cell renderers and `size`.              |
| `data: T[]`                                | Rows (top-level rows for a tree).                                     |
| `getRowId(row)`                            | Stable, unique row key.                                               |
| `sorting`, `onSortingChange`               | Controlled sorting (e.g. persisted sort order).                       |
| `initialSorting`                           | Starting sort order for an uncontrolled table.                        |
| `rowSelection`, `onRowSelectionChange`     | Controlled checkbox selection for a `select` column.                  |
| `isRowSelected(row)`                       | Rows drawn with the selected-state background.                        |
| `onRowClick(row)`, `onRowDoubleClick(row)` | Make rows interactive (pointer cursor, strong hover).                 |
| `getSubRows(row)`                          | Tree rows: children rendered under an expanded row.                   |
| `expanded`, `onExpandedChange`             | Controlled expansion, keyed by row id.                                |
| `sortSubRows`                              | `false` keeps children in given order; sorting reorders parents only. |
| `empty`                                    | Node rendered instead of the table when `data` is empty.              |
| `density`                                  | `'comfortable'` (default) or `'compact'` for dense data.              |
| `className`                                | Classes on the table element.                                         |

`DataTableExpander` is the first-column cell for tree rows: a chevron that
toggles expansion without triggering the row click, and an indented guide line
for children.

The table owns the sticky header, the sort toggle and its icon, header and row
theme tokens, and hover and selected states. Scrolling is the caller's
container.

Used by: the workspace chart list (as a parent/child tree) and the transit hits
table. Planned: the
aspectarium aspect and midpoint tables and the folded-angle sample table.

### Filter controls

`app/views/data/filter-controls.tsx` — building blocks for filter panels.
Values are strings and `''` means "any"; all copy comes from the caller.

| Component       | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `FilterSection` | Collapsible group; place inside an `Accordion type="multiple"`.         |
| `FieldLabel`    | Small muted field caption.                                              |
| `OptionSelect`  | Compact select with a leading "any" option (`anyLabel`, default `—`).   |
| `CheckRow`      | One labelled checkbox, optionally indented.                             |
| `CheckList`     | Multi-select checkbox list with optional headings, one or two columns.  |
| `CountField`    | Count condition: `— / 0…max` (plus extra options) and an "or more" box. |

Used by: the chart filter sections.

### `SelectionList`

`app/views/data/selection-list.tsx` — grouped multi-select over
`{ id, label, searchTerms?, disabled? }` items: search, per-group select-all
(`layout="accordion"`) or headed sections (`layout="sections"`), a count chip
that opens a side panel of the selection (jump to an item, remove it), and
"clear all". Closed groups are tracked, so groups that appear later start open.

| Prop                                           | Purpose                                                      |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `groups`, `selectedIds`, `onSelectedIdsChange` | Data and controlled selection.                               |
| `labels`                                       | All copy (search, count, clear, empty states, remove).       |
| `layout`, `collapsedGroupIds`                  | Accordion vs sections; groups closed initially.              |
| `renderItem(item, { highlight })`              | Row content after the checkbox (default: highlighted label). |
| `renderTrailing(item)`                         | Control outside the row label (e.g. a color input).          |
| `renderGroupContent(group, visible)`           | Replace a group's rows (e.g. a filtered, read-only catalog). |
| `renderPanelMeta(item)`                        | Extra text per item in the selection panel.                  |
| `headerStart`, `footer`                        | Slots above the search and below the list.                   |

Used by: `ObservableObjectList`, `AspectList`.

### `MultiSelectPopover`

`app/views/data/multi-select-popover.tsx` — a compact button that opens a
searchable checklist with select-all / clear; the trigger reads all / none / N
selected. Used by: the aspectarium body and aspect filters.

### `CheckChips`

`app/views/data/check-chips.tsx` — a wrapping row of pill checkboxes with an
optional leading slot. Used by: the folded-angle body picker.

### `SecondaryNavPanel`

`app/views/data/secondary-nav-panel.tsx` — the secondary rail next to the main
sidebar: a title and a list of sections (`items`, `activeId`, `onSelect`),
styled like the main sidebar. Used by: the Settings and Transits setup
sidebars.

### `DetailSidePanel`

`app/views/data/detail-side-panel.tsx` — a right-hand sheet with a title,
optional description and scrolling body (`open`, `onOpenChange`, `title`,
`description`, class overrides). Used by: object, aspect and transit series
details, the `SelectionList` selection panel, Open, and the edit-chart panel.

### `TimeSeriesChart`

`app/views/data/time-series-chart.tsx` — SVG line chart over a shared,
ascending time axis (epoch milliseconds).

Base props:

| Prop                          | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `categories: number[]`        | Shared X values.                                            |
| `series: TimeSeriesDef[]`     | `{ id, label, color }`, colors assigned in fixed order.     |
| `values`                      | `series.id → (number \| null)[]`; `null` breaks the line.   |
| `markers: TimeSeriesMarker[]` | `{ seriesId, index, kind: 'hit' \| 'entry' \| 'exit' }`.    |
| `tooltipExtra`                | Extra tooltip line per hovered point.                       |
| `area`, `invertY`             | Area fill to baseline; flip the Y mapping.                  |
| `yDomain`, `yTicks`           | Y scale; computed from the data when omitted.               |
| `clipToYDomain`               | Values outside `yDomain` break the line instead of drawing. |
| `formatX`, `formatY`          | Axis and tooltip formatting.                                |
| `xLabel`, `yLabel`            | Axis captions.                                              |
| `emptyLabel`                  | Text shown when `categories` is empty.                      |
| `height`                      | Fixed height, or fill the sized parent when omitted.        |

Optional interaction props; each feature turns on when its callback is passed:

| Prop                                       | Purpose                                                  |
| ------------------------------------------ | -------------------------------------------------------- |
| `visibleRange`, `onVisibleRangeChange`     | Wheel zoom and drag pan over the X window.               |
| `minVisibleSamples`                        | Zoom limit in samples (default 12).                      |
| `highlightedSeriesId`, `onHighlightChange` | Click a series to emphasize it; background click clears. |
| `onActivate(seriesId)`                     | Click on the highlighted series (open details).          |

Domain-specific charts are thin wrappers that set these props; they do not
reimplement scales, paths, or tooltips. `TransitResonanceChart`
(`features/transits/results/`) is the
reference wrapper: a degrees-from-exact scale with 0° at the top, area fill,
clipping to the orb window, and degree gridlines.

Used by: the folded-angle view and the transit resonance chart.

### `TimeTicker`

`app/views/data/time-ticker.tsx` — instants on a time axis, one lane per row,
stacked under a `TimeSeriesChart` with the same window. It shares the chart's
margins and time ticks (`app/views/data/time-axis.ts`: `TIME_CHART_MARGIN`,
`timeAxisTicks`, `timeWindow`), so marks line up with the chart above.

| Prop                         | Purpose                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `categories`, `visibleRange` | The chart's X values and window (sets the axis).           |
| `lanes`                      | `{ id, label, title? }` — one row each, label at the left. |
| `marks`                      | `{ id, laneId, x, color, title? }` — instants (epoch ms).  |
| `onMarkClick(markId)`        | Makes marks clickable.                                     |
| `title`, `emptyLabel`        | Caption above; text shown when there are no lanes.         |
| `formatX`                    | Axis label format (default `formatDateTime`).              |

Used by: the transit micro ticker (exact hits on the fast transited bodies,
natal Sun–Mars, one lane per body).

### Time formatting

`src/lib/time/format.ts` provides `formatDate`, `formatTime`, `formatDateTime`
and `formatDateTimeRange`, in the app language rather than the OS locale, so the
same instant reads the same everywhere. `TimeSeriesChart` uses `formatDateTime`
for its axis and tooltip by default.

### Chart time entry

Date and time pickers carry a wall-clock time as a `Date` whose local fields
are the entered values; that time is always local time at the event's place.

- `src/lib/time/zone.ts`: `wallTimeToLocalDate`, `localDateToWallTime` and
  `instantToWallDate(instant, zone)` convert between picker dates, wall-clock
  fields and instants.
- `src/lib/time/zoneCatalog.ts`: `TIME_ZONES`, `TIME_ZONE_REGIONS`,
  `timeZonesInRegion`, `timeZoneRegion` and `UTC_OFFSET_OPTIONS`
  (UTC−14:00…UTC+14:00 in 15-minute steps).
- `src/lib/time/dateFnsLocale.ts`: `dateFnsLocale(language)` for the
  date-picker calendar.

### Zodiac positions

`src/lib/astrology/zodiac.ts` provides `signIndexOf`, `degreeOrdinalInSign` and
`signPosition` (sign plus degrees/minutes/seconds within it, rounding carried
into the next sign) and the `ZODIAC_UNICODE_GLYPHS` text fallbacks. Views do
not compute sign positions themselves.

## Domain views

### Chart filters

`app/views/domain/chart-filters/` — chart search UI over one `ChartQuery`
(`lib/astrology/chartQuery.ts`).

- **Sections** (`chart-filter-sections.tsx`, `fact-filter-sections.tsx`): one
  component per filter group, content only (no surrounding section), each
  taking a `value` / `onChange` slice of the query — `ChartTypeFilter`,
  `TagFilter`, `DateFilter`, `LocationFilter`, `PlanetFilters`,
  `AspectFilters`, `HouseFilters`, `CatalogFilter` (shapes, configurations),
  `StelliumFilters`, `HemisphereFilters`, `ModalityFilters`, `ElementFilters`,
  `HouseGroupFilters`, `AspectDominanceFilters`, `InnerPlanetFilters`,
  `LunarPhaseFilter`, `OrientationFilter`, `HorizonFilter`,
  `AngularPlanetFilter`, `UnaspectedFilter`, `ChartRulerFilter`,
  `DispositorFilter`. Shared option lists live in `options.ts`.
- **`ChartFilterPanel`**: an accordion of the groups in `visibleGroups`, editing
  a `ChartQuery` through `onQueryChange(updater)`. `CHART_FILTER_GROUPS` is the
  ordered registry (id, label key, content); its ids are the persisted
  "hidden filter group" ids.

The query model and matching are pure: `filterChartTree(forest, query)` returns
the visible chart tree and the parents to open automatically (rules in the
[Chart facts contract](../chart-facts-contract/#chart-tree)).

Used by: Open.

### `ChartTreeTable`

`app/views/domain/chart-tree-table.tsx` — chart list as a parent/child tree on
`DataTable`: name (expander and child-count badge), type, tags, date, time and
place. Sorting reorders parents only. Rows are `ChartTreeRow` values from
`filterChartTree`.

| Prop                                   | Purpose                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| `rows`, `childCount(chartId)`          | Tree rows; badge count (defaults to the shown children). |
| `focusedChartId`, `onFocusChart`       | Selected-state row and click.                            |
| `onActivateChart`                      | Double click.                                            |
| `expanded`, `onExpandedChange`         | Controlled expansion.                                    |
| `sorting`, `onSortingChange`           | Controlled sorting.                                      |
| `rowSelection`, `onRowSelectionChange` | Pass both for a checkbox column.                         |
| `favorites`, `onToggleFavorite`        | Pass both for a favorites column.                        |
| `empty`                                | Rendered when there are no rows.                         |

Used by: Open.

### `ObjectGlyph`

`app/views/domain/object-glyph.tsx` — an observable object's glyph with the
catalog's text fallback (`objectIcon`). Views do not keep their own planet
glyph tables.

### `ObservableObjectList`

`app/views/domain/observable-object-list.tsx` — the observable-object catalog
on `SelectionList`, grouped by category (exotic groups start collapsed).
Planned objects are disabled; fixed stars render as a read-only list with
hemisphere, sign and significance filters.

| Prop                                 | Purpose                                  |
| ------------------------------------ | ---------------------------------------- |
| `selectedIds`, `onSelectedIdsChange` | Controlled selection.                    |
| `subtitle`                           | Hint shown above the search.             |
| `colors`, `onColorChange`            | Pass both for a color picker per object. |

Used by: Settings (observable objects), the horoscope dashboard position
picker, and the transiting / transited bodies setup.

### `AspectList`

`app/views/domain/aspect-list.tsx` — the aspect catalog on `SelectionList`,
viewed by type (major / minor sections) or by harmonic series (accordion),
searchable by name, angle and harmonic, with selection presets.
`selectedIds`, `onSelectedIdsChange`. `formatAspectAngle` formats aspect angles.

Used by: the transit aspects setup.

### `PositionsList`

`app/views/domain/positions-list.tsx` — a chart's computed positions
(`{ id, longitude, retrograde }`): object glyph, degrees, sign glyph, minutes,
seconds and `R`, from `signPosition`. `selectedId`, `onSelect`, `emptyText`.

Used by: the horoscope dashboard.

### `HoroscopeWheel`

`app/views/domain/horoscope-wheel/` — the radix wheel (SVG): zodiac ring,
houses, axes, aspect lines, bodies, an optional transit ring and hemisphere
overlays. Its render rules are defined in the
[Radix render contract](../radix-render-contract/). The geometry is pure and
tested in `src/lib/astrology/wheelGeometry.ts`: longitude to screen position,
house cusps, conjunction fanning (also across 0°), hemispheres split by the
chart's own ASC and MC, and aspect line weight by orb tier. Without computed
data the wheel draws a demo radix (`wheel-demo-data.ts`).

`HoroscopeWheel` composes one component per layer under `layers/`, in drawing
order: `WheelFilters` (glyph tint filters), `TransitRing`, `ZodiacRing`,
`HemisphereOverlay`, `HouseRing`, `AxisLines`, `AngleGlyphs`, `AspectLines`,
`PlanetGlyphs`. They share one `WheelFrame` (`wheel-frame.ts`: the fixed radii
in `WHEEL`, plus the theme, rotation, glyph sources and filter ids of the
render), built once by `useWheelFrame` in the wheel itself.

Used by: the horoscope dashboard and the information view.

### Detail panels

- `ObjectDetailPanel` / `ObjectDetailSections`
  (`app/views/domain/object-detail-panel.tsx`) — the details of one object.
- `AspectDetailPanel` (`app/views/domain/aspect-detail-panel.tsx`) — the
  details of one aspect, including both objects.

They are shown in `DetailSidePanel`.

### `LocationSelector`

`app/views/domain/location-selector.tsx` — the place field: typing searches,
matches drop down below, and picking one returns the geocoded place. The
search function is passed in (`searchLocations`), so the view calls no Tauri
command itself.

Used by: new horoscope, synastry, and the default location in Settings.

## Features

Each feature folder contains its screens, its provider, and any components no
other feature uses.

| Feature    | Screens                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Horoscope  | Horoscope dashboard, new horoscope (`app/features/horoscope/new-horoscope/`), aspectarium, information                                                     |
| Transits   | Transits (`app/features/transits/`): setup, results, transit layers, cycle analysis                                                                        |
| Synastry   | Synastry (`app/features/synastry/`): two people (saved chart or hand-entered birth data) and the calculation type; form logic in `src/lib/synastryForm.ts` |
| Revolution | Revolution (`app/features/revolution/`): return type, scope and period                                                                                     |
| Open       | Open (`app/features/open/`): chart archive with `useChartQuery`                                                                                            |
| Export     | Export (`app/features/export/`): format and included parts                                                                                                 |
| Settings   | Settings (`app/features/settings/`): one component per section under `sections/`, a draft context for Confirm-applied colors, glyph manager                |

Inputs shared by several features are not feature components: the date picker
and time roller are primitives, and the location selector is a domain view.
Nothing below the shell imports from `app/shell/`.

### New horoscope

`app/features/horoscope/new-horoscope/` — create a chart, or edit one in the
edit side panel (`initialValues` + `onSaved`).

- `useNewHoroscopeForm` holds the form state and actions (tags, time system,
  location resolution, submit). The state and its transitions are pure
  functions in `src/lib/newHoroscopeForm.ts`: `initialNewHoroscopeState`
  (edited chart shown at local time of its place; a new chart starts now at
  the default place), `withTimeSystem` (Gregorian ↔ Julian calendar ↔ Julian
  Day, same moment), `withTags`, `withTagRenamed`, `withResolvedLocation`,
  `withTimeZoneRegion`.
- One component per section under `sections/`, each taking the form:
  `ChartBasicsSection` (name, type), `TimeSection` (time system, date and
  time, time regime, manual zone and UTC offset), `LocationSection` (geocoded
  or manual place and coordinates), `TagsSection`, `RodenRatingSection`.
- `TagField` (chips + inline `TagSuggestionInput` + editor button) and
  `TagSheet` (add, rename, recolor, remove) edit the tags; suggestions come
  from the workspace tag catalog.
- `FormField` and `FormSelect` (`form-controls.tsx`) are the label-over-control
  field and the fixed-option select.

Reuses `DatePickerInput`, `TimeRollerPicker`, `LocationSelector` and
`Combobox`.

### Transits

`app/features/transits/` — transit setup, computation and results.

- `TransitsProvider` / `useTransits()` (`transits-provider.tsx`) is mounted
  around the shell, because the results also drive the secondary sidebar and
  the horoscope views' transit overlay. It holds the setup (`setup`,
  `updateSetup`), the source chart, the computed series, exact events and
  aspect timelines, and the results view state (`view`: chart or table,
  hidden series, Y zoom, visible range).
- The setup state, its defaults, period presets, sampling step, saved form
  (`TransitSetup`) and request range are pure functions in
  `src/lib/astrology/transitSetup.ts`; result derivations (timelines against
  the transited bodies, zoom windows, orb clipping, markers, colors, layer
  groups, warnings) are in `src/lib/astrology/transitResults.ts`.
  `compute-transits.ts` runs the snapshot (overlay) and series requests.
- `TransitsView` and `TransitsSidebar` (`transits-view.tsx`) are what the
  shell mounts: the setup until a series is computed, then the results.
- `setup/`: `TransitsSetupView` (one section at a time), `GeneralSection`
  (type, period, chart, options, event searches, configurations, period
  bounds, sampling), `TransitsSetupSidebar`, `ConfigurationSelector`,
  `PeriodBoundFields`, `SetupSelect` and `CheckOption`.
- `results/`: `TransitsResultsView` composes `ResultsToolbar`,
  `ResonancePanel` (resonance chart + `TransitMicroTicker`), `ExactHitsTable`
  (on `DataTable`), `CycleAnalysisPanel`, `EventSearchPanel`,
  `ConfigurationMatchesPanel` and `SeriesDetailPanel`; `TransitLayersPanel` is
  the results sidebar. Panels below the view take their data as props.
- `TimeStepUnitSelect` is shared by the setup and the toolbar.

## Shell

`app/shell/`: `app-shell.tsx` (`AppShell`: active view, sections, sidebars,
edit panel; `App` composes it under the providers), `AstrologySidebar`,
`WindowTitlebar`, `HoroscopeContextTabs` and `GuidedTour`. Feature-specific
secondary sidebars belong to their feature and are built on
`SecondaryNavPanel`.

## Adding a component

1. Place it in the lowest category that fits its dependencies.
2. If a second feature needs a feature-local component, move it down to a view
   category rather than importing across features.
3. Add it to this catalog with its props and consumers.
