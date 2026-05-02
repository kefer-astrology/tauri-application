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
const DE421_FILENAME: &str = "de421.bsp";

const PRIMARY_BSP_PRIORITY: &[&str] = &[
    DE440S_FILENAME,
    DE440_FILENAME,
    DE421_FILENAME,
];

const SUPPLEMENTARY_DOWNLOAD_IDS: &[&str] = &[DE441_PART1_ID, DE441_PART2_ID];

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
];

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

    /// Full path for a catalog entry in the cache directory.
    pub fn local_path(&self, id: &str) -> Option<PathBuf> {
        self.catalog_entry(id)
            .map(|entry| self.cache_dir.join(entry.filename))
    }

    pub fn is_downloaded(&self, id: &str) -> bool {
        self.local_path(id).map_or(false, |p| p.exists())
    }

    fn catalog_status_for_entry(&self, entry: &'static EphemerisEntry) -> EphemerisInfo {
        let local = self.cache_dir.join(entry.filename);
        let is_downloaded = local.exists();

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
            local_path: is_downloaded.then(|| local.to_string_lossy().into_owned()),
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

    /// All BSP paths currently available, in load order.
    ///
    /// 1. Exactly one primary kernel is selected from `PRIMARY_BSP_PRIORITY`.
    /// 2. Any downloaded de441 parts are appended as supplementary range extenders.
    ///
    /// The primary currently resolves in this order:
    /// `de440s` → `de440` → `de421`.
    pub fn available_bsp_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();
        if let Some(primary) = self.resolve_primary_bsp() {
            paths.push(primary);
        }
        paths.extend(self.resolve_supplementary_bsps());
        paths
    }

    /// Build an `Almanac` by chaining `.load()` across all available BSP files.
    pub fn build_almanac(&self) -> Result<Almanac, String> {
        let paths = self.available_bsp_paths();
        if paths.is_empty() {
            return Err(
                "No BSP ephemeris files found. Ensure de440s.bsp is bundled or download one \
                 via the ephemeris manager."
                    .to_string(),
            );
        }
        let mut almanac = Almanac::default();
        for path in &paths {
            let s = path
                .to_str()
                .ok_or("BSP path contains non-UTF-8 characters")?;
            almanac = almanac
                .load(s)
                .map_err(|e| format!("Failed to load '{}': {e}", path.display()))?;
        }
        Ok(almanac)
    }

    /// Download a BSP from the catalog into the cache directory.
    /// Emits `ephemeris-progress` (`{id, bytes_done, bytes_total}`) every ~512 KB
    /// and `ephemeris-ready` (`{id}`) on completion.
    pub async fn download(&self, id: &str, app: &AppHandle) -> Result<(), String> {
        let entry = self
            .catalog_entry(id)
            .ok_or_else(|| format!("Unknown ephemeris id: '{id}'"))?;

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
