//! Midpoint geometry — the point halfway between two objects' ecliptic longitudes, on the
//! shorter arc, plus its antipode 180° away (together, an axis).
//!
//! Deliberately has zero dependency on aspect/orb machinery (`domain::astrology`): this module
//! only ever answers "where is the midpoint," never "what aspects it" — that's
//! `domain::astrology::compute_midpoint_contacts`, a separate pass over this module's output.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use super::houses::normalize_deg;

/// How close to exactly 180° apart two source longitudes must be for their midpoint to be
/// reported as ambiguous. Loose enough to absorb ordinary floating-point noise from ephemeris
/// sampling, tight enough that no genuine near-opposition (which does have a well-defined
/// shorter arc) is misclassified.
const OPPOSITION_TOLERANCE_DEG: f64 = 1e-6;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Midpoint {
    pub object_a: String,
    pub object_b: String,
    /// `None` for an ad-hoc/unsaved computation; present when the midpoint belongs to a
    /// specific stored chart.
    pub chart_id: Option<String>,
    /// The midpoint on the shorter arc between `object_a` and `object_b`, normalized [0, 360).
    pub position: f64,
    /// The antipode, `position + 180`, normalized [0, 360) — together with `position`, the axis.
    pub opposite: f64,
    /// True when `object_a`/`object_b` are ~180° apart (within [`OPPOSITION_TOLERANCE_DEG`]):
    /// both arcs between them are equal length, so "the shorter arc" is not well-defined.
    /// `position`/`opposite` are still both populated — deterministically, from the formula
    /// below — just not distinguishable as "the" shorter-arc pick in this case.
    pub ambiguous: bool,
}

/// Signed shortest angular step from `a` to `b`, in `(-180, 180]`. Positive means `b` is reached
/// by moving forward (increasing longitude) from `a` along the shorter arc.
fn signed_shortest_arc_deg(a: f64, b: f64) -> f64 {
    let mut delta = normalize_deg(b) - normalize_deg(a);
    if delta > 180.0 {
        delta -= 360.0;
    } else if delta <= -180.0 {
        delta += 360.0;
    }
    delta
}

/// The midpoint of two longitudes on their shorter arc, its antipode, and whether the two
/// inputs are ~180° apart (see [`Midpoint::ambiguous`]). Order-independent *by construction*:
/// the two normalized inputs are sorted into a canonical `(lo, hi)` pair before any arithmetic,
/// so `compute_midpoint(a, b)` and `compute_midpoint(b, a)` always evaluate the identical
/// expression — this matters specifically at the exact-opposition tie, where naively computing
/// the signed shortest arc from whichever input happened to be "first" picks one of the two
/// equally-valid 180°-apart results depending on call order; sorting first removes that
/// dependency entirely rather than special-casing the tie.
///
/// Worked example from the spec: `compute_midpoint(350.0, 10.0)` → `(0.0, 180.0, false)` — the
/// shorter arc from 350° to 10° crosses the 0°/360° boundary, landing the midpoint exactly at 0°.
pub fn compute_midpoint(a_deg: f64, b_deg: f64) -> (f64, f64, bool) {
    let a = normalize_deg(a_deg);
    let b = normalize_deg(b_deg);
    let (lo, hi) = if a <= b { (a, b) } else { (b, a) };
    let delta = signed_shortest_arc_deg(lo, hi);
    let position = normalize_deg(lo + delta / 2.0);
    let opposite = normalize_deg(position + 180.0);
    let ambiguous = (delta.abs() - 180.0).abs() < OPPOSITION_TOLERANCE_DEG;
    (position, opposite, ambiguous)
}

