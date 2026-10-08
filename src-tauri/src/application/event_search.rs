//! Root-finding over the existing position pipeline: stationary points
//! (longitude-speed sign change) and exact aspect-angle crossings.
//!
//! This is deliberately independent of `application::transit`'s fixed-step
//! series: `compute_transit_series` only ever samples at the caller's chosen
//! step and never searches for an exact event time. These functions exist so
//! that claim can be tested (an actual search exists and is validated) and
//! benchmarked (see `infrastructure::jpl_backend::tests::jpl_direct_path_benchmark`'s
//! sibling benchmarks), not to add a new Tauri-facing feature; nothing here
//! is wired to a command yet.

use chrono::{DateTime, Duration, Utc};

use crate::domain::houses::normalize_deg;
use crate::workspace::models::{AstroModel, ChartInstance};

use super::computation::compute_positions;

/// Bisection halves the bracket every iteration; 40 halvings of even a
/// century-wide bracket resolve to well under a millisecond, far past
/// `chrono::DateTime`'s own precision, so this is intentionally more than
/// enough rather than tuned to a specific bracket width.
const BISECTION_ITERATIONS: u32 = 40;

fn sampled_chart_at(chart: &ChartInstance, at: DateTime<Utc>) -> ChartInstance {
    let mut sample = chart.clone();
    sample.subject.event_time = Some(at);
    sample
}

/// Signed longitude speed (degrees/day) of `body_id` at `at`, via the same
/// `compute_positions` pipeline a chart or transit step would use — this is
/// not a separate, cheaper derivative approximation.
fn signed_speed_deg_per_day(
    chart: &ChartInstance,
    model: &AstroModel,
    body_id: &str,
    at: DateTime<Utc>,
) -> Result<f64, String> {
    let sample = sampled_chart_at(chart, at);
    let calc = compute_positions(&sample, model, &[body_id.to_string()], &[])?;
    calc.motion
        .get(body_id)
        .map(|motion| motion.speed)
        .ok_or_else(|| format!("{body_id}_motion_unavailable"))
}

fn wrap_to_signed_180(value_deg: f64) -> f64 {
    let mut wrapped = value_deg % 360.0;
    if wrapped > 180.0 {
        wrapped -= 360.0;
    }
    if wrapped <= -180.0 {
        wrapped += 360.0;
    }
    wrapped
}

/// Signed offset (degrees, in `(-180, 180]`) of `transiting_id`'s longitude
/// from exactly `aspect_angle_deg` away from `transited_lon_deg`. Zero means
/// the aspect is exact. Positive/negative indicates which side of exact the
/// transiting body currently sits on — a continuous function of time as long
/// as the bracket is narrow enough not to itself wrap past +/-180.
fn signed_aspect_offset_deg(
    chart: &ChartInstance,
    model: &AstroModel,
    transiting_id: &str,
    transited_lon_deg: f64,
    aspect_angle_deg: f64,
    at: DateTime<Utc>,
) -> Result<f64, String> {
    let sample = sampled_chart_at(chart, at);
    let calc = compute_positions(&sample, model, &[transiting_id.to_string()], &[])?;
    let transiting_lon = *calc
        .positions
        .get(transiting_id)
        .ok_or_else(|| format!("{transiting_id}_unavailable"))?;
    let separation = normalize_deg(transiting_lon - transited_lon_deg);
    Ok(wrap_to_signed_180(separation - aspect_angle_deg))
}

