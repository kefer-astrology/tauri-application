---
title: 'Backend structure and data ownership'
description: 'Persistence representations, configuration resolution, and provenance boundaries.'
weight: 42
doc_kind: architecture
status: current
authority: informative
---

This page explains how the Rust backend represents and resolves workspace data.
It does not duplicate the canonical domain concepts in [Domain model](../domain-model/)
or the module-by-module map in [Rust code structure](../rust-code-structure/).

## Ownership

Rust is the source of truth for persisted workspace semantics, model catalogs,
effective settings, validation, and provenance. The application layer consumes
those values to orchestrate computation; infrastructure performs YAML, provider,
ephemeris, geocoding, and sidecar I/O; Tauri commands expose typed transport.

Python is an implementation peer for supported computation paths. It conforms
to the persisted formats, resolved settings, result DTOs, and error behavior; it
does not define a competing catalog or precedence chain.

## Persistence representations

`WorkspaceManifest` is the persisted `workspace.yaml` index. It contains
identity, active school/model, model definitions and overrides, workspace
defaults, presentation, tags, and relative references to workspace entities.
It is a persistence representation, not the fully loaded domain aggregate.

Referenced subjects, charts, presets, analyses, layouts, annotations, and
transit setups are deserialized by `workspace::loader`. `LoadedWorkspace` is
the typed aggregate plus diagnostics. `WorkspaceInfo` is a smaller command
projection for list/open screens and must not be mistaken for the complete
aggregate.

The loader resolves references beneath the workspace root. Validation reports
stable diagnostic codes and paths; malformed referenced items are reported
instead of silently disappearing on the diagnostics-aware path. `writer` owns
the corresponding YAML writes. Computed positions, houses, aspects, lunar
details, and transit series remain derived data rather than a Rust persistence
store.

## Configuration resolution

`workspace::settings` selects a model and applies sparse layers in this order:

```text
application fallback < model < workspace < preset < chart < operation
```

It returns `EffectiveModelSettings` and `EffectiveSettingsSources`. The first
contains usable calculation values; the second records which layer supplied
each value, including per-aspect orb sources. Absent values inherit. Explicitly
empty body/aspect selections at supported preset, chart, or operation scopes
mean select none. Presentation is not part of calculation resolution.

Model-definition overrides are merged at their scope, then validated against
the resolved model. The same resolver supports workspace-backed and standalone
charts; standalone computation simply omits workspace and preset scopes.

## Catalog and derived representations

`workspace::model_catalog` constructs built-in model data. The workspace module
projects the resolved model into `DomainCatalog`, which also includes supported
house systems, shapes, configurations, and generated-variant rules. This is
the runtime contract used by both frontends; presentation assets remain outside
the backend catalog. See the [Rust workspace contract](../rust-workspace-contract/)
for lifecycle details.

Calculation services receive resolved, backend-neutral inputs. Provider adapters
receive validated canonical body IDs and return typed astronomy data. Domain
rules consume that data to produce backend-neutral results. A provider may
report unavailable capabilities, but it must not silently substitute a
different astrological model.

## Diagnostics and provenance

Diagnostics distinguish invalid persisted/configured data from provider
availability and fallback warnings. A current model report carries the
resolved model, available models, effective settings, setting sources, warnings,
and validation diagnostics.

Provider/backend selection and fallback are visible in computation provenance.
This lets the frontend and parity tests explain both what was computed and why
that backend or setting was selected.

## Related pages

- [Rust workspace contract](../rust-workspace-contract/) — lifecycle, schema,
  catalog refresh, and no-sidecar behavior.
- [Configuration reference](../configuration-reference/) — actual options and
  user-visible semantics.
- [Workspace YAML contract](../workspace-yaml/) — serialized fields and examples.
- [Rust code structure](../rust-code-structure/) — current source map.
