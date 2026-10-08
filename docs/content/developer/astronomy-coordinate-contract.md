---
title: 'Astronomy coordinate contract'
description: 'Normative frame, origin, correction, and ephemeris-artifact rules for computed longitudes.'
weight: 42
doc_kind: contract
status: current
authority: normative
---

This contract fixes the numerical meaning of longitude output from the Rust JPL
provider. It prevents provider internals from changing a chart's coordinate
system accidentally.

## JPL longitude contract

For SPK-backed bodies and osculating points derived from their state vectors:

| Property | Required value |
| --- | --- |
| Origin | Earth geocentre |
| Source orientation | SPK J2000/ICRS orientation |
| Dated equator/equinox | Earth mean-of-date, ANISE `EARTH_MOD_FRAME`, IAU 2006 |
| Ecliptic | Mean ecliptic of date, IAU 2006 mean obliquity |
| Aberration correction | `apparent`: converged reception light-time + stellar aberration (`CN+S`); `geometric`: none |
| Nutation | None |
| Output | Apparent (default) or geometric mean-tropical longitude in `[0, 360)` |

The mandatory operation order is:

```text
Earth-centred J2000/ICRS position + velocity
  → selected apparent/geometric correction
  → three-dimensional Earth MOD frame transform
  → mean-ecliptic projection
  → longitude/latitude extraction
```

A scalar longitude offset is not a conforming substitute for the MOD transform.
The lunar osculating node and true apogee must receive both position and velocity
in the same dated frame before their orbital vectors are derived.

House axes and cusps remain Earth-rotation calculations driven by UT and location;
they are not SPK frame transformations. Mean obliquity uses the same IAU 2006
polynomial so the provider does not mix precession-era conventions.

### What `apparent` (CN+S) does and does not correct for

`CN_S` is ANISE's converged (iterated) light-time correction plus stellar
(velocity) aberration. It is **not** a general relativistic or complete
apparent-place pipeline. Explicitly not applied, in either `apparent` or
`geometric` mode:

- **Nutation** — the dated frame is mean-of-date, not true-of-date; no
  short-period nutation term is added to the obliquity or the equinox.
- **Gravitational light deflection** — no relativistic bending of light near
  the Sun or other massive bodies is modeled; `CN_S` only iterates classical
  light-time and adds the observer-velocity stellar-aberration term.
- **Polar motion / precise Earth orientation** — see the UT1 approximation
  below; there is no EOP correction to the frame itself beyond ANISE's dynamic
  IAU 2006 model.
- **Parallax / topocentric correction** — see the altitude/azimuth limitation
  below; longitude and the equatorial coordinates stay geocentric.

A result is "apparent" only in the light-time-plus-aberration sense used by
this contract, not in the sense of a full apparent-place reduction such as
IAU SOFA's `iauAtco13`.

## Corrected vs. geometric state usage

Not every quantity in a chart samples the ANISE state the same way:

