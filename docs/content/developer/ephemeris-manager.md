---
title: 'Ephemeris manager'
description: 'Multi-BSP catalog, automatic download, and asteroid body support via EphemerisManager.'
weight: 42
doc_kind: implementation-reference
status: current
authority: informative
---

`EphemerisManager` is the Rust module that owns all BSP file lifecycle concerns: what files exist, where they live, which one to load, how to download a missing file, and how to hand multiple files to `anise` as a single chained `Almanac`.

Source: [src-tauri/src/infrastructure/ephemeris.rs](https://github.com/kefer-astrology/tauri-application/blob/main/src-tauri/src/infrastructure/ephemeris.rs)

---

## Why it exists

The original `JplAstronomyBackend` held a single `bsp_path: PathBuf` and loaded one BSP file per compute call. That approach had three problems:

1. **No asteroid bodies.** Planetary DE BSPs (`de440s`, `de440`, …) expose only the ten planets and the Moon as queryable SPK targets. Ceres-class bodies need separate NAIF asteroid kernels.
2. **No upgrade path.** Switching from `de421` to `de440s` required changing code, not config.
3. **No user control.** There was no way for a user to download a larger / longer ephemeris file without replacing the bundled binary.

`EphemerisManager` solves all three by separating catalog knowledge, file resolution, and download from the backend computation.

---

## Architecture

```
infrastructure/ephemeris.rs
│
├── CATALOG: &[EphemerisEntry]        static catalog of known BSP files
│
└── EphemerisManager { cache_dir }
    ├── available_bsp_paths()         → Vec<PathBuf>  (primary + de441 supplements + asteroid SPKs)
    ├── catalog_status()              → Vec<EphemerisInfo>  (for Tauri command)
    ├── download(id, app)             async, streams progress events
    └── *.bsp.json discovery          → checksummed and probe-tested small-body SPKs
```

`JplAstronomyBackend` holds `bsp_paths: Vec<PathBuf>` (resolved at construction time from `available_bsp_paths()`), then chains them with `load_almanac_from_paths()` in `infrastructure/jpl_backend.rs` on each compute call.

A global `OnceLock<PathBuf>` stores the cache directory. It is initialised once during Tauri app setup from `app.path().app_data_dir()`:

```rust
// lib.rs setup closure
if let Ok(data_dir) = app.path().app_data_dir() {
    infrastructure::ephemeris::init_cache_dir(data_dir.join("ephemeris"));
}
```

Anywhere else in the Rust backend: `EphemerisManager::from_global()` returns a manager pointed at that directory.

### Almanac reuse and cache invalidation

`JplAstronomyBackend::build_almanac` keeps a process-lifetime, in-memory cache
of constructed `Almanac`s (`almanac_cache` in `infrastructure/jpl_backend.rs`),
keyed by joining every resolved path's `length:modified-time` fingerprint
(`almanac_cache_key`). This avoids re-parsing the PCK and every chained BSP
file on each compute call — it is a **kernel-load** cache, not a cache of
computed positions; every body query still evaluates its SPK Chebyshev record
fresh for the requested epoch (see the
[astronomy coordinate contract](../astronomy-coordinate-contract/#shared-state-evaluation-and-caching)
for that distinction).

Limitations of fingerprint-based invalidation:

- It relies on OS-reported file length and modification time. A filesystem
  with coarse mtime resolution, or a replacement that preserves both length
  and mtime (unusual, but not impossible with some sync/restore tools), would
  not be detected as a change.
- The cache is per-process and in-memory only; it is not persisted and does
  not need explicit eviction — process restart clears it.
- It is distinct from the small-body artifact probe cache
  (`artifact_probe_cache`), which caches *validation* results (SHA-256 +
  in-range ANISE probe) keyed the same way, not the constructed `Almanac`
  itself.

---

## BSP catalog

The static catalog and `available_bsp_paths()` define which files Kefer can download and which kernels are chained for JPL compute. Planetary kernels live under NAIF `spk/planets/`; asteroid kernels under `spk/asteroids/` (single-body archives use `asteroids/a_old_versions/`).

| id                   | filename                    | size (approx.) | date range                | queryable bodies                    | notes                                              |
| -------------------- | --------------------------- | -------------- | ------------------------- | ----------------------------------- | -------------------------------------------------- |
| `de440s` _(default)_ | `de440s.bsp`                | 32 MB          | 1900–2050                 | 10 planets + Moon                   | bundled primary default                            |
| `de440`              | `de440.bsp`                 | 115 MB         | 1550–2650                 | 10 planets + Moon                   | downloadable upgrade                               |
| `de441_part1`        | `de441_part-1.bsp`          | ~1.5 GB        | −13 200 to 0              | 10 planets + Moon                   | supplementary (cache)                              |
| `de441_part2`        | `de441_part-2.bsp`          | ~1.5 GB        | 0 to +17 191              | 10 planets + Moon                   | supplementary (cache)                              |
| `ceres_spk`          | `ceres_1900_2100.bsp`       | ~1.1 MB        | 1900–2100                 | `ceres`                             | optional single-body download                       |
| `pallas_spk`         | `pallas_1900_2100.bsp`      | ~1.1 MB        | 1900–2100                 | `pallas`                            | optional download                                  |
| `vesta_spk`          | `vesta_1900_2100.bsp`       | ~1.1 MB        | 1900–2100                 | `vesta`                             | optional download                                  |
| `codes_300ast`       | `codes_300ast_20100725.bsp` | ~59 MB         | 1600–2200                 | subset of 300 asteroids (see below) | bundled; includes Ceres and **Juno** (`2000003`)    |
| manifest artifact    | `chiron_1900_2100_type13.bsp` | ~1.1 MB       | 1900–2100                 | `chiron`                            | bundled Horizons-derived Type 13; not a static download row |

**The "date range" column above is catalog/documentation-facing metadata, not
measured BSP coverage.** Directly inspecting the bundled kernels'
actual stored segments (`almanac.spk_summaries`, the same evaluator
`get_loaded_spk_coverage`/`get_usable_coverage` use) shows real stored ranges
that differ from the table above, sometimes significantly:

- `de440s.bsp`'s Sun/Earth/Earth-Moon-barycenter segments are actually stored
  from **1849-12-26 through 2150-01-21** — noticeably wider on both ends than
  the "1900–2050" label, which reflects NAIF's documented/recommended
  accuracy window, not the file's physical Chebyshev coverage.
- `codes_300ast_20100725.bsp`'s Ceres segment specifically is actually stored
  from **1799-12-30 through 2199-12-13** — narrower on the start side than
  the table's "1600" (other asteroids in that same multi-body file may have
  different individual windows; this was checked for Ceres only).

Treat the table as a rough, documentation-facing guide for deciding which
file to download, not as a source of truth for whether a specific chart date
is actually covered. For an authoritative answer, use
[`get_usable_coverage`](#runtime-coverage-inspection) (chain-aware) or
[`get_loaded_spk_coverage`](#runtime-coverage-inspection) (raw per-target,
faster but ignores center-chain completeness) against the currently loaded
kernel set, not this table. See
[ephemeris validation](../ephemeris-validation/) for the reproducible test
that measured the two figures above.

Current status:

- The DE and traditional asteroid rows are active static `CATALOG` entries with
  `download_ephemeris` support. Horizons-derived rows are discovered from their
  adjacent manifests instead of hard-coded into that catalog.
- The primary planetary kernel resolves from cached **`de440s` → `de440`**, then
  falls back to the explicitly bundled `de440s`.
- After the primary and any cached `de441_part-*` files, the manager appends any resolved **asteroid** kernels in fixed order: Ceres → Pallas → Vesta → `codes_300ast`, then validated manifest-defined small-body kernels.
- `tauri.conf.json` `bundle.resources` includes `pck11.pca`, `de440s.bsp`,
  `codes_300ast_20100725.bsp`, and the Chiron Type 13 BSP plus manifest. The
  standalone Ceres kernel is not bundled.

Planetary BSP base URL (NAIF HTTPS):

`https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/`

Asteroid BSP URLs are given per entry in `CATALOG` (under `spk/asteroids/` or `spk/asteroids/a_old_versions/`).

### Important: asteroids are NOT in these files

The 343 asteroids integrated alongside the planets in DE440/441 (Ceres, Pallas, Vesta, Juno, etc.) are **integration perturbers only**. They improve planetary accuracy but their positions are **not stored as queryable SPK segments** in any of the DE planetary files. Querying `NAIF 2000001` (Ceres) from `de440s.bsp` will fail.

To get asteroid positions, a **separate dedicated asteroid SPK kernel** is required:

| source                                             | what it provides                  | notes                                    |
| -------------------------------------------------- | --------------------------------- | ---------------------------------------- |
| Individual NAIF files (`ceres_1900_2100.bsp` etc.) | single-body, 200-year window      | publicly archived on NAIF                |
| `codes_300ast_20100725.bsp` (59 MB)                | 300 asteroids, Baer 2010 solution | one download covers most                 |
| JPL Horizons file API                              | arbitrary supported small bodies | generates a bounded SPK artifact; never queried from the chart compute path |

Asteroid **Kefer IDs** and matching NAIF `2000xxx` frames are wired in `infrastructure/jpl_backend.rs` (small-body table). The backend calls `almanac.transform(...)` per body so translation and the Earth mean-of-date rotation happen together; if no SPK segment exists for that epoch, the chart still succeeds and a per-body `{id}_unavailable` warning is recorded.

All 20 named bodies in the table below (Ceres through Massalia) are also registered in the built-in `BodyDefinition` catalog (`workspace/model_catalog.rs`, mirrored in `backend-python/module/model_catalog.py`), so they are selectable objects, not just resolvable NAIF frames. `astraea` through `massalia` are marked JPL-only in `computation_map` — Swiss Ephemeris support would need asteroid `.se1` files this project does not bundle — and use a circled-digit glyph matching their minor-planet number, since none of them has a dedicated astrological symbol in wide use. A `codes_300ast_minor_planets_resolve_from_bundled_kernels` test in `jpl_backend.rs` confirms all 16 actually resolve from the bundled kernels, not just that the catalog entry exists.

**Default chart** (`observable_objects` unspecified): because
`codes_300ast_*.bsp` is bundled and therefore on the normal load path, the backend
evaluates the configured 20-body subset (`CODES_300AST_MAJOR_BODIES` in
`infrastructure/ephemeris.rs`: Ceres through Massalia). Without that kernel, only
the four classical asteroids (Ceres, Pallas, Juno, Vesta) are attempted. When the
client passes an explicit object list, every listed body is attempted.

### Runtime coverage inspection

Two Tauri commands expose coverage, at two different levels. Neither invents
coverage: both are built directly on the real evaluator, not file-declared
ranges.

**`get_loaded_spk_coverage`** exposes **raw** domains read from loaded SPK
segment summaries (NAIF target ID, ET seconds, and TDB endpoints) — the union
of whatever epochs the *target's own* segments span, with no regard for
whether anything connects it back to Earth. This is a diagnostic inventory,
not a promise that a body can be transformed from Earth: a chart query also
requires an unbroken target-to-Earth center chain at the requested epoch and,
for apparent output, at the retarded epoch. Gaps remain explicit errors; the
backend never extrapolates.

**`get_usable_coverage(naif_target_id, apparent)`** answers the actual
question "would a chart query at this epoch succeed end-to-end": it
discovers the real ascent chain from *both* the target and Earth toward the
common ephemeris root (two separate calls to ANISE's own
`Almanac::ephemeris_path_to_root`, reading real loaded-segment target/center
metadata — not a hardcoded anchor list; see the scope note below for why both
sides are necessary), collects every segment boundary along the discovered
ids, and probes the real `Almanac::transform` at each resulting
sub-interval's midpoint. `apparent: true` probes with converged light-time +
stellar aberration, so apparent coverage already reflects whatever the
retarded epoch can or cannot resolve. `chain_ids_considered` lists every
center id actually discovered (plus the target's own id and Earth's own id,
which are definitional, not discovered), and `intervals` can be more than one
entry — a genuine gap (or disjoint alternate-path coverage) is reported as
two separate windows, never bridged.

The report's `determination` field is `"determined"` or `"unknown"`, and a
caller must not treat them the same:

- **`determined`** — chain discovery succeeded at least once for both the
  target's own ascent and Earth's own ascent, so the boundary set is believed
  complete for the chains actually observed.
- **`unknown`** (with a `reason`) — chain discovery never succeeded for one
  side despite the target having its own loaded segment(s) — for example a
  genuinely broken center link, or a chain deeper than ANISE's 8-node limit.
  The `intervals` field still holds real `Almanac::transform` probe results
  (never fabricated), but the boundary set that produced them may have missed
  an internal transition, so treat them as a conservative, possibly-too-coarse
  approximation rather than a confirmed answer. An empty result for a target
  with **no** loaded segment at all, or where Earth itself has no loaded data
  at all, is still conclusively `determined` — absence of data is itself a
  confident answer, not a discovery failure.

This is implemented in `infrastructure::ephemeris::usable_earth_relative_coverage`
and covered by tests for complete chains, missing links, gaps, alternate
chains, and overlapping/precedence scenarios (including ones built from a
hand-crafted synthetic SPK, for cases no bundled or realistically
downloadable kernel can exhibit on demand) — see
[ephemeris validation](../ephemeris-validation/#usable-coverage-raw-vs-chain-aware)
for exactly what those tests exercise and what they do not.

Scope limitation: discovering the target side's chain requires the target to
already have at least one loaded segment of its own (there is nothing to walk
from otherwise); beyond that, chain discovery makes no assumption about which
intermediate bodies exist — it reads whatever `ephemeris_path_to_root`
reports from the loaded data, for any depth up to ANISE's own 8-node limit.

The bundled installation exposes ten classical bodies, 20 named asteroids, and
Chiron—not approximately 300 selectable bodies. DE441 extends the
planetary/lunar foundation, but does not supply independently queryable asteroid
or satellite trajectories; those require their own SPKs.

### NAIF body IDs

Standard planets use named constants from `anise::constants::frames`. Asteroid frames use `Frame::from_ephem_j2000(...)` in `infrastructure/ephemeris.rs`:

| Kefer ID               | NAIF ID               | Typical kernel                                                                        |
| ---------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| `ceres`                | 2 000 001             | bundled `codes_300ast`; optional `ceres_1900_2100.bsp` single-body download            |
| `pallas`               | 2 000 002             | `pallas_1900_2100.bsp` or `codes_300ast`                                              |
| `juno`                 | 2 000 003             | **`codes_300ast` only** (no standalone `juno_1900_2100.bsp` in NAIF `a_old_versions`) |
| `vesta`                | 2 000 004             | `vesta_1900_2100.bsp` or `codes_300ast`                                               |
| `astraea` … `massalia` | 2 000 005 … 2 000 020 | `codes_300ast_20100725.bsp`                                                           |
| `chiron`               | 20 002 060            | bundled validated Type 13 generated from Horizons geometric vectors; 1900–2100 |

---

## File resolution

`available_bsp_paths()` builds the SPK load list in **four** stages. During
almanac construction, the bundled `pck11.pca` planetary-constants kernel is
loaded first; ANISE requires it to resolve the IAU 2006 dynamic Earth MOD frame.
Failure to locate or load that required orientation kernel is fatal rather than
silently falling back to scalar precession. The bundled v0.10 artifact has SHA-256
`d585b8a04717d8a25195dc6357066a1de125a9cb300c1e224582fd9e443303e3`.

### 1 — Primary BSP (exactly one)

The first match in this ordered list is used; the rest are skipped:

```
cache/de440s.bsp   (user downloaded)
cache/de440.bsp    (user downloaded)
bundled de440s.bsp (active Tauri resource directory)
```

`de440s.bsp` is bundled with the app in `src-tauri/resources/`.

Exactly one primary is selected because all three files cover overlapping date ranges for the same bodies (see below). Loading two of them simultaneously would produce duplicate SPICE segments and undefined behaviour.

### 2 — Supplementary BSPs (de441 parts)

Each `de441` part found in the **cache** directory is appended **after** the primary. These extend coverage into dates the primary cannot reach.

### 3 — Asteroid supplementary BSPs

For `ceres_1900_2100.bsp`, `pallas_1900_2100.bsp`, and
`vesta_1900_2100.bsp`, the manager looks only in the app-data **cache** because
they are optional downloads. `codes_300ast_20100725.bsp` may resolve from the
cache or the active Tauri resource directory because it is explicitly bundled.
This distinction prevents obsolete files left under `target/*/resources` from
silently becoming bundled kernels again.

Once Tauri supplies `resource_dir()`, that directory is the sole bundled-resource
root and all resolved paths are canonicalized. Source-tree resource lookup is a
non-Tauri/unit-test fallback only. Consequently a source manifest and its copied
development resource cannot be registered twice.

**Load failures after the primary:** `load_almanac_from_paths` requires the **first** path to parse successfully. If a later file (de441 supplement or asteroid SPK) fails — for example an incompatible DAF endian with the current `anise` build — that file is **skipped** with a `log::warn!` and the almanac keeps the previous successful chain so charts still compute (e.g. planets without optional asteroids).

### Horizons acquisition boundary

Horizons' native Chiron SPK resolves target `20002060` but uses Type 21, which
ANISE 0.10.6 cannot evaluate. The implemented acquisition workaround is
`scripts/generate-horizons-type13.py`:

1. Request Sun-centred, geometric ICRF `VECTORS` over a bounded interval.
2. Keep one set as interpolation knots and request an offset set as held-out data.
3. Validate degree-7 Hermite position and velocity against those held-out states.
4. Invoke a caller-supplied, pinned NAIF `mkspk` executable to write SPK Type 13.
5. Write `<kernel>.bsp.json` containing target/center IDs, coverage, full request
   provenance, interpolation settings, error maxima, and SHA-256.

The script deliberately does not download `mkspk`; release tooling supplies the
pinned executable and NAIF leap-seconds kernel explicitly. For example:

```bash
python3 scripts/generate-horizons-type13.py \
  --start 1900-01-01 --stop 2100-01-01 \
  --mkspk /path/to/mkspk --lsk /path/to/naif0012.tls \
  --output src-tauri/resources/chiron_1900_2100_type13.bsp
```

The bundled result uses four-day source samples and a degree-7 Type 13 segment.
Across 2,300 held-out samples its maximum observed errors were 0.0391025 km and
`6.38884e-8` km/s. Its SHA-256 is
`ceb7b8078c735b1108df1a410165c662b4db5277fd9765e43a5c97d0511e00e1`.

### 4 — Manifest-defined small-body SPKs

The manager scans the cache and bundled resource locations for `*.bsp.json`.
Before appending the referenced BSP or exposing its `body_id`, it requires:

- schema 1, artifact kind `horizons-sampled-spk`, J2000 frame, Sun centre, Type 13
- a passing validation record whose errors remain under its declared thresholds
- an artifact SHA-256 matching the manifest
- a successful finite ANISE position-and-velocity probe within stated coverage,
  transformed through `EARTH_MOD_FRAME`

Probe results are cached against file metadata for the process lifetime. Editing
either artifact invalidates the cache. Invalid supplementary artifacts are logged
and skipped without breaking planetary charts.

This is also the extension mechanism for a new small body. Generate its BSP into
the app-data `ephemeris/` directory (or copy both generated files there), and use
the same stable `body_id` in a workspace `BodyDefinition.computation_map.jpl`.
The astronomy backend derives `Frame::from_ephem_j2000(naif_target_id)` from the
accepted manifest, so adding a body does not require another Rust frame constant.
Presentation metadata such as label, glyph, category, and default inclusion still
belongs to the workspace/model catalog; an SPK manifest does not silently modify
the user's astrological model.

**Load order and duplicates:** SPICE-style chaining uses **last-loaded wins** when two files both define a segment for the same body and epoch. Asteroid files are appended **after** the planetary primary (and after any de441 supplements). Among asteroid files, **`codes_300ast` is loaded last**, so if you have both `ceres_1900_2100.bsp` and `codes_300ast`, the CODES segment for Ceres takes precedence for overlapping epochs unless you remove one of the files from the path.

Precision matters here: `anise::almanac::Almanac::spk_summary_at_epoch` walks loaded files in **reverse load order** and *falls through* to the next-earlier file whenever the most-recently-loaded one has no valid segment **for that exact body id** at the probed epoch. "Last loaded wins" therefore only decides **which file's numbers** are used for an epoch multiple files cover for the *same* target — it does not shrink coverage merely because an earlier file also had data, since an epoch the last-loaded file doesn't cover for that id falls through normally.

**This is narrower than "last loaded wins can never shrink usable coverage" — an earlier, over-general version of this claim turned out to be wrong.** The fall-through above only protects you when the shadowing (last-loaded) file has **no entry at all** for that epoch. If it **does** have an entry — for the same target, at an overlapping epoch, but through a **different, dead-end center** — that entry wins outright and chain resolution fails there, even though an earlier-loaded file would have resolved that exact instant through its own (different) center. A synthetic-kernel test proves this directly:
`last_loaded_file_can_shadow_an_otherwise_valid_chain_with_a_dead_end` (`infrastructure::ephemeris::usable_coverage_tests`) loads two kernels where a later file's overlapping segment for the same target routes through a center that has no chain of its own; resolution succeeds immediately outside that overlap and fails inside it. This has not been observed in any bundled or downloaded kernel pair in this project (every real pair checked — `ceres_1900_2100.bsp` vs. `codes_300ast`, see `load_order_does_not_change_usable_coverage_when_one_segment_is_a_superset` — happens to share a fully valid chain on both sides), but it is reachable in principle and must not be asserted away. See [ephemeris validation](../ephemeris-validation/#usable-coverage-raw-vs-chain-aware) for the full precedence test matrix.

---

## Date range overlaps

Understanding which files overlap matters both for the primary-selection logic and for deciding when a de441 download actually adds value.

### Coverage map

```
                    -13200        0       1550  1900   2050  2650        17191
                       │          │         │     │      │     │            │
de441_part1   ─────────────────────┤         │     │      │     │            │
de441_part2             │          ├─────────────────────────────────────────┤
de440                   │          │         ├─────────────────────┤         │
de440s                  │          │         │     ├────────┤       │         │
```

### Overlap pairs

| Pair                      | Overlap range | Consequence                                      |
| ------------------------- | ------------- | ------------------------------------------------ |
| de440s ∩ de441_part2      | 1900–2050     | de440s is entirely inside de441_part2            |
| de440 ∩ de441_part2       | 1550–2650     | de440 is entirely inside de441_part2             |
| de440s ∩ de440            | 1900–2050     | de440s is entirely inside de440                  |
| de441_part1 ∩ de440       | none          | de441_part1 ends at year 0; de440 starts at 1550 |
| de441_part1 ∩ de440s      | none          | same reason                                      |
| de441_part1 ∩ de441_part2 | year 0 only   | one-epoch boundary; negligible                   |

### What happens when overlapping files are loaded together

SPICE (and `anise` following the same convention) resolves duplicate segments using **last-loaded wins**: when two loaded BSP files both have a segment for the same body at the same epoch, the segment from the file loaded most recently takes effect.

`available_bsp_paths()` appends de441 parts **after** the primary:

```
paths = [de440s, de441_part2]   ← de441_part2 loaded last
```

This means for a chart dated in 1900–2050 when both files are loaded:

- **de441_part2 takes effect** (it was loaded last)
- de440s data is present but shadowed for that epoch

For normal astrological use (1900–2050), this is acceptable: DE441 was derived from the same initial conditions as DE440 and the accuracy difference in the modern range is sub-arcsecond. A future optimisation could detect the chart's date and skip the de441 supplement when the primary already covers it — but this is not currently implemented.

### When to download de441 parts

| Intended use                                       | File needed                   |
| --------------------------------------------------- | ----------------------------- |
| Modern charts (1900–2050)                           | de440s (bundled, no download) |
| Renaissance / medieval (1550–2650, outside 1900–2050) | de440                         |
| Year 1 AD – 1549 (before de440's coverage starts)   | de441_part2                   |
| Before 1 AD / BCE (year ≤ 0)                        | de441_part1                   |
| Far-future charts (after 2650)                      | de441_part2                   |

`de441_part1` only reaches year 0; it does **not** cover "all dates before
1550" — the gap between year 0 and 1550 (where de440 starts) is covered by
`de441_part2`, not `de441_part1`. Pick the supplementary file by the actual
chart year against the coverage map above, not by a single "ancient" bucket.

You do **not** need to download de441 if all your charts fall inside de440s's 1900–2050 window.

### Per-chart override

Setting `chart.config.override_ephemeris` to a valid `.bsp` path bypasses the manager entirely — only that single file is loaded. `JplAstronomyBackend::new` and `jpl_backend_for_chart` (`infrastructure/jpl_backend.rs`) implement this directly in Rust, and the public compute commands now reach that path: `application::compute_router::chart_json_requires_python_precision` / `chart_requires_python_precision` no longer treat `override_ephemeris` as requiring Python (only `jyotish`/`custom` engines genuinely have no Rust implementation and still force the Python route). See [Architecture](../architecture/#calculation-and-persistence) for the routing rule and its own history, and [tauri-command-contracts](../tauri-command-contracts/#backend-selection) for the current backend-selection contract.

The override only replaces the kernel set — it does not imply every requested object resolves:

- An invalid or missing override path (nonexistent file, wrong extension) is not a hard error: `jpl_backend_for_chart` falls through to the normal `EphemerisManager`-resolved catalog instead (`jpl_backend_for_chart_falls_back_to_catalog_when_override_path_is_invalid`).
- Overriding to a lone planetary kernel (no sibling `pck11.pca`) still resolves the required orientation kernel from the bundled resource directory (`override_without_sibling_pck_still_loads_bundled_orientation_kernel`).
- Requesting a body the override file doesn't contain (e.g. Chiron against a bare `de440s.bsp` override) degrades to a normal per-body `_unavailable` warning, not a failed chart (`override_to_single_kernel_reports_missing_bodies_as_warnings_not_errors`).

All three are covered by dedicated tests in `infrastructure::jpl_backend::tests`.

---

## Cache directory

Downloaded files are stored in the platform app-data directory:

| Platform | Path                                                           |
| -------- | -------------------------------------------------------------- |
| Linux    | `~/.local/share/kefer/ephemeris/`                              |
| macOS    | `~/Library/Application Support/dev.kefer.astrology/ephemeris/` |
| Windows  | `%APPDATA%\dev.kefer.astrology\ephemeris\`                     |

Downloads use a `.partial` suffix while in progress and are atomically renamed on completion. A partially downloaded file is never loaded.

---

## Download mechanism

```rust
EphemerisManager::download(id: &str, app: &AppHandle) -> Result<(), String>
```

1. Looks up the entry in `CATALOG` by `id`.
2. If the kernel is **already** resolved (present in cache or bundled resources, same rules as `catalog_status`), returns `Ok` immediately and still emits `ephemeris-ready`.
3. Opens the NAIF HTTPS URL with `reqwest` (streaming, no full-file buffer in memory).
4. Writes chunks to `<cache>/<filename>.partial` using `std::fs::File`.
5. Emits `ephemeris-progress` to the frontend every 512 KB:
   ```json
   { "id": "de440s", "bytes_done": 5242880, "bytes_total": 31971808 }
   ```
6. On completion, renames `.partial` → final filename and emits `ephemeris-ready`:
   ```json
   { "id": "de440s" }
   ```

On the next chart compute after download completes, `available_bsp_paths()` will find the new file and include it automatically — no restart required.

---

## Tauri commands

Five commands are registered in `lib.rs`:

### `list_ephemeris_catalog`

Returns the full catalog with per-entry download status.

```typescript
const catalog = await invoke<EphemerisInfo[]>('list_ephemeris_catalog');
```

```typescript
interface EphemerisInfo {
	id: string;
	filename: string;
	url: string;
	size_bytes: number;
	bodies: string[];
	year_start: number;
	year_end: number;
	is_default: boolean;
	is_downloaded: boolean;
	local_path: string | null; // null when unavailable; set when file is in cache or bundled (e.g. de440s, codes_300ast)
}
```

### `download_ephemeris`

Starts a background download. Returns `Ok(())` immediately on network failure (error returned as `Err(string)`). Progress is reported via events.

```typescript
// Start download
await invoke('download_ephemeris', { id: 'de440' });

// Listen for progress
const unlisten = await listen<{ id: string; bytes_done: number; bytes_total: number }>(
	'ephemeris-progress',
	({ payload }) => {
		const pct = Math.round((payload.bytes_done / payload.bytes_total) * 100);
		console.log(`${payload.id}: ${pct}%`);
	}
);

// Listen for completion
await listen<{ id: string }>('ephemeris-ready', ({ payload }) => {
	console.log(`${payload.id} ready`);
	unlisten();
});
```

### `get_available_bodies`

Returns the union of body IDs queryable given currently available BSP files.

```typescript
const bodies = await invoke<string[]>('get_available_bodies');
// Always includes the ten planets + Moon when a DE primary is loaded.
// With bundled resources: Ceres, Juno, "astraea", "hebe", … and "chiron".
```

### `get_loaded_spk_coverage`

Returns raw per-target coverage intervals read from the currently resolved
BSP set's loaded SPK segment summaries. See
[Runtime coverage inspection](#runtime-coverage-inspection) above for why this
is diagnostic information, not a guarantee that a body is queryable from
Earth at a given epoch.

```typescript
interface LoadedSpkCoverage {
	naif_target_id: number;
	start_et_seconds: number;
	end_et_seconds: number;
	start_tdb: string;
	end_tdb: string;
}

const coverage = await invoke<LoadedSpkCoverage[]>('get_loaded_spk_coverage');
```

### `get_usable_coverage`

Returns chain-aware, evaluator-verified Earth-relative coverage for one NAIF
target id — see [Runtime coverage inspection](#runtime-coverage-inspection)
above for the algorithm and its scope limitation.

```typescript
interface UsableCoverageInterval {
	start_et_seconds: number;
	end_et_seconds: number;
	start_tdb: string;
	end_tdb: string;
}

interface UsableCoverageReport {
	naif_target_id: number;
	apparent: boolean;
	// Tagged union: `{ status: 'determined' }` or
	// `{ status: 'unknown', reason: string }`.
	determination: { status: 'determined' } | { status: 'unknown'; reason: string };
	chain_ids_considered: number[];
	intervals: UsableCoverageInterval[];
}

const report = await invoke<UsableCoverageReport>('get_usable_coverage', {
	naifTargetId: 2_000_001, // Ceres
	apparent: false,
});
```

---

## Python sidecar

When the optional `backend-python/` source tree is present, `backend-python/module/utils.py` should expose `default_ephemeris_path()` with `de440s.bsp` preferred when present in `source/`:

```python
def default_ephemeris_path() -> str:
    source_dir = Path(__file__).resolve().parent.parent / 'source'
    de440s = source_dir / 'de440s.bsp'
    if de440s.exists():
        return str(de440s)
    raise FileNotFoundError(
        "Place de440s.bsp in backend-python/source/ (see ephemeris manager docs)."
    )
```

The `is_de421` flag in `services.py` (which controls whether outer-planet barycenters are used instead of direct names) works correctly for `de440s.bsp` without changes — it checks the filename and de440s passes the non-de421 path, which uses direct planet names as expected.

---

## Remaining gaps

| Body / Feature                                                     | Status             | Notes                                                                                                                                                 |
| ------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ceres                                                              | ✅ done (JPL Rust) | Supplied by bundled `codes_300ast`; standalone `ceres_spk` remains an optional download                                                              |
| Pallas, Vesta                                                      | ✅ done (JPL Rust) | Supplied by bundled `codes_300ast`; smaller standalone downloads remain optional alternatives                                                        |
| Juno                                                               | ✅ done (JPL Rust) | Supplied by bundled `codes_300ast` (no standalone NAIF `juno_1900_2100.bsp` in the archived set Kefer links)                                        |
| Extended main-belt (Astraea–Massalia)                              | ✅ done (JPL Rust) | 16 minor planets in the `BodyDefinition` catalog (`workspace/model_catalog.rs`), JPL-only; resolve via `codes_300ast_20100725.bsp`                    |
| South Node                                                         | ✅ done            | Mean Node + 180°                                                                                                                                      |
| True Node                                                          | ✅ done            | osculating node from geocentric Moon position + velocity (Rust JPL path); Python JPL path uses the same vector method                                 |
| Part of Fortune / Part of Spirit                                   | ✅ done (JPL Rust) | `domain::astrology::day_night_parts`: day/night-sect arithmetic on ASC + Sun + Moon; **not** lunar phase — a single derived longitude                 |
| Lunar phase (“moon shape”), illumination, age                      | ✅ done            | See [lunar-phase](../lunar-phase/): `moon_details` on `compute_chart` / `compute_chart_from_data` (tropical Sun–Moon elongation); not Part of Fortune |
| Chiron (2060)                                                      | ✅ done (JPL Rust) | Bundled 1900–2100 Type 13 artifact generated from Horizons vectors; native Type 21 remains unsupported by ANISE 0.10.6 |
| Eris, Sedna, and other TNOs                                        | pending            | NAIF kernels exist under `spk/tno/`, but at 168-285MB each rather than the ~1-60MB kernels used so far; needs a bundling/download-size decision (see [Development roadmap](../development-driver/)) |
| Black Moon Lilith (mean apogee)                                    | pending            | mean lunar apogee formula (Swiss `SE_MEAN_APOG` only); not yet in the Rust JPL path                                                                   |
| True Lilith (osculating apogee)                                    | ✅ done (JPL Rust) | eccentricity-vector formula in `domain::houses::true_apogee_tropical_deg`, matching Python's `_true_lilith_tropical_deg`                              |
| Vertex / Antivertex                                                | ✅ done (JPL Rust) | `domain::houses::vertex_lon`: oblique-ascension formula at co-latitude (90° − latitude), same RAMC as the Ascendant; Swiss adapter not yet updated to expose its own native `ascmc[SE_VERTEX]` |
| Minor aspects (Sesquisquare 135°, Semisquare 45°, Semisextile 30°) | pending            | pure angle constants                                                                                                                                  |
