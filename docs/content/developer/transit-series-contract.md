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

## Command

Both frontends call the same Tauri command:

`compute_transit_series`

Required request fields:

- `workspacePath`: active workspace folder path
- `chartId`: persisted source chart id from that workspace
- `startDatetime`: canonical datetime string, preferably RFC3339
- `endDatetime`: canonical datetime string, preferably RFC3339
- `timeStepSeconds`: positive integer step size — this is the sampled-series
  graph resolution only; it has no effect on exact-event search (see below)
  and is never redefined as event-time precision
- `transitingObjects`: object ids to compute for the moving chart
- `transitedObjects`: object ids to compare against the persisted source chart
- `aspectTypes`: aspect ids to include in cross-chart aspect detection

Optional request fields:

- `exactHits` (boolean, default `false`): also run an exact-event search for
  the requested transiting/transited/aspect combination — see
  [Exact event search](#exact-event-search-exacthits--stationevents) below
- `stationEvents` (boolean, default `false`): also run a stationary-point
  search for each requested transiting body

Both fields are optional specifically so a caller that predates them (neither
frontend bridge sends them as of this writing) keeps working unchanged — a
missing field deserializes as "not requested," not as a command error.

Response fields:

- `source_chart_id`
- `time_range.start`
- `time_range.end`
- `time_step`
- `results`
- `event_search` — always present, even when both `exactHits` and
  `stationEvents` are false (in which case it is the cheap, fixed shape
  `{ "events": [], "complete": true, "warnings": [] }`); see below for its
  shape when either flag is set
- backend provenance fields when available, such as `backend_used`, `fallback_used`, `ephemeris_source`, and `warnings`

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

`event_search` shape:

- `events`: a chronologically ordered array (ties broken arbitrarily within
  the same instant); each entry has:
  - `datetime`: the exact root-found instant (RFC3339), never rounded to a
    graph sample
  - `kind`: `"aspect_hit"` (with `from`, `to`, `type`, `exact_angle`) or
    `"station"` (with `body`)
  - `motion`: per-body `{ speed, retrograde }` at that exact instant, freshly
    sampled there (never interpolated or reused from a nearby search probe)
- `complete`: `false` if any individual search exhausted its work-limit or
  failed outright (e.g. missing kernel coverage for the requested epoch) —
  a `false` value means the `events` array may be partial; it is never
  presented as if it were a complete empty result
- `warnings`: one entry per failed or incomplete sub-search, naming which
  body/pair/aspect it was

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

Discovery is a coarse fixed-step scan (6-hour default step, independent of
`timeStepSeconds`) followed by bisection, with a two-tier recursion budget
to catch hidden and repeated crossings (retrograde loops, multiple events
inside one coarse step) without unbounded cost. See
`application/event_search.rs`'s module documentation and
[ephemeris-validation](../ephemeris-validation/#event-search-stationary-points-and-exact-aspect-times)
for the full discovery-completeness discussion, measured performance, and
stated limitations (tangential/non-crossing contacts are not resolved as
events).

## Rules

- Transit-series computation is a workspace workflow. It requires a persisted source chart id.
- Frontends must not compute transit series from local-only chart drafts.
- `startDatetime` and `endDatetime` follow the chart datetime contract.
- `timeStepSeconds` must be greater than `0`.
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
- **Svelte has a working, but minimal, inline Transits flow — not a dedicated Transits view.** `App.svelte` renders source-chart selection, the shared `BodySelector` for transiting/transited bodies, inline aspect-type checkboxes, a Calculate button that calls `computeTransitSeries`, and a capped results table (first 50 rows) — all inline in one large component rather than factored into dedicated components the way React's `transits-content.tsx`/`transits-workspace.tsx`/`transits-results-dashboard.tsx` are. Svelte does **not** have: transit-setup persistence (no `saveTransitSetup`/`loadTransitSetup` calls — every Svelte transit computation is ad hoc, nothing survives a reload), the `computeTransitSeriesFromData` in-memory variant, or any `exactHits`/`stationEvents` control — its `TransitSeriesRequest`/`TransitSeriesEntry`/`TransitSeriesResult` types (`lib/tauri/types.ts`) have no `exactHits`, `stationEvents`, `motion`, or `event_search` fields at all, so exact-event search is reachable only from React today. Acceptance criteria for closing this gap: factor Svelte's inline flow into dedicated components, add transit-setup persistence, and bring its typed bridge fields up to the current contract (`motion`, `exactHits`, `stationEvents`, `event_search`).
- share one canonical transit time-step model across both shells
- expose backend provenance in the transit results UI instead of only carrying it in the typed response

## Acceptance checks

- React and Svelte both call `compute_transit_series` through typed bridge helpers.
- Both helpers accept the same request fields (Svelte's typed fields currently lag the contract — see the Svelte gap above).
- Both result types include the same response fields (same caveat).
- Changing selected bodies or selected aspects changes the command payload.
- A missing workspace, missing source chart, invalid time range, or unavailable Tauri runtime surfaces as a clear error or disabled action.
- A valid command returns ordered entries with `datetime`, `transit_positions`, `motion`, and `aspects`, plus a top-level `event_search` field.
- `event_search.complete` is `false`, with a matching entry in `event_search.warnings`, whenever any individual exact-event or station search fails or exhausts its work-limit — never presented as a successful empty result.
- Omitting `exactHits`/`stationEvents` entirely (as both current frontend bridges do) behaves identically to passing them as `false`.
