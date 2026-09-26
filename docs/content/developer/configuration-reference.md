---
title: 'Configuration reference'
description: 'Complete inventory of calculation, catalog, chart, analysis, view, and presentation options.'
weight: 39
doc_kind: contract
status: current
authority: normative
---

This is the option index for the current unreleased schema. It contains only the
canonical format: there are no deprecated aliases or legacy chart
classifications. The executable contract is
`src-tauri/src/workspace/models.rs`; the named frontend catalogs supply
selectable presentation and object IDs.

## Resolution and scope

Calculation settings resolve from lowest to highest precedence:

`application < model < workspace < preset < chart < operation`

An omitted optional scalar means inherit. At preset, chart, and operation
scope, an explicitly empty body or aspect list means select none. Presentation
settings never enter calculation resolution.

| Domain | Model | Workspace | Preset | Chart | Operation |
|---|---:|---:|---:|---:|---:|
| House system | yes | yes | yes | yes | yes |
| Position mode | yes | yes | yes | yes | yes |
| Bodies and aspects | yes | yes | yes | yes | yes |
| Per-aspect orbs | definition | yes | yes | yes | yes |
| Engine | model | yes | yes | yes | yes |
| Zodiac / ayanamsa | model | — | yes | yes | yes |
| Time system | — | yes | yes | yes | yes |
| Model definition overrides | workspace | workspace | yes | yes | yes |

## Calculation enums

| Setting | Serialized options | Default |
|---|---|---|
| `house_system` | `Placidus`, `Whole Sign`, `Campanus`, `Koch`, `Equal`, `Regiomontanus`, `Vehlow`, `Porphyry`, `Alcabitius` | built-in model: `Placidus` |
| `position_mode` | `apparent`, `geometric` | `apparent` |
| `zodiac_type` | `Tropical`, `Sidereal` | built-in model: `Tropical` |
| `engine` / `ephemeris_engine` | `jpl`, `swisseph`, `jyotish`, `custom` | built-in model and new workspace: `jpl` |
| `ayanamsa` | `Lahiri`, `Raman`, `Krishnamurti`, `FaganBradley`, `DeLuce`, `UserDefined` | provider/model dependent |
| `time_system` | `gregorian`, `julian_day`, `julian_calendar`, `unix_timestamp`, `ordinal_date`, `iso_week_date`, `compact_date` | Gregorian input workflow |
| location/timezone input mode | `auto`, `manual` | UI workflow default |

`apparent` is recommended. JPL/ANISE applies converged reception light-time
and stellar aberration (`CN+S`); Swiss Ephemeris uses its normal apparent mode.
`geometric` disables those corrections (ANISE `NONE`, Swiss
`SEFLG_TRUEPOS`). The setting affects ephemeris bodies and coordinates derived
from their state; it does not redefine mathematical points such as mean nodes
or house cusps.

### Model and workspace calculation fields

Beyond the enums above, a model can set `default_bodies`, `default_aspects`,
`default_transit_bodies`, `default_transit_aspects`,
`default_direction_bodies`, `default_direction_aspects`, `standard_orb`,
`degrees_in_circle`, `obliquity_j2000`, and `coordinate_tolerance`. A workspace
can set the effective engine/backend, position mode, default location, house
system, bodies, aspects, per-aspect orbs, and time system. Presets, charts, and
operations can override their supported calculation fields according to the
scope table above.

A location consists of `name`, `latitude`, `longitude`, `timezone`, optional
`utc_offset`, and independent `location_mode` / `timezone_mode` values
(`auto` or `manual`). A chart can additionally carry tags, tag colors, and a
Rodden rating; these describe the record and do not alter its astronomy.

## Chart, analysis, and view taxonomy

| Domain | Options |
|---|---|
| Base chart purpose | `natal`, `event`, `horary`, `electional`, `moment` |
| Derived chart method | `return`, `progression`, `direction`, `relocation`, `harmonic`, `persona`, `composite`, `davison`, `draconic`, `coalescent` |
| Analysis method | `synastry`, `transit_comparison`, `chart_comparison` |
| View layout | `single`, `biwheel`, `triwheel`, `grid`, `timeline` |
| View module | `WheelView`, `TransitTimeline`, `AspectGrid`, `SummaryTable`, `InterpretationText` |

A chart has exactly one `definition`: `{kind: base, purpose: ...}` or
`{kind: derived, method: ..., inputs: [...], parameters: {...}}`. An analysis
references chart inputs and may apply derived-chart steps to each input. A view
selects layout and modules; it does not change calculation identity.

## Objects and model catalogs

`observable_objects` and `default_bodies` contain stable object IDs. The
selectable registry is `apps/web-react/src/lib/astrology/observableObjects.ts`;
each entry declares `available` or `planned`. Available IDs currently are:

