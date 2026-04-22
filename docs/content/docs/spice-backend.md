---
title: "SPICE backend"
description: "JPL/SPICE backend architecture, licensing rationale, and anise assessment target."
weight: 41
---

# SPICE backend

This page describes the current **JPL / SPICE** backend architecture in Kefer, why it exists, and what remains before the migration is fully closed.

For the shortest in-repo status snapshot, use **[MIGRATION.md](MIGRATION.md)**.

## Why this direction is required — licensing

Swiss Ephemeris (libswe / Kerykeion) is dual-licensed: **AGPL** or a paid commercial license from Astrodienst.
The AGPL obligation is incurred at **compilation time**: as long as libswe is linked into the Rust binary, or Kerykeion is imported in Python, the entire application is under AGPL.

The JPL-centered path removes this dependency from the default Rust build:

| Path | Library | License | File |
|------|---------|---------|------|
| Python sidecar | Skyfield | MIT | `de421.bsp` (public domain) |
| Rust standalone | `anise` | MPL-2.0 | `de421.bsp` (public domain) |

Both paths share the same `de421.bsp` SPICE kernel file already present at `backend-python/source/de421.bsp`.

## Purpose

The JPL backend should become the canonical astronomy layer for long-term Kefer architecture.

Its job is to provide:

- precise astronomy primitives
- backend-neutral output
- explicit kernel and provenance metadata

It should **not** own astrology semantics such as zodiac assignment, house interpretation, aspect policy, or tradition rules.

## Boundary

SPICE belongs in the **astronomy backend layer**.

That means it should answer questions like:

- where is body `X` at moment `T`
- what are the observer-relative axes for moment `T` and observer `O`
- what are the house cusps for the requested system
- what astronomy metadata is available for this result

It should not answer:

- what sign a point belongs to
- how houses should be interpreted in a tradition
- which aspects count and which orb policy applies
- how Vedic vs Western defaults differ

## Ephemeris file format

The Python and Rust paths both target the **SPICE BSP (SPK) format** — `.bsp` files such as `de421.bsp`.

This is distinct from the old-format JPL binary files (`.eph`) used by Swiss Ephemeris's `swejpl.c` mode (`SEFLG_JPLEPH`).
The existing `JplViaSwissAstronomyBackend` in Rust uses the `.eph` format via libswe — it is a transitional step that proves backend selection works, but it does **not** use `de421.bsp` and does **not** remove the AGPL dependency.

## Rust candidate: `anise`

