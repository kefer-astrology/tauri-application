---
title: "Architecture"
description: "Cross-layer architecture for the Tauri desktop app and compute stack."
weight: 40
---

# Architecture

Consolidated architecture reference for the Tauri desktop app and its computation stack.

## Overview

- **Frontends**: React UI (`apps/web-react/`) and an alternate Svelte UI (`apps/web-svelte/`). Both call Tauri through `@tauri-apps/api/core`; see [frontend-react](./frontend-react/) and [frontend-svelte](./frontend-svelte/). UI themes and i18n workflow: [ui-conventions](./ui-conventions/).
- **Backend**: Tauri (Rust) commands orchestrate workspace and computation.
- **Compute**: Rust and Python can both participate in computation; Python is optional, not foundational.
- **Storage**: YAML workspace manifests and chart files are the active persistence layer.
- **Workspace defaults**: workspace-level settings can be persisted independently to `workspace.yaml` without rewriting all chart files.
- **Computed data**: Positions, aspects, and transit-series results are computed on demand and are not persisted by the Rust desktop app.
- **Shared assets**: repo-root `static/` is the source of truth for app-shell logos/icons and astrology glyph sets used by both frontends.

## Current runtime state

This section describes the app as it behaves today, without assuming future migration steps.

- **Workspace persistence**: chart definitions and workspace defaults are persisted in YAML under a workspace folder.
- **Workspace defaults**: workspace-level settings can be updated directly in `workspace.yaml` through `save_workspace_defaults(...)`.
- **Computed chart data**: chart positions, axes, house cusps, aspects, and transit-series results are computed on demand and kept in memory.
- **Computed storage**: the Rust desktop app does not currently persist computed positions/aspects/relations as a queryable local database layer.
- **Backend routing**: all frontend calls go through Tauri. Tauri then routes computation to Rust or Python depending on backend selection and backend availability.
- **Auto routing**: `KEFER_COMPUTE_BACKEND=Auto` currently prefers Python when the sidecar is available and falls back to Rust otherwise.
- **Rust compute**: Rust has a real local compute path for chart and transit work.
- **Python compute**: Python also has a real compute path and remains part of the active runtime contract, not just a historical reference.
- **React status**: the main React horoscope flow uses real Tauri-backed chart computation; some secondary screens are still prototype/presentational.
- **Svelte status**: the Svelte shell currently exposes more end-user surface area, including a wired transit compute flow, but some data access still passes through compatibility-era storage commands and in-memory fallbacks.

## Core Principles

1. **YAML Compatibility**: Workspace/charts remain compatible with the Python package.
2. **Workspace-First Persistence**: Persist workspace definitions in YAML; keep computed data ephemeral in the desktop app.
3. **Backend-Neutral Astronomy**: Astronomy backends should be swappable without changing chart semantics.
4. **No-Sidecar Operation**: The app must still run and compute supported features without the Python sidecar.
5. **Astronomy vs Astrology Separation**: Zodiac, houses, ayanamsha, and tradition rules belong above the astronomy backend.
6. **Precision Support**: The architecture should support second-level and higher precision where the backend supports it.
7. **License-Clean Default**: New compute paths must not introduce AGPL dependencies. Swiss Ephemeris (libswe, Kerykeion) is AGPL or paid-commercial; it is retained as an explicit opt-in compatibility path, never the default for new work.

## Compute stack today

- Tauri owns command routing and workspace I/O.
- Rust chart compute is backend-pluggable through the local astronomy layer.
- Python remains available as an active compute backend behind Tauri routing.
- Default backend selection is operationally:
  - `Auto`: Python when available, Rust otherwise.
  - `Python`: Python only.
  - `Rust`: Rust only.
- Response metadata is intended to expose which backend actually handled the request.

## Non-final surfaces today

- The React `InformationView` is still explicitly marked prototype in the UI.
- The React `HoroscopeDashboard` uses real chart-backed wheel data.
- Rust storage compatibility commands remain registered for API stability, but they should not be interpreted as a real persisted computed-data subsystem.
- Some Svelte views still use those compatibility commands and fall back to in-memory computed payloads when storage returns nothing.

## Workspace Layout

```
workspace/
├── workspace.yaml              # Workspace metadata
├── charts/                     # Chart definitions
│   ├── chart_001.yaml
│   └── chart_002.yaml
├── subjects/                   # Optional subject definitions
│   └── subject_001.yaml
└── layouts/                    # Optional layouts/annotations/modules
    └── layout_001.yaml
```

## Storage model

- **Current live state**: the Rust desktop app persists workspace YAML only; see **[tauri-command-contracts](./tauri-command-contracts/)** and `src-tauri/src/commands/storage.rs`.
- **Chart definitions** live in YAML and should stay compatible with the Python workspace/model layer.
- **Workspace defaults** live in `workspace.yaml` and now have a dedicated persistence path separate from full workspace save.
- **Computed positions and aspects** are produced on demand in Rust or Python.
- **Storage commands** remain registered for compatibility, but they do not persist calculated data.

### Backend field expectations

