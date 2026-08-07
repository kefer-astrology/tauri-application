---
title: 'Frontend gap implementation plan'
weight: 45
---

This plan turns the frontend workflow baseline into an implementation sequence.

Use it when closing the current gaps between React, Svelte, Tauri, and the compute backends.

## Goal

Make both frontends ready for these workflows:

1. Open a workspace folder or import a chart into a workspace.
2. Create a new chart within the current workspace or project context.
3. Read and edit settings that affect computation.
4. Calculate positions for the selected objects for the active chart.

## Phase 1: contract decisions

### Tauri/backend

- Define import as ingesting a previously created external chart file into the active workspace.
- Support these input classes:
  - native chart YAML
  - StarFisher/SFS, when parser support is available
- Keep import separate from "create new chart from frontend form data".
- Use one startup-time Python availability check as the general backend-selection rule instead of repeated feature-level sidecar existence checks.
- Define how backend provenance is surfaced in compute responses and the UI.
- Decide where computed settings live:
  - workspace defaults
  - per-chart config
  - workspace defaults with per-chart override
- Decide how selected aspects are represented:
  - `default_aspects` only
  - `aspect_orbs` only
  - both `default_aspects` and `aspect_orbs`

### Acceptance checks

- The repo has one explicit definition for "import chart into workspace".
- The spec names the supported import file types.
- The spec says where computed bodies and aspects are stored.
- The spec says which Tauri commands own those operations.

## Phase 2: authoritative settings model

Both frontends call `get_current_model_report` on workspace open and resolve computed bodies, computed aspects, and aspect orbs from `effective_settings`, with the model layer resolving before the workspace layer. Chart data (`AppChart` in React, `ChartData` in Svelte) carries chart-level `observableObjects`/`aspectOrbs`/`selectedAspects`/`ayanamsa`/`timeSystem`, and each payload builder prefers the chart-level value over the workspace default. House-system lists match across both frontends (all 9 `HouseSystem` values).

Still open:

- Workspace-level default zodiac/ayanamsa settings — the backend `WorkspaceDefaults` model has no zodiac/ayanamsa field yet.
- Default location and engine settings as part of one authoritative shape.

## Phase 3: Tauri command support

### Tauri/backend

- Keep these baseline commands stable:
  - `load_workspace`
  - `get_workspace_defaults`
  - `get_chart_details`
  - `create_chart`
  - `update_chart`
  - `compute_chart`
  - `compute_chart_from_data`
- Add a dedicated import command instead of hiding import behavior behind workspace open.
- Implement native YAML import in Rust first through the dedicated import command.
- Keep the command contract backend-neutral even when a specific backend is currently favored.
- Decide whether SFS import is handled:
  - directly in Rust
  - through the Python/backend side when available
  - through a staged conversion flow
- Reuse startup backend availability state when deciding whether Python-backed import/compute paths can run.
- Add an explicit geocoding command for user-triggered location resolution instead of client-side autocomplete polling.
- Expose a real radix-render payload from Rust with `axes` and `house_cusps` so the frontends can stop relying on mocked wheel geometry.
- Extend workspace/chart save paths so the chosen settings model is persisted.
- Verify Rust fallback and Python paths both respect:
  - selected objects
  - selected aspects
  - aspect orbs
- Verify Rust and Python preserve the same instant for offset-aware datetimes.

### Acceptance checks

- The chosen settings survive workspace reload.
- Rust compute and Python compute consume the same effective config.
- The import workflow has a dedicated command if it represents a distinct operation.
- Native YAML import is covered by Rust tests before frontend wiring begins.
- The architecture should leave room for `jpl` / SPICE to become the preferred long-term backend without changing frontend contracts.

## Phase 4: React implementation

### React work

- Add a real import-chart workflow for supported external file types.
- Add UI for computed bodies.
- Bind settings sections to shared app/workspace state.
- Persist confirmed settings to the chosen storage scope.
- Ensure chart creation uses the same settings model as compute.
- Keep the create-new chart form ordered as chart name, chart type, date/time, time regime, location selector, and tags, with manual time-regime details only expanded in manual mode.
- Verify workspace open:
  - loads charts
  - loads defaults
  - computes charts
- Ensure the default first-run chart computes automatically for the current date/time.
- Ensure creating a new chart switches to the radix view and computes in the background without leaving the wheel on mock placements.
- Keep React and Svelte aligned on the same radix compute payload shape so one frontend does not rely on legacy-only fields.

### Acceptance checks

- React users can open a workspace and immediately compute chart positions.
- React users can create a chart in a workspace and reload it later.
- React users can resolve a typed location into coordinates before or during chart creation.
- React users should see radix wheel geometry driven by compute output, not hand-authored mock positions or mock houses.
- React users can change computed bodies/aspects and see those settings affect subsequent compute payloads.
- If import is in scope, React exposes it as a real workflow.

## Phase 5: Svelte implementation

### Svelte work

- Add a real import-chart workflow for supported external file types.
- Bind settings sections to shared workspace/chart state.
- Decide whether `BodySelector` becomes the main UI for default computed bodies or remains transit-specific.
- Persist confirmed settings to the chosen storage scope.
- Ensure both workspace and in-memory compute use the same effective settings model.
- Keep the create-new chart form ordered as chart name, chart type, date/time, time regime, location selector, and tags, with manual time-regime details only expanded in manual mode.

### Acceptance checks

- Svelte users can open a workspace and immediately compute chart positions.
- Svelte users can create a chart in a workspace and reload it later.
- Svelte users can change computed bodies/aspects and see those settings affect subsequent compute payloads.
- If import is in scope, Svelte exposes it as a real workflow.

## Phase 6: validation

### Cross-frontend checks

- Add an initial Rust test batch for backend availability routing before expanding frontend integration tests.
- Open the same workspace in React and Svelte.
- Confirm both frontends load the same charts and defaults.
- Confirm both frontends compute the same selected objects for the same chart.
- Confirm both frontends use the same selected aspects and orbs.
- Confirm the no-sidecar Rust fallback still works for supported charts.
- Confirm backend provenance reaches the frontend for debugging and user trust.

### Acceptance checks

- Backend selection rules are covered by Rust tests:
  - startup-unavailable plus auto mode uses Rust
  - force-Python fails clearly when backend is unavailable
  - Rust sample-workspace compute succeeds without Python
- React and Svelte behave the same for the four baseline workflows.
- Workspace reload preserves the intended settings.
- Compute behavior is consistent across Rust fallback and Python-backed execution for supported scenarios.
- Datetime handling is consistent across Rust and Python for naive and offset-aware inputs.

## Suggested execution order

1. Finalize the import contract and supported file types.
2. Implement the authoritative settings model.
3. Update Tauri persistence and compute behavior.
4. Wire React to the new model.
5. Wire Svelte to the new model.
6. Run cross-frontend acceptance checks.

## Definition of done

The baseline is done when:

- both frontends implement the same four workflows
- settings that affect computation are authoritative and persisted where intended
- compute payloads honor selected objects and aspects
- import behavior is explicit and no longer ambiguous
- the `llm` specs match the actual implemented behavior
