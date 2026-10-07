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
| ROUTE-001 | Auto routing uses Rust when Python is unavailable | Integration | Rust route-selection tests |
| ROUTE-002 | Forced Python fails clearly when unavailable | Integration | Rust route-selection tests |
| PROVIDER-001 | Provider numerical output matches a named reference within tolerance | Provider | Rust JPL reference tests; optional Python comparison when provisioned; some cases require BSP resources |
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
mistaken for passing numerical validation.

## Contract maintenance rule

When behavior changes:

1. Update the normative contract.
2. Add or update its stable test-matrix row.
3. Update shared fixtures when multiple implementations are affected.
4. Implement the change.
5. Run every affected layer, including Rust/Python or React/Svelte parity where applicable.
