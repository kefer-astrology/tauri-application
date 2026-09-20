---
title: 'Domain model and extensibility'
description: 'Canonical concepts and extension boundaries for supporting multiple astrology schools.'
weight: 38
doc_kind: architecture
status: current
authority: normative
---

This page defines the concepts that must remain stable across persistence,
calculation backends, and frontend implementations. It does not define their
serialized fields; those belong to the
[Workspace YAML contract](../workspace-yaml/).

## Core model

```text
Subject / event facts
        │
        ▼
Chart ──selects──> Astrology model ──classified by──> School
  │                    │
  │                    ├── point and body definitions
  │                    ├── aspect definitions and orb policy
  │                    ├── zodiac and ayanamsha policy
  │                    └── house and calculation defaults
  │
  ├── selects an astronomy provider through resolved settings
  └── produces a backend-neutral calculation result
```

### Subject

A subject records source facts about a person, event, or other chart subject:
identity, event time, and location. Those facts are not an astrological
interpretation and should be reusable by multiple charts.

### Chart

A chart applies one model and a set of scoped overrides to subject facts. Two
charts may therefore interpret the same subject using different schools,
models, house systems, or research assumptions.

### School

A school is an extensible string identifier that classifies models and may
select a default model. It is not a closed application enum. School lineage is
metadata and does not implicitly copy calculation settings.

### Astrology model

A model is the versioned, executable definition of astrological semantics. It
owns available points, aspects, default orbs, zodiac policy, calculation
defaults, and other rules whose meaning must be the same regardless of the
astronomy provider.

### Astronomy provider

An astronomy provider supplies astronomical measurements such as positions,
motion, axes, and house cusps. Rust JPL/SPICE, Swiss Ephemeris, or a Python
integration may implement this boundary. A provider must not silently redefine
the selected astrology model.

### Calculation service

The calculation service resolves the model and all setting scopes, requests
astronomical data, applies backend-neutral astrological rules, and produces a
frontend-facing result with provenance.

### Frontend

A frontend edits domain inputs and renders contract results. React and Svelte
may use different framework structures, but neither frontend owns astrological
rules or reimplements backend calculations.

## Configuration scopes

Calculation settings follow the single precedence defined by the workspace
contract:

```text
application fallback < model < workspace < chart preset < chart < operation
```

An absent value inherits. Explicit emptiness is meaningful only where the
relevant contract defines it. Every resolved value should be explainable by
reporting the scope that supplied it.

## Extension points

An extension is complete only when its contract, implementation, and tests are
updated together.

| Extension | Canonical change | Required verification |
| --- | --- | --- |
| School | Add an ID and default-model relationship | Resolution and unknown-reference tests |
| Model | Add a versioned model definition | Schema, resolution, and round-trip tests |
| Body or calculated point | Add a definition and provider capability mapping | Selection, availability, and numerical tests |
| Aspect | Add angle, orb, enabled state, and valid contexts | Detection boundary and override tests |
| House system | Add a canonical ID and computation support | Normal and high-latitude cases |
| Astronomy provider | Implement the provider input/result boundary | Contract, provenance, failure, and parity tests |
| Calculation type | Define request, result, persistence intent, and errors | Unit, command, parity, and workflow tests |
| Frontend consumer | Consume existing command contracts | Bridge and user-workflow tests in both shells |

Adding a school or model must not require changing a closed frontend switch.
Frontends should render backend-provided catalogs and capability status where
the contract supplies them.

## Ownership rules

- Subject facts and portable chart intent belong to the workspace contract.
- Astrological semantics belong to the model and shared astrology core.
- Ephemeris access and external processes belong to infrastructure adapters.
- Backend selection belongs behind the Tauri/application boundary.
- Presentation belongs to the frontend and `workspace.yaml:presentation`.
- Computed results are derived data unless a future contract explicitly makes
  them persistent.

## Related contracts

- [Workspace YAML contract](../workspace-yaml/) — serialized schools, models, charts, and overrides.
- [Backend structure](../backend-structure/) — current implementation ownership.
- [Shared astrology core](../shared-core/) — cross-language extraction direction.
- [Tauri command contracts](../tauri-command-contracts/) — frontend-visible API.
- [Testing strategy](../testing-strategy/) — required verification layers.
