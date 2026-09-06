---
title: 'Tauri command contracts'
description: 'Normative command-level contract for the current desktop app.'
weight: 45
doc_kind: contract
status: current
authority: normative
---

This page focuses on what the frontend can rely on today, including current no-op behavior.

## Contract rules

- All frontend actions must go through Tauri `invoke`.
- Successful commands return JSON-serializable values.
- Failing commands return `Err(String)` with a user-displayable message.
- Commands documented here describe the **current** desktop contract, not the intended long-term architecture.
- Signatures below are written from the frontend caller’s point of view. Tauri-injected internal parameters such as `AppHandle` and managed state are intentionally omitted.

## Utility commands

### `read(path) -> Result<String, String>`

- Reads a file from the given path.
- Returns the file contents as a string on success.

### `write(path, contents) -> Result<(), String>`

- Writes the provided string contents to the given path.
- Returns success when the file is written.

## Workspace and chart commands

### `open_folder_dialog() -> Result<Option<String>, String>`

- Opens a native folder chooser.
- Returns `Ok(Some(path))` when the user selects a folder.
- Returns `Ok(None)` when the user cancels or no supported chooser succeeds.

### `save_workspace(workspace_path, owner, charts, defaults?) -> Result<String, String>`

- Creates a new manifest or updates an existing `workspace.yaml`, and writes
  `charts/*.yml` under `workspace_path`.
- Sanitizes chart file names from chart ids.
- Accepts an optional `defaults` payload and persists it into `workspace.yaml` alongside chart references.
- Returns the `workspace_path` string on success.
- When updating, preserves schools, models, definition overrides,
  presentation, transit references, presets, subjects, layouts, and
  annotations. It replaces only the chart reference list and explicitly
  supplied defaults.

Acceptance criteria:

- Saving a workspace with N charts creates N chart files and one `workspace.yaml`.
- The saved manifest references the generated chart files.
- When `defaults` is provided, workspace-level engine / house / location / aspect defaults are written into the saved manifest.

### `save_workspace_defaults(workspace_path, defaults) -> Result<Value, String>`

- Updates workspace-level defaults in `workspace.yaml` without rewriting chart files.
- Returns the normalized workspace defaults payload after persistence.
- Intended for settings changes that belong to workspace state rather than to a specific chart.

Acceptance criteria:

- Updating default bodies persists to `workspace.yaml`.
- Updating default engine, house system, or location defaults persists to `workspace.yaml`.
- Chart YAML files are left untouched by this command.

### `create_workspace(workspace_path, owner) -> Result<String, String>`

- Creates the workspace directory and `charts/`.
- Writes an empty `workspace.yaml`.
- Returns an error if `workspace.yaml` already exists.

### `save_transit_setup(workspace_path, setup) -> Result<TransitSetup, String>`

- Persists reproducible transit intent under `transits/` and registers its
  relative path in `workspace.yaml:transit_analyses`.
- Stores source chart, period/step, bodies, aspects/orbs, optional
  school/model/definition overrides, and requested event families.
- Does not store computed positions, aspects, or series rows.
- Rejects unsupported versions, missing source charts, and zero time steps.

### `load_transit_setup(workspace_path, chart_id) -> Result<Option<TransitSetup>, String>`

- Returns the registered source chart's persisted form state when present.
- Validates version and source-chart identity before returning it.

### `delete_workspace(workspace_path) -> Result<bool, String>`

- Deletes the workspace directory recursively.
- Returns `Ok(false)` if the directory does not exist.
- Returns `Ok(true)` after successful deletion.

### `create_chart(workspace_path, chart) -> Result<String, String>`

- Requires an `id` in the chart payload.
- `chart.subject.event_time` should be provided in a canonical parseable form such as `YYYY-MM-DD HH:mm:ss`, `YYYY-MM-DDTHH:mm:ss`, or RFC3339.
- Writes a chart YAML file and registers it in `workspace.yaml`.
- Returns the chart id.
- Returns an error if the chart id already exists.

### `import_chart(workspace_path, source_path) -> Result<String, String>`

