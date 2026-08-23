---
title: 'Backend structure and data ownership'
description: 'Target Rust boundaries, canonical data model, layered settings, and Python parity rules.'
weight: 42
---

## Purpose

The Rust backend is the canonical definition of application semantics. Python is
an implementation peer for supported computations and integrations, but it must
conform to the same persisted formats, resolved settings, result DTOs, and error
behavior.

The backend is organized around four responsibilities:

1. **Domain** — valid astrological and workspace concepts.
2. **Application** — use cases and setting resolution.
3. **Infrastructure** — YAML, ephemerides, astronomy engines, geocoding, and the
   Python process.
4. **Commands** — the thin Tauri transport boundary.

Dependencies point inward. Domain code does not depend on Tauri, HTTP, YAML, or
a particular astronomy engine.

## Rust source direction

The migration is incremental. Existing command names remain stable while their
implementation moves behind application services.

```text
src-tauri/src/
├── astrology.rs                    # current: body selection and pure aspect rules
├── domain/                         # target: backend-neutral concepts
│   ├── chart.rs
│   ├── model.rs
│   ├── calculation.rs
│   ├── relation.rs
│   ├── workspace.rs
│   └── error.rs
├── application/                    # current: typed use cases and orchestration
│   ├── computation.rs              # resolved radix request/result and service
│   └── transit.rs                  # typed transit-series request/result and service
├── infrastructure/                 # target: external mechanisms
│   ├── workspace_yaml/
│   ├── astronomy/
│   ├── ephemeris/
│   ├── geocoding/
│   └── python_sidecar/
├── commands/                       # Tauri DTO conversion only
└── workspace/                      # current migration boundary
    ├── models.rs                   # serializable definitions only
    ├── model_catalog.rs            # built-in fallback catalog
    ├── settings.rs                 # layered resolution and provenance
    ├── validation.rs               # stable diagnostics and invariants
    └── loader.rs                   # current YAML loading adapter
```

The `workspace/` split is the first completed migration slice. It prevents
catalog construction and resolution policy from accumulating in `models.rs`.

Rust radix and transit aspect detection now consume the resolved
`AstroModel.aspect_definitions`. There is no second command-local list of aspect
IDs, angles, or default orbs. Standalone chart computation uses the same
canonical built-in model catalog. The algorithm and typed `ComputedAspect`
result live in `astrology.rs`, outside the Tauri command layer.

Body selection follows the same boundary. Commands resolve one ordered list of
canonical body IDs, `astrology::resolve_body_selection` validates it against the
model catalog and the selected engine's capability map, and astronomy adapters
receive only the validated IDs. Unsupported, unknown, duplicate, and
engine-omitted bodies produce explicit warnings instead of disappearing.

## Python source direction

Python now mirrors the same contract instead of maintaining a second set of
defaults inside route handlers:

```text
backend-python/module/
├── models.py          # persisted and calculation data structures
├── model_catalog.py   # canonical built-in fallback model
├── resolution.py      # model selection and layered settings with provenance
├── validation.py      # stable diagnostics and invariants
├── astronomy.py       # model-driven radix and cross-chart aspect rules
├── services.py        # engine adapters and computation mechanisms
├── workspace.py       # workspace YAML loading adapter
├── cli.py             # sidecar transport and use-case adapters
└── api/
    ├── schemas.py     # HTTP request DTOs
    └── app.py         # thin FastAPI transport
```

The Python chart and transit routes accept the same preset and operation
layers as Rust. Tauri therefore applies its normal backend selection rules;
neither backend silently drops a supplied layer.

## Workspace representations

Two workspace representations have different responsibilities and must not be
collapsed into one type.

### `WorkspaceManifest`

The persisted index stored in `workspace.yaml`. It contains:

- workspace identity
- active model and workspace defaults
- optional model catalogs and model-definition overrides
- relative references to charts, subjects, presets, layouts, and annotations

It is an infrastructure/persistence representation. References are resolved
under the workspace root and must not escape that root.

### `Workspace`

The loaded domain aggregate. It contains typed subjects, charts, presets,
layouts, annotations, and resolved model catalogs. Loading either succeeds with
an explicit set of diagnostics or fails; malformed referenced items must not
silently disappear.

`WorkspaceInfo` remains a command projection for list/open screens. It is not
the complete workspace model.

`loader::load_workspace_aggregate` is the strict typed loading path. It attempts
every referenced subject, chart, preset, layout, and annotation and returns all
successfully loaded entities alongside diagnostics. Unlike the legacy summary
loader, it never logs and silently discards a malformed reference.

