# Migration Notes

This file is intentionally narrow: it tracks the remaining migration work from the earlier Swiss-centered implementation toward a backend-pluggable, JPL-centered architecture.

For live operational contracts, prefer:

- `docs/content/docs/architecture.md`
- `docs/content/docs/spice-backend.md`
- `docs/content/docs/ephemeris-manager.md`
- `docs/content/docs/tauri-command-contracts.md`
- `docs/content/docs/frontend-react.md`
- `docs/content/docs/frontend-svelte.md`

## Direction that remains in force

- Astronomy stays backend-pluggable.
- JPL / SPICE is the preferred default runtime direction.
- Swiss Ephemeris remains an explicit compatibility path, not the defining architecture.
- Astrology semantics such as zodiac system, house system, aspect rules, and tradition defaults should live above the astronomy backend.

## Areas that are no longer migration questions

These no longer need separate migration tracking here:

- Time navigation now has its own current reference in `docs/content/docs/time-navigation.md`.
- Ephemeris management is already owned by the live Rust `EphemerisManager` flow and documented in `docs/content/docs/ephemeris-manager.md`.
- Structured chart payloads and provenance fields are already part of the current frontend/backend contract.
- Workspace defaults persistence is already part of the live Tauri workflow.

## Remaining migration work

1. **True Node**
   Current behavior is still mean-node based or partial. A real true-node implementation remains open.

2. **Chiron / extended object coverage**
   `de421.bsp` does not provide Chiron. Kefer still needs either a consistent auxiliary SPK source or an explicit product contract that the object is unavailable and warned as such.

3. **Prototype fallback cleanup**
   A few UI areas still rely on fallback geometry, compatibility paths, or presentational placeholders rather than fully chart-backed data. Those should either be completed or marked clearly as prototype behavior.

4. **No-Swiss runtime verification**
   The no-Swiss Rust build path exists, but it still needs a clean end-to-end smoke path beyond successful compilation.

5. **Python environment verification**
   The optional Python seam is structurally in place, but full end-to-end confidence still depends on a provisioned Python environment and complete validation runs.

6. **Wrapper sync**
   If `/function-wrapper/` remains authoritative in parallel, it still needs to mirror the newer Python seam and structured chart-data flow.

7. **Backend-routing clarity**
   The app should be explicit about when compute is Rust-backed, Python-backed, or auto-routed, both in docs and in user-visible provenance.

## Closeout rule

Migration should only be considered complete when any screen or command that appears to expose computed astrology data either:

- uses a real backend-backed compute path with honest provenance, or
- is explicitly labeled as prototype / not yet implemented.
