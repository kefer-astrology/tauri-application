/// Ephemeris catalog, cache management, and multi-BSP almanac construction.
///
/// Maintains a static catalog of known JPL BSP files (de440s, de440, de441 parts),
/// resolves locally available files (bundled + user-downloaded), and builds a chained
/// `anise::Almanac` from all of them so asteroid bodies are available alongside planets.
/// Horizons-generated Type 21 SPKs are converted during acquisition into validated Type
/// 13 kernels. Runtime discovery is manifest-driven and probes an in-range state before
/// advertising the corresponding small body.
use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::io::Write as IoWrite;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use anise::constants::frames::EARTH_MOD_FRAME;
use anise::naif::daf::NAIFSummaryRecord;
use anise::prelude::{Aberration, Almanac, Frame};
use hifitime::Epoch;
use hifitime::TimeScale;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

const DEFAULT_CACHE_DIR: &str = "ephemeris";
const USER_AGENT: &str = "KeferAstrology/2.0 (ephemeris downloader)";
const EMIT_INTERVAL_BYTES: u64 = 512 * 1024;
const PCK11_FILENAME: &str = "pck11.pca";
const SMALL_BODY_MANIFEST_SUFFIX: &str = ".bsp.json";
const SMALL_BODY_MANIFEST_SCHEMA: u32 = 1;

// ─── Asteroid frame constants (DE440 NAIF IDs) ───────────────────────────────

pub const CERES_J2000: Frame = Frame::from_ephem_j2000(2_000_001);
pub const PALLAS_J2000: Frame = Frame::from_ephem_j2000(2_000_002);
pub const JUNO_J2000: Frame = Frame::from_ephem_j2000(2_000_003);
pub const VESTA_J2000: Frame = Frame::from_ephem_j2000(2_000_004);
/// NAIF `2000005` … `2000020` — segments in `codes_300ast_*.bsp` (Baer 2010 solution).
pub const ASTRAEA_J2000: Frame = Frame::from_ephem_j2000(2_000_005);
pub const HEBE_J2000: Frame = Frame::from_ephem_j2000(2_000_006);
pub const IRIS_J2000: Frame = Frame::from_ephem_j2000(2_000_007);
pub const FLORA_J2000: Frame = Frame::from_ephem_j2000(2_000_008);
pub const METIS_J2000: Frame = Frame::from_ephem_j2000(2_000_009);
pub const HYGIEA_J2000: Frame = Frame::from_ephem_j2000(2_000_010);
pub const PARTHENOPE_J2000: Frame = Frame::from_ephem_j2000(2_000_011);
pub const VICTORIA_J2000: Frame = Frame::from_ephem_j2000(2_000_012);
pub const EGERIA_J2000: Frame = Frame::from_ephem_j2000(2_000_013);
pub const IRENE_J2000: Frame = Frame::from_ephem_j2000(2_000_014);
pub const EUNOMIA_J2000: Frame = Frame::from_ephem_j2000(2_000_015);
pub const PSYCHE_J2000: Frame = Frame::from_ephem_j2000(2_000_016);
pub const THETIS_J2000: Frame = Frame::from_ephem_j2000(2_000_017);
pub const MELPOMENE_J2000: Frame = Frame::from_ephem_j2000(2_000_018);
pub const FORTUNA_J2000: Frame = Frame::from_ephem_j2000(2_000_019);
pub const MASSALIA_J2000: Frame = Frame::from_ephem_j2000(2_000_020);

/// Kefer body IDs covered by `codes_300ast_20100725.bsp` that the JPL backend queries.
pub const CODES_300AST_MAJOR_BODIES: &[&str] = &[
    "ceres",
    "pallas",
    "juno",
    "vesta",
    "astraea",
    "hebe",
    "iris",
    "flora",
    "metis",
    "hygiea",
    "parthenope",
    "victoria",
    "egeria",
    "irene",
    "eunomia",
    "psyche",
    "thetis",
    "melpomene",
    "fortuna",
    "massalia",
];

// ─── Global cache-dir initialisation ─────────────────────────────────────────

static CACHE_DIR: OnceLock<PathBuf> = OnceLock::new();
static RESOURCE_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Called once during Tauri app setup with the platform app-data directory.
pub fn init_cache_dir(dir: PathBuf) {
    CACHE_DIR.set(dir).ok();
}

/// Called once during Tauri setup with the package's resolved resource directory.
pub fn init_resource_dir(dir: PathBuf) {
    RESOURCE_DIR.set(dir).ok();
}

fn resolved_cache_dir() -> PathBuf {
    CACHE_DIR
        .get()
        .cloned()
        .unwrap_or_else(|| PathBuf::from(DEFAULT_CACHE_DIR))
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct EphemerisEntry {
    pub id: &'static str,
    pub filename: &'static str,
    pub url: &'static str,
    /// Approximate file size in bytes (used for download progress).
    pub size_bytes: u64,
    /// Kefer body IDs provided by this BSP file.
    pub bodies: &'static [&'static str],
    pub year_start: i32,
    pub year_end: i32,
    /// True for de440s — the bundled default.
    pub is_default: bool,
}

// Standard planetary bodies present in all DE-series files.
// NOTE: The 343 asteroids used in DE440/441 are integration PERTURBERS only —
// their positions are NOT stored as queryable SPK segments in these files.
// Asteroid bodies (Ceres etc.) require a separate dedicated asteroid SPK kernel.
const DE_PLANETS: &[&str] = &[
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
];

const DE440S_ID: &str = "de440s";
const DE440_ID: &str = "de440";
const DE441_PART1_ID: &str = "de441_part1";
const DE441_PART2_ID: &str = "de441_part2";

const DE440S_FILENAME: &str = "de440s.bsp";
const DE440_FILENAME: &str = "de440.bsp";

const PRIMARY_BSP_PRIORITY: &[&str] = &[DE440S_FILENAME, DE440_FILENAME];

const SUPPLEMENTARY_DOWNLOAD_IDS: &[&str] = &[DE441_PART1_ID, DE441_PART2_ID];

const CERES_SPK_ID: &str = "ceres_spk";
const PALLAS_SPK_ID: &str = "pallas_spk";
const VESTA_SPK_ID: &str = "vesta_spk";
const CODES_300AST_ID: &str = "codes_300ast";

const CERES_SPK_FILENAME: &str = "ceres_1900_2100.bsp";
const PALLAS_SPK_FILENAME: &str = "pallas_1900_2100.bsp";
const VESTA_SPK_FILENAME: &str = "vesta_1900_2100.bsp";
const CODES_300AST_FILENAME: &str = "codes_300ast_20100725.bsp";

/// Static SPKs intentionally shipped by the current Tauri bundle. Optional catalog
/// kernels must come from the app-data cache; finding an old copy under `target/`
/// must not silently turn it back into a bundled resource.
const BUNDLED_STATIC_SPK_FILENAMES: &[&str] = &[DE440S_FILENAME, CODES_300AST_FILENAME];

/// Asteroid SPKs appended after the planetary primary (and any de441 supplements).
const ASTEROID_KERNEL_FILENAMES: &[&str] = &[
    CERES_SPK_FILENAME,
    PALLAS_SPK_FILENAME,
    VESTA_SPK_FILENAME,
    CODES_300AST_FILENAME,
];

pub static CATALOG: &[EphemerisEntry] = &[
    EphemerisEntry {
        id: DE440S_ID,
        filename: DE440S_FILENAME,
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp",
        size_bytes: 31_971_808,
        bodies: DE_PLANETS,
        year_start: 1900,
        year_end: 2050,
        is_default: true,
    },
    EphemerisEntry {
        id: DE440_ID,
        filename: DE440_FILENAME,
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440.bsp",
        size_bytes: 114_720_768,
        bodies: DE_PLANETS,
        year_start: 1550,
        year_end: 2650,
        is_default: false,
    },
    EphemerisEntry {
        id: DE441_PART1_ID,
        filename: "de441_part-1.bsp",
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de441_part-1.bsp",
        size_bytes: 1_610_612_736,
        bodies: DE_PLANETS,
        year_start: -13_200,
        year_end: 0,
        is_default: false,
    },
    EphemerisEntry {
        id: DE441_PART2_ID,
        filename: "de441_part-2.bsp",
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de441_part-2.bsp",
        size_bytes: 1_610_612_736,
        bodies: DE_PLANETS,
        year_start: 0,
        year_end: 17_191,
        is_default: false,
    },
    EphemerisEntry {
        id: CERES_SPK_ID,
        filename: CERES_SPK_FILENAME,
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/asteroids/a_old_versions/ceres_1900_2100.bsp",
        size_bytes: 1_149_952,
        bodies: &["ceres"],
        year_start: 1900,
        year_end: 2100,
        is_default: false,
    },
    EphemerisEntry {
        id: PALLAS_SPK_ID,
        filename: PALLAS_SPK_FILENAME,
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/asteroids/a_old_versions/pallas_1900_2100.bsp",
        size_bytes: 1_149_952,
        bodies: &["pallas"],
        year_start: 1900,
        year_end: 2100,
        is_default: false,
    },
    EphemerisEntry {
        id: VESTA_SPK_ID,
        filename: VESTA_SPK_FILENAME,
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/asteroids/a_old_versions/vesta_1900_2100.bsp",
        size_bytes: 1_149_952,
        bodies: &["vesta"],
        year_start: 1900,
        year_end: 2100,
        is_default: false,
    },
    EphemerisEntry {
        id: CODES_300AST_ID,
        filename: CODES_300AST_FILENAME,
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/asteroids/codes_300ast_20100725.bsp",
        size_bytes: 61_864_960,
        bodies: CODES_300AST_MAJOR_BODIES,
        year_start: 1600,
        year_end: 2200,
        is_default: false,
    },
];