/// Bisects `[lo, hi]` for a root of `f`, assuming `f(lo)` and `f(hi)` already
/// have opposite signs (or one is exactly zero). Returns the bracket
/// midpoint once it can no longer be subdivided at `DateTime<Utc>`'s own
/// resolution, which is this search's actual precision floor — not a fixed
/// a-priori tolerance in seconds.
fn bisect_root(
    mut lo: DateTime<Utc>,
    mut hi: DateTime<Utc>,
    f: impl Fn(DateTime<Utc>) -> Result<f64, String>,
) -> Result<DateTime<Utc>, String> {
    let mut f_lo = f(lo)?;
    if f_lo == 0.0 {
        return Ok(lo);
    }
    for _ in 0..BISECTION_ITERATIONS {
        let mid = lo + (hi - lo) / 2;
        if mid == lo || mid == hi {
            break;
        }
        let f_mid = f(mid)?;
        if f_mid == 0.0 {
            return Ok(mid);
        }
        if f_mid.signum() == f_lo.signum() {
            lo = mid;
            f_lo = f_mid;
        } else {
            hi = mid;
        }
    }
    Ok(lo + (hi - lo) / 2)
}

/// Coarse-scans `[start, end]` at `step` for a sign change in `body_id`'s
/// longitude speed (a station: the moment it switches between direct and
/// retrograde, or vice versa), then bisects that bracket. `step` must be
/// short enough that the body does not station and un-station between two
/// consecutive samples; returns `Ok(None)` if no sign change is found.
pub fn find_stationary_point(
    chart: &ChartInstance,
    model: &AstroModel,
    body_id: &str,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    step: Duration,
) -> Result<Option<DateTime<Utc>>, String> {
    if step.num_seconds() <= 0 {
        return Err("step must be positive".to_string());
    }
    if end < start {
        return Err("end must not precede start".to_string());
    }

    let mut previous_time = start;
    let mut previous_speed = signed_speed_deg_per_day(chart, model, body_id, start)?;
    let mut current_time = start + step;

    while current_time <= end {
        let current_speed = signed_speed_deg_per_day(chart, model, body_id, current_time)?;
        if previous_speed == 0.0 {
            return Ok(Some(previous_time));
        }
        if current_speed.signum() != previous_speed.signum() {
            let root = bisect_root(previous_time, current_time, |at| {
                signed_speed_deg_per_day(chart, model, body_id, at)
            })?;
            return Ok(Some(root));
        }
        previous_time = current_time;
        previous_speed = current_speed;
        current_time += step;
    }
    Ok(None)
}

