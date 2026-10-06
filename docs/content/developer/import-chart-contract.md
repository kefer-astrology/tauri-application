---
title: 'Import chart contract'
weight: 42
doc_kind: contract
status: current
authority: normative
---

This page defines the current import behavior for bringing previously created charts into an existing workspace.

## Scope

Import is a distinct workflow from:

- opening a workspace folder
- creating a new chart from frontend form data

Import means ingesting an external chart file into the active workspace and registering it in `workspace.yaml`.

## Command

Use a dedicated Tauri command for import:

- `import_chart(workspace_path, source_path)`

## Supported formats

### Implemented now

- native chart YAML: `.yml`, `.yaml`
- StarFisher EventData: `.sfs`
- Morinus saved horoscope: `.hor`

Morinus `.hor` files are scalar Python pickle streams. The importer accepts
the protocol variants emitted by the application, extracts the persisted chart
facts, and recalculates positions through the native chart-compute route.

SFS import accepts UTF-8 and BOM-marked UTF-16LE/UTF-16BE EventData scripts. It converts the persisted event facts—caption, local date and GMT/DST offset, coordinates, location, timezone, and keywords—into a native chart. StarFisher settings scripts are not event files and are rejected when required EventData fields are absent.

## Required behavior

- The command loads the target workspace manifest first.
- The command validates the external file against the Rust/Python chart model shape.
- On successful YAML or SFS import, the chart is written into the workspace `charts/` directory as native YAML.
- The imported chart is registered in `workspace.yaml`.
- The imported chart id is the source of truth for the destination filename and manifest entry.

## Failure behavior

- If the workspace is invalid or missing `workspace.yaml`, import fails.
- If the imported chart format is unsupported, import fails with a clear message.
- If a chart with the same id already exists in the workspace, import fails.
- If the imported file cannot be parsed into the chart model, import fails.

## Current implementation rule

- Native YAML and SFS import work without the Python backend.
- SFS files are source-event records, not trusted computed-state snapshots.
- Imported SFS charts explicitly select the JPL engine and apparent positions. No planetary positions, aspects, axes, or houses are copied into workspace YAML; the normal chart compute route recalculates them from the imported UTC event and location.
- `GMT±H:MM DST` is interpreted as the stated standard offset plus one daylight-saving hour, and the effective offset is retained alongside the IANA zone.

## Acceptance checks

- Importing a valid external YAML or StarFisher EventData chart adds it to the current workspace.
- Imported charts appear in `load_workspace`.
- Duplicate imports by chart id are rejected.
- Unsupported formats are rejected with a useful error.
- Developer Manual contracts stay aligned when import behavior changes.