| Quantity | Aberration used | Why |
| --- | --- | --- |
| Classical planets, asteroids, manifest small bodies (`positions`, `motion`, RA/Dec, alt/az) | Selected mode (`apparent` default, `geometric` optional) | User-selectable chart convention; see [JPL longitude contract](#jpl-longitude-contract) |
| Mean lunar node / mean south node | N/A — closed-form secular formula, no state sample | Not derived from an SPK state at all |
| True lunar node, true south node, true Lilith (true apogee) | Always `Aberration::NONE` (geometric), regardless of the chart's `position_mode` | Osculating orbital elements (angular momentum, eccentricity vector) are defined from the instantaneous geometric Earth–Moon state; a retarded/aberrated line of sight is not a valid input to that vector algebra |

This means a chart's `position_mode: apparent` setting changes the Sun, Moon,
planets, and asteroids, but never changes the true node or true Lilith
longitude — those are always computed from the geometric Earth–Moon state.
Treating them as subject to the chart's aberration setting would be
inconsistent with how the underlying orbital-element formulas are derived.

## Motion contract

For SPK-backed bodies (planets, asteroids, and manifest-defined small bodies),
longitude speed is an **analytic derivative of the same state vector** used for
the position, not a finite difference:

1. ANISE's state transform into `EARTH_MOD_FRAME` already carries the frame
   rotation's own transport term through its velocity output.
2. Because the mean-ecliptic projection additionally depends on time through
   the IAU 2006 mean-obliquity polynomial, the implementation adds the
   remaining `d(obliquity)/dt` term analytically (`mean_obliquity_rate_rad_s`
   in `infrastructure/jpl_backend.rs`) before computing the ecliptic-plane
   angular rate `(x·vy − y·vx) / (x² + y²)`.
3. For the default `apparent` mode this is the derivative of the same CN+S
   corrected state used for position — it is a velocity consistent with the
   converged light-time/aberration solution, not a separate uncorrected rate.

Retrograde is true exactly when that signed speed is negative.

Finite differences remain an **independent validation technique**, not the
production motion algorithm, for SPK-backed bodies: a dedicated test
(`longitude_velocity_matches_complete_pipeline_central_differences`) compares
the analytic rate above against centred differences of the full
position-and-projection pipeline at three step sizes, for both `geometric` and
`apparent` correction, confirming the difference stays under an explicit
tolerance (tighter for `geometric`, looser for `apparent` since CN+S velocity
is validated rather than assumed to be an exact position derivative).

Finite differences are still the **production** method for points derived from
osculating orbital elements rather than directly from an SPK Chebyshev record —
but the three cases below do not all sample the same kind of input, and should
not be described as one identical method:

- **True lunar node / true south node** (`true_node_motion`) and **true
  Lilith** / true apogee (`true_apogee_motion`) each take **two independent
  SPK samples** of the Moon's full position-and-velocity state (`t − 3600s`
  and `t + 3600s`), re-derive the osculating orbital element (angular
  momentum vector for the node, eccentricity vector for apogee) from each
  sampled state independently, and only then take the signed angular delta of
  the two resulting longitudes over the elapsed time. The finite difference
  is over the *derived osculating longitude*, not over a directly sampled
  quantity.
- **Mean lunar node / mean south node** (`mean_node_motion` in
  `domain/houses.rs`) takes no SPK sample at all: `mean_node_lon` is a closed-form
  secular polynomial in time, and the finite difference is of that polynomial
  evaluated at the same two instants. There is no Moon state vector and no
  orbital-element re-derivation involved.

All three use the same `t ± 3600` second step and the same geometric
(`Aberration::NONE`) sampling — that symmetry is intentional and shared — but
the mean-node case is a finite difference of a formula, while the true-node
and true-apogee cases are a finite difference of a value that already
required a full independent state sample and vector derivation at each of the
two instants.

## Ephemeris artifact contract

Ordinary chart and transit computation must not depend on a live Horizons
request. Horizons may be used by an explicit acquisition/import workflow to
generate a bounded-coverage SPK. That workflow must record at least:

- requested Horizons target and resolved NAIF target ID
- generation time and requested coverage interval
- source URL or request parameters
- checksum and local filename
- SPK segment data type and validation result

Only a kernel whose segment representation the active ANISE evaluator can query
may be advertised as available. Loading a DAF/BSP container is insufficient
validation; the target must be sampled within its coverage interval.

## Time pipeline

Input chart times are UTC civil timestamps, including their fractional second.
The pipeline from there to an SPK sample is:

```text
UTC instant (chart event_time, fractional second preserved)
  → hifitime Epoch (UTC → TT internally for mean-obliquity/node formulae;
                    ANISE resolves the TDB-compatible epoch it needs for SPK lookup)
  → ANISE SPK Chebyshev evaluation at that epoch
```

Known limitations of this pipeline, which the contract requires staying
visible rather than silently assumed away:

- **UTC is used as a UT1 approximation.** The application bundles no
  Earth-orientation-parameter (EOP) / ΔUT1 table, so Greenwich Mean Sidereal
  Time and the house/axis calculations that depend on it use UTC directly
  where UT1 is formally required. A per-chart warning
  (`ut1_approximated_from_utc`) makes this explicit. This is acceptable for the
  sub-arcsecond-insensitive house/axis use case but is not a substitute for a
  real UT1 source if that precision is ever required.
- **Historical civil time is the caller's responsibility.** For dates before
  reliable UTC (pre-1972) or dates expressed in a calendar/Delta-T convention
  other than the chart's own, the caller must already have resolved a
  UTC-equivalent instant before it reaches this provider. The JPL backend does
  not apply its own historical calendar or Delta-T correction.
