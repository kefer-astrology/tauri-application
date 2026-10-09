/// JPL position provider using the `anise` crate (MPL-2.0) with SPICE BSP ephemeris files.
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
///
/// ## Time and output contract
///
/// Input chart times are UTC timestamps (including their fractional second).  `hifitime`
/// converts that UTC instant through TT to the ET/TDB-compatible epoch ANISE uses to evaluate
/// SPK Chebyshev records; the backend never creates a sampled position table.  TT is used for mean ecliptic
/// orientation and lunar element formulae.  For pre-UTC historical civil dates the caller
/// must first supply a UTC-equivalent instant using its selected calendar and Delta-T model;
/// that civil-time policy deliberately is not hidden in this trajectory provider.
///
/// The application currently has no bundled Earth-orientation-parameter (EOP) table, so
/// sidereal time uses UTC as an explicitly labelled UT1 approximation.  It is suitable for
/// the existing chart convention, but is not a substitute for UT1 when sub-arcsecond angles
/// are required.  A future EOP provider must supply UT1 rather than changing this fallback.
///
/// `PositionMode::Geometric` returns the instantaneous Earth-relative mean-of-date vector.
/// `PositionMode::Apparent` asks ANISE for converged light-time plus stellar-aberration
/// corrections (`CN_S`) before that same frame projection.  Neither mode is topocentric:
/// altitude/azimuth is an observer-direction convenience derived from the geocentric vector,
/// not a parallax-corrected apparent place.
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock, RwLock};

use anise::constants::frames::{
    EARTH_MOD_FRAME, JUPITER_BARYCENTER_J2000, MARS_BARYCENTER_J2000, MERCURY_J2000, MOON_J2000,
    NEPTUNE_BARYCENTER_J2000, PLUTO_BARYCENTER_J2000, SATURN_BARYCENTER_J2000, SUN_J2000,
    URANUS_BARYCENTER_J2000, VENUS_J2000,
};
use anise::math::cartesian::CartesianState;
use anise::prelude::*;
use hifitime::Epoch;

use crate::domain::astrology::day_night_parts;
use crate::domain::houses::{
    campanus_cusps, compute_axes, equal_cusps, equatorial_ra_dec_deg, equatorial_to_ecliptic,
    equatorial_to_horizontal_deg, julian_day_from_unix, local_sidereal_time_deg, mean_node_lon,
    mean_node_motion, mean_obliquity_deg, normalize_deg, placidus_cusps, porphyry_cusps,
    true_apogee_tropical_deg, true_node_tropical_deg, vertex_lon, whole_sign_cusps,
};
use crate::infrastructure::ephemeris::{
    load_almanac_from_paths, small_body_kernels_for_bsp_paths, EphemerisManager, ASTRAEA_J2000,
    CERES_J2000, EGERIA_J2000, EUNOMIA_J2000, FLORA_J2000, FORTUNA_J2000, HEBE_J2000, HYGIEA_J2000,
    IRENE_J2000, IRIS_J2000, JUNO_J2000, MASSALIA_J2000, MELPOMENE_J2000, METIS_J2000,
    PALLAS_J2000, PARTHENOPE_J2000, PSYCHE_J2000, THETIS_J2000, VESTA_J2000, VICTORIA_J2000,
};
use crate::infrastructure::position_provider::{
    AstronomyAxes, AstronomyBackend, AstronomyChartData, AstronomyMotion, MinimalChartData,
    RequiredQuantities,
};
use crate::workspace::models::{ChartInstance, HouseSystem, PositionMode};

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
        // A path alone is insufficient: an ephemeris download can atomically replace an
        // existing filename while this process is alive.
        .map(|path| {
            let fingerprint = std::fs::metadata(path)
                .ok()
                .and_then(|meta| meta.modified().ok().map(|modified| (meta.len(), modified)))
                .and_then(|(len, modified)| {
                    modified
                        .duration_since(std::time::UNIX_EPOCH)
                        .ok()
                        .map(|d| (len, d.as_nanos()))
                })
                .map(|(len, modified)| format!("{len}:{modified}"))
                .unwrap_or_else(|| "missing".to_string());
            format!("{}:{fingerprint}", path.to_string_lossy())
        })
        .collect::<Vec<_>>()
        .join("|")
}

fn aberration_for_position_mode(mode: Option<PositionMode>) -> Option<Aberration> {
    match mode.unwrap_or(PositionMode::Apparent) {
        PositionMode::Apparent => Aberration::CN_S,
        PositionMode::Geometric => Aberration::NONE,
    }
}

fn sample_state(
    almanac: &Almanac,
    frame: Frame,
    unix_secs: f64,
    ab_corr: Option<Aberration>,
) -> Result<CartesianState, String> {
    let epoch = Epoch::from_unix_seconds(unix_secs);
    almanac
        .transform(frame, EARTH_MOD_FRAME, epoch, ab_corr)
        .map_err(|e| e.to_string())
}

fn longitude_from_state(state: &CartesianState, jd_tt: f64) -> f64 {
    let obliquity = mean_obliquity_deg(jd_tt);
    let (lon, _lat) = equatorial_to_ecliptic(
        state.radius_km.x,
        state.radius_km.y,
        state.radius_km.z,
        obliquity,
    );
    lon
}

/// IAU 2006 mean-obliquity derivative in radians per SI second.  It is the
/// derivative of exactly the polynomial used by `mean_obliquity_deg`.
fn mean_obliquity_rate_rad_s(jd_tt: f64) -> f64 {
    let t = (jd_tt - 2_451_545.0) / 36_525.0;
    let arcsec_per_century = -46.836_769 - 2.0 * 0.000_183_1 * t + 3.0 * 0.002_003_40 * t.powi(2)
        - 4.0 * 0.000_000_576 * t.powi(3)
        - 5.0 * 0.000_000_043_4 * t.powi(4);
    (arcsec_per_century / 3600.0 / 36_525.0 / 86_400.0).to_radians()
}

