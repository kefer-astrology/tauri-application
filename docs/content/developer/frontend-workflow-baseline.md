---
title: 'Frontend workflow baseline'
weight: 40
doc_kind: contract
status: current
authority: normative
---

Both frontend shells should be judged against these baseline workflows:

1. Open a workspace folder or import a chart into a workspace.
2. Create a new chart within the current workspace or project context.
3. Read and expose settings that affect computation, especially calculated objects and calculated aspects.
4. Calculate positions for the selected objects for the active chart.
5. Resolve a typed event location into usable coordinates before chart creation when coordinates are not entered manually.
6. Compute a transit series for a persisted source chart using the selected time range, transiting bodies, transited bodies, and aspect types.

## Parallel implementation rule

New frontend-visible workflow behavior must land through both shells unless a spec explicitly gates one shell. For compute-backed behavior this means:

- React and Svelte use the same Tauri command contract and typed bridge shape.
- React and Svelte expose the same computation inputs, or the spec names the missing input and acceptance criteria.
- Selected objects, selected aspects, date/time ranges, and workspace/chart IDs must feed the command payload rather than remaining local-only widget state.
- A partial frontend implementation is not "parity-compliant"; it is an intentional gap that must be documented in the [Development roadmap](../development-driver/) or the feature-specific contract.

## Readiness rule

A frontend is only "ready" for this baseline when:

- the workflow exists in the UI
- the workflow is wired to Tauri commands or the in-memory Rust path
- the settings used by compute are not just local widget state
- selected objects and selected aspects actually influence the compute payload or compute command behavior
- transit series inputs actually influence `compute_transit_series` command behavior

## Current interpretation

- Opening a workspace folder counts only when the app loads charts, workspace defaults, and compute results.
- "Import a chart into workspace" is separate from opening a workspace folder.
- Import means ingesting a previously created external chart file into the active workspace.
- Supported import targets should include:
  - native chart YAML compatible with the workspace/chart model
  - StarFisher-style formats such as `.sfs`, when parsing support is available through the backend/tooling
- Creating a chart counts only when the chart is persisted to workspace YAML when a workspace is active.
- Create-new chart forms in both frontends should expose fields in this order:
  - chart name
  - chart type limited to nativity, event, and horary
  - date and time selectors
  - time regime switcher with `auto` and `manual`
  - manual time-regime details, expanded only in manual mode, for home-location coordinates and timezone/UTC-shift settings
  - location selector
  - tags
- Settings count only when they feed the persisted workspace/chart configuration or the active compute payload.
- Frontend contracts should stay backend-neutral even when a specific backend is favored in the implementation.
- `jpl` / SPICE should not block baseline frontend readiness, but the frontend contract should leave room for it to become the preferred long-term astronomy backend.
- React location entry should support explicit place-to-coordinate resolution without requiring manual latitude/longitude entry.
- Svelte location entry should support the same explicit place-to-coordinate resolution without requiring manual latitude/longitude entry.
- The React radix view should render from computed chart payloads, not mock wheel or mock position data.
- The default first-run React chart should compute positions for the current date/time automatically.
- Creating a new chart in React should switch to the radix view and start background computation immediately.
- Both frontends should consume the same radix compute contract, including `positions`, `axes`, and `house_cusps`.
- Both frontends should be able to surface backend provenance from compute responses when available.
- Both frontends should emit canonical chart timestamps as `YYYY-MM-DD HH:mm:ss` or RFC3339.
- Frontends should not emit localized chart timestamps such as `DD/MM/YYYY HH:mm:ss` in compute or persistence payloads.
- Svelte should prefer `house_cusps` from compute output over legacy `house_1..house_12` fallback keys.
- Both frontends should compute transit series through the same `compute_transit_series` bridge, with source chart, time range, transiting objects, transited objects, and aspect types passed as command payload. The detailed payload and parity target live in [transit-series-contract](../transit-series-contract/).
- Current transit-series parity covers the command bridge, source chart, time range, body filters, aspect filters, loading/error state, and result summary table. Remaining parity work is to share one canonical observable-object selector and one time-step model across both shells.
- React should use two center-layout families:
  - edge-to-edge for radix, information/dashboard, aspectarium, and open-workspace flows
  - a centered 20/60/20 content layout for new-chart, transits, settings, and placeholder editor-style views

## Verification

The cross-frontend contract is tracked by `FRONTEND-001`, `FRONTEND-002`, and
`STATIC-001` in the [Testing strategy](../testing-strategy/). Unfinished work
belongs in the [Development roadmap](../development-driver/), not in this
normative baseline.
