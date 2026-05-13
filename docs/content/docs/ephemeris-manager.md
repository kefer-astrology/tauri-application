---
title: "Ephemeris manager"
description: "Multi-BSP catalog, automatic download, and asteroid body support via EphemerisManager."
weight: 42
---

# Ephemeris manager

`EphemerisManager` is the Rust module that owns all BSP file lifecycle concerns: what files exist, where they live, which one to load, how to download a missing file, and how to hand multiple files to `anise` as a single chained `Almanac`.

Source: [src-tauri/src/ephemeris_manager.rs](../../../src-tauri/src/ephemeris_manager.rs)

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
ephemeris_manager.rs
│
├── CATALOG: &[EphemerisEntry]        static catalog of known BSP files
│
└── EphemerisManager { cache_dir }
    ├── available_bsp_paths()         → Vec<PathBuf>  (primary + de441 supplements + asteroid SPKs)
    ├── catalog_status()              → Vec<EphemerisInfo>  (for Tauri command)
    └── download(id, app)             async, streams progress events
```

`JplAstronomyBackend` holds `bsp_paths: Vec<PathBuf>` (resolved at construction time from `available_bsp_paths()`), then chains them with `load_almanac_from_paths()` in `jpl_backend.rs` on each compute call.

A global `OnceLock<PathBuf>` stores the cache directory. It is initialised once during Tauri app setup from `app.path().app_data_dir()`:

```rust
// lib.rs setup closure
if let Ok(data_dir) = app.path().app_data_dir() {
    ephemeris_manager::init_cache_dir(data_dir.join("ephemeris"));
}
```

Anywhere else in the Rust backend: `EphemerisManager::from_global()` returns a manager pointed at that directory.

---

## BSP catalog

The static catalog and `available_bsp_paths()` define which files Kefer can download and which kernels are chained for JPL compute. Planetary kernels live under NAIF `spk/planets/`; asteroid kernels under `spk/asteroids/` (single-body archives use `asteroids/a_old_versions/`).

| id | filename | size (approx.) | date range | queryable bodies | notes |
|----|----------|----------------|------------|------------------|--------|
| `de440s` *(default)* | `de440s.bsp` | 32 MB | 1900–2050 | 10 planets + Moon | bundled primary default |
| `de440` | `de440.bsp` | 115 MB | 1550–2650 | 10 planets + Moon | downloadable upgrade |
| `de441_part1` | `de441_part-1.bsp` | ~1.5 GB | −13 200 to 0 | 10 planets + Moon | supplementary (cache) |
| `de441_part2` | `de441_part-2.bsp` | ~1.5 GB | 0 to +17 191 | 10 planets + Moon | supplementary (cache) |
| `ceres_spk` | `ceres_1900_2100.bsp` | ~1.1 MB | 1900–2100 | `ceres` | bundled with the app; also downloadable if missing |
| `pallas_spk` | `pallas_1900_2100.bsp` | ~1.1 MB | 1900–2100 | `pallas` | optional download |
| `vesta_spk` | `vesta_1900_2100.bsp` | ~1.1 MB | 1900–2100 | `vesta` | optional download |
| `codes_300ast` | `codes_300ast_20100725.bsp` | ~59 MB | Baer 2010 solution window | subset of 300 asteroids (see below) | optional download; includes **Juno** (`2000003`) |

Current status:

- All rows above are **active** `CATALOG` entries with `download_ephemeris` support.
- The primary planetary kernel resolves as **`de440s` → `de440`** (cache first, then bundled `src-tauri/resources/`).
- After the primary and any cached `de441_part-*` files, the manager appends any resolved **asteroid** kernels in fixed order: Ceres → Pallas → Vesta → `codes_300ast` (each skipped if not present in cache or bundle search paths).
- `tauri.conf.json` `bundle.resources` includes `resources/de440s.bsp` and **`resources/ceres_1900_2100.bsp`**.

Planetary BSP base URL (NAIF HTTPS):

`https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/`

Asteroid BSP URLs are given per entry in `CATALOG` (under `spk/asteroids/` or `spk/asteroids/a_old_versions/`).

### Important: asteroids are NOT in these files

The 343 asteroids integrated alongside the planets in DE440/441 (Ceres, Pallas, Vesta, Juno, etc.) are **integration perturbers only**. They improve planetary accuracy but their positions are **not stored as queryable SPK segments** in any of the DE planetary files. Querying `NAIF 2000001` (Ceres) from `de440s.bsp` will fail.

To get asteroid positions, a **separate dedicated asteroid SPK kernel** is required:

| source | what it provides | notes |
|--------|-----------------|-------|
| Individual NAIF files (`ceres_1900_2100.bsp` etc.) | single-body, 200-year window | publicly archived on NAIF |
| `codes_300ast_20100725.bsp` (59 MB) | 300 asteroids, Baer 2010 solution | one download covers most |
| JPL Horizons REST API | any NAIF body, on demand | no file to bundle; query at compute time |

Asteroid **Kefer IDs** and matching NAIF `2000xxx` frames are wired in `jpl_backend.rs` (small-body table). The backend calls `almanac.translate(...)` per body; if no SPK segment exists for that epoch, the chart still succeeds and a per-body `{id}_unavailable` warning is recorded.

**Default chart** (`included_points` / requested objects unspecified): only the **four classical** asteroids (Ceres, Pallas, Juno, Vesta) are evaluated automatically. If `codes_300ast_*.bsp` is on the load path, the backend also evaluates an extended list (`CODES_300AST_MAJOR_BODIES` in `ephemeris_manager.rs` — Astraea through Massalia) so optional downloads do not spam warnings for bodies that were never requested. When the client passes an explicit object list, every listed body is attempted.

### NAIF body IDs

Standard planets use named constants from `anise::constants::frames`. Asteroid frames use `Frame::from_ephem_j2000(...)` in `ephemeris_manager.rs`:

| Kefer ID | NAIF ID | Typical kernel |
|----------|---------|----------------|
| `ceres` | 2 000 001 | `ceres_1900_2100.bsp` (bundled) or `codes_300ast` |
| `pallas` | 2 000 002 | `pallas_1900_2100.bsp` or `codes_300ast` |
| `juno` | 2 000 003 | **`codes_300ast` only** (no standalone `juno_1900_2100.bsp` in NAIF `a_old_versions`) |
| `vesta` | 2 000 004 | `vesta_1900_2100.bsp` or `codes_300ast` |
| `astraea` … `massalia` | 2 000 005 … 2 000 020 | `codes_300ast_20100725.bsp` |
| `chiron` | 2 000 060 | not in DE or `codes_300ast`; JPL Horizons API still planned |

---

## File resolution

`available_bsp_paths()` builds the almanac load list in **three** stages.

### 1 — Primary BSP (exactly one)

The first match in this ordered list is used; the rest are skipped:

```
cache/de440s.bsp   (user downloaded)
cache/de440.bsp    (user downloaded)
bundled de440s.bsp (src-tauri/resources/ or exe-adjacent)
bundled de440.bsp
```

`de440s.bsp` is bundled with the app in `src-tauri/resources/`.

Exactly one primary is selected because all three files cover overlapping date ranges for the same bodies (see below). Loading two of them simultaneously would produce duplicate SPICE segments and undefined behaviour.

### 2 — Supplementary BSPs (de441 parts)

Each `de441` part found in the **cache** directory is appended **after** the primary. These extend coverage into dates the primary cannot reach.

### 3 — Asteroid supplementary BSPs

For each of `ceres_1900_2100.bsp`, `pallas_1900_2100.bsp`, `vesta_1900_2100.bsp`, `codes_300ast_20100725.bsp`, the manager looks in the **cache first**, then the same bundled search paths as the primary (e.g. `src-tauri/resources/`). Each file is appended **at most once** and only if it exists. Ceres is normally satisfied by the **bundled** `ceres_1900_2100.bsp`; Pallas, Vesta, and the full 300-asteroid set are optional downloads.

**Load failures after the primary:** `load_almanac_from_paths` requires the **first** path to parse successfully. If a later file (de441 supplement or asteroid SPK) fails — for example an incompatible DAF endian with the current `anise` build — that file is **skipped** with a `log::warn!` and the almanac keeps the previous successful chain so charts still compute (e.g. planets without optional asteroids).

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

| Pair | Overlap range | Consequence |
|------|--------------|-------------|
| de440s ∩ de441_part2 | 1900–2050 | de440s is entirely inside de441_part2 |
| de440 ∩ de441_part2 | 1550–2650 | de440 is entirely inside de441_part2 |
| de440s ∩ de440 | 1900–2050 | de440s is entirely inside de440 |
| de441_part1 ∩ de440 | none | de441_part1 ends at year 0; de440 starts at 1550 |
| de441_part1 ∩ de440s | none | same reason |
| de441_part1 ∩ de441_part2 | year 0 only | one-epoch boundary; negligible |

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

| Intended use | File needed |
|---|---|
| Modern charts (1900–2050) | de440s (bundled, no download) |
| Renaissance / medieval (1550–1899 or 2051–2650) | de440 |
| Ancient charts (before 1550 / before 1 AD) | de441_part1 |
| Far-future charts (after 2650) | de441_part2 |

You do **not** need to download de441 if all your charts fall inside de440s's 1900–2050 window.

### Per-chart override

Setting `chart.config.override_ephemeris` to a valid `.bsp` path bypasses the manager entirely — only that single file is loaded. This is useful for testing, for comparing DE solutions, or for charts that require a specific ephemeris version.

---

## Cache directory

Downloaded files are stored in the platform app-data directory:

| Platform | Path |
|----------|------|
| Linux | `~/.local/share/kefer/ephemeris/` |
| macOS | `~/Library/Application Support/dev.kefer.astrology/ephemeris/` |
| Windows | `%APPDATA%\dev.kefer.astrology\ephemeris\` |

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
const catalog = await invoke<EphemerisInfo[]>('list_ephemeris_catalog')
```

