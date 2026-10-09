//! Root-finding over the existing position pipeline: stationary points
//! (longitude-speed sign change) and exact aspect-angle crossings.
//!
//! This is deliberately independent of `application::transit`'s fixed-step
//! series: `compute_transit_series` only ever samples at the caller's chosen
//! step and never searches for an exact event time itself. The single-result
//! `find_stationary_point`/`find_aspect_exact_time` functions are internal
//! reference implementations, validated directly by this module's own tests
//! and benchmarked alongside
//! `infrastructure::jpl_backend::tests::jpl_direct_path_benchmark`'s sibling
//! benchmarks; neither is reachable from production code (both are
//! `#[cfg(test)]`-only), so compare each against the complete-interval
//! `find_all_*` counterpart it mirrors before changing either.
//!
//! The complete-interval `find_all_*` functions below them (and the
//! `discover_roots` scan they share) *are* reachable from a Tauri command,
//! through `application::transit::compute_transit_events` — wired to
//! `compute_transit_series`/`compute_transit_series_from_data` via the
//! persisted `exact_hits`/`station_events` request flags. See the
//! [transit-series contract](../../../../docs/content/developer/transit-series-contract.md)
//! for that contract and
//! [ephemeris-validation](../../../../docs/content/developer/ephemeris-validation.md#event-search-stationary-points-and-exact-aspect-times)
//! for measured performance and stated discovery limitations.

use chrono::{DateTime, Duration, Utc};

use crate::domain::houses::normalize_deg;

use super::evaluation_context::EvaluationContext;

/// Bisection halves the bracket every iteration; 40 halvings of even a
/// century-wide bracket resolve to well under a millisecond, far past
/// `chrono::DateTime`'s own precision, so this is intentionally more than
/// enough rather than tuned to a specific bracket width.
const BISECTION_ITERATIONS: u32 = 40;

/// Signed longitude speed (degrees/day) of `body_id` at `at`, via the same
/// position pipeline a chart or transit step would use — this is not a
/// separate, cheaper derivative approximation. Evaluated (and, within one
/// request, cached) through `ctx` — see `evaluation_context::EvaluationContext`.
fn signed_speed_deg_per_day(
    ctx: &EvaluationContext,
    body_id: &str,
    at: DateTime<Utc>,
) -> Result<f64, String> {
    let (_longitude, motion) = ctx.longitude_and_motion(body_id, at)?;
    Ok(motion.speed)
}