/// Kefer body IDs queryable when a kernel with this basename is on the almanac path.
pub fn bodies_for_spk_filename(filename: &str) -> Option<&'static [&'static str]> {
    match filename {
        CERES_SPK_FILENAME => Some(&["ceres"]),
        PALLAS_SPK_FILENAME => Some(&["pallas"]),
        VESTA_SPK_FILENAME => Some(&["vesta"]),
        name if name.contains("codes_300ast") && name.ends_with(".bsp") => {
            Some(CODES_300AST_MAJOR_BODIES)
        }
        DE440S_FILENAME | DE440_FILENAME => Some(DE_PLANETS),
        "de441_part-1.bsp" | "de441_part-2.bsp" => Some(DE_PLANETS),
        _ => None,
    }
}

/// Union of body IDs implied by the given on-disk BSP paths (planets + asteroids).
pub fn bodies_available_for_bsp_paths(paths: &[PathBuf]) -> Vec<String> {
    let mut set = HashSet::new();
    for path in paths {
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if let Some(bodies) = bodies_for_spk_filename(name) {
            for b in bodies {
                set.insert((*b).to_string());
            }
        }
        if let Some(kernel) = small_body_kernel_for_path(path) {
            set.insert(kernel.body_id);
        }
    }
    let mut out: Vec<String> = set.into_iter().collect();
    out.sort();
    out
}

// ─── Manifest-driven small-body SPKs ────────────────────────────────────────

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SmallBodySpkManifest {
    pub schema_version: u32,
    pub artifact_kind: String,
    pub body_id: String,
    pub display_name: String,
    pub filename: String,
    pub naif_target_id: i32,
    pub naif_center_id: i32,
    pub reference_frame: String,
    pub spk_type: i32,
    pub coverage: SmallBodyCoverage,
    pub sha256: String,
    pub validation: SmallBodyValidation,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SmallBodyCoverage {
    pub start: String,
    pub stop: String,
    pub start_et_seconds: f64,
    pub stop_et_seconds: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SmallBodyValidation {
    pub method: String,
    pub passed: bool,
    pub sample_count: usize,
    pub max_position_error_km: f64,
    pub max_velocity_error_km_s: f64,
    pub max_allowed_position_error_km: f64,
    pub max_allowed_velocity_error_km_s: f64,
    pub probe_et_seconds: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SmallBodyKernel {
    pub body_id: String,
    pub frame: Frame,
    pub path: PathBuf,
}

fn valid_body_id(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
}

fn reserved_body_id(value: &str) -> bool {
    DE_PLANETS.contains(&value)
        || CODES_300AST_MAJOR_BODIES.contains(&value)
        || [
            "asc",
            "desc",
            "mc",
            "ic",
            "north_node",
            "south_node",
            "mean_node",
            "mean_south_node",
            "true_node",
            "true_north_node",
            "true_south_node",
            "true_lilith",
            "vertex",
            "antivertex",
            "part_of_fortune",
            "part_of_spirit",
        ]
        .contains(&value)
}

fn validate_small_body_manifest(manifest: &SmallBodySpkManifest) -> Result<(), String> {
    if manifest.schema_version != SMALL_BODY_MANIFEST_SCHEMA {
        return Err(format!(
            "unsupported manifest schema {}",
            manifest.schema_version
        ));
    }
    if manifest.artifact_kind != "horizons-sampled-spk" {
        return Err(format!(
            "unsupported artifact kind '{}'",
            manifest.artifact_kind
        ));
    }
    if !valid_body_id(&manifest.body_id) {
        return Err(format!("invalid body id '{}'", manifest.body_id));
    }
    if reserved_body_id(&manifest.body_id) {
        return Err(format!(
            "body id '{}' is owned by a built-in computation path",
            manifest.body_id
        ));
    }
    if Path::new(&manifest.filename).components().count() != 1
        || !manifest.filename.ends_with(".bsp")
    {
        return Err("filename must be a local .bsp basename".to_string());
    }
    if manifest.reference_frame != "J2000" || manifest.spk_type != 13 {
        return Err("only J2000 SPK Type 13 artifacts are accepted".to_string());
    }
    if manifest.naif_target_id == 0 || manifest.naif_center_id != 10 {
        return Err("small-body artifact must have a non-zero target and Sun (10) center".into());
    }
    if !manifest.coverage.start_et_seconds.is_finite()
        || !manifest.coverage.stop_et_seconds.is_finite()
        || manifest.coverage.start_et_seconds >= manifest.coverage.stop_et_seconds
    {
        return Err("invalid SPK coverage interval".to_string());
    }
    let validation = &manifest.validation;
    if !validation.passed
        || validation.sample_count == 0
        || !validation.max_position_error_km.is_finite()
        || !validation.max_velocity_error_km_s.is_finite()
        || !validation.max_allowed_position_error_km.is_finite()
        || !validation.max_allowed_velocity_error_km_s.is_finite()
        || validation.max_allowed_position_error_km < 0.0
        || validation.max_allowed_velocity_error_km_s < 0.0
        || validation.max_position_error_km > validation.max_allowed_position_error_km
        || validation.max_velocity_error_km_s > validation.max_allowed_velocity_error_km_s
        || !validation.probe_et_seconds.is_finite()
        || validation.probe_et_seconds < manifest.coverage.start_et_seconds
        || validation.probe_et_seconds > manifest.coverage.stop_et_seconds
    {
        return Err("artifact has no passing in-range validation result".to_string());
    }
    if manifest.sha256.len() != 64 || !manifest.sha256.bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("invalid SHA-256 digest".to_string());
    }
    Ok(())
}

fn read_small_body_manifest(path: &Path) -> Result<SmallBodySpkManifest, String> {
    let bytes = std::fs::read(path)
        .map_err(|error| format!("cannot read '{}': {error}", path.display()))?;
    let manifest: SmallBodySpkManifest = serde_json::from_slice(&bytes)
        .map_err(|error| format!("invalid manifest '{}': {error}", path.display()))?;
    validate_small_body_manifest(&manifest)?;
    Ok(manifest)
}

fn manifest_path_for_bsp(path: &Path) -> PathBuf {
    let mut manifest = path.as_os_str().to_os_string();
    manifest.push(".json");
    PathBuf::from(manifest)
}

fn small_body_kernel_for_path(path: &Path) -> Option<SmallBodyKernel> {
    let manifest_path = manifest_path_for_bsp(path);
    let manifest = read_small_body_manifest(&manifest_path).ok()?;
    if path.file_name().and_then(|name| name.to_str()) != Some(manifest.filename.as_str()) {
        return None;
    }
    Some(SmallBodyKernel {
        body_id: manifest.body_id,
        frame: Frame::from_ephem_j2000(manifest.naif_target_id),
        path: path.to_path_buf(),
    })
}

pub fn small_body_kernels_for_bsp_paths(paths: &[PathBuf]) -> Vec<SmallBodyKernel> {
    paths
        .iter()
        .filter_map(|path| small_body_kernel_for_path(path))
        .collect()
}

// ─── Serialisable status DTO ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct EphemerisInfo {
    pub id: &'static str,
    pub filename: &'static str,
    pub url: &'static str,
    pub size_bytes: u64,
    pub bodies: &'static [&'static str],
    pub year_start: i32,
    pub year_end: i32,
    pub is_default: bool,
    pub is_downloaded: bool,
    pub local_path: Option<String>,
}

