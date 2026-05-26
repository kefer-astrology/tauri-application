---
title: "Development driver"
weight: 15
---

# Development driver

This is the current high-level driver for specs-driven development.

## Motivation / Background

Keep future work driven by explicit specs instead of scattered cleanup lists. New behavior should land through the relevant `/docs/content/llm/` contract first, then implementation, then docs/build verification.

## Current State

- React and Svelte follow the shared UI standard: shadcn-style primitives first, semantic tokens for theme behavior, and named domain components for chart/matrix rendering.
- Svelte is parity-compliant with the current React reference. Dynamic, Revolution, and Favorite remain spec-gated because the React reference is also placeholder/workbench-level there.
- Backend/Tauri availability must not decide layout. Static/docs mode keeps the app shell and treats unavailable backend actions as no-ops or explicit disabled states.
- New behavior starts from `/docs/content/llm/` specs before implementation.

## Planned State

1. **Bundle Size And Loading**
   - Lazy-load React feature views from `App.tsx`.
   - Lazy-load Svelte mode components now that the shell delegates to feature views.
   - Add manual chunks for stable vendor groups only after lazy-loading is in place.
   - Measure bundles before and after each split.

2. **Workflow State And Persistence**
   - Wire settings, selected bodies, selected aspects, and transit options to workspace/chart state when the behavior is meant to survive reloads.
   - Keep compute payloads aligned with `frontend-workflow-baseline`, `radix-render-contract`, and `chart-datetime-contract`.
   - Do not add local-only UI state for behavior that affects computation.

3. **Spec-Gated Product Modes**
   - Dynamic requires a dynamic-calculation spec.
   - Revolution requires a revolution-chart spec.
   - Favorite requires a favorites/workbench spec.
   - Deeper Information sections require data-source and acceptance specs.

4. **Backend Runtime Direction**
   - Keep astronomy backend-pluggable, with JPL / SPICE as the preferred long-term direction and Swiss Ephemeris as compatibility/validation infrastructure.
   - Audit true-node behavior outside the documented JPL/Rust path so labels and provenance distinguish mean-node, true-node, and backend-specific approximations.
   - Decide the supported contract for Chiron, TNOs, and other auxiliary bodies: provide a reliable auxiliary source or surface them as unavailable with clear warnings.
   - Remove or label any UI fallback geometry, compatibility path, or prototype surface that appears to expose computed astrology data without backend-backed provenance.
   - Add an end-to-end no-Swiss/no-sidecar smoke path, not only compilation.
   - Validate the optional Python environment end to end when that backend is provisioned.
   - Make backend routing visible: Rust-backed, Python-backed, or auto-routed compute should be clear in docs and user/debug-facing provenance.

5. **Docs And Generated Assets**
   - Source docs live under `docs/content/`.
   - Frontend docs app assets are generated through `npm run docs:prepare`.
   - Hugo output is generated; do not treat `docs/public/` as source of truth.

## Definition Of Done

- The relevant `/llm/` spec exists or was updated.
- Feature UI uses shared primitives and existing domain components.
- React and Svelte parity impact is explicit.
- Static/docs mode still renders the standard shell.
- `npm run check`, `npm run check:svelte`, and the relevant build/docs command pass.
