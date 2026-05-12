---
title: "Architecture"
description: "Cross-layer architecture for the Tauri desktop app and compute stack."
weight: 40
---

## Overview

The app has three main layers: frontend shells, the Tauri desktop boundary, and the compute/storage backend behind it.

**Backend responsibilities**

- workspace management for opening, importing, and updating workspace-level settings such as `workspace.yaml`
- compute execution through Rust and, optionally, Python
- storage for default JPL data, translation CSV input, and geo-data assets
- ephemeris management for bundled and downloaded BSP files
- on-demand calculation of positions, aspects, and transit-series results

**Frontend responsibilities**

- [React](../frontend-react/) UI in `apps/web-react/`
- [Svelte](../frontend-svelte/) UI in `apps/web-svelte/`
- Tauri calls through `@tauri-apps/api/core`
- shared theme and i18n workflow described in [ui-conventions](../ui-conventions/)
- shared asset usage from repo-root `static/`

## Current state

- React is the current default desktop shell.
- Rust-backed chart and transit compute is active in the main app flows.
- Python is still supported as an optional compatibility backend rather than a required foundation.
- **Workspace persistence**: chart definitions and workspace defaults are stored in YAML under a workspace folder.
- **Workspace defaults**: can be updated directly in `workspace.yaml` through `save_workspace_defaults(...)`.
- **Chart import**: native YAML is supported directly; `.sfs` is still not wired in the current Rust path.
- **Computed chart data**: positions, axes, house cusps, aspects, and transit-series results are computed on demand.
- **Computed storage**: there is no settled queryable storage layer for computed data yet.
- **Backend routing**: all frontend calls go through Tauri, which then routes to Rust or Python.
- **Auto routing**: `KEFER_COMPUTE_BACKEND=Auto` currently prefers Python when available and falls back to Rust.
- **Geocoding**: location lookup is handled in Rust through a configurable Nominatim-style endpoint.
- **Ephemeris downloads**: BSP discovery, cache management, and download status are handled in Rust.
- **React status**: the main horoscope flow is wired to real Tauri-backed compute; some secondary screens are still presentational.
- **Svelte status**: radix/settings/transits parity is much better than before, but some compatibility-era storage helpers and in-memory fallbacks still remain.

## Principles

1. **YAML compatibility**: workspace and chart definitions should stay compatible with the Python package.
2. **Workspace-first persistence**: workspace definitions are primary; computed data stays secondary.
3. **Backend-neutral astronomy**: astronomy backends should be swappable without changing chart semantics.
4. **No-sidecar operation**: the app should still run supported flows without Python.
5. **Astronomy vs astrology separation**: zodiac, houses, ayanamsha, aspect rules, and tradition defaults belong above the astronomy backend.
6. **Precision support**: the architecture should support second-level and higher precision where the backend supports it.
7. **License-clean default**: new default compute paths should not reintroduce AGPL dependency.

## Workspace model

```text
workspace/
├── workspace.yaml
├── charts/
│   ├── chart_001.yaml
│   └── chart_002.yaml
├── subjects/
│   └── subject_001.yaml
└── layouts/
    └── layout_001.yaml
```

- **Live state today**: the Rust desktop app persists workspace YAML only.
- **Chart definitions**: stay in YAML and should remain compatible with the Python workspace/model layer.
- **Workspace defaults**: live in `workspace.yaml` and have their own persistence path.
- **Computed positions and aspects**: are produced on demand in Rust or Python.
- **Storage compatibility commands**: still exist, but should not be treated as a real computed-data persistence layer.

## Compute model

The frontend should only call `invoke(...)`. Tauri owns backend selection and routes work to Rust or Python as needed.

- **Rust path**: local chart and transit compute is real and active.
- **Python path**: optional sidecar path for compatibility and backend-specific integrations.
- **Response provenance**: callers should be able to see which backend actually handled the request.

### Backend selection

- `Auto`: Python when available, Rust otherwise.
- `Python`: Python only.
- `Rust`: Rust only.

### Result shape

**Stable core fields**

- `longitude`
- `latitude` when available
- `speed` when available
- `retrograde` when derivable

**Additive fields**

- `declination`
- `right_ascension`
- `distance`
- topocentric fields
- physical properties

**Provenance fields**

- `backend_used`
- `fallback_used`
- `ephemeris_source`
- `warnings`

## Layering

### Time and observer layer

- canonical event time
- timezone handling
- location and observer model
- Julian/time-scale conversion

### Astronomy backend layer

- body-state computation
- axes computation
- house-cusp computation
- backend-specific provenance

### Transform layer

- ecliptic and equatorial transforms
- tropical and sidereal projection
- geocentric and topocentric handling
- apparent and mean model switches

### Astrology layer

- zodiac sign mapping
- house interpretation
- aspect computation and orb policy
- tradition defaults
- derived points such as nodes, Lilith variants, and lots

## Frontend integration

- **React Tauri layer**: `apps/web-react/src/lib/tauri/`
- **React shell**: `apps/web-react/src/app/App.tsx`
- **Svelte shell**: `apps/web-svelte/src/`
- **Shared app-shell assets**: `static/app-shell/`
- **Shared astrology glyphs**: `static/glyphs/`

### UI rules

- Prefer shared component systems before bespoke controls.
- React should start from `apps/web-react/src/app/components/ui/`.
- Svelte should start from `apps/web-svelte/src/lib/components/ui/`.
- Visual changes should prefer variants, tokens, spacing, and shared wrappers over one-off forks.

## Runtime flows

### Chart creation

```text
Frontend UI -> Tauri command -> write YAML -> compute through selected backend -> return in-memory result with provenance
```

### Transit computation

```text
Frontend UI -> Tauri command -> compute over time range -> return in-memory results for rendering and aspect display
```

## Tauri surface

**Mainly used from the UI today**

- `list_ephemeris_catalog`
- `download_ephemeris`
- `get_available_bodies`
- `open_folder_dialog`
- `resolve_location`
- `search_locations`
- `load_workspace`
- `save_workspace`
- `save_workspace_defaults`
- `get_workspace_defaults`
- `get_chart_details`
- `init_storage`
- `compute_chart`
- `compute_chart_from_data`
- `compute_transit_series`
- `create_chart`
- `import_chart`
- `update_chart`
- `query_positions`
- `compute_aspects`
- `query_radix_relative`

**Registered but not yet central in the UI**

- `store_positions`
- `store_relation`
- `query_timestamps`
- `create_workspace`
- `delete_workspace`
- `delete_chart`

For exact current command behavior, use [tauri-command-contracts](../tauri-command-contracts/).

## Non-final areas

- `InformationView` in React is still explicitly prototype-oriented.
- Some Svelte views still rely on compatibility storage commands and in-memory fallback behavior.
- Computed-data persistence is still not a fully settled architecture topic.
- Some import/storage directions are still under discussion.

## Near-term direction

1. Keep frontend behavior wired to real compute paths rather than mock geometry.
2. Keep no-sidecar execution functional.
3. Surface backend provenance consistently.
4. Continue moving astrology semantics into backend-neutral layers.
5. Keep shared assets, shared translation workflow, and shared UI rules aligned across both frontends.
