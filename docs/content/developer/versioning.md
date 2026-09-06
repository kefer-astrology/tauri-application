---
title: 'Versioning'
description: 'SemVer policy for pre-1.0 releases and how commit types map to version bumps.'
weight: 111
doc_kind: policy
status: current
authority: normative
---

The app is versioned with [SemVer](https://semver.org/) and currently sits pre-1.0 (`0.x.y`). Per the SemVer spec, major version zero is for initial development — anything may still change at any time, so `1.0.0` is reserved for a deliberate stability declaration, not something a commit can trigger on its own.

## Commit type → bump

- `fix:`, `chore:`, `refactor:`, `docs:`, `perf:`, `test:` → **patch** (`0.x.Y`)
- `feat:` → **minor** (`0.X.0`)
- `feat!:` or a `BREAKING CHANGE:` footer → still only **minor** while pre-1.0 — breaking changes don't get their own version segment until `1.0.0` exists to protect
- `1.0.0` → manual, deliberate call once the app is considered ready for general stable use; not derived from any commit

## Where the version lives

One version number is kept in sync across:

- `package.json` (root)
- `apps/web-react/package.json`
- `apps/web-svelte/package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml` / `Cargo.lock`

`backend-python/pyproject.toml` (the Python sidecar) also tracks the same number where practical, since it ships as part of the same release.

## Current state

This is a documented convention enforced by discipline, not tooling — there's no automation yet that reads commit history and computes the next version. Adopting `release-please` or `changesets` would enforce this policy mechanically (single bump PR updating every file above) and is tracked as a follow-up, not yet implemented.
