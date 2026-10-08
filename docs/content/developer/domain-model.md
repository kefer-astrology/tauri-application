---
title: 'Domain model and extensibility'
description: 'Semantic astrology concepts and ownership of the runtime catalog.'
weight: 38
doc_kind: architecture
status: current
authority: informative
---

Rust owns runtime astrology semantics. This page defines ownership, not YAML
fields; see the [Workspace YAML contract](../workspace-yaml/) for lifecycle
and [Configuration reference](../configuration-reference/) for user options.

## Semantic model

A workspace selects an astrology school/model; a chart may select a model and
carry calculation overrides. A model defines bodies, aspects, signs, defaults,
provider computation mappings, and some calculation policies. The resolved
model plus supported house systems, shapes, configurations, and generated
variants form `DomainCatalog`.

Semantic IDs and computation capability belong to Rust. A body or aspect can
be valid in a model yet unavailable from a selected provider or local
ephemeris; validity and availability are different facts.

## Astrological traditions ("Škola") and the two different things called "school"

The codebase has two unrelated concepts that both get called "school" in
conversation, and they must not be merged:

1. **`AstrologySchoolId` / `AstrologySchool` / `WorkspaceManifest.active_school`**
   (see [Workspace YAML contract](../workspace-yaml/)) — an open, free-form
   string catalog used only to pick a named `AstroModel`. Deliberately not a
   closed enum, so a workspace can define arbitrary schools without an
   application release. It has no direct effect on objects, aspects, or
   orbs — those come from whichever `AstroModel` it points to.
2. **`AstrologicalTradition` / `WorkspaceDefaults.astrology_tradition`**
   ("Škola" in the UI) — a closed enum of seven well-known traditions
   (Hellenistic, Medieval/Renaissance traditional, Modern Western,
   Harmonic/vibrational, Cosmobiology, Uranian/Hamburg, Jyotish–Parāśari).
   Picking one seeds a bundle of settings for that tradition, reusing
   whatever settings fields already exist rather than introducing a parallel
   computation path.

### The seven-axis decomposition

Traditions differ along (at least) seven largely independent axes. Treat a
tradition as a cross-cutting *preset* over these axes, not as a single
monolithic setting — each axis already has, or will eventually have, its own
independently overridable field, exactly like `default_house_system` today
can be overridden per chart regardless of which school picked it:

| Axis | What it covers | Status |
|---|---|---|
| **Zodiac** | Tropical vs. sidereal, ayanāṃśa choice | `ChartConfig.zodiac_type` (`ZodiacType`) and `ChartConfig.ayanamsa` (`Ayanamsa`) exist, but per-chart only — not yet workspace-wide, not yet tradition-linked. |
| **Houses** | Division method (Whole Sign, Placidus, Alcabitius, …) and how houses are used | `HouseSystem` + `WorkspaceDefaults.default_house_system`, enforced as a single workspace-wide value (see "one project, one house system" in the workspace contract). Not yet tradition-linked — picking a tradition does not currently change the project's house system. |
| **Objects** | Bodies, mathematical points (Lots/Parts), fixed stars, hypothetical factors | `BodyDefinition.object_type` (`ObjectType`: Planet/Asteroid/Angle/LunarNode/Part/CalculatedPoint/HouseCusp) and `WorkspaceDefaults.default_bodies` exist. Fixed stars and true hypothetical bodies (the Uranian eight) are **not** modeled yet. Not yet tradition-linked. |
| **Relationships** | Degree aspects, sign-based configurations, directional aspects, midpoints | Degree aspects are fully implemented: `AspectDefinition`, `ObjectTypeRule`/`extended_orb`, `WorkspaceDefaults.default_aspect_*`. **This is the only axis `astrology_tradition` currently drives** (`workspace::tradition::tradition_aspect_preset`). Sign-based "same sign" configurations, Jyotish directional drishti, and midpoint analysis are not implemented. |
| **Planetary condition** | Rulerships, essential/accidental dignities, sect, reception, strength | Not implemented as a general concept. A day/night (sect-like) calculation exists only narrowly, for the Part of Fortune/Spirit formula (`domain::astrology::day_night_parts`) — it is not exposed as a reusable "sect" fact. |
| **Derived charts and timing** | Returns, progressions, directions, harmonics, profections, zodiacal releasing, daśās | `DerivedChartMethod` (Return/Progression/Direction/Relocation/Harmonic/Persona/Composite/Davison/Draconic/Coalescent) covers the modern/general-purpose techniques. Profections, zodiacal releasing, and daśā systems (Hellenistic and Jyotish time-lord techniques) are not implemented. |
| **Interpretation** | Which rules and meanings get applied to a configuration | Not implemented. This application computes and visualizes charts; it does not generate interpretive text. |

Extending a later axis means adding that axis's own settings fields (mirroring
how `default_aspect_include_angles` etc. were added) plus a
`tradition_*_preset`-shaped function, the same pattern `tradition.rs`
established for aspects — it does not require changing
`current_model_report_with_layers`'s precedence chain.

### Purpose is a separate axis, not a school setting

`BaseChartPurpose` (`Natal`/`Event`/`Horary`/`Electional`/`Moment`, on
`ChartDefinition::Base`) already exists as a **per-chart**, tradition-independent
classification — this is "purpose" in the sense of natal vs. horary vs.
electional work. It is orthogonal to `astrology_tradition` today: nothing
couples a chart's purpose to the workspace's tradition (e.g. a horary chart
does not currently nudge toward a traditional-leaning preset). Relationship
charts are handled via `DerivedChartMethod::Composite`/`Davison` plus synastry
analyses rather than a `BaseChartPurpose` variant; there is no dedicated
"mundane" purpose yet (a mundane chart is currently just `Event`/`Moment`).
Coupling purpose to tradition (so that, say, horary work defaults to a
traditional profile) is a plausible future enhancement, not current behavior.

## Catalog ownership

`workspace::model_catalog` builds the standard model, and
`workspace::domain_catalog_for_model` projects a resolved model to the catalog
returned by Tauri. `get_builtin_domain_catalog` is the startup catalog;
`get_domain_catalog` is capable of returning a workspace- or chart-specific
catalog. The catalog is a runtime DTO, not another persisted workspace format.

Rust currently serializes legacy display metadata with model entries, including
glyphs, i18n maps, and aspect colors. That data supports compatibility and
fallbacks. Frontends retain ownership of translations, glyph assets, colors,
visual grouping, interaction state, and presentation-specific fallback labels.
Presentation cannot alter semantic IDs, settings resolution, or computation.

## Lifecycle caveat

Both frontends install the built-in catalog at startup and replace it when a
workspace is opened. Although the Rust command accepts a chart ID, current
chart-selection handlers do not request a chart-specific refresh. The catalog
therefore is not guaranteed to track every selected chart today. Treat that as
technical debt rather than assuming model changes propagate automatically.

The repository note `docs/domain-catalog.md` is a compatibility pointer to this
page and the workspace contract; do not create a second catalog-architecture
page.
