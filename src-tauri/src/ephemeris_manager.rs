/// Ephemeris catalog, cache management, and multi-BSP almanac construction.
///
/// Maintains a static catalog of known JPL BSP files (de440s, de440, de441 parts),
/// resolves locally available files (bundled + user-downloaded), and builds a chained
/// `anise::Almanac` from all of them so asteroid bodies are available alongside planets.

use std::io::Write as IoWrite;
use std::path::PathBuf;
use std::sync::OnceLock;

use anise::prelude::{Almanac, Frame};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const DEFAULT_CACHE_DIR: &str = "ephemeris";
const USER_AGENT: &str = "KeferAstrology/2.0 (ephemeris downloader)";
const EMIT_INTERVAL_BYTES: u64 = 512 * 1024;

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

/// Called once during Tauri app setup with the platform app-data directory.
pub fn init_cache_dir(dir: PathBuf) {
    CACHE_DIR.set(dir).ok();
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
    "sun", "moon", "mercury", "venus", "mars",
    "jupiter", "saturn", "uranus", "neptune", "pluto",
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
        name if name.contains("codes_300ast") && name.ends_with(".bsp") => Some(CODES_300AST_MAJOR_BODIES),
        DE440S_FILENAME | DE440_FILENAME => Some(DE_PLANETS),
        "de441_part-1.bsp" | "de441_part-2.bsp" => Some(DE_PLANETS),
        _ => None,
    }
}

/// Union of body IDs implied by the given on-disk BSP paths (planets + asteroids).
pub fn bodies_available_for_bsp_paths(paths: &[PathBuf]) -> Vec<String> {
    use std::collections::HashSet;
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
    }
    let mut out: Vec<String> = set.into_iter().collect();
    out.sort();
    out
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
            return Some(cached);
        }
        self.find_bundled_bsp(entry.filename)
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
        path.exists().then_some(path)
    }

    fn bundled_bsp_search_candidates(&self, filename: &str) -> Vec<PathBuf> {
        let resources = format!("resources/{filename}");
        let tauri_res = format!("../src-tauri/resources/{filename}");
        let py_src = format!("backend-python/source/{filename}");
        let py_src_up = format!("../backend-python/source/{filename}");

        let mut candidates = vec![
            PathBuf::from(filename),
            PathBuf::from(&resources),
            PathBuf::from(&tauri_res),
            PathBuf::from(&py_src),
            PathBuf::from(&py_src_up),
        ];

        if let Ok(exe) = std::env::current_exe() {
            for base in exe.ancestors() {
                candidates.push(base.join(filename));
                candidates.push(base.join(&resources));
            }
        }

        candidates
    }

    fn find_bundled_bsp(&self, filename: &str) -> Option<PathBuf> {
        self.bundled_bsp_search_candidates(filename)
            .into_iter()
            .find(|path| path.exists())
    }

    fn resolve_primary_bsp(&self) -> Option<PathBuf> {
        for filename in PRIMARY_BSP_PRIORITY {
            if let Some(path) = self.cached_bsp_path(filename) {
                log::debug!("ephemeris: primary (cached) {} → {}", filename, path.display());
                return Some(path);
            }
            if let Some(path) = self.find_bundled_bsp(filename) {
                log::debug!("ephemeris: primary (bundled) {} → {}", filename, path.display());
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
            let Some(path) = self
                .cached_bsp_path(filename)
                .or_else(|| self.find_bundled_bsp(filename))
            else {
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

    /// All BSP paths currently available, in load order.
    ///
    /// 1. Exactly one primary kernel is selected from `PRIMARY_BSP_PRIORITY`.
    /// 2. Any downloaded de441 parts are appended as supplementary range extenders.
    /// 3. Available asteroid SPKs (`ceres_1900_2100.bsp`, optional downloads, bundled Ceres).
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

        while let Some(chunk) = resp.chunk().await.map_err(|e| format!("Download error: {e}"))? {
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
        log::info!("ephemeris: download complete — {id} at {}", final_path.display());
        Ok(())
    }
}

pub(crate) fn load_almanac_from_paths(paths: &[PathBuf]) -> Result<Almanac, String> {
    let mut almanac = Almanac::default();
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
