---
title: 'Ephemeris validation'
description: 'Reproducible numerical and performance checks for the Rust JPL/SPICE provider, and what they do not yet cover.'
weight: 42
doc_kind: implementation-reference
status: current
authority: informative
---

This page is the single authoritative home for performance and validation
claims about the Rust JPL/SPICE provider (`infrastructure/jpl_backend.rs`).
Other pages link here instead of repeating numbers; if you are looking for
normative behavior rather than measurements, see the
[Astronomy coordinate contract](../astronomy-coordinate-contract/) and
[SPICE backend](../spice-backend/) instead.

## Reproducing the checks

From `src-tauri/`:

```bash
# Correctness/parity tests (fast, run by default)
cargo test --lib jpl_backend::
cargo test --lib infrastructure::ephemeris::
cargo test --lib application::event_search::
cargo test --lib application::compute_router::

# Horizons-gated test (needs de440s.bsp; present in the bundled resources dir)
cargo test --lib j2000_positions_match_horizons -- --ignored --nocapture

# Diagnostic timing benchmarks (release build; run on the target machine, not CI)
cargo test --release --lib jpl_direct_path_benchmark -- --ignored --nocapture
cargo test --release --lib dense_single_body_transit_series_benchmark -- --ignored --nocapture
cargo test --release --lib multi_body_transit_series_benchmark -- --ignored --nocapture
cargo test --release --lib stationary_point_search_benchmark -- --ignored --nocapture
cargo test --release --lib aspect_exact_time_search_benchmark -- --ignored --nocapture
cargo test --release --lib compute_transit_events_benchmark -- --ignored --nocapture
```

`cargo test --lib` without filters also runs everything above except the six
`--ignored` benchmarks, which are intentionally excluded from that default run
because they need a release build (and, for the first, bundled resources) to
be meaningful rather than to measure debug-build overhead.

## What each test validates, and against what reference

