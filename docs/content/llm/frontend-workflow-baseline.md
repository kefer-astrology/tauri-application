---
title: "Frontend workflow baseline"
weight: 40
---

# Frontend workflow baseline

Both frontend shells should be judged against these baseline workflows:

1. Open a workspace folder or import a chart into a workspace.
2. Create a new chart within the current workspace or project context.
3. Read and expose settings that affect computation, especially calculated objects and calculated aspects.
4. Calculate positions for the selected objects for the active chart.
5. Resolve a typed event location into usable coordinates before chart creation when coordinates are not entered manually.

## Readiness rule

A frontend is only "ready" for this baseline when:

- the workflow exists in the UI
- the workflow is wired to Tauri commands or the in-memory Rust path
- the settings used by compute are not just local widget state
- selected objects and selected aspects actually influence the compute payload or compute command behavior

## Current interpretation

- Opening a workspace folder counts only when the app loads charts, workspace defaults, and compute results.
- "Import a chart into workspace" is separate from opening a workspace folder.
- Import means ingesting a previously created external chart file into the active workspace.
- Supported import targets should include:
  - native chart YAML compatible with the workspace/chart model
  - StarFisher-style formats such as `.sfs`, when parsing support is available through the backend/tooling
- Creating a chart counts only when the chart is persisted to workspace YAML when a workspace is active.
- Settings count only when they feed the persisted workspace/chart configuration or the active compute payload.
- Frontend contracts should stay backend-neutral even when a specific backend is favored in the implementation.
- `jpl` / SPICE should not block baseline frontend readiness, but the frontend contract should leave room for it to become the preferred long-term astronomy backend.
- React location entry should support explicit place-to-coordinate resolution without requiring manual latitude/longitude entry.
- The React radix view should render from computed chart payloads, not mock wheel or mock position data.
- The default first-run React chart should compute positions for the current date/time automatically.
- Creating a new chart in React should switch to the radix view and start background computation immediately.
- Both frontends should consume the same radix compute contract, including `positions`, `axes`, and `house_cusps`.
- Both frontends should be able to surface backend provenance from compute responses when available.
- Both frontends should emit canonical chart timestamps as `YYYY-MM-DD HH:mm:ss` or RFC3339.
- Frontends should not emit localized chart timestamps such as `DD/MM/YYYY HH:mm:ss` in compute or persistence payloads.
- Svelte should prefer `house_cusps` from compute output over legacy `house_1..house_12` fallback keys.
- React should use two center-layout families:
  - edge-to-edge for radix, information/dashboard, aspectarium, and open-workspace flows
  - a centered 20/60/20 content layout for new-chart, transits, settings, and placeholder editor-style views

## Gap-closing checklist

## 1. Tauri contract gaps

- Keep `load_workspace`, `get_workspace_defaults`, `get_chart_details`, `create_chart`, `update_chart`, `compute_chart`, and `compute_chart_from_data` as the stable baseline for both frontends.
- Treat "import chart into workspace" as a real external-ingest workflow, not as chart creation from frontend form data.
- Add an explicit Tauri command and contract for chart import instead of overloading open-workspace behavior.
- Support importing previously created chart files, especially:
  - native chart YAML in the Rust path
  - StarFisher/SFS when the backend parser path is available
- Extend the chart/workspace contract if frontend-selected aspects must be persisted as `default_aspects` and/or `aspect_orbs`.
- Make sure the compute path accepts and respects selected objects and selected aspects through chart config or command arguments.

## 2. React gaps

- Add an explicit "import chart into workspace" workflow or remove the ambiguity from the product language.
- Add a real external chart import workflow for supported file types.
- Add UI for selecting calculated objects, not only consuming `default_bodies` loaded from workspace.
- Connect settings changes for house system, location, calculated objects, and calculated aspects to real app state instead of local-only component state.
- Persist confirmed settings either to workspace defaults or to per-chart config, depending on the chosen contract.
- Ensure compute payloads include the settings that should affect computation.

## 3. Svelte gaps

- Replace the `Open Radix` placeholder with a real import/open-chart workflow or remove it.
- Replace the `Open Radix` placeholder with a real external chart import workflow for supported file types.
- Connect settings controls for location, house system, and aspects to shared workspace/chart state.
- Decide whether `BodySelector` should also drive workspace-level default computed bodies, not only transit filters.
- Persist confirmed settings to workspace/chart config instead of leaving them as local view state.
- Ensure compute payloads include both selected objects and selected aspects where required.

## 4. Recommended implementation order

1. Define the supported import command shape and file types.
2. Make one authoritative settings model for computed bodies and aspects.
3. Wire that model into payload builders in both frontends.
4. Verify Rust/Python compute respects the same inputs.
5. Finish the missing import workflow in each frontend.
6. Verify Rust/Python preserve the same instant for offset-aware datetimes.
7. Only then mark the baseline workflows as ready.
