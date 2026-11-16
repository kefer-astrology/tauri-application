# Shared Rust/Python contracts

Language-neutral fixtures that both implementations must satisfy: the Rust app
(`src-tauri`, via `include_str!`) and the Python sidecar
(`kefer-astrology/function-wrapper`, via `KEFER_CONTRACTS_DIR` or a sibling
checkout). This directory is the seed of the planned `kefer-contracts` package.

| File | Kind | Rust consumer | Python consumer |
|---|---|---|---|
| `event-time.json` | accepted/rejected time strings | `event_time.rs` | `tests/test_contract_parity.py` |
| `settings-resolution.json` | layer precedence + provenance | `workspace/settings.rs` | `tests/test_contract_parity.py` |
| `workspace-v1/` | workspace YAML round-trip | `workspace` loader tests | `tests/test_workspace_interop.py` |
| `catalogs/aspects.json` | canonical aspect ids, angles, orbs, aliases | built-in catalog (loaded) | `tests/test_shared_contracts.py` (table must match) |
| `houses/cusps.json` | axes + cusps + substitution warnings, 9 systems x 4 sites | `domain/houses.rs` | `tests/test_shared_contracts.py` |
| `substitution-warnings.json` | warning codes for engine/zodiac substitution | `position_provider.rs` | `tests/test_shared_contracts.py` |
| `points/*.json` | Lots, fixed stars, hypotheticals | built-in catalog (loaded) | not consumed yet |

Rules:

- Changing a fixture is a contract change: update both implementations in the
  same change set (the Python suite reads this directory from `main` weekly).
- `houses/cusps.json` is a *parity* fixture generated from the Rust
  implementation; it is not an independent astronomical reference.
- Aliases in `catalogs/aspects.json` are read-compatible only; writers emit
  canonical ids.
