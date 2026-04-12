---
title: "Architecture"
description: "Cross-layer architecture for the Tauri, React, and Python stack."
weight: 40
---

# Architecture

Consolidated architecture reference for the Tauri + Python astrology browser.

## Overview

- **Frontends**: React UI (`apps/web-react/`) and an alternate Svelte UI (`apps/web-svelte/`). Both call Tauri through `@tauri-apps/api/core`; see [frontend-react](./frontend-react/) and [frontend-svelte](./frontend-svelte/). UI themes and i18n workflow: [ui-conventions](./ui-conventions/).
- **Backend**: Tauri (Rust) commands orchestrate workspace and computation.
- **Compute**: Python sidecar (CLI) performs astrology calculations.
- **Storage**: YAML for metadata + DuckDB/Parquet for positions-only data.
- **Aspects**: Computed on demand from stored positions (not persisted).
- **Shared assets**: repo-root `static/` is the source of truth for app-shell logos/icons and astrology glyph sets used by both frontends.

## Core Principles

1. **YAML Compatibility**: Workspace/charts remain compatible with the Python package.
2. **Hybrid Storage**: YAML for metadata; DuckDB + Parquet for positions.
3. **Python Sidecar**: Heavy computation stays in Python; async from Tauri.
4. **Query-Optimized**: Structure for fast position queries; derive aspects at query time.
5. **Precision Support**: JPL supports seconds/microseconds as needed.

## Workspace Layout

```
workspace/
├── workspace.yaml              # Workspace metadata
├── charts/                     # Chart definitions
│   ├── chart_001.yaml
│   └── chart_002.yaml
├── subjects/                   # Subject definitions
│   └── subject_001.yaml
└── data/
    ├── workspace.db            # DuckDB (positions, relations, metadata)
    └── positions/              # Parquet files for positions
        ├── chart_001/
        └── chart_002/
```

## Storage Model (Positions-Only)

- **Positions** are the single source of truth.
- **Aspects** are derived on demand in the query layer (Rust/Python).
- **Parquet** is used for large time ranges; **DuckDB** for active queries.

### DuckDB Core Table

```sql
CREATE TABLE computed_positions (
    chart_id TEXT NOT NULL,
    datetime TIMESTAMP NOT NULL,   -- Microsecond precision supported
    object_id TEXT NOT NULL,

    -- Ecliptic coordinates (always available)
    longitude REAL NOT NULL,
    latitude REAL,

    -- Equatorial (JPL: always computed)
    declination REAL,
    right_ascension REAL,
    distance REAL,

    -- Topocentric (JPL with location)
    altitude REAL,
    azimuth REAL,

    -- Physical (JPL for planets)
    apparent_magnitude REAL,
    phase_angle REAL,
    elongation REAL,
    light_time REAL,

    -- Motion
    speed REAL,
    retrograde BOOLEAN,

    -- Engine metadata
    engine TEXT,
    ephemeris_file TEXT,

    -- Flags for populated columns
    has_equatorial BOOLEAN DEFAULT FALSE,
    has_topocentric BOOLEAN DEFAULT FALSE,
    has_physical BOOLEAN DEFAULT FALSE,

    PRIMARY KEY (chart_id, datetime, object_id)
);
```

### JPL Column Rules

- For JPL: `declination`, `right_ascension`, `distance` are **always** computed.
- For non‑JPL: those columns are `NULL`.
- Use `has_equatorial`, `has_topocentric`, `has_physical` to filter.

## Backend routing (Rust → Python / Rust)

- **All frontend actions** go through Tauri: the UI only calls `invoke('<command>', ...)`. There is no direct frontend → Python path.
- **Compute router** (env `KEFER_COMPUTE_BACKEND`):
  - `Auto` (default): **Python primary**, **Rust fallback**. Try Python first; on failure, fall back to Rust when `KEFER_PYTHON_FALLBACK` is not disabled.
  - `Python`: use Python only.
  - `Rust`: use Rust only (no fallback).
- **Rust** implements workspace I/O, storage (DuckDB), and in-memory chart building; **Python** is used for Swiss Ephemeris / JPL when available.

## Data Flows

### Chart Creation

```
React UI → Tauri command → write YAML → Python compute_positions → store DuckDB
```

### Transit Computation

```
React UI → Tauri command → Python compute positions over range → store DuckDB
UI derives aspects from loaded positions when needed
```

## Integration Points (frontend)

**Current:**

- `apps/web-react/src/lib/tauri/` — types and `invoke` helpers (`openWorkspaceFolder`, `saveWorkspace`, etc.).
- `apps/web-react/src/app/App.tsx` — workspace open/save from the sidebar; extend with chart editors and data views.
- `apps/web-svelte/src/` — alternate Svelte workspace with the more advanced panel/radix/transits UI.
- `static/app-shell/` — shared app-shell logos and icon sets (`default`, `modern`) for both frontends.
- `static/glyphs/` — shared glyph families (`default`, `classic`) for both frontends.

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
`read`, `write`, `open_folder_dialog`, `load_workspace`, `save_workspace`, `get_workspace_defaults`, `get_chart_details`, `init_storage`, `compute_chart`, `compute_chart_from_data`, `compute_transit_series`, `create_chart`, `update_chart`, `query_positions`, `compute_aspects`, `query_radix_relative`.

**Registered but not yet used from UI (reserved for future wiring):**  
`store_positions`, `store_relation`, `query_timestamps`, `create_workspace`, `delete_workspace`, `delete_chart`.

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
- DuckDB for hot data; Parquet partitioned by date for long ranges.
- Cache recent computations in memory for UI responsiveness.

## Implementation Checklist

1. Preserve i18n/theming.
2. Add time navigation store + UI.
3. Update DuckDB schema for optional JPL columns + flags.
4. Ensure Python CLI returns JPL columns.
5. Wire UI views to position queries; derive aspects on demand.
