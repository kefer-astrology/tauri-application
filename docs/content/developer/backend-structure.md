---
title: 'Backend structure and data ownership'
description: 'Current persistence, resolution, provenance, and backend mechanisms.'
weight: 42
doc_kind: architecture
status: current
authority: informative
---

Rust owns workspace YAML, model/settings resolution, diagnostics, runtime
catalog construction, and the supported no-sidecar calculation route.
`WorkspaceManifest` is an index/persistence representation; loaded charts and
other references are separate representations. `WorkspaceInfo` is only a
tolerant summary projection. `LoadedWorkspace` is the diagnostics-aware typed
aggregate.

`workspace::writer` writes YAML. The storage command module is not a database:
its computed-position/relation writes are no-ops. Frontends keep computation
responses in memory and recompute as needed; persisted transit setup contains
intent, not a computed series.

`workspace::settings` resolves model/settings and emits a source report.
`workspace::validation` separates malformed configuration from provider or
kernel availability. `application::computation` and `application::transit`
consume resolved inputs; astronomy infrastructure computes canonical data; the
domain layer adds astrology results. Result metadata exposes backend used,
fallback state, ephemeris source where available, and warnings.

Python is optional, not a competing persistence/configuration authority. In
auto mode the router prefers an available sidecar and otherwise routes
supported requests to Rust. Some inputs explicitly require Python. See
[Architecture](../architecture/) for the exact routing caveats and [Rust
workspace contract](../rust-workspace-contract/) for loader semantics.
