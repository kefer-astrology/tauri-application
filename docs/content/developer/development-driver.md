---
title: 'Development roadmap'
description: 'Active implementation gaps and planned architectural movement.'
weight: 15
doc_kind: roadmap
status: active
authority: non-normative
aliases:
  - /developer/frontend-gap-implementation-plan/
---

This page owns unfinished cross-cutting work. It does not redefine current
contracts. Contribution rules and the definition of done live in the
[Repository and contribution guide](../project-context/).

When an item lands, update the relevant contract and test-matrix entry, then
remove or narrow the item here.

## Frontend architecture

- Lazy-load React feature views from `App.tsx`.
- Lazy-load Svelte feature views as its main shell continues to shrink.
- Add manual chunks only after measuring the effect of feature-level lazy loading.
- Keep static/docs mode on the normal application shell with unavailable native
  actions disabled or represented honestly.

## Workflow and persistence gaps

- Finish the external chart-import workflow in both frontends. Native YAML is
  supported by Rust; SFS remains staged until its parser path is available.
- Persist settings, selected bodies, selected aspects, and transit options at
  the contractually intended workspace/chart scope.
- Keep payload builders aligned with the
  [Frontend workflow baseline](../frontend-workflow-baseline/),
  [Radix render contract](../radix-render-contract/), and
  [Chart datetime contract](../chart-datetime-contract/).
- Converge transit controls on one canonical observable-object selector and one
  time-step model.
- Add behavioral tests for both frontend payload builders and at least one
  shared workspace-open workflow. Type checks alone do not close this gap.

## Spec-gated product modes

- Dynamic requires a dynamic-calculation contract.
- Revolution requires a revolution-chart contract.
- Favorite requires a favorites/workbench contract.
- Deeper Information sections require data-source and acceptance contracts.
- Aspectarium should consume selected backend-computed objects/aspects, use a
  self-describing matrix, and open relation details only after explicit user
  action. Its current prototype must not become a second source of calculation
  geometry.

## Backend runtime direction

- Continue the responsibility extraction recorded in the
  [Rust code structure audit](../rust-code-structure/).
- Keep astronomy providers pluggable, with JPL/SPICE as the preferred long-term
  direction and Swiss Ephemeris as compatibility/validation infrastructure.
- Audit true-node behavior outside the documented JPL/Rust path so labels and
  provenance distinguish mean node, true node, and approximations.
- Extend the implemented Horizons small-body acquisition workflow as new objects
  are selected. It generates bounded Type 13 SPKs from geometric vectors, stores
  request/target/range/checksum provenance, validates held-out states, and performs
  an in-range ANISE probe before registration. Live Horizons calls remain excluded
  from chart compute. Chiron (`20002060`, 1900–2100) is the first bundled artifact;
  native Type 21 can replace it when ANISE supports that representation. See
  [Ephemeris manager](../ephemeris-manager/) and the
  [Astronomy coordinate contract](../astronomy-coordinate-contract/).
- Ceres/Pallas/Juno/Vesta plus 16 more minor planets are already computed on the
  Rust/JPL path via bundled/downloadable BSP kernels. True Lilith is computed via
  an osculating-elements formula in `domain::houses`. Chiron is now computed from
  the bundled Type 13 SPK; other catalog-only entries remain visibly unavailable
  rather than silently omitted.
- TNOs (Eris, Haumea, Orcus, Quaoar, Varuna, at least) have NAIF kernels under
  `spk/tno/`, but at 168-285MB each (multi-body system files) rather than the
  ~1-60MB kernels used so far; evaluate before adding as downloadable catalog entries.
  Sedna and Makemake did not obviously appear in that directory; confirm coverage
  against its own summary file before assuming either is included.
- Geocentric planetary nodes are a distinct technique from the already-implemented
  node math: geocentric north/south crossings are not exactly 180° apart, unlike the
  Moon's node. Confirm the exact definition before implementing — don't assume it
  reuses `true_node_tropical_deg` unchanged.
- Uranian/Hamburg-school hypothetical bodies (Cupido, Hades, Zeus, Kronos, Apollon,
  Admetos, Vulcanus, Poseidon) and the ~70 fixed stars in `OBSERVABLE_OBJECTS` need
  their reference data (published mean orbital elements; star catalog positions)
  sourced and vetted before implementation, not just method design.
- Remove or clearly label mock/fallback geometry that appears to be computed
  astrology data without backend provenance.
- Add an end-to-end no-Swiss/no-sidecar smoke path.
- Validate the optional Python environment end to end when provisioned.
- Keep Rust/Python routing and fallback visible in result provenance.

## Shared core and verification

- Extend shared fixtures beyond time, settings, and workspace interoperability
  to diagnostics, result structures, aspect cases, and numerical reference data.
- Define field-specific provider tolerances.
- Add automated frontend behavior and cross-shell workflow coverage.
- Keep skipped optional-provider tests visible in CI output.

See [Shared astrology core](../shared-core/) for the extraction boundary and
[Testing strategy](../testing-strategy/) for the coverage inventory.
