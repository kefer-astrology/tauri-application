---
title: "Chart datetime contract"
weight: 42
---

# Chart datetime contract

This page defines the canonical chart datetime format shared by the frontends and Tauri commands.

## Canonical rule

- Frontends should emit chart datetimes in one of these forms:
  - `YYYY-MM-DD HH:mm:ss`
  - RFC3339, for example `2026-04-19T14:30:00Z`
- Frontends should not emit localized display formats such as `DD/MM/YYYY HH:mm:ss` in compute or persistence payloads.
- Offset-aware datetimes and naive datetimes are not interchangeable and must not be normalized as if they represent the same local wall clock time.

## Responsibility split

- React and Svelte own formatting outgoing chart datetimes into the canonical shape.
- Rust owns parsing the canonical shape and may keep a small tolerance layer for legacy inputs.
- Python should continue to accept canonical strings and may remain more permissive internally, but frontend payloads should still follow the canonical shape.
- Both Rust and Python must preserve the same instant when consuming offset-aware timestamps.

## Practical implications

- New chart creation in both frontends should produce canonical timestamps.
- In-memory compute payloads and persisted chart payloads should use the same timestamp contract.
- Display formatting for humans is separate from payload formatting.
- Localized display strings should only appear in rendered UI labels, not in stored chart payloads.
- If a chart also carries location timezone metadata, offset-aware timestamps still win for the represented instant; localization should happen after parsing, not before.

## Current accepted backend formats

- Rust currently accepts:
  - `YYYY-MM-DD HH:mm:ss`
  - `YYYY-MM-DD HH:mm`
  - `YYYY-MM-DDTHH:mm:ss`
  - `YYYY-MM-DDTHH:mm:ssZ`
  - RFC3339
  - `YYYY-MM-DD`

## Migration rule

- Legacy localized timestamps may still be tolerated when reading existing in-memory/UI state.
- New writes should always use the canonical contract.
