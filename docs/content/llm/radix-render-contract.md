---
title: "Radix render contract"
weight: 43
---

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
- `shapes`
- `configurations`

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

### `shapes` and `configurations`

- `shapes`: array of distribution-shape ids (`bundle`, `bowl`, `bowl_east`, `bowl_west`, `bowl_day`, `bowl_night`, `bucket`, `bucket_<planet>`, `locomotive`, `locomotive_leader_<planet>`, `seesaw`, `splash`, `splay`, `shifted_center`, `stellium`), derived from the 10 classical bodies (Sun through Pluto) and, for the bowl sub-variants, `house_cusps`.
- `configurations`: array of aspect-pattern ids (`t_square`, `t_square_<modality>`, `grand_trine`, `grand_trine_<element>`, `grand_cross`, `grand_cross_<modality>`, `kite`, `kite_<element>`, `mystic_rectangle`, `double_quincunx`, `double_biquintile`, `hexagram`, `pentagram`), derived from the same 10 bodies and the computed `aspects`.
- Computed once in Rust (`detect_chart_shapes`/`detect_chart_configurations` in `astrology.rs`) and shared by every compute route — including the Python route, which gets them injected from its own `positions`/`house_cusps`/`aspects` response fields — so frontends never need to re-derive them.
- `shapes` requires at least 7 of the 10 classical bodies present in `positions`; otherwise it is empty. `configurations` has no such minimum — it simply finds no matching pattern among however many of the 10 are present.

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
