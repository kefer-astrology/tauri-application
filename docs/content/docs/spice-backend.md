---
title: "SPICE backend"
description: "JPL/SPICE backend contract, implementation boundary, and current status."
weight: 41
---

# SPICE backend

This page defines the role of the **JPL / SPICE backend** in Kefer.

It is intentionally narrower than [architecture](../architecture/): this page is about the astronomy backend layer itself, not the whole app.

For BSP catalog, download, overlap, cache, and kernel-file lifecycle details, see [ephemeris-manager](../ephemeris-manager/).

## Why it exists

Kefer needs an astronomy backend that is:

- backend-pluggable
- precise enough for modern chart and transit work
- able to expose provenance cleanly
- not tied by default to Swiss Ephemeris licensing

Swiss Ephemeris (libswe / Kerykeion) is dual-licensed: AGPL or paid commercial. A JPL/SPICE path lets the default Rust runtime move toward a license-clean astronomy layer.

## Backend boundary

The SPICE backend belongs to the **astronomy layer**.

It should answer questions like:

- where is body `X` at moment `T`
- what are the observer-relative axes for moment `T`
- what are the house cusps for the requested system
- what kernel/provenance metadata applies to this result

It should not own:

- zodiac interpretation
- aspect policy or orb rules
- house interpretation in a tradition
- Vedic vs Western semantic defaults

## File format boundary

The Rust and Python JPL paths target **SPICE BSP/SPK** planetary kernels such as `de440s.bsp` and `de440.bsp`, with optional **additional SPK files** chained in the same almanac for asteroids and other small bodies. On Rust, `EphemerisManager` resolves and appends NAIF asteroid BSPs when present (including bundled `ceres_1900_2100.bsp` and optional catalog downloads such as `codes_300ast`).

That is distinct from Swiss Ephemeris JPL support through old-format `.eph` files in `swejpl.c` mode. `JplViaSwissAstronomyBackend` is still Swiss-backed and does not replace the SPICE/BSP path.

## Rust implementation

Rust uses [`anise`](https://github.com/nyx-space/anise) to read BSP files directly.

Current Rust module split:

```text
src-tauri/src/
  astronomy.rs         # AstronomyBackend trait + backend selection
  jpl_backend.rs       # JplAstronomyBackend using anise
  ephemeris_manager.rs # BSP catalog, download, cache, multi-file almanac
  houses.rs            # obliquity, axes, cusps, node helpers, transforms
  swisseph.rs          # Swiss-backed compatibility path, feature-gated
```

What the Rust SPICE backend currently provides:

- body position queries from loaded BSP kernels
- axes and house cusp support through the Rust astronomy layer
- explicit `backend_used` / `ephemeris_source` style provenance
- multi-file kernel loading via `EphemerisManager`

What still sits above or beside it:

- astrology-layer interpretation
- some house-system fallback policy
- asteroid availability for bodies **not** included in any loaded kernel (e.g. Chiron, TNOs, or minor planets absent from your SPK set)

## Python implementation

Python keeps a parallel JPL path through Skyfield-backed BSP usage.

That path should stay aligned with Rust at the contract level:

- same backend intent
- same general provenance fields
- same chart-data shape where practical

The Python path is still optional runtime infrastructure, not the defining architecture.

## Contract shape

The SPICE backend should expose a small backend-neutral astronomy contract.

Representative backend responsibilities:

- `backend_id()`
- `ephemeris_source(...)`
- body-state computation
- axes computation
- house-cusp computation
- optional ayanamsha support when available

The goal is not to expose raw SPICE mechanics everywhere in the app. The goal is to expose a stable astronomy result surface that frontends and higher astrology layers can trust.

## Provenance rules

SPICE-backed results should be able to surface:

- `backend_used`
- `ephemeris_source`
- `fallback_used` when applicable
- `warnings`

If a requested capability is unsupported or reduced-fidelity, the result should stay honest rather than silently inventing missing geometry.

## Current implementation status

Implemented:

- `JplAstronomyBackend` in Rust using `anise`
- feature-gated Swiss path in Rust
- pure-Rust support for key transforms and baseline house/axis calculations in `houses.rs`
- `EphemerisManager` integration for resolving active BSP files (planetary primary, optional de441 supplements, optional NAIF asteroid kernels)
- bundled `de440s.bsp` as the default planetary kernel (`de440` is the documented wider-range upgrade)
- bundled `ceres_1900_2100.bsp` and catalog entries for additional asteroid SPKs (`pallas_spk`, `vesta_spk`, `codes_300ast`)
- Python JPL backend path aligned around structured chart-data output
- osculating **true lunar node** (and true south node) from geocentric Moon state on both Rust and Python JPL paths
- **`moon_details`** on chart compute responses: lunar phase from tropical Sun–Moon longitudes (see [lunar-phase](../lunar-phase/))

Still incomplete:

- asteroid coverage beyond what is shipped or downloaded (Chiron, TNOs, arbitrary small bodies) still needs extra SPKs or another ephemeris source; see [ephemeris-manager](../ephemeris-manager/)
- ayanamsha remains incomplete on the Rust-owned side
- validation and parity coverage between backends is still partial

## Practical boundary with ephemeris manager

Use this page when the question is:

- what is the SPICE backend responsible for
- what does the Rust/Python JPL layer currently provide
- what belongs in the astronomy backend versus higher astrology logic

Use [ephemeris-manager](../ephemeris-manager/) when the question is:

- which BSP files exist
- where they come from
- how downloads work
- how multi-file kernel selection works
- why asteroid kernels are separate