- **Floating-point time resolution is epoch-dependent, not a fixed figure, and
  is never nanosecond-level.** `event_time`'s nanosecond field is preserved
  structurally, but the value that actually reaches ANISE is
  `event_time.timestamp() as f64 + subsec_nanos as f64 * 1e-9` — an `f64`
  Unix-seconds value. `f64`'s resolution near a value `x` is approximately
  `|x| * 2^-52`, so it scales with how far the epoch sits from 1970-01-01:

  | Chart epoch | Approx. `\|unix_secs\|` | Approx. resolution |
  | --- | --- | --- |
  | 2024 (typical modern chart) | `1.7×10⁹` | ~0.38 µs |
  | 1 AD (near the de441_part1/part2 boundary) | `6.2×10¹⁰` | ~14 µs |
  | −13200 / +17191 (the de441 part extremes) | `~4.8×10¹¹` | ~107 µs |

  This is strictly the precision of the **time input representation** —
  separate from, and not a stand-in for, the pipeline's actual **numerical
  calculation accuracy**, which is a different, independently measured
  quantity (see [ephemeris validation](../ephemeris-validation/) for measured
  position/velocity agreement against an external reference). No part of this
  pipeline should be described as nanosecond-accurate on either basis, and a
  claim of uniform sub-microsecond time resolution across all historical or
  future dates would also be incorrect — only epochs near the present are that
  precise.

## Topocentric output limitation

Altitude and azimuth are computed from the same geocentric equatorial vector
used for RA/Dec, rotated into the observer's local horizon using local
sidereal time and geographic latitude (`equatorial_to_horizontal_deg`). This
is a **geocentric-vector-derived observer-direction convenience**, not a
complete topocentric reduction:

- no diurnal (geocentric-to-topocentric) parallax shift is applied before the
  horizontal rotation — relevant mainly for the Moon, whose parallax can
  exceed half a degree, and negligible for distant planets
- no atmospheric refraction correction is applied, so altitude near the
  horizon will not match a refraction-corrected rise/set or visual altitude

Treat altitude/azimuth as a geocentric-direction display convenience rather
than an observational apparent-place result.

## Shared state evaluation and caching

Two different kinds of reuse exist in this pipeline and must not be conflated:

- **Kernel/file-load caching.** `JplAstronomyBackend::build_almanac` caches a
  constructed `Almanac` (the loaded PCK + chained SPK files) keyed by each
  path's `length:modified-time` fingerprint (`almanac_cache_key` in
  `infrastructure/jpl_backend.rs`). This avoids re-parsing DAF/BSP and PCK
  binary files on every compute call for the same file set, and a file
  replacement (e.g. a completed download) invalidates the key automatically
  because its fingerprint changes.
- **No precomputed polynomial output cache exists.** Every `sample_state` /
  `sample_tropical_longitude` call still evaluates the SPK Chebyshev
  polynomial fresh, through ANISE, for the exact requested epoch. There is no
  layer that precomputes or memoizes body positions/velocities across epochs
  or across chart requests. A claim that repeated queries at nearby times are
  cheaper than the first only because of caching would be incorrect — what is
  cached is kernel *loading*, not kernel *evaluation*.

## Type 21 compatibility boundary

ANISE 0.10.6 supplies the required IAU 2006 dynamic frame machinery but does not
evaluate SPK Type 21 (Extended Modified Difference Array) segments. Current
Horizons-generated Chiron SPKs use Type 21 and the extended target ID `20002060`.
The application therefore does not install or advertise native Type 21 kernels.

The implemented compatibility path requests geometric Horizons `VECTORS` in
ICRF, generates a Sun-centred SPK Type 13 with NAIF `mkspk`, and validates
held-out position and velocity samples. The resulting artifact is accepted only
when its adjacent manifest passes all of these runtime checks:

- supported manifest schema and J2000/Type 13 representation
- declared interpolation errors within their acceptance thresholds
- matching SHA-256 checksum
- successful in-range ANISE position-and-velocity probe through `EARTH_MOD_FRAME`

The bundled Chiron artifact covers 1900-01-01 through 2100-01-01. Its source
states use a four-day cadence and degree-7 Hermite interpolation; 2,300 held-out
Horizons samples measured maximum errors of 0.0392 km in position and
`6.39e-8` km/s in velocity.

Native Type 21 support may replace this generated artifact only after ANISE gains
a tested evaluator. The manifest/catalog and coordinate contracts do not change
when that storage representation changes.

Falling back to live Horizons vector queries in the compute path does not satisfy
this contract.
