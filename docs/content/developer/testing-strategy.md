---
title: 'Testing strategy'
description: 'Canonical test levels, contract traceability, shared fixtures, and frontend/backend parity.'
weight: 26
doc_kind: policy
status: current
authority: normative
---

Every normative behavior should be traceable from a contract statement to an
automated test or an explicitly recorded testing gap. Acceptance prose is not a
substitute for that traceability.

## Test levels

| Level | Verifies | Typical owner |
| --- | --- | --- |
| Domain unit | Pure astrology, time, validation, and resolution rules | Rust; optional Python peer |
| Contract fixture | The same versioned input has the required output | `contracts/` plus each implementation that is provisioned |
| Provider | Astronomy-provider correctness, capabilities, and failures | Rust/Python provider adapter |
| Command integration | Tauri request, routing, serialization, and errors | Rust command/application layer |
| Frontend bridge | Payload construction and result normalization | React and Svelte Tauri bridges |
| Component | Interaction and rendering states | Owning frontend |
| Workflow | A user-visible flow across UI and backend | Desktop/browser integration suite |
| Cross-language parity | Rust and an optional Python peer preserve shared semantics | Shared fixture runner when both implementations are provisioned |
| Smoke/build | Supported app configuration starts and builds | Root scripts and CI |

Type checking and compilation are necessary checks, but they are not behavioral
frontend tests.

## Required test definition

Use a stable ID for contract-level behavior. A definition should record:

```yaml
id: MODEL-002
contract: settings resolution
level: contract-fixture
implementations: [rust, python]
fixture: contracts/settings-resolution.json
given: workspace and chart provide the same setting
when: effective settings are resolved
then: the chart value wins and its source is "chart"
tolerance: exact
automation:
  rust: shared_resolution_fixture_matches_cross_language_contract
  python: PythonContractParityTests
```

Tests may live beside the code they exercise. This document owns the inventory
and traceability, not the physical test files.

## Initial traceability matrix