```typescript
interface EphemerisInfo {
  id: string
  filename: string
  url: string
  size_bytes: number
  bodies: string[]
  year_start: number
  year_end: number
  is_default: boolean
  is_downloaded: boolean
  local_path: string | null   // null when unavailable; set when file is in cache *or* bundled (e.g. de440s, ceres_spk)
}
```

### `download_ephemeris`

Starts a background download. Returns `Ok(())` immediately on network failure (error returned as `Err(string)`). Progress is reported via events.

```typescript
// Start download
await invoke('download_ephemeris', { id: 'de440' })

// Listen for progress
const unlisten = await listen<{ id: string; bytes_done: number; bytes_total: number }>(
  'ephemeris-progress',
  ({ payload }) => {
    const pct = Math.round((payload.bytes_done / payload.bytes_total) * 100)
    console.log(`${payload.id}: ${pct}%`)
  }
)

// Listen for completion
await listen<{ id: string }>('ephemeris-ready', ({ payload }) => {
  console.log(`${payload.id} ready`)
  unlisten()
})
```

### `get_available_bodies`

Returns the union of body IDs queryable given currently available BSP files.

```typescript
const bodies = await invoke<string[]>('get_available_bodies')
// Always includes the ten planets + Moon when a DE primary is loaded.
// With bundled Ceres SPK: at least "ceres".
// With codes_300ast downloaded: also "juno" and extended IDs such as "astraea", "hebe", … (see CODES_300AST_MAJOR_BODIES in Rust).
```