pub(crate) fn wrap_to_signed_180(value_deg: f64) -> f64 {
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
pub(crate) fn signed_aspect_offset_deg(
    ctx: &EvaluationContext,
    transiting_id: &str,
    transited_lon_deg: f64,
    aspect_angle_deg: f64,
    at: DateTime<Utc>,
) -> Result<f64, String> {
    let transiting_lon = ctx.longitude(transiting_id, at)?;
    let separation = normalize_deg(transiting_lon - transited_lon_deg);
    Ok(wrap_to_signed_180(separation - aspect_angle_deg))
}

/// Same signed-offset quantity as [`signed_aspect_offset_deg`], but for two
/// bodies that *both* move (a moving-vs-moving mutual aspect) rather than
/// one moving body against a fixed radix longitude. Both positions are
/// requested in a single `compute_positions` call rather than two, since
/// they are sampled at the same instant anyway.
pub(crate) fn signed_mutual_aspect_offset_deg(
    ctx: &EvaluationContext,
    from_id: &str,
    to_id: &str,
    aspect_angle_deg: f64,
    at: DateTime<Utc>,
) -> Result<f64, String> {
    let lons = ctx.longitudes(&[from_id, to_id], at)?;
    let from_lon = *lons
        .get(from_id)
        .ok_or_else(|| format!("{from_id}_unavailable"))?;
    let to_lon = *lons
        .get(to_id)
        .ok_or_else(|| format!("{to_id}_unavailable"))?;
    let separation = normalize_deg(from_lon - to_lon);
    Ok(wrap_to_signed_180(separation - aspect_angle_deg))
}

/// `is_continuous_pair` for any quantity produced by [`wrap_to_signed_180`]:
/// rejects a sample-to-sample jump that is itself evidence of having
/// crossed the wrap boundary (at the point diametrically opposite the
/// target angle) rather than the target angle itself. See
/// `find_aspect_exact_time`'s own identical guard for the reasoning and the
/// regression this guards against.
fn is_continuous_signed_angle(a: f64, b: f64) -> bool {
    (a - b).abs() < 180.0
}

/// Explicit, finite bound on event-search work. There is no cancellation
/// primitive elsewhere in this codebase for a long-running Tauri command —
/// the frontend's "cancelled" flags (e.g. `transits-workspace.tsx`) only
/// ignore a stale response locally, after the fact. A hard, explicit probe
/// budget is this project's existing equivalent for bounding worst-case work
/// (compare `MAX_TRANSIT_STEPS` in `application::transit`): exhausting it is
/// a reported, visible condition — [`EventSearchOutcome::complete`] — never
/// a silent truncation.
#[derive(Debug, Clone, Copy)]
pub struct EventSearchLimits {
    /// Total position/motion evaluations one discovery call may spend.
    pub max_probes: u32,
    /// Recursion budget spent resolving a window *already known* (by the
    /// intermediate value theorem) to contain at least one root — i.e.
    /// separating however many distinct crossings a single coarse window
    /// actually holds (the repeated-retrograde-crossing shape). This is not
    /// "wasted" probing: every level here is spent on confirmed structure,
    /// and real crossing counts within one coarse window are small (a full
    /// retrograde loop is at most 3), so this can be generous without
    /// materially affecting typical cost.
    pub confirmed_subdivision_budget: u32,
    /// Recursion budget spent checking whether a window whose endpoints
    /// *agree* in sign might still hide an even number of crossings (e.g. a
    /// retrograde dip that both enters and exits inside one coarse step).
    /// Deliberately small and separate from `confirmed_subdivision_budget`:
    /// every level here is speculative (no confirmed structure justifies
    /// it yet), so it directly multiplies the cost of every coarse window
    /// in the *entire* search range, not just the ones near real events.
    /// See [`discover_roots`] for what this budget does and does not
    /// guarantee once exhausted.
    pub speculative_subdivision_budget: u32,
}

impl Default for EventSearchLimits {
    fn default() -> Self {
        Self {
            max_probes: 20_000,
            confirmed_subdivision_budget: 10,
            speculative_subdivision_budget: 2,
        }
    }
}

/// Result of a complete-interval discovery call.
#[derive(Debug, Clone, Default)]
pub struct EventSearchOutcome {
    /// Every root found, in chronological order.
    pub roots: Vec<DateTime<Utc>>,
    /// `false` means the probe budget was exhausted before every coarse
    /// window (and every subdivision within it) could be checked — `roots`
    /// is then a partial, *not* a complete, result. Never interpret an empty
    /// `roots` with `complete: false` as "no events in range."
    pub complete: bool,
}

struct ProbeBudget {
    remaining: u32,
}

impl ProbeBudget {
    fn spend(&mut self, n: u32) -> bool {
        if self.remaining < n {
            self.remaining = 0;
            false
        } else {
            self.remaining -= n;
            true
        }
    }
}

/// Coarse-scans `[start, end]` at `coarse_step` for every sign change of `f`,
/// bisecting each into a root. Unlike a naive "sign differs between
/// consecutive coarse samples" scan, a same-sign coarse window is not
/// immediately accepted as root-free: its midpoint is also probed, and if
/// the midpoint's sign disagrees with the (matching) endpoints, the window
/// is recursively split and each half re-examined the same way, up to
/// `limits.max_subdivision_depth`. This catches a pair (or, at deeper
/// recursion, more) of crossings hidden inside one coarse step — e.g. a
/// retrograde loop that enters and exits the same target value faster than
/// the coarse grid alone would resolve.
///
/// `is_continuous_pair(a, b)` must return `false` when a sign difference
/// between two samples reflects a wrapped branch-cut artifact rather than a
/// genuine crossing (see `signed_aspect_offset_deg`'s own wrap boundary);
/// pass `|_, _| true` for a quantity that never wraps (e.g. longitude
/// speed).
///
/// # Completeness limitations (deliberately not hidden)
///
/// - An even number of crossings positioned symmetrically enough to also
///   fool the midpoint check at the deepest permitted recursion level is not
///   detected. Deeper `max_subdivision_depth` makes this strictly less
///   likely but never impossible for an adversarial function.
/// - A tangential contact — `f` touches zero and recedes without actually
///   changing sign — is fundamentally invisible to any sign-based method,
///   at any recursion depth. This is a known, stated gap: detecting it
///   would need a separate local-extremum search, not implemented here.
/// - Coarse windows are still examined independently; this is sampled
///   validation of each resulting bracket (confirmed by one bisection /
///   subdivision pass), not an exhaustive continuous proof — see
///   `ephemeris-validation.md` for the same distinction drawn for usable
///   coverage.
fn discover_roots(
    f: &impl Fn(DateTime<Utc>) -> Result<f64, String>,
    is_continuous_pair: impl Fn(f64, f64) -> bool,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    coarse_step: Duration,
    limits: EventSearchLimits,
) -> Result<EventSearchOutcome, String> {
    if coarse_step.num_seconds() <= 0 {
        return Err("step must be positive".to_string());
    }
    if end < start {
        return Err("end must not precede start".to_string());
    }

    let mut budget = ProbeBudget {
        remaining: limits.max_probes,
    };
    let mut roots = Vec::new();

    if !budget.spend(1) {
        return Ok(EventSearchOutcome {
            roots,
            complete: false,
        });
    }
    let mut previous_time = start;
    let mut previous_value = f(start)?;
    if previous_value == 0.0 {
        roots.push(previous_time);
    }
    let mut current_time = start + coarse_step;
    let mut complete = true;

    while current_time <= end {
        if !budget.spend(1) {
            complete = false;
            break;
        }
        let current_value = f(current_time)?;

        if current_value == 0.0 {
            roots.push(current_time);
        } else if previous_value != 0.0 {
            if !resolve_window(
                f,
                &is_continuous_pair,
                previous_time,
                current_time,
                previous_value,
                current_value,
                limits.confirmed_subdivision_budget,
                limits.speculative_subdivision_budget,
                &mut budget,
                &mut roots,
            )? {
                complete = false;
                break;
            }
        }

        previous_time = current_time;
        previous_value = current_value;
        current_time += coarse_step;
    }

    Ok(EventSearchOutcome { roots, complete })
}

/// Resolves one window `[lo, hi]` (`f_lo`/`f_hi` already sampled) into zero
/// or more roots, using two separate recursion budgets so the common case
/// (a quiet window, nothing happening) stays cheap while a window with
/// known structure still gets a generous effort to fully separate it.
///
/// A window whose endpoints differ in sign (and are not merely a wrapped
/// branch-cut jump — see `is_continuous_pair`) is guaranteed by the
/// intermediate value theorem to contain at least one root — but may
/// contain an odd number *greater* than one (the canonical
/// repeated-retrograde-crossing shape: approach, cross back during
/// retrograde, cross again resuming direct motion), which also presents as
/// a simple confirmed difference at the window's own endpoints. Resolving
/// this fully spends `confirmed_budget`, decremented only on the side(s)
/// that remain confirmed after each split — generous by default, since real
/// crossing counts within one coarse window are small and each split
/// roughly halves the remaining window.
///
/// A window whose endpoints agree in sign (or whose disagreement
/// `is_continuous_pair` rejects as a wrap artifact) might still hide an
/// *even* number of real crossings — e.g. a retrograde dip that both enters
/// and exits inside one coarse step. Checking for this is purely
/// speculative (nothing confirms it yet), so it spends the separate,
/// deliberately small `speculative_budget` instead: this bounds how hard
/// *every* quiet window in the entire range is searched for a hidden pair,
/// independent of how much work a genuinely eventful window elsewhere is
/// allowed to spend.
///
/// Returns `Ok(false)` (not an `Err`) when the probe budget runs out
/// partway, so the caller marks the overall result incomplete rather than
/// treating budget exhaustion as a hard search failure.
#[allow(clippy::too_many_arguments)]
fn resolve_window(
    f: &impl Fn(DateTime<Utc>) -> Result<f64, String>,
    is_continuous_pair: &impl Fn(f64, f64) -> bool,
    lo: DateTime<Utc>,
    hi: DateTime<Utc>,
    f_lo: f64,
    f_hi: f64,
    confirmed_budget: u32,
    speculative_budget: u32,
    budget: &mut ProbeBudget,
    roots: &mut Vec<DateTime<Utc>>,
) -> Result<bool, String> {
    let confirmed = is_continuous_pair(f_lo, f_hi) && f_lo.signum() != f_hi.signum();

    let out_of_budget_for_this_window = if confirmed {
        confirmed_budget == 0
    } else {
        speculative_budget == 0
    };
    if out_of_budget_for_this_window {
        if confirmed {
            if !budget.spend(BISECTION_ITERATIONS) {
                return Ok(false);
            }
            roots.push(bisect_root(lo, hi, f)?);
        }
        // Not confirmed and out of speculative budget: per the documented
        // completeness limitation, treated as root-free rather than
        // searched further.
        return Ok(true);
    }

    if !budget.spend(1) {
        return Ok(false);
    }
    let mid = lo + (hi - lo) / 2;
    if mid == lo || mid == hi {
        // Cannot subdivide further at `DateTime<Utc>`'s own resolution.
        if confirmed {
            if !budget.spend(BISECTION_ITERATIONS) {
                return Ok(false);
            }
            roots.push(bisect_root(lo, hi, f)?);
        }
        return Ok(true);
    }
    let f_mid = f(mid)?;
    if f_mid == 0.0 {
        roots.push(mid);
        return Ok(true);
    }

    let left_confirmed = is_continuous_pair(f_lo, f_mid) && f_lo.signum() != f_mid.signum();
    let right_confirmed = is_continuous_pair(f_mid, f_hi) && f_mid.signum() != f_hi.signum();

    // Each half spends `confirmed_budget` only if *it* is confirmed, and
    // `speculative_budget` only if it is not — so confirmed structure on
    // one side never has its generous budget drained by speculative
    // checking on the other, and vice versa.
    if (left_confirmed || speculative_budget > 0)
        && !resolve_window(
            f,
            is_continuous_pair,
            lo,
            mid,
            f_lo,
            f_mid,
            if left_confirmed {
                confirmed_budget.saturating_sub(1)
            } else {
                confirmed_budget
            },
            if left_confirmed {
                speculative_budget
            } else {
                speculative_budget.saturating_sub(1)
            },
            budget,
            roots,
        )?
    {
        return Ok(false);
    }
    if (right_confirmed || speculative_budget > 0)
        && !resolve_window(
            f,
            is_continuous_pair,
            mid,
            hi,
            f_mid,
            f_hi,
            if right_confirmed {
                confirmed_budget.saturating_sub(1)
            } else {
                confirmed_budget
            },
            if right_confirmed {
                speculative_budget
            } else {
                speculative_budget.saturating_sub(1)
            },
            budget,
            roots,
        )?
    {
        return Ok(false);
    }
    Ok(true)
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
#[cfg(test)]
pub(crate) fn find_stationary_point(
    ctx: &EvaluationContext,
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
    let mut previous_speed = signed_speed_deg_per_day(ctx, body_id, start)?;
    let mut current_time = start + step;

    while current_time <= end {
        let current_speed = signed_speed_deg_per_day(ctx, body_id, current_time)?;
        if previous_speed == 0.0 {
            return Ok(Some(previous_time));
        }
        if current_speed.signum() != previous_speed.signum() {
            let root = bisect_root(previous_time, current_time, |at| {
                signed_speed_deg_per_day(ctx, body_id, at)
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
#[cfg(test)]
#[allow(clippy::too_many_arguments)]
pub(crate) fn find_aspect_exact_time(
    ctx: &EvaluationContext,
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
        signed_aspect_offset_deg(ctx, transiting_id, transited_lon_deg, aspect_angle_deg, at)
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

/// Conservative default discovery step for *all* complete-interval event
/// searches below, deliberately independent of any caller-supplied graph
/// sampling resolution (a transit series' `time_step_seconds`): it is
/// chosen from how fast this application's supported bodies can actually
/// move, not from what a chart's plotted-point density happens to be.
///
/// The fastest body is the Moon at roughly 13-15 deg/day; the narrowest
/// window between two genuinely distinct crossings in the canonical
/// "repeated retrograde crossing" shape (approach, cross back during
/// retrograde, cross again resuming direct motion) is bounded below by a
/// station-to-station duration, which for the *fastest-stationing* body
/// this application computes (Mercury) is on the order of three weeks
/// (`stationary_point_search_benchmark` locates real examples). Six hours
/// is therefore a large safety margin, not a tight bound: there is no
/// currently-supported body whose motion could hide two of its own
/// genuinely distinct crossings inside a single six-hour window. This is a
/// stated assumption, not a proven universal bound — an arbitrary
/// hypothetical very-fast-moving body is out of scope; see
/// `discover_roots`'s own completeness notes for what the adaptive
/// subdivision on top of this step additionally covers.
pub const DEFAULT_EVENT_DISCOVERY_STEP_SECONDS: i64 = 6 * 3600;

/// All stationary points (station events) for `body_id` within
/// `[start, end]` — the complete-interval counterpart to
/// [`find_stationary_point`], built on the same validated primitives
/// (`signed_speed_deg_per_day`, `bisect_root`) but via [`discover_roots`]
/// instead of "stop at the first sign change."
pub fn find_all_stationary_points(
    ctx: &EvaluationContext,
    body_id: &str,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    discovery_step: Duration,
    limits: EventSearchLimits,
) -> Result<EventSearchOutcome, String> {
    let f = |at: DateTime<Utc>| signed_speed_deg_per_day(ctx, body_id, at);
    discover_roots(&f, |_, _| true, start, end, discovery_step, limits)
}

/// All exact times `transiting_id` forms `aspect_angle_deg` with the fixed
/// longitude `transited_lon_deg` within `[start, end]` — the
/// complete-interval counterpart to [`find_aspect_exact_time`]. This
/// resolves only the *one* signed target angle passed in; a non-symmetric
/// aspect (any angle other than 0 or 180 degrees) has two geometrically
/// distinct exact longitudes — `transited_lon_deg + aspect_angle_deg` and
/// `transited_lon_deg - aspect_angle_deg` — and a caller wanting both must
/// call this twice. This function does not pick that interpretation for the
/// caller, so the choice is never silently made for it.
#[allow(clippy::too_many_arguments)]
pub fn find_all_aspect_exact_times_against_fixed_point(
    ctx: &EvaluationContext,
    transiting_id: &str,
    transited_lon_deg: f64,
    aspect_angle_deg: f64,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    discovery_step: Duration,
    limits: EventSearchLimits,
) -> Result<EventSearchOutcome, String> {
    let f = |at: DateTime<Utc>| {
        signed_aspect_offset_deg(ctx, transiting_id, transited_lon_deg, aspect_angle_deg, at)
    };
    discover_roots(
        &f,
        is_continuous_signed_angle,
        start,
        end,
        discovery_step,
        limits,
    )
}

/// All exact times `from_id` and `to_id` (both moving) form
/// `aspect_angle_deg` within `[start, end]` — the moving-vs-moving
/// counterpart to [`find_all_aspect_exact_times_against_fixed_point`]. Same
/// two-branch caveat applies for a non-symmetric angle.
#[allow(clippy::too_many_arguments)]
pub fn find_all_mutual_aspect_exact_times(
    ctx: &EvaluationContext,
    from_id: &str,
    to_id: &str,
    aspect_angle_deg: f64,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    discovery_step: Duration,
    limits: EventSearchLimits,
) -> Result<EventSearchOutcome, String> {
    let f = |at: DateTime<Utc>| {
        signed_mutual_aspect_offset_deg(ctx, from_id, to_id, aspect_angle_deg, at)
    };
    discover_roots(
        &f,
        is_continuous_signed_angle,
        start,
        end,
        discovery_step,
        limits,
    )
}

// ─── Tangential contacts ─────────────────────────────────────────────────
//
// A tangential contact is a value that grazes zero (touches it or comes
// within a small tolerance) at a local extremum, without actually changing
// sign on either side — fundamentally invisible to `discover_roots`' own
// sign-based method (see its documented completeness limitation). This is a
// *separate*, independent linear scan, not an extension of `discover_roots`
// itself: it never reports a candidate whose bracket already contains a
// genuine sign disagreement (that is `discover_roots`' job), so the two
// scans' results never overlap or double-count the same instant.

const GOLDEN_SECTION_ITERATIONS: u32 = 40;

/// Below this magnitude, a local extremum that doesn't cross zero is a
/// tangential station candidate — the same numeric bar this module's own
/// tests already use to call a *real* station's speed "converged" (see
/// `find_all_stationary_points_finds_every_mercury_station_in_a_full_year`'s
/// `speed.abs() < 1e-3` assertion), reused here rather than an independently
/// chosen number.
pub const STATION_TANGENTIAL_TOLERANCE_DEG_PER_DAY: f64 = 1e-3;

/// Same role as [`STATION_TANGENTIAL_TOLERANCE_DEG_PER_DAY`], for aspect
/// offset tangential contacts (degrees).
pub const ASPECT_TANGENTIAL_TOLERANCE_DEG: f64 = 1e-3;

fn interpolate_datetime(lo: DateTime<Utc>, hi: DateTime<Utc>, fraction: f64) -> DateTime<Utc> {
    let span_ns = (hi - lo).num_nanoseconds().unwrap_or(0) as f64;
    lo + Duration::nanoseconds((span_ns * fraction).round() as i64)
}

/// Bounded golden-section search minimizing `|f|` over `[lo, hi]`, assuming
/// local unimodality of `|f|` within this bracket (`[`find_tangential_contacts`]'s
/// only caller passes its 3-point window's first and last samples, i.e. a
/// bracket spanning *two* coarse steps, not one) — a much weaker assumption
/// than global unimodality over an entire search range (compare the best-fit
/// search in `application::configuration_search`, which seeds from a coarse
/// grid first for exactly this reason). That assumption can still fail (two
/// nearby minima of different depth inside one bracket can pull the search
/// toward the shallower one) — this function does not itself verify the
/// assumption held; it returns the achieved `|f|` value alongside the time
/// specifically so [`find_tangential_contacts`] can check that afterward,
/// rather than trusting convergence blindly.
///
/// Also returns the **final bracket width**, computed, not assumed: each
/// iteration narrows `[lo, hi]` by a factor of ~0.618 unconditionally (pure
/// interpolation arithmetic, independent of `f`), so after `iterations`
/// iterations the width is deterministically `initial_width * 0.618^iterations`
/// — but the *absolute* result still depends on `initial_width` (which the
/// caller controls via `coarse_step`, scaled by the factor of two above) and
/// is not fixed by this function. A wider `coarse_step` (or fewer
/// `iterations`) can leave a bracket that is not narrow at all; this
/// function reports that honestly via the returned width rather than
/// letting a caller assume 40 iterations always means "precise." (`iterations`
/// exists as a parameter, not a baked-in constant, specifically so a test
/// can exercise an under-converged bracket directly — see
/// `golden_section_minimize_abs_leaves_a_wide_bracket_with_too_few_iterations`.)
/// [`find_tangential_contacts`] is the only production caller, and always
/// passes `GOLDEN_SECTION_ITERATIONS`. Returns the bracket midpoint (and its
/// `|f|` value) once it can no longer be subdivided at `DateTime<Utc>`'s own
/// nanosecond storage resolution — which is a *finer* limit than the
/// bracket-width convergence above in every realistic case, so it is not
/// itself the binding constraint on achieved precision; supporting
/// nanosecond-resolution timestamps does not by itself mean any result is
/// accurate to a nanosecond.
fn golden_section_minimize_abs(
    f: &impl Fn(DateTime<Utc>) -> Result<f64, String>,
    mut lo: DateTime<Utc>,
    mut hi: DateTime<Utc>,
    iterations: u32,
) -> Result<(DateTime<Utc>, f64, Duration), String> {
    const GOLDEN: f64 = 0.618_033_988_749_895;
    let mut x1 = interpolate_datetime(lo, hi, 1.0 - GOLDEN);
    let mut x2 = interpolate_datetime(lo, hi, GOLDEN);
    let mut f1 = f(x1)?.abs();
    let mut f2 = f(x2)?.abs();
    for _ in 0..iterations {
        if x1 == x2 {
            break;
        }
        if f1 < f2 {
            hi = x2;
            x2 = x1;
            f2 = f1;
            x1 = interpolate_datetime(lo, hi, 1.0 - GOLDEN);
            if x1 == x2 {
                break;
            }
            f1 = f(x1)?.abs();
        } else {
            lo = x1;
            x1 = x2;
            f1 = f2;
            x2 = interpolate_datetime(lo, hi, GOLDEN);
            if x1 == x2 {
                break;
            }
            f2 = f(x2)?.abs();
        }
    }
    let bracket_width = hi - lo;
    Ok(if f1 < f2 {
        (x1, f1, bracket_width)
    } else {
        (x2, f2, bracket_width)
    })
}

/// Below this, a refined bracket is treated as time-converged for the
/// purpose of [`TangentialContact::confirmed`] — a deliberately explicit,
/// checked requirement, not an assumption that a fixed iteration count
/// always achieves fine precision (it does not: the achieved bracket width
/// scales with the *caller's* `coarse_step`, which this module does not
/// control — see [`golden_section_minimize_abs`]'s doc comment). One second
/// is chosen because every body this application supports moves a
/// physically negligible amount within one second (even the Moon, the
/// fastest, covers a small fraction of one arcsecond); it is not chosen to
/// match any particular achieved bracket width.
const TANGENTIAL_TIME_PRECISION_TOLERANCE_SECONDS: f64 = 1.0;

fn duration_as_seconds(duration: Duration) -> f64 {
    duration
        .num_nanoseconds()
        .map(|ns| ns as f64 * 1e-9)
        .unwrap_or(f64::INFINITY)
}

/// One tangential-contact candidate, refined and then checked against its
/// own acceptance criteria — see [`TangentialContactOutcome`].
#[derive(Debug, Clone, Copy)]
pub struct TangentialContact {
    /// The refined instant golden-section search converged to.
    pub time: DateTime<Utc>,
    /// `|f(time)|` as achieved by refinement — always present, even when
    /// `confirmed` is `false`, so a caller can see *how* unconfirmed it was
    /// rather than only a boolean.
    pub residual: f64,
    /// The final golden-section bracket width (seconds) `time` was drawn
    /// from — computed, not assumed. Exposed specifically so a caller can
    /// see the actual achieved time-precision rather than inferring it from
    /// the (fixed) iteration count, which alone says nothing about the
    /// *absolute* width without also knowing the bracket golden-section
    /// started from.
    pub bracket_width_seconds: f64,
    /// `true` iff refinement actually converged to a residual at or below
    /// the caller's `tolerance`, did not regress relative to the coarse
    /// sample that first flagged this candidate (see
    /// [`find_tangential_contacts`]'s doc comment for why that second check
    /// matters), **and** `bracket_width_seconds` is at or below
    /// [`TANGENTIAL_TIME_PRECISION_TOLERANCE_SECONDS`] — checked explicitly
    /// against that stated, finite tolerance, not inferred from "40
    /// iterations ran." `false` means this candidate is a
    /// detected-but-unconfirmed near-miss (on the residual, the regression
    /// check, the time-precision check, or several at once): never silently
    /// dropped, but never to be treated as a verified event either.
    ///
    /// # Precisely what `confirmed: true` does and does not guarantee
    ///
    /// It guarantees the residual check *and* the explicit bracket-width
    /// check above. For a bracket of width 6 hours, 40 golden-section
    /// iterations narrow it to ~94 microseconds; for 12 hours, ~189
    /// microseconds — both measured, not merely derived, by
    /// `golden_section_minimize_abs_bracket_width_matches_theory_at_several_coarse_steps`.
    /// The bracket [`find_tangential_contacts`] actually passes spans its
    /// 3-point window's first to last sample — **two** coarse steps, not
    /// one — so for the production discovery step
    /// (`event_search::DEFAULT_EVENT_DISCOVERY_STEP_SECONDS`, 6 hours), the
    /// real bracket width is 12 hours, converging to ~189 microseconds, not
    /// ~94. (An earlier version of this doc comment claimed "under a
    /// microsecond" for the production case — wrong by roughly three orders
    /// of magnitude: both the units arithmetic and the coarse-step-vs-bracket
    /// relationship were wrong, corrected here and in `ephemeris-validation.md`.)
    /// Four distinct things are easy to conflate and are kept separate here:
    /// - **Bracket width** (this field): a pure numerical-convergence
    ///   property of the root-finder, computed from the actual `lo`/`hi`
    ///   this search ended with.
    /// - **`DateTime<Utc>`'s own nanosecond storage resolution**: a far
    ///   finer limit than any realistic bracket width above, and therefore
    ///   not the binding constraint — supporting nanosecond-precision
    ///   *storage* does not imply nanosecond-precision *results*. (Writing
    ///   the time-convergence test for this correction caught exactly this
    ///   confusion in the test's own synthetic oracle: an earlier version
    ///   built it from `DateTime::timestamp()` truncated to whole seconds,
    ///   which gave the test function itself a one-second-wide plateau at
    ///   the minimum rather than a true point minimum, silently
    ///   invalidating a tight assertion. Fixed to use full
    ///   nanosecond-resolution seconds — the real position functions this
    ///   module calls already do, via `event_time.timestamp_subsec_nanos()`
    ///   in the JPL backend, so this was a test-oracle gap, not a
    ///   production one.)
    /// - **Minimizer correctness under the local-unimodality assumption**:
    ///   even a narrow, time-converged bracket can sit on the wrong local
    ///   extremum if `|f|` is not unimodal within it (see the module doc
    ///   comment above on golden-section's own limitation) — a narrow
    ///   bracket does not by itself rule this out; the separate
    ///   residual-regression check is what catches it, not the bracket
    ///   width.
    /// - **Astronomical event-time accuracy**: the bracket-width guarantee
    ///   is purely about this root-finder's own numerics converging to
    ///   *wherever `f` says the minimum is*; it says nothing about how
    ///   accurately `f` itself (the ephemeris pipeline — aberration
    ///   modeling, the documented UT1-approximated-as-UTC sidereal-time
    ///   caveat, etc.) represents the true physical event. A
    ///   microsecond-converged numerical result sitting on a model with its
    ///   own larger uncertainty does not mean the *real* event is pinned
    ///   down to microseconds — only that this search's own contribution to
    ///   the error is negligible by comparison.
    ///
    /// It does **not** guarantee the contact is a true mathematical
    /// tangency (derivative exactly zero at that instant — measure-zero for
    /// real orbital motion, see the module-level completeness note below),
    /// and it says nothing about any *other* instant in the search range:
    /// confirmation is per-candidate, not a completeness claim.
    pub confirmed: bool,
}

/// Result of a tangential-contact scan — distinct from [`EventSearchOutcome`]
/// because every candidate here carries its own per-candidate confirmation,
/// unlike `discover_roots`' sign-change roots, which are never ambiguous.
#[derive(Debug, Clone, Default)]
pub struct TangentialContactOutcome {
    /// Every candidate found, in chronological order, confirmed and
    /// unconfirmed alike — see [`TangentialContact::confirmed`].
    pub contacts: Vec<TangentialContact>,
    /// Same meaning as [`EventSearchOutcome::complete`]: `false` means the
    /// probe budget was exhausted before the whole range could be scanned.
    pub complete: bool,
}

/// Scans `[start, end]` at `coarse_step` for a coarse grid point that is a
/// local extremum of `|f|` — both neighbors strictly larger in magnitude —
/// below `tolerance`, with all three points sharing the same sign (so the
/// bracket contains no confirmed crossing `discover_roots` would otherwise
/// claim) and no `is_continuous_pair` wrap artifact between either adjacent
/// pair. Each candidate's time is refined via bounded golden-section search
/// over its bracketing coarse window, then **checked**, not assumed: a
/// candidate is only `confirmed` when the refined residual is finite, at or
/// below `tolerance`, and no larger than the coarse sample that triggered it
/// in the first place. That last check is the one golden-section's own
/// unimodality assumption can violate — two nearby minima of different depth
/// inside one coarse bracket can pull the search toward the shallower one,
/// which would otherwise silently look like a successful refinement.
/// Unconfirmed candidates are still returned (never silently dropped), with
/// `confirmed: false` and their actual residual, so a caller can see them
/// without ever mistaking one for a verified event.
///
/// # Completeness: a best-effort heuristic, not a proof
///
/// A genuine tangential contact (where the derivative is also exactly zero
/// at the graze instant) is measure-zero for real orbital motion; what this
/// actually detects is a *near*-tangential local extremum resolvable at the
/// chosen `coarse_step` — a courser step can miss one entirely (if the graze
/// is narrower than the step) or mistake a genuinely separate nearby dip for
/// part of the same extremum. This is the same kind of stated, bounded
/// limitation as `discover_roots`' own completeness notes, not a different
/// standard. The confirmation check above closes a *different* gap (a
/// refinement that converged to the wrong answer or didn't converge at all);
/// it does not make detection itself exhaustive.
pub fn find_tangential_contacts(
    f: &impl Fn(DateTime<Utc>) -> Result<f64, String>,
    is_continuous_pair: impl Fn(f64, f64) -> bool,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    coarse_step: Duration,
    tolerance: f64,
    limits: EventSearchLimits,
) -> Result<TangentialContactOutcome, String> {
    if coarse_step.num_seconds() <= 0 {
        return Err("step must be positive".to_string());
    }
    if end < start {
        return Err("end must not precede start".to_string());
    }
    if tolerance <= 0.0 {
        return Err("tolerance must be positive".to_string());
    }

    let mut budget = ProbeBudget {
        remaining: limits.max_probes,
    };
    let mut contacts = Vec::new();
    let mut complete = true;

    if !budget.spend(1) {
        return Ok(TangentialContactOutcome {
            contacts,
            complete: false,
        });
    }
    let mut window: Vec<(DateTime<Utc>, f64)> = vec![(start, f(start)?)];
    let mut current_time = start + coarse_step;

    while current_time <= end {
        if !budget.spend(1) {
            complete = false;
            break;
        }
        window.push((current_time, f(current_time)?));

        if window.len() == 3 {
            let (t_a, v_a) = window[0];
            let (_, v_b) = window[1];
            let (t_c, v_c) = window[2];
            let same_sign = v_a.signum() == v_b.signum() && v_b.signum() == v_c.signum();
            let is_extremum = v_b.abs() < v_a.abs() && v_b.abs() < v_c.abs();
            let candidate = v_b.abs() < tolerance
                && is_extremum
                && same_sign
                && is_continuous_pair(v_a, v_b)
                && is_continuous_pair(v_b, v_c);
            if candidate {
                if !budget.spend(GOLDEN_SECTION_ITERATIONS) {
                    complete = false;
                    break;
                }
                let (time, residual, bracket_width) =
                    golden_section_minimize_abs(f, t_a, t_c, GOLDEN_SECTION_ITERATIONS)?;
                let bracket_width_seconds = duration_as_seconds(bracket_width);
                let confirmed = residual.is_finite()
                    && residual <= tolerance
                    && residual <= v_b.abs()
                    && bracket_width_seconds <= TANGENTIAL_TIME_PRECISION_TOLERANCE_SECONDS;
                contacts.push(TangentialContact {
                    time,
                    residual,
                    bracket_width_seconds,
                    confirmed,
                });
            }
            window.remove(0);
        }

        current_time += coarse_step;
    }

    Ok(TangentialContactOutcome { contacts, complete })
}

/// Tangential-contact candidates for `body_id`'s longitude speed within
/// `[start, end]` — speed grazes zero without an actual direct/retrograde
/// direction change. See [`find_tangential_contacts`] for the heuristic's
/// scope and limitations.
pub fn find_stationary_tangential_contacts(
    ctx: &EvaluationContext,
    body_id: &str,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    discovery_step: Duration,
    limits: EventSearchLimits,
) -> Result<TangentialContactOutcome, String> {
    let f = |at: DateTime<Utc>| signed_speed_deg_per_day(ctx, body_id, at);
    find_tangential_contacts(
        &f,
        |_, _| true,
        start,
        end,
        discovery_step,
        STATION_TANGENTIAL_TOLERANCE_DEG_PER_DAY,
        limits,
    )
}

/// Tangential-contact candidates for `transiting_id` forming
/// `aspect_angle_deg` with the fixed longitude `transited_lon_deg` — the
/// angular offset grazes exact without actually crossing it. Same
/// single-branch caveat as [`find_all_aspect_exact_times_against_fixed_point`].
#[allow(clippy::too_many_arguments)]
pub fn find_aspect_tangential_contacts_against_fixed_point(
    ctx: &EvaluationContext,
    transiting_id: &str,
    transited_lon_deg: f64,
    aspect_angle_deg: f64,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    discovery_step: Duration,
    limits: EventSearchLimits,
) -> Result<TangentialContactOutcome, String> {
    let f = |at: DateTime<Utc>| {
        signed_aspect_offset_deg(ctx, transiting_id, transited_lon_deg, aspect_angle_deg, at)
    };
    find_tangential_contacts(
        &f,
        is_continuous_signed_angle,
        start,
        end,
        discovery_step,
        ASPECT_TANGENTIAL_TOLERANCE_DEG,
        limits,
    )
}

/// Moving-vs-moving counterpart to
/// [`find_aspect_tangential_contacts_against_fixed_point`].
#[allow(clippy::too_many_arguments)]
pub fn find_mutual_aspect_tangential_contacts(
    ctx: &EvaluationContext,
    from_id: &str,
    to_id: &str,
    aspect_angle_deg: f64,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    discovery_step: Duration,
    limits: EventSearchLimits,
) -> Result<TangentialContactOutcome, String> {
    let f = |at: DateTime<Utc>| {
        signed_mutual_aspect_offset_deg(ctx, from_id, to_id, aspect_angle_deg, at)
    };
    find_tangential_contacts(
        &f,
        is_continuous_signed_angle,
        start,
        end,
        discovery_step,
        ASPECT_TANGENTIAL_TOLERANCE_DEG,
        limits,
    )
}

// ─── Orb intervals ───────────────────────────────────────────────────────
//
// Unlike the exact-time searches above (zero-width instants), these find
// the time *interval* during which an aspect stays within its allowed orb —
// the primitive `application::configuration_search` needs to determine when
// a multi-body configuration's constituent aspects are all simultaneously
// satisfied, without requiring any of them to become exact at the same
// moment.

/// One within-orb window's boundaries. `None` on either side means the
/// window was already open at the search's own `start` / still open at its
/// own `end` — i.e. a period-boundary clip, not a genuine root found inside
/// the range. Distinguishing these two kinds of `None` from a real boundary
/// is exactly the signal `application::configuration_search` uses to report
/// "clipped by the requested period."
pub type OrbInterval = (Option<DateTime<Utc>>, Option<DateTime<Utc>>);

/// Result of a complete-interval orb-boundary search.
#[derive(Debug, Clone, Default)]
pub struct OrbIntervalOutcome {
    pub intervals: Vec<OrbInterval>,
    /// Same meaning as [`EventSearchOutcome::complete`].
    pub complete: bool,
}

/// Pairs a chronological list of orb-boundary-crossing roots into enter/exit
/// windows, given whether the orb was already satisfied at the search's own
/// `start`.
fn pair_orb_interval_roots(roots: &[DateTime<Utc>], starts_inside: bool) -> Vec<OrbInterval> {
    let mut intervals = Vec::new();
    let mut iter = roots.iter().copied();

    if starts_inside {
        // The first root (if any) closes the window already open at `start`.
        let first_exit = iter.next();
        intervals.push((None, first_exit));
        if first_exit.is_none() {
            return intervals;
        }
    }

    while let Some(enter) = iter.next() {
        intervals.push((Some(enter), iter.next()));
    }

    intervals
}

/// All within-orb windows for `transiting_id` against the fixed longitude
/// `transited_lon_deg` at `aspect_angle_deg` within `allowed_orb_deg`, over
/// `[start, end]`. Resolves only the *one* branch passed in
/// `aspect_angle_deg` — same two-branch caveat as
/// [`find_all_aspect_exact_times_against_fixed_point`]; a caller wanting
/// both geometrically distinct branches of a non-symmetric aspect must call
/// this twice (once per branch) and *union* the resulting interval lists.
///
/// # Why no wrap guard is needed
///
/// `signed_aspect_offset_deg` has exactly one discontinuity: a ~360-degree
/// jump at the point diametrically opposite the target angle. Taking the
/// absolute value *heals* that jump rather than preserving it — approaching
/// the opposite point from either direction, `|offset|` tends to 180 degrees
/// from both sides (a cusp, not a jump) — so `allowed_orb_deg -
/// |offset(t)|` is continuous wherever the underlying position pipeline is,
/// for any `allowed_orb_deg` under 180 degrees (true of every real aspect
/// orb). Do not reuse `is_continuous_signed_angle` here: that guard targets
/// the *signed* quantity's own jump and would incorrectly reject genuine
/// orb-boundary crossings near the opposite point.
#[allow(clippy::too_many_arguments)]
pub fn find_all_orb_intervals_against_fixed_point(
    ctx: &EvaluationContext,
    transiting_id: &str,
    transited_lon_deg: f64,
    aspect_angle_deg: f64,
    allowed_orb_deg: f64,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    discovery_step: Duration,
    limits: EventSearchLimits,
) -> Result<OrbIntervalOutcome, String> {
    let g = |at: DateTime<Utc>| -> Result<f64, String> {
        let offset =
            signed_aspect_offset_deg(ctx, transiting_id, transited_lon_deg, aspect_angle_deg, at)?;
        Ok(allowed_orb_deg - offset.abs())
    };
    let starts_inside = g(start)? > 0.0;
    let outcome = discover_roots(&g, |_, _| true, start, end, discovery_step, limits)?;
    Ok(OrbIntervalOutcome {
        intervals: pair_orb_interval_roots(&outcome.roots, starts_inside),
        complete: outcome.complete,
    })
}

/// Moving-vs-moving counterpart to
/// [`find_all_orb_intervals_against_fixed_point`]; same continuity
/// reasoning applies.
#[allow(clippy::too_many_arguments)]
pub fn find_all_orb_intervals_mutual(
    ctx: &EvaluationContext,
    from_id: &str,
    to_id: &str,
    aspect_angle_deg: f64,
    allowed_orb_deg: f64,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    discovery_step: Duration,
    limits: EventSearchLimits,
) -> Result<OrbIntervalOutcome, String> {
    let g = |at: DateTime<Utc>| -> Result<f64, String> {
        let offset = signed_mutual_aspect_offset_deg(ctx, from_id, to_id, aspect_angle_deg, at)?;
        Ok(allowed_orb_deg - offset.abs())
    };
    let starts_inside = g(start)? > 0.0;
    let outcome = discover_roots(&g, |_, _| true, start, end, discovery_step, limits)?;
    Ok(OrbIntervalOutcome {
        intervals: pair_orb_interval_roots(&outcome.roots, starts_inside),
        complete: outcome.complete,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::computation::compute_positions;
    use crate::test_support::sample_chart_payload;
    use crate::workspace::models::{AstroModel, ChartInstance};

    fn sampled_chart_at(chart: &ChartInstance, at: DateTime<Utc>) -> ChartInstance {
        let mut sample = chart.clone();
        sample.subject.event_time = Some(at);
        sample
    }

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

    // ─── `discover_roots` / `resolve_window`: synthetic-function tests ─────
    //
    // These exercise the discovery algorithm itself against hand-specified
    // math, independent of any real chart or kernel — the equivalent of
    // `usable_coverage_tests`' synthetic-SPK scenarios in
    // `infrastructure::ephemeris`, for the same reason: the property under
    // test ("does this find every root, including hidden/repeated ones")
    // needs precise control over the function's shape, not a real body that
    // merely happens to approximate one.

    fn epoch(seconds: i64) -> DateTime<Utc> {
        DateTime::<Utc>::from_timestamp(seconds, 0).expect("valid synthetic epoch")
    }

    fn always_continuous(_a: f64, _b: f64) -> bool {
        true
    }

    #[test]
    fn discover_roots_finds_a_single_simple_crossing() {
        // f(t) = t - 500 in seconds-since-epoch terms: one root at t=500.
        let f = |t: DateTime<Utc>| -> Result<f64, String> { Ok((t.timestamp() - 500) as f64) };
        let outcome = discover_roots(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(100),
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert_eq!(outcome.roots.len(), 1);
        assert!((outcome.roots[0].timestamp() - 500).abs() <= 1);
    }

    #[test]
    fn discover_roots_finds_two_crossings_hidden_inside_one_coarse_step() {
        // A "retrograde-loop" shape: positive, dips negative for a short
        // window entirely inside one 1000-second coarse step, then positive
        // again. A naive "sign differs between consecutive coarse samples"
        // scan would see the same sign at both ends of that step and
        // conclude (wrongly) that nothing happened inside it.
        let dip_start = 480.0;
        let dip_end = 520.0;
        let f = move |t: DateTime<Utc>| -> Result<f64, String> {
            let x = t.timestamp() as f64;
            if x > dip_start && x < dip_end {
                Ok(-1.0)
            } else {
                Ok(1.0)
            }
        };
        let outcome = discover_roots(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(1000), // the whole range is a single coarse step
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert_eq!(
            outcome.roots.len(),
            2,
            "expected both the entry and exit crossing of the hidden dip: {:?}",
            outcome.roots
        );
        let t0 = outcome.roots[0].timestamp() as f64;
        let t1 = outcome.roots[1].timestamp() as f64;
        assert!((t0 - dip_start).abs() < 1.0, "entry crossing: {t0}");
        // A step function (not a continuous ramp) has no single "true"
        // crossing instant better than +/-1 integer second here.
        assert!((t1 - dip_end).abs() <= 2.0, "exit crossing: {t1}");
    }

    #[test]
    fn discover_roots_finds_three_repeated_crossings_in_one_window() {
        // Models a body that stations and un-stations twice within one
        // coarse step relative to a fixed target: +,-,+,- -> 3 roots.
        let f = move |t: DateTime<Utc>| -> Result<f64, String> {
            let x = t.timestamp() as f64;
            Ok(match x as i64 {
                x if x < 250 => 1.0,
                x if x < 500 => -1.0,
                x if x < 750 => 1.0,
                _ => -1.0,
            })
        };
        let outcome = discover_roots(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(1000),
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert_eq!(
            outcome.roots.len(),
            3,
            "expected 3 crossings at ~250, ~500, ~750: {:?}",
            outcome.roots
        );
    }

    #[test]
    fn discover_roots_respects_a_wrap_boundary_guard() {
        // A function that jumps from +170 to -170 (a 340-unit jump, i.e. a
        // wrap artifact under a guard that rejects jumps >= 180) right next
        // to a *real*, smaller crossing. The guard must not treat the wrap
        // as a root, but must still find the real one.
        // The ramp's own start/end values are kept on the *same* side of
        // zero as whatever constant region they abut, so the only place
        // the sign actually changes is inside the ramp itself at x=650 —
        // the 340-unit wrap jump at x=300 is the sole large discontinuity,
        // with no incidental sign change riding along with it.
        let f = move |t: DateTime<Utc>| -> Result<f64, String> {
            let x = t.timestamp() as f64;
            Ok(if x < 300.0 {
                170.0
            } else if x < 600.0 {
                -170.0
            } else if x < 700.0 {
                -5.0 + (x - 600.0) * 0.1 // ramps -5 (x=600) -> +5 (x=700), crossing zero at x=650
            } else {
                5.0
            })
        };
        let is_continuous = |a: f64, b: f64| (a - b).abs() < 180.0;
        let outcome = discover_roots(
            &f,
            is_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(100),
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert_eq!(
            outcome.roots.len(),
            1,
            "the 170 -> -170 wrap must not be reported as a root: {:?}",
            outcome.roots
        );
        let t = outcome.roots[0].timestamp() as f64;
        assert!(
            (t - 650.0).abs() < 1.0,
            "expected the real crossing near x=650, got {t}"
        );
    }

    #[test]
    fn discover_roots_reports_incomplete_when_the_probe_budget_is_exhausted() {
        let f = |t: DateTime<Utc>| -> Result<f64, String> { Ok((t.timestamp() - 500) as f64) };
        let tiny_budget = EventSearchLimits {
            max_probes: 1,
            confirmed_subdivision_budget: 10,
            speculative_subdivision_budget: 2,
        };
        let outcome = discover_roots(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(10),
            tiny_budget,
        )
        .expect("search should not error even when the budget is too small");

        assert!(
            !outcome.complete,
            "a 1-probe budget over a 100-step range must be reported incomplete"
        );
    }

    #[test]
    fn discover_roots_finds_nothing_in_a_genuinely_flat_range() {
        let f = |_: DateTime<Utc>| -> Result<f64, String> { Ok(1.0) };
        let outcome = discover_roots(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(100),
            EventSearchLimits::default(),
        )
        .expect("search should not error");
        assert!(outcome.complete);
        assert!(outcome.roots.is_empty());
    }

    #[test]
    fn discover_roots_rejects_invalid_ranges() {
        let f = |_: DateTime<Utc>| -> Result<f64, String> { Ok(1.0) };
        assert!(discover_roots(
            &f,
            always_continuous,
            epoch(1000),
            epoch(0),
            Duration::seconds(10),
            EventSearchLimits::default()
        )
        .is_err());
        assert!(discover_roots(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::zero(),
            EventSearchLimits::default()
        )
        .is_err());
    }

    // ─── `find_tangential_contacts`: synthetic-function tests ──────────

    #[test]
    fn find_tangential_contacts_detects_a_graze_that_does_not_cross() {
        // A smooth dip that touches within tolerance of zero at t=500 but
        // never actually goes negative -- a real tangential contact, not a
        // crossing. Modeled as a parabola so the coarse grid sees a clean
        // local minimum: f(t) = 1e-6 + ((t-500)/1000)^2.
        let f = |t: DateTime<Utc>| -> Result<f64, String> {
            let x = (t.timestamp() - 500) as f64 / 1000.0;
            Ok(1e-6 + x * x)
        };
        let outcome = find_tangential_contacts(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(100),
            1e-3,
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert_eq!(
            outcome.contacts.len(),
            1,
            "expected exactly one graze: {:?}",
            outcome.contacts
        );
        assert!(
            (outcome.contacts[0].time.timestamp() - 500).abs() <= 2,
            "graze should be refined close to the true minimum at t=500: {:?}",
            outcome.contacts[0]
        );
        assert!(
            outcome.contacts[0].confirmed,
            "a genuine graze refining well under tolerance must be confirmed: {:?}",
            outcome.contacts[0]
        );
        assert!(outcome.contacts[0].residual <= 1e-3);
    }

    #[test]
    fn find_tangential_contacts_ignores_a_genuine_crossing() {
        // A real crossing (not a graze) -- `discover_roots`' job, not this
        // function's. Must report nothing, even though the value does pass
        // through near-zero.
        let f = |t: DateTime<Utc>| -> Result<f64, String> { Ok((t.timestamp() - 500) as f64) };
        let outcome = find_tangential_contacts(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(100),
            1e-3,
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert!(
            outcome.contacts.is_empty(),
            "a genuine crossing must not be reported as a tangential contact: {:?}",
            outcome.contacts
        );
    }

    #[test]
    fn find_tangential_contacts_ignores_a_value_that_never_approaches_zero() {
        let f = |_: DateTime<Utc>| -> Result<f64, String> { Ok(5.0) };
        let outcome = find_tangential_contacts(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(100),
            1e-3,
            EventSearchLimits::default(),
        )
        .expect("search should not error");
        assert!(outcome.contacts.is_empty());
    }

    #[test]
    fn find_tangential_contacts_reports_incomplete_when_budget_is_exhausted() {
        let f = |t: DateTime<Utc>| -> Result<f64, String> {
            let x = (t.timestamp() - 500) as f64 / 1000.0;
            Ok(1e-6 + x * x)
        };
        let tiny_limits = EventSearchLimits {
            max_probes: 2,
            ..EventSearchLimits::default()
        };
        let outcome = find_tangential_contacts(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(100),
            1e-3,
            tiny_limits,
        )
        .expect("search should not error even when the budget is too small");
        assert!(!outcome.complete);
        assert!(
            outcome.contacts.iter().all(|c| !c.confirmed),
            "a truncated run must not leak a spurious confirmed contact: {:?}",
            outcome.contacts
        );
    }

    #[test]
    fn find_tangential_contacts_rejects_invalid_ranges() {
        let f = |_: DateTime<Utc>| -> Result<f64, String> { Ok(1.0) };
        assert!(find_tangential_contacts(
            &f,
            always_continuous,
            epoch(1000),
            epoch(0),
            Duration::seconds(10),
            1e-3,
            EventSearchLimits::default()
        )
        .is_err());
        assert!(find_tangential_contacts(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(10),
            0.0,
            EventSearchLimits::default()
        )
        .is_err());
    }

    #[test]
    fn find_tangential_contacts_refines_a_minimum_sitting_between_two_coarse_samples() {
        // True minimum at t=560, deliberately not aligned to any coarse grid
        // point (grid step 100, starting at 0): f(t) = 1e-6 + ((t-560)/2000)^2.
        // The coarse window [500, 600, 700] still brackets it (v_b at t=600
        // is the coarse-sampled extremum), and refinement must land close to
        // the true analytic minimum at 560, not merely reproduce the coarse
        // sample.
        let k = 1.0 / (2000.0 * 2000.0);
        let f = |t: DateTime<Utc>| -> Result<f64, String> {
            // Full nanosecond-resolution seconds, not `t.timestamp()` alone
            // (whole seconds only) -- using just whole seconds here would
            // make `f` piecewise-constant within each second, giving the
            // minimum a one-second-wide *plateau* rather than a true point
            // minimum, which would silently invalidate the tight
            // nanosecond-level convergence assertion below (any point in
            // that plateau would equally satisfy it, proving nothing).
            let seconds = t.timestamp() as f64 + t.timestamp_subsec_nanos() as f64 * 1e-9;
            let dt = seconds - 560.0;
            Ok(1e-6 + k * dt * dt)
        };
        let outcome = find_tangential_contacts(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(100),
            1e-3,
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert_eq!(
            outcome.contacts.len(),
            1,
            "expected exactly one graze: {:?}",
            outcome.contacts
        );
        let contact = outcome.contacts[0];
        // `confirmed` is a residual check; this asserts the *time* also
        // converged, not just the value -- proving `golden_section_minimize_abs`'s
        // structural guarantee (bracket width shrinks by a factor of
        // ~0.618 per iteration, unconditionally, regardless of `f`'s shape)
        // actually holds here: starting from the 200-second-wide bracket
        // [500, 700], 40 iterations should narrow it to roughly
        // 200s * 0.618^40 ≈ 880 nanoseconds. 10 microseconds gives a safe
        // margin above that theoretical bound without being so loose it
        // would also pass for a barely-converged (e.g. only a few
        // iterations deep) result.
        let expected = epoch(560);
        let delta_ns = (contact.time - expected)
            .num_nanoseconds()
            .expect("delta fits in i64 nanoseconds")
            .abs();
        assert!(
            delta_ns <= 10_000,
            "refinement should converge to within 10 microseconds of the true interior minimum at t=560 (not merely close to it), got {delta_ns}ns: {contact:?}"
        );
        assert!(contact.confirmed, "{contact:?}");
        assert!(contact.residual <= 1e-3);
    }

    #[test]
    fn find_tangential_contacts_rejects_a_refinement_that_regresses_to_a_shallower_nearby_minimum()
    {
        // Two nearby minima of different depth inside one coarse bracket
        // [t=400, t=600]: a deep, narrow one exactly at the coarse sample
        // t=500 (floor 2e-4, so the coarse gate `v_b.abs() < tolerance`
        // legitimately triggers), and a shallower, independent one at
        // t=560 (floor 8e-4, still under the 1e-3 tolerance in isolation).
        // Golden-section's initial interior probes (at the golden-ratio
        // fractions of [400,600], i.e. ~t=476 and ~t=524) sit closer to the
        // shallow dip's basin than the deep one's, so -- verified by running
        // the actual algorithm, not assumed -- it converges to the shallow
        // dip (residual ~8e-4) instead of reproducing the deeper coarse
        // sample (2e-4) that triggered the candidate. That is a real
        // violation of local-unimodality, and the new guard
        // (`residual <= v_b.abs()`) must catch it: 8e-4 > 2e-4, so this
        // candidate must come back `confirmed: false`, not silently emitted
        // as a verified event even though 8e-4 is itself still < tolerance.
        let background = 0.02_f64;
        let dip_a = |t: f64| 2e-4_f64 + ((t - 500.0) / 15.0).powi(2) * 0.01;
        let dip_b = |t: f64| 8e-4_f64 + ((t - 560.0) / 15.0).powi(2) * 0.01;
        let f = |t: DateTime<Utc>| -> Result<f64, String> {
            let x = t.timestamp() as f64;
            Ok(dip_a(x).min(dip_b(x)).min(background))
        };
        let outcome = find_tangential_contacts(
            &f,
            always_continuous,
            epoch(0),
            epoch(1000),
            Duration::seconds(100),
            1e-3,
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert_eq!(
            outcome.contacts.len(),
            1,
            "expected exactly one candidate (triggered by the deep dip's coarse sample at t=500): {:?}",
            outcome.contacts
        );
        let contact = outcome.contacts[0];
        assert!(
            contact.residual > 2e-4,
            "premise check: refinement should have moved away from the deep dip's own floor: {contact:?}"
        );
        assert!(
            contact.residual < 1e-3,
            "premise check: the shallow dip it regressed to is still nominally under tolerance in isolation: {contact:?}"
        );
        assert!(
            !contact.confirmed,
            "a refinement that regresses relative to the coarse sample that triggered it must not be confirmed: {contact:?}"
        );
    }

    #[test]
    fn find_tangential_contacts_finds_a_real_graze_near_an_unrelated_branch_cut() {
        // Before t=500: a signed quantity sweeping linearly through its own
        // antipodal wrap point (180 degrees, at t=100) -- a real branch-cut
        // artifact, correctly excluded by `is_continuous_signed_angle`, and
        // in any case never within `tolerance` of zero (magnitude ~150-180
        // throughout). From t=500 onward: an independent real graze near
        // zero at t=800, well clear of the wrap region. The wrap must
        // contribute zero spurious candidates, and the real graze must
        // still be found and confirmed.
        let f = |t: DateTime<Utc>| -> Result<f64, String> {
            let secs = t.timestamp();
            if secs < 500 {
                Ok(wrap_to_signed_180(170.0 + 0.1 * secs as f64))
            } else {
                let x = (secs - 800) as f64 / 1000.0;
                Ok(1e-6 + x * x)
            }
        };
        let outcome = find_tangential_contacts(
            &f,
            is_continuous_signed_angle,
            epoch(0),
            epoch(1500),
            Duration::seconds(100),
            1e-3,
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert_eq!(
            outcome.contacts.len(),
            1,
            "the branch cut must not be misidentified as a tangential contact: {:?}",
            outcome.contacts
        );
        let contact = outcome.contacts[0];
        assert!(
            (contact.time.timestamp() - 800).abs() <= 2,
            "the real graze at t=800 should still be found despite the earlier branch cut: {contact:?}"
        );
        assert!(contact.confirmed, "{contact:?}");
    }

    #[test]
    fn golden_section_minimize_abs_bracket_width_matches_theory_at_several_coarse_steps() {
        // Each iteration narrows [lo, hi] by the golden ratio conjugate
        // (~0.618) unconditionally, so the final width is a deterministic
        // function of the *initial* width and the iteration count --
        // verified directly here (not merely derived) at two different
        // initial bracket widths, confirming the achieved precision scales
        // with the caller's own `coarse_step` rather than being some fixed
        // "nanosecond" constant.
        let f = |t: DateTime<Utc>| -> Result<f64, String> {
            Ok((t.timestamp() as f64 - 1000.0).powi(2))
        };
        const GOLDEN: f64 = 0.618_033_988_749_895;

        for hours in [6i64, 12i64] {
            let width_seconds = hours * 3600;
            let lo = epoch(1000);
            let hi = epoch(1000 + width_seconds);
            let initial_width_seconds = (hi - lo).num_seconds() as f64;
            let (_, _, bracket_width) =
                golden_section_minimize_abs(&f, lo, hi, GOLDEN_SECTION_ITERATIONS)
                    .expect("search should not error");
            let expected_seconds = initial_width_seconds * GOLDEN.powi(40);
            let actual_seconds = duration_as_seconds(bracket_width);
            assert!(
                (actual_seconds - expected_seconds).abs() <= expected_seconds * 0.05,
                "{hours}h bracket: expected final width ~{expected_seconds}s, got {actual_seconds}s"
            );
            // The two concrete figures this correction is about: ~94
            // microseconds for 6h, ~189 microseconds for 12h -- not "under
            // one microsecond" as an earlier, incorrect version of this
            // module's doc comment claimed.
            if hours == 6 {
                assert!(
                    (actual_seconds - 94.39e-6).abs() < 5e-6,
                    "6h bracket should converge to ~94.39 microseconds, got {actual_seconds}s"
                );
            } else {
                assert!(
                    (actual_seconds - 188.79e-6).abs() < 10e-6,
                    "12h bracket should converge to ~188.79 microseconds, got {actual_seconds}s"
                );
            }
        }
    }

    #[test]
    fn golden_section_minimize_abs_leaves_a_wide_bracket_with_too_few_iterations() {
        // A realistic 6-hour-wide bracket (comparable to what
        // `find_tangential_contacts` actually passes for a 3-hour discovery
        // step, since its bracket spans two coarse steps), but deliberately
        // too few iterations -- demonstrating that the
        // achieved time-precision depends on *both* the initial width and
        // the iteration count, not on iteration count alone. 3 iterations
        // narrows the bracket only to 0.618^3 ~= 24% of its original width,
        // nowhere near converged.
        let f = |t: DateTime<Utc>| -> Result<f64, String> {
            Ok((t.timestamp() as f64 - 1000.0).powi(2))
        };
        let lo = epoch(1000 - 6 * 3600);
        let hi = epoch(1000 + 6 * 3600);
        let initial_width_seconds = (hi - lo).num_seconds() as f64;
        let (_, _, bracket_width) =
            golden_section_minimize_abs(&f, lo, hi, 3).expect("search should not error");
        let actual_seconds = duration_as_seconds(bracket_width);
        assert!(
            actual_seconds > TANGENTIAL_TIME_PRECISION_TOLERANCE_SECONDS,
            "3 iterations on a 6h bracket should leave a width well above the 1-second \
             time-precision tolerance (not nanosecond- or microsecond-converged): got {actual_seconds}s"
        );
        const GOLDEN: f64 = 0.618_033_988_749_895;
        let expected_seconds = initial_width_seconds * GOLDEN.powi(3);
        assert!(
            (actual_seconds - expected_seconds).abs() <= expected_seconds * 0.05,
            "expected ~{expected_seconds}s after 3 iterations, got {actual_seconds}s"
        );
    }

    #[test]
    fn find_tangential_contacts_does_not_confirm_when_the_coarse_step_is_too_wide_to_converge_in_time(
    ) {
        // Same clean single-minimum parabola as the "refines a minimum"
        // test above, but with a coarse_step of 10 years instead of 100
        // seconds -- still comfortably inside `GOLDEN_SECTION_ITERATIONS`
        // (40)'s reach to shrink the *residual* below tolerance (the
        // minimum itself is exact and isolated), but the resulting bracket
        // width (2 * coarse_step, narrowed by 0.618^40) is ~2.76 seconds --
        // above the explicit 1-second time-precision tolerance. This is the
        // production-code-path analogue of
        // `golden_section_minimize_abs_leaves_a_wide_bracket_with_too_few_iterations`:
        // here the iteration count is the normal production value, but the
        // *caller-controlled* coarse_step is wide enough that even 40
        // iterations aren't enough to call the time precise.
        let ten_years_secs = 10 * 365 * 86_400;
        let center = ten_years_secs; // minimum sits at t = center, in seconds since epoch(0)
        let k = 1.0 / (2000.0 * 2000.0);
        let f = |t: DateTime<Utc>| -> Result<f64, String> {
            let seconds = t.timestamp() as f64 + t.timestamp_subsec_nanos() as f64 * 1e-9;
            let dt = seconds - center as f64;
            Ok(1e-6 + k * dt * dt)
        };
        let outcome = find_tangential_contacts(
            &f,
            always_continuous,
            epoch(0),
            epoch(2 * ten_years_secs),
            Duration::seconds(ten_years_secs),
            1e-3,
            EventSearchLimits {
                max_probes: 1000,
                ..EventSearchLimits::default()
            },
        )
        .expect("search should not error");

        assert!(
            outcome.complete,
            "warnings implied by incomplete: {outcome:?}"
        );
        assert_eq!(
            outcome.contacts.len(),
            1,
            "expected exactly one candidate: {:?}",
            outcome.contacts
        );
        let contact = outcome.contacts[0];
        assert!(
            contact.residual <= 1e-3,
            "premise check: the residual itself should be well within tolerance: {contact:?}"
        );
        assert!(
            contact.bracket_width_seconds > TANGENTIAL_TIME_PRECISION_TOLERANCE_SECONDS,
            "premise check: a 10-year coarse_step should leave a bracket wider than the \
             1-second time-precision tolerance even after 40 iterations: {contact:?}"
        );
        assert!(
            !contact.confirmed,
            "a candidate whose time has not converged within the explicit tolerance must not \
             be confirmed, even though its residual is well within tolerance: {contact:?}"
        );
    }

    // ─── `pair_orb_interval_roots`: pure pairing-logic tests ────────────

    #[test]
    fn pair_orb_interval_roots_handles_no_roots_and_never_inside() {
        assert_eq!(pair_orb_interval_roots(&[], false), Vec::new());
    }

    #[test]
    fn pair_orb_interval_roots_handles_no_roots_and_always_inside() {
        assert_eq!(pair_orb_interval_roots(&[], true), vec![(None, None)]);
    }

    #[test]
    fn pair_orb_interval_roots_handles_one_full_enter_exit_pair() {
        let enter = epoch(100);
        let exit = epoch(200);
        assert_eq!(
            pair_orb_interval_roots(&[enter, exit], false),
            vec![(Some(enter), Some(exit))]
        );
    }

    #[test]
    fn pair_orb_interval_roots_handles_starts_inside_then_exits_then_reenters() {
        // Inside at start, exits at t=100, re-enters at t=200, still inside
        // at the search's own end.
        let exit = epoch(100);
        let enter = epoch(200);
        assert_eq!(
            pair_orb_interval_roots(&[exit, enter], true),
            vec![(None, Some(exit)), (Some(enter), None)]
        );
    }

    #[test]
    fn pair_orb_interval_roots_handles_an_unmatched_trailing_enter() {
        // Not inside at start, enters at t=100, never exits within range.
        let enter = epoch(100);
        assert_eq!(
            pair_orb_interval_roots(&[enter], false),
            vec![(Some(enter), None)]
        );
    }

    /// Direct regression test for the orb-interval formula's own continuity
    /// claim (`g(t) = allowed_orb - |wrap_to_signed_180(x(t))|` is
    /// continuous, so `is_continuous_pair = |_, _| true` is safe for
    /// `find_all_orb_intervals_*`) at the one place it could fail: the
    /// antipodal branch cut itself.
    ///
    /// `x(t)` sweeps linearly through the true separation `150 -> 210`
    /// degrees over `t in [0, 1200]`, crossing exactly 180 degrees (the
    /// antipodal point for a 0-degree target) at `t=600` -- the dead center
    /// of the window. At that instant the *signed* offset jumps from
    /// +179.999... to -179.999... (confirmed separately in this same test),
    /// but `|offset|` peaks smoothly at exactly 180 there: for `t<600`,
    /// `offset(t) = x(t)` (not yet wrapped), rising 150->180; for `t>600`,
    /// `offset(t) = x(t) - 360`, so `|offset(t)| = 360 - x(t)`, falling
    /// 180->150. With `allowed_orb=160`, this must therefore produce exactly
    /// two boundaries -- exit at `t=200` (where `x=160`) and re-entry at
    /// `t=1000` (where `x=200`, so `360-x=160`) -- and must NOT register any
    /// spurious boundary at the t=600 branch cut itself, where `g` has a
    /// smooth (if non-differentiable) local minimum, not a sign change.
    #[test]
    fn orb_interval_search_is_continuous_through_the_antipodal_branch_cut() {
        let x_at = |t: DateTime<Utc>| -> f64 { 150.0 + (t.timestamp() as f64) * 0.05 };
        let signed_offset_at = |t: DateTime<Utc>| -> f64 { wrap_to_signed_180(x_at(t)) };

        // Confirm the premise: the *signed* quantity really does jump at the
        // antipodal crossing (otherwise this test would not be exercising
        // the branch cut at all), while the *unsigned* quantity does not.
        let just_before = signed_offset_at(epoch(599));
        let just_after = signed_offset_at(epoch(601));
        assert!(
            (just_before - just_after).abs() > 300.0,
            "premise check: the signed offset should jump by ~360 degrees at the antipodal crossing, got {just_before} -> {just_after}"
        );
        assert!(
            (just_before.abs() - just_after.abs()).abs() < 1.0,
            "premise check: the unsigned offset should NOT jump at the same point, got {just_before} -> {just_after}"
        );

        let allowed_orb = 160.0;
        let g = |t: DateTime<Utc>| -> Result<f64, String> {
            Ok(allowed_orb - signed_offset_at(t).abs())
        };
        let starts_inside = g(epoch(0)).unwrap() > 0.0;
        assert!(
            starts_inside,
            "premise check: g(0) should start positive (inside orb)"
        );

        let outcome = discover_roots(
            &g,
            always_continuous,
            epoch(0),
            epoch(1200),
            Duration::seconds(10),
            EventSearchLimits::default(),
        )
        .expect("search should not error");
        assert!(outcome.complete);

        let intervals = pair_orb_interval_roots(&outcome.roots, starts_inside);
        assert_eq!(
            intervals.len(),
            2,
            "expected exactly one full inside-period and one still-open-at-end period, not a spurious split at the branch cut: {:?}",
            intervals
        );
        let (first_enter, first_exit) = intervals[0];
        assert_eq!(first_enter, None, "window starts already inside");
        let exit_time = first_exit
            .expect("first window must have a real exit")
            .timestamp();
        assert!(
            (exit_time - 200).abs() <= 1,
            "exit boundary should be at t=200 (x=160 degrees), not near the t=600 branch cut: got t={exit_time}"
        );

        let (second_enter, second_exit) = intervals[1];
        let enter_time = second_enter
            .expect("second window must have a real entry")
            .timestamp();
        assert!(
            (enter_time - 1000).abs() <= 1,
            "re-entry boundary should be at t=1000 (x=200 degrees), not near the t=600 branch cut: got t={enter_time}"
        );
        assert_eq!(
            second_exit, None,
            "window is still open at the search's own end"
        );
    }

    /// Same branch-cut stress, but for BOTH geometric branches of a
    /// non-symmetric aspect simultaneously (e.g. a real 120-degree trine's
    /// two branches, 120 and 240 degrees) -- each branch has its OWN,
    /// independent antipodal point (at target+180), and this confirms
    /// neither branch's search is confused by the other's branch cut when
    /// both are swept through in the same window.
    #[test]
    fn orb_interval_search_handles_both_branches_crossing_their_own_branch_cuts() {
        // branch target = 120: antipodal at 300. branch target = 240:
        // antipodal at 60 (i.e. 240+180=420=60). Sweep the true separation
        // x(t) linearly through BOTH 300 and 60 within one window by going
        // all the way around: x(t) = t * 0.3 (degrees), t in [0, 1200] ->
        // x in [0, 360).
        let x_at = |t: DateTime<Utc>| -> f64 { (t.timestamp() as f64) * 0.3 };
        let allowed_orb = 10.0;

        for branch_angle in [120.0_f64, 240.0_f64] {
            let g = |t: DateTime<Utc>| -> Result<f64, String> {
                let offset = wrap_to_signed_180(x_at(t) - branch_angle);
                Ok(allowed_orb - offset.abs())
            };
            let outcome = discover_roots(
                &g,
                always_continuous,
                epoch(0),
                epoch(1200),
                Duration::seconds(10),
                EventSearchLimits::default(),
            )
            .expect("search should not error");
            assert!(outcome.complete, "branch {branch_angle}");
            // x(t) passes through branch_angle exactly once in [0,360) (at
            // t=branch_angle/0.3), giving exactly one brief within-orb
            // window there, entirely interior to the search range -- two
            // boundaries, neither of them a false split at that branch's
            // own antipodal point (branch_angle + 180).
            assert_eq!(
                outcome.roots.len(),
                2,
                "branch {branch_angle}: expected exactly one enter+exit pair, found {:?}",
                outcome.roots
            );
        }
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
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = DateTime::parse_from_rfc3339("2024-02-15T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let found = find_stationary_point(&ctx, "mercury", start, end, Duration::hours(6))
            .expect("search should not error")
            .expect("expected a Mercury station in this window");

        let speed_at_root = signed_speed_deg_per_day(&ctx, "mercury", found)
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
        let speed_before =
            signed_speed_deg_per_day(&ctx, "mercury", probe_before).expect("speed before root");
        let speed_after =
            signed_speed_deg_per_day(&ctx, "mercury", probe_after).expect("speed after root");
        assert_ne!(
            speed_before.signum(),
            speed_after.signum(),
            "independent finer re-scan should still bracket the same sign change: before={speed_before}, after={speed_after}"
        );
    }

    #[test]
    fn stationary_point_search_returns_none_when_body_never_stations_in_range() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(2);
        // The Sun's apparent motion never reverses; two days is far too
        // short a window for any genuine solar station (it has none).
        let found = find_stationary_point(&ctx, "sun", start, end, Duration::hours(6))
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
        let ctx = EvaluationContext::new(&chart, &model);
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

        let found =
            find_aspect_exact_time(&ctx, "moon", sun_lon, 0.0, start, end, Duration::hours(6))
                .expect("search should not error")
                .expect("expected a Sun-Moon conjunction within 30 days");

        let offset_at_root = signed_aspect_offset_deg(&ctx, "moon", sun_lon, 0.0, found)
            .expect("offset should be computable at the found root");
        assert!(
            offset_at_root.abs() < 1e-3,
            "offset at the found conjunction should be ~0 deg, got {offset_at_root}"
        );

        let probe_before = found - Duration::hours(2);
        let probe_after = found + Duration::hours(2);
        let before = signed_aspect_offset_deg(&ctx, "moon", sun_lon, 0.0, probe_before)
            .expect("offset before root");
        let after = signed_aspect_offset_deg(&ctx, "moon", sun_lon, 0.0, probe_after)
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
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(35);

        let found = find_aspect_exact_time(&ctx, "moon", 0.0, 0.0, start, end, Duration::hours(6))
            .expect("search should not error")
            .expect("the Moon should cross 0 degrees within 35 days");

        let offset_at_root = signed_aspect_offset_deg(&ctx, "moon", 0.0, 0.0, found)
            .expect("offset should be computable at the found root");
        assert!(
            offset_at_root.abs() < 1e-3,
            "found instant should be a genuine zero crossing, not the opposite branch-cut point: offset={offset_at_root}"
        );
    }

    #[test]
    fn invalid_ranges_are_rejected() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert!(find_stationary_point(
            &ctx,
            "mercury",
            start,
            start - Duration::days(1),
            Duration::hours(1)
        )
        .is_err());
        assert!(find_stationary_point(
            &ctx,
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
        let ctx = EvaluationContext::new(&chart, &model);
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
            find_stationary_point(&ctx, body, window_start, window_end, Duration::hours(6))
                .expect("warm-up search should not error");
        }

        let mut samples = Vec::new();
        let mut found_count = 0usize;
        for _ in 0..REPETITIONS {
            for body in bodies {
                let search_start = Instant::now();
                let found =
                    find_stationary_point(&ctx, body, window_start, window_end, Duration::hours(6))
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
        let ctx = EvaluationContext::new(&chart, &model);
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
            &ctx,
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
                &ctx,
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

    // ─── `find_all_*`: complete-interval searches against real data ────────

    fn default_discovery_step() -> Duration {
        Duration::seconds(DEFAULT_EVENT_DISCOVERY_STEP_SECONDS)
    }

    /// A full calendar year contains several complete Mercury retrograde
    /// loops (each a station pair), confirming this finds *every* one in
    /// the range, not just the first — the actual gap the plural functions
    /// close relative to `find_stationary_point`. Also records real,
    /// reproducible release-mode timing for one representative full-year
    /// search (see `ephemeris-validation.md`).
    #[test]
    fn find_all_stationary_points_finds_every_mercury_station_in_a_full_year() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = DateTime::parse_from_rfc3339("2024-12-31T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let outcome = find_all_stationary_points(
            &ctx,
            "mercury",
            start,
            end,
            default_discovery_step(),
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(
            outcome.complete,
            "a full-year search should not exhaust its budget"
        );
        // Mercury stations roughly 6-7 times a year (3-3.5 retrograde
        // loops); this is a sanity range, not a precise external reference.
        assert!(
            outcome.roots.len() >= 5 && outcome.roots.len() <= 8,
            "expected roughly 6-7 Mercury stations in a full year, found {}: {:?}",
            outcome.roots.len(),
            outcome.roots
        );
        // Strictly chronological, independently re-verified (not just
        // assumed from insertion order).
        for pair in outcome.roots.windows(2) {
            assert!(
                pair[0] < pair[1],
                "roots must be chronological: {:?}",
                outcome.roots
            );
        }
        // Every reported root is independently re-confirmed as a genuine
        // near-zero-speed instant, not merely "something `discover_roots`
        // decided to report."
        for &root in &outcome.roots {
            let speed = signed_speed_deg_per_day(&ctx, "mercury", root)
                .expect("speed should be computable at every reported station");
            assert!(
                speed.abs() < 1e-3,
                "station at {root} has non-converged speed {speed}"
            );
        }
    }

    /// The canonical "repeated retrograde crossing" shape, located against
    /// *real* Mercury motion (not a synthetic function): during its
    /// April 2024 retrograde loop, Mercury crosses 20 degrees tropical
    /// longitude three times (approach, cross back during retrograde,
    /// cross again resuming direct motion) — found empirically while
    /// building this test, not asserted from an external reference. Proves
    /// the plural aspect search finds all three, not just the first.
    #[test]
    fn find_all_aspect_exact_times_finds_a_real_triple_crossing_during_a_retrograde_loop() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-03-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = DateTime::parse_from_rfc3339("2024-05-15T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let outcome = find_all_aspect_exact_times_against_fixed_point(
            &ctx,
            "mercury",
            20.0,
            0.0,
            start,
            end,
            default_discovery_step(),
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert_eq!(
            outcome.roots.len(),
            3,
            "expected Mercury to cross 20 degrees three times during its April 2024 retrograde loop: {:?}",
            outcome.roots
        );
        for pair in outcome.roots.windows(2) {
            assert!(
                pair[0] < pair[1],
                "roots must be chronological: {:?}",
                outcome.roots
            );
        }
        for &root in &outcome.roots {
            let offset = signed_aspect_offset_deg(&ctx, "mercury", 20.0, 0.0, root)
                .expect("offset should be computable at every reported crossing");
            assert!(
                offset.abs() < 1e-3,
                "crossing at {root} has non-converged offset {offset}"
            );
        }
    }

    /// The Moon crosses 0 degrees tropical longitude roughly every sidereal
    /// month (~27.3 days); a full year should show on the order of 13
    /// crossings, each a genuine wrap of the fixed-point search's own
    /// `(-180, 180]` representation, not merely 13 widely-separated
    /// coincidences the branch-cut guard happens to tolerate.
    #[test]
    fn find_all_aspect_exact_times_handles_repeated_zero_degree_wrapping_over_a_year() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(365);

        let outcome = find_all_aspect_exact_times_against_fixed_point(
            &ctx,
            "moon",
            0.0,
            0.0,
            start,
            end,
            default_discovery_step(),
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert!(
            outcome.roots.len() >= 12 && outcome.roots.len() <= 14,
            "expected ~13 lunar 0-degree crossings in a year, found {}: {:?}",
            outcome.roots.len(),
            outcome.roots
        );
        for &root in &outcome.roots {
            let offset = signed_aspect_offset_deg(&ctx, "moon", 0.0, 0.0, root)
                .expect("offset should be computable at every reported crossing");
            assert!(
                offset.abs() < 1e-3,
                "crossing at {root} has non-converged offset {offset}"
            );
        }
    }

    /// Moving-vs-moving: Sun-Moon conjunctions (New Moons) over a year,
    /// using `find_all_mutual_aspect_exact_times` instead of a fixed-point
    /// search — both bodies move, unlike every other test in this module.
    /// A synodic month is ~29.5 days, so a year has 12-13 New Moons.
    #[test]
    fn find_all_mutual_aspect_exact_times_finds_new_moons_over_a_year() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(365);

        let outcome = find_all_mutual_aspect_exact_times(
            &ctx,
            "moon",
            "sun",
            0.0,
            start,
            end,
            default_discovery_step(),
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert!(
            outcome.roots.len() >= 12 && outcome.roots.len() <= 13,
            "expected 12-13 New Moons in a year, found {}: {:?}",
            outcome.roots.len(),
            outcome.roots
        );
        for &root in &outcome.roots {
            let offset = signed_mutual_aspect_offset_deg(&ctx, "moon", "sun", 0.0, root)
                .expect("offset should be computable at every reported conjunction");
            assert!(
                offset.abs() < 1e-3,
                "conjunction at {root} has non-converged offset {offset}"
            );
        }
    }

    /// An event sitting exactly at (or a moment before) the search's own
    /// end boundary must still be found, not silently dropped because the
    /// scan "ran out of range" one sample early.
    #[test]
    fn find_all_stationary_points_finds_an_event_right_at_the_interval_boundary() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        // From the full-year probe: Mercury stations at
        // 2024-01-02T03:06:49.019248366Z (full precision, not truncated —
        // the point of this test is the boundary itself, so an imprecise
        // reference time would test the wrong thing).
        let real_station = DateTime::parse_from_rfc3339("2024-01-02T03:06:49.019248366Z")
            .unwrap()
            .with_timezone(&Utc);
        let start = real_station - Duration::hours(3);
        // With a 1-hour discovery step, `end` must reach at least one full
        // grid point past the real station for the test to be robust: a
        // margin of only minutes would leave the station itself as a
        // coarse-grid endpoint whose floating-point value is ~0 +/- an
        // essentially arbitrary tiny sign, making the test's pass/fail
        // depend on numerical luck rather than on the boundary-inclusion
        // logic this test actually targets. One hour and five minutes past
        // guarantees a grid point unambiguously on the post-station
        // (retrograde) side.
        let end = real_station + Duration::hours(1) + Duration::minutes(5);

        let outcome = find_all_stationary_points(
            &ctx,
            "mercury",
            start,
            end,
            Duration::hours(1),
            EventSearchLimits::default(),
        )
        .expect("search should not error");

        assert!(outcome.complete);
        assert_eq!(
            outcome.roots.len(),
            1,
            "expected the station right at the interval's end to still be found: {:?}",
            outcome.roots
        );
    }

    /// An out-of-coverage epoch must surface as an explicit error from the
    /// search, never as a silently-empty "no events" result — mirrors
    /// `infrastructure::jpl_backend::tests::out_of_coverage_epoch_produces_explicit_local_warnings_not_an_error`,
    /// but for the event-search path specifically, which propagates
    /// `Result::Err` rather than a per-body warning (there is no
    /// warnings-collection concept at this layer).
    #[test]
    fn find_all_stationary_points_surfaces_missing_coverage_as_an_explicit_error() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("3000-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(30);

        let result = find_all_stationary_points(
            &ctx,
            "mercury",
            start,
            end,
            default_discovery_step(),
            EventSearchLimits::default(),
        );
        assert!(
            result.is_err(),
            "an out-of-coverage epoch must surface as an error, not an empty success"
        );
    }

    /// A deliberately tiny probe budget against a real, wide search range
    /// must report `complete: false` — exercised through the public API
    /// (not just `discover_roots` directly, as in the synthetic-function
    /// tests above) to confirm the budget plumbing reaches all the way
    /// through `find_all_stationary_points`.
    #[test]
    fn find_all_stationary_points_reports_incomplete_when_budget_is_too_small_for_a_real_search() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(365);
        let tiny_limits = EventSearchLimits {
            max_probes: 5,
            ..EventSearchLimits::default()
        };

        let outcome = find_all_stationary_points(
            &ctx,
            "mercury",
            start,
            end,
            default_discovery_step(),
            tiny_limits,
        )
        .expect("search should not error even when the budget is too small");

        assert!(
            !outcome.complete,
            "a 5-probe budget over a full year must be reported incomplete, not silently partial"
        );
    }

    // ─── `find_all_orb_intervals_*`: real-data tests ────────────────────

    /// Cross-checks the orb-interval search against the already-proven
    /// exact-time search on the *same* real retrograde loop
    /// (`find_all_aspect_exact_times_finds_a_real_triple_crossing_during_a_retrograde_loop`):
    /// every exact crossing must fall strictly inside exactly one of the
    /// found within-orb windows, since "exact" is by definition "within any
    /// positive orb."
    #[test]
    fn find_all_orb_intervals_against_fixed_point_contains_every_known_exact_crossing() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-03-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = DateTime::parse_from_rfc3339("2024-05-15T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let exact = find_all_aspect_exact_times_against_fixed_point(
            &ctx,
            "mercury",
            20.0,
            0.0,
            start,
            end,
            default_discovery_step(),
            EventSearchLimits::default(),
        )
        .expect("exact-time search should not error");
        assert_eq!(exact.roots.len(), 3);

        let orb = find_all_orb_intervals_against_fixed_point(
            &ctx,
            "mercury",
            20.0,
            0.0,
            1.0,
            start,
            end,
            default_discovery_step(),
            EventSearchLimits::default(),
        )
        .expect("orb-interval search should not error");
        assert!(orb.complete);
        assert!(
            !orb.intervals.is_empty(),
            "expected at least one within-orb window around 3 exact crossings"
        );

        for &exact_time in &exact.roots {
            let contained = orb.intervals.iter().any(|(enter, exit)| {
                let after_enter = enter.map_or(true, |e| e <= exact_time);
                let before_exit = exit.map_or(true, |x| exact_time <= x);
                after_enter && before_exit
            });
            assert!(
                contained,
                "exact crossing at {exact_time} must fall inside some within-orb window: {:?}",
                orb.intervals
            );
        }

        // Chronological, non-overlapping windows.
        for pair in orb.intervals.windows(2) {
            if let (Some(_), Some(prev_exit)) = (pair[1].0, pair[0].1) {
                assert!(
                    prev_exit <= pair[1].0.unwrap(),
                    "windows must not overlap: {:?}",
                    orb.intervals
                );
            }
        }
    }

    /// A window chosen to start *inside* an existing within-orb period (just
    /// before a known exact crossing) must report the first boundary as
    /// `None` (open at the search's own start), not a spuriously-found
    /// "enter" at the window edge.
    #[test]
    fn find_all_orb_intervals_against_fixed_point_reports_open_at_start_when_already_inside() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        // From the triple-crossing fixture: the first 20-degree crossing is
        // known to sit inside 2024-03-01..2024-05-15. Starting a couple of
        // days after the window's own start (still well before the first
        // exact crossing, but close enough that a wide 3-degree orb is
        // already satisfied at this search's `start`) exercises the
        // "already inside" boundary.
        let start = DateTime::parse_from_rfc3339("2024-03-20T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = DateTime::parse_from_rfc3339("2024-03-25T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let orb = find_all_orb_intervals_against_fixed_point(
            &ctx,
            "mercury",
            20.0,
            0.0,
            3.0,
            start,
            end,
            Duration::hours(1),
            EventSearchLimits::default(),
        )
        .expect("orb-interval search should not error");
        assert!(orb.complete);
        assert!(
            !orb.intervals.is_empty(),
            "expected the search to already be inside a wide orb at this point in the loop"
        );
        assert_eq!(
            orb.intervals[0].0, None,
            "already-inside-at-start must report an open (None) entry, not a synthetic one: {:?}",
            orb.intervals
        );
    }

    /// Two independent orb-interval searches (one per geometric branch of a
    /// non-symmetric aspect) must be unioned by the caller, not intersected
    /// or merged automatically — confirms both branches independently
    /// return real, non-overlapping-by-construction results for the same
    /// real data.
    #[test]
    fn find_all_orb_intervals_against_fixed_point_supports_independent_branch_union() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(365);

        // A square (90 degrees) to a fixed point has two branches: +90 and
        // -90 (i.e. 270). Both must be searched independently.
        let branch_a = find_all_orb_intervals_against_fixed_point(
            &ctx,
            "moon",
            0.0,
            90.0,
            1.0,
            start,
            end,
            default_discovery_step(),
            EventSearchLimits::default(),
        )
        .expect("branch search should not error");
        let branch_b = find_all_orb_intervals_against_fixed_point(
            &ctx,
            "moon",
            0.0,
            270.0,
            1.0,
            start,
            end,
            default_discovery_step(),
            EventSearchLimits::default(),
        )
        .expect("branch search should not error");

        assert!(branch_a.complete && branch_b.complete);
        assert!(
            !branch_a.intervals.is_empty() && !branch_b.intervals.is_empty(),
            "the Moon should square a fixed point on both branches repeatedly over a year"
        );
        // The two branches are geometrically 180 degrees apart, so their
        // within-orb windows must not coincide.
        for &(a_enter, a_exit) in &branch_a.intervals {
            for &(b_enter, b_exit) in &branch_b.intervals {
                if let (Some(ae), Some(ax), Some(be), Some(bx)) = (a_enter, a_exit, b_enter, b_exit)
                {
                    let overlap = ae <= bx && be <= ax;
                    assert!(!overlap, "branch windows must not overlap: {a_enter:?}-{a_exit:?} vs {b_enter:?}-{b_exit:?}");
                }
            }
        }
    }

    /// The moving-vs-moving twin, on the real New-Moon fixture
    /// (`find_all_mutual_aspect_exact_times_finds_new_moons_over_a_year`):
    /// every exact conjunction must fall inside a within-orb window.
    #[test]
    fn find_all_orb_intervals_mutual_contains_every_known_new_moon() {
        let (chart, model) = sample_chart_and_model();
        let ctx = EvaluationContext::new(&chart, &model);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(365);

        let exact = find_all_mutual_aspect_exact_times(
            &ctx,
            "moon",
            "sun",
            0.0,
            start,
            end,
            default_discovery_step(),
            EventSearchLimits::default(),
        )
        .expect("exact-time search should not error");
        assert!(exact.roots.len() >= 12);

        let orb = find_all_orb_intervals_mutual(
            &ctx,
            "moon",
            "sun",
            0.0,
            1.0,
            start,
            end,
            default_discovery_step(),
            EventSearchLimits::default(),
        )
        .expect("orb-interval search should not error");
        assert!(orb.complete);

        for &exact_time in &exact.roots {
            let contained = orb.intervals.iter().any(|(enter, exit)| {
                enter.map_or(true, |e| e <= exact_time) && exit.map_or(true, |x| exact_time <= x)
            });
            assert!(
                contained,
                "exact conjunction at {exact_time} must fall inside some within-orb window: {:?}",
                orb.intervals
            );
        }
    }
}
