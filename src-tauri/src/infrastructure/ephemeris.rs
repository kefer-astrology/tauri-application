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
use anise::prelude::{Almanac, Frame};
use hifitime::Epoch;
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
            log::info!(
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
        let mut paths = Vec::new();
        if let Some(primary) = self.resolve_primary_bsp() {
            paths.push(primary);
        }
        paths.extend(self.resolve_supplementary_bsps());
        let asteroid_paths = self.resolve_asteroid_supplementary_bsps(&paths);
        paths.extend(asteroid_paths);
        let small_body_paths = self.resolve_small_body_bsps(&paths);
        paths.extend(small_body_paths);
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
