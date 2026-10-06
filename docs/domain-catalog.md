## Runtime astrology domain catalog

Rust owns the runtime astrology catalog. `get_builtin_domain_catalog` is used before a
workspace is open; `get_domain_catalog` resolves the effective workspace/model catalog
after a workspace is selected. Both commands return the same `DomainCatalog` contract:
the resolved model (bodies, aspects, and signs), supported house systems, and the
shape/configuration definitions plus generated-variant rules.

React and Svelte load the catalog before importing/mounting the application. Workspace
model resolution refreshes the same runtime catalog, so model-specific definitions do
not get frozen at module initialization.

Translation keys, glyphs, colors, grouping, and other visual behavior remain frontend
presentation metadata. Translation strings continue to be generated from
`translations.csv` with `npm run i18n:sync`.
