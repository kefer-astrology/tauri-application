# Horizons reference fixtures

Saved responses from the public JPL Horizons API, used for offline,
network-free numerical validation tests. Each fixture records its own full
request parameters and provenance inline (`provenance` key) — see the file
itself rather than duplicating that here.

## `mercury_2024_geocentric.json`

- Fetched: 2026-10-08, via `https://ssd.jpl.nasa.gov/api/horizons.api`
- 23 geocentric state vectors for Mercury Barycenter, 2024-01-01 through
  2024-02-15 (2-day step), `VEC_CORR=NONE` (geometric, no light-time/stellar
  aberration), ICRF frame — directly comparable to this backend's raw
  `Aberration::NONE` J2000/ICRF state, before any mean-of-date rotation.
- Used by `infrastructure::jpl_backend::tests::mercury_2024_geocentric_state_matches_independent_horizons_fixture`
  (position/velocity agreement) and chosen to overlap the same window
  `application::event_search`'s Mercury-station tests search, so a real
  retrograde station is independently corroborated by this same external
  reference, not just this backend's own internal consistency.
- Observed agreement at fetch time: max position error ~0.035 km, max
  velocity error ~4.8e-8 km/s, against this checkout's bundled `de440s.bsp`
  (Horizons itself reports its answer sourced from DE441 — a close sibling
  solution, not an identical file).
