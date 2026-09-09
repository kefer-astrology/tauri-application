---
title: 'SPICE backend'
description: 'JPL/SPICE backend contract, implementation boundary, and current status.'
weight: 41
doc_kind: implementation-reference
status: current
authority: informative
---

This page is intentionally narrower than [architecture](../architecture/): it is about the astronomy backend layer itself, not the whole app.

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

The Rust and Python JPL paths target **SPICE BSP/SPK** planetary kernels such as `de440s.bsp` and `de440.bsp`, with **additional SPK files** chained in the same almanac for asteroids and other small bodies. On Rust, `EphemerisManager` appends the bundled `codes_300ast_20100725.bsp` and any optional single-body catalog downloads that are present.

That is distinct from Swiss Ephemeris JPL support through old-format `.eph` files in `swejpl.c` mode. `JplViaSwissAstronomyBackend` is still Swiss-backed and does not replace the SPICE/BSP path.

## Rust implementation

Rust uses [`anise`](https://github.com/nyx-space/anise) 0.10.6 to read BSP files
directly and to perform dynamic Earth frame transformations.

Current Rust module split:

```text
src-tauri/src/
  domain/
    houses.rs                    # obliquity, axes, cusps, node helpers, transforms
  infrastructure/
    astronomy/
      mod.rs                     # AstronomyBackend trait + backend selection
      jpl_backend.rs             # JplAstronomyBackend using anise
      swisseph.rs                # Swiss-backed compatibility path, feature-gated
    ephemeris.rs                 # BSP catalog, download, cache, multi-file almanac
```

What the Rust SPICE backend currently provides:

- body position queries from loaded BSP kernels
- axes and house cusp support through the Rust astronomy layer
- explicit `backend_used` / `ephemeris_source` style provenance
- multi-file kernel loading via `EphemerisManager`
- geometric J2000/ICRS to Earth mean-of-date transformation through ANISE's
  IAU 2006 `EARTH_MOD_FRAME`
- bundled `pck11.pca` planetary constants loaded before SPKs to supply ANISE's
  orientation graph offline

The PCA is ANISE's published v0.10 artifact, generated from NAIF/JPL `pck00011`
and DE431 gravity constants. Its pinned checksum and load-order rules are recorded
in [Ephemeris manager](../ephemeris-manager/).

## Coordinate pipeline

For planets, asteroids, the osculating lunar node, and true lunar apogee, the
backend follows one pipeline:

1. ANISE obtains the Earth-centred geometric state from the loaded SPKs.
2. ANISE rotates the complete position/velocity state into Earth mean-of-date
   (`EARTH_MOD_FRAME`, IAU 2006).
3. Rust rotates that dated equatorial vector by IAU 2006 mean obliquity into the
   mean ecliptic of date.
4. Longitude is extracted and normalized to `[0, 360)`.

This produces geometric mean-tropical longitude. No light-time, stellar
aberration, nutation, or scalar "general precession in longitude" is applied.
The full frame rotation must precede longitude extraction because precession can
also change the ecliptic latitude of an inclined vector. See the normative
[Astronomy coordinate contract](../astronomy-coordinate-contract/).

## Horizons-generated kernels

Horizons is treated as an artifact generator, not an online calculator in the
chart request path. `scripts/generate-horizons-type13.py` requests bounded
geometric state vectors, validates degree-7 Hermite interpolation against
held-out vectors, and asks NAIF `mkspk` to create an ANISE-supported Type 13 SPK.
It writes an adjacent `.bsp.json` provenance manifest.

At runtime `EphemerisManager` verifies that manifest, the BSP checksum, and an
in-range ANISE state before appending the kernel to the ordinary almanac. The
bundled Chiron artifact uses this path because native Horizons SPKs currently use
unsupported Type 21 segments. A successful DAF load alone is never treated as
proof that a target is queryable. Per-chart Horizons calls remain outside this
architecture.

What still sits above or beside it:

- astrology-layer interpretation
- some house-system fallback policy
- asteroid availability for bodies **not** included in any loaded kernel (e.g. TNOs or minor planets absent from your SPK set)

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
- pure-Rust support for key transforms and baseline house/axis calculations in `domain/houses.rs`
- `EphemerisManager` integration for resolving active BSP files (planetary primary, optional de441 supplements, optional NAIF asteroid kernels)
- bundled `de440s.bsp` as the default planetary kernel (`de440` is the documented wider-range upgrade)
- bundled `codes_300ast_20100725.bsp`, including Ceres through the configured
  20-body subset, plus optional single-body catalog downloads for Ceres, Pallas,
  and Vesta
- bundled, validated Chiron Type 13 SPK (1900–2100) generated from Horizons
  vectors, with manifest-driven discovery that can support additional small bodies
- Python JPL backend path aligned around structured chart-data output
- osculating **true lunar node** (and true south node) from geocentric Moon state on both Rust and Python JPL paths
- **`moon_details`** on chart compute responses: lunar phase from tropical Sun–Moon longitudes (see [lunar-phase](../lunar-phase/))

Still incomplete:

- native Horizons Type 21 ingestion remains blocked on evaluator support; the
  verified Type 13 acquisition path is active; see [ephemeris-manager](../ephemeris-manager/)
- asteroid coverage beyond what is shipped or generated (TNOs, arbitrary
  small bodies) still needs compatible local SPKs
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
