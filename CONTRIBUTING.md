# Contributing

## Calculations

- `contracts/` is a verified copy of `kefer-contracts`; never edit it by hand.
  Change `kefer-contracts`, then run
  `python scripts/sync-kefer-contracts.py /path/to/kefer-contracts`
  (`cargo test` verifies every file against `contracts/manifest.json`).
- Conformance to independent references runs in
  `src-tauri/src/contract_conformance.rs`.
- Never substitute a calculation silently; use the warning codes in
  `kefer-contracts/CONVENTIONS.md`.
- Do not add GPL/AGPL dependencies to default builds; regenerate
  `THIRD_PARTY_NOTICES.md` with `python scripts/generate-third-party-notices.py`.

## Licensing of contributions

Contributions are accepted under the MIT License (inbound = outbound). Sign
off every commit (`git commit -s`, Developer Certificate of Origin) and
disclose AI-generated material with a `Co-authored-by:` trailer. Do not add
third-party texts, symbol sets or graphics without recorded redistribution
rights (see `LICENSING.md`). A contributor agreement for the Kefer Astrology
nonprofit is in draft (`kefer-contracts/governance/`), not in effect.
