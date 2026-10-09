---
title: 'Transit series contract'
weight: 44
doc_kind: contract
status: current
authority: normative
---

This page defines the frontend-visible contract for computing transit series.

Use this contract before adding or changing transit-series UI in either frontend.

## Related: instant transit overlay

This page covers only the persisted-workspace series path (`compute_transit_series`). React's Transits view also has a second, previously-undocumented path: an "instant" overlay for the current moment (or an arbitrary single datetime) that does not require a persisted source chart id. That path computes the transit chart's positions via `compute_chart_from_data`, then detects cross-chart aspects between those positions and the radix chart's positions via `compute_cross_aspects_from_data` (see [tauri-command-contracts](../tauri-command-contracts/)) — the same Rust aspect-detection geometry `compute_transit_series` uses, not a client-side reimplementation. Both transit-aspect code paths therefore resolve through Rust; neither frontend duplicates the angle/orb geometry.

`compute_transit_series_from_data` is the corresponding in-memory caller path.
It accepts the same sampling/event/configuration options but does not establish a
second frontend workflow or Python event-search route.

## Command

Both frontends call the same Tauri command:

`compute_transit_series`

Required request fields:

- `workspacePath`: active workspace folder path
- `chartId`: persisted source chart id from that workspace
- `startDatetime`: canonical datetime string, preferably RFC3339
- `endDatetime`: canonical datetime string, preferably RFC3339
- `transitingObjects`: object ids to compute for the moving chart
- `transitedObjects`: object ids to compare against the persisted source chart
- `aspectTypes`: aspect ids to include in cross-chart aspect detection

Optional request fields:

- `sampledSeries` (boolean, default `true`): whether the sampled `results`
  graph series is computed at all. A caller that only wants `exactHits`/
  `stationEvents`/a configuration search can set this to `false` and skip
  `timeStepSeconds` entirely — "event discovery" and "graph sampling" are
  independent concepts at this contract's boundary, not just internally.
- `timeStepSeconds`: positive integer step size, **required when
  `sampledSeries` is true** (the default) and ignored when it is `false`.
  This is the sampled-series graph resolution only; it has no effect on any
  event or configuration search and is never redefined as event-time
  precision.
