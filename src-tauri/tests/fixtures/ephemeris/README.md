# Ephemeris test fixtures

## `ceres_1900_2100.bsp`

Unmodified copy of NAIF's publicly archived standalone Ceres kernel, used only
by coverage/overlap tests (`infrastructure::ephemeris::tests`) to exercise a
genuine two-file, overlapping, same-target scenario alongside the bundled
`codes_300ast_20100725.bsp` — something the app's own bundled resources alone
cannot exercise (no two bundled files cover the same body).

- Source: `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/asteroids/a_old_versions/ceres_1900_2100.bsp`
- Retrieved: 2026-10-08
- Size: 1,149,952 bytes (matches the `ceres_spk` catalog entry in
  `infrastructure/ephemeris.rs`)
- SHA-256: `17e73febbf23ad34dd108793c19d90e5d6142080af642a26f3282e90be91eeec`
- Declared coverage: 1900–2100 (NAIF catalog metadata, not independently
  re-measured here beyond what the coverage tests themselves assert)

This is the same file `EphemerisManager::download("ceres_spk", ...)` would
place in the app-data cache; it is pinned here only so tests do not depend on
network access or a prior manual download.