| ID | Required behavior | Level | Current automation |
| --- | --- | --- | --- |
| TIME-001 | Offset-aware input preserves the represented instant | Contract parity | `contracts/event-time.json`; Rust `event_time` test; Python contract-parity tests |
| MODEL-001 | A school selects its default model | Domain/contract | Rust workspace settings tests; workspace fixture |
| MODEL-002 | Settings resolve fallback → model → workspace → preset → chart → operation | Contract fixture | `contracts/settings-resolution.json`; Rust fixture test; optional Python parity when provisioned |
| MODEL-003 | Model definitions and overrides affect aspect calculation | Domain | Rust astrology/settings tests; optional Python parity when provisioned |
| WORKSPACE-001 | A complete workspace round-trips without losing portable fields | Integration | Rust workspace command tests and shared workspace fixture; optional Python interoperability when provisioned |
| WORKSPACE-002 | Referenced paths cannot escape the workspace root | Integration/security | Rust loader enforces this; **GAP-WORKSPACE-002:** add direct absolute-path and traversal test cases |
| CATALOG-001 | Built-in and effective runtime catalogs cover model entries and emitted shapes/configurations | Domain/bridge | Rust catalog tests; frontend type/build coverage; **GAP-CATALOG-001:** automated React/Svelte refresh and fallback behavior |
| COMPUTE-001 | A radix result exposes the required backend-neutral fields | Command contract | Rust command/application tests; optional Python contract parity when provisioned |
| TRANSIT-001 | Transit ranges reject invalid order and non-positive step | Command contract | Rust transit command tests; optional Python parity when provisioned |
| TRANSIT-002 | `exact_hits`/`station_events` return real root-found events (moving-vs-radix and moving-vs-moving), independent of and never rounded to `time_step_seconds`; stations/aspect hits are tagged with direction-change/contact-kind (crossing vs. tangential) and an independent `confirmed` field (always `true` for a crossing; for a tangential contact, `true` only when refinement actually converged within tolerance without regressing relative to the coarse sample that triggered it, *and* its computed, exposed `bracket_width_seconds` is at or below an explicit 1-second time-precision tolerance — checked, not assumed from a fixed iteration count); an unconfirmed candidate is never silently dropped, and the React event list visibly distinguishes it (an "unconfirmed" badge, independent of the "tangential" geometry badge); an incomplete or failed sub-search is reported honestly, never as a silent empty success | Domain/command contract | `application::transit::tests` (flag combinations, structurally-locked-pair exclusion, missing-coverage error propagation, probe-allocation formula, direction-change alternation) and `application::event_search::tests` (repeated/retrograde crossings, 0° wrapping, interval boundaries, budget exhaustion, tangential-contact detection on synthetic functions including a refinement-regression case that must come back `confirmed: false`, a minimum sitting strictly between two coarse samples with a sub-10-microsecond time-convergence assertion against an analytically exact minimum, a real graze near an unrelated branch-cut artifact, direct bracket-width measurements at two different initial widths matching the theoretical `0.618^40` narrowing factor, a too-few-iterations case demonstrating an under-converged bracket, and an end-to-end case where a 10-year discovery step produces a well-within-tolerance residual but `confirmed: false` because the resulting bracket exceeds the explicit time-precision tolerance) in Rust; `commands::transits::tests` for the Tauri-level `event_search` response field and backward-compatible omission of both flags; no automated frontend test for the "unconfirmed" badge (manual/visual only, consistent with this component's existing test coverage); no Python parity (the Python sidecar has no event-search endpoint) |
| TRANSIT-003 | `configuration_requests` finds the time interval(s) during which a role-assignment of bodies simultaneously satisfies a configuration pattern (Grand Trine/T-square/Yod/Grand Cross), without requiring any constituent aspect to become exact; deduplication respects each pattern's actual geometric symmetries; role-assignment and best-fit-refinement combinatorial growth are both bounded and reported, never silently truncated | Domain/command contract | `domain::configurations::tests` (per-pattern automorphism validity, including a deliberately-wrong-permutation rejection case) and `application::configuration_search::tests` (orb-interval union/intersection on synthetic data, enumeration-cap and best-fit-cap behavior, dedup of symmetric vs. genuinely-distinct role assignments, a real Grand Trine found against real ephemeris and independently cross-checked against `domain::astrology::detect_chart_configurations` at an interior and a boundary-adjacent time, and a 6x-finer-discovery-step stability check) in Rust; `commands::transits::tests` for the Tauri-level `configuration_requests`/`configuration_matches` wiring; no Python parity (no configuration-search endpoint exists there) |
| TRANSIT-004 | `sampled_series: false` makes the sampled `results` graph series itself opt-in, independent of `time_step_seconds`/any event or configuration search, while keeping the response shape (backend provenance, `event_search`) uniform with the `sampled_series: true` case | Command contract | `commands::transits::tests` (`compute_transit_events_only_response_skips_sampled_series_but_computes_events`, backward-compatible default via `TransitSetup`'s `#[serde(default = "default_true")]`) |
| TRANSIT-005 | `EvaluationContext` shares one position-provider backend and a bounded, FIFO-evicting `(body id, exact epoch)` cache (capacity configurable for tests; 2,000,000 in production) across every exact-aspect, station, and configuration search one `compute_transit_events` call performs, without changing any result — a minimal backend path also skips RA/Dec/Alt/Az/axes/house cusps for a longitude-only or longitude+motion probe, matching the unchanged full path's values exactly for whatever it does compute; the cache is request-scoped only (never shared across requests or between concurrent ones) | Performance/correctness (no API surface) | `infrastructure::jpl_backend::tests::minimal_path_agrees_with_full_path_for_representative_objects_epochs_and_modes` (longitude/motion equality between the full and minimal paths across several bodies, two epochs, both position modes, both `RequiredQuantities` tiers); `application::transit::tests::combined_exact_hits_station_events_and_configuration_request_in_one_call` (all three search kinds sharing one context in one call); `application::evaluation_context::tests` (`eviction_is_bounded_and_drops_the_oldest_entry_first`, `eviction_never_grows_past_capacity_across_many_inserts` — direct, deterministic, small-capacity proof of the FIFO eviction mechanism itself, not just its end-to-end effect; `measures_real_per_entry_memory_cost`, `#[ignore]`, a real `/proc/self/status` RSS-delta measurement checked against the documented `APPROX_BYTES_PER_ENTRY` estimate rather than trusting a hand count); the full existing event-search/configuration-search suite re-passing unchanged after the refactor is itself the regression guard; `application::configuration_search::tests::configuration_search_benchmark` (`#[ignore]`) reports real p50/p95, repetition count and percentile method, and `cache_stats()` (hit/miss/upgrade counts, entry count, measured approximate bytes) against the pre-optimization baseline recorded in `ephemeris-validation.md`, which also documents the distinction between total accesses, true unique working set, and a misleadingly-inflated miss count observed once under an undersized cache |
| ROUTE-001 | Auto routing uses Rust when Python is unavailable | Integration | Rust route-selection tests |
| ROUTE-002 | Forced Python fails clearly when unavailable | Integration | Rust route-selection tests |
| ROUTE-003 | A per-chart `override_ephemeris` JPL kernel does not force Python; only Jyotish/Custom engines do | Integration | `application::compute_router::tests` (Rust-only mode, auto mode with/without Python) and `infrastructure::jpl_backend::tests` (invalid override path, missing auxiliary kernel, partial body coverage) |
| PROVIDER-002 | Chart, transit-series, event-search, and configuration-search computation execute with no network access | Provider/integration | Full `cargo test --lib` (209 tests) re-run inside a Linux network namespace with no interfaces up, plus `compute_transit_events_benchmark` (re-run this pass); the other six release benchmarks were verified the same way in earlier passes and not re-run here — see [ephemeris validation](../ephemeris-validation/#offline-execution-verified-not-just-read-from-source) for the exact mechanism and what it does not cover (the optional Python sidecar, absent in this checkout) |
| COVERAGE-001 | Usable-coverage chain discovery and precedence match the pinned ANISE evaluator's actual behavior, including cases real kernels cannot exhibit | Provider | `infrastructure::ephemeris::usable_coverage_tests` (synthetic-SPK missing link, alternate chain, depth-limit, and different-center-overlap-narrows-coverage cases, alongside real-kernel complete-chain/overlap cases) — see [ephemeris validation](../ephemeris-validation/#usable-coverage-raw-vs-chain-aware) |
| PROVIDER-001 | Provider numerical output matches a named reference within tolerance | Provider | Rust JPL reference tests; optional Python comparison when provisioned; some cases require BSP resources — see [ephemeris validation](../ephemeris-validation/) for the current per-test reference list and known gaps |
| FRONTEND-001 | Both bridges serialize the same chart calculation intent | Frontend bridge/parity | Type/build coverage; **GAP-FRONTEND-001:** dedicated bridge test runner |
| FRONTEND-002 | Both shells open the same workspace and apply the same effective defaults | Workflow/parity | Manual/structural coverage; **GAP-FRONTEND-002:** automated workflow coverage |
| STATIC-001 | Static documentation mode renders the normal shell without native services | Smoke/workflow | Build coverage; automated behavior coverage is a current gap |

When a gap is filled, replace the gap ID and description with the test file and
test name. Do not remove the row; the matrix is also an inventory of deliberate
automation debt.

## Shared fixtures

Use `contracts/` for inputs that must be understood outside one implementation:

- valid and invalid schemas
- settings precedence
- model and school selection
- runtime domain-catalog loading and model-specific catalog projections
- datetime normalization
- workspace interoperability
- canonical aspect cases
- expected diagnostics
- reference astronomical cases and tolerances

A fixture should declare its schema version. Changes that intentionally alter
meaning require either a new version or explicit migration expectations.

## Exact and numerical assertions

Assert exact equality for:

- identifiers and ordering where order is contractual
- selected model and school
- settings provenance
- diagnostics and error codes
- request/result structure
- persistence round trips

Use explicit tolerances for:

- longitude, latitude, declination, and right ascension
- house cusps and axes
- time refinements
- speed and derived physical quantities

Tolerance belongs to the fixture or provider comparison policy, never as an
unexplained number inside an individual test.

## Frontend parity

React and Svelte do not need identical component tests. They do need shared
contract cases for their Tauri payload builders, runtime catalog refresh, and
the same workflow outcomes.
At minimum, test:

- workspace and chart settings produce equivalent command payloads
- selected bodies, aspects, orbs, time, and location reach the backend
- built-in catalog loads before mount and effective catalog refreshes after a
  workspace/chart model changes
- new catalog IDs remain usable through label, glyph, color, and grouping
  fallbacks when dedicated presentation assets are absent
- backend diagnostics and unavailable-provider states are visible
- empty, loading, error, and static-mode states do not fabricate results

The current frontend packages provide type checks but no dedicated behavioral
test command. Adding a runner and a root `test:frontends` script is therefore a
documented implementation gap, not an already satisfied check.

## Commands available today

From the repository root:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run check
npm run check:svelte
npm run docs:build
```

If the optional Python sidecar source is present in the checkout:

```bash
cd backend-python
python -m unittest discover .
```

This checkout does not contain `backend-python/`; the Rust/no-sidecar path is
therefore the locally verifiable backend baseline. Do not report missing Python
tests as passing parity coverage.

Provider tests that require BSP files or optional dependencies may skip. CI and
local output must make those skips visible so a skipped provider suite is not
mistaken for passing numerical validation. See
[ephemeris validation](../ephemeris-validation/) for the ignored-by-default
provider tests, the diagnostic benchmark's exact command, and output
conventions.

## Contract maintenance rule

When behavior changes:

1. Update the normative contract.
2. Add or update its stable test-matrix row.
3. Update shared fixtures when multiple implementations are affected.
4. Implement the change.
5. Run every affected layer, including Rust/Python or React/Svelte parity where applicable.