- `exactHits` (boolean, default `false`): also run an exact-event search for
  the requested transiting/transited/aspect combination — see
  [Exact event search](#exact-event-search-exacthits--stationevents) below
- `stationEvents` (boolean, default `false`): also run a stationary-point
  search for each requested transiting body
- `configurationRequests` (array, default `[]`): also run one or more
  multi-body configuration interval searches — see
  [Multi-body configuration search](#multi-body-configuration-search-configurationrequests)
  below

All four flags/fields are optional specifically so a caller that predates
them (neither frontend bridge sends `configurationRequests`, and only React
sends `exactHits`/`stationEvents`, as of this writing) keeps working
unchanged — a missing field deserializes as "not requested," not as a
command error.

Response fields:

- `source_chart_id`
- `time_range.start`
- `time_range.end`
- `time_step` — the literal sentinel `"n/a"` when `sampledSeries` was `false`,
  never a rounded or assumed step
- `results` — always `[]` when `sampledSeries` was `false`
- `event_search` — always present, even when `exactHits`, `stationEvents`,
  and `configurationRequests` are all false/empty (in which case it is the
  cheap, fixed shape `{ "events": [], "configuration_matches": [], "complete": true, "warnings": [] }`);
  see below for its shape otherwise
- backend provenance fields when available, such as `backend_used`, `fallback_used`, `ephemeris_source`, and `warnings` — populated from one cheap radix lookup even when `sampledSeries` is `false`, so the response shape is uniform either way

Each `results` entry contains:

- `datetime`
- `transit_positions`
- `motion` — per-body `{ speed, retrograde }` at that sampled instant
- `aspects`

## Exact event search (`exactHits` / `stationEvents`)

`event_search` is computed independently of the sampled `results` series —
it is a genuine adaptive root-find over the requested interval, not derived
from (or rounded to) the plotted sample points, and it always runs locally
through the Rust event-search module (`application::event_search` /
`application::transit::compute_transit_events`) regardless of which backend
(Rust or Python) computed the sampled series, since it only needs the
resolved chart.

`event_search.events` shape — a chronologically ordered array (ties broken
arbitrarily within the same instant); each entry has:

- `datetime`: the exact root-found instant (RFC3339), never rounded to a
  graph sample
- `kind`: `"aspect_hit"` (with `from`, `to`, `type`, `exact_angle`, `contact`,
  `confirmed`) or `"station"` (with `body`, `direction_change`, `confirmed`)
  - `contact`: `"crossing"` (the angular offset genuinely passed through
    exact) or `"tangential"` (it grazed exact and receded without crossing —
    a heuristic, grid-resolution-dependent detection, not a proof of
    exhaustive discovery; see below)
  - `direction_change`: `"direct_to_retrograde"`, `"retrograde_to_direct"`,
    or `"tangential_no_change"` (speed grazed zero without actually
    switching direction — same heuristic as `contact: "tangential"`)
  - `confirmed`: independent of `contact`/`direction_change` — those
    describe the contact's *geometry*, `confirmed` describes detection
    *confidence*. Always `true` for `contact: "crossing"` and for a genuine
    direction change (sign-change-based, never ambiguous). For
    `contact: "tangential"`/`direction_change: "tangential_no_change"`,
    `false` means the refined residual did not actually converge within
    tolerance, or regressed relative to the coarse sample that first
    flagged the candidate (two nearby minima of different depth inside one
    coarse bracket can pull a local refinement toward the shallower one).
    An unconfirmed candidate is still returned, never silently dropped —
    this is how a caller tells a heuristic candidate apart from a verified
    event, rather than only seeing `"tangential"` either way.
- `motion`: per-body `{ speed, retrograde }` at that exact instant, freshly
  sampled there (never interpolated or reused from a nearby search probe)

`event_search.complete`/`warnings`: `complete: false` if any individual
search (including any configuration search — see below) exhausted its
work-limit or failed outright (e.g. missing kernel coverage for the
requested epoch); `events`/`configuration_matches` may then be partial.
`warnings` has one entry per failed or incomplete sub-search, naming which
body/pair/aspect/configuration it was. Never presented as if it were a
complete empty result.

Supported aspect geometry — both run whenever `exactHits` is true, and
neither silently substitutes for the other:

- **moving vs. fixed radix**: every requested transiting body against every
  requested transited body's natal (radix) longitude, mirroring
  `compute_cross_aspects`' own transiting/transited pairing exactly,
  including the degenerate self-pair case (a transiting body against its
  own natal longitude — a solar/lunar-return-style event) when the same id
  appears in both lists
- **moving vs. moving**: every pair among the requested transiting bodies
  themselves (alphabetically ordered, structurally-locked pairs such as
  `north_node`/`south_node` excluded), mirroring `compute_chart_aspects`

Event discovery is adaptive and independent of graph sampling. Its bounded
search procedure, tangential-contact heuristic, measured behavior, and known
limits belong to [Validation and performance](../ephemeris-validation/#event-search-stationary-points-and-exact-aspect-times),
not this observable contract.

## Multi-body configuration search (`configurationRequests`)

Each entry in `configurationRequests` is:

```json
{
  "configurationId": "grand_trine",
  "fixedRoles": [],
  "roleCandidates": {}
}
```

- `configurationId`: one of `grand_trine`, `t_square`, `yod`, `grand_cross`.
  **`yod` is a new contract-level name for the same geometry this
  codebase's existing single-instant classifier
  (`domain::astrology::detect_chart_configurations`) and workspace catalog
  already call `double_quincunx`** (two quincunxes plus one sextile) — the
  rename is contract-facing only; the underlying detection logic and
  catalog id are unchanged. An unrecognized id is reported as a warning
  (`configuration_unknown_id: ...`), not a command error.
- `fixedRoles`: role names (from the pattern's own role list — e.g.
  `apex`/`pole_a`/`pole_b` for `t_square`) to evaluate against the resolved
  chart's own radix positions instead of resampling them, enabling
  "configuration combining moving bodies and fixed radix targets."
- `roleCandidates`: role name → allowed body ids. A role absent from this
  map defaults to the request's own `transitingObjects` (if not listed in
  `fixedRoles`) or `transitedObjects` (if it is).

Unlike exact-aspect search, a configuration match is a **time interval**,
not an instant: all constituent aspects merely need to stay within their
own orb simultaneously, with no requirement that any of them become exact
at the same moment (or at all) inside that interval. `event_search.configuration_matches`
shape — each entry has:

- `configuration_id`
- `participants`: `[{ role, body_id, is_fixed }]`
- `entry`/`exit`: RFC3339 instant, or `null` if the match was already open
  at the search's own start / still open at its own end
- `entry_clipped`/`exit_clipped`: `null` when the corresponding boundary is
  a real found root; `"period_start"`/`"period_end"` when it's `null`
  because the requested period itself cut it off; `"missing_coverage"` when
  it's `null` because the underlying search failed for that edge (also
  reflected in `event_search.warnings`)
- `constituent_aspects`: `[{ role_a, role_b, body_a, body_b, aspect_id, exact_angle, allowed_orb, deviation_deg }]`,
  evaluated at `best_fit`'s instant when present, else `entry`, else `exit`,
  else the request's own period midpoint (the case where the whole
  requested window is inside the match and neither boundary is a real root)
