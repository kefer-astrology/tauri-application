# Tag showcase workspace

This directory lives under `src-tauri/tests/` purely for proximity to the
pinned fixture below, not because it's test data itself — it's mutable demo
content opened directly via the app's UI, and no Rust test reads it. A
pinned copy of this workspace lives at `src-tauri/tests/fixtures/tag-showcase`
for `rust_loads_the_tag_showcase_workspace` to load offline, independent of
edits made here. After changing a chart, a transit, or `workspace.yaml`
below, run `npm run fixtures:tag-showcase:sync` to carry the change into
that pinned copy too — see `src-tauri/tests/fixtures/tag-showcase/README.md`.

Open this directory from the application's **Open workspace** action:

```text
src-tauri/tests/sample-workspaces/tag-showcase
```

It contains five charts with overlapping tags from a shared `tag_catalog`:

- `alice-natal` — verified client/family natal record
- `bob-natal` — approximate client/family natal record requiring follow-up
- `company-founding` — mundane organization event used for research
- `product-launch-election` — planned electional chart for Project Alpha
- `contract-horary` — urgent private consultation question

Try creating or editing a chart and type fragments such as `pri`, `ver`, `res`, or `pra` in either tag input. The same styled suggestions and shared colors should appear in the main form and the advanced tag side sheet.
