/// Astronomy backend using the `anise` crate (MPL-2.0) with SPICE BSP ephemeris files.
///
/// Loads all available BSP files (bundled de440s.bsp + any user-downloaded files) via
/// `EphemerisManager` into a chained `Almanac`. Standard DE planetary kernels provide the
/// 10 planets + Moon; asteroid bodies require a separate dedicated asteroid SPK kernel.
/// Gaps handled above the astronomy layer:
///   - Ecliptic longitude: ICRF → ecliptic via obliquity rotation in houses.rs
///   - Lunar nodes: computed analytically in houses.rs
///   - House cusps: computed in houses.rs
///   - Chiron: not in any standard DE file; planned via JPL Horizons API

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock, RwLock};

use anise::constants::frames::{
    EARTH_J2000, JUPITER_BARYCENTER_J2000, MARS_BARYCENTER_J2000, MERCURY_J2000, MOON_J2000,
    NEPTUNE_BARYCENTER_J2000, PLUTO_BARYCENTER_J2000, SATURN_BARYCENTER_J2000, SUN_J2000,
    URANUS_BARYCENTER_J2000, VENUS_J2000,
};
use anise::prelude::*;
use hifitime::Epoch;

use crate::astronomy::{AstronomyAxes, AstronomyBackend, AstronomyChartData, AstronomyMotion};
use crate::ephemeris_manager::{
    load_almanac_from_paths, EphemerisManager, ASTRAEA_J2000, CERES_J2000, EGERIA_J2000,
    EUNOMIA_J2000, FLORA_J2000, FORTUNA_J2000, HEBE_J2000, HYGIEA_J2000, IRIS_J2000,
    IRENE_J2000, JUNO_J2000, MASSALIA_J2000, MELPOMENE_J2000, METIS_J2000, PALLAS_J2000,
    PARTHENOPE_J2000, PSYCHE_J2000, THETIS_J2000, VICTORIA_J2000, VESTA_J2000,
};
use crate::houses::{
    compute_axes, general_precession_deg, icrf_to_ecliptic, julian_day_from_unix, mean_node_lon,
    mean_node_motion, mean_obliquity_deg, normalize_deg, placidus_cusps, true_node_tropical_deg,
    whole_sign_cusps,
};
use crate::workspace::models::{ChartInstance, HouseSystem};

// ─── Body table ──────────────────────────────────────────────────────────────

/// Maps Kefer body IDs to anise J2000 frames.
/// Bodies not present in the loaded BSP(s) are skipped with a warning — no hard failure.
fn body_frames() -> &'static [(&'static str, Frame)] {
    &[
        // Standard planets (all DE files)
        ("sun", SUN_J2000),
        ("moon", MOON_J2000),
        ("mercury", MERCURY_J2000),
        ("venus", VENUS_J2000),
        // DE planetary SPKs expose Mars through the barycenter frame, not 499.
        ("mars", MARS_BARYCENTER_J2000),
        ("jupiter", JUPITER_BARYCENTER_J2000),
        ("saturn", SATURN_BARYCENTER_J2000),
        ("uranus", URANUS_BARYCENTER_J2000),
        ("neptune", NEPTUNE_BARYCENTER_J2000),
        ("pluto", PLUTO_BARYCENTER_J2000),
    ]
}

