---
title: 'Ephemeris manager'
description: 'Multi-BSP catalog, automatic download, and asteroid body support via EphemerisManager.'
weight: 42
doc_kind: implementation-reference
status: current
authority: informative
---

`EphemerisManager` is the Rust module that owns all BSP file lifecycle concerns: what files exist, where they live, which one to load, how to download a missing file, and how to hand multiple files to `anise` as a single chained `Almanac`.

Source: [src-tauri/src/infrastructure/ephemeris.rs](https://github.com/kefer-astrology/tauri-application-react/blob/main/src-tauri/src/infrastructure/ephemeris.rs)

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

`JplAstronomyBackend` holds `bsp_paths: Vec<PathBuf>` (resolved at construction time from `available_bsp_paths()`), then chains them with `load_almanac_from_paths()` in `infrastructure/astronomy/jpl_backend.rs` on each compute call.

A global `OnceLock<PathBuf>` stores the cache directory. It is initialised once during Tauri app setup from `app.path().app_data_dir()`:

```rust
// lib.rs setup closure
if let Ok(data_dir) = app.path().app_data_dir() {
    infrastructure::ephemeris::init_cache_dir(data_dir.join("ephemeris"));
}
```

Anywhere else in the Rust backend: `EphemerisManager::from_global()` returns a manager pointed at that directory.

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

Asteroid **Kefer IDs** and matching NAIF `2000xxx` frames are wired in `infrastructure/astronomy/jpl_backend.rs` (small-body table). The backend calls `almanac.transform(...)` per body so translation and the Earth mean-of-date rotation happen together; if no SPK segment exists for that epoch, the chart still succeeds and a per-body `{id}_unavailable` warning is recorded.

All 20 named bodies in the table below (Ceres through Massalia) are also registered in the built-in `BodyDefinition` catalog (`workspace/model_catalog.rs`, mirrored in `backend-python/module/model_catalog.py`), so they are selectable objects, not just resolvable NAIF frames. `astraea` through `massalia` are marked JPL-only in `computation_map` — Swiss Ephemeris support would need asteroid `.se1` files this project does not bundle — and use a circled-digit glyph matching their minor-planet number, since none of them has a dedicated astrological symbol in wide use. A `codes_300ast_minor_planets_resolve_from_bundled_kernels` test in `jpl_backend.rs` confirms all 16 actually resolve from the bundled kernels, not just that the catalog entry exists.

**Default chart** (`included_points` / requested objects unspecified): because
`codes_300ast_*.bsp` is bundled and therefore on the normal load path, the backend
evaluates the configured 20-body subset (`CODES_300AST_MAJOR_BODIES` in
`infrastructure/ephemeris.rs`: Ceres through Massalia). Without that kernel, only
the four classical asteroids (Ceres, Pallas, Juno, Vesta) are attempted. When the
client passes an explicit object list, every listed body is attempted.

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

| Intended use                                    | File needed                   |
| ----------------------------------------------- | ----------------------------- |
| Modern charts (1900–2050)                       | de440s (bundled, no download) |
| Renaissance / medieval (1550–1899 or 2051–2650) | de440                         |
| Ancient charts (before 1550 / before 1 AD)      | de441_part1                   |
| Far-future charts (after 2650)                  | de441_part2                   |

You do **not** need to download de441 if all your charts fall inside de440s's 1900–2050 window.

### Per-chart override

Setting `chart.config.override_ephemeris` to a valid `.bsp` path bypasses the manager entirely — only that single file is loaded. This is useful for testing, for comparing DE solutions, or for charts that require a specific ephemeris version.

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

Three new commands are registered in `lib.rs`:

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