---

## Python sidecar

`backend-python/module/utils.py` exposes `default_ephemeris_path()` which now prefers `de440s.bsp` when present in `source/`:

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

| Body / Feature | Status | Notes |
|----------------|--------|-------|
| Ceres | ✅ done (JPL Rust) | Bundled `ceres_1900_2100.bsp`; `get_available_bodies` includes `ceres` |
| Pallas, Vesta | optional | Download `pallas_spk` / `vesta_spk` or use `codes_300ast` |
| Juno | optional | Requires `codes_300ast` (no standalone NAIF `juno_1900_2100.bsp` in the archived set Kefer links) |
| Extended main-belt (Astraea–Massalia) | optional | `codes_300ast` + explicit chart object list or default extended path when that kernel is present |
| South Node | ✅ done | Mean Node + 180° |
| True Node | ✅ done | osculating node from geocentric Moon position + velocity (Rust JPL path); Python JPL path uses the same vector method |
| Part of Fortune | pending | Lot / Pars formula using ASC + Moon − Sun (or night variant); **not** lunar phase — a single derived longitude |
| Lunar phase (“moon shape”), illumination, age | ✅ done | See [lunar-phase](../lunar-phase/): `moon_details` on `compute_chart` / `compute_chart_from_data` (tropical Sun–Moon elongation); not Part of Fortune |
| Chiron (2060) | pending | not in any standard DE file; JPL Horizons API planned |
| Eris, Sedna | out of scope | TNOs not in standard NAIF kernels |
| Black Moon Lilith | pending | mean lunar apogee formula; no BSP needed |
| Minor aspects (Sesquisquare 135°, Semisquare 45°, Semisextile 30°) | pending | pure angle constants |