/// Every midpoint among the given object ids (unordered, distinct pairs only — `n` ids produce
/// `n*(n-1)/2` midpoints). Ids without an entry in `positions` are silently skipped (consistent
/// with how `compute_chart_aspects` treats unresolvable ids). Pairs are emitted in canonical
/// alphabetical `(object_a, object_b)` order regardless of `object_ids`' own order, so storage
/// and display are deterministic no matter how the caller selected objects.
pub fn compute_midpoints(
    positions: &HashMap<String, f64>,
    object_ids: &[String],
    chart_id: Option<&str>,
) -> Vec<Midpoint> {
    let mut ids: Vec<&String> = object_ids
        .iter()
        .filter(|id| positions.contains_key(id.as_str()))
        .collect();
    ids.sort();
    ids.dedup();

    let mut midpoints = Vec::new();
    for (index, object_a) in ids.iter().enumerate() {
        for object_b in ids.iter().skip(index + 1) {
            let a_lon = positions[object_a.as_str()];
            let b_lon = positions[object_b.as_str()];
            let (position, opposite, ambiguous) = compute_midpoint(a_lon, b_lon);
            midpoints.push(Midpoint {
                object_a: (*object_a).clone(),
                object_b: (*object_b).clone(),
                chart_id: chart_id.map(str::to_string),
                position,
                opposite,
                ambiguous,
            });
        }
    }
    midpoints
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinary_pair_midpoint_is_the_simple_average() {
        let (position, opposite, ambiguous) = compute_midpoint(10.0, 50.0);
        assert!((position - 30.0).abs() < 1e-9, "position={position}");
        assert!((opposite - 210.0).abs() < 1e-9, "opposite={opposite}");
        assert!(!ambiguous);
    }

    #[test]
    fn wraparound_across_zero_degrees_lands_on_the_shorter_arc() {
        // Spec's worked example: shorter arc from 350° to 10° crosses the 0°/360° boundary.
        let (position, opposite, ambiguous) = compute_midpoint(350.0, 10.0);
        assert!((position - 0.0).abs() < 1e-9, "position={position}");
        assert!((opposite - 180.0).abs() < 1e-9, "opposite={opposite}");
        assert!(!ambiguous);
    }

    #[test]
    fn reversed_inputs_produce_the_identical_pair() {
        let forward = compute_midpoint(350.0, 10.0);
        let reversed = compute_midpoint(10.0, 350.0);
        assert!((forward.0 - reversed.0).abs() < 1e-9);
        assert!((forward.1 - reversed.1).abs() < 1e-9);
        assert_eq!(forward.2, reversed.2);

        let forward2 = compute_midpoint(10.0, 50.0);
        let reversed2 = compute_midpoint(50.0, 10.0);
        assert!((forward2.0 - reversed2.0).abs() < 1e-9);
        assert!((forward2.1 - reversed2.1).abs() < 1e-9);
    }

    #[test]
    fn identical_longitudes_midpoint_is_that_same_longitude() {
        let (position, opposite, ambiguous) = compute_midpoint(123.45, 123.45);
        assert!((position - 123.45).abs() < 1e-9, "position={position}");
        assert!((opposite - 303.45).abs() < 1e-9, "opposite={opposite}");
        assert!(!ambiguous);
    }

    #[test]
    fn exact_opposition_is_reported_ambiguous_with_both_positions_populated() {
        let (position, opposite, ambiguous) = compute_midpoint(0.0, 180.0);
        assert!(ambiguous);
        // Still a well-defined, order-independent pair — just not distinguishable as "the"
        // shorter-arc pick, since both arcs are exactly 180° long.
        assert!((opposite - normalize_deg(position + 180.0)).abs() < 1e-9);
        let swapped = compute_midpoint(180.0, 0.0);
        assert!((position - swapped.0).abs() < 1e-9);
        assert!((opposite - swapped.1).abs() < 1e-9);
        assert!(swapped.2);
    }

    #[test]
    fn near_but_not_quite_opposition_is_not_ambiguous() {
        let (_, _, ambiguous) = compute_midpoint(0.0, 179.9);
        assert!(!ambiguous);
    }

    #[test]
    fn compute_midpoints_emits_every_unordered_pair_in_canonical_order() {
        let positions: HashMap<String, f64> = [
            ("sun".to_string(), 10.0),
            ("moon".to_string(), 50.0),
            ("venus".to_string(), 100.0),
        ]
        .into_iter()
        .collect();
        let ids = vec!["moon".to_string(), "sun".to_string(), "venus".to_string()];
        let midpoints = compute_midpoints(&positions, &ids, Some("chart-1"));

        assert_eq!(midpoints.len(), 3, "3 objects -> C(3,2) = 3 midpoints");
        let pairs: Vec<(String, String)> = midpoints
            .iter()
            .map(|m| (m.object_a.clone(), m.object_b.clone()))
            .collect();
        assert!(pairs.contains(&("moon".to_string(), "sun".to_string())));
        assert!(pairs.contains(&("moon".to_string(), "venus".to_string())));
        assert!(pairs.contains(&("sun".to_string(), "venus".to_string())));
        assert!(midpoints.iter().all(|m| m.chart_id.as_deref() == Some("chart-1")));
    }

    #[test]
    fn compute_midpoints_skips_ids_with_no_known_position() {
        let positions: HashMap<String, f64> =
            [("sun".to_string(), 10.0)].into_iter().collect();
        let ids = vec!["sun".to_string(), "unknown".to_string()];
        let midpoints = compute_midpoints(&positions, &ids, None);
        assert!(midpoints.is_empty(), "only one resolvable id -> no pairs");
    }
}
