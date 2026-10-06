---
title: 'Rust code structure'
description: 'Current Rust module map and responsibility boundaries.'
weight: 43
doc_kind: implementation-reference
status: current
authority: informative
---

This page maps the Rust code that exists today. It is an implementation
reference, not a migration log or a target tree. The architectural rules and
the persistence/configuration rationale live in [Backend structure](../backend-structure/).

## Module map

```text
src-tauri/src/
├── lib.rs                         # Tauri setup, managed state, command registration
├── commands/                      # thin invoke adapters and DTO/error mapping
│   ├── workspace.rs               # workspace lifecycle, defaults, catalog/report commands
│   ├── charts.rs                  # chart CRUD and imports
│   ├── calculation.rs             # radix/cross-aspect compute commands
│   ├── transits.rs                # transit persistence and compute commands
│   ├── location.rs                # location/timezone commands
│   ├── dialogs.rs                 # native dialog commands
│   ├── ephemeris.rs               # ephemeris status/download commands
│   ├── analyses.rs                # analysis commands
│   └── storage.rs                 # legacy compatibility commands
├── application/                   # use cases and orchestration
│   ├── computation.rs             # resolved chart computation
│   ├── transit.rs                 # transit-series orchestration
│   ├── compute_router.rs          # backend selection, fallback, provenance
│   ├── workspace.rs               # chart/workspace helpers and validation flow
│   └── location.rs                # location search use case
├── domain/                        # backend-neutral calculations
│   ├── astrology.rs               # body selection, aspects, shapes, configurations
│   └── houses.rs                  # houses, angles, and analytic lunar-node math
├── workspace/                     # persisted models and workspace services
│   ├── models.rs                  # YAML/DTO model definitions, catalog types
│   ├── model_catalog.rs           # built-in model data construction
│   ├── settings.rs                # model selection, layered settings, provenance
│   ├── validation.rs              # invariants and serializable diagnostics
│   ├── loader.rs                  # manifest/reference loading
│   └── writer.rs                  # workspace/chart/transit YAML writes
└── infrastructure/                # external mechanisms
    ├── astronomy/                 # provider trait and JPL/Swiss adapters
    ├── ephemeris.rs               # BSP resources, cache, and Almanac setup
    ├── python_sidecar.rs           # optional process lifecycle and HTTP client
    ├── geocoding.rs                # Nominatim and timezone lookup
    └── dialogs.rs                  # platform folder-picker integration
```

## Responsibility boundaries

- `commands` owns transport concerns only. It should not contain YAML formats,
  catalog construction, astrology rules, provider policy, or process lifecycle.
- `application` loads the inputs for a use case, resolves settings, selects a
  provider, and returns typed results with warnings and provenance.
- `domain` contains pure calculation semantics. It must not depend on Tauri,
  YAML, HTTP, or a concrete provider.
- `workspace` owns the serializable workspace aggregate, built-in catalog data,
  validation, persistence adapters, and effective-settings resolution. The
  runtime catalog is assembled in `workspace::domain_catalog_for_model` from
  the resolved model.
- `infrastructure` implements external access behind application/provider
  boundaries.

## Runtime catalog path

`workspace::builtin_domain_catalog` supplies the no-workspace catalog.
`commands::workspace::get_domain_catalog` resolves the workspace/model through
`current_model_report`, then calls `domain_catalog_for_model`. The returned
`DomainCatalog` includes the model, supported house systems, shapes, and
configurations. `get_builtin_domain_catalog` and `get_domain_catalog` are the
Rust commands consumed by both frontends.

## Workspace and settings path

`loader::load_workspace_manifest` reads `workspace.yaml`; the aggregate loader
loads referenced entities and retains structured diagnostics. `settings` applies
the precedence `application < model < workspace < preset < chart < operation`
and records a source for resolved values. `validation` checks model references,
catalog IDs, settings, paths, and subject/chart invariants.

## Testing boundary

- Domain and application tests should run without Tauri state.
- Workspace tests cover YAML loading/writing, catalog validity, resolution, and
  diagnostics.
- Infrastructure tests cover providers, ephemerides, HTTP, and processes.
- Command tests cover DTO conversion, registration, and error mapping.
- Cross-language behavior belongs in parity/integration fixtures.

See [Testing strategy](../testing-strategy/) for the repository-wide test
matrix, and [Rust workspace contract](../rust-workspace-contract/) for the
observable lifecycle and schema rules.
