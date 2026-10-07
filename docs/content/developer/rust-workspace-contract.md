---
title: 'Rust workspace contract'
description: 'Current workspace lifecycle, loading paths, settings, and catalog behavior.'
weight: 35
doc_kind: contract
status: current
authority: normative
---

## Lifecycle and loading paths

`create_workspace` creates the directory plus `charts/`, `transits/`, and an
empty `workspace.yaml`; it refuses an existing manifest. `save_workspace`
writes supplied chart JSON as `charts/<sanitized-id>.yml`, preserves an
existing manifest's other represented fields, and updates its chart references
and optional defaults. `delete_workspace` recursively removes the supplied
directory. These commands currently perform filesystem work directly.

`load_workspace` is the shell's tolerant summary path: it requires a parseable
manifest, then skips bad chart/analysis references after logging. It returns
only successfully loaded summaries, not diagnostics. `validate_workspace`
uses `load_workspace_aggregate`: it loads subjects, charts, presets, analyses,
transit analyses, layouts, and annotations independently and returns structured
diagnostics for bad references while retaining other items. A missing or
malformed manifest is fatal in either path.

References must be relative. The loader rejects absolute paths and checks the
canonical target remains beneath the canonical workspace root; missing targets
are reported as load failures. Chart-by-ID lookup also skips malformed chart
references, so an operation reports the requested chart as absent if no valid
matching chart can be loaded.

## Manifest, charts, and derived data

`workspace.yaml` indexes workspace identity, active school/model, model and
school definitions, defaults, presentation/tag data, and references. A chart
file holds its subject, chart configuration, tags, colors, and Rodden rating.
Transit setup files persist transit form intent. Computed positions, motion,
houses, aspects, shapes/configurations, lunar details, and transit results are
derived response data and are not written by the Rust workspace layer.

Manifest and referenced data deserialize into `workspace::models`; validation
emits diagnostics with code, severity, message, and optional path. Validation
does not make ephemeris availability true: provider/kernel availability remains
a computation-time concern.

## Settings and model resolution

For a workspace calculation, `current_model_report_with_layers` applies sparse
settings in this implemented order:

```text
application baseline < resolved model < workspace < preset < chart < operation
```

The resolver returns usable settings and `EffectiveSettingsSources`, including
per-aspect-orb provenance. Model overrides are merged at workspace, preset,
chart, then operation scope before effective settings are calculated. Not every
field exists at every layer; only fields represented by the Rust types can
participate. In particular, chart `zodiac_type` is a concrete `ChartConfig`
value and is applied whenever a chart config is present. Standalone calculation
uses the same resolver without manifest/preset layers.

An optional vector in a preset/chart/operation layer replaces the inherited
body/aspect selection; `[]` consequently means select none there. Workspace
defaults have legacy special handling for bodies: an empty `default_bodies`
does not replace the model selection, while non-empty `manifest.bodies` does.
Use the source report rather than inferring provenance from a YAML field.

## Catalog propagation

`get_builtin_domain_catalog` is called before both frontend shells mount.
Their workspace-open paths call `get_current_model_report` and
`get_domain_catalog` without a chart ID, replacing the in-memory catalog. The
Rust command can resolve a chart-specific catalog when called with `chart_id`,
but neither shell currently calls it on chart selection. A selected chart's
calculation still resolves its own model; UI catalog propagation is therefore
incomplete for chart-specific models.

## Optional Python and compatibility storage

The Python sidecar is optional. Auto routing uses it when available and uses
Rust for supported work when absent; forced/required Python paths fail clearly.
`store_positions` and `store_relation` are compatibility no-ops, not a result
cache or persistence API.
