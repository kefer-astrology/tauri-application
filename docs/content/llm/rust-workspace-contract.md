---
title: "Rust workspace contract"
weight: 35
---

# Rust workspace contract

This page defines the current Rust-side implementation direction for the desktop app.

## Scope

Rust owns local workspace functionality and the no-sidecar execution path.

Rust does not own persisted storage of computed positions, aspects, or transit series.

## Rules

- Keep workspace persistence focused on YAML manifests and chart files.
- Respect the structures defined by `backend-python/module/models.py`.
- Use `backend-python/module/workspace.py` as the reference for workspace-loading intent.
- The desktop app must run without the Python sidecar.
- The app should check whether the Python backend is available at startup and use that availability state as the general runtime decision source.
- Do not repeatedly probe for Python sidecar existence in every feature flow when startup availability state can be reused.
- If Python is unavailable, Rust fallback behavior must remain functional for supported features.
- CI and desktop packaging must not be blocked by sidecar build failures while the Rust/no-sidecar path is the baseline.
- `backend-python/` may be omitted from some packaging contexts as long as the resulting app still supports the documented Rust fallback flows.
- Do not reintroduce DuckDB- or Parquet-based persistence on the Rust side unless a new `/llm/` spec explicitly changes this rule.
- Keep backend provenance visible to callers; do not allow silent backend changes to be invisible in compute results.

## Practical implications

- `init_storage` is a compatibility command only.
- Storage query commands may remain compatibility shims that return empty results.
- Rust compute commands should continue to support local in-memory results for the no-sidecar path.
- Workspace and chart file behavior should stay aligned with the Python workspace/model layer.
- Native YAML chart import should work through Rust without requiring the Python backend.
- StarFisher/SFS import remains in scope, but should stay explicitly staged until a Python-backed parser path is wired in.
- Current implementation may use Swiss-backed paths locally, but the architecture should evolve toward a backend-neutral astronomy interface.
- `jpl` / SPICE is the preferred long-term astronomy direction and should be added behind that interface rather than as a one-off special case.
- Rust-side contracts should prefer backend-neutral result shapes even when current implementation details differ underneath.
- Backend selection should follow this general rule:
  - app starts
  - app checks Python backend availability once
  - if Python is available, Python-backed flows may be used
  - if Python is unavailable, flows fall back to Rust where supported

## Dependency rule

- Remove Rust dependencies that are no longer used.
- Prefer deleting unused helper modules when removing a dependency.
- When changing architecture direction, update the `/llm/` spec in the same change set.
