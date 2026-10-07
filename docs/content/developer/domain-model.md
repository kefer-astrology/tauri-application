---
title: 'Domain model and extensibility'
description: 'Semantic astrology concepts and ownership of the runtime catalog.'
weight: 38
doc_kind: architecture
status: current
authority: informative
---

Rust owns runtime astrology semantics. This page defines ownership, not YAML
fields; see [Rust workspace contract](../rust-workspace-contract/) for lifecycle
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