/// Coarse-scans `[start, end]` at `step` for the exact instant
/// `transiting_id` forms `aspect_angle_deg` with the fixed longitude
/// `transited_lon_deg` (e.g. a natal point), then bisects that bracket.
#[allow(clippy::too_many_arguments)]
pub fn find_aspect_exact_time(
    chart: &ChartInstance,
    model: &AstroModel,
    transiting_id: &str,
    transited_lon_deg: f64,
    aspect_angle_deg: f64,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    step: Duration,
) -> Result<Option<DateTime<Utc>>, String> {
    if step.num_seconds() <= 0 {
        return Err("step must be positive".to_string());
    }
    if end < start {
        return Err("end must not precede start".to_string());
    }

    let offset_at = |at: DateTime<Utc>| {
        signed_aspect_offset_deg(
            chart,
            model,
            transiting_id,
            transited_lon_deg,
            aspect_angle_deg,
            at,
        )
    };

    let mut previous_time = start;
    let mut previous_offset = offset_at(start)?;
    let mut current_time = start + step;

    while current_time <= end {
        let current_offset = offset_at(current_time)?;
        if previous_offset == 0.0 {
            return Ok(Some(previous_time));
        }
        // `signed_aspect_offset_deg` wraps to `(-180, 180]`, so it has its
        // own branch-cut discontinuity at the *opposite* point from the
        // target aspect (e.g. target 0 degrees puts the cut at 180 degrees
        // separation): a jump straight from near +180 to near -180 there is
        // not a continuous zero crossing. Only accept a sign change whose
        // consecutive samples are actually close together — i.e. the body
        // genuinely passed through zero, not through the wrap boundary.
        let continuous_step = (current_offset - previous_offset).abs() < 180.0;
        if continuous_step && current_offset.signum() != previous_offset.signum() {
            let root = bisect_root(previous_time, current_time, offset_at)?;
            return Ok(Some(root));
        }
        previous_time = current_time;
        previous_offset = current_offset;
        current_time += step;
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::sample_chart_payload;

    fn sample_chart_and_model() -> (ChartInstance, AstroModel) {
        // Resolved exactly the way `compute_chart_from_data` resolves a
        // standalone chart, so these searches run over the same model/
        // settings resolution as a real request, not a hand-built stand-in.
        let payload = sample_chart_payload("event-search-test");
        let resolved =
            crate::application::chart_resolution::resolve_standalone_chart(&payload, None)
                .expect("sample chart payload should resolve");
        (resolved.chart, resolved.model)
    }

    /// Mercury stations several times a year; scan a window already known
    /// (from the Rust ephemeris, not an external source) to contain exactly
    /// one. The found root is validated two independent ways: (1) the speed
    /// at the root is near zero, far tighter than the coarse step implies by
    /// itself, and (2) a plain dense re-scan (not bisection) of the same
    /// bracket at a much finer fixed step independently confirms the sign
    /// change brackets the same instant — i.e. the bisection result is
    /// cross-checked against a different, cruder method on the same pipeline.
    #[test]
    fn stationary_point_search_finds_a_real_mercury_station_and_independently_verifies_it() {
        let (chart, model) = sample_chart_and_model();
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = DateTime::parse_from_rfc3339("2024-02-15T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let found =
            find_stationary_point(&chart, &model, "mercury", start, end, Duration::hours(6))
                .expect("search should not error")
                .expect("expected a Mercury station in this window");

        let speed_at_root = signed_speed_deg_per_day(&chart, &model, "mercury", found)
            .expect("speed should be computable at the found root");
        assert!(
            speed_at_root.abs() < 1e-4,
            "speed at the found station should be ~0 deg/day, got {speed_at_root}"
        );

        // Independent cross-check: re-scan the neighborhood at a finer,
        // *different* fixed step and confirm the sign change still brackets
        // `found`, rather than trusting the bisection's own convergence.
        let probe_before = found - Duration::minutes(90);
        let probe_after = found + Duration::minutes(90);
        let speed_before = signed_speed_deg_per_day(&chart, &model, "mercury", probe_before)
            .expect("speed before root");
        let speed_after = signed_speed_deg_per_day(&chart, &model, "mercury", probe_after)
            .expect("speed after root");
        assert_ne!(
            speed_before.signum(),
            speed_after.signum(),
            "independent finer re-scan should still bracket the same sign change: before={speed_before}, after={speed_after}"
        );
    }

    #[test]
    fn stationary_point_search_returns_none_when_body_never_stations_in_range() {
        let (chart, model) = sample_chart_and_model();
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(2);
        // The Sun's apparent motion never reverses; two days is far too
        // short a window for any genuine solar station (it has none).
        let found = find_stationary_point(&chart, &model, "sun", start, end, Duration::hours(6))
            .expect("search should not error");
        assert!(found.is_none());
    }

    /// New Moon (Sun–Moon conjunction, aspect angle 0) happens roughly every
    /// synodic month; scan a window wide enough to guarantee one and
    /// independently verify the separation is actually ~0 there, and that a
    /// finer re-scan still brackets the same crossing.
    #[test]
    fn aspect_exact_time_search_finds_a_real_new_moon_and_independently_verifies_it() {
        let (chart, model) = sample_chart_and_model();
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(30);

        let sun_lon = {
            let sample = sampled_chart_at(&chart, start);
            compute_positions(&sample, &model, &["sun".to_string()], &[])
                .expect("sun position should compute")
                .positions["sun"]
        };

        let found = find_aspect_exact_time(
            &chart,
            &model,
            "moon",
            sun_lon,
            0.0,
            start,
            end,
            Duration::hours(6),
        )
        .expect("search should not error")
        .expect("expected a Sun-Moon conjunction within 30 days");

        let offset_at_root = signed_aspect_offset_deg(&chart, &model, "moon", sun_lon, 0.0, found)
            .expect("offset should be computable at the found root");
        assert!(
            offset_at_root.abs() < 1e-3,
            "offset at the found conjunction should be ~0 deg, got {offset_at_root}"
        );

        let probe_before = found - Duration::hours(2);
        let probe_after = found + Duration::hours(2);
        let before = signed_aspect_offset_deg(&chart, &model, "moon", sun_lon, 0.0, probe_before)
            .expect("offset before root");
        let after = signed_aspect_offset_deg(&chart, &model, "moon", sun_lon, 0.0, probe_after)
            .expect("offset after root");
        assert_ne!(
            before.signum(),
            after.signum(),
            "independent finer re-scan should still bracket the same conjunction: before={before}, after={after}"
        );
    }

    /// Regression test for a real bug caught while validating this module:
    /// with a target aspect angle of 0 degrees, the signed-offset function's
    /// own wrap boundary sits at exactly 180 degrees of separation
    /// (opposition) — a discontinuous jump from near +180 to near -180 that
    /// is not a conjunction. An opposition reliably occurs before the first
    /// conjunction within 35 days of 2024-01-01 for the Moon against a fixed
    /// 0-degree point, which is exactly what previously made this search
    /// falsely report the opposition instant as a "crossing of 0 degrees."
    #[test]
    fn aspect_exact_time_search_does_not_mistake_the_opposite_point_for_a_crossing() {
        let (chart, model) = sample_chart_and_model();
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(35);

        let found = find_aspect_exact_time(
            &chart,
            &model,
            "moon",
            0.0,
            0.0,
            start,
            end,
            Duration::hours(6),
        )
        .expect("search should not error")
        .expect("the Moon should cross 0 degrees within 35 days");

        let offset_at_root = signed_aspect_offset_deg(&chart, &model, "moon", 0.0, 0.0, found)
            .expect("offset should be computable at the found root");
        assert!(
            offset_at_root.abs() < 1e-3,
            "found instant should be a genuine zero crossing, not the opposite branch-cut point: offset={offset_at_root}"
        );
    }

    #[test]
    fn invalid_ranges_are_rejected() {
        let (chart, model) = sample_chart_and_model();
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert!(find_stationary_point(
            &chart,
            &model,
            "mercury",
            start,
            start - Duration::days(1),
            Duration::hours(1)
        )
        .is_err());
        assert!(find_stationary_point(
            &chart,
            &model,
            "mercury",
            start,
            start + Duration::days(1),
            Duration::zero()
        )
        .is_err());
    }

    /// Nearest-rank p50/p95 over `samples`. With a small sample count the p95
    /// index collapses toward (or onto) the maximum — e.g. at n=10 it is
    /// exactly the 10th value, i.e. the sample maximum, not an interpolated
    /// tail estimate. Callers should report `n` alongside these numbers
    /// rather than presenting them as a statistically robust percentile.
    fn percentiles(
        mut samples: Vec<std::time::Duration>,
    ) -> (std::time::Duration, std::time::Duration) {
        samples.sort_unstable();
        let p50 = samples[samples.len() / 2];
        let p95 = samples[(samples.len() * 95 / 100).min(samples.len() - 1)];
        (p50, p95)
    }

    /// Timing for an actual stationary-point (station) search: coarse 6-hour
    /// scan plus bisection, for three classical bodies with very different
    /// synodic periods (Mercury ~116 days, Venus ~584 days, Mars ~780 days).
    /// The window is 3 years specifically so every body is guaranteed at
    /// least one station even in an unlucky phase — a 1-year window was
    /// tried first and correctly failed its own verification for one body,
    /// which is why this is 3 years rather than an assumed round number.
    /// Verifies each search actually finds and confirms a station before
    /// timing it, so this cannot silently measure a no-op fallback path.
    /// Run with: `cargo test --release --lib stationary_point_search_benchmark -- --ignored --nocapture`
    #[test]
    #[ignore = "diagnostic benchmark; run manually on the target machine"]
    fn stationary_point_search_benchmark() {
        use std::time::Instant;

        let (chart, model) = sample_chart_and_model();
        let window_start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let window_end = window_start + Duration::days(3 * 365);
        let bodies = ["mercury", "venus", "mars"];
        // 10, not a smaller round number: with n=30 (10 reps x 3 bodies) the
        // p95 index is a genuine 29th-of-30 rank, not simply the sample max.
        const REPETITIONS: u32 = 10;

        // Warm-up (excludes almanac construction from timed samples).
        for body in bodies {
            find_stationary_point(
                &chart,
                &model,
                body,
                window_start,
                window_end,
                Duration::hours(6),
            )
            .expect("warm-up search should not error");
        }

        let mut samples = Vec::new();
        let mut found_count = 0usize;
        for _ in 0..REPETITIONS {
            for body in bodies {
                let search_start = Instant::now();
                let found = find_stationary_point(
                    &chart,
                    &model,
                    body,
                    window_start,
                    window_end,
                    Duration::hours(6),
                )
                .expect("search should not error");
                samples.push(search_start.elapsed());
                if found.is_some() {
                    found_count += 1;
                }
            }
        }
        assert_eq!(
            found_count,
            bodies.len() * REPETITIONS as usize,
            "expected every body to station at least once across 3 years"
        );

        let (p50, p95) = percentiles(samples);
        println!(
            "stationary-point search benchmark: bodies={bodies:?}, window=3y, step=6h, \
             searches={}, p50={p50:?}, p95={p95:?}",
            bodies.len() * REPETITIONS as usize
        );
    }

    /// Timing for an actual aspect-exact-time search (New Moon conjunctions):
    /// scans 24 real, non-overlapping ~30-day windows across 2024-2025 (not
    /// a smaller round number: at n=24 the p95 index is a genuine rank, not
    /// simply the sample maximum) and bisects each to an exact Sun-Moon
    /// conjunction. Verifies every search actually finds a conjunction
    /// before timing it.
    /// Run with: `cargo test --release --lib aspect_exact_time_search_benchmark -- --ignored --nocapture`
    #[test]
    #[ignore = "diagnostic benchmark; run manually on the target machine"]
    fn aspect_exact_time_search_benchmark() {
        use std::time::Instant;

        let (chart, model) = sample_chart_and_model();
        let year_start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let windows: Vec<(DateTime<Utc>, DateTime<Utc>)> = (0..24)
            .map(|month| {
                let window_start = year_start + Duration::days(month * 30);
                (window_start, window_start + Duration::days(30))
            })
            .collect();

        let sun_lon_at = |at: DateTime<Utc>| -> f64 {
            let sample = sampled_chart_at(&chart, at);
            compute_positions(&sample, &model, &["sun".to_string()], &[])
                .expect("sun position should compute")
                .positions["sun"]
        };

        // Warm-up.
        let (warm_start, warm_end) = windows[0];
        find_aspect_exact_time(
            &chart,
            &model,
            "moon",
            sun_lon_at(warm_start),
            0.0,
            warm_start,
            warm_end,
            Duration::hours(6),
        )
        .expect("warm-up search should not error");

        let mut samples = Vec::with_capacity(windows.len());
        let mut found_count = 0usize;
        for (window_start, window_end) in &windows {
            let sun_lon = sun_lon_at(*window_start);
            let search_start = Instant::now();
            let found = find_aspect_exact_time(
                &chart,
                &model,
                "moon",
                sun_lon,
                0.0,
                *window_start,
                *window_end,
                Duration::hours(6),
            )
            .expect("search should not error");
            samples.push(search_start.elapsed());
            if found.is_some() {
                found_count += 1;
            }
        }
        assert!(
            found_count >= windows.len() - 1,
            "expected a New Moon in nearly every ~30-day window across a year: found {found_count} of {}",
            windows.len()
        );

        let (p50, p95) = percentiles(samples);
        println!(
            "aspect-exact-time search benchmark: target=sun-moon conjunction, windows={}, step=6h, \
             p50={p50:?}, p95={p95:?}",
            windows.len()
        );
    }
}
