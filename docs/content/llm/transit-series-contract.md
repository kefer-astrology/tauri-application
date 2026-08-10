---
title: "Transit series contract"
weight: 44
---

This page defines the frontend-visible contract for computing transit series.

Use this contract before adding or changing transit-series UI in either frontend.

## Related: instant transit overlay

This page covers only the persisted-workspace series path (`compute_transit_series`). React's Transits view also has a second, previously-undocumented path: an "instant" overlay for the current moment (or an arbitrary single datetime) that does not require a persisted source chart id. That path computes the transit chart's positions via `compute_chart_from_data`, then detects cross-chart aspects between those positions and the radix chart's positions via `compute_cross_aspects_from_data` (see [tauri-command-contracts](../../docs/tauri-command-contracts/)) — the same Rust aspect-detection geometry `compute_transit_series` uses, not a client-side reimplementation. Both transit-aspect code paths therefore resolve through Rust; neither frontend duplicates the angle/orb geometry.

## Command

Both frontends call the same Tauri command:

`compute_transit_series`

Required request fields:

- `workspacePath`: active workspace folder path
- `chartId`: persisted source chart id from that workspace
- `startDatetime`: canonical datetime string, preferably RFC3339
- `endDatetime`: canonical datetime string, preferably RFC3339
- `timeStepSeconds`: positive integer step size
- `transitingObjects`: object ids to compute for the moving chart
- `transitedObjects`: object ids to compare against the persisted source chart
- `aspectTypes`: aspect ids to include in cross-chart aspect detection

Response fields:

- `source_chart_id`
- `time_range.start`
- `time_range.end`
- `time_step`
- `results`
- backend provenance fields when available, such as `backend_used`, `fallback_used`, `ephemeris_source`, and `warnings`

Each `results` entry contains:

- `datetime`
- `transit_positions`
- `aspects`

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

- ~~share one canonical observable-object selector across both shells~~ — done for React: `transiting-bodies`/`transited-bodies` (Transits) and the "Observable objects" section (Settings) all render the same `body-selector.tsx` component, backed by the shared `OBSERVABLE_OBJECTS` catalog (`lib/astrology/observableObjects.ts`); Aspectarium's own selector reads the same catalog too, though through its own lighter-weight `MultiSelectFilter` UI rather than `body-selector.tsx`. **Svelte has no Transits UI at all yet** (no transiting/transited pages exist) — this shell remains spec-gated pending a dedicated Svelte Transits implementation; the mirrored `observableObjects.ts` data file exists there so the contract stays aligned, but no UI consumes it. Acceptance criteria for closing this gap: a Svelte Transits view exists with the same two body-selection pages, backed by the same catalog and the same `compute_transit_series` bridge helper.
- share one canonical transit time-step model across both shells
- expose backend provenance in the transit results UI instead of only carrying it in the typed response

## Acceptance checks

- React and Svelte both call `compute_transit_series` through typed bridge helpers.
- Both helpers accept the same request fields.
- Both result types include the same response fields.
- Changing selected bodies or selected aspects changes the command payload.
- A missing workspace, missing source chart, invalid time range, or unavailable Tauri runtime surfaces as a clear error or disabled action.
- A valid command returns ordered entries with `datetime`, `transit_positions`, and `aspects`.
