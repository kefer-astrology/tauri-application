---
title: 'House systems'
description: 'Supported house-system names, calculation setup, and backend coverage.'
weight: 58
doc_kind: implementation-reference
status: evolving
authority: informative
---

House building is the astrology layer that turns a chart's time and place into the 12 house cusps used by the radix wheel and house placement logic.

This app already carries a backend-neutral `house_system` field in workspace defaults and chart config. The first requirement is to keep one clear map of accepted names, required inputs, and backend behavior.

## Required setup

Every house calculation depends on the chart subject:

- event datetime, parsed through the chart datetime contract
- geographic latitude
- geographic longitude
- timezone or UTC offset when the datetime is not already offset-aware
- zodiac policy, currently carried separately as `zodiac_type`
- requested `house_system`

The compute result should expose:

- `axes.asc`
- `axes.desc`
- `axes.mc`
- `axes.ic`
- `house_cusps`, ordered from house 1 through house 12
- backend provenance and warnings when the requested system falls back

## Supported names

These names are accepted by the workspace model, settings UI, and chart payloads.

| Name            | Family                               | Setup rule                                                                                                     | Current backend behavior                                                                                                                              |
| --------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Placidus`      | quadrant, time-based                 | Houses 1, 4, 7, and 10 are the angles; intermediate cusps divide semi-diurnal/nocturnal arcs.                  | Swiss-backed path maps to Swiss code `P`. Rust JPL path computes it directly, with Whole Sign fallback at high latitudes where Placidus is undefined. |
| `Whole Sign`    | sign-based                           | House 1 starts at 0 degrees of the sign containing the Ascendant; each following house is the next whole sign. | Swiss-backed path maps to `W`. Rust JPL path computes it directly.                                                                                    |
| `Campanus`      | quadrant, prime-vertical division    | Divides the prime vertical into equal arcs and projects those divisions to the ecliptic.                       | Swiss-backed path maps to `C`. Rust JPL path currently falls back to Whole Sign with a warning.                                                       |
| `Koch`          | quadrant, time-based                 | Uses birthplace latitude and sidereal time to divide houses by ascensional time.                               | Swiss-backed path maps to `K`. Rust JPL path currently falls back to Whole Sign with a warning.                                                       |
| `Equal`         | equal-house                          | House 1 begins at the Ascendant; every cusp is 30 degrees after the previous cusp.                             | Swiss-backed path maps to `A`. Rust JPL path currently falls back to Whole Sign with a warning.                                                       |
| `Regiomontanus` | quadrant, celestial-equator division | Divides the celestial equator into equal arcs and projects those divisions to the ecliptic.                    | Swiss-backed path maps to `R`. Rust JPL path currently falls back to Whole Sign with a warning.                                                       |
| `Vehlow`        | equal-house variant                  | Equal 30-degree houses centered around the Ascendant axis rather than starting exactly at the Ascendant.       | Swiss-backed path maps to `V`. Rust JPL path currently falls back to Whole Sign with a warning.                                                       |
| `Porphyry`      | quadrant, ecliptic trisection        | Divides each ecliptic quadrant between the angles into three equal parts.                                      | Swiss-backed path maps to `O`. Rust JPL path currently falls back to Whole Sign with a warning.                                                       |
| `Alcabitius`    | quadrant, time/ascensional division  | Divides ascensional arcs from Ascendant to Midheaven and projects cusps to the ecliptic.                       | Swiss-backed path maps to `B`. Rust JPL path currently falls back to Whole Sign with a warning.                                                       |

## Current implementation map

Source of truth for accepted enum names:

- `src-tauri/src/workspace/models.rs`

Frontend settings expose the same list in:

- `apps/web-react/src/app/components/settings-view.tsx`
- `apps/web-svelte/src/lib/components/SettingsView.svelte`

Swiss Ephemeris maps the accepted list through:

- `src-tauri/src/infrastructure/astronomy/swisseph.rs`

Rust JPL house support lives in:

- `src-tauri/src/domain/houses.rs`
- `src-tauri/src/infrastructure/astronomy/jpl_backend.rs`

The current Rust JPL implementation computes axes for all supported chart types, then:

- computes `Whole Sign` directly
- computes `Placidus` directly
- falls unsupported requested systems back to `Whole Sign`
- emits a warning in the compute response when fallback happens

## Default and persistence

The app default is currently `Placidus`.

Workspace defaults persist the selected value as:

```yaml
default_house_system: Placidus
```

Chart config persists the chart-level value as:

```yaml
config:
  house_system: Placidus
```

When chart config omits a house system, the compute path should use workspace defaults, and then the application default.

## High-latitude behavior

Some quadrant and time-based systems can become undefined or unstable at high latitudes because the relevant arcs do not rise or set normally.

Current explicit behavior:

- Rust JPL `Placidus` falls back to `Whole Sign` above roughly 66 degrees latitude.
- The response warning is `placidus_undefined_at_latitude; whole_sign_used`.

Expected behavior for future systems:

- do not silently invent cusps
- return 12 cusps only when the result is valid or the fallback is explicit
- include a warning that names the requested system and fallback
- keep frontend rendering based on returned `house_cusps`, not local assumptions

## Frontend rules

The frontends should treat `house_system` as a persisted calculation setting, not display-only state.

Rules:

- settings changes must update workspace defaults
- chart creation should include the effective house system in the chart payload
- radix rendering must prefer computed `house_cusps`
- legacy `house_1..house_12` position keys are compatibility fallback only
- the UI may expose all accepted systems, but unsupported backend paths must surface provenance or warnings

## Implementation backlog

Before marking house support complete across backends:

- add direct Rust JPL implementations for `Equal` and `Porphyry`; both are simple enough to avoid Swiss-only behavior
- decide whether `Campanus`, `Regiomontanus`, `Alcabitius`, `Koch`, and `Vehlow` should be implemented directly in Rust or treated as Swiss-backed compatibility systems
- add backend tests that compare returned cusp count, ordering, and fallback warnings for every accepted system
- expose compute warnings in both frontend shells near the radix/chart metadata
- document any system-specific latitude limits once each implementation is in place
