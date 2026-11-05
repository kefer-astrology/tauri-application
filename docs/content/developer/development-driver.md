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
- TNOs (Eris, Haumea, Orcus, Quaoar, Varuna, at least) have NAIF kernels under
  `spk/tno/`, but at 168–285MB each (multi-body system files) rather than the
  ~1–60MB kernels used so far; evaluate before adding them as downloadable
  catalog entries. Sedna and Makemake do not obviously appear there; confirm
  coverage against the directory's summary file first.
- Geocentric planetary nodes are a distinct technique from the implemented node
  math: geocentric north/south crossings are not exactly 180° apart, unlike the
  Moon's node. Confirm the definition before implementing; do not assume it
  reuses `true_node_tropical_deg` unchanged.
- Uranian/Hamburg-school hypothetical bodies (Cupido, Hades, Zeus, Kronos,
  Apollon, Admetos, Vulcanus, Poseidon) and the ~70 fixed stars in
  `OBSERVABLE_OBJECTS` need their reference data (published mean orbital
  elements; star catalog positions) sourced and vetted before implementation.
- Remove or clearly label mock/fallback geometry that appears to be computed
  astrology data without backend provenance (the wheel's demo radix).
- Add an end-to-end no-Swiss/no-sidecar smoke path.
- Validate the optional Python environment end to end when provisioned.
- Keep Rust/Python routing and fallback visible in result provenance.

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
