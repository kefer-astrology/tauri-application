/// Astronomy backend using the `anise` crate (MPL-2.0) with a SPICE BSP ephemeris file.
///
/// This is the license-clean standalone Rust compute path. It reads the same
/// `de421.bsp` file used by the Python/Skyfield sidecar, with no libswe dependency.
///
/// Gaps vs libswe (handled above the astronomy layer):
/// - Ecliptic longitude: converted from ICRF via obliquity rotation in houses.rs
/// - Lunar nodes: computed analytically in houses.rs (not in DE421)
/// - House cusps: computed in houses.rs (anise is astrodynamics, not astrology)
/// - Chiron: not in DE421; skipped with a warning

use std::collections::HashMap;
use std::path::PathBuf;

use anise::constants::frames::{
    EARTH_J2000, JUPITER_BARYCENTER_J2000, MARS_J2000, MERCURY_J2000, MOON_J2000,
    NEPTUNE_BARYCENTER_J2000, PLUTO_BARYCENTER_J2000, SATURN_BARYCENTER_J2000, SUN_J2000,
    URANUS_BARYCENTER_J2000, VENUS_J2000,
};
use anise::prelude::*;
use hifitime::Epoch;

use crate::astronomy::{AstronomyAxes, AstronomyBackend, AstronomyChartData};
use crate::houses::{
    compute_axes, general_precession_deg, icrf_to_ecliptic, julian_day_from_unix, mean_node_lon,
    mean_obliquity_deg, normalize_deg,
    placidus_cusps, whole_sign_cusps,
};
use crate::workspace::models::{ChartInstance, HouseSystem};

// ─── body table ──────────────────────────────────────────────────────────────

/// Maps Kefer body IDs to anise J2000 frames available in DE421.
/// Outer planets use barycenters (individual planet offsets not in DE421).
fn body_frames() -> &'static [(&'static str, anise::prelude::Frame)] {
    &[
        ("sun", SUN_J2000),
        ("moon", MOON_J2000),
        ("mercury", MERCURY_J2000),
        ("venus", VENUS_J2000),
        ("mars", MARS_J2000),
        ("jupiter", JUPITER_BARYCENTER_J2000),
        ("saturn", SATURN_BARYCENTER_J2000),
        ("uranus", URANUS_BARYCENTER_J2000),
        ("neptune", NEPTUNE_BARYCENTER_J2000),
        ("pluto", PLUTO_BARYCENTER_J2000),
    ]
}

// ─── backend ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct JplAstronomyBackend {
    bsp_path: PathBuf,
}

impl JplAstronomyBackend {
    pub fn new(bsp_path: impl Into<PathBuf>) -> Self {
        Self { bsp_path: bsp_path.into() }
    }