The `validate_workspace` command exposes a compact report containing aggregate
counts, validity, and diagnostics. Existing `load_workspace` behavior remains
compatible while callers migrate to validation-aware loading.

## Structured diagnostics

Diagnostics have four stable fields:

```json
{
	"code": "unknown_default_body",
	"severity": "error",
	"message": "Selection references unknown identifier 'example'",
	"path": "workspace.models.standard.settings.default_bodies"
}
```

Codes are machine-readable; messages are explanatory and may become localized.
`error` means an invariant required for reliable computation is broken.
`warning` means fallback or compatibility behavior remains possible.

Current validation covers:

- duplicate and empty body, aspect, sign, chart, subject, preset, layout, and
  annotation identifiers
- model defaults and effective selections referencing unknown catalog items
- unknown orb keys and model-definition overrides
- invalid aspect angles, orbs, and computational constants
- missing body object types and engine capability maps
- malformed, missing, absolute, or path-traversing workspace references
- subject time/location validity
- layout relations referencing unknown charts

`CurrentModelReport.diagnostics` carries catalog, override, effective-setting,
and chart-level diagnostics next to its existing resolution warnings.

## Configuration scopes

Astrological configuration is intentionally layered:

```text
application fallback
  < model defaults
  < workspace defaults
  < chart preset
  < chart overrides
  < operation overrides
```

The highest explicitly supplied value wins. An absent value inherits from the
previous scope.

| Setting                      |    Model     |  Workspace   |  Preset  |    Chart    | Operation |
| ---------------------------- | :----------: | :----------: | :------: | :---------: | :-------: |
| astronomy engine / ephemeris |     yes      |     yes      |   yes    |     yes     |    yes    |
| house system                 |     yes      |     yes      |   yes    |     yes     |    yes    |
| zodiac and ayanamsa          |     yes      |     yes      |   yes    |     yes     |    yes    |
| selected bodies              |     yes      |     yes      |   yes    |     yes     |    yes    |
| selected aspects and orbs    |     yes      |     yes      |   yes    |     yes     |    yes    |
| language, theme, colors      |      no      |     yes      |   yes    |     yes     |    no     |
| subject event time           |      no      |  seed only   | template | owns value  | temporary |
| subject location             |      no      |  seed only   | template | owns value  | temporary |
| model definitions            | owns catalog | may override |    no    | exceptional |    no     |

The current `SettingsLayer` represents sparse preset and operation values.
Chart and workspace persistence retain their existing compatible structures
while the command layer is migrated.

Workspace-backed and standalone/in-memory charts now use the same resolver.
Standalone resolution explicitly omits workspace and preset scopes instead of
constructing a fake manifest. Immediately before computation, the resolved
settings are materialized onto a cloned chart configuration; the persisted or
caller-owned chart remains unchanged.

`ResolvedChart` is the application input shared by radix and transit services.
It owns a computation copy of the chart, the resolved model, effective settings,
provenance-ready warnings, and no workspace path. `ChartComputeRequest` and
`TransitSeriesRequest` add operation inputs. Their corresponding typed
calculation structures are serialized only at the Tauri boundary.

Workspace chart presets are loaded as typed `ChartPreset` items and converted
to a sparse `SettingsLayer`. The existing compute commands accept additive
`presetId` and `settingsOverrides` fields. Both Rust and Python resolve those
fields with the same precedence, and a Python failure may fall back to Rust
without losing the requested layers.

### Inheritance versus explicit emptiness

These states are distinct:

- **absent** — inherit
- **value** — override
- **empty collection** — intentionally select no items, where the scope permits
- **clear** — intentionally remove an optional inherited value

Existing chart YAML historically treats an empty `observable_objects` list as
inheritance. New preset and operation layers treat an explicitly supplied empty
body or aspect list as “select none.” Patch DTOs that need `clear` semantics
must represent it explicitly rather than relying on a plain Rust `Option<T>`.

## Resolution output and provenance

`workspace/settings.rs` produces `EffectiveModelSettings`. It contains usable
values plus `EffectiveSettingsSources`.

Example:

```json
{
	"default_house_system": "Whole Sign",
	"engine": "jpl",
	"default_bodies": ["sun", "moon", "asc"],
	"sources": {
		"default_house_system": "chart",
		"engine": "workspace",
		"default_bodies": "preset",
		"default_aspects": "model",
		"aspect_orbs": {
			"conjunction": "chart",
			"square": "operation"
		},
		"standard_orb": "model",
		"zodiac_type": "chart",
		"ayanamsa": null,
		"time_system": "workspace",
		"computational_constants": "model"
	}
}
```

