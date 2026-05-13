//! Geocentric lunar phase from tropical Sun and Moon longitudes.
//!
//! Used for chart `moon_details` in compute responses. Phase is derived from the
//! difference in **tropical ecliptic longitude** (same convention as radix `positions`),
//! which matches common astrological lunar-phase wheels; it is not a full SPICE
//! three-vector illumination solve (see docs).

use serde::Serialize;
use std::collections::HashMap;

/// Mean synodic month in days (same order of magnitude as Meeus / NASA factsheets).
const SYNODIC_MONTH_DAYS: f64 = 29.530588853;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct LunarPhaseDetails {
    /// Geocentric ecliptic elongation: Moon ahead of Sun in tropical longitude, \[0, 360).
    /// 0° conjunction (new), 180° opposition (full).
    pub elongation_deg: f64,
    /// Illuminated fraction of the lunar disk \[0, 1\] from a simple sphere model:
    /// `(1 - cos(elongation_rad)) / 2`.
    pub illuminated_fraction: f64,
    /// Approximate age in days since last new moon: `elongation / 360 * synodic_month`.
    pub age_days: f64,
    /// True from just after new through just before full (`elongation` in (0, 180)).
    pub waxing: bool,
    /// Stable machine id, e.g. `waxing_crescent`.
    pub phase_id: &'static str,
    /// Human-readable label.
    pub phase_label: &'static str,
}

fn normalize_deg(value: f64) -> f64 {
    let mut out = value % 360.0;
    if out < 0.0 {
        out += 360.0;
    }
    out
}

/// Elongation in \[0, 360): Moon minus Sun in tropical longitude.
pub fn elongation_from_tropical(sun_lon: f64, moon_lon: f64) -> f64 {
    normalize_deg(moon_lon - sun_lon)
}

pub fn illuminated_fraction(elongation_deg: f64) -> f64 {
    let rad = elongation_deg.to_radians();
    (1.0 - rad.cos()) / 2.0
}

fn phase_bucket(elongation_deg: f64) -> (&'static str, &'static str) {
    let e = normalize_deg(elongation_deg);
    // Eight equal 45° sectors centered on principal phases.
    match e {
        x if x < 22.5 || x >= 337.5 => ("new_moon", "New Moon"),
        x if x < 67.5 => ("waxing_crescent", "Waxing Crescent"),
        x if x < 112.5 => ("first_quarter", "First Quarter"),
        x if x < 157.5 => ("waxing_gibbous", "Waxing Gibbous"),
        x if x < 202.5 => ("full_moon", "Full Moon"),
        x if x < 247.5 => ("waning_gibbous", "Waning Gibbous"),
        x if x < 292.5 => ("third_quarter", "Third Quarter"),
        _ => ("waning_crescent", "Waning Crescent"),
    }
}

/// Build lunar phase report from radix tropical longitudes (degrees).
pub fn moon_details_from_tropical_longitudes(sun_lon: f64, moon_lon: f64) -> LunarPhaseDetails {
    let elongation_deg = elongation_from_tropical(sun_lon, moon_lon);
    let illuminated_fraction = illuminated_fraction(elongation_deg);
    let age_days = elongation_deg / 360.0 * SYNODIC_MONTH_DAYS;
    let waxing = elongation_deg > 0.0 && elongation_deg < 180.0;
    let (phase_id, phase_label) = phase_bucket(elongation_deg);
    LunarPhaseDetails {
        elongation_deg,
        illuminated_fraction,
        age_days,
        waxing,
        phase_id,
        phase_label,
    }
}

pub fn from_position_map(positions: &HashMap<String, f64>) -> Option<LunarPhaseDetails> {
    let sun = *positions.get("sun")?;
    let moon = *positions.get("moon")?;
    Some(moon_details_from_tropical_longitudes(sun, moon))
}

fn f64_from_json_value(value: &serde_json::Value) -> Option<f64> {
    value.as_f64()
}

/// If `moon_details` is absent or null, fill it from `positions.sun` / `positions.moon` when present.
pub fn inject_moon_details_into_chart_map(result: &mut HashMap<String, serde_json::Value>) {
    let need_fill = match result.get("moon_details") {
        None => true,
        Some(v) if v.is_null() => true,
        _ => false,
    };
    if !need_fill {
        return;
    }
    let Some(pos) = result.get("positions") else {
        return;
    };
    let Some(obj) = pos.as_object() else {
        return;
    };
    let Some(sun) = obj.get("sun").and_then(f64_from_json_value) else {
        return;
    };
    let Some(moon) = obj.get("moon").and_then(f64_from_json_value) else {
        return;
    };
    let details = moon_details_from_tropical_longitudes(sun, moon);
    if let Ok(value) = serde_json::to_value(details) {
        result.insert("moon_details".to_string(), value);
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    #[test]
    fn new_moon_zero_elongation() {
        let d = moon_details_from_tropical_longitudes(280.0, 280.0);
        assert!((d.elongation_deg - 0.0).abs() < 1e-9);
        assert!((d.illuminated_fraction - 0.0).abs() < 1e-9);
        assert_eq!(d.phase_id, "new_moon");
        assert!(!d.waxing);
    }

    #[test]
    fn full_moon_180_elongation() {
        let d = moon_details_from_tropical_longitudes(0.0, 180.0);
        assert!((d.elongation_deg - 180.0).abs() < 1e-9);
        assert!((d.illuminated_fraction - 1.0).abs() < 1e-9);
        assert_eq!(d.phase_id, "full_moon");
        assert!(!d.waxing);
    }

    #[test]
    fn inject_fills_moon_details_from_positions_json() {
        let mut map = HashMap::from([
            (
                "positions".to_string(),
                serde_json::json!({ "sun": 0.0, "moon": 90.0 }),
            ),
        ]);
        inject_moon_details_into_chart_map(&mut map);
        let md = map.get("moon_details").and_then(|v| v.as_object()).expect("moon_details");
        assert_eq!(md.get("phase_id").and_then(|v| v.as_str()), Some("first_quarter"));
    }
}