- Imports an external chart file into the active workspace.
- Native YAML (`.yml`, `.yaml`) is supported in the current Rust path.
- On success, writes the imported chart into `charts/` and registers it in `workspace.yaml`.
- Returns the imported chart id.
- Returns an error for duplicate chart ids.
- Returns an explicit error for `.sfs` because the Python-backed StarFisher import path is not wired yet.

### `update_chart(workspace_path, chart_id, chart) -> Result<String, String>`

- Finds the existing chart by `chart_id`.
- Rewrites the chart YAML with the enforced id.
- Returns the chart id.
- Returns an error if the chart does not exist.

### `delete_chart(workspace_path, chart_id) -> Result<bool, String>`

- Removes the chart reference from `workspace.yaml`.
- Deletes the chart YAML file if present.
- Returns `Ok(false)` when the chart id is not found.

### `load_workspace(workspace_path) -> Result<WorkspaceInfo, String>`

- Requires a readable `workspace.yaml`.
- Loads all registered charts and returns chart summaries.
- Does not compute chart positions.

### `validate_workspace(workspace_path) -> Result<WorkspaceValidationReport, String>`

- Strictly attempts every subject, chart, preset, transit analysis, layout, and annotation
  reference under the workspace root.
- Returns `valid`, typed entity counts, workspace identity, and all structured
  diagnostics.
- Missing or malformed referenced items use
  `referenced_item_load_failed`; duplicate identifiers and broken catalog
  references have specific stable codes.
- An invalid referenced item does not prevent other items from being inspected.
- Neither frontend currently calls this command; it remains a backend-only capability until a UI surface needs it.
- The Rust loader and Python sidecar share the versioned
  `contracts/workspace-v1/` interoperability fixture.

### `get_workspace_defaults(workspace_path) -> Result<Value, String>`

- Returns normalized default workspace values from `workspace.yaml`.
- Includes house system, engine, location, bodies, aspects, and time system fields when present.

### `get_current_model_report(workspace_path, chart_id?) -> Result<CurrentModelReport, String>`

- Returns one canonical model envelope for the workspace, optionally resolved through a specific chart.
- Includes requested/resolved school and model names, available model names,
  the resolved model catalog, effective settings, model overrides, source, and warnings.
- Includes structured `diagnostics` for catalog, selection, override, and
  chart-level invariants.
- `effective_settings.sources` identifies whether each effective setting came from the application fallback, model, workspace, preset, chart, or operation layer. Aspect-orb sources are reported per aspect id.
- If `workspace.yaml` has no usable `models` entry, returns a built-in standard model catalog so callers still receive the same structure.
- When `chart_id` is supplied, chart-level model/settings fields override workspace defaults in `effective_settings`.
- Both frontends call this without `chart_id` when a workspace is opened, and seed workspace defaults (default bodies, default aspects, aspect orbs) from `effective_settings` before applying the workspace-level DTO from `get_workspace_defaults`, so the model layer resolves before the workspace layer.

### `resolve_location(query) -> Result<Value, String>`

- Resolves a free-form place query into a best-match location with latitude and longitude.
- Uses the configured geocoder endpoint, defaulting to Nominatim search.
- Intended for explicit user-triggered lookup, not per-keystroke autocomplete.
- Returns an error when the query is empty or no result can be resolved.

### `search_locations(query) -> Result<Vec<Value>, String>`

- Resolves a free-form place query into multiple candidate locations.
- Uses the configured geocoder endpoint, defaulting to Nominatim search.
- Returns up to 5 candidates with `query`, `display_name`, `latitude`, and `longitude`.
- Returns an error when the query is empty or lookup fails.

### `get_chart_details(workspace_path, chart_id) -> Result<Value, String>`

- Returns the full chart payload needed by the React and Svelte editor surfaces.
- `config` includes `mode`, `house_system`, `zodiac_type`, `engine`, `model`,
  `model_overrides`, `override_ephemeris`, `observable_objects`,
  `included_points`, `aspect_orbs`, `selected_aspects`, `ayanamsa`,
  `time_system`, and legacy visual keys. Both frontends retain these fields
  during load/save round-trips.