| Test | What it checks | Reference |
| --- | --- | --- |
| `apparent_is_default_and_geometric_disables_aberration` | `position_mode` maps to the correct ANISE `Aberration` | Internal contract, no external reference |
| `earth_mod_transform_changes_more_than_scalar_longitude` | The MOD transform is a real 3D rotation, not a scalar offset | Internal invariant (latitude must change) |
| `true_lilith_matches_horizons_osculating_elements_at_j2000` | True apogee (true Lilith) formula | Horizons osculating elements for the Moon (body 301) at J2000.0: `EC`, `OM`, `W` → expected apogee longitude 252.8807°, tolerance 0.5° |
| `vertex_and_parts_resolve_and_match_direct_computation` | Vertex/antivertex/Parts of Fortune/Spirit wiring | Internal cross-check against the same formulas called directly |
| `codes_300ast_minor_planets_resolve_from_bundled_kernels` | All 16 non-classical `codes_300ast` bodies actually resolve from the bundled kernel | Catalog-entry presence, not independent numerical accuracy per body |
| `bundled_chiron_type13_is_discovered_and_computed` | Chiron manifest discovery and computation wiring | Internal — confirms no `chiron_*` warning and a longitude in range |
| `bundled_chiron_type13_matches_held_out_horizons_state` | Chiron Type 13 interpolation accuracy at a held-out epoch | An independent Horizons `VECTORS` sample not used as an interpolation knot; position error < 1.0 km, velocity error < 1e-5 km/s |
| `longitude_velocity_matches_complete_pipeline_central_differences` | Analytic motion formula vs. centred finite differences of the full pipeline | Internal — three step sizes (1 s, 10 s, 60 s) confirm the finite-difference estimate itself converges, then compares the analytic rate to it; see the [motion contract](../astronomy-coordinate-contract/#motion-contract) for the tolerances (2e-3 deg/day geometric, 1e-2 deg/day apparent) and why they differ |
| `compute_chart_data_attaches_equatorial_and_horizontal_coordinates` | RA/Dec/alt/az wiring end-to-end through `compute_chart_data` | Skyfield/JPL reference for Mercury, 2024-04-10 12:00 Europe/Prague: RA 20.960824°, Dec 11.554670°, alt 48.889981°, az 153.520290°, tolerance 0.05° each |
| `mercury_2024_geocentric_state_matches_independent_horizons_fixture` | Raw J2000/ICRF geocentric state for Mercury Barycenter, 23 epochs across Jan–Feb 2024 | Independently fetched JPL Horizons `VECTORS` (`VEC_CORR=NONE`), saved at `tests/fixtures/horizons/mercury_2024_geocentric.json`; observed max error ~0.035 km position, ~4.8e-8 km/s velocity (asserted bound: <1 km, <1e-5 km/s) |
| `retrograde_flag_flips_across_a_real_stationary_point` | The `retrograde` output flag actually flips at a real Mercury station, not just `speed < 0.0` self-consistency | Internal — locates the station via `application::event_search::find_stationary_point`, samples ±6h through the public chart pipeline |
| `longitude_wraps_through_zero_degrees_without_a_motion_discontinuity` | Longitude and analytic motion stay correct across a real 0°/360° crossing (the Moon) | Internal — locates the real crossing via `find_aspect_exact_time` (target longitude 0°), confirms no spurious ~360°/day jump |
| `chiron_longitude_is_continuous_across_its_internal_spk_segment_boundary` | Position continuity across Chiron's two internal Type 13 segments (seam read live from `spk_summaries`, not a hardcoded date) | Internal invariant — Chiron moves ~0.03°/day, so a multi-degree jump at the segment seam would indicate a broken handoff |
| `apparent_and_geometric_mars_positions_differ_by_a_small_physical_amount` | `apparent` vs. `geometric` Mars longitude differ by a real, bounded amount | Internal sanity bound only (0 < delta < 1°), not an independent accuracy proof |
| `out_of_coverage_epoch_produces_explicit_local_warnings_not_an_error` | A chart dated outside loaded coverage (year 3000) produces explicit per-body `_unavailable` warnings, not an error and not any network attempt | Internal — see [offline execution](#offline-execution-verified-not-just-read-from-source) |
| `unsupported_body_id_produces_explicit_local_warning_through_resolved_chart` | An unknown body id, through the full resolved-chart pipeline, produces an explicit local diagnostic naming it | Internal |
| `j2000_positions_match_horizons` (ignored by default) | All ten classical bodies resolve and the Sun's longitude is sane | Loose sanity check (Sun longitude within 1° of ~280.4° at J2000.0), not a per-body Horizons table |
| `compare_jpl_vs_swisseph_2026_04_22_1500_utc` (ignored, `swisseph` feature only) | JPL vs. Swiss Ephemeris longitude agreement | Prints a diff table; this checkout does not vendor the Swiss Ephemeris C source, so this test cannot run here and provides no result |

`application::event_search` (stationary points and exact aspect times — see
below) and `infrastructure::ephemeris::usable_coverage_tests` (chain-aware
coverage — see [ephemeris-manager](../ephemeris-manager/#runtime-coverage-inspection))
have their own test suites, described in their own sections rather than this
table, since they validate algorithms rather than individual reference points.

None of these tests exercise the asteroids beyond Chiron and the Moon against
an independent per-body Horizons reference; `codes_300ast_minor_planets_resolve_from_bundled_kernels`
only confirms resolution, not numerical accuracy, for the other 15 bodies.
Mercury is the only body checked against an independently fetched Horizons
vector fixture; the Sun, Moon, and remaining eight classical planets are not.

## Event search: stationary points and exact aspect times

`application::event_search` (`src-tauri/src/application/event_search.rs`)
implements an actual root-finder over the normal position pipeline — a coarse
fixed-step scan for a sign change, then bisection — for two kinds of event,
each with both a single-result and a complete-interval ("find every root in
this range, not just the first") variant:

- `find_stationary_point` / `find_all_stationary_points`: the instant(s) a
  body's longitude speed changes sign (a station).
- `find_aspect_exact_time` / `find_all_aspect_exact_times_against_fixed_point`:
  the instant(s) a transiting body forms an exact aspect angle with a fixed
  longitude (e.g. a natal point, or 0° to find a tropical-boundary crossing).
- `find_all_mutual_aspect_exact_times`: the moving-vs-moving counterpart —
  both bodies sampled together, for e.g. New Moon (Sun-Moon conjunction)
  searches.

The complete-interval variants are wired to the `compute_transit_series` /
`compute_transit_series_from_data` Tauri commands via
`application::transit::compute_transit_events`, gated by the persisted
`exact_hits`/`station_events` request flags and returned in a separate
`event_search` response field — independent of, and never rounded to,
`time_step_seconds`/the sampled `results` series. See
[transit-series-contract](../transit-series-contract/#exact-event-search-exacthits--stationevents)
for the contract and supported aspect geometry. The underlying
`discover_roots` scan has a bounded, two-tier recursion budget
(`confirmed_subdivision_budget` generous, `speculative_subdivision_budget`
tight) so it catches hidden/repeated crossings within one coarse step
(retrograde loops, multiple events) without exponential cost — proven both
against synthetic step functions with known root counts and against real
Mercury retrograde-loop/station data. **Stated limitation:** discovery
cannot resolve a tangential contact (a motion reversal that touches but does
not cross the target value) as a crossing event; only genuine sign changes
are found.

Every correctness test independently cross-checks its own result two ways:
(1) the found instant's own speed/offset is confirmed near zero, and (2) a
separate, cruder re-scan at a different fixed step is confirmed to still
bracket the same sign change, rather than only trusting the bisection's
internal convergence. Tests cover a real Mercury station (also independently
corroborated by the Horizons fixture above, in the same window), a window
with deliberately no station (Sun, 2 days), a real Sun–Moon conjunction (New
Moon), and a regression case: with a 0°-aspect target, the signed-offset
function's own wrap boundary sits at 180° (opposition) — an early version of
this search could mistake that discontinuity for a conjunction, which is now
an explicit regression test
(`aspect_exact_time_search_does_not_mistake_the_opposite_point_for_a_crossing`).

## Usable coverage: raw vs. chain-aware

There are four genuinely different coverage questions in play here, and this
page keeps them distinct rather than treating "coverage" as one concept:

1. **Raw target segment coverage** — the union of epochs a target's own
   loaded SPK segment(s) declare, with no regard for anything else. This is
   `loaded_spk_coverage` / `get_loaded_spk_coverage`.
2. **Complete geometric target-to-Earth chain coverage** — whether every link
   from the target up to Earth (through whatever centers the loaded data
   actually uses) resolves at a given epoch. This is
   `usable_earth_relative_coverage` / `get_usable_coverage` with
   `apparent: false`.
3. **Apparent-query coverage requiring retarded epochs** — the same chain
   question, but probed with `Aberration::CN_S` so a failure to converge the
   light-time iteration at the *retarded* epoch is also caught. This is
   `get_usable_coverage` with `apparent: true`.
4. **Numerical validation coverage** — the separate, much narrower claim of
   which specific target/epoch/quantity/correction combinations have been
   checked against an independent reference. See the per-test table above and
   "What this page does not claim" below; it is not implied by any of the
   first three.

`usable_earth_relative_coverage` is built directly on
`Almanac::transform` and `Almanac::ephemeris_path_to_root` — not a
reimplementation of SPICE precedence rules, and not a "global intersection of
unrelated segment intervals." An earlier version of this function discovered
only the *target's* ascent chain and filled in the Earth side from a
hardcoded anchor list (`[0, 10, 3, 399]`); that was replaced with discovery
from loaded segment metadata on *both* sides (the target's own ascent and
Earth's own ascent, each via `ephemeris_path_to_root`), because the
hardcoded list was carrying weight the discovery step wasn't actually doing —
see `discover_ascent_chain_ids` in `infrastructure/ephemeris.rs`.

### Structural analysis, sampled validation, and `Unknown`

A reported interval's *endpoints* come from real segment boundaries — that
part is exact structural analysis, since a Chebyshev segment is valid-or-not
strictly by its declared window. Whether `transform` succeeds *throughout*
the interval rests on a single midpoint probe per sub-interval, not an
exhaustive scan — a finite successful probe does not prove availability at
every instant, particularly for apparent mode, where light-time convergence
could in principle fail at an isolated problematic epoch even inside an
otherwise-valid window. This is a deliberate, bounded form of **sampled
validation** layered on top of **structural interval analysis**, not a claim
of exhaustive proof.

Chain discovery can itself fail to complete — a genuinely broken center link,
or a chain deeper than ANISE's 8-node limit. When that happens for a target
that does have its own loaded segment(s), the report's `determination` is
`Unknown` (with a `reason`) rather than a confident `Determined` empty
result: the boundary set may have missed a real internal transition, so the
returned intervals are a **conservative, possibly-too-coarse** result, not a
confirmed answer. `Determined` is reserved for: (a) chain discovery actually
succeeding on both sides, or (b) the target or Earth having **no** loaded
segment at all, which is itself conclusive rather than a discovery failure.
Tests: `missing_center_link_reports_unknown_not_a_confident_unavailable`,
`chain_deeper_than_evaluator_limit_reports_unknown`.

### Precedence: tested beyond same-center overlaps, and corrected

`infrastructure::ephemeris::usable_coverage_tests` (15 tests) covers complete
chains, missing links, gaps, alternate chains, and overlap/precedence —
including scenarios no bundled or realistically downloadable kernel can be
made to exhibit on demand, built from a hand-crafted synthetic SPK (real
summary *metadata* — target id, center id, start/end epoch — no Chebyshev
coefficient data; see `synthetic_spk` in the test module):

- a **complete chain** with real kernels (Ceres through Sun→SSB→EMB→Earth,
  `de440s` + bundled `codes_300ast`)
- a **missing link** with real kernels (Ceres present in `codes_300ast`
  alone, no Sun/Earth/EMB kernel loaded — reports empty, `Determined`
  coverage, not an error)
- a target **entirely absent** from any loaded kernel (also empty,
  `Determined`, not an error — a distinct case from "present but
  unreachable")
- a **synthetic missing center link** (target's own segment exists, but its
  center has no segment anywhere) → `Unknown`
- a **synthetic alternate chain** (a target's center genuinely differs
  across two eras of its own lifetime, both resolving to Earth through
  different intermediates) → both intermediates discovered, `Determined`
- a **synthetic chain deeper than ANISE's evaluator supports** (9 hops,
  mirroring `anise::ephemerides::paths`'s own internal depth-limit test) →
  `Unknown`
- **real-kernel overlapping/same-center precedence**: the bundled
  `codes_300ast` plus a downloaded standalone `ceres_1900_2100.bsp` (see
  fixture provenance below) — load-order invariance when one segment is a
  strict superset of another
- a **synthetic different-center overlap**, specifically to test the claim
  below
- a **contiguous multi-segment target** (Chiron's two internal Type 13
  segments merging into one reported interval)
- **apparent vs. geometric** coverage never being wider under light-time
  correction
- the gap/merge sweep itself (`merge_probed_intervals`), tested directly with
  synthetic boundaries for a genuine gap, full merge, and leading/trailing
  exclusion, independent of any real kernel or synthetic SPK

A real two-file overlap/precedence scenario needed a kernel this application
does not bundle: `tests/fixtures/ephemeris/ceres_1900_2100.bsp` is NAIF's own
publicly archived standalone Ceres file (same one `download_ephemeris("ceres_spk", ...)`
would fetch), pinned here with checksum and retrieval-date provenance in the
adjacent `README.md` so these tests do not depend on network access.

**A claim from an earlier pass of this audit was too general, and the
correction is itself the more interesting result.** That pass found that
reversing the load order of `ceres_1900_2100.bsp` and `codes_300ast` changes
neither the usable coverage window nor the returned state vector, and
generalized this to "last loaded wins cannot narrow usable coverage." That
generalization does **not** hold for the evaluator's actual selected
chains. `anise::almanac::Almanac::spk_summary_at_epoch` walks loaded files in
reverse-load order and falls through to an earlier file only when the
most-recent one has **no entry at all** for that id at that epoch. If the
most-recent file **does** have an entry — for the same target, at an
overlapping epoch, through a **different, dead-end center** — that entry
wins outright, and chain resolution fails there even though the earlier file
would have resolved that exact instant through its own center.
`last_loaded_file_can_shadow_an_otherwise_valid_chain_with_a_dead_end` proves
this directly with a synthetic two-file kernel: resolution succeeds
immediately outside the overlap and fails inside it. No bundled or
downloaded real kernel pair in this project has been observed to actually
hit this case — `ceres_1900_2100.bsp` and `codes_300ast` happen to share the
same fully valid chain wherever they overlap — but it is reachable in
principle for a kernel set this project does not currently use, and the
earlier blanket claim should not have been made without checking it. See
[ephemeris-manager](../ephemeris-manager/#file-resolution) for the corrected
documentation.

**Also discovered while building these tests — real stored BSP coverage
differs from the catalog's documentation-facing date-range labels, for the
*specific* targets and files checked (not generalized further):**
`de440s.bsp`'s Sun/Earth/EMB segments are actually stored from
**1849-12-26 through 2150-01-21** (not "1900–2050"), and `codes_300ast.bsp`'s
**Ceres segment specifically** is stored from **1799-12-30 through
2199-12-13** (not "1600–2200") — the other ~298 bodies in that same
multi-body file were not individually checked and may have different
windows. These numbers came directly from `almanac.spk_summaries` during test
development, not from any prior documentation claim. See
[ephemeris-manager](../ephemeris-manager/#bsp-catalog) for the corrected
framing of that table.

## Output conventions

The benchmark prints one line:

```text
direct JPL benchmark: cold=…, position_only_N p50=… p95=…, warm_one p50=… p95=…, warm_all p50=… p95=…, dense_8=… (… samples/s)
```

- **cold** — one call to `compute_chart_data` for a single body, with the
  in-process `Almanac` cache cleared first (OS page cache is **not**
  controlled, so this is not a true "nothing cached anywhere" measurement).
- **position_only_N** — `N` raw `sample_state` + `motion_from_state` +
  `longitude_from_state` calls (no chart assembly, no warnings/axes/houses),
  over all classical, asteroid, and the bundled Chiron frames; the closest
  proxy this benchmark has to "kernel evaluation only."
- **warm_one** — `compute_chart_data` for a single body with the `Almanac`
  already cached.
- **warm_all** — `compute_chart_data` requesting every classical, asteroid,
  and Chiron body in one call.
- **dense_8** — 8 single-body computations at consecutive daily epochs (one
  simulated "chart rendering samples a dense time range" case), reported as
  samples/second.
- All `p50`/`p95` figures are computed over 10 iterations
  (`ITERATIONS = 10` in the test).

The newer benchmarks below print their own one-line summary in the same
`p50=… p95=…` spirit, plus whatever workload parameters (epoch count, step
size, body count, window length) make the number meaningful on its own:

- **dense single-body transit series** — `compute_transit_series_rust`
  (the same application path a `compute_transit_series` Tauri call uses),
  10,000 hourly epochs, one transiting body, 5 repetitions; reports
  `p50`/`p95` per full 10,000-epoch run and an aggregate epochs/second
  throughput. Verifies every epoch actually resolves the requested body
  before timing it.
- **multi-body transit series** — same application path, an explicit
  1,000 daily epochs, the ten classical bodies transiting against two natal
  points, 5 repetitions; same reporting shape, directly comparable to the
  single-body number since both go through the identical code path.
- **stationary-point search** — `find_stationary_point` for Mercury, Venus,
  and Mars across a 3-year window (long enough that every body is guaranteed
  at least one real station regardless of synodic phase), `p50`/`p95` over
  9 individual searches (3 bodies × 3 repetitions). Verifies every search
  actually finds and confirms a station.
- **aspect-exact-time search** — `find_aspect_exact_time` for a Sun–Moon
  conjunction across 12 non-overlapping ~30-day windows spanning 2024,
  `p50`/`p95` over those 12 searches. Verifies a conjunction is actually
  found in nearly every window (New Moon's synodic period is slightly under
  30 days, so one 30-day slice can occasionally miss by a few hours at the
  boundary).
- **`compute_transit_events` end-to-end** — the full orchestration layer
  behind `exact_hits`/`station_events` (not the lower-level `find_all_*`
  functions directly): one transiting body (Mercury) against one fixed radix
  point (the natal Sun), one aspect type, both `exact_hits` and
  `station_events` on, over a full year, `p50`/`p95` over 10 repetitions.
  Verifies both a station and an aspect-hit are actually found before timing
  it, and that the search reports `complete: true` within the default
  work-limit.

## Performance results

Collected on this checkout at revision `f701ac9a9e37d450be9ce6c60b566c2ca35b2538`
(branch `pre-release`), after the override-routing fix and the usable-coverage
and event-search additions described elsewhere on this page. **One machine** —
not a CI-controlled environment:

- Machine: AMD Ryzen 7 PRO 6850U (16 logical CPUs), Linux 6.12, 30 GiB RAM
- Build: `cargo test --release` (rustc/cargo 1.98.1)

**On sample counts and percentiles:** every `p50`/`p95` below is a
nearest-rank statistic (`percentiles` in the test code) over the stated `n`.
At small `n`, `p95`'s index collapses toward — or exactly onto — the sample
maximum; it is not a statistically robust tail estimate at n=3 or n=5.
Benchmarks below now use `n=20`–`30` specifically so `p95` is a genuine
19th/20th-of-20 (or similar) rank rather than just "the biggest number we
saw." Treat even these as order-of-magnitude, single-machine evidence, not a
certified result — none of it has run on CI, on a second machine, or been
diffed against a recorded pre-change baseline (none existed before this
documentation pass).

### Chart benchmark (`jpl_direct_path_benchmark`)

`n=10` per number (`ITERATIONS` in the test) — small enough that `p95` here
is close to the sample maximum too. Three consecutive runs; run-to-run noise
is visible:

| Run | cold | position_only_31 p50 / p95 | warm_one p50 / p95 | warm_all p50 / p95 | dense_8 | samples/s |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 92.4 ms | 677 µs / 710 µs | 27.5 µs / 47.0 µs | 743 µs / 760 µs | 226 µs | 35 474 |
| 2 | 85.2 ms | 637 µs / 689 µs | 27.3 µs / 36.5 µs | 664 µs / 712 µs | 225 µs | 35 606 |
| 3 | 96.1 ms | 853 µs / 917 µs | 34.3 µs / 69.6 µs | 894 µs / 1000 µs | 272 µs | 29 417 |

**`dense_8` remains a smoke-level timing check, not a representative
dense-series benchmark** — eight single-body samples at daily steps. The two
transit-series benchmarks below replace the gap this previously left open.

### Dense single-body transit series (10,000 hourly epochs, one body)

`n=20` full 10,000-epoch runs:

```text
dense single-body transit series benchmark: epochs=10000, step=3600s, repetitions=20,
p50=1.526305919s, p95=1.930171454s, throughput=6367.0 epochs/s
```

Through the full `compute_transit_series_rust` application path (workspace
load, settings resolution, per-step position + cross-aspect detection), not a
raw position-evaluation loop — see [the event search
section](#event-search-stationary-points-and-exact-aspect-times) for why
that path specifically was chosen.

### Multi-body transit series (1,000 daily epochs, 10 classical bodies)

`n=20` full 1,000-epoch runs:

```text
multi-body transit series benchmark: epochs=1000 (verified 1000), bodies=10, step=86400s,
repetitions=20, p50=417.612914ms, p95=539.224957ms, throughput=2398.1 epochs/s
```

Same application path; throughput drops from ~6400 to ~2400 epochs/s with 10×
the transiting bodies — sub-linear scaling, consistent with per-step fixed
overhead (workspace/model lookups already resolved once, not per step)
alongside the per-body SPK evaluation cost.

### Stationary-point search (Mercury, Venus, Mars; 3-year window)

`n=30` individual searches (10 repetitions × 3 bodies):

```text
stationary-point search benchmark: bodies=["mercury", "venus", "mars"], window=3y, step=6h,
searches=30, p50=247.426255ms, p95=328.610391ms
```

### Aspect-exact-time search (Sun–Moon conjunction; 24 monthly windows across 2024-2025)

`n=24` independent window searches:

```text
aspect-exact-time search benchmark: target=sun-moon conjunction, windows=24, step=6h,
p50=12.010103ms, p95=27.277372ms
```

The aspect search is roughly 20x faster than the stationary-point search here
because its coarse scan only needs to find the (reliably frequent, monthly)
conjunction within each already-narrow ~30-day window, while the
stationary-point search scans a full 3-year window per body to guarantee
Venus/Mars — whose stations are 1.5–2 years apart — have one at all.

### `compute_transit_events` end-to-end (Mercury vs. natal Sun, 1-year window)

Collected in a later pass than the revision above, on the same machine, after
wiring `exact_hits`/`station_events` through `compute_transit_series`. `n=10`
full end-to-end calls (each call internally runs both a station search and an
aspect-hit search):

```text
compute_transit_events benchmark: body=mercury, target=sun (radix), aspect=conjunction,
window=1y, exact_hits=true, station_events=true, events_found=8, repetitions=10,
p50=1.687235425s, p95=1.874918971s
```

Noticeably slower than the lower-level `stationary-point search` /
`aspect-exact-time search` numbers above for a comparable single-body,
single-window case — expected, since this is the orchestration layer's
*combined* cost (one station search plus one aspect-hit search per call, each
independently running its own coarse scan over the full year) rather than
either search measured in isolation.

## Offline execution: verified, not just read from source

Every benchmark and test above was re-run inside a Linux network namespace
with no interfaces brought up (`unshare --net --map-root-user`), confirmed to
have no DNS/route (`curl` inside it fails immediately with "Could not resolve
host," not a timeout). All **174** `cargo test --lib` tests and the
`compute_transit_events_benchmark` release benchmark (the newest addition,
covering the `exact_hits`/`station_events` orchestration layer) pass
identically with and without that namespace — this is executed evidence, not
an inference from reading the source. Source inspection independently
confirms *why*: no `reqwest`/HTTP code exists anywhere in `jpl_backend.rs`,
`application/computation.rs`, `application/transit.rs`, or
`application/event_search.rs`, and `EphemerisManager::available_bsp_paths`
only ever touches the local filesystem — but the claim here rests on the
namespace run, not on that reading alone. The other five release benchmarks
(`jpl_direct_path_benchmark` and the four listed earlier) were verified
offline in the same way in an earlier pass of this audit and have not changed
since; they were not re-run for this pass.

Two dedicated tests make the "missing/out-of-coverage" requirement concrete
rather than inferred: `out_of_coverage_epoch_produces_explicit_local_warnings_not_an_error`
(a chart dated year 3000, outside this checkout's only bundled kernel's
measured 1849–2150 range, with no `de441` supplement present) and
`unsupported_body_id_produces_explicit_local_warning_through_resolved_chart`
(an unknown body id through the full resolved-chart pipeline). Both produce
an explicit, named `_unavailable`/diagnostic warning and a successful
(non-error) result — never a network attempt, never a silent wrong answer.

**What this does not cover:** `backend-python/` is not present in this
checkout (confirmed: `ls backend-python` fails), so the optional Python
sidecar route cannot be runtime-verified here at all — not with network, not
without it. Source inspection of `infrastructure/python_sidecar.rs` shows its
HTTP client only ever targets `http://127.0.0.1:{port}` (a locally reserved
port, never a remote host) and that the sidecar process is spawned locally
via `std::process::Command`, never fetched from the network — but this is
*source-level* confirmation only, explicitly distinguished from the
namespace-executed proof above, because no Python backend exists here to
actually run.

**Explicit network-capable entry points, and why they stay unreachable from
compute:** exactly three modules contain `reqwest`/HTTP code in this crate —
`infrastructure::geocoding` (location search; a different service entirely,
not astronomical computation), `infrastructure::python_sidecar` (loopback
only, see above), and `infrastructure::ephemeris`'s `EphemerisManager::download`
(the explicit, user/command-triggered kernel download — reachable only from
the `download_ephemeris` Tauri command, confirmed by `grep` for its only
call site). Running `fetch_candidates` (the geocoding HTTP call) inside the
same no-network namespace fails in 24 ms with an explicit
`"error sending request"` message — demonstrating the *same* reqwest/DNS
mechanism the ephemeris downloader and geocoding both use fails fast and
explicitly, not via a hang, even though this was exercised through geocoding
specifically rather than through `download_ephemeris` itself (which needs a
running Tauri `AppHandle` to invoke directly). Generating a Horizons
reference fixture (`scripts/generate-horizons-type13.py`, and the manual
`curl` calls that built the `tests/fixtures/horizons/` fixture used above)
is a separate, manually-triggered, development-only action, never invoked
from any Rust code path — confirmed by `grep` finding zero subprocess or HTTP
call sites referencing either.

Read all of the above as order-of-magnitude evidence from a single
development machine, not a certified benchmark result. None of it has run on
CI, on a second machine, or across multiple build profiles, and none of it
has been compared against a pre-optimization baseline on the same machine (no
prior numbers were recorded in the repository to diff against before this
documentation pass).

## Known validation gaps

- No per-body Horizons accuracy table exists for the 15 `codes_300ast` bodies
  other than Ceres/Pallas/Juno/Vesta-class coverage implied by the catalog;
  only kernel *resolution* is tested for them. Mercury is the only body
  checked against an independently fetched Horizons vector fixture; the Sun,
  Moon, and the other eight classical planets are not.
- No automated Rust/Swiss-Ephemeris parity run in this checkout (the
  `swisseph` feature and its vendored C source are not present here).
- The transit-series benchmarks use a 1-hour step for the single-body case
  and a 1-day step for the multi-body case; neither benchmarks a
  minute-resolution series, and the multi-body case has not been run at the
  30-body (classical + full asteroid + Chiron) scale `warm_all` exercises for
  a single chart.
- The single-result `find_stationary_point` / `find_aspect_exact_time`
  functions themselves are still not exposed as a Tauri command, only the
  complete-interval `find_all_*`/`compute_transit_events` layer built on top
  of them is; neither is benchmarked at coarse-step granularities other than
  the fixed 6-hour default. The "a body stationing, un-stationing, and
  stationing again within one coarse step would be missed" gap this bullet
  used to describe is now closed for the `find_all_*`/`compute_transit_events`
  layer specifically — see the triple-crossing and repeated-wrap tests in
  `application::event_search`'s test module and the two-tier recursion budget
  described above — but the discovery scan still cannot resolve a tangential
  contact (touches but does not cross the target) as an event, and a request
  that plans enough searches to divide the shared work-limit pool below its
  floor (`MIN_PROBES_PER_SEARCH` in `application/transit.rs`) can still
  report `complete: false` for an individual search that would otherwise have
  converged, rather than guaranteeing every requested combination resolves.
  `exact_hits`/`station_events` only run through the Rust path — the Python
  sidecar has no event-search endpoint, so a Python-routed sampled series
  still gets its event search from Rust, not from parity-checked Python code.
- `get_usable_coverage`'s chain discovery now reads loaded segment metadata
  directly (`ephemeris_path_to_root` on both the target and Earth sides) and
  is no longer limited to a fixed anchor-id list — but it still requires the
  target to have at least one of its own loaded segments to begin
  discovering from, and ANISE's own evaluator still caps chain depth at 8
  hops (reported as `Unknown`, tested via a synthetic 9-hop chain). The
  different-center-overlap precedence case
  (`last_loaded_file_can_shadow_an_otherwise_valid_chain_with_a_dead_end`) is
  proven only with a synthetic kernel; no real bundled or downloaded kernel
  pair in this project has been found to actually exhibit it.
- The probe-per-sub-interval design (one midpoint per boundary-delimited
  window) is a sampled validation of a structural analysis, not an
  exhaustive scan — see "Structural analysis, sampled validation, and
  `Unknown`" above. No stress test has looked for an isolated mid-segment
  apparent-mode convergence failure that this sampling could miss.
- The optional Python sidecar route cannot be runtime-verified in this
  checkout at all (`backend-python/` is absent); only its Rust-side HTTP
  client code (loopback-only) has been inspected, not executed end-to-end.
- No CI-tracked performance baseline; the numbers above are a single
  developer machine, not a regression gate, and have not been compared
  against a pre-optimization baseline (none was recorded before this pass).
- Python-path numerical parity against the Rust JPL path is not covered by
  this page; see [Python package](../python-package/) and
  [testing strategy](../testing-strategy/) for that boundary.

## What this page does not claim

- Not nanosecond accuracy — see the
  [time pipeline](../astronomy-coordinate-contract/#time-pipeline) limitation.
- Not complete agreement with JPL Horizons across all bodies and epochs. The
  **exact, complete scope** of independent Horizons-reference checks in this
  checkout is:
  - **Mercury Barycenter**, geocentric, **raw J2000/ICRF** (no mean-of-date
    rotation applied yet), **geometric** (`VEC_CORR=NONE`), 23 epochs 2-days
    apart across **2024-01-01 through 2024-02-15** — position and velocity,
    against a saved fixture.
  - **Moon**, true apogee (true Lilith) longitude, **geometric**, **a single
    epoch** (J2000.0 exactly) — against Horizons' own published osculating
    elements, tolerance 0.5°.
  - **Chiron** (Type 13 artifact), heliocentric, **geometric**, **a single
    held-out epoch** — position and velocity, against an independent Horizons
    `VECTORS` sample not used as an interpolation knot.
  - **Mercury**, topocentric RA/Dec/alt/az, **apparent**, **a single
    epoch** (2024-04-10 12:00 Europe/Prague) — against a Skyfield/JPL
    reference computation, not a Horizons query directly.
  - The Sun, Moon's own longitude (as opposed to true Lilith), and the other
    eight classical planets have **no** independent Horizons/Skyfield
    reference check in this checkout, at any epoch, in either correction
    mode. "Internal consistency" tests (retrograde flip, 0° crossing,
    segment-boundary continuity, apparent-vs-geometric sanity, event-search
    cross-checks) exercise those bodies but prove internal consistency only,
    never independent accuracy — see the per-test table above for which
    category each test falls into.
- Not general numerical superiority over Swiss Ephemeris — no such comparison
  has been run in this checkout.
