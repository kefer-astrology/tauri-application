# Project TODO

This file contains only open, implementable work. Completed tasks are removed. Long-term ideas that still need product or architecture decisions belong in the relevant file under `docs/content/`.

- [ ] **P0 — Make workspace deletion safe.**
  - Update `delete_workspace` in `src-tauri/src/commands/workspace.rs` to canonicalize the requested path.
  - Refuse to delete filesystem roots, home directories, or directories without a valid `workspace.yaml`.
  - Keep the command unexposed until a deletion UI includes explicit confirmation and displays the canonical path.
  - Add Rust tests proving that a valid temporary workspace can be deleted and an arbitrary non-workspace directory cannot.

- [ ] **P0 — Parse timezone-aware event times consistently in Rust and Python.**
  - Interpret a naive local date/time using the chart location's IANA timezone instead of silently using UTC.
  - Preserve the current behavior for RFC 3339 values that already contain an offset.
  - Return distinct errors for unknown timezones and ambiguous or nonexistent local times during daylight-saving transitions.
  - Add shared fixture cases for a normal local time, both DST edge cases, an unknown zone, and an explicit-offset timestamp.
  - Make both implementations consume the same fixture.

- [ ] **P1 — Add the manual Julian-date options to the Svelte chart form.**
  - Match the React form's `gregorian`, `julian_calendar`, and `julian_day` choices in `apps/web-svelte/src/App.svelte`.
  - Put the selector last inside Manual time settings.
  - Convert the entered value to the canonical UTC event time and persist `config.time_system`.
  - Verify create and edit flows for all three choices with `npm run check:svelte` and `npm run build:svelte`.

- [ ] **P1 — Standardize workspace diagnostic paths across backends.**
  - Use stable entity IDs rather than manifest filenames.
  - Adopt paths such as `workspace.charts.{chart_id}.subject.event_time` in Rust and Python.
  - Add a shared diagnostic fixture covering chart, subject, model, and referenced-file failures.
  - Assert `code`, `severity`, and `path` in both languages; message wording does not need to be identical.

- [ ] **P1 — Show compute provenance and warnings in both chart UIs.**
  - Render `backend_used`, `ephemeris_source`, and `fallback_used` near chart metadata in React and Svelte.
  - Show returned `warnings` to the user instead of leaving them only in result objects or the console.
  - Verify an ordinary JPL result, an unsupported-house fallback warning, and a missing optional-body warning such as Chiron.

- [ ] **P1 — Implement Equal and Porphyry houses in the Rust JPL path.**
  - Add direct cusp calculations in `src-tauri/src/houses.rs` and route both systems explicitly in `src-tauri/src/jpl_backend.rs`.
  - Return exactly 12 normalized cusps in house order without a Whole Sign fallback warning.
  - Add tests for cusp count, ordering, angular relationships, and at least one reference chart for each system.

- [ ] **P2 — Add a pull-request quality workflow.**
  - Run `npm ci`, both frontend type checks, both frontend builds, and `cargo test --manifest-path src-tauri/Cargo.toml`.
  - Run translation pruning and synchronization, then fail if `translations.csv` or generated locale files change.
  - Keep the Python sidecar optional and run its contract-parity tests as a separate job when it is present.

- [ ] **P2 — Make `npm run lint` a reliable local and CI check.**
  - Exclude virtual environments, generated `docs/public`, build output, and other vendored or generated files from Prettier and ESLint.
  - Handle Hugo templates separately so Prettier does not parse Go-template expressions as broken HTML.
  - Format the remaining source files once and require `npm run lint` to pass on a clean checkout.

- [ ] **P2 — Add focused frontend tests for date/time conversion.**
  - Add a lightweight test runner for `apps/web-react/src/lib/tauri/chartPayload.ts` and the corresponding Svelte helpers.
  - Cover Julian Day round trips, Julian-calendar conversion, explicit UTC offsets, fractional-offset zones, and DST boundary failures.
  - Add one root script that runs these tests for both frontends and call it from the quality workflow.

- [ ] **P3 — Clean the translation source after the audit.**
  - Remove the unused `overview` and `toast_timezone_invalid` rows reported by `npm run i18n:prune:dry`.
  - Regenerate all React and Svelte locale JSON files with `npm run i18n:sync`.
  - Confirm both frontend checks still pass.
