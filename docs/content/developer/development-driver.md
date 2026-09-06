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
- Decide support for Chiron, TNOs, and other auxiliary bodies. Until then,
  catalog-only entries remain visibly unavailable rather than silently omitted.
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