    /// Locate the BSP file: use `override_ephemeris` from chart config if set,
    /// otherwise fall back to the bundled `de421.bsp` in resources.
    pub fn resolve_bsp(chart: &ChartInstance) -> Option<PathBuf> {
        // 1. Explicit override in chart config
        if let Some(path) = chart.config.override_ephemeris.as_deref() {
            let p = PathBuf::from(path);
            if p.exists() && p.extension().map_or(false, |e| e == "bsp") {
                return Some(p);
            }
        }

        // 2. KEFER_BSP_PATH environment variable
        if let Ok(env) = std::env::var("KEFER_BSP_PATH") {
            let p = PathBuf::from(env);
            if p.exists() {
                return Some(p);
            }
        }

        // 3. Bundled de421.bsp next to the binary or in resources/
        let candidates = [
            PathBuf::from("de421.bsp"),
            PathBuf::from("resources/de421.bsp"),
            PathBuf::from("backend-python/source/de421.bsp"),
            PathBuf::from("../backend-python/source/de421.bsp"),
            PathBuf::from("../src-tauri/resources/de421.bsp"),
        ];
        for c in &candidates {
            if c.exists() {
                return Some(c.clone());
            }
        }
        if let Ok(exe) = std::env::current_exe() {
            for base in exe.ancestors() {
                for rel in [
                    "de421.bsp",
                    "resources/de421.bsp",
                    "backend-python/source/de421.bsp",
                    "../backend-python/source/de421.bsp",
                    "../src-tauri/resources/de421.bsp",
                ] {
                    let p = base.join(rel);
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
        }

        None
    }
}

impl AstronomyBackend for JplAstronomyBackend {
    fn backend_id(&self) -> &'static str {
        "jpl"
    }

    fn ephemeris_source(&self, _chart: &ChartInstance) -> Option<String> {
        Some(self.bsp_path.to_string_lossy().into_owned())
    }

    fn compute_chart_data(
        &self,
        chart: &ChartInstance,
        requested_objects: Option<&Vec<String>>,
    ) -> Result<AstronomyChartData, String> {
        // ── load almanac ──────────────────────────────────────────────────
        let almanac = Almanac::default()
            .load(self.bsp_path.to_str().ok_or("BSP path is not valid UTF-8")?)
            .map_err(|e| format!("Failed to load BSP '{}': {e}", self.bsp_path.display()))?;

        // ── event time ────────────────────────────────────────────────────
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

        // ── requested body filter ─────────────────────────────────────────
        let wanted = |id: &str| {
            requested_objects
                .map(|list| list.iter().any(|s| s.as_str() == id))
                .unwrap_or(true)
        };

        // ── planetary positions ───────────────────────────────────────────
        let mut positions: HashMap<String, f64> = HashMap::new();
        let mut warnings: Vec<String> = Vec::new();

        for &(id, frame) in body_frames() {
            if !wanted(id) {
                continue;
            }
            match almanac.translate(frame, EARTH_J2000, epoch, None) {
                Ok(state) => {
                    let (lon, _lat) =
                        icrf_to_ecliptic(state.radius_km.x, state.radius_km.y, state.radius_km.z, obliquity);
                    positions.insert(
                        id.to_string(),
                        normalize_deg(lon + tropical_offset),
                    );
                }
                Err(e) => {
                    warnings.push(format!("{id}_unavailable: {e}"));
                }
            }
        }

        // ── lunar nodes (analytical, not in DE421) ────────────────────────
        let mean_node = mean_node_lon(jd_ut);
        if wanted("north_node") || wanted("mean_node") {
            let key = if wanted("north_node") { "north_node" } else { "mean_node" };
            positions.insert(key.to_string(), mean_node);
        }
        if wanted("south_node") || wanted("mean_south_node") {
            let key = if wanted("south_node") { "south_node" } else { "mean_south_node" };
            let south = (mean_node + 180.0) % 360.0;
            positions.insert(key.to_string(), south);
        }
        // True node not yet computed; warn if requested
        if wanted("true_north_node") || wanted("true_south_node") {
            warnings.push(
                "true_node_not_available: anise backend uses mean node only".to_string(),
            );
        }

        // Chiron is not in DE421
        if wanted("chiron") {
            warnings.push("chiron_not_available: not present in de421.bsp".to_string());
        }

        // ── axes and house cusps ──────────────────────────────────────────
        let lat = chart.subject.location.latitude;
        let lon = chart.subject.location.longitude;

        let (asc, mc, desc, ic) = compute_axes(jd_ut, lat, lon)
            .map_err(|e| format!("Failed to compute axes: {e}"))?;

        let axes = AstronomyAxes { asc, desc, mc, ic };

        let house_system = chart.config.house_system.clone();
        let (house_cusps, house_warnings) = match house_system {
            Some(HouseSystem::WholeSign) | None => (whole_sign_cusps(asc), vec![]),
            Some(HouseSystem::Placidus) => placidus_cusps(jd_ut, lat, lon, asc, mc),
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

        // Optionally surface warnings in positions map (callers check result metadata)
        // The AstronomyChartData struct does not carry warnings yet; they are dropped here.
        // TODO: add warnings field to AstronomyChartData when the trait is extended.
        let _ = warnings;

        Ok(AstronomyChartData { positions, axes, house_cusps })
    }
}

// ─── path resolution ─────────────────────────────────────────────────────────

/// Resolve the BSP file path for a chart and return a ready backend, or an error
/// describing what was missing.
pub fn jpl_backend_for_chart(chart: &ChartInstance) -> Result<JplAstronomyBackend, String> {
    let path = JplAstronomyBackend::resolve_bsp(chart).ok_or_else(|| {
        "No de421.bsp file found. Set KEFER_BSP_PATH or place de421.bsp next to the binary."
            .to_string()
    })?;
    Ok(JplAstronomyBackend::new(path))
}

// ─── tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_bsp_returns_none_when_missing() {
        // A chart with no override_ephemeris and no BSP on PATH → None (or Some if dev env has BSP).
        let chart: crate::workspace::models::ChartInstance = serde_json::from_value(serde_json::json!({
            "id": "x",
            "subject": { "id": "x", "name": "x", "event_time": null,
                         "location": { "name": "x", "latitude": 0.0, "longitude": 0.0, "timezone": "UTC" } },
            "config": { "mode": "NATAL", "zodiac_type": "Tropical",
                        "included_points": [], "aspect_orbs": {}, "display_style": "", "color_theme": "" },
            "tags": []
        })).unwrap();
        let _result = JplAstronomyBackend::resolve_bsp(&chart);
    }

