---
title: "Import chart contract"
weight: 42
---

# Import chart contract

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

### Staged, not implemented in Rust yet

- StarFisher / SFS: `.sfs`

SFS remains in scope, but should use the Python-backed path once that parser flow is wired into the desktop app.

The frontend and Tauri command contract should remain backend-neutral even if a specific parser path is currently implemented in Python first.

## Required behavior

- The command loads the target workspace manifest first.
- The command validates the external file against the Rust/Python chart model shape.
- On successful YAML import, the chart is written into the workspace `charts/` directory as native YAML.
- The imported chart is registered in `workspace.yaml`.
- The imported chart id is the source of truth for the destination filename and manifest entry.

## Failure behavior

- If the workspace is invalid or missing `workspace.yaml`, import fails.
- If the imported chart format is unsupported, import fails with a clear message.
- If a chart with the same id already exists in the workspace, import fails.
- If the imported file cannot be parsed into the chart model, import fails.

## Current implementation rule

- Native YAML import must work without the Python backend.
- SFS import should not pretend to work through Rust-only heuristics.
- Until the Python-backed SFS path exists, `.sfs` import should fail explicitly and clearly.
- Import responses and error handling should not imply that Python is the architectural owner of chart ingestion in the long term.

## Acceptance checks

- Importing a valid external YAML chart adds it to the current workspace.
- Imported charts appear in `load_workspace`.
- Duplicate imports by chart id are rejected.
- Unsupported formats are rejected with a useful error.
- `llm` specs stay aligned when import behavior changes.
