---
title: 'Rust code structure'
description: 'Current Rust module map and actual responsibility boundaries.'
weight: 43
doc_kind: implementation-reference
status: current
authority: informative
---

This is a source map, not a target architecture.

```text
src-tauri/src/
├── application/
│   ├── chart_resolution.rs validate/resolve persisted or in-memory chart input
│   ├── computation.rs     resolved Rust chart computation
│   ├── compute_router.rs  backend selection/fallback and response annotation
│   ├── event_search.rs    stationary-point/exact-aspect-time root-finding; not yet command-exposed
│   ├── location.rs        location use case
│   └── transit.rs         typed Rust transit-series computation
├── commands/              Tauri entry points; mixed adapters/orchestration
│   ├── analyses.rs        analysis persistence
│   ├── calculation.rs     radix/cross-aspect routing, loading, sidecar calls
│   ├── charts.rs          chart CRUD and imports
│   ├── default.rs         legacy generic file commands
│   ├── dialogs.rs         native dialog commands
│   ├── ephemeris.rs       ephemeris catalog/download commands
│   ├── location.rs        location/timezone commands
│   ├── storage.rs         legacy computed-data compatibility commands
│   ├── transits.rs        transit setup persistence and series routing
│   └── workspace.rs       create/save/delete/load, defaults, reports/catalogs
├── domain/                astrology relationships, shapes/configurations, houses
├── infrastructure/
│   ├── dialogs.rs         platform dialog integration
│   ├── ephemeris.rs       kernel catalog, cache, downloads, Almanac construction, chain-aware coverage
│   ├── geocoding.rs       external location/timezone lookup
│   ├── jpl_backend.rs     JPL/ANISE BSP position provider
│   ├── position_provider.rs provider trait, result types, and selection
│   ├── python_sidecar.rs  optional Python process and HTTP client
│   └── swisseph.rs        optional Swiss Ephemeris compatibility adapter
├── storage/               compatibility DTOs for legacy commands
├── workspace/
│   ├── loader.rs          manifest/reference loading and safe paths
│   ├── model_catalog.rs   built-in model construction
│   ├── models.rs          serde DTOs/persisted types and DomainCatalog DTO
│   ├── morinus.rs         Morinus import
│   ├── settings.rs        model selection, layers, source provenance
│   ├── sfs.rs             StarFisher EventData import
│   ├── solar_fire.rs      Solar Fire import classification
│   ├── validation.rs      diagnostics and aggregate validation
│   └── writer.rs          YAML writers
├── event_time.rs          canonical timestamp parsing
├── lib.rs                 library root, Tauri state, command registration
├── lunar_phase.rs         derived lunar-detail calculation
├── main.rs                desktop executable and Linux/AppImage startup workaround
└── test_support.rs        test-only fixtures and temporary workspace helpers
```

## Boundaries as implemented

`workspace::domain_catalog_for_model` projects a resolved `AstroModel` into
the frontend `DomainCatalog`; `builtin_domain_catalog` is its no-workspace
counterpart. `settings::current_model_report_with_layers` merges catalog
overrides and settings and records source provenance. `loader` provides both
tolerant helpers used by commands and the diagnostics-aware aggregate loader.

`application::chart_resolution` validates command/in-memory chart input and
assembles a `ResolvedChart` from persisted workspace data, optional presets,
and operation overrides. It is deliberately separate from `workspace/`, which
owns the persistence representation and YAML services.

`application::computation` and `application::transit` are reusable Rust
calculation cores. They receive resolved charts/settings and return typed
results. `compute_router` centralizes route selection/fallback helpers, but
commands still execute much of that policy and sidecar communication.

`domain` groups the application's astrology rules, but it is not yet an
independently portable pure-core crate: its functions currently use workspace
model types. `infrastructure::position_provider` is the shared provider
boundary. JPL supplies astronomical state vectors, while the feature-gated
Swiss Ephemeris adapter also supplies astrology-oriented operations such as
house systems and sidereal settings. `swisseph.rs` is feature-gated and is not
compiled in the default build; this checkout also lacks the vendored C source
required to enable that feature.

The command modules are not uniformly thin. In particular:

- `commands::workspace` directly creates/deletes directories, serializes YAML,
  loads manifests/references, and builds catalog/report command responses.
- `commands::calculation` and the compute portion of `commands::transits` use
  `application::chart_resolution` for manifest/chart/preset/settings assembly, but
  still choose routes and post Python requests.
- `commands::transits` directly reads/writes transit setup YAML.

`commands::storage` deliberately exposes compatibility no-ops for computed
data; it is not a storage subsystem.

## Refactoring status

Moving command orchestration into application services is intended work, not a
completed migration. New code should reuse existing application and workspace
helpers where practical, but documentation must retain the mixed-boundary
description until the commands are actually reduced to adapters.

For runtime behavior see [Architecture](../architecture/); for workspace
contracts see [Rust workspace contract](../rust-workspace-contract/).
