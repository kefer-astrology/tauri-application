---
title: "Radix render contract"
weight: 43
---

# Radix render contract

This page defines the current compute output contract for rendering a radix view without mock data.

## Goal

The frontend radix view should render from computed chart output, not from hardcoded fallback wheels, demo positions, or hand-authored house values.

## Current contract

`compute_chart` and `compute_chart_from_data` should expose:

- `chart_id`
- `positions`
- `aspects`
- `axes`
- `house_cusps`

## Field meanings

### `positions`

- Map of computed body/object ids to longitudes in degrees.
- Used for planets and any other computed objects that are currently supported.

### `axes`

- Object with:
  - `asc`
  - `desc`
  - `mc`
  - `ic`
- These values should always be available for supported Rust radix computation.

### `house_cusps`

- Array of 12 longitudes in degrees.
- Ordered from house 1 through house 12.

## Support rule

House support must follow two rules:

- the compute response must be honest about what was actually computed
- the frontend must render the returned geometry rather than inventing its own fallback wheel

When house-system support differs by backend or implementation maturity:

- the response should still return `house_cusps` when it has a valid computed result
- provenance or warnings should indicate if a fallback or reduced-fidelity path was used
- the frontend should prefer truthfully computed output over inferred placeholder geometry

## Frontend rule

- React and Svelte should prefer `axes` and `house_cusps` from compute output over hand-authored fallback values.
- If those fields are absent, the frontend may show an explicit empty or partial state, but should not silently substitute mock horoscope geometry.
- If compute responses include provenance or warnings, the frontend should preserve enough of that context for debugging and user trust.

## Backlog

- normalized house-system support across backends
- richer computed points beyond the current baseline
- stronger normalized render payloads if the frontend needs more than longitudes
