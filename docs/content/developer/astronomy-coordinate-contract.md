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
| Aberration correction | None |
| Nutation | None |
| Output | Geometric mean-tropical longitude in `[0, 360)` |

The mandatory operation order is:

```text
Earth-centred J2000/ICRS position + velocity
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

## Motion contract

Longitude speed is a centred finite difference of longitudes produced by the
same pipeline at both sample epochs. Each sample performs its own mean-of-date
transform. Retrograde is true exactly when that signed speed is negative.

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
