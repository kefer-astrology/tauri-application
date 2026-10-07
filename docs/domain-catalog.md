## Runtime astrology domain catalog

This note is retained as a compatibility pointer, not as a published Hugo
developer page. The canonical documentation is now
[Developer: domain model and extensibility](content/developer/domain-model.md),
with lifecycle details in
[Developer: Rust workspace contract](content/developer/rust-workspace-contract.md).

Rust owns the runtime astrology catalog. `get_builtin_domain_catalog` is used before a
workspace is open; `get_domain_catalog` resolves the effective workspace/model catalog
after a workspace is selected. Both commands return the same `DomainCatalog` contract:
the resolved model (bodies, aspects, and signs), supported house systems, and the
shape/configuration definitions plus generated-variant rules.

React and Svelte load the catalog before importing/mounting the application and refresh
it during their workspace-open flow. The command can resolve a chart-specific catalog,
but current chart-selection handlers do not invoke that refresh; see the canonical
workspace contract for this known gap.

Translation keys, glyphs, colors, grouping, and other visual behavior remain frontend
presentation metadata. Translation strings continue to be generated from
`translations.csv` with `npm run i18n:sync`.
