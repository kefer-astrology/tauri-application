---
title: 'Discussion summary'
description: 'Historical architecture notes from the earlier UI phase.'
weight: 10
doc_kind: archive
status: historical
authority: non-normative
aliases:
  - /developer/discussion-summary/
---

Do not treat this page as the live implementation contract. For current
behavior, begin with [system architecture](../../architecture/) and follow its
linked contracts.

## Still useful

- backend-pluggable computation as a long-term direction
- YAML compatibility as a core constraint
- separation between chart definitions and computed data
- the need for precise time navigation and transit-oriented workflows

## No longer current

- DuckDB and Parquet are not the active computed-data persistence model.
- Several sections assumed an earlier Svelte-first UI phase.
- Proposal-era checklists were replaced or deferred.

The original discussion covered storage ideas, sidecar performance assumptions,
historical phases, and open questions around time granularity and query
optimization. It is retained only as historical rationale.
