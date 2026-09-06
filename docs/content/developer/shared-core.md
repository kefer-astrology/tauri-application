---
title: 'Shared astrology core'
description: 'Planned language-neutral contract boundary for Rust and the separately extractable Python sidecar.'
weight: 39
doc_kind: architecture
status: proposed
authority: non-normative
---

The project is moving toward a shared definition of astrology behavior that can
be consumed by the Rust application and a Python sidecar maintained inside or
outside this repository. This page describes that target boundary. Current
runtime behavior remains governed by the existing contracts and code.

## Goal

Rust and Python should not acquire independent meanings for schools, models,
setting precedence, chart time, aspects, or result fields. The shared core must
allow both implementations to prove conformance against the same inputs and
expected outputs.

```text
Versioned shared contracts and fixtures
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
 Rust implementation   Python implementation
       │                   │
       └──── parity suite ──┘
                 │
          Tauri command API
                 │
          frontend consumers
```

## Initial extraction unit

The first shared core does not need to be a cross-language binary library. A
versioned, language-neutral package can establish the boundary first:

```text
contracts/
├── schemas/             # request, result, workspace, and model shapes
├── catalogs/            # canonical IDs and built-in model data
├── fixtures/            # valid and invalid input cases
├── golden-results/      # exact semantic expectations
└── tolerances/          # numerical comparison policy by provider and field
```

The existing `contracts/event-time.json`,
`contracts/settings-resolution.json`, and `contracts/workspace-v1/` fixtures
are the beginning of this package.

## What belongs in the shared core

- Canonical identifiers and normalization rules.
- School/model structure and validation.
- Settings and model-override precedence.
- Aspect definitions, detection, and orb policy.
- Backend-neutral house-system semantics.
- Chart datetime normalization rules.
- Backend-neutral request, result, diagnostic, and provenance shapes.
- Golden fixtures and numerical tolerances.

## What remains adapter-specific

- Tauri commands and desktop lifecycle.
- Python process startup and transport.
- HTTP geocoding clients.
- BSP discovery, download, and cache paths.
- Swiss, JPL/SPICE, or other ephemeris API calls.
- React and Svelte state and rendering.

An adapter may expose additional provider data, but shared result fields retain
the same meaning everywhere.

## Possible implementation forms

After the contracts and parity suite are stable, implementation sharing can be
chosen independently:

1. Keep Rust and Python implementations separate but fixture-conformant.
2. Extract a Rust core crate and expose it to Python through a binding.
3. Generate types and validators in both languages from shared schemas.

This decision should be based on packaging, deployment, and debugging costs.
It must not change frontend-facing contracts.

## Migration sequence

1. Inventory semantics currently duplicated in Rust and Python.
2. Give each semantic rule one contract fixture and stable test ID.
3. Make both implementations consume the same fixtures.
4. Move built-in catalogs out of implementation-local constants where practical.
5. Establish parity thresholds for astronomical numerical results.
6. Choose whether executable code sharing provides enough benefit over
   schema-and-fixture conformance.
7. Extract the Python sidecar without moving the shared contracts out of an
   independently versioned, accessible package.

## Compatibility rule

Extraction must preserve:

- workspace schema versions and round trips
- frontend command request and result shapes
- model/settings resolution and provenance
- no-sidecar Rust operation
- clear failure when a forced provider is unavailable

See [Testing strategy](../testing-strategy/) for the parity and fixture model.
