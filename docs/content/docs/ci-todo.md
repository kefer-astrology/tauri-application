---
title: "CI todo"
description: "Current automation follow-up for docs, i18n, and desktop builds."
weight: 110
---

# CI todo

This page tracks current automation follow-up only.

It is not a frontend planning page and should not be used for general UI backlog notes.

## Translation sync

Current desired CI behavior:

- watch `translations.csv` and `scripts/csv-to-locales.mjs`
- run `npm ci`
- run `npm run i18n:sync`
- fail if generated locale files would change

This keeps `translations.csv` as the source of truth and prevents hand-edited locale drift.

## Desktop build verification

Current desired CI behavior:

- run Rust/Tauri build verification on the target operating systems you actually ship
- install the Rust toolchain and Tauri prerequisites per runner
- build the relevant frontend and then verify the desktop bundle or at least a Rust-side smoke build

The practical target is reproducible desktop builds, not speculative architecture work.

## Optional follow-up

- keep the Python sidecar optional in CI while Rust/no-sidecar remains the baseline
- add signing and notarization only when release workflow is ready

## Scope rule

Keep this page limited to automation:

- i18n sync verification
- docs/build verification
- Rust/Tauri build checks
- optional packaging/signing follow-up

Do not use this page for general UI cleanup or feature planning.
