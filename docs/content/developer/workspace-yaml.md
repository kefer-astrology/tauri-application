---
title: 'Workspace YAML contract'
description: 'Authoritative persisted project structure, settings inheritance, overrides, schools, charts, subjects, and transits.'
weight: 41
doc_kind: contract
status: current
authority: normative
---

This is the authoritative description of the portable workspace format. The
Rust types in `src-tauri/src/workspace/models.rs` are the executable contract.
Paths in `workspace.yaml` are relative to the workspace root, may use nested
folders, and may not escape that root.

## Folder composition

Folders are organizational only; scope comes from the referenced YAML content.
The manifest can therefore point into any depth of subfolder:

```text
my-project/
├── workspace.yaml
├── subjects/
│   ├── clients/alice.yml
│   └── events/company-founded.yml
├── charts/
│   ├── clients/alice/natal.yml
│   └── research/elections/2028.yml
├── presets/charts/research.yml
├── transits/
│   └── clients/alice/natal.yml
├── layouts/comparisons/alice-current-sky.yml
└── notes/research-method.md
```

`workspace.yaml` is an index and the top-level settings owner:

```yaml
schema_version: 1
owner: Example astrologer

active_school: traditional
active_model: traditional-primary       # optional; overrides school.default_model

schools:
  hellenistic:
    id: hellenistic
    default_model: hellenistic-primary
  traditional:
    id: traditional
    extends: hellenistic                 # taxonomy/metadata, not automatic model merging
    default_model: traditional-primary
  modern:
    id: modern
    default_model: modern-primary

models:
  traditional-primary:
    name: traditional-primary
    school: traditional
    version: 1
    engine: swisseph
    zodiac_type: Tropical
    settings:
      default_house_system: Whole Sign
      default_bodies: [sun, moon, mercury, venus, mars, jupiter, saturn, asc, mc]
      default_aspects: [conjunction, opposition, trine, square, sextile]
      default_transit_bodies: [sun, moon, mercury, venus, mars, jupiter, saturn]
      default_transit_aspects: [conjunction, opposition, trine, square, sextile]
      standard_orb: 6.0
      degrees_in_circle: 360.0
      obliquity_j2000: 23.4392911
      coordinate_tolerance: 0.000001
    body_definitions: []                 # full entries shown below
    aspect_definitions: []
    signs: []

model_overrides:
  points:
    - id: pluto
      enabled: false
      only_for: [traditional]
  aspects:
    - id: square
      default_orb: 5.0
      valid_contexts: [chart, transit]
      interpretation_weight: 1.0
  override_orbs:
    conjunction: 7.0

default:                                # calculation defaults only
  ephemeris_engine: swisseph
  default_house_system: Whole Sign
  default_bodies: [sun, moon, mercury, venus, mars, jupiter, saturn, asc, mc]
  default_aspects: [conjunction, opposition, trine, square, sextile]
  default_aspect_orbs: { conjunction: 7.0, square: 5.0 }
  time_system: gregorian
  default_location:
    name: Prague
    latitude: 50.0875
    longitude: 14.4214
    timezone: Europe/Prague

presentation:                           # UI input only; never computation input
  theme: midnight
  language: en
  glyph_set: classic
  element_colors: { fire: '#c24d3d', earth: '#6d7d3d', air: '#ca9b42', water: '#3979a8' }
  aspect_colors: { conjunction: '#555555', square: '#d04444' }

subjects:
  - subjects/clients/alice.yml
charts:
  - charts/clients/alice/natal.yml
chart_presets:
  - presets/charts/research.yml
transit_analyses:
  - transits/clients/alice/natal.yml
layouts:
  - layouts/comparisons/alice-current-sky.yml
annotations:
  - notes/research-method.md
aspects: []                             # legacy external catalog references
bodies: []                              # legacy external catalog references
```

For compatibility, older visual fields under `default` and visual metadata in
model definitions are still readable. New files should use `presentation`.

## Subject versus chart

A **subject** is source evidence: who or what happened, when, and where. A
**chart** is one astrological interpretation of that evidence. Multiple charts
can therefore represent one subject with different models, house systems, or
research assumptions. Current chart files embed their subject for compatibility;
the separate `subjects` collection is the reusable normalized form.

```yaml
# subjects/clients/alice.yml
id: alice
name: Alice Example
event_time: '1990-04-12T08:15:00Z'
location:
  name: Prague
  latitude: 50.0875
  longitude: 14.4214
  timezone: Europe/Prague
```

```yaml
# charts/clients/alice/natal.yml
id: alice-natal-traditional
subject:                              # embedded compatibility representation
  id: alice
  name: Alice Example
  event_time: '1990-04-12T08:15:00Z'
  location:
    name: Prague
    latitude: 50.0875
    longitude: 14.4214
    timezone: Europe/Prague
config:
  mode: NATAL
  model: traditional-primary
  house_system: Whole Sign
  zodiac_type: Tropical
  observable_objects: [sun, moon, mercury, venus, mars, jupiter, saturn, asc, mc]
  selected_aspects: [conjunction, opposition, trine, square, sextile]
  aspect_orbs: { conjunction: 6.0 }
  model_overrides:                   # exceptional definition changes for this chart only
    points:
      - { id: pluto, enabled: true }
    aspects:
      - { id: square, angle: 90.0, default_orb: 4.0, valid_contexts: [chart] }
    override_orbs: {}
  included_points: []
  display_style: ''                  # legacy visual keys; prefer presentation
  color_theme: ''
tags: [client]
```

