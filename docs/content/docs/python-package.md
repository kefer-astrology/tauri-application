---
title: "Python package"
description: "Reference for the optional Python backend package and its role in the current architecture."
weight: 50
---

# Python package

The Python package is an optional computation backend used by the Tauri app.

It should be treated as:

- a compatibility path
- a backend-specific integration surface
- a validation path while backend-neutral Rust layers mature

It should not be treated as the sole owner of astrology semantics.

## Current role

- Tauri can route chart and transit computation to Python
- Python remains optional rather than foundational
- backend provenance should make Python-vs-Rust routing visible to callers

## Current implemented seams

Implemented or effectively present today:

- `compute_positions_for_chart(...)`
- `compute_chart_data_for_chart(...)`
- `compute_aspects_for_chart(...)`
- Python transit-series responses with provenance-oriented metadata
- JPL-backed Python chart data with `positions`, `axes`, `house_cusps`, and `warnings`

## Contract expectations

Python-backed chart responses should align with the shared frontend/backend expectations:

- stable chart identity
- normalized `positions`
- `axes` when available
- `house_cusps` when available
- `warnings`
- provenance fields such as `backend_used`, `fallback_used`, and `ephemeris_source`

## Data-shape notes

- non-JPL paths may still be simpler
- JPL-backed paths should expose richer astronomy fields when available
- datetime handling must preserve the represented instant for offset-aware inputs
- outputs must stay JSON-serializable for Tauri transport

## Runtime integration rules

- Python communicates with Tauri through structured JSON
- frontend code should never talk to Python directly
- the Python path should not be allowed to silently redefine frontend-facing contracts independently of Rust

## Current limitations

- Rust storage compatibility commands are still no-op and do not persist computed data coming from Python
- some seam validation is still incomplete
- `/function-wrapper/module/` may still need mirroring if it remains authoritative in parallel
- revolution computation is still not implemented
- end-to-end confidence still depends on a provisioned Python environment

## Design rule

Keep astrology semantics portable. Python may implement backend-specific details, but chart semantics such as zodiac policy, house interpretation, aspect defaults, and tradition behavior should not become Python-only knowledge.

## Related docs

- [architecture](../architecture/) — app-level routing and backend boundaries
- [spice-backend](../spice-backend/) — JPL/SPICE backend boundary
- [tauri-command-contracts](../tauri-command-contracts/) — frontend-visible command contract