/// Small-body NAIF `2000001` … frames; each body resolves when a matching SPK segment
/// is present (bundled `ceres_1900_2100.bsp`, optional Pallas/Vesta singles, or `codes_300ast`).
fn asteroid_body_frames() -> &'static [(&'static str, Frame)] {
    &[
        ("ceres", CERES_J2000),
        ("pallas", PALLAS_J2000),
        ("juno", JUNO_J2000),
        ("vesta", VESTA_J2000),
        ("astraea", ASTRAEA_J2000),
        ("hebe", HEBE_J2000),
        ("iris", IRIS_J2000),
        ("flora", FLORA_J2000),
        ("metis", METIS_J2000),
        ("hygiea", HYGIEA_J2000),
        ("parthenope", PARTHENOPE_J2000),
        ("victoria", VICTORIA_J2000),
        ("egeria", EGERIA_J2000),
        ("irene", IRENE_J2000),
        ("eunomia", EUNOMIA_J2000),
        ("psyche", PSYCHE_J2000),
        ("thetis", THETIS_J2000),
        ("melpomene", MELPOMENE_J2000),
        ("fortuna", FORTUNA_J2000),
        ("massalia", MASSALIA_J2000),
    ]
}

/// When no explicit object list is given, only the first four classical asteroids are
/// sampled unless `codes_300ast` is on the path — otherwise optional bodies would each
/// emit an `_unavailable` warning for every chart.
fn asteroid_frames_for_request(
    bsp_paths: &[PathBuf],
    requested_objects: Option<&Vec<String>>,
) -> &'static [(&'static str, Frame)] {
    let full = asteroid_body_frames();
    if requested_objects.is_some() {
        return full;
    }
    let has_codes = bsp_paths.iter().any(|p| {
        p.file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|s| s.contains("codes_300ast"))
    });
    if has_codes {
        full
    } else {
        &full[..4]
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AlmanacCache = HashMap<String, Arc<Almanac>>;

fn almanac_cache() -> &'static RwLock<AlmanacCache> {
    static CACHE: OnceLock<RwLock<AlmanacCache>> = OnceLock::new();
    CACHE.get_or_init(|| RwLock::new(HashMap::new()))
}

fn almanac_cache_key(paths: &[PathBuf]) -> String {
    paths.iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("|")
}

fn sample_tropical_longitude(
    almanac: &Almanac,
    frame: Frame,
    unix_secs: f64,
) -> Result<f64, String> {
    let jd_ut = julian_day_from_unix(unix_secs);
    let epoch = Epoch::from_unix_seconds(unix_secs);
    let obliquity = mean_obliquity_deg(jd_ut);
    let tropical_offset = general_precession_deg(jd_ut);
    let state = almanac
        .translate(frame, EARTH_J2000, epoch, None)
        .map_err(|e| e.to_string())?;
    let (lon, _lat) =
        icrf_to_ecliptic(state.radius_km.x, state.radius_km.y, state.radius_km.z, obliquity);
    Ok(normalize_deg(lon + tropical_offset))
}

fn angular_delta_deg(from: f64, to: f64) -> f64 {
    let mut delta = normalize_deg(to) - normalize_deg(from);
    if delta > 180.0 {
        delta -= 360.0;
    } else if delta < -180.0 {
        delta += 360.0;
    }
    delta
}

fn sample_motion(almanac: &Almanac, frame: Frame, unix_secs: f64) -> Result<AstronomyMotion, String> {
    const SAMPLE_STEP_SECONDS: f64 = 3600.0;
    let before = sample_tropical_longitude(almanac, frame, unix_secs - SAMPLE_STEP_SECONDS)?;
    let after = sample_tropical_longitude(almanac, frame, unix_secs + SAMPLE_STEP_SECONDS)?;
    let delta = angular_delta_deg(before, after);
    let speed = delta / ((SAMPLE_STEP_SECONDS * 2.0) / 86_400.0);
    Ok(AstronomyMotion {
        speed,
        retrograde: speed < 0.0,
    })
}

fn true_node_tropical_at_unix(almanac: &Almanac, unix_secs: f64) -> Result<f64, String> {
    let jd_ut = julian_day_from_unix(unix_secs);
    let epoch = Epoch::from_unix_seconds(unix_secs);
    let state = almanac
        .translate(MOON_J2000, EARTH_J2000, epoch, None)
        .map_err(|e| e.to_string())?;
    true_node_tropical_deg(
        state.radius_km.x,
        state.radius_km.y,
        state.radius_km.z,
        state.velocity_km_s.x,
        state.velocity_km_s.y,
        state.velocity_km_s.z,
        jd_ut,
    )
    .ok_or_else(|| "true_node_unavailable: degenerate Moon state".to_string())
}

