---
title: "LLM handoff"
description: "High-signal context for future coding sessions."
weight: 10
---

Use this section as the shortest reliable path back into the repo.

- [Project context](./project-context/) summarizes the architecture, workflows, and active documentation entrypoints.
- [Specs workflow](./specs-workflow/) defines the Codex rule for where to look for specs first and how to use `/docs/`.
- [Rust workspace contract](./rust-workspace-contract/) defines the current Rust-side workspace and no-sidecar rules.
- [Frontend workflow baseline](./frontend-workflow-baseline/) defines the baseline workspace/settings/compute workflows both frontends should satisfy.
- [Chart datetime contract](./chart-datetime-contract/) defines the canonical timestamp shape shared by both frontends and Tauri commands.
- [Import chart contract](./import-chart-contract/) defines the current explicit import workflow and supported file formats.
- [Radix render contract](./radix-render-contract/) defines the current computed output required to render a radix view without mock geometry.
- [Frontend gap implementation plan](./frontend-gap-implementation-plan/) turns the current frontend gaps into a concrete execution sequence.
- [Continuation guide](./continuation-guide/) explains how to pick work up safely and where generated docs artifacts come from.

Architecture direction to keep in mind while using these docs:

- prefer backend-neutral contracts
- keep backend provenance visible
- treat JPL / SPICE as the preferred long-term astronomy direction
- treat Swiss Ephemeris as compatibility and validation infrastructure

When the task is about staged migration rather than immediate contract behavior, also read `/MIGRATION.md`.
