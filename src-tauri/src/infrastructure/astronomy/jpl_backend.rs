/// Astronomy backend using the `anise` crate (MPL-2.0) with SPICE BSP ephemeris files.
///
/// Loads all available BSP files (bundled de440s.bsp + any user-downloaded files) via
/// `EphemerisManager` into a chained `Almanac`. Standard DE planetary kernels provide the
/// 10 planets + Moon; asteroid bodies require a separate dedicated asteroid SPK kernel.
/// Gaps handled above the astronomy layer:
///   - Ecliptic longitude: J2000/ICRS → Earth MOD via ANISE, then mean-ecliptic projection
///   - Lunar nodes: computed analytically in houses.rs
///   - House cusps: computed in houses.rs
///   - Chiron/custom small bodies: validated Horizons vectors converted to Type 13 SPKs
///     are discovered from adjacent manifests and evaluated through the same frame pipeline
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock, RwLock};

use anise::constants::frames::{
    EARTH_MOD_FRAME, JUPITER_BARYCENTER_J2000, MARS_BARYCENTER_J2000, MERCURY_J2000, MOON_J2000,
    NEPTUNE_BARYCENTER_J2000, PLUTO_BARYCENTER_J2000, SATURN_BARYCENTER_J2000, SUN_J2000,
    URANUS_BARYCENTER_J2000, VENUS_J2000,
};
use anise::prelude::*;
use hifitime::Epoch;

use crate::domain::astrology::day_night_parts;
use crate::domain::houses::{
    campanus_cusps, compute_axes, equatorial_ra_dec_deg, equatorial_to_ecliptic,
    equatorial_to_horizontal_deg, julian_day_from_unix, local_sidereal_time_deg, mean_node_lon,
    mean_node_motion, mean_obliquity_deg, normalize_deg, placidus_cusps, true_apogee_tropical_deg,
    true_node_tropical_deg, vertex_lon, whole_sign_cusps,
};
use crate::infrastructure::astronomy::{
    AstronomyAxes, AstronomyBackend, AstronomyChartData, AstronomyMotion,
};
use crate::infrastructure::ephemeris::{
    load_almanac_from_paths, small_body_kernels_for_bsp_paths, EphemerisManager, ASTRAEA_J2000,
    CERES_J2000, EGERIA_J2000, EUNOMIA_J2000, FLORA_J2000, FORTUNA_J2000, HEBE_J2000, HYGIEA_J2000,
    IRENE_J2000, IRIS_J2000, JUNO_J2000, MASSALIA_J2000, MELPOMENE_J2000, METIS_J2000,
    PALLAS_J2000, PARTHENOPE_J2000, PSYCHE_J2000, THETIS_J2000, VESTA_J2000, VICTORIA_J2000,
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
/// is present (optional single-body kernels or bundled `codes_300ast`).
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
    paths
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("|")
}

fn sample_tropical_longitude(
    almanac: &Almanac,
    frame: Frame,
    unix_secs: f64,
) -> Result<f64, String> {
    let epoch = Epoch::from_unix_seconds(unix_secs);
    let obliquity = mean_obliquity_deg(epoch.to_jde_tt_days());
    let state = almanac
        .transform(frame, EARTH_MOD_FRAME, epoch, None)
        .map_err(|e| e.to_string())?;
    let (lon, _lat) = equatorial_to_ecliptic(
        state.radius_km.x,
        state.radius_km.y,
        state.radius_km.z,
        obliquity,
    );
    Ok(lon)
}