- Also returns top-level `tags`, `tag_colors`, and `roden_rating`.
- Returns an error when the chart id is not found.

## Compute commands

## Backend selection

- `KEFER_COMPUTE_BACKEND=Auto`: Python first, Rust fallback when fallback is enabled.
- `KEFER_COMPUTE_BACKEND=Python`: Python only.
- `KEFER_COMPUTE_BACKEND=Rust`: Rust only.
- The contract should make backend provenance observable to callers.

Recommended response metadata:

- `backend_used`
- `fallback_used`
- `warnings`
- `ephemeris_source` when known

### `compute_chart_from_data(chart_json, settings_overrides?) -> Result<Map<String, Value>, String>`

- Computes positions and aspects from an in-memory chart payload.
- `chart_json.subject.event_time` must be parseable as `YYYY-MM-DD HH:mm:ss`, `YYYY-MM-DDTHH:mm:ss`, `YYYY-MM-DDTHH:mm:ssZ`, or RFC3339.
- Returns an object with `positions`, `motion`, `aspects`, `axes`, `house_cusps`, `shapes`, `configurations`, `moon_details`, `chart_id`, and backend provenance fields when available.
- Rust standalone computation resolves built-in model defaults and chart
  overrides through the same settings service used by workspace charts.
- Resolved house system, bodies, aspects, orbs, engine, zodiac, ayanamsa, and
  time system are materialized only on the in-memory computation copy.
- Legacy `included_points` is accepted as a chart-level body selection and
  produces a deprecation warning; new payloads should use
  `observable_objects`.
- `settings_overrides` is an optional operation layer with `houseSystem`,
  `bodies`, `aspects`, `aspectOrbs`, `engine`, `zodiacType`, `ayanamsa`, and
  `timeSystem`.
- Uses Python or Rust depending on backend selection and availability.

Acceptance criteria:

- A valid chart payload returns `positions`, `aspects`, and `chart_id`.
- Rust-supported radix output should also include `axes` and `house_cusps`.
- Rust-supported radix output should include `motion` when the selected backend can derive it.
- Rust-supported radix output should also include `shapes` (bundle/bowl/bucket/seesaw/splash/stellium/etc. distribution shapes) and `configurations` (t-square/grand-trine/grand-cross/kite/mystic-rectangle/hexagram/pentagram aspect patterns), derived from the 10 classical bodies (Sun through Pluto), the computed `house_cusps`, and the computed `aspects`. See `detect_chart_shapes`/`detect_chart_configurations` in `domain/astrology.rs`.
- When `positions.sun` and `positions.moon` exist, `moon_details` should describe lunar phase (elongation, illuminated fraction, waxing flag, and phase label). See [lunar-phase](../lunar-phase/).
- When fallback occurs, the response should expose that fact instead of failing silently.

### `compute_cross_aspects_from_data(chart_json, transiting_positions, transited_positions, aspect_types, settings_overrides?) -> Result<Vec<ComputedAspect>, String>`

- Detects cross-chart aspects (e.g. a transit overlay) between two already-computed position maps (`transiting_positions`, `transited_positions`, both `Map<String, f64>`), without requiring a persisted workspace chart id.
- Resolves the aspect catalog and effective orb overrides the same way `compute_chart_from_data` resolves them: `chart_json` is deserialized into a `ChartInstance` and passed through the same settings service (`standalone_model_report_with_operation`).
- `aspect_types` filters which aspect ids to detect, same semantics as `compute_transit_series`'s `aspect_types`.
- Returns a list of `ComputedAspect` objects: `from`, `to`, `type`, `angle`, `orb`, `exact_angle`, `applying`, `separating` — the same shape used by `compute_chart`/`compute_chart_from_data`'s `aspects` field and by `compute_transit_series`'s per-entry `aspects`.
- Rust-only; no Python route exists for this command.
- This is the command any frontend code computing an "instant" (non-persisted) transit overlay should call instead of re-implementing aspect-detection geometry client-side.

### `compute_chart(workspace_path, chart_id, preset_id?, settings_overrides?) -> Result<Map<String, Value>, String>`

