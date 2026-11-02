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

| Level                 | Verifies                                                   | Typical owner                                                   |
| --------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Domain unit           | Pure astrology, time, validation, and resolution rules     | Rust; optional Python peer                                      |
| Contract fixture      | The same versioned input has the required output           | `contracts/` plus each implementation that is provisioned       |
| Provider              | Astronomy-provider correctness, capabilities, and failures | Rust/Python provider adapter                                    |
| Command integration   | Tauri request, routing, serialization, and errors          | Rust command/application layer                                  |
| Frontend bridge       | Payload construction and result normalization              | React and Svelte Tauri bridges                                  |
| Component             | Interaction and rendering states                           | Owning frontend                                                 |
| Workflow              | A user-visible flow across UI and backend                  | Desktop/browser integration suite                               |
| Cross-language parity | Rust and an optional Python peer preserve shared semantics | Shared fixture runner when both implementations are provisioned |
| Smoke/build           | Supported app configuration starts and builds              | Root scripts and CI                                             |

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

## Traceability matrix

| ID            | Required behavior                                                                                                                              | Level                   | Current automation                                                                                                                                                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TIME-001      | Offset-aware input preserves the represented instant                                                                                           | Contract parity         | `contracts/event-time.json`; Rust `event_time` test; Python contract-parity tests                                                                                                                                                                                                                                |
| MODEL-001     | A school selects its default model                                                                                                             | Domain/contract         | Rust workspace settings tests; workspace fixture                                                                                                                                                                                                                                                                 |
| MODEL-002     | Settings resolve fallback → model → workspace → preset → chart → operation                                                                     | Contract fixture        | `contracts/settings-resolution.json`; Rust fixture test; optional Python parity when provisioned                                                                                                                                                                                                                 |
| MODEL-003     | Model definitions and overrides affect aspect calculation                                                                                      | Domain                  | Rust astrology/settings tests; optional Python parity when provisioned                                                                                                                                                                                                                                           |
| WORKSPACE-001 | A complete workspace round-trips without losing portable fields                                                                                | Integration             | Rust workspace command tests and shared workspace fixture; optional Python interoperability when provisioned                                                                                                                                                                                                     |
| WORKSPACE-002 | Referenced paths cannot escape the workspace root                                                                                              | Integration/security    | Rust loader enforces this; **GAP-WORKSPACE-002:** add direct absolute-path and traversal test cases                                                                                                                                                                                                              |
| CATALOG-001   | Built-in and effective runtime catalogs cover model entries and emitted shapes/configurations                                                  | Domain/bridge           | Rust catalog tests; frontend type/build coverage; **GAP-CATALOG-001:** automated React/Svelte refresh and fallback behavior                                                                                                                                                                                      |
| COMPUTE-001   | A radix result exposes the required backend-neutral fields                                                                                     | Command contract        | Rust command/application tests; optional Python contract parity when provisioned                                                                                                                                                                                                                                 |
| TRANSIT-001   | Transit ranges reject invalid order and non-positive step                                                                                      | Command contract        | Rust transit command tests; optional Python parity when provisioned                                                                                                                                                                                                                                              |
| TRANSIT-002   | Exact aspects and stations are independent of sampling; confirmation and incomplete searches remain explicit.                                  | Domain/command          | [Evidence and gaps](#transit-002-event-and-station-search)                                                                                                                                                                                                                                                       |
| TRANSIT-003   | Configuration intervals respect orbs, pattern symmetries, and reported search limits.                                                          | Domain/command          | [Evidence and gaps](#transit-003-configuration-search)                                                                                                                                                                                                                                                           |
| TRANSIT-004   | Disabling sampled output preserves events, provenance, and response shape.                                                                     | Command                 | [Evidence and gaps](#transit-004-events-only-responses)                                                                                                                                                                                                                                                          |
| TRANSIT-005   | Searches share a bounded request-scoped cache without changing numerical results.                                                              | Performance/correctness | [Evidence and gaps](#transit-005-shared-evaluation-cache)                                                                                                                                                                                                                                                        |
| ROUTE-001     | Auto routing uses Rust when Python is unavailable                                                                                              | Integration             | Rust route-selection tests                                                                                                                                                                                                                                                                                       |
| ROUTE-002     | Forced Python fails clearly when unavailable                                                                                                   | Integration             | Rust route-selection tests                                                                                                                                                                                                                                                                                       |
| ROUTE-003     | A per-chart `override_ephemeris` JPL kernel does not force Python; only Jyotish/Custom engines do                                              | Integration             | `application::compute_router::tests` (Rust-only mode, auto mode with/without Python) and `infrastructure::jpl_backend::tests` (invalid override path, missing auxiliary kernel, partial body coverage)                                                                                                           |
| PROVIDER-002  | Chart, series, event, and configuration computation work offline                                                                               | Provider/integration    | Recorded network-isolated runs and scope limits: [offline evidence](../ephemeris-validation/#offline-execution-verified-not-just-read-from-source). Python is not covered.                                                                                                                                       |
| COVERAGE-001  | Usable-coverage chain discovery and precedence match the pinned ANISE evaluator's actual behavior, including cases real kernels cannot exhibit | Provider                | `infrastructure::ephemeris::usable_coverage_tests` (synthetic-SPK missing link, alternate chain, depth-limit, and different-center-overlap-narrows-coverage cases, alongside real-kernel complete-chain/overlap cases) — see [ephemeris validation](../ephemeris-validation/#usable-coverage-raw-vs-chain-aware) |
| PROVIDER-001  | Provider numerical output matches a named reference within tolerance                                                                           | Provider                | Rust JPL reference tests; optional Python comparison when provisioned; some cases require BSP resources — see [ephemeris validation](../ephemeris-validation/) for the current per-test reference list and known gaps                                                                                            |
| FRONTEND-001  | Both bridges serialize the same chart calculation intent                                                                                       | Frontend bridge/parity  | React helper tests and type/build coverage; **GAP-FRONTEND-001:** shared React/Svelte payload parity cases                                                                                                                                                                                                       |
| FRONTEND-002  | Both shells open the same workspace and apply the same effective defaults                                                                      | Workflow/parity         | Manual/structural coverage; **GAP-FRONTEND-002:** automated workflow coverage                                                                                                                                                                                                                                    |
| STATIC-001    | Static documentation mode renders the normal shell without native services                                                                     | Smoke/workflow          | Build coverage; automated behavior coverage is a current gap                                                                                                                                                                                                                                                     |

When a gap is filled, replace the gap ID and description with the test file and
test name. Do not remove the row; the matrix is also an inventory of deliberate
automation debt.

## Transit test evidence

The matrix above is an overview. The following entries retain the detailed
acceptance conditions, test locations, and automation gaps. Observable payload
and behavior requirements belong to the [Transit series contract](../transit-series-contract/).

### TRANSIT-002: Event and station search

Exact aspects and stations are root-found independently of `time_step_seconds`.
Moving-to-radix and moving-to-moving aspect searches are both covered.

`confirmed` is independent of crossing/tangential geometry. Crossings are
confirmed; tangential contacts require a converged residual, no regression
from the triggering coarse sample, and a measured `bracket_width_seconds` of
at most one second. Unconfirmed candidates remain in the response. Incomplete
or failed sub-searches must be reported rather than returned as empty success.

Automation:

- `application::transit::tests`: flag combinations, structurally locked pairs,
  missing coverage, probe allocation, and alternating direction changes.
- `application::event_search::tests`: retrograde/repeated crossings, 0° wrapping,
  boundaries, budgets, tangencies, refinement regression, and branch-cut artifacts.
  Synthetic minima verify sub-10-microsecond time convergence; bracket tests
  check measured narrowing against `0.618^40`. An under-converged bracket and a
  ten-year discovery step verify that a small residual alone cannot confirm a contact.
- `commands::transits::tests`: the `event_search` response and compatibility
  when both search flags are omitted.

Gap: React's independent “unconfirmed” and “tangential” badges have manual/visual
coverage only. Python has no event-search endpoint, so no parity is claimed.

### TRANSIT-003: Configuration search

Configuration matches are within-orb intervals for Grand Trine, T-square, Yod,
and Grand Cross; constituent aspects need not become exact. Deduplication must
respect each pattern's symmetries. Enumeration and best-fit refinement limits
must be reported rather than silently truncating results.

Automation:

- `domain::configuration_topology::tests`: automorphisms preserve pattern edges;
  a deliberately invalid permutation is rejected.
- `application::configuration_search::tests`: interval union/intersection,
  enumeration/refinement caps, symmetric and distinct role assignments, and a
  real Grand Trine cross-checked against `detect_chart_configurations` at an
  interior and boundary-adjacent time. A discovery step six times finer checks stability.
- `commands::transits::tests`: `configuration_requests`/`configuration_matches`
  transport wiring.

Python has no configuration-search endpoint, so no parity is claimed.

### TRANSIT-004: Events-only responses

`sampled_series: false` skips graph samples independently of event and
configuration searches. Provenance and `event_search` retain the normal response
shape. Omitting the option preserves the default sampled behavior.

Automation: `commands::transits::tests::compute_transit_events_only_response_skips_sampled_series_but_computes_events`
and the backward-compatible `TransitSetup` default (`#[serde(default = "default_true")]`).

### TRANSIT-005: Shared evaluation cache

One `EvaluationContext` shares its provider and bounded FIFO cache across the
exact-aspect, station, and configuration searches in one request. The cache key
is `(body id, exact epoch)`; production capacity is 2,000,000 entries, with a
configurable capacity for tests. Requests never share cached positions.

Minimal longitude or longitude-plus-motion probes skip unrelated coordinates,
axes, and house cusps while preserving the full path's computed values.

Automation:

- `infrastructure::jpl_backend::tests::minimal_path_agrees_with_full_path_for_representative_objects_epochs_and_modes`:
  equality across bodies, epochs, position modes, and both `RequiredQuantities` tiers.
- `application::transit::tests::combined_exact_hits_station_events_and_configuration_request_in_one_call`:
  all three search kinds use one context.
- `application::evaluation_context::tests`: `eviction_is_bounded_and_drops_the_oldest_entry_first`
  and `eviction_never_grows_past_capacity_across_many_inserts` directly check FIFO
  eviction with small capacities. The ignored `measures_real_per_entry_memory_cost`
  compares `/proc/self/status` RSS growth with `APPROX_BYTES_PER_ENTRY`.
- The event/configuration regression suites check unchanged results.
  The ignored `application::configuration_search::tests::configuration_search_benchmark`
  reports p50/p95, repetition count, percentile method, and cache statistics.

See [Validation and performance](../ephemeris-validation/#multi-body-configuration-search)
for the recorded baseline, memory estimates, and the distinction between total
accesses, unique working set, and repeat misses caused by an undersized cache.

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

React provides a Vitest runner through `npm test` (or `npm run test -w web-react`),
using `happy-dom`. Tests cover time and settings helpers, chart payload time
conversion, shell composition, and feature rendering. These do not establish
full desktop workflow or React/Svelte parity coverage. Svelte currently provides
a type check but no dedicated behavioral test command.

## React interface evidence

The interface rules live in [UI conventions](../ui-conventions/). This inventory
records automated coverage separately from browser observations and remaining
acceptance work.

| ID             | Required behavior                                                                                                                                    | Current evidence and gap                                                                                                                                                                                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-THEME-001   | Palette tokens reach component surfaces, native color scheme and chart light/dark context; default selected transparency is limited to Sunrise.      | `lib/themePalettes.test.ts` and `app/providers/appearance.test.tsx`. Custom palette validation and muted-text contrast remain open in the roadmap.                                                                                                                                                                           |
| UI-CONTROL-001 | Shared choices preserve selection/deselection, checkbox-label activation, disabled behavior and separate chip removal.                               | `app/components/ui/choice.test.tsx`; compound-picker opening/disabled behavior in `app/components/ui/input-group.test.tsx`. Physical touch and comprehensive keyboard coverage remain gaps.                                                                                                                                  |
| UI-PANEL-001   | Both rails are inline in a wide chart area; compact mode hides only left details, keeps positions mounted, and restores inline details when resized. | `app/components/chart-workspace-layout.test.tsx`. **GAP-UI-PANEL-001:** automated Poloha folding, final sheet-direction geometry and native populated-chart acceptance.                                                                                                                                                      |
| UI-EXPORT-001  | Export opens over the current view and closes without discarding its section or unsaved inputs; focus returns to the opening control.                | Form rendering in `app/features/feature-screens.test.tsx`; Firefox checks preserved an unsaved New-chart field and the selected settings section at 1440px/500px, including Escape/focus return. **GAP-UI-EXPORT-001:** committed automated shell-workflow regression coverage. Export output generation is not implemented. |

The recorded Firefox review covered all four default themes, narrow layouts and
actual 200% page zoom. Later chart-sheet direction/folding adjustments received
source/type and targeted behavior checks; do not infer a fresh full visual matrix
for every revision. The latest Export sheet also received wide/narrow screenshots
and DOM-identity/value checks. Native 480px windows, populated charts, custom
palettes and physical touch remain outside that review. See the
[styling roadmap](../development-driver/#react-styling-consolidation) for remaining
work rather than treating the browser session as full accessibility acceptance.

## Commands available today

From the repository root:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run check
npm test
npm run check:svelte
npm run docs:build
```

`npm test` runs Vitest in `happy-dom`, including both `src/**/*.test.ts` and
`src/**/*.test.tsx` in `apps/web-react/`. Coverage includes pure helpers,
provider behavior, component rendering and selected interactions. Browser
layout, full desktop workflows and React/Svelte parity require additional
verification; passing component tests does not establish those outcomes.

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
