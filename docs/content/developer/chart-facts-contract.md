---
title: 'Chart facts contract'
description: 'Per-chart search classifications computed in Rust and the Open-view filters they serve.'
weight: 43
doc_kind: contract
status: evolving
authority: normative
---

`compute_chart`, `compute_chart_from_data` and `load_workspace_charts` return a
`facts` object next to positions and aspects. Facts are the astrological
classifications chart search filters compare against. They are computed once
per chart in Rust (`src-tauri/src/domain/astrology/facts.rs`) so the frontends
only count and compare and never re-implement astrology rules. The TypeScript
shape is `ChartFacts` in `apps/web-react/src/lib/tauri/types.ts`.

## Rules

- **Orbs follow settings.** Every orb-based fact (stellium chains, angular
  planets, aspect counts, unaspected planets) resolves its orb exactly like
  aspect detection: model aspect definitions, workspace/chart `aspect_orbs`, and
  per-object `object_orbs`. Disabling an aspect removes it from the facts that
  use it.
- **Planets** means the ten bodies Sun–Pluto unless a field says otherwise.
- **Houses** use the chart's house cusps; facts that need a house are `null`
  (or not counted) when cusps are missing.
- **Scope in the Open view.** Astrological filters are evaluated only on base
  charts (natal, event, horary), always within one chart. Derived charts and
  analyses are filtered by metadata only (type, name, tags, date, location).
- `version` changes whenever a field's meaning changes; cached calculations are
  keyed by it.

## Fields

| Field                               | Meaning                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bodies[id]`                        | `sign` (0 = Aries … 11 = Pisces), `degree_in_sign`, `element`, `modality`, `house`, `house_group`, `motion` (`direct` / `retrograde` / `stationary`; Sun and Moon always `direct`; stationary below 0.0001°/day). Every computed body.                                                                                                              |
| `element_counts`, `modality_counts` | Planets per element / modality.                                                                                                                                                                                                                                                                                                                     |
| `house_group_counts`                | Planets in **active** (angular: 1, 4, 7, 10), **reactive** (succedent: 2, 5, 8, 11) and **resulting** (cadent: 3, 6, 9, 12) houses.                                                                                                                                                                                                                 |
| `distribution`                      | Planet counts `east` (houses 10–3), `west` (4–9), `upper` (7–12), `lower` (1–6), `quadrants` I–IV (houses 1–3, 4–6, 7–9, 10–12) and `placed` (planets with a house). "All planets in the east" is `east == placed`.                                                                                                                                 |
| `orientation`                       | `extroverted` (fire + air), `introverted` (earth + water), `balance`.                                                                                                                                                                                                                                                                               |
| `aspect_counts`                     | Ptolemaic aspects (conjunction, sextile, square, trine, opposition) between planets, closest fit per pair.                                                                                                                                                                                                                                          |
| `unaspected`                        | Planets with no Ptolemaic aspect to any other planet.                                                                                                                                                                                                                                                                                               |
| `stelliums`                         | Groups of 3+ planets: `chain` (neighbours each within the conjunction orb; may cross sign and house boundaries), `sign` (with `sign`), `house` (with `house`). Each lists `members`.                                                                                                                                                                |
| `angular_planets`                   | Planets conjunct ASC, DSC, MC, IC, Vertex or Antivertex within the conjunction orb (`body`, `axis`, `orb`). Vertex needs an engine that returns it.                                                                                                                                                                                                 |
| `lunar_cycle_phase`                 | Eight 45° phases starting at each phase: `new_moon` 0–45°, `crescent`, `first_quarter`, `gibbous`, `full_moon`, `disseminating`, `last_quarter`, `balsamic`. The sector-centred phase stays in `moon_details.phase_id`.                                                                                                                             |
| `mercury_phase`                     | `prometheus` (west of the Sun, rises before it) or `epimetheus`. Combine with `bodies.mercury.motion`.                                                                                                                                                                                                                                              |
| `venus_phase`                       | `morning_star` or `evening_star`, same rule.                                                                                                                                                                                                                                                                                                        |
| `sun_horizon`, `moon_horizon`       | `above` (ecliptic houses 7–12 relative to ASC) or `below`.                                                                                                                                                                                                                                                                                          |
| `chart_ruler`                       | Ruler of the Ascendant's sign, `traditional` and `modern`. Its sign and house are in `bodies`.                                                                                                                                                                                                                                                      |
| `final_dispositors`                 | `traditional` (7 planets, classical rulers) and `modern` (10 planets, Pluto/Uranus/Neptune rule Scorpio/Aquarius/Pisces): `{ status: 'single', body }` when every dispositor chain ends in one planet in its own sign, `{ status: 'none' }` for a mutual reception, loop, or several planets in domicile; `null` when a required planet is missing. |

## Aspect dynamics

Every computed aspect also carries:

- `exact` — within 1 arc minute of the exact angle.
- `applying` / `separating` — orb closing / widening, from the two bodies' daily
  speeds; both `false` when exact or when a speed is unknown (axes). Together
  with `exact` they cover the whole orb.
- `phase` — `waxing` when the faster body (by mean motion: Moon, Mercury,
  Venus, Sun, Mars, Jupiter, Saturn, Chiron, Uranus, Neptune, Pluto) is 0–180°
  ahead of the slower one, `waning` for 180–360°; `null` for axes and points.

## Open-view sections

| Section                                                   | Evaluated by                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| Full text (incl. location), tags, date, base/derived type | Frontend, chart metadata                                     |
| Planets (sign, degree, house, motion)                     | `bodies`                                                     |
| Aspects (pair, type, dynamics, cycle phase)               | `aspects` with `exact` / `applying` / `separating` / `phase` |
| Houses (cusp sign and degree)                             | `house_cusps`                                                |
| Chart shape                                               | `shapes`                                                     |
| Stellium                                                  | `stelliums`                                                  |
| Planetary configurations                                  | `configurations`                                             |
| Hemispheres and quadrants                                 | `distribution`                                               |
| Modality / element / house predominance                   | `modality_counts` / `element_counts` / `house_group_counts`  |
| Aspect predominance                                       | `aspect_counts`                                              |
| Mercury and Venus                                         | `mercury_phase`, `venus_phase` + `bodies[].motion`           |
| Lunar phase                                               | `lunar_cycle_phase`                                          |
| Introversion / extroversion                               | `orientation`                                                |
| Sun and Moon horizon                                      | `sun_horizon`, `moon_horizon`                                |
| Angular planet                                            | `angular_planets`                                            |
| Unaspected planets                                        | `unaspected`                                                 |
| Chart ruler                                               | `chart_ruler` + `bodies`                                     |
| Traditional / modern final dispositor                     | `final_dispositors`                                          |

## Chart tree

The Open view lists base charts as parent rows. A derived chart is a child of
every chart in its `definition.inputs`; an analysis (synastry) is a child of
each participant chart, so a two-parent analysis appears under both. Header
sorting orders parents only; children stay oldest first. When a derived type or
a metadata filter is active, only matching children are shown and their
parents open automatically.