/// Right ascension and declination (degrees) from the same equatorial mean-of-date state
/// vector `sample_tropical_longitude` rotates into ecliptic coordinates.
fn sample_equatorial(almanac: &Almanac, frame: Frame, unix_secs: f64) -> Result<(f64, f64), String> {
    let epoch = Epoch::from_unix_seconds(unix_secs);
    let state = almanac
        .transform(frame, EARTH_MOD_FRAME, epoch, None)
        .map_err(|e| e.to_string())?;
    Ok(equatorial_ra_dec_deg(
        state.radius_km.x,
        state.radius_km.y,
        state.radius_km.z,
    ))
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

fn sample_motion(
    almanac: &Almanac,
    frame: Frame,
    unix_secs: f64,
) -> Result<AstronomyMotion, String> {
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
    let epoch = Epoch::from_unix_seconds(unix_secs);
    let state = almanac
        .transform(MOON_J2000, EARTH_MOD_FRAME, epoch, None)
        .map_err(|e| e.to_string())?;
    true_node_tropical_deg(
        state.radius_km.x,
        state.radius_km.y,
        state.radius_km.z,
        state.velocity_km_s.x,
        state.velocity_km_s.y,
        state.velocity_km_s.z,
        epoch.to_jde_tt_days(),
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

fn true_apogee_tropical_at_unix(almanac: &Almanac, unix_secs: f64) -> Result<f64, String> {
    let epoch = Epoch::from_unix_seconds(unix_secs);
    let state = almanac
        .transform(MOON_J2000, EARTH_MOD_FRAME, epoch, None)
        .map_err(|e| e.to_string())?;
    true_apogee_tropical_deg(
        state.radius_km.x,
        state.radius_km.y,
        state.radius_km.z,
        state.velocity_km_s.x,
        state.velocity_km_s.y,
        state.velocity_km_s.z,
        epoch.to_jde_tt_days(),
    )
    .ok_or_else(|| "true_lilith_unavailable: degenerate Moon state".to_string())
}

fn true_apogee_motion(almanac: &Almanac, unix_secs: f64) -> Result<AstronomyMotion, String> {
    const SAMPLE_STEP_SECONDS: f64 = 3600.0;
    let before = true_apogee_tropical_at_unix(almanac, unix_secs - SAMPLE_STEP_SECONDS)?;
    let after = true_apogee_tropical_at_unix(almanac, unix_secs + SAMPLE_STEP_SECONDS)?;
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
    /// Manifest-defined bodies whose checked SPKs are present in `bsp_paths`.
    small_body_frames: Vec<(String, Frame)>,
}

impl JplAstronomyBackend {
    pub fn new(bsp_paths: Vec<PathBuf>) -> Self {
        let small_body_frames = small_body_kernels_for_bsp_paths(&bsp_paths)
            .into_iter()
            .map(|kernel| (kernel.body_id, kernel.frame))
            .collect();
        Self {
            bsp_paths,
            small_body_frames,
        }
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
        let obliquity = mean_obliquity_deg(jd_ut);
        // Needed up front (not just for axes/houses below) so the classical-planet loop can
        // attach topocentric altitude/azimuth alongside each body's longitude.
        let lat = chart.subject.location.latitude;
        let lon = chart.subject.location.longitude;
        let lst_deg = local_sidereal_time_deg(jd_ut, lon);

        let wanted = |id: &str| {
            requested_objects
                .map(|list| list.iter().any(|s| s.as_str() == id))
                .unwrap_or(true)
        };

        let mut positions: HashMap<String, f64> = HashMap::new();
        let mut motion: HashMap<String, AstronomyMotion> = HashMap::new();
        let mut right_ascension: HashMap<String, f64> = HashMap::new();
        let mut declination: HashMap<String, f64> = HashMap::new();
        let mut altitude: HashMap<String, f64> = HashMap::new();
        let mut azimuth: HashMap<String, f64> = HashMap::new();
        let mut warnings: Vec<String> = Vec::new();

        // ── Standard planetary positions ─────────────────────────────────
        // Equatorial (RA/Dec) and topocentric (alt/az) coordinates are only attached for
        // this classical-body loop, matching the Python/Skyfield backend's own parity
        // (jpl_supported = the 10 classical planets) rather than nodes, angles, or asteroids.
        for &(id, frame) in body_frames() {
            if !wanted(id) {
                continue;
            }
            match sample_tropical_longitude(&almanac, frame, unix_secs) {
                Ok(longitude) => {
                    positions.insert(id.to_string(), longitude);
                    if let Ok(body_motion) = sample_motion(&almanac, frame, unix_secs) {
                        motion.insert(id.to_string(), body_motion);
                    }
                    if let Ok((ra, dec)) = sample_equatorial(&almanac, frame, unix_secs) {
                        right_ascension.insert(id.to_string(), ra);
                        declination.insert(id.to_string(), dec);
                        let (alt, az) = equatorial_to_horizontal_deg(ra, dec, lst_deg, lat);
                        altitude.insert(id.to_string(), alt);
                        azimuth.insert(id.to_string(), az);
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
            match sample_tropical_longitude(&almanac, frame, unix_secs) {
                Ok(longitude) => {
                    positions.insert(id.to_string(), longitude);
                    if let Ok(body_motion) = sample_motion(&almanac, frame, unix_secs) {
                        motion.insert(id.to_string(), body_motion);
                    }
                }
                Err(e) => {
                    warnings.push(format!("{id}_unavailable: {e}"));
                }
            }
        }

        // ── Manifest-defined Horizons-derived small bodies ───────────────
        for (id, frame) in &self.small_body_frames {
            if !wanted(id) {
                continue;
            }
            match sample_tropical_longitude(&almanac, *frame, unix_secs) {
                Ok(longitude) => {
                    positions.insert(id.clone(), longitude);
                    if let Ok(body_motion) = sample_motion(&almanac, *frame, unix_secs) {
                        motion.insert(id.clone(), body_motion);
                    }
                }
                Err(error) => warnings.push(format!("{id}_unavailable: {error}")),
            }
        }

        // ── Lunar nodes ───────────────────────────────────────────────────
        let mean_node = mean_node_lon(jd_ut);
        let mean_motion = mean_node_motion(jd_ut);
        if wanted("north_node") || wanted("mean_node") {
            let key = if wanted("north_node") {
                "north_node"
            } else {
                "mean_node"
            };
            positions.insert(key.to_string(), mean_node);
            motion.insert(key.to_string(), mean_motion.clone());
        }
        if wanted("south_node") || wanted("mean_south_node") {
            let key = if wanted("south_node") {
                "south_node"
            } else {
                "mean_south_node"
            };
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

        if wanted("true_lilith") {
            match true_apogee_tropical_at_unix(&almanac, unix_secs) {
                Ok(true_apogee) => {
                    positions.insert("true_lilith".to_string(), true_apogee);
                    if let Ok(apogee_motion) = true_apogee_motion(&almanac, unix_secs) {
                        motion.insert("true_lilith".to_string(), apogee_motion);
                    }
                }
                Err(e) => {
                    warnings.push(e);
                }
            }
        }

        if wanted("chiron") && !positions.contains_key("chiron") {
            warnings
                .push("chiron_unavailable: no validated local SPK covers this epoch".to_string());
        }

        // ── Axes and house cusps ──────────────────────────────────────────
        let (asc, mc, desc, ic) =
            compute_axes(jd_ut, lat, lon).map_err(|e| format!("Failed to compute axes: {e}"))?;

        let axes = AstronomyAxes { asc, desc, mc, ic };
        for (id, longitude) in [("asc", asc), ("desc", desc), ("mc", mc), ("ic", ic)] {
            if wanted(id) {
                positions.insert(id.to_string(), longitude);
            }
        }

        if wanted("vertex") || wanted("antivertex") {
            // RAMC (right ascension of the midheaven) is the same quantity as local sidereal time.
            let ramc = lst_deg;
            match vertex_lon(ramc, obliquity, lat) {
                Ok(vertex) => {
                    if wanted("vertex") {
                        positions.insert("vertex".to_string(), vertex);
                    }
                    if wanted("antivertex") {
                        positions.insert("antivertex".to_string(), normalize_deg(vertex + 180.0));
                    }
                }
                Err(e) => {
                    if wanted("vertex") {
                        warnings.push(format!("vertex_unavailable: {e}"));
                    }
                    if wanted("antivertex") {
                        warnings.push(format!("antivertex_unavailable: {e}"));
                    }
                }
            }
        }

        if wanted("part_of_fortune") || wanted("part_of_spirit") {
            // Lots depend on the luminaries even when the caller requests only a Lot.
            // Sample missing prerequisites without adding unrequested Sun/Moon rows.
            let sun_lon = positions
                .get("sun")
                .copied()
                .map(Ok)
                .unwrap_or_else(|| sample_tropical_longitude(&almanac, SUN_J2000, unix_secs));
            let moon_lon = positions
                .get("moon")
                .copied()
                .map(Ok)
                .unwrap_or_else(|| sample_tropical_longitude(&almanac, MOON_J2000, unix_secs));
            match (sun_lon, moon_lon) {
                (Ok(sun_lon), Ok(moon_lon)) => {
                    let (fortune, spirit) = day_night_parts(asc, sun_lon, moon_lon);
                    if wanted("part_of_fortune") {
                        positions.insert("part_of_fortune".to_string(), fortune);
                    }
                    if wanted("part_of_spirit") {
                        positions.insert("part_of_spirit".to_string(), spirit);
                    }
                }
                (sun_result, moon_result) => {
                    let reason = match (sun_result.err(), moon_result.err()) {
                        (Some(sun_error), Some(moon_error)) => {
                            format!("requires Sun and Moon positions ({sun_error}; {moon_error})")
                        }
                        (Some(error), None) => format!("requires Sun position ({error})"),
                        (None, Some(error)) => format!("requires Moon position ({error})"),
                        (None, None) => "requires Sun and Moon positions".to_string(),
                    };
                    if wanted("part_of_fortune") {
                        warnings.push(format!("part_of_fortune_unavailable: {reason}"));
                    }
                    if wanted("part_of_spirit") {
                        warnings.push(format!("part_of_spirit_unavailable: {reason}"));
                    }
                }
            }
        }

        let (house_cusps, house_warnings) = match chart.config.house_system.clone() {
            Some(HouseSystem::WholeSign) | None => (whole_sign_cusps(asc), vec![]),
            Some(HouseSystem::Placidus) => placidus_cusps(jd_ut, lat, lon, asc, mc),
            Some(HouseSystem::Campanus) => campanus_cusps(jd_ut, lat, lon, asc, mc),
            Some(other) => {
                let name = format!("{other:?}").to_lowercase();
                (
                    whole_sign_cusps(asc),
                    vec![format!(
                        "house_system_{name}_not_yet_supported: whole_sign_used"
                    )],
                )
            }
        };
        warnings.extend(house_warnings);

        Ok(AstronomyChartData {
            positions,
            motion,
            right_ascension,
            declination,
            altitude,
            azimuth,
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
            "No BSP ephemeris file found. Place de440s.bsp next to the binary or download \
             one via the ephemeris manager."
                .to_string(),
        );
    }
    Ok(JplAstronomyBackend::new(paths))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use anise::constants::frames::EARTH_J2000;
    use anise::math::cartesian::CartesianState;

    #[test]
    fn no_bsp_returns_error() {
        let backend = JplAstronomyBackend::new(vec![PathBuf::from("nonexistent.bsp")]);
        assert!(backend.build_almanac().is_err());
    }

    #[test]
    fn earth_mod_transform_changes_more_than_scalar_longitude() {
        // A scalar longitude correction cannot change ecliptic latitude. A full
        // precession rotation generally does, which guards the frame boundary
        // this backend relies on for inclined planetary and lunar vectors.
        let bsp = dev_bsp_path("de440s.bsp").expect("no BSP found");
        let almanac = load_almanac_from_paths(&[bsp]).expect("almanac should load");
        let epoch = Epoch::from_gregorian_utc(2100, 1, 1, 0, 0, 0, 0);
        let state = CartesianState::new(1.0, 2.0, 3.0, 0.0, 0.0, 0.0, epoch, EARTH_J2000);
        let dated = almanac
            .rotate_to(state, EARTH_MOD_FRAME)
            .expect("Earth MOD rotation should use the bundled planetary constants");

        let (_, original_lat) = equatorial_to_ecliptic(
            state.radius_km.x,
            state.radius_km.y,
            state.radius_km.z,
            mean_obliquity_deg(2_451_545.0),
        );
        let (_, dated_lat) = equatorial_to_ecliptic(
            dated.radius_km.x,
            dated.radius_km.y,
            dated.radius_km.z,
            mean_obliquity_deg(epoch.to_jde_tt_days()),
        );

        assert!(
            (dated_lat - original_lat).abs() > 1e-4,
            "a 3D mean-of-date rotation should alter this vector's latitude: {original_lat} / {dated_lat}"
        );
        assert_eq!(dated.frame.ephemeris_id, EARTH_MOD_FRAME.ephemeris_id);
        assert_eq!(dated.frame.orientation_id, EARTH_MOD_FRAME.orientation_id);
    }

    /// Cross-checks `true_apogee_tropical_at_unix` against JPL Horizons' own osculating
    /// elements for the Moon (body 301, geocentric, ecliptic-of-J2000) at exactly
    /// J2000.0, where this backend's tropical/J2000 frames coincide (zero precession
    /// offset). Horizons gives EC=0.0631472..., OM=123.9580554°, W=308.9226727° at
    /// 2000-Jan-01 12:00:00 TDB; apogee longitude = OM + W + 180 (mod 360) = 252.8807°.
    #[test]
    fn true_lilith_matches_horizons_osculating_elements_at_j2000() {
        let bsp = dev_bsp_path("de440s.bsp").expect("no BSP found");
        let almanac = load_almanac_from_paths(&[bsp]).expect("almanac should load");

        // J2000.0 = 2000-01-01 12:00:00 UTC (TDB-UTC is ~64s in 2000, negligible here).
        let epoch = Epoch::from_gregorian_utc(2000, 1, 1, 12, 0, 0, 0);
        let unix_secs = epoch.to_unix_seconds();

        let apogee = true_apogee_tropical_at_unix(&almanac, unix_secs)
            .expect("Moon state should be available in de440s.bsp at J2000.0");

        let expected = 252.880_728_1;
        let delta = angular_delta_deg(expected, apogee).abs();
        assert!(
            delta < 0.5,
            "true_lilith at J2000.0: got {apogee:.4}°, expected ~{expected:.4}° (Horizons), delta {delta:.4}°"
        );
    }

    #[test]
    fn vertex_and_parts_resolve_and_match_direct_computation() {
        let bsp = dev_bsp_path("de440s.bsp").expect("no BSP found");
        let chart = j2000_chart(bsp.to_str().unwrap());
        let backend = JplAstronomyBackend::new(vec![bsp]);
        let requested: Vec<String> = [
            "sun",
            "moon",
            "asc",
            "vertex",
            "antivertex",
            "part_of_fortune",
            "part_of_spirit",
        ]
        .into_iter()
        .map(str::to_string)
        .collect();
        let data = backend
            .compute_chart_data(&chart, Some(&requested))
            .expect("compute should succeed");

        for id in ["vertex", "antivertex", "part_of_fortune", "part_of_spirit"] {
            assert!(
                data.positions.contains_key(id),
                "{id} missing; warnings: {:?}",
                data.warnings
            );
        }

        let vertex = data.positions["vertex"];
        let antivertex = data.positions["antivertex"];
        assert!(
            (crate::domain::houses::normalize_deg(antivertex - vertex) - 180.0).abs() < 1e-9,
            "antivertex should be exactly opposite vertex: {vertex} / {antivertex}"
        );

        let asc = data.positions["asc"];
        let sun = data.positions["sun"];
        let moon = data.positions["moon"];
        let (expected_fortune, expected_spirit) =
            crate::domain::astrology::day_night_parts(asc, sun, moon);
        assert!((data.positions["part_of_fortune"] - expected_fortune).abs() < 1e-9);
        assert!((data.positions["part_of_spirit"] - expected_spirit).abs() < 1e-9);

        let lots_only = vec!["part_of_fortune".to_string(), "part_of_spirit".to_string()];
        let lots_data = backend
            .compute_chart_data(&chart, Some(&lots_only))
            .expect("Lots should compute without explicitly requesting their dependencies");
        assert!((lots_data.positions["part_of_fortune"] - expected_fortune).abs() < 1e-9);
        assert!((lots_data.positions["part_of_spirit"] - expected_spirit).abs() < 1e-9);
        assert!(!lots_data.positions.contains_key("sun"));
        assert!(!lots_data.positions.contains_key("moon"));
    }

    /// Confirms the minor planets added to the body catalog alongside `codes_300ast`
    /// (astraea..massalia) actually resolve through the bundled kernels, not just
    /// that the catalog entry exists.
    #[test]
    fn codes_300ast_minor_planets_resolve_from_bundled_kernels() {
        let paths =
            crate::infrastructure::ephemeris::EphemerisManager::from_global().available_bsp_paths();
        assert!(
            paths.iter().any(|p| p
                .file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|s| s.contains("codes_300ast"))),
            "expected the bundled codes_300ast kernel to resolve; found {paths:?}"
        );

        let requested: Vec<String> = [
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
        ]
        .into_iter()
        .map(str::to_string)
        .collect();

        let chart = j2000_chart(paths[0].to_str().unwrap());
        let backend = JplAstronomyBackend::new(paths);
        let data = backend
            .compute_chart_data(&chart, Some(&requested))
            .expect("compute should succeed");

        for id in &requested {
            assert!(
                data.positions.contains_key(id),
                "{id} did not resolve; warnings: {:?}",
                data.warnings
            );
        }
        assert!(
            data.warnings.iter().all(|w| !w.contains("_unavailable")),
            "unexpected unavailable warnings: {:?}",
            data.warnings
        );
    }

    #[test]
    fn bundled_chiron_type13_is_discovered_and_computed() {
        let manager = crate::infrastructure::ephemeris::EphemerisManager::from_global();
        let paths = manager.available_bsp_paths();
        assert!(
            paths
                .iter()
                .any(|path| path.file_name().and_then(|name| name.to_str())
                    == Some("chiron_1900_2100_type13.bsp")),
            "validated Chiron artifact was not discovered: {paths:?}"
        );
        assert!(
            crate::infrastructure::ephemeris::bodies_available_for_bsp_paths(&paths)
                .iter()
                .any(|body| body == "chiron")
        );

        let chart = j2000_chart(paths[0].to_str().unwrap());
        let backend = JplAstronomyBackend::new(paths);
        let requested = vec!["chiron".to_string()];
        let data = backend
            .compute_chart_data(&chart, Some(&requested))
            .expect("Chiron computation should succeed");
        let longitude = data
            .positions
            .get("chiron")
            .expect("Chiron position should be present");
        assert!((0.0..360.0).contains(longitude));
        assert!(
            data.warnings
                .iter()
                .all(|warning| !warning.starts_with("chiron_")),
            "unexpected Chiron warning: {:?}",
            data.warnings
        );
    }

    #[test]
    fn bundled_chiron_type13_matches_held_out_horizons_state() {
        let paths =
            crate::infrastructure::ephemeris::EphemerisManager::from_global().available_bsp_paths();
        let almanac = load_almanac_from_paths(&paths).expect("bundled almanac should load");
        // This epoch is halfway between the four-day source knots at 2000-01-01
        // and 2000-01-05. The expected geometric heliocentric ICRF state is an
        // independent Horizons VECTORS sample, not an input record in the SPK.
        let epoch = Epoch::from_tdb_seconds(129_600.0);
        let state = almanac
            .transform(Frame::from_ephem_j2000(20_002_060), SUN_J2000, epoch, None)
            .expect("Chiron Type 13 state should evaluate");
        let expected_position = [
            -526_904_532.089_611_8,
            -1_298_634_835.180_773,
            -439_390_243.533_057_9,
        ];
        let expected_velocity = [
            8.610_310_542_141_214,
            -6.271_953_448_156_347,
            -1.427_451_092_837_696,
        ];
        let position_error = ((state.radius_km.x - expected_position[0]).powi(2)
            + (state.radius_km.y - expected_position[1]).powi(2)
            + (state.radius_km.z - expected_position[2]).powi(2))
        .sqrt();
        let velocity_error = ((state.velocity_km_s.x - expected_velocity[0]).powi(2)
            + (state.velocity_km_s.y - expected_velocity[1]).powi(2)
            + (state.velocity_km_s.z - expected_velocity[2]).powi(2))
        .sqrt();
        assert!(position_error < 1.0, "position error {position_error} km");
        assert!(
            velocity_error < 1e-5,
            "velocity error {velocity_error} km/s"
        );
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
                "definition": { "kind": "base", "purpose": "natal" },
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
        let data = backend
            .compute_chart_data(&chart, None)
            .expect("compute failed");

        let mut bodies: Vec<(&str, f64)> = data
            .positions
            .iter()
            .map(|(k, &v)| (k.as_str(), v))
            .collect();
        bodies.sort_by_key(|(k, _)| *k);
        println!("\n=== JplAstronomyBackend positions at J2000.0 ===");
        for (body, lon) in &bodies {
            println!("  {body:<20} {lon:.4}°");
        }
        println!("  {:<20} {:.4}°  (asc)", "asc", data.axes.asc);
        println!("  {:<20} {:.4}°  (mc)", "mc", data.axes.mc);
        for body in ["asc", "mc", "desc", "ic"] {
            assert!(
                data.positions.contains_key(body),
                "derived body {body} missing"
            );
        }

        for body in [
            "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
            "pluto",
        ] {
            assert!(data.positions.contains_key(body), "{body} missing");
        }
        for (body, &lon) in &data.positions {
            assert!((0.0..360.0).contains(&lon), "{body} lon {lon} out of range");
        }
        let sun = data.positions["sun"];
        let sun_diff = ((sun - 280.4 + 540.0) % 360.0) - 180.0;
        assert!(sun_diff.abs() < 1.0, "sun: {sun:.4}° expected ~280.4°");
    }

    /// Same reference case as `equatorial_to_horizontal_matches_skyfield_reference`
    /// (Mercury, 2024-04-10 12:00 Europe/Prague), but end-to-end through
    /// `JplAstronomyBackend::compute_chart_data` — confirms the whole wiring (not just the
    /// pure trig helpers) actually attaches RA/Dec/alt/az to the classical-planet loop.
    #[test]
    fn compute_chart_data_attaches_equatorial_and_horizontal_coordinates() {
        let manager = crate::infrastructure::ephemeris::EphemerisManager::from_global();
        let paths = manager.available_bsp_paths();
        let chart: crate::workspace::models::ChartInstance = serde_json::from_value(serde_json::json!({
            "id": "mercury_ra_dec_test",
            "subject": {
                "id": "mercury_ra_dec_test",
                "name": "Mercury RA/Dec test",
                "event_time": "2024-04-10 12:00:00+02:00",
                "location": {
                    "name": "Prague, Czech Republic",
                    "latitude": 50.0874654,
                    "longitude": 14.4212535,
                    "timezone": "Europe/Prague"
                }
            },
            "config": {
                "definition": { "kind": "base", "purpose": "natal" },
                "zodiac_type": "Tropical",
                "included_points": [],
                "aspect_orbs": {},
                "display_style": "",
                "color_theme": "",
                "engine": "jpl"
            },
            "tags": []
        }))
        .expect("valid chart JSON");

        let backend = JplAstronomyBackend::new(paths);
        let requested = vec!["mercury".to_string()];
        let data = backend
            .compute_chart_data(&chart, Some(&requested))
            .expect("compute should succeed");

        let ra = *data
            .right_ascension
            .get("mercury")
            .expect("mercury right_ascension missing");
        let dec = *data
            .declination
            .get("mercury")
            .expect("mercury declination missing");
        let alt = *data
            .altitude
            .get("mercury")
            .expect("mercury altitude missing");
        let az = *data
            .azimuth
            .get("mercury")
            .expect("mercury azimuth missing");

        // Skyfield/JPL reference (mean-of-date, see the houses.rs test for derivation):
        // RA 20.960824, Dec 11.554670, alt 48.889981, az 153.520290.
        assert!((ra - 20.960_824).abs() < 0.05, "ra: {ra}");
        assert!((dec - 11.554_670).abs() < 0.05, "dec: {dec}");
        assert!((alt - 48.889_981).abs() < 0.05, "alt: {alt}");
        assert!((az - 153.520_290).abs() < 0.05, "az: {az}");
    }

    /// Cross-check JPL vs Swiss Ephemeris at a fixed reference instant.
    /// Run: cargo test --features swisseph compare_jpl_vs_swisseph -- --ignored --nocapture
    #[cfg(feature = "swisseph")]
    #[test]
    #[ignore = "diagnostic comparison; requires de440s.bsp + Swiss Ephemeris"]
    fn compare_jpl_vs_swisseph_2026_04_22_1500_utc() {
        use crate::infrastructure::astronomy::{AstronomyBackend, SwissAstronomyBackend};

        let bsp = dev_bsp_path("de440s.bsp").expect("no BSP found");

        let jpl_chart: crate::workspace::models::ChartInstance = serde_json::from_value(
            serde_json::json!({
                "id": "cmp", "subject": {
                    "id": "cmp", "name": "2026-04-22 15:00 UTC",
                    "event_time": "2026-04-22 15:00:00+00:00",
                    "location": { "name": "Greenwich", "latitude": 51.4779, "longitude": 0.0, "timezone": "UTC" }
                },
                "config": {
                    "definition": { "kind": "base", "purpose": "natal" }, "house_system": "Placidus", "zodiac_type": "Tropical",
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
                    "definition": { "kind": "base", "purpose": "natal" }, "house_system": "Placidus", "zodiac_type": "Tropical",
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

        let jd = jpl
            .compute_chart_data(&jpl_chart, None)
            .expect("jpl failed");
        let sd = swiss
            .compute_chart_data(&swiss_chart, None)
            .expect("swiss failed");

        println!("\n=== JPL vs Swiss @ 2026-04-22 15:00 UTC ===");
        println!(" body                 jpl         swiss       diff");
        for body in [
            "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
            "pluto",
        ] {
            let j = jd.positions.get(body).copied().unwrap_or(f64::NAN);
            let s = sd.positions.get(body).copied().unwrap_or(f64::NAN);
            let diff = ((j - s + 540.0) % 360.0) - 180.0;
            println!(" {body:<12} {j:>10.6}° {s:>10.6}° {diff:>+9.6}°");
        }
    }
}
