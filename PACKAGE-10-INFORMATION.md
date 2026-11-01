# Package 10 — Information view on chart facts

Instructions for building the Information view of the React app
(`apps/web-react`) on real chart data. This is feature work, not a move: the
current screen is a design mockup.

## Current state

`src/app/components/information-view.tsx` (966 lines) is mounted by
`src/app/shell/app-shell.tsx` as the `informace` view. It takes only appearance
props (`wheelStyle`, `elementColors`, `lightPlanetFill`) and **reads no chart**:

- Every number is fixed demo data (`ElementBars`, `HouseHeatmap`,
  `QuadrantDonut`, `HemiBalanceBar`, `AspectHistogram`, `FocalRow`, …).
- Card titles are hard-coded Czech strings instead of i18n keys.
- Hover and lock state for the cards lives in nine `useState`s and drives the
  wheel's highlights and hemisphere overlay.
- The wheel (`HoroscopeWheel`) draws its demo radix, because no positions are
  passed.

The `data-handoff` attributes (`MicroBadge_LunarPhase`,
`MicroBadge_LightsHorizon`, `MicroBadge_SynodicRoles`, …) mark the design
handoff points; keep the equivalents where the new screen has the same element.

## Data

Use the selected chart from `useWorkspaceCharts()`: its `computed` positions,
motion, axes, house cusps, aspects, shapes and configurations, and
`computed.facts` (`ChartFacts`, `src/lib/tauri/types.ts`). The facts are defined
in `docs/content/developer/chart-facts-contract.md` and computed in Rust, so
this view must not recompute classifications itself.

| Card (current title)                       | Source                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Element dominance (Převaha živlu)          | `facts.element_counts`, per body `facts.bodies[id].element`                                            |
| Modality dominance (Převaha modu)          | `facts.modality_counts`, `facts.bodies[id].modality`                                                   |
| House dominance (Převaha v domech)         | `facts.house_group_counts`, `facts.bodies[id].house` / `house_group`                                   |
| Quadrants (Kvadranty)                      | `facts.distribution.quadrants`                                                                         |
| Hemispheres (Hemisféry)                    | `facts.distribution` (`east`, `west`, `upper`, `lower`, `placed`)                                      |
| Extroversion / introversion                | `facts.orientation`                                                                                    |
| Aspects (Aspekty)                          | `facts.aspect_counts`, `facts.unaspected`, the chart's aspects                                         |
| Configurations (Konfigurace)               | `computed.configurations`, `computed.shapes`                                                           |
| Stellium                                   | `facts.stelliums`                                                                                      |
| Singleton in a hemisphere                  | `facts.bodies` + `facts.distribution` (a pure helper in `lib/`)                                        |
| Retrograde (Retrogradita)                  | `facts.bodies[id].motion`, `computed.motion`                                                           |
| Focal planets (Ohniskové planety)          | `facts.angular_planets`, `facts.chart_ruler`, `facts.final_dispositors`                                |
| Micro badges: lunar phase, lights, synodic | `facts.lunar_cycle_phase`, `facts.sun_horizon` / `moon_horizon`, `facts.mercury_phase` / `venus_phase` |

When the selected chart has no facts yet (not computed, or computed by an older
backend), show an empty state per card, not demo numbers.

## Target layout

```
src/app/features/horoscope/information/
  information-view.tsx        # composition: wheel + card columns
  use-information-focus.ts    # hovered / locked card → wheel highlights and overlay
  cards/                      # one component per card, data as props
src/app/views/domain/         # charts reused elsewhere (element bars, quadrant
                              # donut, hemisphere balance, aspect histogram)
src/lib/astrology/
  informationView.ts (+ .test.ts)   # facts → card rows, singletons, focus → highlight sets
```

The shell should mount one entry component, the way it mounts `TransitsView`.
Bar, donut and histogram visuals belong in `app/views/data/` when they only
take numbers and labels, or `app/views/domain/` when they know elements,
houses or aspects.

## Rules

- **Layers** follow `docs/content/developer/frontend-components.md`; features
  do not import each other. The wheel is `app/views/domain/horoscope-wheel/`.
- **Wheel focus:** hovering or locking a card highlights its bodies on the
  wheel (`highlightBodies`, `dimNonHighlighted`) and, for hemisphere cards, sets
  `hemisphereOverlay`. Keep that mapping in one pure function in `lib/`, tested.
- **Hemisphere naming:** the wheel's overlay kinds (`asc-dsc-east`,
  `mc-ic-north`, …) and the facts' `distribution` (`east` / `west` /
  `upper` / `lower`) must mean the same halves. Check both against the chart
  facts contract before wiring them together, and fix whichever side differs.
- **Copy** goes through i18n keys (add them to `translations.csv`, then
  `npm run i18n:sync`); no hard-coded strings.
- **No raw native controls** outside `app/components/ui/`.
- **Interaction:** single click selects / locks, double click opens; no context
  menus. Details open in `DetailSidePanel` with `ObjectDetailPanel` /
  `AspectDetailPanel`.
- **Chart time** shown anywhere is local time at the event's place
  (`formatChartLocal` / `chartTimeZone` in `lib/chartDateTime.ts`).

## Tests

- Vitest tests for every new `lib/` function: facts → card rows, singleton
  detection, focus → highlight set and overlay, empty facts.
- A server-render test of the view with a chart that has facts, one without
  facts, and no chart selected (pattern:
  `src/app/features/transits/transits.test.tsx`).
- Run time-dependent tests in several zones (`TZ=UTC`, `TZ=Europe/Prague`,
  `TZ=America/Los_Angeles`, `TZ=Asia/Kathmandu`).

## Done when

1. `npm run check`, `npx eslint apps/web-react/src`,
   `npx prettier --check apps/web-react/src`, `npm test` and `npm run build`
   pass.
2. `src/app/components/information-view.tsx` is gone and the shell mounts the
   new entry component.
3. Every card shows the selected chart's facts, or an empty state without them.
4. The component catalog lists the new screen and any new shared views,
   describing the current state only.