- `best_fit`: `{ datetime, max_normalized_deviation }` or `null`. A **local**
  refinement (coarse-grid seed, then a bounded local search around the best
  grid point) minimizing the worst-case normalized deviation
  (`|deviation_deg| / allowed_orb`) across constituent aspects — not a
  certified global minimum, and never "simultaneous exactness": a best-fit
  instant need not have any constituent aspect at exactly 0 degrees.

Deduplication respects each pattern's actual geometric symmetries (e.g. a
Grand Trine's three roles are fully interchangeable; a T-square's two
"pole" roles are interchangeable with each other but not with `apex`; a
Grand Cross's two opposition-pole pairs are each independently flippable
and swappable with each other) — two role-assignments that are the same
physical configuration under one of these symmetries produce one match, not
two, while two assignments that are genuinely different (e.g. a different
`apex`) remain distinct matches.

**Scope limitation, not a silent omission:** five configuration ids this
codebase's existing snapshot classifier already supports — `kite`,
`mystic_rectangle`, `hexagram`, `pentagram`, `double_biquintile` — have no
interval-search counterpart and cannot be requested via
`configurationRequests`; they remain available only through the existing
single-instant `shapes`/`configurations` chart-compute fields. `kite` and
`hexagram` are built by extending an already-found Grand Trine rather than
a fixed role topology, and `pentagram` needs a 5-way combinatorial search —
none fit this feature's "N fixed roles, M required pairwise aspects" shape
as cleanly as the four that are implemented.