## Complete calculation definition

A body definition supports `id`, `enabled`, `formula`, `element`, `avg_speed`,
`max_orb`, `object_type`, `computation_map`, `requires_location`, and
`requires_house_system`. `glyph` and `i18n` remain legacy presentation metadata.

An aspect definition supports `id`, `enabled`, `angle`, `default_orb`,
`valid_contexts` (`chart`, `transit`, `direction`), and
`interpretation_weight`. `glyph`, `color`, `line_style`, `line_width`,
`show_label`, `importance`, and `i18n` are legacy UI metadata.

```yaml
body_definitions:
  - id: asc
    enabled: true
    glyph: ''                         # legacy; the UI chooses the glyph
    formula: local horizon/ecliptic intersection
    element: null
    avg_speed: 0.0
    max_orb: 0.0
    i18n: {}
    object_type: angle
    computation_map: { swisseph: asc, jpl: asc, jyotish: asc }
    requires_location: true
    requires_house_system: false
aspect_definitions:
  - id: square
    enabled: true
    glyph: ''                         # legacy
    angle: 90.0
    default_orb: 6.0
    i18n: {}
    color: null                       # legacy
    importance: null                  # legacy UI ranking
    line_style: null                  # legacy
    line_width: null                  # legacy
    show_label: null                  # legacy
    valid_contexts: [chart, transit]
    interpretation_weight: 1.0
```

Sparse `model_overrides` can change a matching point/aspect's `enabled`,
`angle`, `default_orb`, `valid_contexts`, or `interpretation_weight`.
`only_for` limits an entry to matching model names or school IDs. The legacy
`computed` flag from `function-wrapper` is retained losslessly as metadata but
does not enable or disable an entry; use the explicit `enabled` field for that.

## Resolution order

Calculation settings resolve in this order; the last explicit value wins:

```text
application fallback < model < workspace < chart preset < chart < operation
```

Model-definition patches resolve separately in the same direction:

```text
workspace model_overrides < preset model_overrides < chart model_overrides
  < operation model_overrides
```

An absent field inherits. An explicitly empty body/aspect collection means
“none” in preset and operation layers. Existing chart
`observable_objects: []` retains its legacy “inherit” meaning.

School is an extensible string ID, not a closed enum. It classifies a model and
provides its default model. `extends` records lineage; it does not copy settings.

## Persisted transit intent

Transit YAML stores everything needed to repeat the calculation, but never the
computed positions/aspects:

```yaml
version: 1
source_chart_id: alice-natal-traditional
transit_type: transit
period_mode: custom
from_date: '2026-09-01'
from_time: '00:00'
to_date: '2026-10-01'
to_time: '00:00'
time_step_seconds: 3600
school: traditional
model: traditional-primary
model_overrides: null
transiting_bodies: [sun, moon, mercury, venus, mars, jupiter, saturn]
transited_bodies: [sun, moon, asc, mc]
aspect_types: [conjunction, opposition, trine, square, sextile]
aspect_orbs: { conjunction: 2.0, square: 1.5 }
house_transitions: true
sign_transitions: true
exact_hits: true
station_events: true
transit_limits: false
precession_correction: true
```

The source chart supplies subject coordinates and inherited settings. The
transit file chooses the interval, sampling, moving and target bodies, aspects,
orbs, and event families. Exact-time refinement is represented by `exact_hits`;
the current series engine still samples at `time_step_seconds` and may refine
execution in a later compatible implementation.

## What is intentionally not persisted

Computed longitudes, houses, detected aspects, configurations, and transit
series are derived cache candidates, not workspace truth. Reopening a workspace
loads definitions and recomputes results. Device-only UI state such as open
panels, zoom, and window geometry belongs in local frontend storage, not YAML.
Unknown extension keys are ignored when reading and are not guaranteed to
survive a typed Rust save; version and add them to the contract before relying
on them.

## How to test the contract

This contract is tracked by the `MODEL-*` and `WORKSPACE-*` entries in the
[testing strategy](../testing-strategy/). The commands below are the currently
available checks; the central matrix owns cross-contract traceability.

From the repository root:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run check
npm run check:svelte
npm run docs:build
```

Useful focused Rust tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml save_workspace_preserves_the_complete_manifest_contract
cargo test --manifest-path src-tauri/Cargo.toml school_default_and_chart_definition_override_are_resolved
cargo test --manifest-path src-tauri/Cargo.toml aspect_enabled_and_context_are_computation_rules
cargo test --manifest-path src-tauri/Cargo.toml transit_setup_round_trips_without_computed_results
cargo test --manifest-path src-tauri/Cargo.toml rust_loads_the_shared_python_writer_fixture
```

Run the persistence-only Python interoperability test without installing the
optional astronomy/UI extras:

```bash
cd ../function-wrapper
python -m unittest tests.test_workspace_interop -v
```

Both tests consume `contracts/workspace-v1/`. Rust verifies that it can load the
Python-shaped modular files. Python then loads the same Rust contract, resolves
school and chart overrides, writes a new modular workspace, and reopens it.

For a manual fixture, copy the examples above into a temporary folder, include
full body/aspect/sign definitions in the selected model, open it in the app,
then call the `validate_workspace` Tauri command. A safe round-trip is: load the
workspace, save without editing, validate again, and diff the YAML. Catalogs,
schools, overrides, presentation, and references must remain present; computed
results must not appear.