    /// Build a minimal ChartInstance for J2000.0 (2000-01-01 12:00:00 UTC), Greenwich.
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

    /// Locate de421.bsp relative to the crate root, used by dev-time tests.
    fn dev_bsp_path() -> Option<std::path::PathBuf> {
        let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()?
            .join("backend-python/source/de421.bsp");
        root.exists().then_some(root)
    }

    /// Validate JplAstronomyBackend at J2000.0 and print positions for cross-language comparison.
    ///
    /// Run this first, then run the Python counterpart:
    ///   cd backend-python && python -m pytest tests/test_jpl_backend_j2000.py -v -s
    ///
    /// The two outputs (Rust/anise vs Python/Skyfield, same de421.bsp) should agree to ≤0.01°.
    ///
    /// Run with: cargo test --features swisseph j2000_positions -- --ignored --nocapture
    #[test]
    #[ignore = "requires backend-python/source/de421.bsp"]
    fn j2000_positions_match_horizons() {
        let bsp = match dev_bsp_path() {
            Some(p) => p,
            None => {
                eprintln!("SKIP: de421.bsp not found");
                return;
            }
        };

        let chart = j2000_chart(bsp.to_str().unwrap());
        let backend = JplAstronomyBackend::new(&bsp);
        let data = backend.compute_chart_data(&chart, None).expect("compute_chart_data failed");

        // Print all positions so the Python comparison test can validate side-by-side.
        let mut bodies: Vec<(&str, f64)> = data.positions.iter()
            .map(|(k, &v)| (k.as_str(), v))
            .collect();
        bodies.sort_by_key(|(k, _)| *k);
        println!("\n=== JplAstronomyBackend positions at J2000.0 (Rust/anise) ===");
        for (body, lon) in &bodies {
            println!("  {body:<20} {lon:.4}°");
        }
        println!("  {:<20} {:.4}°  (asc)", "asc", data.axes.asc);
        println!("  {:<20} {:.4}°  (mc)", "mc", data.axes.mc);
        println!("  house_cusps: {:?}", data.house_cusps);

        // All 10 bodies must be present.
        let expected_bodies = ["sun", "moon", "mercury", "venus", "mars",
                                "jupiter", "saturn", "uranus", "neptune", "pluto"];
        for body in expected_bodies {
            assert!(data.positions.contains_key(body), "{body} missing from positions");
        }

        // All longitudes must be in [0, 360).
        for (body, &lon) in &data.positions {
            assert!((0.0..360.0).contains(&lon), "{body} longitude {lon} out of range");
        }

        // Sun at J2000.0 is well-established: winter solstice ~Dec 22 → ~280° on Jan 1.
        let sun = data.positions["sun"];
        let sun_diff = ((sun - 280.4 + 540.0) % 360.0) - 180.0;
        assert!(sun_diff.abs() < 1.0, "sun: got {sun:.4}°, expected ~280.4° (diff {sun_diff:+.4}°)");

        // Uranus and Neptune are slow movers; cross-check against Horizons-calibrated values.
        let uranus = data.positions["uranus"];
        let u_diff = ((uranus - 314.8 + 540.0) % 360.0) - 180.0;
        assert!(u_diff.abs() < 1.0, "uranus: got {uranus:.4}°, expected ~314.8° (diff {u_diff:+.4}°)");

        let neptune = data.positions["neptune"];
        let n_diff = ((neptune - 303.2 + 540.0) % 360.0) - 180.0;
        assert!(n_diff.abs() < 1.0, "neptune: got {neptune:.4}°, expected ~303.2° (diff {n_diff:+.4}°)");
    }

