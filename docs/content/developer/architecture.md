---
title: 'Architecture'
description: 'Current system boundaries, runtime flows, and known boundary debt.'
weight: 40
doc_kind: architecture
status: current
authority: informative
---

This page describes the implementation in this checkout. Statements under
**Intended direction** are not current guarantees.

## Runtime boundaries

```text
React or Svelte
  ├─ presentation, local interaction state, typed Tauri bridges
  └─ invokes Tauri commands
          │
Tauri commands (mixed transport and orchestration today)
  ├─ workspace YAML/loading/writing and model-report/catalog commands
  ├─ backend routing and Python-sidecar calls
  └─ application computation/transit use cases where available
          │
Rust workspace + domain + infrastructure
  ├─ persisted workspace models, validation, settings, domain catalog
  ├─ astrology and house rules
  └─ astronomy, ephemerides, dialogs, geocoding, optional sidecar process
```

Rust is the runtime authority for semantic catalog IDs, model definitions,
settings resolution, validation, calculation, and provider provenance.
Frontends own final presentation: translations, dedicated glyph files, colors,
visual grouping, accessibility/UI state, and fallbacks for unknown catalog IDs.

The serialized Rust model still includes legacy presentation-adjacent fields
such as glyphs, localized names, and aspect colors. They are compatibility data
returned with the catalog, not a transfer of final presentation ownership to
Rust. A frontend may use them as fallbacks.

## Actual flows

### Bootstrap and catalog lifecycle

Both `apps/web-react/src/main.tsx` and `apps/web-svelte/src/main.ts` request
`get_builtin_domain_catalog` before importing/mounting the application. On
workspace open, both `openWorkspaceFolder` implementations call
`getCurrentModelReport`; that bridge requests `get_current_model_report` and
`get_domain_catalog` together and replaces the in-memory catalog.

`get_domain_catalog(workspace_path, chart_id)` can resolve a chart-specific
model when its caller supplies `chart_id`. However, the current workspace-open
flow supplies no chart ID, and selection handlers do not call the bridge.
Selecting a different chart therefore does **not** currently refresh the
catalog. Computing a chart does resolve that chart's settings/model in Rust,
so the displayed catalog and compute model can diverge for chart-specific
models. This is an implementation gap, not a frontend contract.

### Workspace loading

`load_workspace` is the tolerant summary path used by the shells. It parses a
manifest, skips unreadable/malformed chart and analysis references after
logging, and returns summaries of the items it could load. It does not return
diagnostics. `validate_workspace` instead uses `load_workspace_aggregate`,
which attempts every referenced kind and returns structured diagnostics while
retaining successfully loaded items. A missing or malformed `workspace.yaml`
is fatal for both paths. Reference resolution rejects absolute paths and paths
which canonicalize outside the workspace root.

### Calculation and persistence

Chart and transit commands load manifests/charts, resolve settings, select a
route, and then invoke Rust application computation or the optional Python
sidecar. Results are returned to the frontend and retained there in memory;
Rust does not persist computed positions, houses, aspects, configurations,
lunar details, or transit-series results. Transit *setup* is persisted. The
legacy computed-data storage commands are explicit no-ops.

In `auto` mode, a reachable Python sidecar is preferred; otherwise supported
work uses Rust. A forced Python route fails if it is unavailable. Some chart
forms (Jyotish/custom or an override ephemeris) require Python and cannot use
the Rust fallback. Route/fallback data is included in computation results.

## Current responsibility split

- `workspace` owns YAML representations, loading/writing, validation, model
  selection, effective settings, and construction of `DomainCatalog`.
- `domain` owns astrology/house algorithms; `infrastructure` owns providers,
  ephemerides, HTTP/process, geocoding, and native dialogs.
- `application::computation` and `application::transit` own typed Rust compute
  use cases; `application::chart_resolution` assembles resolved computation inputs;
  `application::compute_router` owns reusable route policy.
- `commands::workspace`, `commands::calculation`, and `commands::transits`
  are mixed transport/use-case modules. Workspace and transit-setup commands
  directly perform YAML/filesystem work; calculation/transit commands still
  route backends and call the sidecar. Do not describe them as thin adapters.

## Intended direction and debt

The intended boundary is commands as thin transport adapters over application
use cases, with filesystem/provider orchestration moved behind those use cases.
Only the typed computation and transit cores are substantially there today.
Chart-selection catalog refresh and automated React/Svelte parity coverage are
also incomplete. See [Rust code structure](../rust-code-structure/) for the
module map, [Rust workspace contract](../rust-workspace-contract/) for the
observable lifecycle, and [Testing strategy](../testing-strategy/) for gaps.