fn true_node_motion(almanac: &Almanac, unix_secs: f64) -> Result<AstronomyMotion, String> {
    const SAMPLE_STEP_SECONDS: f64 = 3600.0;
    let before = true_node_tropical_at_unix(almanac, unix_secs - SAMPLE_STEP_SECONDS)?;
    let after = true_node_tropical_at_unix(almanac, unix_secs + SAMPLE_STEP_SECONDS)?;
    let delta = angular_delta_deg(before, after);
    let speed = delta / ((SAMPLE_STEP_SECONDS * 2.0) / 86_400.0);
    Ok(AstronomyMotion {
        speed,
        retrograde: speed < 0.0,
    })
}

// ─── Backend ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct JplAstronomyBackend {
    /// All BSP files to load, in priority order. The first valid file wins for any given body.
    bsp_paths: Vec<PathBuf>,
}

impl JplAstronomyBackend {
    pub fn new(bsp_paths: Vec<PathBuf>) -> Self {
        Self { bsp_paths }
    }

    fn build_almanac(&self) -> Result<Arc<Almanac>, String> {
        if self.bsp_paths.is_empty() {
            return Err("No BSP ephemeris files available.".to_string());
        }

        let cache_key = almanac_cache_key(&self.bsp_paths);
        if let Some(cached) = almanac_cache()
            .read()
            .map_err(|_| "Almanac cache lock poisoned".to_string())?
            .get(&cache_key)
            .cloned()
        {
            return Ok(cached);
        }

        let shared = Arc::new(load_almanac_from_paths(&self.bsp_paths)?);
        almanac_cache()
            .write()
            .map_err(|_| "Almanac cache lock poisoned".to_string())?
            .insert(cache_key, Arc::clone(&shared));
        Ok(shared)
    }
}

