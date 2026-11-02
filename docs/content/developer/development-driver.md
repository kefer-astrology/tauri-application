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

- Lazy-load React feature views from `AppShell` (`app/shell/app-shell.tsx`).
- Lazy-load Svelte feature views as its main shell continues to shrink.
- Add manual chunks only after measuring the effect of feature-level lazy loading.
- Keep static/docs mode on the normal application shell with unavailable native
  actions disabled or represented honestly.

## React styling consolidation

The current styling rules and text scale live in
[UI conventions](../ui-conventions/#react-typography). This table separates the
implemented shared APIs from the remaining design and visual work.

| Category            | Current status                                                                                                                                                  | Remaining work                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Form controls       | Shared variants migrated; date/time inputs share `InputGroup`. Browser review fixed transit field clipping and made the time picker reveal its selected values. | Check remaining native workflows and custom palettes.                                 |
| Typography          | Shared text roles implemented; HTML captions below 12px moved to the rem scale. Narrow aspect-category labels now wrap without overlapping.                     | Complete localization, heading hierarchy and populated chart-label review.            |
| Containers          | Shared surface/bar/Card APIs migrated. Settings and transit navigation now moves above content below 1280px.                                                    | Verify native titlebar alignment and populated/resizable chart panes.                 |
| Custom controls     | Shared choices migrated. Aspectarium tabs wrap at narrow widths; sampled focus, disabled and keyboard states reviewed in Firefox.                               | Audit remaining custom keyboard interactions, touch targets and SVG/glyph geometry.   |
| Visual verification | Initial Firefox review completed across four themes, narrow windows and 200% zoom; scope recorded below.                                                        | Native webview, populated charts, touch devices and full accessibility review remain. |

### Browser review — 2026-11-02

Reviewed the running React app in an isolated Firefox 159 profile using the
default palettes. This was a rendered-browser review with screenshots and DOM
geometry checks, followed by targeted rechecks after fixes.

| Coverage                                          | Result                                                                                                                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All four themes at 1440px                         | Reviewed New horoscope, language/location settings, transit setup and the empty Aspectarium.                                                                                                          |
| Settings at 1024px, 768px and 500px in all themes | Secondary navigation no longer consumes a second fixed 220px column below 1280px; the section strip scrolls horizontally and content scrolls independently.                                           |
| Actual 200% Firefox page zoom                     | Reviewed New horoscope and language/location settings in all themes at an effective 720×457 CSS viewport.                                                                                             |
| Focus, disabled and selected states               | Tab focus ring on form selects and disabled settings confirmation checked in all themes. Space toggles an aspect-category checkbox; time-picker selected values are visible on opening in all themes. |
| Narrow layout regressions                         | Rechecked aspect categories, transit options/date-time fields and wrapped Aspectarium tabs at 500px, 768px, 1024px and 1440px. Grid tracks now use available width rather than fixed column counts.   |

Firefox's outer-window minimum produced a 500px viewport for a requested 480px
window; the native 480px minimum still needs verification. Browser mode has no
calculated positions/aspects in this session, so populated wheel labels, matrix
cells, transit curves and native window chrome are not accepted by this review.
Custom palettes and physical touch interaction were not exercised. The dashboard
still has clickable `div` collapse headers; include these in the remaining
keyboard/accessibility pass. The chart-panel toolbar uses keyboard-accessible
buttons, and the chart/profile pencil actions now have accessible names.

An English-language check covered the edit-chart sheet at 1440px and 500px,
settings with the main rail collapsed, arrow-key navigation to wrapped
Aspectarium tabs, and transit controls at 200% zoom. The chart workspace now
keeps Poloha on the right with an in-place fold button; wide areas show left
details inline, while smaller areas expose them in a right-hand sheet over
Poloha. These final rules are owned by
[UI conventions](../ui-conventions/#react-container-variants).

Responsive chart geometry was checked in Firefox across all four default themes
at 500px, 768px, 1024px and 1440px, plus actual 200% zoom. Sheet-direction and
Poloha-folding changes made after that matrix received source/type and targeted
behavior checks, not another complete visual matrix. Export's final overlay was
checked at wide/narrow sizes, preserving an unsaved form and selected settings
section and restoring focus on close. The evidence inventory and explicit
remaining automation gaps live in
[Testing strategy](../testing-strategy/#react-interface-evidence).

Validation: React type checks, 152 tests and production build passed. Repository
lint is currently blocked by pre-existing formatting issues outside these changes
and ESLint errors in the Svelte frontend. Changed-file formatting and React ESLint
pass separately.

Related appearance work remains open:

- **Muted text contrast:** agree whether the CSV's muted text colors may change.
  The current light-theme values are below a 4.5:1 contrast target for ordinary
  small text against their default canvases; increasing caption size does not
  resolve that color issue.
- **Color validation:** normalize supported color formats and prevent invalid
  settings from reaching CSS or light/dark detection.
- **Selected theme persistence:** restore the selected theme on restart instead
  of always starting with Noon.
- **Opacity memory:** retain the custom alpha beyond the mounted settings
  section if toggling off and on should survive navigation and restarts.

Typography acceptance requires both readable text and usable layout. SVG/canvas
label geometry is outside the HTML text migration and remains part of chart
visual verification. No visual completion is implied by a passing build.

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