/// Raw, loaded-SPK target coverage.  These intervals are read from segment
/// summaries at runtime; callers must still account for center-chain coverage
/// before claiming a target is observable from Earth.
#[derive(Debug, Clone, Serialize)]
pub struct LoadedSpkCoverage {
    pub naif_target_id: i32,
    pub start_et_seconds: f64,
    pub end_et_seconds: f64,
    pub start_tdb: String,
    pub end_tdb: String,
}

pub fn loaded_spk_coverage(paths: &[PathBuf]) -> Result<Vec<LoadedSpkCoverage>, String> {
    let almanac = load_almanac_from_paths(paths)?;
    let mut coverage: Vec<_> = almanac
        .spk_domains()
        .map_err(|error| format!("cannot inspect loaded SPK coverage: {error}"))?
        .into_iter()
        .map(|(id, (start, end))| LoadedSpkCoverage {
            naif_target_id: id,
            start_et_seconds: start.to_et_seconds(),
            end_et_seconds: end.to_et_seconds(),
            start_tdb: start.to_gregorian_str(TimeScale::TDB),
            end_tdb: end.to_gregorian_str(TimeScale::TDB),
        })
        .collect();
    coverage.sort_by_key(|entry| entry.naif_target_id);
    Ok(coverage)
}

// ─── Usable (Earth-relative, chain-aware) coverage ──────────────────────────

/// Whether chain-aware coverage analysis actually determined an answer, or
/// could not and is reporting a best-effort, lower-confidence result instead.
/// A caller must not treat `Unknown` intervals as equivalent to `Determined`
/// ones — see [`usable_earth_relative_coverage`] for exactly what each means
/// and why "no error" is not the same claim as "fully resolved."
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum CoverageDetermination {
    /// Chain discovery (`Almanac::ephemeris_path_to_root`) succeeded at least
    /// once for both the target's own ascent and Earth/EMB/SSB's ascent, so
    /// the boundary set used to partition time is believed complete for the
    /// chains actually observed. This is still a *finite sampled* probe of
    /// each resulting sub-interval (its midpoint), not an exhaustive proof
    /// that `transform` would succeed at every instant inside it — see the
    /// "structural vs. sampled" distinction in `ephemeris-validation.md`.
    Determined,
    /// Chain discovery never succeeded for at least one side (target or
    /// Earth) across every epoch probed, even though the target has its own
    /// loaded segment(s). The reported `intervals` are still real
    /// `Almanac::transform` probe results, not fabricated — but the boundary
    /// set that produced them may have missed an internal transition this
    /// analysis never got to see, so they must be treated as a conservative,
    /// possibly-too-coarse approximation rather than a confirmed answer.
    Unknown { reason: String },
}

#[derive(Debug, Clone, Serialize)]
pub struct UsableCoverageInterval {
    pub start_et_seconds: f64,
    pub end_et_seconds: f64,
    pub start_tdb: String,
    pub end_tdb: String,
}

/// Usable Earth-relative geometric (or apparent) coverage for one target,
/// accounting for the full center chain, not just the target's own raw segment
/// domain. See [`usable_earth_relative_coverage`].
#[derive(Debug, Clone, Serialize)]
pub struct UsableCoverageReport {
    pub naif_target_id: i32,
    pub apparent: bool,
    pub determination: CoverageDetermination,
    /// Every center id this report actually discovered via
    /// `Almanac::ephemeris_path_to_root` (plus the target's own id and
    /// Earth's own id, which are definitional, not discovered). Exposed so a
    /// caller can see exactly what was accounted for.
    pub chain_ids_considered: Vec<i32>,
    /// Contiguous windows where the real evaluator (`Almanac::transform`)
    /// actually succeeds at the probed midpoint of each boundary-delimited
    /// sub-interval. Multiple entries mean a genuine gap (or disjoint
    /// alternate-path coverage), not file-declared range. See
    /// `determination` for how much confidence to place in the boundary set
    /// these were partitioned from.
    pub intervals: Vec<UsableCoverageInterval>,
}