Provenance is part of the diagnostic contract. It allows the UI, tests, and
Python parity suite to explain a result instead of reverse-engineering the
precedence chain.

## Location and time ownership

`ChartSubject.location` is the event or birth location. Workspace location is a
default used when creating a chart; it does not retroactively change existing
subjects.

Relocated or topocentric computation uses an explicit operation-level observer
location. It must not rewrite the subject location.

Likewise, transit/progression times are operation inputs. They do not mutate the
radix event time unless the caller explicitly saves an updated chart.

Canonical event-time input is RFC 3339 with an explicit offset. Rust and Python
normalize accepted values to UTC and execute the same
`contracts/event-time.json` fixture. Invalid persisted values fail with the
stable `invalid_event_time` category; they never become `None`, the current
time, or another guessed value.

Legacy `YYYY-MM-DD[ HH:MM[:SS]]` values remain readable and are interpreted as
UTC in both implementations. This rule is intentionally deterministic. A local
civil time must include its resolved offset before it enters persistence.
Python additionally validates stored location timezone names against the IANA
database and reports `invalid_timezone` rather than silently substituting UTC.

## Model data versus selections

These concepts must remain separate:

- `BodyDefinition` and `AspectDefinition` describe catalog items.
- Model settings select defaults from that catalog.
- Workspace, preset, chart, and operation layers select different items.
- Orb overrides change effective tolerances without creating a second aspect
  definition.
- Model-definition overrides intentionally modify catalog metadata or rules.

Rust aspect computation and body selection consume the resolved model/settings.
Each `BodyDefinition.computation_map` declares whether an engine supports the
canonical body and, eventually, which engine-specific identifier it uses.
Adapters implement astronomy but do not own a competing astrological catalog.

Selected bodies use this precedence:

```text
operation selection
  > resolved chart observable_objects
  > legacy chart included_points
  > model default_bodies
  > all model body definitions
```

An empty operation list currently inherits the resolved chart selection for
compatibility with the transit command contract. `included_points` is a
deprecated read alias; using it emits
`included_points_deprecated: use observable_objects`. New persisted data should
write only `observable_objects`.

## Persisted and derived data

Workspace YAML is primary. Positions, axes, houses, aspects, lunar details, and
transit series are derived results unless a future storage design explicitly
persists them.

Compatibility storage commands must not report successful writes while
discarding data. Each command must eventually be implemented, return an
explicit unsupported error, or be removed together with its callers.

## Python parity

Python now has the first parity slice for the stable Rust contract:

- canonical built-in model data and model-definition overrides
- structured diagnostics with stable error and warning codes
- application, model, workspace, preset, chart, and operation precedence
- provenance for each effective setting and aspect orb
- explicit-empty body and aspect selections
- model-defined radix and cross-chart transit aspects
- preset and operation inputs on sidecar chart and transit routes
- typed radix and transit calculation structures, including motion and lunar
  details in chart responses
- a strict Python aggregate loader and `/workspace/validate` adapter that retain
  malformed-reference diagnostics
- one shared resolution fixture executed unchanged by Rust and Python

The shared settings fixture compares:

- accepted input and validation behavior
- model/default/override resolution
- selected bodies, aspects, and orbs
- result DTO shape
- warning and provenance fields
- error category
- numerical results using field-specific tolerances

Python may support additional engines or import formats, but it must adapt those
results to the canonical contract. Shared policy such as precedence and default
selection must not evolve independently in Python.

## Migration order

1. Complete canonical workspace, chart, model, and calculation types.
2. Introduce typed compute and transit request/result DTOs.
3. Move orchestration from Tauri commands into compute and transit services.
4. Wire persisted presets and explicit operation overrides into those requests.
5. Add catalog and persisted-aggregate validation with structured diagnostics.
6. Move workspace YAML access behind a repository.
7. Separate geocoding, ephemeris, and sidecar infrastructure services.
8. Replace the permissive event-time parser with a canonical validated time type.
9. Remove or implement compatibility no-ops.
10. Add cross-language fixture and tolerance tests.

### Next iteration

The remaining work is narrower and should not introduce another policy layer:

- extend the shared fixture suite from deterministic settings resolution to
  diagnostics, result structure, warnings, and numerical fields with explicit
  engine-specific tolerances
- migrate callers from the compatibility Python workspace loader to the strict
  aggregate entry point, then remove the permissive loader
- move Python orchestration out of `cli.py` into application services
- decide whether computed DuckDB/Parquet storage is a supported application
  feature, then implement its ownership or remove the compatibility paths
- continue the Rust `domain/` and `infrastructure/` extraction shown above