impl AstronomyBackend for JplAstronomyBackend {
    fn backend_id(&self) -> &'static str {
        "jpl"
    }

    fn ephemeris_source(&self, _chart: &ChartInstance) -> Option<String> {
        if self.bsp_paths.is_empty() {
            None
        } else {
            Some(
                self.bsp_paths
                    .iter()
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect::<Vec<_>>()
                    .join(", "),
            )
        }
    }

    fn compute_chart_data(
        &self,
        chart: &ChartInstance,
        requested_objects: Option<&Vec<String>>,
    ) -> Result<AstronomyChartData, String> {
        let almanac = self.build_almanac()?;

        let event_time = chart
            .subject
            .event_time
            .ok_or_else(|| "Chart has no subject.event_time".to_string())?;

        let unix_secs =
            event_time.timestamp() as f64 + event_time.timestamp_subsec_nanos() as f64 * 1e-9;
        let jd_ut = julian_day_from_unix(unix_secs);
        let epoch = Epoch::from_unix_seconds(unix_secs);
        let obliquity = mean_obliquity_deg(jd_ut);
        let tropical_offset = general_precession_deg(jd_ut);

        let wanted = |id: &str| {
            requested_objects
                .map(|list| list.iter().any(|s| s.as_str() == id))
                .unwrap_or(true)
        };

        let mut positions: HashMap<String, f64> = HashMap::new();
        let mut motion: HashMap<String, AstronomyMotion> = HashMap::new();
        let mut warnings: Vec<String> = Vec::new();

        // ── Standard planetary positions ─────────────────────────────────
        for &(id, frame) in body_frames() {
            if !wanted(id) {
                continue;
            }
            match almanac.translate(frame, EARTH_J2000, epoch, None) {
                Ok(state) => {
                    let (lon, _lat) = icrf_to_ecliptic(
                        state.radius_km.x,
                        state.radius_km.y,
                        state.radius_km.z,
                        obliquity,
                    );
                    positions.insert(id.to_string(), normalize_deg(lon + tropical_offset));
                    if let Ok(body_motion) = sample_motion(&almanac, frame, unix_secs) {
                        motion.insert(id.to_string(), body_motion);
                    }
                }
                Err(e) => {
                    warnings.push(format!("{id}_unavailable: {e}"));
                }
            }
        }

        // ── Asteroid / minor-planet positions (per-body; missing SPK → warning only) ──
        for &(id, frame) in asteroid_frames_for_request(&self.bsp_paths, requested_objects) {
            if !wanted(id) {
                continue;
            }
            match almanac.translate(frame, EARTH_J2000, epoch, None) {
                Ok(state) => {
                    let (lon, _lat) = icrf_to_ecliptic(
                        state.radius_km.x,
                        state.radius_km.y,
                        state.radius_km.z,
                        obliquity,
                    );
                    positions.insert(id.to_string(), normalize_deg(lon + tropical_offset));
                    if let Ok(body_motion) = sample_motion(&almanac, frame, unix_secs) {
                        motion.insert(id.to_string(), body_motion);
                    }
                }
                Err(e) => {
                    warnings.push(format!("{id}_unavailable: {e}"));
                }
            }
        }

        // ── Lunar nodes ───────────────────────────────────────────────────
        let mean_node = mean_node_lon(jd_ut);
        let mean_motion = mean_node_motion(jd_ut);
        if wanted("north_node") || wanted("mean_node") {
            let key = if wanted("north_node") { "north_node" } else { "mean_node" };
            positions.insert(key.to_string(), mean_node);
            motion.insert(key.to_string(), mean_motion.clone());
        }
        if wanted("south_node") || wanted("mean_south_node") {
            let key = if wanted("south_node") { "south_node" } else { "mean_south_node" };
            positions.insert(key.to_string(), (mean_node + 180.0) % 360.0);
            motion.insert(key.to_string(), mean_motion);
        }

        let want_true_nn = wanted("true_north_node") || wanted("true_node");
        let want_true_sn = wanted("true_south_node");
        if want_true_nn || want_true_sn {
            match true_node_tropical_at_unix(&almanac, unix_secs) {
                Ok(true_nn) => {
                    let true_motion = true_node_motion(&almanac, unix_secs).ok();
                    if want_true_nn {
                        positions.insert("true_north_node".to_string(), true_nn);
                        if wanted("true_node") {
                            positions.insert("true_node".to_string(), true_nn);
                        }
                        if let Some(ref m) = true_motion {
                            motion.insert("true_north_node".to_string(), m.clone());
                            if wanted("true_node") {
                                motion.insert("true_node".to_string(), m.clone());
                            }
                        }
                    }
                    if want_true_sn {
                        let true_sn = (true_nn + 180.0) % 360.0;
                        positions.insert("true_south_node".to_string(), true_sn);
                        if let Some(m) = true_motion {
                            motion.insert("true_south_node".to_string(), m);
                        }
                    }
                }
                Err(e) => {
                    warnings.push(e);
                }
            }
        }

        // Chiron is not in any standard DE planetary ephemeris
        if wanted("chiron") {
            warnings.push(
                "chiron_not_available: not in standard DE files; JPL Horizons API planned"
                    .to_string(),
            );
        }

        // ── Axes and house cusps ──────────────────────────────────────────
        let lat = chart.subject.location.latitude;
        let lon = chart.subject.location.longitude;

        let (asc, mc, desc, ic) = compute_axes(jd_ut, lat, lon)
            .map_err(|e| format!("Failed to compute axes: {e}"))?;

        let axes = AstronomyAxes { asc, desc, mc, ic };

        let (house_cusps, house_warnings) = match chart.config.house_system.clone() {
            Some(HouseSystem::WholeSign) | None => (whole_sign_cusps(asc), vec![]),
            Some(HouseSystem::Placidus) => placidus_cusps(jd_ut, lat, lon, asc, mc),
            Some(other) => {
                let name = format!("{other:?}").to_lowercase();
                (
                    whole_sign_cusps(asc),
                    vec![format!("house_system_{name}_not_yet_supported: whole_sign_used")],
                )
            }
        };
        warnings.extend(house_warnings);

        Ok(AstronomyChartData {
            positions,
            motion,
            axes,
            house_cusps,
            warnings,
        })
    }
}

