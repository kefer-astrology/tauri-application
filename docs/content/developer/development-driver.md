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

## Widget workspace

The chart screens are one widget workspace: Horoskop, Spektrum and the
Aspectarium are built from widgets. The step-by-step plan, with
the current inventory, architecture and acceptance criteria, is
`WIDGET-PLAN.md` at the repository root.

Direction:

- **Two modules.** _Horoskop_ keeps a protected centre for the wheel with left,
  right and bottom widget regions (growing out of `ChartWorkspaceLayout`).
  _Spektrum_ is a free analytic grid of 12 / 6 / 1 columns.
- **Profiles** choose widgets, their settings, layout per module and screen
  size, and data context. Basic, Modern, Traditional and Kabbalistic are
  presets defined in code, each belonging to one school (Basic and Modern to
  Modern western, Traditional and Kabbalistic to Medieval / traditional); a
  workspace may override them partly. A profile never changes calculation
  settings.
- **Widgets** are manifests over shared archetype views (wheel, data table,
  matrix, proportion chart, timeline, event list, …), following the layer
  rules in the [React component catalog](../frontend-components/).
- **Data context:** a widget follows the active chart, is pinned to one, or
  compares two.
- **Edit mode** for moving and resizing, with a keyboard alternative to
  dragging; positions are locked outside it.
- **One right panel** for profiles, the catalog, widget settings and details;
  side panels never stack.