/// Right ascension and declination (degrees) from the same equatorial mean-of-date state
/// vector `sample_tropical_longitude` rotates into ecliptic coordinates.
fn equatorial_from_state(state: &CartesianState) -> (f64, f64) {
    equatorial_ra_dec_deg(state.radius_km.x, state.radius_km.y, state.radius_km.z)
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

fn motion_from_state(state: &CartesianState, jd_tt: f64) -> Result<AstronomyMotion, String> {
    let eps = mean_obliquity_deg(jd_tt).to_radians();
    let x = state.radius_km.x;
    let y = state.radius_km.y * eps.cos() + state.radius_km.z * eps.sin();
    let vx = state.velocity_km_s.x;
    // ANISE applies its DCM state matrix when rotating into EARTH_MOD_FRAME, so
    // its transformed velocity includes that frame rotation's transport term.
    // Add the remaining time-dependent ecliptic rotation here.  For apparent
    // states ANISE returns the velocity carried by its aberration calculation;
    // it is validated below against complete-pipeline finite differences rather
    // than assumed to be an exact derivative of converged CN+S position.
    let vy = state.velocity_km_s.y * eps.cos()
        + state.velocity_km_s.z * eps.sin()
        + mean_obliquity_rate_rad_s(jd_tt)
            * (-state.radius_km.y * eps.sin() + state.radius_km.z * eps.cos());
    let denominator = x * x + y * y;
    if denominator <= f64::MIN_POSITIVE {
        return Err("motion_unavailable: ecliptic longitude singularity".to_string());
    }
    let speed = ((x * vy - y * vx) / denominator).to_degrees() * 86_400.0;
    Ok(AstronomyMotion {
        speed,
        retrograde: speed < 0.0,
    })
}

fn sample_tropical_longitude(
    almanac: &Almanac,
    frame: Frame,
    unix_secs: f64,
    ab_corr: Option<Aberration>,
) -> Result<f64, String> {
    let state = sample_state(almanac, frame, unix_secs, ab_corr)?;
    Ok(longitude_from_state(
        &state,
        Epoch::from_unix_seconds(unix_secs).to_jde_tt_days(),
    ))
}

fn true_node_tropical_at_unix(
    almanac: &Almanac,
    unix_secs: f64,
    ab_corr: Option<Aberration>,
) -> Result<f64, String> {
    let epoch = Epoch::from_unix_seconds(unix_secs);
    let state = almanac
        .transform(MOON_J2000, EARTH_MOD_FRAME, epoch, ab_corr)
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

fn true_node_motion(
    almanac: &Almanac,
    unix_secs: f64,
    ab_corr: Option<Aberration>,
) -> Result<AstronomyMotion, String> {
    const SAMPLE_STEP_SECONDS: f64 = 3600.0;
    let before = true_node_tropical_at_unix(almanac, unix_secs - SAMPLE_STEP_SECONDS, ab_corr)?;
    let after = true_node_tropical_at_unix(almanac, unix_secs + SAMPLE_STEP_SECONDS, ab_corr)?;
    let delta = angular_delta_deg(before, after);
    let speed = delta / ((SAMPLE_STEP_SECONDS * 2.0) / 86_400.0);
    Ok(AstronomyMotion {
        speed,
        retrograde: speed < 0.0,
    })
}

fn true_apogee_tropical_at_unix(
    almanac: &Almanac,
    unix_secs: f64,
    ab_corr: Option<Aberration>,
) -> Result<f64, String> {
    let epoch = Epoch::from_unix_seconds(unix_secs);
    let state = almanac
        .transform(MOON_J2000, EARTH_MOD_FRAME, epoch, ab_corr)
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

fn true_apogee_motion(
    almanac: &Almanac,
    unix_secs: f64,
    ab_corr: Option<Aberration>,
) -> Result<AstronomyMotion, String> {
    const SAMPLE_STEP_SECONDS: f64 = 3600.0;
    let before = true_apogee_tropical_at_unix(almanac, unix_secs - SAMPLE_STEP_SECONDS, ab_corr)?;
    let after = true_apogee_tropical_at_unix(almanac, unix_secs + SAMPLE_STEP_SECONDS, ab_corr)?;
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

/// How much of `compute_chart_data_impl`'s usual output is actually needed.
/// `Full` is always exactly today's behavior; `Minimal` skips RA/Dec/Alt/Az
/// and (when nothing requires it) axes/house cusps, for a root-finder that
/// only ever reads `.positions`/`.motion`.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Tier {
    Full,
    Minimal(RequiredQuantities),
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
        self.compute_chart_data_impl(chart, requested_objects, Tier::Full)
    }

    fn compute_minimal(
        &self,
        chart: &ChartInstance,
        body_ids: &[String],
        quantities: RequiredQuantities,
    ) -> Result<MinimalChartData, String> {
        let full = self.compute_chart_data_impl(
            chart,
            Some(&body_ids.to_vec()),
            Tier::Minimal(quantities),
        )?;
        Ok(MinimalChartData {
            positions: full.positions,
            motion: full.motion,
        })
    }
}

impl JplAstronomyBackend {
    fn compute_chart_data_impl(
        &self,
        chart: &ChartInstance,
        requested_objects: Option<&Vec<String>>,
        tier: Tier,
    ) -> Result<AstronomyChartData, String> {
        let almanac = self.build_almanac()?;

        let event_time = chart
            .subject
            .event_time
            .ok_or_else(|| "Chart has no subject.event_time".to_string())?;

        // Keep the fractional UTC second all the way to ANISE.  ANISE evaluates the BSP at
        // its TDB-compatible epoch internally; SPK coverage failures are returned below as
        // explicit per-body `_unavailable` warnings rather than extrapolated.
        let unix_secs =
            event_time.timestamp() as f64 + event_time.timestamp_subsec_nanos() as f64 * 1e-9;
        let epoch = Epoch::from_unix_seconds(unix_secs);
        // GMST formally requires UT1.  No EOP/ΔUT1 data set is bundled yet, so retain the
        // historic UTC approximation but make it visible in the result contract below.
        let jd_utc_as_ut1 = julian_day_from_unix(unix_secs);
        let jd_tt = epoch.to_jde_tt_days();
        let obliquity = mean_obliquity_deg(jd_tt);
        // Needed up front (not just for axes/houses below) so the classical-planet loop can
        // attach topocentric altitude/azimuth alongside each body's longitude.
        let lat = chart.subject.location.latitude;
        let lon = chart.subject.location.longitude;
        let lst_deg = local_sidereal_time_deg(jd_utc_as_ut1, lon);
        let ab_corr = aberration_for_position_mode(chart.config.position_mode);

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
        warnings.push("ut1_approximated_from_utc: no EOP/ΔUT1 data loaded; sidereal quantities are approximate".to_string());

        // A minimal-path caller never needs motion for a pure longitude/orb
        // search, and never needs RA/Dec/Alt/Az at all (only the full path
        // or an explicit angle/axes request does — see `need_axes` below,
        // which governs a *different* block).
        let want_motion = matches!(
            tier,
            Tier::Full | Tier::Minimal(RequiredQuantities::LongitudeAndMotion)
        );
        let want_equatorial_and_horizontal = matches!(tier, Tier::Full);

        // ── Standard planetary positions ─────────────────────────────────
        // Equatorial (RA/Dec) and topocentric (alt/az) coordinates are only attached for
        // this classical-body loop, matching the Python/Skyfield backend's own parity
        // (jpl_supported = the 10 classical planets) rather than nodes, angles, or asteroids,
        // and only when `want_equatorial_and_horizontal` — a minimal-path root-finder never
        // reads these.
        for &(id, frame) in body_frames() {
            if !wanted(id) {
                continue;
            }
            match sample_state(&almanac, frame, unix_secs, ab_corr) {
                Ok(state) => {
                    let longitude = longitude_from_state(&state, jd_tt);
                    positions.insert(id.to_string(), longitude);
                    if want_motion {
                        if let Ok(body_motion) = motion_from_state(&state, jd_tt) {
                            motion.insert(id.to_string(), body_motion);
                        }
                    }
                    if want_equatorial_and_horizontal {
                        let (ra, dec) = equatorial_from_state(&state);
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
            match sample_state(&almanac, frame, unix_secs, ab_corr) {
                Ok(state) => {
                    let longitude = longitude_from_state(&state, jd_tt);
                    positions.insert(id.to_string(), longitude);
                    if let Ok(body_motion) = motion_from_state(&state, jd_tt) {
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
            match sample_state(&almanac, *frame, unix_secs, ab_corr) {
                Ok(state) => {
                    let longitude = longitude_from_state(&state, jd_tt);
                    positions.insert(id.clone(), longitude);
                    if let Ok(body_motion) = motion_from_state(&state, jd_tt) {
                        motion.insert(id.clone(), body_motion);
                    }
                }
                Err(error) => warnings.push(format!("{id}_unavailable: {error}")),
            }
        }

        // ── Lunar nodes ───────────────────────────────────────────────────
        // These secular lunar expressions are TT quantities, unlike sidereal time above.
        let mean_node = mean_node_lon(jd_tt);
        let mean_motion = mean_node_motion(jd_tt);
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
            // Osculating orbital elements are defined from the instantaneous geometric
            // Earth–Moon state, not a retarded/apparent line of sight.
            match true_node_tropical_at_unix(&almanac, unix_secs, Aberration::NONE) {
                Ok(true_nn) => {
                    let true_motion = true_node_motion(&almanac, unix_secs, Aberration::NONE).ok();
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
            match true_apogee_tropical_at_unix(&almanac, unix_secs, Aberration::NONE) {
                Ok(true_apogee) => {
                    positions.insert("true_lilith".to_string(), true_apogee);
                    if let Ok(apogee_motion) =
                        true_apogee_motion(&almanac, unix_secs, Aberration::NONE)
                    {
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
        // Skipped entirely on the minimal path unless the request actually
        // depends on an angle (a legitimate case: `ObjectType::Angle` ids
        // like "asc" are ordinary, unrestricted `transiting_objects`/
        // `transited_objects` entries — nothing stops an event/configuration
        // search from targeting one). A root-finder over ordinary bodies
        // never sets any of these `wanted(...)` checks, so this is the
        // common case in practice.
        let need_axes = matches!(tier, Tier::Full)
            || wanted("asc")
            || wanted("mc")
            || wanted("desc")
            || wanted("ic")
            || wanted("part_of_fortune")
            || wanted("part_of_spirit");

        let (asc, axes, house_cusps) = if need_axes {
            let (asc, mc, desc, ic) = compute_axes(jd_utc_as_ut1, lat, lon)
                .map_err(|e| format!("Failed to compute axes: {e}"))?;
            let axes = AstronomyAxes { asc, desc, mc, ic };
            for (id, longitude) in [("asc", asc), ("desc", desc), ("mc", mc), ("ic", ic)] {
                if wanted(id) {
                    positions.insert(id.to_string(), longitude);
                }
            }
            let (house_cusps, house_warnings) = match chart.config.house_system.clone() {
                Some(HouseSystem::WholeSign) | None => (whole_sign_cusps(asc), vec![]),
                Some(HouseSystem::Placidus) => placidus_cusps(jd_utc_as_ut1, lat, lon, asc, mc),
                Some(HouseSystem::Campanus) => campanus_cusps(jd_utc_as_ut1, lat, lon, asc, mc),
                Some(HouseSystem::Equal) => (equal_cusps(asc), vec![]),
                Some(HouseSystem::Porphyry) => (porphyry_cusps(asc, mc), vec![]),
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
            (asc, axes, house_cusps)
        } else {
            (0.0, AstronomyAxes::default(), Vec::new())
        };

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
            let sun_lon = positions.get("sun").copied().map(Ok).unwrap_or_else(|| {
                sample_tropical_longitude(&almanac, SUN_J2000, unix_secs, ab_corr)
            });
            let moon_lon = positions.get("moon").copied().map(Ok).unwrap_or_else(|| {
                sample_tropical_longitude(&almanac, MOON_J2000, unix_secs, ab_corr)
            });
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

    #[test]
    fn apparent_is_default_and_geometric_disables_aberration() {
        assert_eq!(aberration_for_position_mode(None), Aberration::CN_S);
        assert_eq!(
            aberration_for_position_mode(Some(PositionMode::Apparent)),
            Aberration::CN_S
        );
        assert_eq!(
            aberration_for_position_mode(Some(PositionMode::Geometric)),
            Aberration::NONE
        );
    }
    use anise::constants::frames::EARTH_J2000;
    use anise::math::cartesian::CartesianState;

    #[test]
    fn no_bsp_returns_error() {
        let backend = JplAstronomyBackend::new(vec![PathBuf::from("nonexistent.bsp")]);
        assert!(backend.build_almanac().is_err());
    }

    #[test]
    fn jpl_backend_for_chart_falls_back_to_catalog_when_override_path_is_invalid() {
        // A nonexistent or non-.bsp override path must not be a hard error: the
        // documented contract is that `jpl_backend_for_chart` silently falls
        // through to the normal EphemerisManager-resolved catalog in that case.
        let chart = j2000_chart("/nonexistent/path/does-not-exist.bsp");
        let backend = jpl_backend_for_chart(&chart).expect(
            "an invalid override_ephemeris path should fall back to the catalog, not error",
        );
        let data = backend
            .compute_chart_data(&chart, Some(&vec!["sun".to_string()]))
            .expect("fallback catalog kernels should still compute");
        assert!(data.positions.contains_key("sun"));
    }

    /// Copies `de440s.bsp` alone into a bare temp directory (no sibling
    /// `pck11.pca`, no bundled asteroid/Chiron kernels) to exercise the
    /// override path's auxiliary-kernel and partial-coverage semantics: the
    /// planetary-orientation kernel must still resolve from the bundled
    /// resource directory, and bodies absent from the lone override file must
    /// be reported as per-body `_unavailable` warnings, never a hard error.
    fn isolated_override_bsp_dir() -> std::path::PathBuf {
        let source = dev_bsp_path("de440s.bsp").expect("bundled de440s.bsp required for this test");
        let dir = std::env::temp_dir().join(format!(
            "kefer-jpl-override-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or_default()
        ));
        std::fs::create_dir_all(&dir).expect("create isolated override dir");
        std::fs::copy(&source, dir.join("de440s.bsp")).expect("copy de440s.bsp into isolated dir");
        dir
    }

    #[test]
    fn override_without_sibling_pck_still_loads_bundled_orientation_kernel() {
        let dir = isolated_override_bsp_dir();
        let override_path = dir.join("de440s.bsp");
        assert!(
            !dir.join("pck11.pca").exists(),
            "test setup must not have a sibling pck11.pca"
        );

        let chart = j2000_chart(override_path.to_str().unwrap());
        let backend = jpl_backend_for_chart(&chart).expect("override path should resolve");
        let data = backend
            .compute_chart_data(&chart, Some(&vec!["sun".to_string(), "moon".to_string()]))
            .expect("compute should succeed using the bundled pck11.pca fallback");
        assert!(data.positions.contains_key("sun"));
        assert!(data.positions.contains_key("moon"));

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn override_to_single_kernel_reports_missing_bodies_as_warnings_not_errors() {
        // The override file supplies only the ten planets + Moon — it does not
        // "supply every requested object". Chiron (a separate bundled Type 13
        // SPK) must degrade to a warning, not fail the whole chart.
        let dir = isolated_override_bsp_dir();
        let override_path = dir.join("de440s.bsp");
        let chart = j2000_chart(override_path.to_str().unwrap());
        let backend = jpl_backend_for_chart(&chart).expect("override path should resolve");
        let requested = vec!["sun".to_string(), "chiron".to_string()];
        let data = backend
            .compute_chart_data(&chart, Some(&requested))
            .expect("a single-kernel override must not fail the whole chart");

        assert!(data.positions.contains_key("sun"));
        assert!(!data.positions.contains_key("chiron"));
        assert!(
            data.warnings
                .iter()
                .any(|warning| warning.starts_with("chiron_unavailable")),
            "expected a chiron_unavailable warning, got: {:?}",
            data.warnings
        );

        std::fs::remove_dir_all(&dir).ok();
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

        let apogee = true_apogee_tropical_at_unix(&almanac, unix_secs, Aberration::NONE)
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
                "aspect_orbs": {},
                "override_ephemeris": bsp_path,
                "engine": "jpl"
            },
            "tags": []
        }))
        .expect("valid chart JSON")
    }

    fn dev_bsp_path(filename: &str) -> Option<PathBuf> {
        // Keep unit tests runnable from a clean checkout.  Development used to look only
        // for a removed Python-sidecar copy of the kernel, although the Rust application
        // ships the resources it needs beside this crate.
        let resource = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join(filename);
        resource.exists().then_some(resource)
    }

    #[test]
    fn longitude_velocity_matches_complete_pipeline_central_differences() {
        let paths =
            crate::infrastructure::ephemeris::EphemerisManager::from_global().available_bsp_paths();
        let almanac = load_almanac_from_paths(&paths).expect("bundled almanac");
        let epoch = Epoch::from_gregorian_utc(2024, 4, 10, 12, 0, 0, 0);
        let t = epoch.to_unix_seconds();
        // Moon, inner/outer planet, asteroid, and the bundled custom Type-13 body.
        let frames = [
            MOON_J2000,
            MERCURY_J2000,
            SATURN_BARYCENTER_J2000,
            ASTRAEA_J2000,
            Frame::from_ephem_j2000(20_002_060),
        ];
        for aberration in [Aberration::NONE, Aberration::CN_S] {
            for frame in frames {
                let state = sample_state(&almanac, frame, t, aberration).expect("state");
                let analytic = motion_from_state(&state, epoch.to_jde_tt_days())
                    .expect("motion")
                    .speed;
                let mut estimates = Vec::new();
                for step in [1.0, 10.0, 60.0] {
                    let before = sample_tropical_longitude(&almanac, frame, t - step, aberration)
                        .expect("before");
                    let after = sample_tropical_longitude(&almanac, frame, t + step, aberration)
                        .expect("after");
                    estimates.push(angular_delta_deg(before, after) / (2.0 * step / 86_400.0));
                }
                let reference = estimates[2];
                assert!((estimates[1] - reference).abs() < 2e-3,
                    "central differences did not converge for {frame:?} {aberration:?}: {estimates:?}");
                // CN+S is a corrected apparent state, whose velocity is validated rather
                // than assumed exact; 0.01 deg/day = 36 arcsec/day is deliberately looser
                // than the geometric 0.002 deg/day transport/frame tolerance.
                let tolerance = if aberration.is_some() { 1e-2 } else { 2e-3 };
                assert!((analytic - reference).abs() < tolerance,
                    "velocity mismatch for {frame:?} {aberration:?}: analytic={analytic}, fd={reference}");
            }
        }
    }

    /// Confirms the `retrograde` flag actually flips across a real station,
    /// not just that `speed < 0.0` is internally consistent with itself. Uses
    /// `application::event_search::find_stationary_point` to locate a real
    /// Mercury station (same search exercised by its own dedicated tests),
    /// then samples the full `compute_chart_data` output immediately before
    /// and after through the public chart pipeline.
    #[test]
    fn retrograde_flag_flips_across_a_real_stationary_point() {
        let payload = crate::test_support::sample_chart_payload("retrograde-flip-test");
        let resolved =
            crate::application::chart_resolution::resolve_standalone_chart(&payload, None)
                .expect("sample chart should resolve");
        let start = chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let end = start + chrono::Duration::days(45);
        let ctx = crate::application::evaluation_context::EvaluationContext::new(
            &resolved.chart,
            &resolved.model,
        );
        let station = crate::application::event_search::find_stationary_point(
            &ctx,
            "mercury",
            start,
            end,
            chrono::Duration::hours(6),
        )
        .expect("search should not error")
        .expect("expected a Mercury station in this window");

        let sample_at = |at: chrono::DateTime<chrono::Utc>| -> AstronomyMotion {
            let mut chart = resolved.chart.clone();
            chart.subject.event_time = Some(at);
            let backend = jpl_backend_for_chart(&chart).expect("backend should resolve");
            let data = backend
                .compute_chart_data(&chart, Some(&vec!["mercury".to_string()]))
                .expect("compute should succeed");
            data.motion["mercury"].clone()
        };

        let before = sample_at(station - chrono::Duration::hours(6));
        let after = sample_at(station + chrono::Duration::hours(6));
        assert_ne!(
            before.retrograde, after.retrograde,
            "retrograde flag should flip across a real station: before={before:?}, after={after:?}"
        );
        assert_eq!(before.retrograde, before.speed < 0.0);
        assert_eq!(after.retrograde, after.speed < 0.0);
    }

    /// A fast mover (Moon) genuinely crosses the 0°/360° tropical boundary
    /// within any ~30-day window. Reuses `find_aspect_exact_time` against a
    /// fixed target longitude of exactly 0° to locate the real crossing
    /// (not a synthetic `normalize_deg` unit case), then confirms the
    /// analytic motion speed stays physically continuous (no spurious
    /// ~360°/day jump from an unwrapped subtraction) immediately either side
    /// of the wrap.
    #[test]
    fn longitude_wraps_through_zero_degrees_without_a_motion_discontinuity() {
        let payload = crate::test_support::sample_chart_payload("zero-crossing-test");
        let resolved =
            crate::application::chart_resolution::resolve_standalone_chart(&payload, None)
                .expect("sample chart should resolve");
        let start = chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let end = start + chrono::Duration::days(35);

        let ctx = crate::application::evaluation_context::EvaluationContext::new(
            &resolved.chart,
            &resolved.model,
        );
        let crossing = crate::application::event_search::find_aspect_exact_time(
            &ctx,
            "moon",
            0.0,
            0.0,
            start,
            end,
            chrono::Duration::hours(6),
        )
        .expect("search should not error")
        .expect("the Moon should cross 0 degrees within 35 days");

        let sample_lon_and_speed = |at: chrono::DateTime<chrono::Utc>| -> (f64, f64) {
            let mut chart = resolved.chart.clone();
            chart.subject.event_time = Some(at);
            let backend = jpl_backend_for_chart(&chart).expect("backend should resolve");
            let data = backend
                .compute_chart_data(&chart, Some(&vec!["moon".to_string()]))
                .expect("compute should succeed");
            (data.positions["moon"], data.motion["moon"].speed)
        };

        let (lon_before, speed_before) =
            sample_lon_and_speed(crossing - chrono::Duration::minutes(30));
        let (lon_after, speed_after) =
            sample_lon_and_speed(crossing + chrono::Duration::minutes(30));

        // A genuine wrap: one side reads just under 360, the other just over 0.
        assert!(
            lon_before > 300.0 || lon_before < 60.0,
            "expected a longitude near the 0/360 boundary, got {lon_before}"
        );
        assert!(
            lon_after > 300.0 || lon_after < 60.0,
            "expected a longitude near the 0/360 boundary, got {lon_after}"
        );
        assert!(
            (lon_before - lon_after).abs() > 90.0,
            "expected the raw longitude values to straddle the wrap: {lon_before} vs {lon_after}"
        );
        // The Moon's true speed is on the order of ~13 deg/day; an unwrapped
        // subtraction across the 0/360 seam would instead read close to
        // +/-360 deg/day. A tenfold margin cleanly separates the two.
        assert!(speed_before.abs() < 20.0, "speed_before={speed_before}");
        assert!(speed_after.abs() < 20.0, "speed_after={speed_after}");
        assert!((speed_before - speed_after).abs() < 2.0, "speed should stay continuous across the wrap: before={speed_before}, after={speed_after}");
    }

    /// The bundled Chiron artifact is stored as two adjacent SPK segments
    /// (see `ephemeris-validation.md`); samples the real boundary instant
    /// (read from `spk_summaries`, not hardcoded) a few seconds either side
    /// and confirms the longitude is continuous across that internal seam —
    /// Chiron moves ~0.03 deg/day, so any multi-degree jump would indicate a
    /// broken handoff between segments rather than normal motion.
    #[test]
    fn chiron_longitude_is_continuous_across_its_internal_spk_segment_boundary() {
        use anise::naif::daf::NAIFSummaryRecord;

        let paths =
            crate::infrastructure::ephemeris::EphemerisManager::from_global().available_bsp_paths();
        let almanac = load_almanac_from_paths(&paths).expect("bundled almanac");
        let mut summaries = almanac
            .spk_summaries(20_002_060)
            .expect("bundled Chiron SPK should have segments");
        summaries.sort_by(|a, b| a.start_epoch().partial_cmp(&b.start_epoch()).unwrap());
        assert!(
            summaries.len() >= 2,
            "expected multiple segments to exercise a real internal boundary, found {}",
            summaries.len()
        );
        let boundary_et = summaries[0].end_epoch().to_et_seconds();
        assert!(
            (summaries[1].start_epoch().to_et_seconds() - boundary_et).abs() < 1.0,
            "expected the two segments to be contiguous, not a real gap"
        );

        let sample_lon = |et_seconds: f64| -> f64 {
            let epoch = Epoch::from_et_seconds(et_seconds);
            let state = almanac
                .transform(
                    Frame::from_ephem_j2000(20_002_060),
                    EARTH_MOD_FRAME,
                    epoch,
                    None,
                )
                .expect("transform across the segment boundary should succeed");
            longitude_from_state(&state, epoch.to_jde_tt_days())
        };

        let before = sample_lon(boundary_et - 5.0);
        let after = sample_lon(boundary_et + 5.0);
        let delta = angular_delta_deg(before, after).abs();
        assert!(
            delta < 0.01,
            "expected a near-zero longitude jump across the segment seam (10s apart), got {delta} deg: before={before}, after={after}"
        );
    }

    /// Internal-consistency sanity check (not an independent accuracy proof):
    /// apparent (CN+S) and geometric positions for the same body/epoch must
    /// differ by a nonzero but physically small amount. Mars near opposition
    /// has a light-time of several minutes, which at its orbital speed is an
    /// arcminute-scale apparent/geometric difference — real, but nowhere near
    /// a degree.
    #[test]
    fn apparent_and_geometric_mars_positions_differ_by_a_small_physical_amount() {
        let bsp = dev_bsp_path("de440s.bsp").expect("no BSP found");
        let almanac = load_almanac_from_paths(&[bsp]).expect("almanac should load");
        let epoch = Epoch::from_gregorian_utc(2024, 4, 10, 12, 0, 0, 0);
        let unix_secs = epoch.to_unix_seconds();
        let jd_tt = epoch.to_jde_tt_days();

        let geometric_state =
            sample_state(&almanac, MARS_BARYCENTER_J2000, unix_secs, Aberration::NONE)
                .expect("geometric state");
        let apparent_state =
            sample_state(&almanac, MARS_BARYCENTER_J2000, unix_secs, Aberration::CN_S)
                .expect("apparent state");

        let geometric_lon = longitude_from_state(&geometric_state, jd_tt);
        let apparent_lon = longitude_from_state(&apparent_state, jd_tt);
        let delta = angular_delta_deg(geometric_lon, apparent_lon).abs();

        assert!(
            delta > 1e-4,
            "expected a nonzero light-time/aberration shift, got {delta} deg"
        );
        assert!(
            delta < 1.0,
            "expected a sub-degree light-time/aberration shift for Mars, got {delta} deg"
        );
    }

    /// `compute_minimal` must agree with `compute_chart_data` (the full
    /// path) on every quantity it actually returns — it is a *skip*, not a
    /// separate computation: both ultimately call the same `sample_state`/
    /// `longitude_from_state`/`motion_from_state` pipeline, but this proves
    /// the tier-gating logic in `compute_chart_data_impl` didn't
    /// accidentally change a value while skipping the rest. Covers both
    /// `RequiredQuantities` tiers, several representative objects (a fast
    /// mover, a slow mover, and a secular lunar-node quantity that bypasses
    /// `sample_state` entirely), two distinct epochs, and both
    /// geometric/apparent position modes.
    #[test]
    fn minimal_path_agrees_with_full_path_for_representative_objects_epochs_and_modes() {
        use crate::infrastructure::position_provider::RequiredQuantities;
        use crate::workspace::models::PositionMode;

        let bsp = dev_bsp_path("de440s.bsp").expect("no BSP found");
        let backend = JplAstronomyBackend::new(vec![bsp.clone()]);

        let bodies = ["moon", "mars", "north_node"];
        let epochs = ["2000-01-01 12:00:00", "2024-06-15 08:30:00"];
        let modes = [PositionMode::Apparent, PositionMode::Geometric];

        for epoch in epochs {
            for mode in modes {
                let mut chart = j2000_chart(bsp.to_str().unwrap());
                chart.subject.event_time = Some(
                    chrono::NaiveDateTime::parse_from_str(epoch, "%Y-%m-%d %H:%M:%S")
                        .expect("valid fixed test epoch")
                        .and_utc(),
                );
                chart.config.position_mode = Some(mode);

                let requested: Vec<String> = bodies.iter().map(|b| b.to_string()).collect();
                let full = backend
                    .compute_chart_data(&chart, Some(&requested))
                    .expect("full path should compute");

                for tier in [
                    RequiredQuantities::LongitudeOnly,
                    RequiredQuantities::LongitudeAndMotion,
                ] {
                    let minimal = backend
                        .compute_minimal(&chart, &requested, tier)
                        .expect("minimal path should compute");

                    for body in bodies {
                        let full_lon = full.positions.get(body);
                        let minimal_lon = minimal.positions.get(body);
                        assert_eq!(
                            full_lon.is_some(),
                            minimal_lon.is_some(),
                            "{body} availability should match between paths at {epoch} ({mode:?}, {tier:?})"
                        );
                        if let (Some(full_lon), Some(minimal_lon)) = (full_lon, minimal_lon) {
                            assert!(
                                (full_lon - minimal_lon).abs() < 1e-9,
                                "{body} longitude should match exactly between paths at {epoch} ({mode:?}, {tier:?}): full={full_lon}, minimal={minimal_lon}"
                            );
                        }

                        if tier == RequiredQuantities::LongitudeAndMotion {
                            let full_motion = full.motion.get(body);
                            let minimal_motion = minimal.motion.get(body);
                            assert_eq!(
                                full_motion.is_some(),
                                minimal_motion.is_some(),
                                "{body} motion availability should match at {epoch} ({mode:?})"
                            );
                            if let (Some(full_motion), Some(minimal_motion)) =
                                (full_motion, minimal_motion)
                            {
                                assert!(
                                    (full_motion.speed - minimal_motion.speed).abs() < 1e-9,
                                    "{body} motion speed should match exactly at {epoch} ({mode:?}): full={full_motion:?}, minimal={minimal_motion:?}"
                                );
                                assert_eq!(full_motion.retrograde, minimal_motion.retrograde);
                            }
                        }
                    }
                }
            }
        }
    }

    /// An out-of-coverage epoch must degrade to an explicit per-body
    /// `_unavailable` warning, not a hard error and not any attempt to reach
    /// a remote ephemeris. Year 3000 falls outside the bundled `de440s.bsp`'s
    /// measured 1849-2150 coverage (see ephemeris-validation.md), and no
    /// `de441` supplement is present in this checkout to extend it, so this
    /// also exercises "missing kernel for this epoch" with only local files
    /// on the path.
    #[test]
    fn out_of_coverage_epoch_produces_explicit_local_warnings_not_an_error() {
        let bsp = dev_bsp_path("de440s.bsp").expect("no BSP found");
        let chart = j2000_chart(bsp.to_str().unwrap());
        let mut far_future_chart = chart.clone();
        far_future_chart.subject.event_time =
            chrono::DateTime::parse_from_rfc3339("3000-01-01T00:00:00Z")
                .ok()
                .map(|dt| dt.with_timezone(&chrono::Utc));
        assert!(
            far_future_chart.subject.event_time.is_some(),
            "test fixture date should parse"
        );

        let backend = JplAstronomyBackend::new(vec![bsp]);
        let requested = vec!["sun".to_string(), "moon".to_string()];
        let data = backend
            .compute_chart_data(&far_future_chart, Some(&requested))
            .expect("an out-of-coverage epoch must not fail the whole chart");

        assert!(
            !data.positions.contains_key("sun"),
            "sun should not resolve at an epoch outside loaded coverage"
        );
        assert!(
            data.warnings
                .iter()
                .any(|warning| warning.starts_with("sun_unavailable")),
            "expected an explicit sun_unavailable warning, got: {:?}",
            data.warnings
        );
        assert!(
            data.warnings
                .iter()
                .any(|warning| warning.starts_with("moon_unavailable")),
            "expected an explicit moon_unavailable warning, got: {:?}",
            data.warnings
        );
    }

    /// An unknown/unsupported body id must also degrade to an explicit local
    /// diagnostic through the full resolved-chart pipeline (not through the
    /// bare backend, which only knows its own fixed frame tables), and must
    /// not attempt any kind of lookup beyond the local body-definition
    /// catalog.
    #[test]
    fn unsupported_body_id_produces_explicit_local_warning_through_resolved_chart() {
        let payload = crate::test_support::sample_chart_payload("unsupported-body-test");
        let resolved =
            crate::application::chart_resolution::resolve_standalone_chart(&payload, None)
                .expect("sample chart should resolve");
        let result = crate::application::computation::compute_chart(
            crate::application::computation::ChartComputeRequest {
                resolved_chart: resolved,
                body_ids: Some(vec!["not_a_real_body_id".to_string()]),
                aspect_types: None,
            },
        )
        .expect("an unsupported body id must not fail the whole chart");
        assert!(
            result
                .warnings
                .iter()
                .any(|warning| warning.contains("not_a_real_body_id")),
            "expected a local diagnostic naming the unsupported body id, got: {:?}",
            result.warnings
        );
    }

    #[derive(serde::Deserialize)]
    struct HorizonsVectorSample {
        jd_tdb: f64,
        x_km: f64,
        y_km: f64,
        z_km: f64,
        vx_km_s: f64,
        vy_km_s: f64,
        vz_km_s: f64,
    }

    #[derive(serde::Deserialize)]
    struct HorizonsVectorFixture {
        samples: Vec<HorizonsVectorSample>,
    }

    /// Independent external reference, fetched from the live JPL Horizons API
    /// (see `tests/fixtures/horizons/mercury_2024_geocentric.json` for exact
    /// request parameters and provenance) and saved for offline use. This
    /// compares the raw J2000/ICRF geocentric state ANISE returns for Mercury
    /// Barycenter — *before* this backend's own mean-of-date/ecliptic
    /// rotation — against Horizons' own independently generated geometric
    /// (VEC_CORR=NONE) state at 23 epochs across Jan-Feb 2024, the same
    /// window `retrograde_flag_flips_across_a_real_stationary_point` and
    /// `stationary_point_search_finds_a_real_mercury_station_and_independently_verifies_it`
    /// search for a station in.
    #[test]
    fn mercury_2024_geocentric_state_matches_independent_horizons_fixture() {
        let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/horizons/mercury_2024_geocentric.json");
        let fixture: HorizonsVectorFixture = serde_json::from_str(
            &std::fs::read_to_string(&fixture_path)
                .unwrap_or_else(|e| panic!("cannot read {}: {e}", fixture_path.display())),
        )
        .expect("fixture should parse");
        assert_eq!(
            fixture.samples.len(),
            23,
            "expected the full fetched series"
        );

        let bsp = dev_bsp_path("de440s.bsp").expect("no BSP found");
        let almanac = load_almanac_from_paths(&[bsp]).expect("almanac should load");

        let mut max_pos_error_km = 0.0_f64;
        let mut max_vel_error_km_s = 0.0_f64;
        for sample in &fixture.samples {
            let epoch = Epoch::from_jde_tdb(sample.jd_tdb);
            let state = almanac
                .transform(MERCURY_J2000, EARTH_J2000, epoch, None)
                .expect("geometric transform should succeed within de440s coverage");
            let pos_error = ((state.radius_km.x - sample.x_km).powi(2)
                + (state.radius_km.y - sample.y_km).powi(2)
                + (state.radius_km.z - sample.z_km).powi(2))
            .sqrt();
            let vel_error = ((state.velocity_km_s.x - sample.vx_km_s).powi(2)
                + (state.velocity_km_s.y - sample.vy_km_s).powi(2)
                + (state.velocity_km_s.z - sample.vz_km_s).powi(2))
            .sqrt();
            max_pos_error_km = max_pos_error_km.max(pos_error);
            max_vel_error_km_s = max_vel_error_km_s.max(vel_error);
        }

        // de440s is JPL's own compact/short re-fit of the DE440 solution;
        // Horizons here reports DE441 (a related but separately fit
        // solution). Observed maximum error across these 23 epochs was
        // ~0.035 km in position and ~4.8e-8 km/s in velocity — these bounds
        // keep generous margin above that, not tuned to just barely pass.
        // See ephemeris-validation.md for the full reproducible record.
        assert!(
            max_pos_error_km < 1.0,
            "max position error vs. independent Horizons fixture: {max_pos_error_km} km"
        );
        assert!(
            max_vel_error_km_s < 1e-5,
            "max velocity error vs. independent Horizons fixture: {max_vel_error_km_s} km/s"
        );
    }

    /// Repeatable direct-SPK benchmark.  This intentionally measures the public chart path,
    /// including apparent-place corrections and finite-difference motion, rather than only a
    /// raw segment lookup.  Run with:
    /// `cargo test --release jpl_direct_path_benchmark -- --ignored --nocapture`.
    #[test]
    #[ignore = "diagnostic benchmark; run manually on the target machine"]
    fn jpl_direct_path_benchmark() {
        use std::hint::black_box;
        use std::time::Instant;

        let paths =
            crate::infrastructure::ephemeris::EphemerisManager::from_global().available_bsp_paths();
        let backend = JplAstronomyBackend::new(paths);
        let chart = j2000_chart("");
        let one = vec!["mercury".to_string()];
        let all: Vec<String> = body_frames()
            .iter()
            .map(|(id, _)| (*id).to_string())
            .chain(
                asteroid_body_frames()
                    .iter()
                    .map(|(id, _)| (*id).to_string()),
            )
            .chain(std::iter::once("chiron".to_string()))
            .collect();
        let almanac = backend.build_almanac().expect("benchmark almanac");
        let unix_secs = chart.subject.event_time.expect("event time").timestamp() as f64;
        let jd_tt = Epoch::from_unix_seconds(unix_secs).to_jde_tt_days();
        const ITERATIONS: u32 = 10;
        let frames: Vec<Frame> = body_frames()
            .iter()
            .map(|(_, frame)| *frame)
            .chain(asteroid_body_frames().iter().map(|(_, frame)| *frame))
            .chain(std::iter::once(Frame::from_ephem_j2000(20_002_060)))
            .collect();

        // Cold means no in-process Almanac; OS page cache is intentionally not controlled.
        almanac_cache().write().expect("cache lock").clear();
        let cold_start = Instant::now();
        black_box(
            backend
                .compute_chart_data(&chart, Some(&one))
                .expect("cold direct computation"),
        );
        let cold = cold_start.elapsed();

        let mut position_only_samples = Vec::with_capacity(ITERATIONS as usize);
        for _ in 0..ITERATIONS {
            let start = Instant::now();
            for frame in &frames {
                let state = sample_state(&almanac, *frame, unix_secs, Aberration::CN_S)
                    .expect("position-only state");
                let motion = motion_from_state(&state, jd_tt).expect("position-only motion");
                black_box((longitude_from_state(&state, jd_tt), motion));
            }
            position_only_samples.push(start.elapsed());
        }

        let mut warm_one_samples = Vec::with_capacity(ITERATIONS as usize);
        for _ in 0..ITERATIONS {
            let start = Instant::now();
            black_box(
                backend
                    .compute_chart_data(&chart, Some(&one))
                    .expect("warm single-body computation"),
            );
            warm_one_samples.push(start.elapsed());
        }

        let mut warm_all_samples = Vec::with_capacity(ITERATIONS as usize);
        for _ in 0..ITERATIONS {
            let start = Instant::now();
            let data = backend
                .compute_chart_data(&chart, Some(&all))
                .expect("warm all-body computation");
            let unavailable: Vec<&str> = all
                .iter()
                .filter(|id| !data.positions.contains_key(id.as_str()))
                .map(String::as_str)
                .collect();
            assert!(
                unavailable.is_empty(),
                "benchmark request contained unavailable bodies: {unavailable:?}; warnings: {:?}",
                data.warnings
            );
            black_box(data);
            warm_all_samples.push(start.elapsed());
        }

        // Chart rendering samples a dense time range.  The requested body has motion, so this
        // also represents the three direct evaluations made for a displayed moving body.
        let dense_start = Instant::now();
        let mut dense_chart = chart.clone();
        const DENSE_SAMPLES: i64 = 8;
        for day in 0..DENSE_SAMPLES {
            dense_chart.subject.event_time = chart
                .subject
                .event_time
                .map(|time| time + chrono::Duration::days(day));
            black_box(
                backend
                    .compute_chart_data(&dense_chart, Some(&one))
                    .expect("dense direct computation"),
            );
        }
        let dense = dense_start.elapsed();

        warm_one_samples.sort_unstable();
        warm_all_samples.sort_unstable();
        position_only_samples.sort_unstable();
        let p95 = |samples: &[std::time::Duration]| {
            samples[(samples.len() * 95 / 100).min(samples.len() - 1)]
        };
        println!(
            "direct JPL benchmark: cold={cold:?}, position_only_{} p50={:?} p95={:?}, warm_one p50={:?} p95={:?}, warm_all p50={:?} p95={:?}, dense_{DENSE_SAMPLES}={dense:?} ({:.1} samples/s)", frames.len(),
            position_only_samples[position_only_samples.len() / 2], p95(&position_only_samples),
            warm_one_samples[warm_one_samples.len() / 2], p95(&warm_one_samples),
            warm_all_samples[warm_all_samples.len() / 2], p95(&warm_all_samples),
            DENSE_SAMPLES as f64 / dense.as_secs_f64()
        );
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
        let chart: crate::workspace::models::ChartInstance =
            serde_json::from_value(serde_json::json!({
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
                    "aspect_orbs": {},
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
        use crate::infrastructure::position_provider::{AstronomyBackend, SwissAstronomyBackend};

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
                    "aspect_orbs": {},
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
                    "aspect_orbs": {},
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