// ─── Path resolution ─────────────────────────────────────────────────────────

/// Build a `JplAstronomyBackend` for a chart.
///
/// If the chart has `override_ephemeris` set to a valid `.bsp` path, only that
/// file is used. Otherwise, all available BSP files are loaded via `EphemerisManager`.
pub fn jpl_backend_for_chart(chart: &ChartInstance) -> Result<JplAstronomyBackend, String> {
    // Per-chart override takes priority
    if let Some(path) = chart.config.override_ephemeris.as_deref() {
        let p = PathBuf::from(path);
        if p.exists() && p.extension().map_or(false, |e| e == "bsp") {
            return Ok(JplAstronomyBackend::new(vec![p]));
        }
    }

    let manager = EphemerisManager::from_global();
    let paths = manager.available_bsp_paths();
    if paths.is_empty() {
        return Err(
            "No BSP ephemeris file found. Set KEFER_BSP_PATH, place de440s.bsp next to the \
             binary, or download one via the ephemeris manager."
                .to_string(),
        );
    }
    Ok(JplAstronomyBackend::new(paths))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_bsp_returns_error() {
        let backend = JplAstronomyBackend::new(vec![PathBuf::from("nonexistent.bsp")]);
        assert!(backend.build_almanac().is_err());
    }

    fn j2000_chart(bsp_path: &str) -> crate::workspace::models::ChartInstance {
        serde_json::from_value(serde_json::json!({
            "id": "j2000_test",
            "subject": {
                "id": "j2000",
                "name": "J2000.0",
                "event_time": "2000-01-01 12:00:00",
                "location": {
                    "name": "Greenwich",
                    "latitude": 51.4779,
                    "longitude": 0.0,
                    "timezone": "UTC"
                }
            },
            "config": {
                "mode": "NATAL",
                "zodiac_type": "Tropical",
                "included_points": [],
                "aspect_orbs": {},
                "display_style": "",
                "color_theme": "",
                "override_ephemeris": bsp_path,
                "engine": "jpl"
            },
            "tags": []
        }))
        .expect("valid chart JSON")
    }

    fn dev_bsp_path(filename: &str) -> Option<PathBuf> {
        let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()?
            .join(format!("backend-python/source/{filename}"));
        root.exists().then_some(root)
    }

    /// Validate positions at J2000.0 against known Horizons values.
    /// Run: cargo test j2000_positions -- --ignored --nocapture
    #[test]
    #[ignore = "requires de440s.bsp in backend-python/source/ or src-tauri/resources/"]
    fn j2000_positions_match_horizons() {
        let bsp = dev_bsp_path("de440s.bsp").expect("no BSP found");

        let chart = j2000_chart(bsp.to_str().unwrap());
        let backend = JplAstronomyBackend::new(vec![bsp]);
        let data = backend.compute_chart_data(&chart, None).expect("compute failed");

        let mut bodies: Vec<(&str, f64)> =
            data.positions.iter().map(|(k, &v)| (k.as_str(), v)).collect();
        bodies.sort_by_key(|(k, _)| *k);
        println!("\n=== JplAstronomyBackend positions at J2000.0 ===");
        for (body, lon) in &bodies {
            println!("  {body:<20} {lon:.4}°");
        }
        println!("  {:<20} {:.4}°  (asc)", "asc", data.axes.asc);
        println!("  {:<20} {:.4}°  (mc)", "mc", data.axes.mc);

        for body in ["sun", "moon", "mercury", "venus", "mars",
                     "jupiter", "saturn", "uranus", "neptune", "pluto"] {
            assert!(data.positions.contains_key(body), "{body} missing");
        }
        for (body, &lon) in &data.positions {
            assert!((0.0..360.0).contains(&lon), "{body} lon {lon} out of range");
        }
        let sun = data.positions["sun"];
        let sun_diff = ((sun - 280.4 + 540.0) % 360.0) - 180.0;
        assert!(sun_diff.abs() < 1.0, "sun: {sun:.4}° expected ~280.4°");
    }

    /// Cross-check JPL vs Swiss Ephemeris at a fixed reference instant.
    /// Run: cargo test --features swisseph compare_jpl_vs_swisseph -- --ignored --nocapture
    #[cfg(feature = "swisseph")]
    #[test]
    #[ignore = "diagnostic comparison; requires de440s.bsp + Swiss Ephemeris"]
    fn compare_jpl_vs_swisseph_2026_04_22_1500_utc() {
        use crate::astronomy::{AstronomyBackend, SwissAstronomyBackend};

        let bsp = dev_bsp_path("de440s.bsp").expect("no BSP found");

        let jpl_chart: crate::workspace::models::ChartInstance = serde_json::from_value(
            serde_json::json!({
                "id": "cmp", "subject": {
                    "id": "cmp", "name": "2026-04-22 15:00 UTC",
                    "event_time": "2026-04-22 15:00:00+00:00",
                    "location": { "name": "Greenwich", "latitude": 51.4779, "longitude": 0.0, "timezone": "UTC" }
                },
                "config": {
                    "mode": "NATAL", "house_system": "Placidus", "zodiac_type": "Tropical",
                    "included_points": [], "aspect_orbs": {}, "display_style": "", "color_theme": "",
                    "override_ephemeris": bsp, "engine": "jpl"
                },
                "tags": []
            }),
        ).expect("valid JSON");

        let swiss_chart: crate::workspace::models::ChartInstance = serde_json::from_value(
            serde_json::json!({
                "id": "cmp_swiss", "subject": {
                    "id": "cmp_swiss", "name": "2026-04-22 15:00 UTC",
                    "event_time": "2026-04-22 15:00:00+00:00",
                    "location": { "name": "Greenwich", "latitude": 51.4779, "longitude": 0.0, "timezone": "UTC" }
                },
                "config": {
                    "mode": "NATAL", "house_system": "Placidus", "zodiac_type": "Tropical",
                    "included_points": [], "aspect_orbs": {}, "display_style": "", "color_theme": "",
                    "engine": "swisseph"
                },
                "tags": []
            }),
        ).expect("valid JSON");

        let jpl = JplAstronomyBackend::new(vec![jpl_chart
            .config
            .override_ephemeris
            .clone()
            .map(PathBuf::from)
            .unwrap()]);
        let swiss = SwissAstronomyBackend;

        let jd = jpl.compute_chart_data(&jpl_chart, None).expect("jpl failed");
        let sd = swiss.compute_chart_data(&swiss_chart, None).expect("swiss failed");

        println!("\n=== JPL vs Swiss @ 2026-04-22 15:00 UTC ===");
        println!(" body                 jpl         swiss       diff");
        for body in ["sun", "moon", "mercury", "venus", "mars",
                     "jupiter", "saturn", "uranus", "neptune", "pluto"] {
            let j = jd.positions.get(body).copied().unwrap_or(f64::NAN);
            let s = sd.positions.get(body).copied().unwrap_or(f64::NAN);
            let diff = ((j - s + 540.0) % 360.0) - 180.0;
            println!(" {body:<12} {j:>10.6}° {s:>10.6}° {diff:>+9.6}°");
        }
    }
}
