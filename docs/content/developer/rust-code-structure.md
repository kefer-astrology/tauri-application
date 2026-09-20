---
title: 'Rust code structure audit'
description: 'Current responsibility map for Tauri commands and the incremental extraction path.'
weight: 43
doc_kind: implementation-reference
status: evolving
authority: informative
---

This audit compares the current Rust source with the target boundaries in
[Backend structure](../backend-structure/). The command-layer extraction
described in earlier revisions of this document is now complete: `domain/`,
`application/`, and `infrastructure/` exist as real top-level modules, and
`commands/` holds only thin per-use-case adapters. The remaining gaps are
narrower and listed under [Known gaps](#known-gaps).

## Current responsibility map

| Area | Current state | Assessment |
| --- | --- | --- |
| `lib.rs` | Registers commands and initializes application resources | Appropriate composition root |
| `domain/astrology.rs` | Backend-neutral body selection, aspect rules, chart-shape and configuration detection | Domain logic (900 lines); mixes four related but distinct algorithms — a splitting candidate |
| `domain/houses.rs` | Pure-Rust house/angle math and analytic lunar-node computation | Domain math, but imports `AstronomyMotion` from `infrastructure::astronomy` — see [Known gaps](#known-gaps) |
| `event_time.rs` | Canonical event-time parsing shared by persistence and application inputs; accepts RFC 3339 and legacy naive formats | Permissive parser; still not the canonical validated time type Backend structure calls for |
| `lunar_phase.rs` | Derives geocentric lunar phase from tropical Sun/Moon longitude for chart `moon_details` | Small, backend-neutral domain calculation |
| `application/computation.rs` | Owns typed resolved-chart calculation orchestration | Matches the application layer |
| `application/transit.rs` | Owns typed transit validation and series orchestration | Matches the application layer |
| `application/compute_router.rs` | Rust/Python backend selection, fallback policy, and response normalization | Matches the application layer; one function reads workspace YAML directly to decide precision requirements (pragmatic, not port-abstracted) |
| `application/workspace.rs` | Chart validation, id/preset helpers shared by the workspace and chart commands | Matches the application layer |
| `application/location.rs` | Location-search use case: validates the query, calls geocoding infrastructure, resolves timezones | Matches the application layer |
| `infrastructure/astronomy/mod.rs` | Defines the provider trait and selects Rust astronomy adapters | Useful boundary; provider construction can later be injected |
| `infrastructure/astronomy/jpl_backend.rs` | Astronomy adapter using the `anise` crate over `EphemerisManager`-resolved BSP files | Largest infrastructure file (629 lines); cohesive but dense |
| `infrastructure/astronomy/swisseph.rs` | FFI bindings and computation calls into the Swiss Ephemeris C library | AGPL-licensed adapter correctly isolated behind the `swisseph` feature flag |
| `infrastructure/ephemeris.rs` | Owns the BSP catalog, cache/resource directories, and chained `anise::Almanac` construction | Cohesive infrastructure boundary |
| `infrastructure/python_sidecar.rs` | Owns Python sidecar process lifecycle, port reservation, HTTP client, and availability state | Cohesive infrastructure boundary |
| `infrastructure/geocoding.rs` | Nominatim HTTP client and IANA timezone lookup | Cohesive infrastructure boundary |
| `infrastructure/dialogs.rs` | Native folder-picker process invocation per OS | Cohesive infrastructure boundary |
| `workspace/models.rs` | Owns serializable workspace and calculation definitions | Largest single file (864 lines); still under `workspace/` rather than the `domain/` boundary Backend structure's target names |
| `workspace/model_catalog.rs` | Built-in fallback astrological model catalog | Cohesive data module; data construction only, no selection policy |
| `workspace/settings.rs` | Owns layered resolution and provenance | Correct responsibility, still the largest module (1110 lines) |
| `workspace/validation.rs` | Workspace and model validation producing stable, serializable diagnostics | Cohesive, but same `domain/` relocation gap as `models.rs` |
| `workspace/loader.rs` | Loads and validates referenced YAML aggregates, including chart-by-id lookup | Cohesive infrastructure boundary |
| `workspace/writer.rs` | Workspace, chart, and transit-setup YAML writes | Cohesive infrastructure boundary; sibling to `loader.rs` as planned |
| `commands/workspace.rs` | Thin workspace lifecycle and defaults adapters (654 lines, down from ~2,800) | Matches the target; no longer mixes unrelated responsibilities |
| `commands/charts.rs` | Thin chart CRUD/import adapters | Matches the target |
| `commands/calculation.rs` | Chart and cross-aspect compute adapters, backend routing glue | Matches the target |
| `commands/transits.rs` | Transit persistence and compute adapters | Matches the target |
| `commands/location.rs` | Location/timezone invoke adapters | Matches the target |
| `commands/dialogs.rs` | Desktop folder-dialog invoke adapter | Matches the target |
| `commands/ephemeris.rs` | Delegates to `EphemerisManager` | Good example of a thin command adapter |
| `commands/storage.rs` | Isolates legacy no-op compatibility commands | Cohesive but intentionally temporary |
| `storage/models.rs` | Defines legacy DTO shapes (`PositionData`, `AspectData`, etc.) for the no-op storage commands | Paired with `commands/storage.rs`; should be removed together if those commands are removed |
| `commands/default.rs` | Exposes path-based file read/write directly | Infrastructure behavior exposed without an application service |

## Known gaps

The command-layer split is done, but a few boundary issues remain, in rough
priority order:

1. **`domain/houses.rs` depends on `infrastructure/astronomy`.** `mean_node_motion`
   is a pure domain calculation, but it returns `AstronomyMotion`, a type owned
   by `infrastructure::astronomy::mod`. This is a real dependency-direction
   violation of the rule in [Backend structure](../backend-structure/): domain
   code should not depend on a particular astronomy engine's module. The fix is
   small — move `AstronomyMotion` into `domain/` (it is a domain concept, "is
   this body retrograde and how fast is it moving") and have
   `infrastructure/astronomy` import it from there instead.
2. **`workspace/models.rs` and `workspace/validation.rs` are not yet under
   `domain/`.** Backend structure's target tree names `domain/chart.rs`,
   `domain/model.rs`, `domain/workspace.rs`, etc. as the eventual home for these
   serializable definitions and their invariants. They are correctly
   YAML/Tauri-free today, but physically still live under `workspace/`, the
   same incremental boundary the loader and writer occupy. Moving them is a
   larger, higher-risk step than the command split, since nearly every other
   module imports `workspace::models` by path.
3. **`workspace/settings.rs` (1,110 lines) is still one module.** It correctly
   owns layered resolution and provenance, but resolution logic and provenance
   bookkeeping could split into narrower files without changing behavior.
4. **`domain/astrology.rs` (900 lines) mixes four algorithms**: body selection,
   aspect detection, chart-shape detection, and chart-configuration detection.
   These are related but independently testable; splitting by algorithm would
   shrink the largest domain file without touching its logic.
5. **`event_time.rs` still accepts legacy naive formats permissively.** Backend
   structure's migration order calls for a canonical validated time type; this
   was explicitly out of scope for the command-layer split (see the physical
   decoupling this document tracks) and remains open.

None of these block the current architecture from working correctly — they are
prioritized by how cheaply they can be fixed without behavior change, not by
urgency.

## Achieved command, application, and infrastructure shape

Commands deserialize transport inputs, call one application use case, and
serialize the result. This is now the actual tree, not a target:

```text
commands/
├── workspace.rs       # thin workspace invoke adapters
├── charts.rs          # thin chart CRUD/import adapters
├── calculation.rs     # chart and cross-aspect invoke adapters
├── transits.rs        # transit persistence and compute adapters
├── location.rs        # location/timezone invoke adapters
├── dialogs.rs         # desktop dialog invoke adapter
├── ephemeris.rs
└── storage.rs         # legacy no-op compatibility commands

application/
├── workspace.rs       # chart validation and shared workspace/chart helpers
├── computation.rs     # resolved chart calculation
├── compute_router.rs  # Rust/Python selection, fallback, provenance
├── transit.rs
└── location.rs        # location resolution use case

domain/
├── astrology.rs       # body selection, aspect rules, shapes, configurations
└── houses.rs          # house/angle math, analytic lunar nodes

infrastructure/
├── astronomy/         # provider trait, jpl_backend.rs, swisseph.rs
├── ephemeris.rs        # BSP catalog/cache and Almanac construction
├── python_sidecar.rs   # sidecar process lifecycle and HTTP client
├── geocoding.rs         # Nominatim client and timezone lookup
└── dialogs.rs           # platform folder-picker process invocation

workspace/              # migration boundary predating domain/; not yet merged into it
├── models.rs           # serializable definitions (domain/ candidate, see gap 2)
├── model_catalog.rs    # built-in fallback catalog
├── settings.rs         # layered resolution and provenance
├── validation.rs       # stable diagnostics and invariants (domain/ candidate)
├── loader.rs           # YAML read/lookup adapter
└── writer.rs           # YAML write adapter
```

`domain/` does not yet hold the full target shape from Backend structure
(`chart.rs`, `model.rs`, `calculation.rs`, `relation.rs`, `workspace.rs`,
`error.rs`) — only `astrology.rs` and `houses.rs` have been relocated there so
far. `workspace/models.rs` and `workspace/validation.rs` remain the largest
step toward that target (gap 2 above).

## Remaining extraction order

The command-layer extraction (dialogs, geocoding, YAML writes, Rust/Python
routing, and the per-use-case command split) is complete. What is left:

1. Move `AstronomyMotion` into `domain/` and update `infrastructure/astronomy`
   to import it from there (gap 1).
2. Move `workspace/models.rs` and `workspace/validation.rs` into `domain/`,
   updating the many call sites that currently import `workspace::models`
   (gap 2). This is the largest remaining step and should be done on its own,
   not bundled with other changes.
3. Split `workspace/settings.rs` by responsibility (resolution vs. provenance)
   without changing its public API (gap 3).
4. Split `domain/astrology.rs` by algorithm (gap 4).
5. Replace `event_time.rs`'s permissive parser with a canonical validated time
   type in `domain/event_time.rs` (gap 5).

This order preserves command names and frontend contracts throughout the
migration, same as before.

## Testing boundary

- Domain/application tests should call pure services without constructing Tauri state.
- Infrastructure tests should exercise YAML, HTTP adapters, process selection, and provider behavior explicitly.
- Command tests should focus on DTO conversion, error mapping, and registered behavior.
- Cross-language routing and normalization remain integration/parity tests.

Track those layers in the [Testing strategy](../testing-strategy/).