- The canonical result model should expose a stable core set independent of backend:
  - `longitude`
  - `latitude` when available
  - `speed` when available
  - `retrograde` when derivable
- Backend-specific enrichments such as `declination`, `right_ascension`, `distance`, topocentric fields, and physical properties should be additive rather than shape-breaking.
- JPL-backed results are expected to provide richer astronomy fields when requested.

## Backend routing (Rust ↔ Python)

- **All frontend actions** go through Tauri: the UI only calls `invoke('<command>', ...)`. There is no direct frontend → Python path.
- **Compute router** (env `KEFER_COMPUTE_BACKEND`):
  - `Auto` (default): **Python primary**, **Rust fallback**. Try Python first; on failure, fall back to Rust when `KEFER_PYTHON_FALLBACK` is not disabled.
  - `Python`: use Python only.
  - `Rust`: use Rust only (no fallback).
- **Rust** implements workspace I/O and local chart building.
- **Python** is an optional sidecar path for compatibility and backend-specific integrations.

## Recommended backend architecture

### Layer 1: Time and observer model

- One canonical model for event time, timezone, location, observer, and Julian/time-scale conversion.
- Offset-aware timestamps must preserve the represented instant.

### Layer 2: Astronomy backend interface

- `body_state(body, moment, observer, frame)`
- `axes(moment, observer, house_system)`
- `house_cusps(moment, observer, house_system)`
- `ayanamsha(moment, mode)` when supported

### Layer 3: Transform and projection layer

- ecliptic/equatorial transforms
- tropical/sidereal projection
- topocentric/geocentric handling
- apparent/mean model switches

### Layer 4: Astrology interpretation layer

- zodiac sign mapping
- house interpretation
- aspect computation and orb policy
- tradition defaults
- points such as nodes, Lilith variants, and derived lots

### Layer 5: Provenance and diagnostics

- `backend_used`
- `fallback_used`
- `ephemeris_source`
- `warnings`

The UI and persisted chart definitions should be able to surface this provenance.

## Data Flows

### Chart Creation

```
React UI → Tauri command → write YAML → compute through selected backend route → return in-memory result with provenance
```

### Transit Computation

```
React UI → Tauri command → backend-neutral compute over range
UI consumes returned in-memory results and derives or displays aspects as required
```

## Integration Points (frontend)

**Current:**

- `apps/web-react/src/lib/tauri/` — types and `invoke` helpers (`openWorkspaceFolder`, `saveWorkspace`, etc.).
- `apps/web-react/src/app/App.tsx` — workspace open/save from the sidebar; extend with chart editors and data views.
- `apps/web-svelte/src/` — alternate Svelte workspace with the more advanced panel/radix/transits UI.
- `static/app-shell/` — shared app-shell logos and icon sets (`default`, `modern`) for both frontends.
- `static/glyphs/` — shared glyph families (`default`, `modern`) for both frontends.

**To add (React):**

- Time navigation state/hooks and panels (see [time-navigation](./time-navigation/) for design).
- Tables, radix chart canvas, and aspect grids as React components; use shared glyph assets from repo root `static/`.

## UI system guidance

- Prefer the shared shadcn-style primitive layers before building bespoke UI controls.
- React uses the existing shadcn/Radix-style component set under `apps/web-react/src/app/components/ui/`.
- Svelte uses the shared UI primitives under `apps/web-svelte/src/lib/components/ui/`, built around Bits UI and the same token-first styling approach.
- When adjusting visual design, prefer variants, theme tokens, spacing, and shared wrappers over one-off duplicated component implementations.

## Tauri Commands (High-Level)

**Invoked from frontend today:**  
`read`, `write`, `open_folder_dialog`, `load_workspace`, `save_workspace`, `save_workspace_defaults`, `get_workspace_defaults`, `get_chart_details`, `init_storage`, `compute_chart`, `compute_chart_from_data`, `compute_transit_series`, `create_chart`, `update_chart`, `query_positions`, `compute_aspects`, `query_radix_relative`.

**Registered but not yet used from UI (reserved for future wiring):**  
`store_positions`, `store_relation`, `query_timestamps`, `create_workspace`, `delete_workspace`, `delete_chart`.

For current command behavior, return shapes, and no-op storage semantics, use **[tauri-command-contracts](./tauri-command-contracts/)** as the behavior reference.

## Time Navigation

- Seconds/minutes/hours/days stepping (default 1 hour).
- Quick navigation: first, prev, next, last, now.
- Time shift (Astrolab): years/months/days/hours/minutes/seconds.

## UI View Modes

- **Radix View**: circular chart, houses, aspects (derived).
- **Table View**: positions table with optional JPL columns.
- **Statistics View**: aggregated counts.
- **Interpretations View**: text-based meanings.

## Performance Notes

- Batch computation with pre‑initialized engines.
- Cache recent computations in memory for UI responsiveness.

## Implementation Checklist

1. Preserve i18n/theming.
2. Add time navigation store + UI.
3. Add backend provenance to compute responses.
4. Keep no-sidecar execution functional.
5. Move zodiac / house / tradition semantics into backend-neutral layers.
6. Wire UI views to in-memory results and derive aspects on demand.
