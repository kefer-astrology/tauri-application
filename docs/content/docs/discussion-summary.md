---
title: "Discussion summary"
description: "Historical architecture notes from the earlier UI phase."
weight: 90
---

# Discussion summary

This page is archival background from the earlier UI phase.

Do not treat it as the live implementation contract.

For current behavior and current architecture, prefer:

1. [architecture](../architecture/)
2. [frontend-react](../frontend-react/)
3. [frontend-svelte](../frontend-svelte/)
4. [tauri-command-contracts](../tauri-command-contracts/)
5. [spice-backend](../spice-backend/)
6. [MIGRATION.md](../../../MIGRATION.md)

## Still useful

- backend-pluggable compute as a long-term direction
- YAML compatibility as a core constraint
- separation between chart definitions and computed data
- the need for precise time navigation and transit-oriented workflows

## No longer current

- DuckDB and Parquet are described there as if they were the active computed-data persistence model
- several sections assume the earlier Svelte-first UI phase
- many checklists reflect proposal-era implementation paths that were replaced or deferred

## Historical note

The original page contained a much larger planning snapshot covering:

- DuckDB and Parquet storage ideas
- sidecar performance assumptions
- historical implementation phases
- old open questions around time granularity and query optimization

That material was useful during the earlier design phase, but it no longer represents the live desktop contract.