fn epoch_boundaries_for_id(almanac: &Almanac, id: i32) -> Vec<f64> {
    almanac
        .spk_summaries(id)
        .map(|summaries| {
            summaries
                .iter()
                .filter(|summary| summary.end_epoch() > summary.start_epoch())
                .flat_map(|summary| {
                    [
                        summary.start_epoch().to_et_seconds(),
                        summary.end_epoch().to_et_seconds(),
                    ]
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

/// Given a sorted, deduplicated list of candidate breakpoints and a predicate
/// that tells whether a given instant is "usable," probes the midpoint of
/// every consecutive breakpoint pair and merges contiguous `true` runs into
/// closed `[start, end]` intervals. A `false` run between two `true` runs is
/// reported as a genuine gap (two separate intervals), never bridged or
/// padded. Extracted as a pure function so the merge/gap logic is testable
/// without constructing real SPK kernels.
fn merge_probed_intervals(boundaries: &[f64], probe: impl Fn(f64) -> bool) -> Vec<(f64, f64)> {
    let mut intervals: Vec<(f64, f64)> = Vec::new();
    let mut current_start: Option<f64> = None;
    for window in boundaries.windows(2) {
        let (a, b) = (window[0], window[1]);
        if b <= a {
            continue;
        }
        let ok = probe(a + (b - a) / 2.0);
        match (ok, current_start) {
            (true, None) => current_start = Some(a),
            (false, Some(start)) => {
                intervals.push((start, a));
                current_start = None;
            }
            _ => {}
        }
    }
    if let (Some(start), Some(&last)) = (current_start, boundaries.last()) {
        intervals.push((start, last));
    }
    intervals
}

/// Probe-epoch midpoints for every `[start, end]` pair in `boundaries`.
fn segment_midpoints(boundaries: &[f64]) -> Vec<f64> {
    boundaries
        .chunks(2)
        .filter_map(|window| match window {
            [start, end] => Some(start + (end - start) / 2.0),
            _ => None,
        })
        .collect()
}

/// Discovers every center id on `frame`'s ascent toward the common
/// ephemeris root at each of `probe_epochs`, using
/// `Almanac::ephemeris_path_to_root` — real loaded-segment target/center
/// metadata, not an assumed or hardcoded anchor list. Returns the
/// discovered ids plus whether discovery succeeded at least once (a caller
/// needs that to judge how much to trust the resulting boundary set).
fn discover_ascent_chain_ids(
    almanac: &Almanac,
    frame: Frame,
    probe_epochs: &[f64],
) -> (Vec<i32>, bool) {
    let mut ids = Vec::new();
    let mut discovered_at_least_once = false;
    for &probe in probe_epochs {
        if let Ok((len, path)) = almanac.ephemeris_path_to_root(frame, probe) {
            discovered_at_least_once = true;
            for id in path.into_iter().take(len).flatten() {
                ids.push(id);
            }
        }
    }
    (ids, discovered_at_least_once)
}

/// Computes usable Earth-relative coverage for `naif_target_id`.
///
/// # Algorithm
///
/// 1. Discover the target's own ascent chain (target → its center → that
///    center's center → ... → the common ephemeris root) by calling
///    `Almanac::ephemeris_path_to_root` at the midpoint of each of the
///    target's own loaded segments. This reads real target/center fields
///    from loaded segment summaries; it does not assume or hardcode which
///    intermediate bodies exist.
/// 2. Separately discover Earth/EMB/SSB's own ascent chain the same way, at
///    the midpoint of each of *Earth's* own loaded segments. This step
///    matters: `ephemeris_path_to_root(target, ...)` alone never reports
///    Earth-side-only intermediates (e.g. the Earth-Moon barycenter) unless
///    they also happen to be on the target's own ascent — an earlier version
///    of this function only discovered the target side and relied on a
///    hardcoded anchor list to cover the Earth side, which is exactly the
///    kind of unverified assumption this function must not make.
/// 3. Collect every segment boundary (start/end epoch) for every id discovered
///    on either side, plus the target's own id and Earth's own id (both
///    definitional, not discovered guesses).
/// 4. Probe the real `Almanac::transform` at the midpoint of every resulting
///    sub-interval and merge contiguous successes — see
///    [`merge_probed_intervals`].
///
/// This is deliberately built *through* the existing ANISE evaluator
/// (`transform`, `ephemeris_path_to_root`, `spk_summaries`) rather than
/// reimplementing SPICE segment-precedence rules: the evaluator's own
/// reverse-load-order "last loaded wins" behavior is exercised directly by
/// every probe, so this can never disagree with what a real chart compute
/// would do at that epoch.
///
/// `apparent = true` probes with `Aberration::CN_S`, so the reported coverage
/// already accounts for the retarded (light-time-corrected) epoch wherever
/// ANISE's own light-time iteration can resolve it; where it cannot (the
/// retarded epoch falls outside a link's segment), that sub-interval is
/// correctly excluded rather than padded or guessed.
///
/// # What this does *not* prove
///
/// Each reported interval's endpoints come from real segment boundaries, but
/// the claim that `transform` succeeds *throughout* an interval rests on a
/// single midpoint probe, not an exhaustive scan. See `determination` on the
/// returned report for when chain discovery itself could not be completed —
/// in that case the boundary set may have missed a real internal transition,
/// and the result is reported as `Unknown` rather than a false confident
/// answer.
pub fn usable_earth_relative_coverage(
    paths: &[PathBuf],
    naif_target_id: i32,
    apparent: bool,
) -> Result<UsableCoverageReport, String> {
    let almanac = load_almanac_from_paths(paths)?;
    Ok(usable_earth_relative_coverage_from_almanac(
        &almanac,
        naif_target_id,
        apparent,
    ))
}

/// Same algorithm as [`usable_earth_relative_coverage`], taking an already
/// -constructed `Almanac` directly. Split out so tests can exercise the
/// chain-discovery/precedence logic against a hand-built, in-memory
/// synthetic `Almanac` (real summary *metadata*, no Chebyshev coefficient
/// data) for scenarios — a missing center link, a target whose center
/// changes over time, a chain deeper than ANISE's evaluator supports — that
/// no bundled or realistically downloadable kernel can be made to exhibit on
/// demand.
fn usable_earth_relative_coverage_from_almanac(
    almanac: &Almanac,
    naif_target_id: i32,
    apparent: bool,
) -> UsableCoverageReport {
    let target_frame = Frame::from_ephem_j2000(naif_target_id);
    let earth_id = EARTH_MOD_FRAME.ephemeris_id;
    let aberration = if apparent {
        Aberration::CN_S
    } else {
        Aberration::NONE
    };

    let own_boundaries = epoch_boundaries_for_id(almanac, naif_target_id);
    if own_boundaries.is_empty() {
        // The target has no loaded segment at all. This is itself a
        // conclusive, confident answer (not a discovery failure): there is
        // nothing to resolve a chain from in the first place.
        return UsableCoverageReport {
            naif_target_id,
            apparent,
            determination: CoverageDetermination::Determined,
            chain_ids_considered: vec![naif_target_id],
            intervals: Vec::new(),
        };
    }

    let earth_boundaries = epoch_boundaries_for_id(almanac, earth_id);
    let (target_chain_ids, target_chain_discovered) =
        discover_ascent_chain_ids(almanac, target_frame, &segment_midpoints(&own_boundaries));
    let (earth_chain_ids, earth_chain_discovered) = discover_ascent_chain_ids(
        almanac,
        EARTH_MOD_FRAME,
        &segment_midpoints(&earth_boundaries),
    );

    let mut chain_ids = target_chain_ids;
    chain_ids.extend(earth_chain_ids);
    chain_ids.push(naif_target_id);
    chain_ids.push(earth_id);
    chain_ids.sort_unstable();
    chain_ids.dedup();

    let mut boundaries: Vec<f64> = chain_ids
        .iter()
        .flat_map(|&id| epoch_boundaries_for_id(almanac, id))
        .collect();
    boundaries.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    boundaries.dedup();

    let intervals = merge_probed_intervals(&boundaries, |probe_et_seconds| {
        almanac
            .transform(
                target_frame,
                EARTH_MOD_FRAME,
                Epoch::from_et_seconds(probe_et_seconds),
                aberration,
            )
            .is_ok()
    });

    let determination = if !target_chain_discovered {
        CoverageDetermination::Unknown {
            reason: format!(
                "could not resolve target {naif_target_id}'s own ascent chain at any of its \
                 {} loaded segment(s) (ephemeris_path_to_root failed every time, e.g. a broken \
                 link or a chain deeper than ANISE's 8-node limit) — the boundary set below may \
                 under-sample a real internal transition",
                segment_midpoints(&own_boundaries).len()
            ),
        }
    } else if !earth_boundaries.is_empty() && !earth_chain_discovered {
        // An empty `earth_boundaries` (no Earth segment loaded at all) is
        // itself conclusive — not a discovery failure — and is left to fall
        // through to `Determined` below (the resulting empty/degenerate
        // boundary set correctly makes every `transform` probe fail).
        CoverageDetermination::Unknown {
            reason: "could not resolve Earth/EMB/SSB's own ascent chain at any of its loaded \
                     segment(s) — the Earth-side boundary set below may be incomplete"
                .to_string(),
        }
    } else {
        CoverageDetermination::Determined
    };

    UsableCoverageReport {
        naif_target_id,
        apparent,
        determination,
        chain_ids_considered: chain_ids,
        intervals: intervals
            .into_iter()
            .map(
                |(start_et_seconds, end_et_seconds)| UsableCoverageInterval {
                    start_et_seconds,
                    end_et_seconds,
                    start_tdb: Epoch::from_et_seconds(start_et_seconds)
                        .to_gregorian_str(TimeScale::TDB),
                    end_tdb: Epoch::from_et_seconds(end_et_seconds)
                        .to_gregorian_str(TimeScale::TDB),
                },
            )
            .collect(),
    }
}

// ─── Manager ─────────────────────────────────────────────────────────────────

#[derive(Debug)]
pub struct EphemerisManager {
    pub cache_dir: PathBuf,
}

impl EphemerisManager {
    pub fn new(cache_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&cache_dir).ok();
        Self { cache_dir }
    }

    /// Construct a manager from the globally initialised cache dir.
    pub fn from_global() -> Self {
        Self::new(resolved_cache_dir())
    }

    fn catalog_entry(&self, id: &str) -> Option<&'static EphemerisEntry> {
        CATALOG.iter().find(|entry| entry.id == id)
    }

    fn resolved_kernel_path_for_entry(&self, entry: &'static EphemerisEntry) -> Option<PathBuf> {
        let cached = self.cache_dir.join(entry.filename);
        if cached.exists() {
            return cached.canonicalize().ok().or(Some(cached));
        }
        BUNDLED_STATIC_SPK_FILENAMES
            .contains(&entry.filename)
            .then(|| self.find_bundled_kernel(entry.filename))
            .flatten()
    }

    fn catalog_status_for_entry(&self, entry: &'static EphemerisEntry) -> EphemerisInfo {
        let resolved = self.resolved_kernel_path_for_entry(entry);
        let is_downloaded = resolved.is_some();

        EphemerisInfo {
            id: entry.id,
            filename: entry.filename,
            url: entry.url,
            size_bytes: entry.size_bytes,
            bodies: entry.bodies,
            year_start: entry.year_start,
            year_end: entry.year_end,
            is_default: entry.is_default,
            is_downloaded,
            local_path: resolved.map(|p| p.to_string_lossy().into_owned()),
        }
    }

    /// Status snapshot for the `list_ephemeris_catalog` Tauri command.
    pub fn catalog_status(&self) -> Vec<EphemerisInfo> {
        CATALOG
            .iter()
            .map(|entry| self.catalog_status_for_entry(entry))
            .collect()
    }

    fn cached_bsp_path(&self, filename: &str) -> Option<PathBuf> {
        let path = self.cache_dir.join(filename);
        path.exists().then(|| path.canonicalize().unwrap_or(path))
    }

    fn bundled_kernel_search_candidates(&self, filename: &str) -> Vec<PathBuf> {
        if let Some(resource_dir) = RESOURCE_DIR.get() {
            return vec![
                resource_dir.join(filename),
                resource_dir.join("resources").join(filename),
            ];
        }
        vec![PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join(filename)]
    }

    fn find_bundled_kernel(&self, filename: &str) -> Option<PathBuf> {
        self.bundled_kernel_search_candidates(filename)
            .into_iter()
            .find_map(|path| path.exists().then(|| path.canonicalize().unwrap_or(path)))
    }

    fn resolve_primary_bsp(&self) -> Option<PathBuf> {
        for filename in PRIMARY_BSP_PRIORITY {
            if let Some(path) = self.cached_bsp_path(filename) {
                log::debug!(
                    "ephemeris: primary (cached) {} → {}",
                    filename,
                    path.display()
                );
                return Some(path);
            }
            if BUNDLED_STATIC_SPK_FILENAMES.contains(filename) {
                let Some(path) = self.find_bundled_kernel(filename) else {
                    continue;
                };
                log::debug!(
                    "ephemeris: primary (bundled) {} → {}",
                    filename,
                    path.display()
                );
                return Some(path);
            }
        }

        None
    }

    fn resolve_supplementary_bsps(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();

        for id in SUPPLEMENTARY_DOWNLOAD_IDS {
            if let Some(entry) = self.catalog_entry(id) {
                if let Some(path) = self.cached_bsp_path(entry.filename) {
                    log::debug!(
                        "ephemeris: supplementary {} → {}",
                        entry.filename,
                        path.display()
                    );
                    paths.push(path);
                }
            }
        }

        paths
    }

    fn resolve_asteroid_supplementary_bsps(&self, existing: &[PathBuf]) -> Vec<PathBuf> {
        let mut paths = Vec::new();
        for filename in ASTEROID_KERNEL_FILENAMES {
            let bundled = BUNDLED_STATIC_SPK_FILENAMES
                .contains(filename)
                .then(|| self.find_bundled_kernel(filename))
                .flatten();
            let Some(path) = self.cached_bsp_path(filename).or(bundled) else {
                continue;
            };
            if existing.iter().chain(paths.iter()).any(|p| p == &path) {
                continue;
            }
            log::debug!(
                "ephemeris: asteroid kernel {} → {}",
                filename,
                path.display()
            );
            paths.push(path);
        }
        paths
    }

    fn small_body_manifest_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = vec![self.cache_dir.clone()];
        if let Some(resource_dir) = RESOURCE_DIR.get() {
            dirs.push(resource_dir.clone());
            dirs.push(resource_dir.join("resources"));
        } else {
            dirs.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources"));
        }
        let mut seen = HashSet::new();
        dirs = dirs
            .into_iter()
            .filter(|path| path.is_dir())
            .map(|path| path.canonicalize().unwrap_or(path))
            .filter(|path| seen.insert(path.clone()))
            .collect();
        dirs
    }

    fn small_body_manifest_paths(&self) -> Vec<PathBuf> {
        let mut manifests = Vec::new();
        let mut seen = HashSet::new();
        for dir in self.small_body_manifest_dirs() {
            let Ok(entries) = std::fs::read_dir(dir) else {
                continue;
            };
            let mut directory_manifests = Vec::new();
            for entry in entries.flatten() {
                let path = entry.path();
                if path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.ends_with(SMALL_BODY_MANIFEST_SUFFIX))
                {
                    directory_manifests.push(path);
                }
            }
            directory_manifests.sort();
            manifests.extend(
                directory_manifests
                    .into_iter()
                    .filter(|path| seen.insert(path.clone())),
            );
        }
        manifests
    }

    fn resolve_small_body_bsps(&self, existing: &[PathBuf]) -> Vec<PathBuf> {
        let mut accepted = Vec::new();
        let mut body_ids = HashSet::new();
        let mut target_ids = HashSet::new();
        for manifest_path in self.small_body_manifest_paths() {
            let manifest = match read_small_body_manifest(&manifest_path) {
                Ok(manifest) => manifest,
                Err(error) => {
                    log::warn!("ephemeris: ignoring {} — {error}", manifest_path.display());
                    continue;
                }
            };
            if !body_ids.insert(manifest.body_id.clone())
                || !target_ids.insert(manifest.naif_target_id)
            {
                log::warn!(
                    "ephemeris: ignoring duplicate small-body manifest {}",
                    manifest_path.display()
                );
                continue;
            }
            let Some(parent) = manifest_path.parent() else {
                continue;
            };
            let bsp_path = parent.join(&manifest.filename);
            if !bsp_path.is_file() {
                log::warn!(
                    "ephemeris: manifest {} references missing {}",
                    manifest_path.display(),
                    bsp_path.display()
                );
                continue;
            }
            if existing
                .iter()
                .chain(accepted.iter())
                .any(|path| path == &bsp_path)
            {
                continue;
            }
            if let Err(error) = validate_small_body_artifact(
                &manifest_path,
                &bsp_path,
                &manifest,
                &existing
                    .iter()
                    .chain(accepted.iter())
                    .cloned()
                    .collect::<Vec<_>>(),
            ) {
                log::warn!(
                    "ephemeris: rejecting small-body artifact {} — {error}",
                    bsp_path.display()
                );
                continue;
            }
            log::debug!(
                "ephemeris: validated small body {} ({}) → {}",
                manifest.body_id,
                manifest.naif_target_id,
                bsp_path.display()
            );
            accepted.push(bsp_path);
        }
        accepted
    }

    /// All BSP paths currently available, in load order.
    ///
    /// 1. Exactly one primary kernel is selected from `PRIMARY_BSP_PRIORITY`.
    /// 2. Any downloaded de441 parts are appended as supplementary range extenders.
    /// 3. Available asteroid SPKs (optional single-body downloads and bundled `codes_300ast`).
    /// 4. Manifest-driven, checksummed, probe-tested Horizons-derived Type 13 SPKs.
    ///
    /// The primary currently resolves in this order:
    /// `de440s` → `de440`.
    pub fn available_bsp_paths(&self) -> Vec<PathBuf> {
        // `compute_positions` resolves a fresh `EphemerisManager`/backend on every sample point of
        // a transit series (potentially thousands per series), and this resolution re-scans the
        // manifest directories and re-parses every small-body manifest JSON file each time — cheap
        // per call, but needlessly repeated since nothing here changes except right after
        // `download()` adds a new kernel. Cached per `cache_dir` (not globally) so tests using
        // distinct temp directories never share an entry, and invalidated by `download()` on
        // success — the only place kernel files are added at runtime.
        if let Some(cached) = bsp_paths_cache().lock().unwrap().get(&self.cache_dir) {
            return cached.clone();
        }

        let mut paths = Vec::new();
        if let Some(primary) = self.resolve_primary_bsp() {
            paths.push(primary);
        }
        paths.extend(self.resolve_supplementary_bsps());
        let asteroid_paths = self.resolve_asteroid_supplementary_bsps(&paths);
        paths.extend(asteroid_paths);
        let small_body_paths = self.resolve_small_body_bsps(&paths);
        paths.extend(small_body_paths);

        bsp_paths_cache()
            .lock()
            .unwrap()
            .insert(self.cache_dir.clone(), paths.clone());
        paths
    }

    /// Download a BSP from the catalog into the cache directory.
    /// Emits `ephemeris-progress` (`{id, bytes_done, bytes_total}`) every ~512 KB
    /// and `ephemeris-ready` (`{id}`) on completion.
    pub async fn download(&self, id: &str, app: &AppHandle) -> Result<(), String> {
        let entry = self
            .catalog_entry(id)
            .ok_or_else(|| format!("Unknown ephemeris id: '{id}'"))?;

        if self.resolved_kernel_path_for_entry(entry).is_some() {
            let _ = app.emit("ephemeris-ready", serde_json::json!({ "id": id }));
            return Ok(());
        }

        std::fs::create_dir_all(&self.cache_dir)
            .map_err(|e| format!("Cannot create cache dir: {e}"))?;

        let partial = self.cache_dir.join(format!("{}.partial", entry.filename));
        let final_path = self.cache_dir.join(entry.filename);

        let client = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .build()
            .map_err(|e| e.to_string())?;

        let mut resp = client
            .get(entry.url)
            .send()
            .await
            .map_err(|e| format!("Request failed: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!("HTTP {} for {}", resp.status(), entry.url));
        }

        let total = resp.content_length().unwrap_or(entry.size_bytes);
        let mut downloaded: u64 = 0;
        let mut last_emit: u64 = 0;

        let mut file = std::fs::File::create(&partial)
            .map_err(|e| format!("Cannot create '{}': {e}", partial.display()))?;

        while let Some(chunk) = resp
            .chunk()
            .await
            .map_err(|e| format!("Download error: {e}"))?
        {
            downloaded += chunk.len() as u64;
            file.write_all(&chunk)
                .map_err(|e| format!("Write error: {e}"))?;

            if downloaded.saturating_sub(last_emit) >= EMIT_INTERVAL_BYTES || downloaded >= total {
                last_emit = downloaded;
                let _ = app.emit(
                    "ephemeris-progress",
                    serde_json::json!({
                        "id": id,
                        "bytes_done": downloaded,
                        "bytes_total": total,
                    }),
                );
            }
        }
        drop(file);

        std::fs::rename(&partial, &final_path)
            .map_err(|e| format!("Cannot finalise download: {e}"))?;

        // The newly downloaded kernel must be visible to the very next computation, not just
        // after a restart — drop this cache_dir's `available_bsp_paths` cache entry.
        bsp_paths_cache().lock().unwrap().remove(&self.cache_dir);

        let _ = app.emit("ephemeris-ready", serde_json::json!({ "id": id }));
        log::info!(
            "ephemeris: download complete — {id} at {}",
            final_path.display()
        );
        Ok(())
    }
}

fn file_fingerprint(path: &Path) -> String {
    let Ok(metadata) = std::fs::metadata(path) else {
        return format!("{}:missing", path.display());
    };
    let modified = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|value| value.as_nanos())
        .unwrap_or_default();
    format!("{}:{}:{modified}", path.display(), metadata.len())
}

fn artifact_probe_cache() -> &'static Mutex<HashMap<String, Result<(), String>>> {
    static CACHE: OnceLock<Mutex<HashMap<String, Result<(), String>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn bsp_paths_cache() -> &'static Mutex<HashMap<PathBuf, Vec<PathBuf>>> {
    static CACHE: OnceLock<Mutex<HashMap<PathBuf, Vec<PathBuf>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = std::fs::File::open(path)
        .map_err(|error| format!("cannot open artifact for checksum: {error}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|error| format!("cannot checksum artifact: {error}"))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn validate_small_body_artifact(
    manifest_path: &Path,
    bsp_path: &Path,
    manifest: &SmallBodySpkManifest,
    existing: &[PathBuf],
) -> Result<(), String> {
    let cache_key = std::iter::once(manifest_path)
        .chain(std::iter::once(bsp_path))
        .map(file_fingerprint)
        .chain(existing.iter().map(|path| file_fingerprint(path)))
        .collect::<Vec<_>>()
        .join("|");
    if let Ok(cache) = artifact_probe_cache().lock() {
        if let Some(result) = cache.get(&cache_key) {
            return result.clone();
        }
    }

    let result = (|| {
        let actual_sha256 = sha256_file(bsp_path)?;
        if !actual_sha256.eq_ignore_ascii_case(&manifest.sha256) {
            return Err(format!(
                "SHA-256 mismatch: manifest {}, artifact {actual_sha256}",
                manifest.sha256
            ));
        }
        if existing.is_empty() {
            return Err("cannot probe without a planetary primary SPK".to_string());
        }
        let mut probe_paths = existing.to_vec();
        probe_paths.push(bsp_path.to_path_buf());
        let almanac = load_almanac_from_paths(&probe_paths)?;
        let epoch = Epoch::from_tdb_seconds(manifest.validation.probe_et_seconds);
        let state = almanac
            .transform(
                Frame::from_ephem_j2000(manifest.naif_target_id),
                EARTH_MOD_FRAME,
                epoch,
                None,
            )
            .map_err(|error| format!("ANISE in-range state probe failed: {error}"))?;
        let components = [
            state.radius_km.x,
            state.radius_km.y,
            state.radius_km.z,
            state.velocity_km_s.x,
            state.velocity_km_s.y,
            state.velocity_km_s.z,
        ];
        if components.iter().any(|value| !value.is_finite()) {
            return Err("ANISE state probe returned a non-finite component".to_string());
        }
        Ok(())
    })();

    if let Ok(mut cache) = artifact_probe_cache().lock() {
        cache.insert(cache_key, result.clone());
    }
    result
}

pub(crate) fn load_almanac_from_paths(paths: &[PathBuf]) -> Result<Almanac, String> {
    let sibling_pck = paths.iter().find_map(|path| {
        path.parent()
            .map(|parent| parent.join(PCK11_FILENAME))
            .filter(|candidate| candidate.exists())
    });
    let pck_path = sibling_pck
        .or_else(|| EphemerisManager::from_global().find_bundled_kernel(PCK11_FILENAME))
        .ok_or_else(|| {
            format!("Required ANISE planetary-orientation kernel '{PCK11_FILENAME}' was not found")
        })?;
    let pck = pck_path
        .to_str()
        .ok_or("Planetary-orientation kernel path contains non-UTF-8 characters")?;
    let mut almanac = Almanac::default()
        .load(pck)
        .map_err(|e| format!("Failed to load '{}': {e}", pck_path.display()))?;

    for (idx, path) in paths.iter().enumerate() {
        let s = path
            .to_str()
            .ok_or("BSP path contains non-UTF-8 characters")?;
        match almanac.clone().load(s) {
            Ok(next) => almanac = next,
            Err(e) if idx > 0 => {
                log::warn!(
                    "ephemeris: skipping BSP {} after primary already loaded — {}",
                    path.display(),
                    e
                );
            }
            Err(e) => {
                return Err(format!("Failed to load '{}': {e}", path.display()));
            }
        }
    }
    Ok(almanac)
}

#[cfg(test)]
mod usable_coverage_tests {
    use super::*;

    const CERES_ID: i32 = 2_000_001;
    const CHIRON_ID: i32 = 20_002_060;

    /// A real SPK-boundary gap, tested directly against the pure merge
    /// function (no kernels required): [0,10] usable, (10,20) a hole, [20,30]
    /// usable again. The hole must survive as two separate intervals, not get
    /// bridged by the surrounding coverage.
    #[test]
    fn merge_probed_intervals_reports_a_genuine_gap_as_two_intervals() {
        let boundaries = vec![0.0, 10.0, 20.0, 30.0];
        let intervals = merge_probed_intervals(&boundaries, |t| !(10.0..20.0).contains(&t));
        assert_eq!(intervals, vec![(0.0, 10.0), (20.0, 30.0)]);
    }

    #[test]
    fn merge_probed_intervals_merges_adjacent_true_runs_into_one_interval() {
        let boundaries = vec![0.0, 10.0, 20.0, 30.0];
        let intervals = merge_probed_intervals(&boundaries, |_| true);
        assert_eq!(intervals, vec![(0.0, 30.0)]);
    }

    #[test]
    fn merge_probed_intervals_reports_nothing_when_never_usable() {
        let boundaries = vec![0.0, 10.0, 20.0];
        let intervals = merge_probed_intervals(&boundaries, |_| false);
        assert!(intervals.is_empty());
    }

    #[test]
    fn merge_probed_intervals_handles_a_leading_and_trailing_gap() {
        // usable only in the middle third: a gap on each side.
        let boundaries = vec![0.0, 10.0, 20.0, 30.0];
        let intervals = merge_probed_intervals(&boundaries, |t| (10.0..20.0).contains(&t));
        assert_eq!(intervals, vec![(10.0, 20.0)]);
    }

    fn resource(filename: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join(filename)
    }

    fn fixture(filename: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join("ephemeris")
            .join(filename)
    }

    fn year_of(tdb: &str) -> i32 {
        // "YYYY-MM-DDT..." — also handles a leading '-' for BCE years.
        let (sign, rest) = tdb
            .strip_prefix('-')
            .map(|rest| (-1, rest))
            .unwrap_or((1, tdb));
        sign * rest[..4].parse::<i32>().expect("4-digit year prefix")
    }

    /// Builds a minimal, valid-enough-to-parse synthetic SPK containing
    /// exactly the given (target_id, center_id, start_et_s, end_et_s)
    /// summary entries — real loaded-segment target/center *metadata*, with
    /// no actual Chebyshev coefficient data. This is sufficient for anything
    /// that only reads summaries (`spk_summaries`, `spk_summary_at_epoch`,
    /// `ephemeris_path_to_root`, `common_ephemeris_path`) — i.e. everything
    /// `usable_earth_relative_coverage` uses *except* the final
    /// `Almanac::transform` probe, which needs real polynomial data and is
    /// therefore not exercised by the tests using this helper. Mirrors the
    /// construction `anise::ephemerides::paths::path_depth_ut` uses
    /// internally, substituting its two `pub(crate)` helpers
    /// (`FileRecord::spk`, `Endian::daf_endian_str`) with public-API
    /// equivalents since this crate is an external dependent, not `anise`
    /// itself.
    pub(super) fn synthetic_spk(entries: &[(i32, i32, f64, f64)]) -> anise::naif::SPK {
        use anise::naif::daf::file_record::FileRecord;
        use anise::naif::spk::summary::SPKSummaryRecord;
        use zerocopy::IntoBytes;

        let endian_str: [u8; 8] = if cfg!(target_endian = "big") {
            *b"BIG-IEEE"
        } else {
            *b"LTL-IEEE"
        };
        let file_record = FileRecord {
            id_str: *b"DAF/SPK ",
            nd: 2,
            ni: 6,
            internal_filename: {
                let mut name = [0u8; 60];
                for (dest, src) in name.iter_mut().zip(b"KEFER-TEST") {
                    *dest = *src;
                }
                name
            },
            forward: 2,
            backward: 2,
            free_addr: 0,
            endian_str,
            ..FileRecord::default()
        };

        let mut bytes = Vec::new();
        bytes.extend_from_slice(file_record.as_bytes());
        bytes.resize(1024, 0);

        // `SummaryRecord`'s fields are crate-private to `anise`; its layout
        // is simply three native-endian f64s (next/prev record pointers,
        // summary count), so the header is written directly as bytes.
        let mut summary_block = Vec::new();
        summary_block.extend_from_slice(&0.0_f64.to_ne_bytes()); // next_record
        summary_block.extend_from_slice(&0.0_f64.to_ne_bytes()); // prev_record
        summary_block.extend_from_slice(&(entries.len() as f64).to_ne_bytes()); // num_summaries
        for &(target_id, center_id, start_epoch_et_s, end_epoch_et_s) in entries {
            let summary = SPKSummaryRecord {
                start_epoch_et_s,
                end_epoch_et_s,
                target_id,
                center_id,
                frame_id: 1,
                data_type_i: 2,
                start_idx: 1,
                end_idx: 100,
            };
            summary_block.extend_from_slice(summary.as_bytes());
        }
        summary_block.resize(1024, 0);
        bytes.extend(summary_block);

        // Name record block — unused by anything these tests exercise.
        bytes.extend(vec![0u8; 1024]);

        anise::naif::SPK::parse(bytes).expect("synthetic SPK bytes should parse")
    }

    /// Complete chain: Ceres resolves target(2000001) → Sun(10) → SSB(0) → EMB(3)
    /// → Earth(399). This empirically measures (not assumes) the real stored
    /// segment bounds: de440s's own translational segments for Sun/EMB/Earth
    /// extend to 1849-12-26..2150-01-21 — materially wider than the catalog's
    /// documentation-facing "1900-2050" label — while codes_300ast's actual
    /// Ceres segment is 1799-12-30..2199-12-13. The usable intersection is
    /// therefore gated by the Earth-chain (de440s), not by Ceres's own file.
    #[test]
    fn complete_chain_reports_single_continuous_window_for_ceres() {
        let paths = vec![
            resource("de440s.bsp"),
            resource("codes_300ast_20100725.bsp"),
        ];
        let report = usable_earth_relative_coverage(&paths, CERES_ID, false)
            .expect("complete chain should compute");

        assert_eq!(
            report.intervals.len(),
            1,
            "expected one continuous window: {:?}",
            report.intervals
        );
        let interval = &report.intervals[0];
        assert_eq!(year_of(&interval.start_tdb), 1849, "{}", interval.start_tdb);
        assert_eq!(year_of(&interval.end_tdb), 2150, "{}", interval.end_tdb);
        assert_eq!(
            report.determination,
            CoverageDetermination::Determined,
            "both sides of the chain should be genuinely discoverable here"
        );

        // Every id actually needed for this chain must show up — including
        // 3 (the Earth-Moon barycenter), which only the *Earth-side* ascent
        // discovery can find (Ceres's own ascent is Sun->SSB and never
        // passes through the EMB at all).
        for id in [CERES_ID, 10, 0, 3, 399] {
            assert!(
                report.chain_ids_considered.contains(&id),
                "expected {id} in {:?}",
                report.chain_ids_considered
            );
        }
    }

    /// Missing link: codes_300ast alone has Ceres's own segment but no
    /// Sun/EMB/Earth segment at all, so there is no path to Earth. This must
    /// report empty usable coverage (geometrically unreachable), not an error
    /// and not Ceres's raw file-declared range.
    #[test]
    fn missing_earth_chain_link_reports_empty_usable_coverage() {
        let paths = vec![resource("codes_300ast_20100725.bsp")];
        let report = usable_earth_relative_coverage(&paths, CERES_ID, false)
            .expect("a present-but-unreachable target must not be an error");
        assert!(
            report.intervals.is_empty(),
            "expected no usable coverage without an Earth-chain kernel: {:?}",
            report.intervals
        );
        // No Earth segment is loaded at all here — that absence is itself
        // conclusive, not a discovery failure, so this must be `Determined`
        // (empty), not `Unknown`.
        assert_eq!(report.determination, CoverageDetermination::Determined);
    }

    /// A target entirely absent from every loaded kernel (not even its own
    /// segment) must also report empty coverage, not an error.
    #[test]
    fn absent_target_reports_empty_usable_coverage_not_error() {
        let paths = vec![resource("de440s.bsp")];
        let report = usable_earth_relative_coverage(&paths, CHIRON_ID, false)
            .expect("an absent target must not be an error");
        assert!(report.intervals.is_empty());
        assert_eq!(report.determination, CoverageDetermination::Determined);
    }

    /// Overlapping kernels + evaluator precedence: loading the standalone
    /// `ceres_1900_2100.bsp` *before* the bundled `codes_300ast` (which is
    /// loaded last) must not change the result, because codes_300ast's own
    /// Ceres segment (1799-2199) is a strict superset of the standalone
    /// file's declared 1900-2100 and therefore always wins under "last
    /// loaded wins" — this is a real two-file overlap, not a synthetic one.
    #[test]
    fn overlapping_kernel_is_fully_shadowed_by_last_loaded_superset_segment() {
        let without_standalone = vec![
            resource("de440s.bsp"),
            resource("codes_300ast_20100725.bsp"),
        ];
        let with_standalone = vec![
            resource("de440s.bsp"),
            fixture("ceres_1900_2100.bsp"),
            resource("codes_300ast_20100725.bsp"),
        ];

        let a = usable_earth_relative_coverage(&without_standalone, CERES_ID, false)
            .expect("two-file chain should compute");
        let b = usable_earth_relative_coverage(&with_standalone, CERES_ID, false)
            .expect("three-file chain should compute");

        assert_eq!(a.intervals.len(), b.intervals.len());
        for (x, y) in a.intervals.iter().zip(b.intervals.iter()) {
            assert!((x.start_et_seconds - y.start_et_seconds).abs() < 1.0);
            assert!((x.end_et_seconds - y.end_et_seconds).abs() < 1.0);
        }
    }

    /// Corrects an initial (wrong) assumption behind this test: reversing
    /// load order does **not** narrow usable coverage here. ANISE's
    /// `spk_summary_at_epoch` walks loaded files in reverse-load order and
    /// *falls through* to the next-earlier file whenever the most-recent one
    /// has no valid segment at the probed epoch (confirmed by reading
    /// `anise::almanac::spk::Almanac::spk_summary_at_epoch`). "Last loaded
    /// wins" therefore only changes *which segment's numbers* are used for an
    /// epoch covered by multiple files — it can never shrink the union of
    /// what is reachable, because any epoch outside the last-loaded file's
    /// window simply falls through. Empirically, these two Ceres kernels also
    /// return bit-identical state vectors at a shared epoch regardless of
    /// load order, so this pair cannot demonstrate a numeric precedence
    /// difference either — both checks are asserted below instead of assumed.
    #[test]
    fn load_order_does_not_change_usable_coverage_when_one_segment_is_a_superset() {
        let codes_last = vec![
            resource("de440s.bsp"),
            fixture("ceres_1900_2100.bsp"),
            resource("codes_300ast_20100725.bsp"),
        ];
        let standalone_last = vec![
            resource("de440s.bsp"),
            resource("codes_300ast_20100725.bsp"),
            fixture("ceres_1900_2100.bsp"),
        ];

        let a =
            usable_earth_relative_coverage(&codes_last, CERES_ID, false).expect("should compute");
        let b = usable_earth_relative_coverage(&standalone_last, CERES_ID, false)
            .expect("should compute");
        assert_eq!(a.intervals.len(), 1);
        assert_eq!(b.intervals.len(), 1);
        assert_eq!(year_of(&a.intervals[0].start_tdb), 1849);
        assert_eq!(year_of(&b.intervals[0].start_tdb), 1849);

        let epoch = Epoch::from_gregorian_utc(2000, 1, 1, 0, 0, 0, 0);
        let frame = Frame::from_ephem_j2000(CERES_ID);
        let state_a = load_almanac_from_paths(&codes_last)
            .unwrap()
            .transform(frame, EARTH_MOD_FRAME, epoch, None)
            .expect("codes-last transform");
        let state_b = load_almanac_from_paths(&standalone_last)
            .unwrap()
            .transform(frame, EARTH_MOD_FRAME, epoch, None)
            .expect("standalone-last transform");
        assert_eq!(
            state_a.radius_km, state_b.radius_km,
            "both bundled Ceres kernels share the same underlying solution at this epoch"
        );
    }

    /// Chiron's bundled artifact is stored as *two* adjacent SPK segments
    /// (1900-01-01..2009-06-09 and 2009-06-10..2099-12-31) with no gap
    /// between them. Usable coverage must merge them into one interval
    /// spanning the full range, not report a spurious split at the internal
    /// segment seam.
    #[test]
    fn contiguous_multi_segment_target_merges_into_one_interval() {
        let paths = vec![
            resource("de440s.bsp"),
            resource("chiron_1900_2100_type13.bsp"),
        ];
        let report = usable_earth_relative_coverage(&paths, CHIRON_ID, false)
            .expect("chiron chain should compute");
        assert_eq!(
            report.intervals.len(),
            1,
            "two contiguous segments must merge into one interval: {:?}",
            report.intervals
        );
        assert_eq!(year_of(&report.intervals[0].start_tdb), 1900);
        assert_eq!(year_of(&report.intervals[0].end_tdb), 2099);
    }

    /// Apparent-mode coverage must never be wider than geometric-mode
    /// coverage for the same kernel set: light-time/aberration correction can
    /// only ever make the evaluator need *more* of the chain's range (via the
    /// retarded epoch), never less.
    #[test]
    fn apparent_coverage_is_not_wider_than_geometric_coverage() {
        let paths = vec![
            resource("de440s.bsp"),
            resource("codes_300ast_20100725.bsp"),
        ];
        let geometric = usable_earth_relative_coverage(&paths, CERES_ID, false).expect("geometric");
        let apparent = usable_earth_relative_coverage(&paths, CERES_ID, true).expect("apparent");

        let span = |report: &UsableCoverageReport| -> f64 {
            report
                .intervals
                .iter()
                .map(|interval| interval.end_et_seconds - interval.start_et_seconds)
                .sum()
        };
        assert!(
            span(&apparent) <= span(&geometric) + 1.0,
            "apparent span {} must not exceed geometric span {}",
            span(&apparent),
            span(&geometric)
        );
    }

    // ─── Synthetic-SPK scenarios ────────────────────────────────────────
    //
    // Real bundled/downloadable kernels cannot exhibit a missing center
    // link, an alternate chain, or a deeper-than-supported chain on demand;
    // these use `synthetic_spk` (summary *metadata* only, no Chebyshev
    // coefficient data) to drive `ephemeris_path_to_root`/`spk_summary_at_epoch`
    // — the real evaluator's own chain-resolution and precedence code —
    // directly and deterministically. `Almanac::transform` itself is not
    // exercised by these (no real position data exists to return), so they
    // validate chain discovery, precedence, and the `Determined`/`Unknown`
    // split, not the final numeric transform — the real-kernel tests above
    // already cover that combination for the chains they can construct.

    /// A target's own segment exists, but its *center* has no segment of its
    /// own anywhere — a genuinely broken link, not merely "target absent."
    /// `ephemeris_path_to_root` must fail for this target at every epoch, so
    /// coverage analysis must report `Unknown`, not a confident empty
    /// `Determined` result (it cannot actually tell whether the target is
    /// reachable; it only knows its own one-hop center is a dead end).
    #[test]
    fn missing_center_link_reports_unknown_not_a_confident_unavailable() {
        let spk = synthetic_spk(&[
            (900_001, 900_002, -100.0, 100.0), // center 900_002 is never defined: a dead end
            // An unrelated, fully-resolving entry establishes center 0 as the
            // evaluator's inferred common root (the smallest center id seen).
            // Without this, a single-entry kernel would make `900_002` look
            // like a trivially-satisfied root instead of a genuine dead end —
            // not a representative "missing link" case.
            (900_099, 0, -1000.0, 1000.0),
        ]);
        let almanac = Almanac::from_spk(spk);
        let report = usable_earth_relative_coverage_from_almanac(&almanac, 900_001, false);

        assert!(
            matches!(report.determination, CoverageDetermination::Unknown { .. }),
            "expected Unknown, got {:?}",
            report.determination
        );
        assert!(
            report.intervals.is_empty(),
            "no Chebyshev data exists in this synthetic kernel, so transform cannot succeed \
             regardless of chain validity: {:?}",
            report.intervals
        );
    }

    /// A target whose center genuinely differs across two non-overlapping
    /// windows of its own lifetime (e.g. a body re-targeted to a different
    /// barycenter convention partway through) — both windows independently
    /// resolve to Earth, through two different intermediate ids. Discovery
    /// must find *both* ids, and both windows must merge into the reported
    /// coverage (not just whichever chain the first probe happened to find).
    #[test]
    fn alternate_valid_chain_across_the_targets_own_lifetime_is_fully_discovered() {
        let spk = synthetic_spk(&[
            (900_001, 900_010, -200.0, 0.0), // era 1: center 900_010
            (900_001, 900_020, 0.0, 200.0),  // era 2: center 900_020
            (900_010, 0, -1000.0, 1000.0),   // era-1 center resolves to the root
            (900_020, 0, -1000.0, 1000.0),   // era-2 center also resolves to the root
        ]);
        let almanac = Almanac::from_spk(spk);
        let report = usable_earth_relative_coverage_from_almanac(&almanac, 900_001, false);

        assert_eq!(report.determination, CoverageDetermination::Determined);
        for id in [900_010, 900_020] {
            assert!(
                report.chain_ids_considered.contains(&id),
                "expected era-specific center {id} to be discovered: {:?}",
                report.chain_ids_considered
            );
        }
    }

    /// Falsifies an over-generalization this project's own documentation
    /// initially made: that "last loaded wins" can only change *which
    /// file's numbers* are used, never narrow usable coverage. Here, a
    /// later-loaded file shadows an *overlapping* sub-window with a
    /// *different, dead-end* center — real-world bundled kernels never
    /// exhibited this during development (their shadowing files always had
    /// a fully valid alternate chain too), but the evaluator's own
    /// reverse-load-order precedence makes this a reachable case in
    /// principle, and it must not be asserted away without a test.
    #[test]
    fn last_loaded_file_can_shadow_an_otherwise_valid_chain_with_a_dead_end() {
        let underlying = synthetic_spk(&[
            (900_001, 900_010, -100.0, 100.0), // works for the whole window
            (900_010, 0, -1000.0, 1000.0),
        ]);
        let shadowing_with_dead_end = synthetic_spk(&[
            (900_001, 900_099, -50.0, 50.0), // center 900_099 is never defined
        ]);
        let almanac = Almanac::default()
            .with_spk(underlying)
            .with_spk(shadowing_with_dead_end);
        let frame = Frame::from_ephem_j2000(900_001);

        // Outside the shadowed sub-window: the underlying file's valid chain
        // is unshadowed and resolves normally.
        assert!(almanac.ephemeris_path_to_root(frame, -75.0).is_ok());
        assert!(almanac.ephemeris_path_to_root(frame, 75.0).is_ok());
        // Inside the shadowed sub-window: the last-loaded file's record wins
        // per reverse-load-order precedence, and its center is a dead end —
        // chain resolution fails here even though the *other* loaded file
        // would have resolved this exact instant just fine.
        assert!(
            almanac.ephemeris_path_to_root(frame, 0.0).is_err(),
            "expected the shadowing file's dead-end center to break resolution at this instant"
        );
    }

    /// Confirms the real evaluator's own `MaxRecursionDepth` limit (8 nodes)
    /// surfaces as `Unknown`, not a silently wrong `Determined` answer built
    /// from a truncated chain. Mirrors the chain depth anise's own
    /// `ephemeris_path_deeper_than_max_depth_errors` unit test constructs.
    #[test]
    fn chain_deeper_than_evaluator_limit_reports_unknown() {
        let entries: Vec<(i32, i32, f64, f64)> = (2..=10)
            .rev()
            .map(|target| (target, target - 1, -1e9, 1e9))
            .collect();
        let spk = synthetic_spk(&entries);
        let almanac = Almanac::from_spk(spk);
        let report = usable_earth_relative_coverage_from_almanac(&almanac, 10, false);

        assert!(
            matches!(report.determination, CoverageDetermination::Unknown { .. }),
            "expected Unknown for a chain deeper than ANISE's MAX_TREE_DEPTH, got {:?}",
            report.determination
        );
    }
}
