---
title: 'Testing strategy'
description: 'Canonical test levels, contract traceability, shared fixtures, and Rust/Python/frontend parity.'
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
| Domain unit | Pure astrology, time, validation, and resolution rules | Shared core, Rust, or Python |
| Contract fixture | The same versioned input has the required output | `contracts/` plus every implementation |
| Provider | Astronomy-provider correctness, capabilities, and failures | Rust/Python provider adapter |
| Command integration | Tauri request, routing, serialization, and errors | Rust command/application layer |
| Frontend bridge | Payload construction and result normalization | React and Svelte Tauri bridges |
| Component | Interaction and rendering states | Owning frontend |
| Workflow | A user-visible flow across UI and backend | Desktop/browser integration suite |
| Cross-language parity | Rust and Python preserve shared semantics | Shared fixture runner |
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
| MODEL-002 | Settings resolve fallback → model → workspace → preset → chart → operation | Contract parity | `contracts/settings-resolution.json`; Rust and Python fixture tests |
| MODEL-003 | Model definitions and overrides affect aspect calculation | Domain | Rust astrology/settings tests; Python parity coverage must be kept aligned |
| WORKSPACE-001 | A complete workspace round-trips without losing portable fields | Integration/parity | Rust workspace command tests; Python workspace interoperability test |
| WORKSPACE-002 | Referenced paths cannot escape the workspace root | Integration/security | Rust loader coverage; record a gap if no direct case exists |
| COMPUTE-001 | A radix result exposes the required backend-neutral fields | Command contract | Rust command tests; Python contract-parity tests |
| TRANSIT-001 | Transit ranges reject invalid order and non-positive step | Command contract | Rust command tests; Python parity coverage required for supported routing |
| ROUTE-001 | Auto routing uses Rust when Python is unavailable | Integration | Rust route-selection tests |
| ROUTE-002 | Forced Python fails clearly when unavailable | Integration | Rust route-selection tests |
| PROVIDER-001 | Provider numerical output matches a named reference within tolerance | Provider | Rust/Python JPL reference tests, dependent on fixture availability |
| FRONTEND-001 | Both bridges serialize the same chart calculation intent | Frontend bridge/parity | Partial inline coverage; dedicated runner is a current gap |
| FRONTEND-002 | Both shells open the same workspace and apply the same effective defaults | Workflow/parity | Manual/structural coverage; automated workflow coverage is a current gap |
| STATIC-001 | Static documentation mode renders the normal shell without native services | Smoke/workflow | Build coverage; automated behavior coverage is a current gap |

When a gap is filled, replace the gap text with the test file and test name. Do
not remove the row.

## Shared fixtures

Use `contracts/` for inputs that must be understood outside one implementation:

- valid and invalid schemas
- settings precedence
- model and school selection
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
contract cases for their Tauri payload builders and the same workflow outcomes.
At minimum, test:

- workspace and chart settings produce equivalent command payloads
- selected bodies, aspects, orbs, time, and location reach the backend
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

For the Python sidecar currently present in this checkout:

```bash
cd backend-python
python -m unittest discover .
```

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
