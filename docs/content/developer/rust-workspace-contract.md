---
title: 'Rust workspace contract'
description: 'Workspace lifecycle, persistence boundaries, catalog loading, and effective settings.'
weight: 35
doc_kind: contract
status: current
authority: normative
---

This page describes the Rust-owned workspace lifecycle and the contracts visible
to the frontends. Field-by-field YAML examples belong in the [Workspace YAML
contract](../workspace-yaml/); user-facing option semantics belong in the
[Configuration reference](../configuration-reference/).

## Workspace lifecycle

1. Before a workspace is open, each frontend requests
   `get_builtin_domain_catalog` during bootstrap and populates its runtime
   catalog before mounting the application.
2. Opening a workspace reads its `workspace.yaml`, loads referenced entities,
   and exposes workspace summaries through `load_workspace`.
3. The frontend requests the effective catalog and model report for the current
   workspace, and repeats that refresh when the selected chart/model context
   changes.
4. Chart and analysis operations resolve settings from the same Rust resolver
   before computation.
5. Workspace edits validate typed data and write YAML through Rust commands.

`load_workspace_aggregate` is the diagnostics-aware loading path: it attempts
each referenced entity and returns structured diagnostics for malformed or
missing references. A malformed manifest remains a fatal load error.

## Manifest and chart boundaries

`workspace.yaml` is the manifest and index. It owns the workspace identity,
active school/model, model and school catalogs, workspace defaults, model
overrides, presentation choices, tags, and relative references to subjects,
charts, presets, analyses, layouts, annotations, and transit analyses.

A chart file owns one subject snapshot/reference and its chart definition and
calculation overrides. A chart does not own the workspace catalog, and a
workspace default does not retroactively mutate an existing subject or chart.
Subjects store event facts; positions, houses, aspects, lunar details, and
transit series are derived and are not persisted by the Rust workspace layer.

References are resolved relative to the workspace root. Absolute paths and
path traversal are invalid. The manifest schema version defaults to `1` when
omitted and is validated with the rest of the aggregate.

## Schema and invariants

Rust deserializes the manifest and referenced YAML into `workspace::models`.
`workspace::validation` produces stable diagnostics with `code`, `severity`,
`message`, and an optional `path`. Validation covers duplicate/empty IDs,
model and selection references, aspect angles/orbs, provider capability maps,
locations, subject times, and references between workspace entities.

Unknown or unsupported catalog entries do not silently disappear: callers
receive a diagnostic or explicit availability warning. Validation of a valid
catalog is separate from whether the selected provider has the required
ephemeris data.

## Effective settings resolution

Rust resolves one effective settings object for a calculation using this order:

```text
application fallback < model < workspace < chart preset < chart < operation
```

An absent value inherits. Where the scope permits it, an explicitly empty body
or aspect list means “select none.” The resolver returns both usable values and
`EffectiveSettingsSources`, so the application and frontend can explain the
source of a value. Model-definition overrides are applied at their owning
scopes before catalog validation and computation.

The resolved report also carries the selected model, available models, warnings,
and validation diagnostics. The same resolution path is used for workspace
charts and standalone/in-memory charts, with standalone charts omitting
workspace and preset scopes rather than inventing a manifest.

## Catalog loading and frontend ownership

`get_builtin_domain_catalog` returns the built-in Rust catalog. When a workspace
or chart is selected, `get_domain_catalog` resolves the effective model and
returns a `DomainCatalog` containing:

- body and aspect definitions and model defaults;
- signs;
- supported house systems; and
- shape/configuration definitions and generated-variant rules.

React and Svelte load the built-in catalog before application mount, then
refresh it through their model-report/workspace flow. Catalog semantic IDs,
calculation defaults, and provider capability mappings propagate automatically
when Rust exposes them. Frontend adapters derive labels, glyph fallbacks,
colors, and grouping from those entries, while localized strings, dedicated
glyph assets, and bespoke component behavior remain optional frontend
enhancements.

The catalog is not a second persistence format and does not make presentation
metadata part of calculation resolution. See [Domain model](../domain-model/)
for the ownership model and catalog rationale.

## Persistence and sidecar boundary

Rust owns local workspace persistence and the supported no-sidecar execution
path. The desktop app must remain usable when the optional Python sidecar is
unavailable. Backend selection and fallback must remain visible through result
provenance; a provider change must not silently change meaning.

Rust does not reintroduce DuckDB or Parquet persistence for computed data.
Legacy storage commands may remain compatibility no-ops. Native YAML and
StarFisher EventData imports continue through Rust, with derived positions
computed through the normal provider boundary.

See [Backend structure](../backend-structure/) for the persistence
representations, provenance, and implementation ownership behind this contract.
