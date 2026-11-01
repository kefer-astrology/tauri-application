# Package 7 — Horoscope dashboard and aspectarium

Instructions for rebuilding the Horoscope dashboard and the Aspectarium in the
React app (`apps/web-react`). Both screens are being redesigned, so this
package rebuilds them; it does not move the current code over as it is. Keep
the current files working until the new screens replace them in the shell.

## Current state

| File                                         | Lines | What it holds                                                                                                                                                                                                                                                   |
| -------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/components/horoscope-dashboard.tsx` | 795   | Profile card (name, type, date/time at the event's place, place, tags, transit overlay badge), astrolabe card (time stepping), radix wheel, positions card (`PositionsList` + position picker sheet), object and aspect detail panels. 12 `useState`.           |
| `src/app/components/aspectarium.tsx`         | 910   | Three views — aspect grid (`table`), aspect list (`list`), midpoints (`midpoints`) — with body / aspect-type filters (`MultiSelectPopover`), orb presets, radix vs. transit layer, and the aspect detail panel. Tables are hand-built on the `Table` primitive. |

Both are mounted by `src/app/shell/app-shell.tsx` (views `horoskop` and
`aspektarium`) and read `useWorkspaceCharts()` for the selected chart and the
transit overlay. `HoroscopeDashboard` also takes appearance props (wheel
style, element colors, symbol sets) and `onEdit` /
`onObservableObjectsChange` from the shell.

Guided-tour anchors that must survive: `radix-profile`, `radix-astrolabe`,
`radix-wheel`, `radix-positions` (see `src/app/components/guided-tour.tsx`).

## Target layout

```
src/app/features/horoscope/
  dashboard/
    horoscope-dashboard-view.tsx   # composition only
    use-dashboard-state.ts         # collapsed cards, astrolabe step, picker, wheel selection
    profile-card.tsx
    astrolabe-card.tsx
    positions-card.tsx
    position-picker-sheet.tsx
  aspectarium/
    aspectarium-view.tsx           # composition: filters + active view + detail panel
    use-aspectarium-state.ts       # view, filters, orb preset, selection
    aspect-grid.tsx                # the pair matrix
    aspect-table.tsx               # list view on DataTable
    midpoint-tables.tsx            # midpoints + contacts on DataTable
src/lib/astrology/
  aspectarium.ts (+ .test.ts)      # pair keys, filtering, orb presets, row building
  dashboard.ts   (+ .test.ts)      # profile labels, astrolabe step, position rows
```

`new-horoscope/` already lives in `features/horoscope/`; the dashboard and
aspectarium join it. The shell should end up mounting one entry component per
screen, the way it mounts `TransitsView`.

## Rules

- **Layers** follow `docs/content/developer/frontend-components.md`: features
  may use primitives, data views, domain views and `lib/`; they do not import
  other features. Anything the dashboard and aspectarium both need (aspect
  glyph cells, position cells, the detail panels) belongs in
  `app/views/domain/`.
- **Tables** use `DataTable` (`app/views/data/data-table.tsx`): column
  definitions, rows and callbacks only. The aspect grid is a matrix, not a
  list, and may stay a custom component, but it must use the `Table`
  primitive and theme tokens rather than raw elements.
- **No raw native controls** (`<button>`, `<input>`, `<select>`) outside
  `app/components/ui/`. Add a primitive first if one is missing.
- **Pure logic in `lib/`** with Vitest tests: pair keys and identity, aspect
  filtering by bodies / types / orb preset, transit vs. radix rows, midpoint
  rows, the astrolabe step (`addUtcStep` already exists in
  `lib/chartDateTime.ts`).
- **Chart time is local time at the event's place.** Use `chartTimeZone`,
  `formatChartLocal` and `parseChartDateTime` from `lib/chartDateTime.ts`;
  never the machine's zone.
- **State:** one state hook per screen instead of many `useState`s. Read
  `useWorkspaceCharts()` / `useWorkspace()` / `useAppearance()` directly
  instead of receiving their values from the shell.
- **Interaction:** single click selects, double click opens; no context menus.
- **Copy** goes through i18n keys. Add new keys to `translations.csv` and run
  `npm run i18n:sync`.
- **Reuse:** `HoroscopeWheel`, `PositionsList`, `ObservableObjectList`,
  `MultiSelectPopover`, `DetailSidePanel`, `ObjectDetailPanel`,
  `AspectDetailPanel`, `ObjectGlyph`, `signPosition`, `formatSignedDms`.

## Tests

- Vitest tests for every new `lib/` module.
- A server-render test per screen (see
  `src/app/features/settings/settings-view.test.tsx` and
  `src/app/features/transits/transits.test.tsx` for the pattern), covering:
  dashboard with and without a transit overlay; aspectarium in each view
  (grid, list, midpoints) for radix and transit layers.
- Run time logic in several zones: `TZ=UTC`, `TZ=Europe/Prague`,
  `TZ=America/Los_Angeles`, `TZ=Asia/Kathmandu`.

## Done when

1. `npm run check`, `npx eslint apps/web-react/src`,
   `npx prettier --check apps/web-react/src`, `npm test` and `npm run build`
   pass.
2. `horoscope-dashboard.tsx` and `aspectarium.tsx` are gone from
   `src/app/components/`, and the shell mounts the new entry components.
3. The component catalog (`docs/content/developer/frontend-components.md`)
   lists the new screens and any new shared views, describing the current
   state only.