- Loads a chart from workspace storage and computes positions and aspects.
- Returns `positions`, `motion`, `aspects`, `axes`, `house_cusps`, `shapes`, `configurations`, `moon_details` (when Sun and Moon are present), `chart_id`, and backend provenance fields when available.
- Rust aspect detection uses the resolved workspace/chart model definitions and effective orb overrides.
- `preset_id` may identify a referenced workspace preset by its name or manifest
  path. The chart layer overrides the preset layer.
- `settings_overrides` is the highest-precedence ephemeral operation layer.
- Uses Python or Rust depending on backend selection and availability.
- Preset and operation layers are forwarded to either backend. `Auto` follows
  normal backend selection, and fallback preserves the same layers.

### `compute_transit_series(...) -> Result<Value, String>`

Inputs:

- `workspace_path`
- `chart_id`
- `start_datetime`
- `end_datetime`
- `time_step_seconds`
- `transiting_objects`
- `transited_objects`
- `aspect_types`
- optional `preset_id`
- optional `settings_overrides`

Behavior:

- `time_step_seconds` must be greater than `0`.
- `end_datetime` must be greater than or equal to `start_datetime`.
- Rust mode enforces a hard cap of `50_000` generated steps.
- Returns a response with `source_chart_id`, `time_range`, `time_step`, `results`, and backend provenance fields.
- Rust cross-aspects use the same resolved model definitions and effective orb overrides as radix computation.
- Preset and operation settings use the same precedence and temporary Rust-only
  routing described for `compute_chart`.

Acceptance criteria:

- Invalid date order returns an error.
- Non-positive step returns an error.
- A valid range returns ordered results with `datetime`, `transit_positions`, and `aspects`.

## Ephemeris commands

### `list_ephemeris_catalog() -> Vec<EphemerisInfo>`

- Returns the current BSP catalog and local download status for each entry.
- Each entry includes id, filename, URL, size, supported bodies, year coverage, default status, download status, and optional local path.

### `download_ephemeris(id) -> Result<(), String>`

- Starts downloading a BSP file from the built-in catalog into the app-data ephemeris cache.
- Emits `ephemeris-progress` events while downloading and `ephemeris-ready` on completion.
- Returns an error when the catalog id is unknown or the download fails.

### `get_available_bodies() -> Vec<String>`

- Returns the currently queryable body ids inferred from available BSP files.
- This reflects file availability, not a guarantee that every body has a dedicated SPK segment in the loaded kernels.

## Storage commands

Current Rust storage behavior is workspace-only.

Computed positions, aspects, and relations are **not persisted** by the Rust desktop app.
These compatibility commands remain registered so older frontend invoke paths keep working while
workspace data continues to live in YAML and live computations come from the chart compute commands.

### `init_storage(workspace_path) -> Result<String, String>`

- Ensures `workspace_path/` and `workspace_path/charts/` exist.
- Returns the normalized workspace path string.
- Does not create or initialize a DuckDB database.

### `store_positions(...) -> Result<(), String>`

- No-op.
- Returns success for API compatibility.

### `query_positions(...) -> Result<Vec<PositionRow>, String>`

- Returns an empty list.

### `store_relation(...) -> Result<(), String>`

- No-op.
- Returns success for API compatibility.

### `query_aspects(...) -> Result<Vec<AspectData>, String>`

- Returns an empty list.

### `compute_aspects(...) -> Result<Vec<AspectData>, String>`

- Returns an empty list.

### `query_timestamps(...) -> Result<Vec<String>, String>`

- Returns an empty list.

### `query_radix_relative(...) -> Result<Vec<RadixRelativeRow>, String>`

- Returns an empty list.

Acceptance criteria:

- Frontend code may invoke these commands without crashing.
- Frontend code must treat storage query results as empty unless a future spec introduces persisted computed storage.
- Frontend code should use `compute_chart` / `compute_chart_from_data` / `compute_transit_series` / `compute_cross_aspects_from_data` for live computation, not these storage compatibility commands.

## Spec maintenance rule

When any command signature or behavior changes, update this page in the same change set.
