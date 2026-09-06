---
title: 'Architecture'
description: 'Cross-layer boundaries for the desktop app, shared astrology semantics, and computation providers.'
weight: 40
doc_kind: architecture
status: current
authority: informative
---

Kefer Astrology separates portable astrological meaning from desktop transport,
external mechanisms, and frontend rendering.

## System at a glance

```text
React / Svelte
      │ backend-neutral requests and results
      ▼
Tauri commands
      │ thin transport adapters (target)
      ▼
Application services ───────> workspace/settings resolution
      │
      ├── shared astrology semantics
      │
      └── astronomy provider port
                ├── Rust JPL/SPICE
                ├── Swiss compatibility path
                └── optional Python sidecar

Infrastructure: workspace YAML, ephemerides, geocoding, dialogs, sidecar process
```

The [Domain model](../domain-model/) defines schools, models, charts, providers,
and extension points. The [Shared astrology core](../shared-core/) describes the
planned cross-language contract boundary.

## Layer responsibilities

### Frontends

- Edit workspace, chart, and operation intent.
- Invoke Tauri through typed bridge modules.
- Render calculation results and provenance.
- Own presentation and device-local interaction state.
- Never reimplement astrological calculations or infer provider behavior.

React and Svelte share the [Frontend workflow baseline](../frontend-workflow-baseline/)
and [UI conventions](../ui-conventions/). Their framework-specific structures
are documented separately in the [React](../frontend-react/) and
[Svelte](../frontend-svelte/) references.

### Commands

- Deserialize frontend DTOs and obtain managed Tauri state.
- Call one application use case.
- Serialize success or map failure into the command contract.

Commands should not own filesystem formats, HTTP clients, platform processes,
astrology rules, or provider-routing policy. The current code has not completed
this extraction; see the [Rust code structure audit](../rust-code-structure/).

### Application services

- Load the inputs required by a use case.
- Resolve model, workspace, preset, chart, and operation settings.
- Select and invoke computation providers.
- Apply fallback policy without losing the resolved request.
- Return typed results, diagnostics, and provenance.

### Domain and shared core

- Define valid subjects, charts, schools, models, aspects, and calculation intent.
- Own backend-neutral astrological rules and invariants.
- Remain independent of Tauri, YAML, HTTP, frontend frameworks, and a particular ephemeris API.

### Infrastructure

- Read and write workspace YAML.
- Access ephemerides and provider libraries.
- Resolve locations through external services.
- Open native dialogs.
- Start and communicate with the optional Python process.

Infrastructure implements ports required by application services; it does not
choose astrological meaning.

## Persistence boundary

Workspace YAML is the portable source of truth for subjects, chart intent,
schools/models, layered defaults, presentation, and persisted transit intent.
Exact formats and precedence live only in the
[Workspace YAML contract](../workspace-yaml/).

Positions, houses, aspects, configurations, lunar details, and transit series
are derived results. They are recomputed unless a future storage contract
explicitly defines cache or persistence behavior.

## Computation boundary

The frontend sees one command contract regardless of provider. A calculation
request resolves into:

- subject time and location
- selected school and model
- effective settings and their sources
- provider/engine selection
- optional operation-level overrides

The result exposes backend-neutral fields plus additive provider data,
diagnostics, and provenance. Exact command inputs and outputs live in the
[Tauri command contracts](../tauri-command-contracts/); radix and transit result
requirements live in their feature contracts.

## Runtime flows

### Chart calculation

```text
Frontend → Tauri command → resolve chart/model/settings
         → select provider → compute astronomy → apply astrology rules
         → normalize typed result/provenance → frontend
```

### Transit calculation

```text
Frontend → Tauri command → load source chart and transit intent
         → resolve settings → compute interval through selected provider
         → detect model-defined relations → frontend
```

### Workspace update

```text
Frontend → Tauri command → application use case
         → validate typed aggregate → workspace YAML repository
```

## Architectural rules

1. Schools and models are extensible data, not frontend or provider enums.
2. Astrology semantics do not belong to an astronomy adapter.
3. Frontend contracts remain stable when the selected provider changes.
4. Rust-supported flows remain usable without the Python sidecar.
5. Provider selection and fallback are visible through provenance.
6. One settings resolver determines effective calculation behavior.
7. Presentation cannot affect astronomical or astrological computation.
8. Shared behavior is verified through versioned fixtures and parity tests.

## Current implementation

- Typed Rust radix and transit application services are active.
- Workspace models, loading, validation, and settings resolution have dedicated modules.
- Rust and Python share initial time, settings, and workspace fixtures.
- The primary command module still owns several application and infrastructure
  responsibilities that are targeted for extraction.
- Computed-data storage commands remain compatibility shims rather than a
  persistence layer.

Use [Backend structure](../backend-structure/) for the target source boundaries,
[Rust code structure audit](../rust-code-structure/) for the current mismatch,
and [Development roadmap](../development-driver/) for unfinished work.