- Luminaries and planets: `sun`, `moon`, `mercury`, `venus`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`, `pluto`.
- Angles and sensitive points: `asc`, `mc`, `desc`, `ic`, `vertex`, `antivertex`, `part_of_fortune`, `part_of_spirit`.
- Nodes and lunar apogees: `north_node`, `south_node`, `true_north_node`, `true_south_node`, `lilith`, `true_lilith`.
- Other bodies: `chiron`, `ceres`, `pallas`, `juno`, `vesta`, `astraea`, `hebe`, `iris`, `flora`, `metis`, `hygiea`, `parthenope`, `victoria`, `egeria`, `irene`, `eunomia`, `psyche`, `thetis`, `melpomene`, `fortuna`, `massalia`.

The remaining registry entries are visible but `planned`: `lilith_oscu`, the
geocentric planetary nodes, trans-Neptunian objects, Uranian/hypothetical
points, and fixed stars. A requested small body is computable only when its
provider mapping and a covering kernel are available.

Model `body_definitions` can configure `id`, `enabled`, `glyph`, `formula`,
`element`, `avg_speed`, `max_orb`, localized names, `object_type`, provider
`computation_map`, `requires_location`, and `requires_house_system`.
`object_type` is `planet`, `asteroid`, `angle`, `house_cusp`,
`calculated_point`, `lunar_node`, or `part`. `element` is `Fire`, `Earth`,
`Air`, or `Water`.

## Aspects

The built-in selectable IDs are `conjunction`, `sextile`, `square`, `trine`,
`opposition`, `semisextile`, `decile`, `novile`, `semisquare`, `septile`,
`quintile`, `binovile`, `quincunx`, `tridecile`, `sesquiquadrate`,
`biquintile`, and `quadrinovile`.

The default-enabled set is conjunction, sextile, square, trine, quincunx, and
opposition. A model aspect definition can configure `id`, `enabled`, `glyph`,
exact `angle`, `default_orb`, localized names, `color`, `importance`,
`line_style`, `line_width`, `show_label`, `interpretation_weight`, and valid
contexts (`chart`, `transit`, `direction`). `aspect_orbs` overrides individual
orb values by ID.

Aspect-line presentation exposes tight/medium/loose percentage thresholds,
four stroke widths, and outer style `solid`, `dashed`, or `dotted`. Defaults are
1%, 2%, and 10%; widths 5, 2, 1, and 1; outer style `dotted`.

## Signs, symbols, and visual choices

Model signs configure `name`, `glyph`, `abbreviation`, `element`, and localized
names. The twelve stable frontend IDs are `aries`, `taurus`, `gemini`,
`cancer`, `leo`, `virgo`, `libra`, `scorpio`, `sagittarius`, `capricorn`,
`aquarius`, and `pisces`.

| Presentation setting | Options / shape | Persistence |
|---|---|---|
| Astrology glyph set | `default`, `modern` | local UI; workspace `presentation.glyph_set` is portable |
| Degree-symbol sets | `sepharial`, `charubel` available; `sabian`, `kefer` catalogued but unavailable pending content/licensing | local UI selection |
| Wheel style | `minimalist`, `technical` | local UI |
| Wheel orientation | `ascendant`, `aries` | local UI |
| App theme | `sunrise`, `noon`, `twilight`, `midnight` | UI/workspace presentation |
| Language | `cs`, `en`, `fr`, `es` | UI/workspace presentation |
| Element colors | `fire`, `earth`, `air`, `water` to CSS color | workspace presentation |
| Point/aspect colors | ID-to-CSS-color maps | workspace presentation |

Portable workspace presentation fields are `theme`, `language`, `glyph_set`,
the four element colors, per-point colors, per-aspect colors, and aspect-line
tier styling. Workspace identity/model selection fields are `owner`,
`active_school`, `active_model`, extensible school definitions, and optional
workspace-level model overrides. File collections cover presets, subjects,
charts, analyses, layouts, annotations, and transit analyses.

The degree-symbol source of truth is
`static/astrology-symbols/catalog.json`; unavailable entries remain disabled
and are not presented as bundled data.

## Transit configuration

Persisted transit setup exposes `transit_type`, `period_mode`, inclusive
from/to dates and times, `time_step_seconds`, transiting and transited bodies,
aspect IDs and per-aspect orbs, optional school/model/model overrides, and the
booleans `house_transitions`, `sign_transitions`, `exact_hits`,
`station_events`, `transit_limits`, and `precession_correction`. See the
[Transit series contract](../transit-series-contract/) for result semantics.

## Validation rules

- IDs in defaults and overrides must exist in the resolved model catalog.
- Latitude is `-90..90`; longitude is `-180..180`; timezone is an IANA name or valid fixed offset.
- Derived-chart inputs and analysis references resolve inside the workspace.
- Analysis inputs contain exactly one of `chart_id` or `inline_subject`.
- Provider availability is separate from catalog validity: a valid object can still return an explicit unavailable warning when ephemeris data is absent.