Combinatorial growth is bounded two ways, both reported as `complete: false`
with a named warning rather than silently truncating: an explicit cap on
how many role-assignment permutations one search may enumerate, and a
separate cap on how many matches get a refined `best_fit` (a fast-moving
candidate can recur in and out of a pattern's orb many times over a long
requested period; every occurrence still gets a full result, only the
refined best-fit instant is capped). See
[ephemeris-validation](../ephemeris-validation/#multi-body-configuration-search)
for measured performance and the exact limits.

## Rules

- Transit-series computation is a workspace workflow. It requires a persisted source chart id.
- Frontends must not compute transit series from local-only chart drafts.
- `startDatetime` and `endDatetime` follow the chart datetime contract.
- `timeStepSeconds` must be greater than `0`, and is required when `sampledSeries` is true (the default); omitting it when `sampledSeries` is `false` is not an error.
- `endDatetime` must be greater than or equal to `startDatetime`.
- Selected transiting bodies, transited bodies, and aspect types must be passed in the command payload.
- Empty body lists may be allowed by the backend as "use chart defaults", but frontend controls should send the user's explicit selection when the UI exposes one.
- React and Svelte must keep the same typed bridge shape under each frontend's `src/lib/tauri/` folder.
- Static/docs mode may render the controls, but command execution must fail clearly or be disabled when Tauri is unavailable.

## Current parity scope

The parity target for the current implementation is:

- source chart selection
- start and end datetime payloads
- selected transiting objects
- selected transited objects
- selected aspect types
- loading and error state
- a summary table for returned result count, transit body count, and aspect count

Known follow-up work:

- ~~share one canonical observable-object selector across both shells~~ — done: React's `transiting-bodies`/`transited-bodies` (Transits) and the "Observable objects" section (Settings) all render the same `body-selector.tsx` component, backed by the shared `OBSERVABLE_OBJECTS` catalog (`lib/astrology/observableObjects.ts`); Svelte's `BodySelector.svelte` reads the mirrored `lib/astrology/observableObjects.ts` catalog and is used inline in `App.svelte` for both the transiting- and transited-bodies pages. Aspectarium's own React selector reads the same catalog too, through its own lighter-weight `MultiSelectFilter` UI rather than `body-selector.tsx`.
- **Svelte has a working, but minimal, inline Transits flow — not a dedicated Transits view.** `App.svelte` renders source-chart selection, the shared `BodySelector` for transiting/transited bodies, inline aspect-type checkboxes, a Calculate button that calls `computeTransitSeries`, and a capped results table (first 50 rows) — all inline in one large component rather than factored into dedicated components the way React's `transits-content.tsx`/`transits-workspace.tsx`/`transits-results-dashboard.tsx` are. Svelte does **not** have: transit-setup persistence (no `saveTransitSetup`/`loadTransitSetup` calls — every Svelte transit computation is ad hoc, nothing survives a reload), the `computeTransitSeriesFromData` in-memory variant, or any `exactHits`/`stationEvents`/`configurationRequests`/`sampledSeries` control — its `TransitSeriesRequest`/`TransitSeriesEntry`/`TransitSeriesResult` types (`lib/tauri/types.ts`) have no `exactHits`, `stationEvents`, `configurationRequests`, `sampledSeries`, `motion`, or `event_search` fields at all, so exact-event search and multi-body configuration search are reachable only from React today. Acceptance criteria for closing this gap: factor Svelte's inline flow into dedicated components, add transit-setup persistence, and bring its typed bridge fields up to the current contract (`motion`, `exactHits`, `stationEvents`, `configurationRequests`, `sampledSeries`, `event_search`).
- share one canonical transit time-step model across both shells
- expose backend provenance in the transit results UI instead of only carrying it in the typed response

## Acceptance checks

- React and Svelte both call `compute_transit_series` through typed bridge helpers.
- Both helpers accept the same request fields (Svelte's typed fields currently lag the contract — see the Svelte gap above).
- Both result types include the same response fields (same caveat).
- Changing selected bodies or selected aspects changes the command payload.
- A missing workspace, missing source chart, invalid time range, or unavailable Tauri runtime surfaces as a clear error or disabled action.
- A valid command returns ordered entries with `datetime`, `transit_positions`, `motion`, and `aspects`, plus a top-level `event_search` field.
- `event_search.complete` is `false`, with a matching entry in `event_search.warnings`, whenever any individual exact-event, station, or configuration search fails or exhausts its work-limit — never presented as a successful empty result.
- Omitting `exactHits`/`stationEvents`/`configurationRequests`/`sampledSeries` entirely (as every current frontend bridge does for at least some of them) behaves identically to passing `false`/`false`/`[]`/`true` respectively.
- Setting `sampledSeries: false` returns `results: []` and `time_step: "n/a"` without requiring `timeStepSeconds`, while still populating backend provenance fields and `event_search`.
- A `configurationRequests` entry for `grand_trine`, `t_square`, `yod`, or `grand_cross` returns matches in `event_search.configuration_matches` with the documented shape; an unrecognized id surfaces as a warning, not a command error.