Already in place: Spektrum on a widget grid (every card from the chart facts,
with an empty state; hover previews and a click locks a focus on the wheel),
the Aspectarium on a widget grid (aspect grid, aspect list,
midpoints with shared filters; the matrix and tables are shared views), the
Horoskop module built from widgets (chart profile, astrolabe, positions around
the protected wheel, from the school's profile),
with a `⋯` menu per widget (remove with Undo), a profile switch and the widget
catalog ("+ Add" / find); changes last for the session,
the shared right panel (`RightPanelProvider`; views opened
from another show on top with Back, nothing stacks), the wheel's chart-half
names matching `facts.distribution`, and the start of the widget model in
`src/lib/widgets/` (types, presets, workspace overrides, school → default
profile).

Remaining:

1. Save workspace profile overrides (today's session changes): a
   workspace-file field in Rust and [workspace YAML](../workspace-yaml/).

Settled: presets are defined in code and a workspace overrides them partly;
profiles never change calculation settings, while the workspace's school
decides which profiles are offered; only Modern western and Medieval /
traditional are available as schools, the others are listed as disabled; dragging uses an own placement model with `@dnd-kit`; the
right panel overlays the content.

## Frontend architecture

- Lazy-load React feature views from `AppShell` (`app/shell/app-shell.tsx`).
- Lazy-load Svelte feature views as its main shell continues to shrink.
- Add manual chunks only after measuring the effect of feature-level lazy
  loading.
- Keep static/docs mode on the normal application shell with unavailable native
  actions disabled or represented honestly.

## React styling consolidation

The current styling rules and text scale live in
[UI conventions](../ui-conventions/#react-typography); the evidence already
collected is in [Testing strategy](../testing-strategy/#react-interface-evidence).

| Category            | Remaining work                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Form controls       | Check remaining native workflows and custom palettes.                                           |
| Typography          | Complete localization, heading hierarchy and populated chart-label review.                      |
| Containers          | Verify native titlebar alignment and populated, resizable chart panes.                          |
| Custom controls     | Audit custom keyboard interactions, touch targets and SVG/glyph geometry.                       |
| Visual verification | Native webview, populated charts, custom palettes, touch devices and a full accessibility pass. |

Verification not yet done:

- The native 480px minimum window (browser review reached 500px).
- Populated wheel labels, matrix cells and transit curves; browser mode has no
  calculated data.
- A full theme × width matrix after the sheet-direction and positions-folding
  changes.

Appearance items:

- **Muted text contrast:** agree whether the CSV's muted text colors may change.
  The light-theme values are below a 4.5:1 contrast target for ordinary small
  text against their default canvases; a larger caption size does not resolve
  the color issue.
- **Color validation:** normalize supported color formats and keep invalid
  settings from reaching CSS or light/dark detection.
- **Selected theme persistence:** restore the selected theme on restart instead
  of always starting with Noon.
- **Opacity memory:** keep the custom alpha beyond the mounted settings section
  if toggling off and on should survive navigation and restarts.

Typography acceptance requires both readable text and usable layout. SVG/canvas
label geometry is part of chart visual verification. A passing build implies no
visual completion.

## Workflow and persistence gaps

- Keep the external chart-import workflow aligned across both frontends. Native
  YAML and StarFisher EventData are supported by Rust.
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
- Spektrum widgets beyond the current chart facts require data-source and
  acceptance contracts.

## Backend runtime direction

- Continue the responsibility extraction recorded in the
  [Rust code structure audit](../rust-code-structure/).
- Keep astronomy providers pluggable, with JPL/SPICE as the preferred long-term
  direction and Swiss Ephemeris as compatibility/validation infrastructure.
- Audit true-node behavior outside the documented JPL/Rust path so labels and
  provenance distinguish mean node, true node, and approximations.
- Extend the Horizons small-body acquisition workflow as new objects are
  selected. It generates bounded Type 13 SPKs from geometric vectors, stores
  request/target/range/checksum provenance, validates held-out states, and
  performs an in-range ANISE probe before registration. Live Horizons calls stay
  out of chart compute. Chiron (`20002060`, 1900–2100) is the first bundled
  artifact; native Type 21 can replace it when ANISE supports that
  representation. See [Ephemeris manager](../ephemeris-manager/) and the
  [Astronomy coordinate contract](../astronomy-coordinate-contract/).
- Ceres/Pallas/Juno/Vesta plus 16 more minor planets are computed on the
  Rust/JPL path via bundled/downloadable BSP kernels. True Lilith is computed via
  an osculating-elements formula in `domain::houses`. Chiron is computed from
  the bundled Type 13 SPK; other catalog-only entries stay visibly unavailable
  rather than silently omitted.
- Extend curated TNO coverage beyond the bundled 1900–2100 packages where
  required. Eris, Sedna, Haumea, Makemake, Quaoar, Orcus and Varuna already use
  validated local Type 13 packages; adding these seven is no longer roadmap
  work. Keep exact usable coverage, acquisition provenance and interpolation
  error limits visible as new ranges or objects are added.
- Geocentric planetary nodes are a distinct technique from the implemented node
  math: geocentric north/south crossings are not exactly 180° apart, unlike the
  Moon's node. Confirm the definition before implementing; do not assume it
  reuses `true_node_tropical_deg` unchanged.
- Extend independent numerical reference coverage for the eight implemented
  Uranian/Hamburg hypothetical models and 32 measured fixed stars. Their
  versioned orbital elements/catalog data and native JPL calculation paths are
  already implemented; broader catalogs and additional model conventions need
  their own sources and validation.
- Resolve the three deliberately unavailable al-Biruni Lot readings
  (Grandparents, the disputed Captivity variant, and Kings) by choosing and
  naming a documented interpretation. The 97-entry catalog already exposes
  94 calculable formulas; do not replace ambiguous source readings silently.
- Remove or clearly label mock/fallback geometry that appears to be computed
  astrology data without backend provenance (the wheel's demo radix).
- Add an end-to-end no-Swiss/no-sidecar smoke path.
- Validate the optional Python environment end to end when provisioned.
- Keep Rust/Python routing and fallback visible in result provenance.

### Small-body startup kernel reuse

**Status: planned.** Package validation currently constructs progressively
larger almanacs for the base kernels plus each newly accepted small body.
Because the almanac cache is keyed by the complete ordered kernel set, each
new prefix reloads the common PCK/BSP files. Repeated `Loading …` messages at
startup reflect real intermediate loads, not duplicate entries in the final
chart kernel list. See [current behavior](../ephemeris-manager/#repeated-kernel-loading-messages-during-startup).

Implementation steps:

1. Measure cold discovery/validation with the primary, asteroid, Chiron and
   seven TNO packages: per-file parse/load counts, distinct almanac sets,
   elapsed startup time and retained memory. Record warm reuse separately.
2. Reuse parsed base kernels while accepting candidates, for example by
   extending a validated almanac, or another approach that preserves candidate
   isolation. Avoid reconstructing every accepted prefix from disk.
3. Retain SHA-256 checks, passing acquisition records, finite position/velocity
   probes, center-chain checks, duplicate rejection and ordered SPICE
   precedence. A bad optional package must not disable valid bodies or become
   selectable merely to reduce load counts.
4. Bound retention of intermediate validation sets without invalidating active
   calculations. Invalidate discovery/path and validation caches after both
   downloads and successful SPK imports; changed file fingerprints must trigger
   revalidation. Imported packages should become discoverable without restart.
5. Distinguish discovery, validation, cache hits and actual kernel loads in
   diagnostics. Reducing log volume alone does not complete this step.

Acceptance: unchanged kernels are not repeatedly parsed just because another
candidate is being validated; warm chart/transit requests reuse the accepted
set. Add regression coverage for cold multi-package discovery, concurrent
callers, import/download invalidation, changed files, rejected packages and
load-order-sensitive chains. Compare resulting positions, motion, warnings
and usable coverage with the current implementation. Publish before/after
measurements in [Validation and performance](../ephemeris-validation/#startup-kernel-loading-evidence)
and close [KERNEL-001](../testing-strategy/#kernel-001-startup-kernel-reuse)
when the new evidence exists.

## Shared core and verification

- Extend shared fixtures beyond time, settings, and workspace interoperability
  to diagnostics, result structures, aspect cases, and numerical reference data.
- Define field-specific provider tolerances.
- Add automated frontend behavior and cross-shell workflow coverage.
- Keep skipped optional-provider tests visible in CI output.
- Make repository `npm run lint` pass: Prettier reports files outside
  `apps/web-react`, and the Svelte frontend has ESLint errors.

See [Shared astrology core](../shared-core/) for the extraction boundary and
[Testing strategy](../testing-strategy/) for the coverage inventory.
