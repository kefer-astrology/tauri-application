# Licensing

The repository is licensed under the MIT License (`LICENSE`), Copyright (c)
2026 Kube Kubow and Kefer Astrology contributors, with the retained notice of
the `tauri2-svelte5-shadcn` template. Third-party software and data:
`THIRD_PARTY_NOTICES.md`.

## Paths that are not (or not only) MIT

| Path | Status |
|---|---|
| `contracts/` | Vendored copy of `kefer-contracts` (MIT), except `contracts/points/` — third-party-derived data, see `contracts/points/NOTICE.md` |
| `src-tauri/resources/*.bsp`, `*.pca` | Third-party ephemeris data (JPL/NAIF, ANISE-generated), see notices |
| `static/astrology-symbols/sabian*.json` | **Unresolved rights** (Jones/Rudhyar text from a third-party program). Not MIT. Must be removed or cleared before any release. |
| `static/astrology-symbols/kefer*.json` | Original project work; labelled `proprietary-original` in `catalog.json` but distributed in this MIT repository. **Decision needed** (keep MIT, or move to a private module). |
| `static/glyphs/` | Exported from the private `graphical-sources` repository and published here since 2026-04-09 without an exception notice. **Decision needed** — copies already distributed cannot be retroactively restricted [COUNSEL]. |
| Swiss Ephemeris (`swisseph` Cargo feature, not in default builds) | AGPL-3.0 / commercial; a build with the feature is subject to those terms |
| Python sidecar binary (optional, from `function-wrapper`) | Currently AGPL-3.0; separate process |

## Proprietary components

Advanced schools, interpretation texts, original research and graphical
sources belong in private repositories controlled by the Kefer Astrology
nonprofit and must not be committed here.

## Rights holder

Copyright is held by the contributors. A grant of economic rights to the
nonprofit is planned; see
`kefer-contracts/governance/CONTRIBUTOR-AGREEMENT-DRAFT.md` (draft, not in
effect).