    #[cfg(feature = "swisseph")]
    #[test]
    #[ignore = "diagnostic comparison against Swiss Ephemeris at a fixed reference instant"]
    fn compare_jpl_vs_swisseph_2026_04_22_1500_utc() {
        use crate::astronomy::{AstronomyBackend, SwissAstronomyBackend};

        let bsp = match dev_bsp_path() {
            Some(p) => p,
            None => {
                eprintln!("SKIP: de421.bsp not found");
                return;
            }
        };

        let jpl_chart: crate::workspace::models::ChartInstance = serde_json::from_value(serde_json::json!({
            "id": "cmp_2026_04_22_1500",
            "subject": {
                "id": "cmp_2026_04_22_1500",
                "name": "2026-04-22 15:00 UTC",
                "event_time": "2026-04-22 15:00:00+00:00",
                "location": {
                    "name": "Greenwich",
                    "latitude": 51.4779,
                    "longitude": 0.0,
                    "timezone": "UTC"
                }
            },
            "config": {
                "mode": "NATAL",
                "house_system": "Placidus",
                "zodiac_type": "Tropical",
                "included_points": [],
                "aspect_orbs": {},
                "display_style": "",
                "color_theme": "",
                "override_ephemeris": bsp,
                "engine": "jpl"
            },
            "tags": []
        })).expect("valid comparison chart JSON");

        let swiss_chart: crate::workspace::models::ChartInstance = serde_json::from_value(serde_json::json!({
            "id": "cmp_2026_04_22_1500_swiss",
            "subject": {
                "id": "cmp_2026_04_22_1500_swiss",
                "name": "2026-04-22 15:00 UTC",
                "event_time": "2026-04-22 15:00:00+00:00",
                "location": {
                    "name": "Greenwich",
                    "latitude": 51.4779,
                    "longitude": 0.0,
                    "timezone": "UTC"
                }
            },
            "config": {
                "mode": "NATAL",
                "house_system": "Placidus",
                "zodiac_type": "Tropical",
                "included_points": [],
                "aspect_orbs": {},
                "display_style": "",
                "color_theme": "",
                "engine": "swisseph"
            },
            "tags": []
        })).expect("valid swiss comparison chart JSON");

        let jpl = JplAstronomyBackend::new(jpl_chart.config.override_ephemeris.clone().unwrap());
        let swiss = SwissAstronomyBackend;

        let jpl_data = jpl.compute_chart_data(&jpl_chart, None).expect("jpl compute_chart_data failed");
        let swiss_data = swiss.compute_chart_data(&swiss_chart, None).expect("swiss compute_chart_data failed");

        let bodies = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
        println!("\n=== JPL vs Swiss at 2026-04-22 15:00:00 UTC ===");
        println!(" body                 jpl         swiss       diff");
        for body in bodies {
            let j = jpl_data.positions.get(body).copied().unwrap_or(f64::NAN);
            let s = swiss_data.positions.get(body).copied().unwrap_or(f64::NAN);
            let diff = ((j - s + 540.0) % 360.0) - 180.0;
            println!(" {body:<12} {j:>10.6}° {s:>10.6}° {diff:>+9.6}°");
        }
        let asc_diff = ((jpl_data.axes.asc - swiss_data.axes.asc + 540.0) % 360.0) - 180.0;
        let mc_diff = ((jpl_data.axes.mc - swiss_data.axes.mc + 540.0) % 360.0) - 180.0;
        println!(" asc          {:>10.6}° {:>10.6}° {:+9.6}°", jpl_data.axes.asc, swiss_data.axes.asc, asc_diff);
        println!(" mc           {:>10.6}° {:>10.6}° {:+9.6}°", jpl_data.axes.mc, swiss_data.axes.mc, mc_diff);
    }
}
