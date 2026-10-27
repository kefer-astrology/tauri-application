//! Applying / exact / separating and waxing / waning annotation for already-detected
//! aspects, from body longitudes and daily speeds.

use std::collections::HashMap;

use super::aspect_computation::ComputedAspect;
use super::geometry::{forward_arc, normalize_deg};

/// "Partile" tolerance: an aspect within one arc minute of exact counts as exact, so the
/// applying → exact → separating sequence covers the whole orb without a blind zone.
pub const EXACT_ASPECT_TOLERANCE_DEG: f64 = 1.0 / 60.0;

/// Bodies ordered from fastest to slowest mean geocentric motion. Synodic-cycle phase is
/// measured from the slower body to the faster one, so it needs a stable ranking that does not
/// flip during retrograde periods the way instantaneous speed would.
const MEAN_MOTION_ORDER: [&str; 11] = [
    "moon", "mercury", "venus", "sun", "mars", "jupiter", "saturn", "chiron", "uranus", "neptune",
    "pluto",
];

fn mean_motion_rank(id: &str) -> Option<usize> {
    MEAN_MOTION_ORDER
        .iter()
        .position(|candidate| *candidate == id)
}

/// Signed `to - from` separation in (-180, 180].
fn signed_separation(from_lon: f64, to_lon: f64) -> f64 {
    let difference = normalize_deg(to_lon - from_lon);
    if difference > 180.0 {
        difference - 360.0
    } else {
        difference
    }
}

/// `waxing` / `waning` half of the synodic cycle for a pair, or `None` without a mean-motion
/// rank for both bodies.
fn synodic_phase(from: &str, to: &str, positions: &HashMap<String, f64>) -> Option<&'static str> {
    let (from_rank, to_rank) = (mean_motion_rank(from)?, mean_motion_rank(to)?);
    let (fast, slow) = if from_rank < to_rank {
        (from, to)
    } else {
        (to, from)
    };
    let phase = forward_arc(*positions.get(slow)?, *positions.get(fast)?);
    Some(if phase < 180.0 { "waxing" } else { "waning" })
}

/// Fill `applying`, `separating`, `exact` and `phase` on every aspect. `speeds` holds daily
/// longitude speed per body id; bodies without a speed (e.g. axes) leave applying/separating
/// unset.
pub fn annotate_aspect_dynamics(
    aspects: &mut [ComputedAspect],
    positions: &HashMap<String, f64>,
    speeds: &HashMap<String, f64>,
) {
    for aspect in aspects.iter_mut() {
        let normalized_exact = if aspect.exact_angle > 180.0 {
            360.0 - aspect.exact_angle
        } else {
            aspect.exact_angle
        };
        aspect.exact = (aspect.angle - normalized_exact).abs() < EXACT_ASPECT_TOLERANCE_DEG;
        aspect.phase = synodic_phase(&aspect.from, &aspect.to, positions).map(str::to_string);
        aspect.applying = false;
        aspect.separating = false;
        if aspect.exact {
            continue;
        }

        let (Some(from_lon), Some(to_lon)) =
            (positions.get(&aspect.from), positions.get(&aspect.to))
        else {
            continue;
        };
        let (Some(from_speed), Some(to_speed)) = (speeds.get(&aspect.from), speeds.get(&aspect.to))
        else {
            continue;
        };
        let separation = signed_separation(*from_lon, *to_lon);
        // d|separation|/dt, then d(orb)/dt with orb = |separation| - exact.
        let angle_rate = separation.signum() * (to_speed - from_speed);
        let orb_rate = (aspect.angle - normalized_exact).signum() * angle_rate;
        if orb_rate < 0.0 {
            aspect.applying = true;
        } else if orb_rate > 0.0 {
            aspect.separating = true;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn aspect(
        from: &str,
        to: &str,
        aspect_type: &str,
        exact_angle: f64,
        angle: f64,
    ) -> ComputedAspect {
        ComputedAspect {
            from: from.to_string(),
            to: to.to_string(),
            aspect_type: aspect_type.to_string(),
            angle,
            orb: (angle - exact_angle).abs(),
            exact_angle,
            allowed_orb: 8.0,
            applying: false,
            separating: false,
            exact: false,
            phase: None,
        }
    }

    fn map(entries: &[(&str, f64)]) -> HashMap<String, f64> {
        entries
            .iter()
            .map(|(id, value)| (id.to_string(), *value))
            .collect()
    }

    #[test]
    fn faster_body_closing_on_a_conjunction_is_applying() {
        let positions = map(&[("moon", 10.0), ("saturn", 15.0)]);
        let speeds = map(&[("moon", 13.0), ("saturn", 0.03)]);
        let mut aspects = vec![aspect("moon", "saturn", "conjunction", 0.0, 5.0)];
        annotate_aspect_dynamics(&mut aspects, &positions, &speeds);
        assert!(aspects[0].applying && !aspects[0].separating && !aspects[0].exact);
        assert_eq!(aspects[0].phase.as_deref(), Some("waning"));
    }

    #[test]
    fn faster_body_past_a_square_is_separating_and_waxing() {
        // Moon 95° ahead of Sun: past the waxing square, orb widening.
        let positions = map(&[("sun", 0.0), ("moon", 95.0)]);
        let speeds = map(&[("sun", 1.0), ("moon", 13.0)]);
        let mut aspects = vec![aspect("moon", "sun", "square", 90.0, 95.0)];
        annotate_aspect_dynamics(&mut aspects, &positions, &speeds);
        assert!(aspects[0].separating && !aspects[0].applying);
        assert_eq!(aspects[0].phase.as_deref(), Some("waxing"));
    }

    #[test]
    fn within_one_arc_minute_is_exact_only() {
        let positions = map(&[("sun", 0.0), ("mars", 120.01)]);
        let speeds = map(&[("sun", 1.0), ("mars", 0.5)]);
        let mut aspects = vec![aspect("sun", "mars", "trine", 120.0, 120.01)];
        annotate_aspect_dynamics(&mut aspects, &positions, &speeds);
        assert!(aspects[0].exact && !aspects[0].applying && !aspects[0].separating);
    }

    #[test]
    fn missing_speed_leaves_dynamics_unknown() {
        let positions = map(&[("sun", 0.0), ("asc", 60.0)]);
        let speeds = map(&[("sun", 1.0)]);
        let mut aspects = vec![aspect("sun", "asc", "sextile", 60.0, 62.0)];
        annotate_aspect_dynamics(&mut aspects, &positions, &speeds);
        assert!(!aspects[0].applying && !aspects[0].separating);
        assert_eq!(aspects[0].phase, None);
    }
}
