---
title: "Time navigation"
description: "Current reference for time navigation behavior and state."
weight: 60
---

Time navigation exists to support:

- precise stepping through computed chart states
- quick movement through a defined time range
- transit browsing over intervals
- Astrolabe-style time shifting

For frontend-specific implementation status, see [frontend-react](../frontend-react/) or [frontend-svelte](../frontend-svelte/).

## Core behavior

- stepping units should include `seconds`, `minutes`, `hours`, and `days` (ideally also `months` and `years`)
- default step is typically `1 hour` (should be a workspace parameter)
- navigation actions should include `first`, `previous`, `next`, `last`, and `now`
- users should be able to define a `start` and `end` time range through normalized selectors (specific for date and time adjust)

## Frontend vs backend handling

Time navigation is split across both layers:

**Frontend responsibilities**

- keep the current navigation state
- apply local step changes and range clamps
- drive the visible controls for step size, range, and shift
- decide when a view should recompute

**Backend responsibilities**

- parse incoming datetime strings for compute commands
- validate transit ranges and step size
- perform the actual time-series computation
- return normalized timestamps in compute results

In other words, the frontend owns navigation intent and UI state; Tauri owns computation and final datetime validation.

## Current implementation direction

- Svelte already supports UTC-safe stepping for the main navigation path
- Svelte already supports an Astrolabe-style shift model layered on top of current time
- React should follow the same behavior contract even where the exact UI differs
- some current update paths still mix live computed payloads with compatibility-era query helpers

## Supported datetime formats

### Backend-accepted datetime strings

The Rust Tauri compute path currently accepts these input forms:

- RFC3339 / ISO datetime with timezone: `2024-01-01T12:00:00+01:00`, `2024-01-01T11:00:00Z`
- naive datetime with seconds: `YYYY-MM-DD HH:mm:ss`, `YYYY-MM-DDTHH:mm:ss`
- naive datetime without seconds: `YYYY-MM-DD HH:mm`
- date only: `YYYY-MM-DD`

Current backend rule:

- RFC3339 values preserve their represented instant and are converted to UTC internally
- naive datetime strings are treated as UTC in the Rust parser
- date-only values are interpreted as `00:00:00` UTC

### Frontend parsing notes

- React currently accepts normal JS `Date`-parseable values and also normalizes `YYYY-MM-DD HH:mm[:ss]` into a `T...Z` form before parsing
- Svelte does the same basic normalization and also still accepts a legacy `DD/MM/YYYY HH:mm[:ss]` form in some local parsing paths

That means frontend parsing is slightly more permissive than the backend contract. For durable interop, prefer RFC3339 or `YYYY-MM-DDTHH:mm:ssZ` when values cross the Tauri boundary.

## UI expectations

A time-navigation surface should provide:

- current time display
- step-size selection
- quick navigation controls
- start/end range controls
- optional shift controls for years/months/days/hours/minutes/seconds

The exact layout can differ by frontend, but the interaction model should stay consistent.

## State model

The navigation state should keep:

- current time
- start time
- end time
- current step definition
- optional shift values
- whether shift is active

In the current Svelte implementation, this state lives in `apps/web-svelte/src/lib/stores/timeNavigation.svelte.ts`.

Current details in that store:

- step units include `seconds`, `minutes`, `hours`, `days`, `months`, and `years`
- stepping uses UTC setters such as `setUTCSeconds`, `setUTCHours`, `setUTCMonth`, and `setUTCFullYear`
- navigation is clamped to the active `startTime` / `endTime`
- the effective displayed time can be the base `currentTime` plus an active shift

React does not yet centralize this in the same dedicated store shape, but it should follow the same contract.

## Backend compute rules

For `compute_transit_series(...)` specifically:

- `time_step_seconds` must be greater than `0`
- `end_datetime` must be greater than or equal to `start_datetime`
- the Rust path enforces a hard limit of `50_000` generated steps
- Rust transit results return timestamps as RFC3339
- Rust transit responses currently format `time_step` as a compact seconds string such as `3600s`

Backend chart payloads also carry datetime through chart `subject.event_time`. Chart navigation and transit navigation should therefore not drift into separate formatting rules.

## Integration rules

- frontend controls should drive recomputation through the active Tauri compute flow
- stepping should not silently invent data or bypass the backend contract
- backend results should remain the source of truth for rendered chart state
- loading behavior should preserve the last stable rendered state where practical
- when possible, the same datetime value should be usable both for chart recompute and transit-series requests without frontend-only reinterpretation

## Current caveats

- some Svelte paths still rely on compatibility-era query helpers
- performance work in this area is still partly about reducing reactive churn and repeated backend loads
- this page is the behavior reference, not a promise that one frontend’s code samples are canonical
- frontend-local parsing is currently a little broader than the Rust command contract, so docs and new UI flows should prefer the backend-safe formats above