[`anise`](https://github.com/nyx-space/anise) (nyx-space) is a pure Rust astrodynamics library that reads SPICE BSP files directly — no C library linking, no CSPICE dependency.

**Assessment result: viable and now implemented in the Rust backend.**

| Property | Result |
|----------|--------|
| License | **MPL-2.0** — file-level copyleft only; using it as a dependency does not affect application code |
| Version | 0.9.0, actively maintained |
| C deps | None — pure Rust, cross-platform |
| Maturity | NASA TRL 9; used operationally on the Firefly Blue Ghost lunar lander |
| BSP support | ✅ reads `de421.bsp` natively; DE421 covers 1899–2053 |
| Bodies | ✅ Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto |
| Output | ICRF/J2000 state vectors; frame transforms available |
| Precision | Sub-arcsecond; validated against 100k+ queries on DE440 at machine precision |

**Gaps to implement above the backend:**

- **Ecliptic longitude**: `anise` returns ICRF/J2000 vectors. A rotation by the obliquity of the ecliptic converts them to ecliptic coordinates. This is standard math, implementable in pure Rust.
- **Lunar nodes**: Not in DE421. True Node and Mean Node must be computed analytically from the Moon's orbital elements.
- **Chiron**: Asteroid, not in DE421. Needs a separate SPK file or skip for now.
- **House cusps**: `anise` does not compute astrological house systems. A `houses.rs` layer will compute these from RAMC + obliquity — belongs in the astrology layer anyway.
- **Ayanamsha**: Needs own implementation above the backend.

These are all manageable. The core planetary positions and precision are solid.

**Target Rust module layout once `anise` is integrated:**

```text
src-tauri/src/
  astronomy.rs              # AstronomyBackend trait + backend_for_chart()
  jpl_backend.rs          # JplAstronomyBackend — reads de421.bsp, MPL-2.0, no AGPL
  houses.rs                 # pure-Rust house cusp calculations (Placidus, Whole Sign, etc.)
  swisseph.rs               # gated behind "swisseph" Cargo feature flag (AGPL)
```

## Python module layout

Target Python layout:

```text
backend-python/module/
  astronomy.py             # shared backend protocol / selection
  spice/
    __init__.py
    kernels.py             # kernel loading and source resolution
    time.py                # UTC/TT/TDB normalization
    frames.py              # frame transforms
    observer.py            # topocentric helpers
    bodies.py              # body queries and mappings
    houses.py              # house cusp integration
```

The Python and Rust seams should be conceptually equivalent even if the implementations differ.

## Core interface

The backend interface should stay small.

Conceptual shape:

```python
class EphemerisBackend(Protocol):
    def backend_id(self) -> str: ...
    def ephemeris_source(self, chart) -> str | None: ...
    def body_state(self, body, moment, observer, frame) -> BodyState: ...
    def axes(self, moment, observer, house_system) -> Axes: ...
    def house_cusps(self, moment, observer, house_system) -> HouseCusps: ...
    def ayanamsha(self, moment, mode) -> float | None: ...
```

Kefer does not need to expose raw SPICE details everywhere in the app.
It needs a stable backend-neutral astronomy contract.

## Kernel strategy

The SPICE backend should load kernels explicitly and surface their source in provenance.

Expected kernel categories:

- planetary ephemeris kernels
- leap second kernels
- time conversion support kernels as needed
- frame or orientation kernels if required by chosen calculations

Rules:

- kernel resolution should be deterministic
- provenance should include enough information to identify the active kernel set
- app flows should not silently switch kernel sources

## Time handling

SPICE work should sit on top of one canonical time model.

Rules:

- parse input timestamps once
- preserve offset-aware instants exactly
- convert into the required SPICE time scale in one dedicated layer
- do not mix astrology-localization rules into astronomy time conversion

## Frames and transforms

SPICE should return astronomy primitives in clearly documented frames.

That means the backend should make explicit:

- which frame the body state came from
- where precession/nutation choices are handled
- where geocentric vs topocentric differences are applied

Transform policy should live in one place, not be reimplemented per feature.

## Houses and axes

The backend should provide:

- observer-relative angles
- valid `house_cusps` for supported systems

If a requested house system is unsupported or reduced-fidelity:

- the response should remain honest
- provenance or warnings should say so
- the frontend must not invent geometry silently

## Provenance

Every SPICE result should be able to surface:

- `backend_used`
- `ephemeris_source`
- active kernel source or identifier
- `warnings`

When fallback occurs:

- `fallback_used` must be true
- the warning should say why

## Relationship to astrology layers

SPICE should feed:

- coordinate / projection transforms
- zodiac projection
- house interpretation
- aspect computation
- tradition-specific rule engines

Those higher layers remain Kefer-owned logic.

## Implementation status

1. ~~assess `anise`~~ ✅ — viable; see assessment above
2. ~~implement `JplAstronomyBackend` in `src-tauri/src/jpl_backend.rs` behind the `AstronomyBackend` trait~~ ✅
3. ~~implement `src-tauri/src/houses.rs` — pure-Rust Whole Sign and Placidus house cusp calculations driven by RAMC + obliquity~~ ✅
4. ~~implement ecliptic longitude transform (ICRF → ecliptic via obliquity rotation)~~ ✅
5. ~~implement Mean Node analytically~~ ✅ (True Node pending — see note below)
6. ~~gate `swisseph.rs` and `build.rs` Swiss compilation behind a `swisseph` Cargo feature flag~~ ✅
   - Feature: `swisseph` (off by default)
   - `cargo check --no-default-features` → license-clean build compiles in ~3 s, zero new warnings
   - `cargo check --features swisseph` → full build with libswe compiles cleanly
7. validate `anise` output against Swiss output at the astronomy layer
8. make the `swisseph` feature default `off` in any CI / release workflow configs

**True Node**: Not yet implemented. `mean_node_lon()` in `houses.rs` computes the Mean North Node. True Node would require iterative convergence on Moon–ecliptic intersection — deferred.

## Current status

### Rust

[src-tauri/src/astronomy.rs](src-tauri/src/astronomy.rs):

- `AstronomyBackend` trait: `backend_id()`, `ephemeris_source()`, `compute_chart_data()`
- `SwissAstronomyBackend` — uses libswe, **AGPL; gated behind `swisseph` feature**
- `JplViaSwissAstronomyBackend` — uses libswe via `swejpl.c` + `SEFLG_JPLEPH`; **AGPL; gated behind `swisseph` feature**
- `JplAstronomyBackend` ✅ — reads `de421.bsp` via `anise` 0.9.6, **MPL-2.0, always available**
- `backend_for_chart(chart)` — prefers `JplAstronomyBackend` when BSP is resolvable; falls back to Swiss only when `swisseph` feature is enabled
- `houses.rs` ✅ — pure-Rust obliquity, GMST, ASC/MC, Whole Sign + Placidus cusps, Mean Node, ICRF→ecliptic
- `build.rs` ✅ — only compiles libswe when `CARGO_FEATURE_SWISSEPH` is set

### Python

[backend-python/module/astronomy.py](backend-python/module/astronomy.py):

- `AstronomyBackend` Protocol + `ChartData` dataclass
- `SwissAstronomyBackend` — wraps Kerykeion/Swiss path, **AGPL active**
- `JplAstronomyBackend` — wraps Skyfield + `de421.bsp`, ✅ **MIT + public domain**
- `backend_for_chart()` — selects based on `chart.config.engine`
- `compute_chart_data()` implemented on both backends
- Python JPL now computes `axes` and `house_cusps`
- `services.py` now routes chart computation through the structured chart-data seam
- `cli.py` chart compute now consumes `ChartData` directly

### Seam alignment

- Rust: `compute_chart_data()` → `AstronomyChartData { positions, axes, house_cusps }`
- Python: `compute_chart_data()` → `ChartData { positions, axes, house_cusps }` ✅ aligned

### Remaining gaps

- `True Node` is still pending
- `Chiron` is still pending for the `de421.bsp` path
- a real no-Swiss full-chart smoke/integration run should still be treated as the final closeout step

### References

- [MIGRATION.md](MIGRATION.md)
- [docs/content/docs/architecture.md](docs/content/docs/architecture.md)
- [src-tauri/src/astronomy.rs](src-tauri/src/astronomy.rs)
- [backend-python/module/astronomy.py](backend-python/module/astronomy.py)
