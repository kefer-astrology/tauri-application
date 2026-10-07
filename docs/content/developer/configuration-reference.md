---
title: 'Configuration reference'
description: 'Implemented calculation settings, scopes, and presentation boundary.'
weight: 39
doc_kind: contract
status: current
authority: normative
---

This reference describes Rust's current serialized/configuration types. The
source of exact enum spelling is `src-tauri/src/workspace/models.rs`; callers
should not treat frontend labels as identifiers.

## Resolution

Calculation settings are merged as follows where a field is represented:

```text
application baseline < model < workspace < preset < chart < operation
```

The output includes `EffectiveSettingsSources`. An omitted optional field
inherits; a provided preset/chart/operation body or aspect array, including an
empty array, replaces the inherited selection. See [Rust workspace
contract](../rust-workspace-contract/) for legacy workspace-body behavior and
the chart `zodiac_type` caveat.

Current calculation fields include house system, selected bodies/aspects and
per-aspect orbs, engine, position mode, zodiac type, ayanamsa, and time system.
Models also carry defaults and computational constants. Workspace defaults add
location and presentation-adjacent defaults. Provider availability is separate
from a valid model/catalog entry.

## Serialized enum families

- House systems: `Placidus`, `Whole Sign`, `Campanus`, `Koch`, `Equal`,
  `Regiomontanus`, `Vehlow`, `Porphyry`, `Alcabitius`.
- Engines: `jpl`, `swisseph`, `jyotish`, `custom`; position modes:
  `apparent`, `geometric`.
- Zodiac types: `Tropical`, `Sidereal`; ayanamsas: `Lahiri`, `Raman`,
  `Krishnamurti`, `FaganBradley`, `DeLuce`, `UserDefined`.
- Time systems: `gregorian`, `julian_day`, `julian_calendar`,
  `unix_timestamp`, `ordinal_date`, `iso_week_date`, `compact_date`.

Stable body/aspect/sign IDs are supplied by the resolved Rust `DomainCatalog`,
not by this prose list. Model definitions may still carry legacy glyph, i18n,
and aspect-color fields. Frontends own final labels, translations, assets,
color choices, grouping, and interaction behavior.

## Persisted non-calculation configuration

Workspace presentation stores optional theme/language/glyph/color and
aspect-line choices; charts store tags, tag colors, and Rodden rating. Transit
setup stores a version, source chart, interval/step, selections, optional
school/model/overrides, and event flags. These fields do not persist computed
results. For field examples see [Workspace YAML contract](../workspace-yaml/).
