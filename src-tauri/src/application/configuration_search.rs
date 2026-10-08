//! Multi-body "configuration" interval search (Grand Trine, T-square, Grand
//! Cross, Yod) — orchestrates `domain::configurations`' data-driven pattern
//! definitions against `event_search`'s orb-interval primitive to find the
//! time *interval* during which a role-assignment of bodies simultaneously
//! satisfies every required pairwise aspect, not merely an instant snapshot.
//!
//! This does not require all constituent aspects to become exact at the same
//! instant — a configuration's match interval is the *intersection* of each
//! edge's own within-orb window, and a valid match can exist with no exact
//! aspect anywhere inside it (every edge merely stays within its own orb,
//! possibly at different, unrelated degrees of exactness).
//!
//! `domain::astrology::detect_chart_configurations` (the existing
//! single-instant snapshot classifier) is untouched and used only as an
//! independent cross-check in this module's own tests, never called from
//! here at runtime.

use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;

use crate::domain::astrology::eligible_aspect_angle_and_orb;
use crate::domain::configurations::ConfigurationDefinition;
use crate::workspace::models::{AspectContext, AspectDefinition, ObjectType};

use super::evaluation_context::EvaluationContext;
use super::event_search::{
    find_all_orb_intervals_against_fixed_point, find_all_orb_intervals_mutual,
    signed_aspect_offset_deg, signed_mutual_aspect_offset_deg, EventSearchLimits, OrbInterval,
};
use super::transit::aspect_angle_branches;

/// Upper bound on how many role-assignment permutations one configuration
/// search may enumerate — independent of the probe budget, since
/// role-assignment enumeration itself (before any ephemeris call) can blow
/// up combinatorially for a request with many candidates per role.
/// Exceeding this reports `complete: false` with a named warning rather than
/// enumerating an unbounded permutation count.
pub const MAX_CONFIGURATION_ROLE_ASSIGNMENTS: usize = 5_000;

/// Floor on how many probes any single unique edge-branch search gets once
/// a configuration's total allotted budget is divided across every unique
/// search it actually needs — same shape as `MIN_PROBES_PER_SEARCH` in
/// `application::transit`.
const MIN_PROBES_PER_EDGE_SEARCH: u32 = 200;

/// Upper bound on how many matches' best-fit instants one configuration
/// search will refine. A fast-moving candidate can recur in and out of orb
/// many times over a long requested period; every occurrence still gets a
/// full `entry`/`exit`/`constituent_aspects` result, but only the first
/// `MAX_BEST_FIT_REFINEMENTS` also get a refined best-fit instant (`None`
/// for the rest, with a warning), so a request is never dominated by one
/// fast body's repeat count.
const MAX_BEST_FIT_REFINEMENTS: usize = 200;

/// Coarse grid size for seeding the best-fit local refinement — see
/// `refine_best_fit`'s doc comment for why a grid seed is required before
/// any local optimizer runs.
const BEST_FIT_GRID_POINTS: usize = 10;
const BEST_FIT_REFINEMENT_ITERATIONS: u32 = 15;

/// A resolved candidate pool for one role: which body ids may fill it, and
/// whether they are evaluated as fixed radix points (sampled once from the
/// chart's own natal moment) or as moving bodies (resampled at every
/// evaluation). Resolving `transiting_objects`/`transited_objects` defaults
/// into this shape is `application::transit::compute_transit_events`'s
/// responsibility — this module only ever sees fully-resolved pools, so it
/// never has to guess what a missing role should default to.
#[derive(Debug, Clone)]
pub struct ResolvedRole {
    pub candidates: Vec<String>,
    pub is_fixed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConfigurationParticipant {
    pub role: String,
    pub body_id: String,
    pub is_fixed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConstituentAspectState {
    pub role_a: String,
    pub role_b: String,
    pub body_a: String,
    pub body_b: String,
    pub aspect_id: String,
    pub exact_angle: f64,
    pub allowed_orb: f64,
    pub deviation_deg: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BestFit {
    pub datetime: String,
    /// `max` over constituent aspects of `|deviation| / allowed_orb` at this
    /// instant — a local refinement seeded from a coarse grid across the
    /// match's own interval, not a certified global minimum. This is never
    /// "simultaneous exactness": a best-fit instant need not have *any*
    /// constituent aspect at exactly 0 degrees, only the tightest
    /// achievable combined deviation this search found.
    pub max_normalized_deviation: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConfigurationMatch {
    pub configuration_id: String,
    pub participants: Vec<ConfigurationParticipant>,
    pub entry: Option<String>,
    /// `"period_start"` or `"missing_coverage"` when `entry` is `None` for a
    /// reason other than a genuine open boundary having no root inside the
    /// request's own range; `None` when `entry` is a real found instant.
    pub entry_clipped: Option<String>,
    pub exit: Option<String>,
    pub exit_clipped: Option<String>,
    /// Evaluated at `best_fit`'s instant when present, else `entry`, else
    /// `exit`, else the request's own period midpoint (the legitimate case
    /// where the whole requested window is inside the configuration and
    /// neither boundary is a real root).
    pub constituent_aspects: Vec<ConstituentAspectState>,
    pub best_fit: Option<BestFit>,
}

#[derive(Debug, Clone, Default)]
pub struct ConfigurationSearchOutcome {
    pub matches: Vec<ConfigurationMatch>,
    pub complete: bool,
    pub warnings: Vec<String>,
}

#[allow(clippy::too_many_arguments)]
pub fn search_configuration(
    ctx: &EvaluationContext,
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    object_types: &HashMap<String, ObjectType>,
    definition: &ConfigurationDefinition,
    role_pools: &HashMap<&'static str, ResolvedRole>,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    discovery_step: Duration,
    limits: EventSearchLimits,
) -> Result<ConfigurationSearchOutcome, String> {
    if end < start {
        return Err("end must not precede start".to_string());
    }
    for role in definition.roles {
        if !role_pools.contains_key(role) {
            return Err(format!("missing_role_candidates: {role}"));
        }
    }
    // ─── Enumerate and eligibility-prune role assignments ──────────────
    let raw_upper_bound: u128 = definition
        .roles
        .iter()
        .map(|role| role_pools[role].candidates.len().max(1) as u128)
        .product();
    if raw_upper_bound > MAX_CONFIGURATION_ROLE_ASSIGNMENTS as u128 {
        return Ok(ConfigurationSearchOutcome {
            matches: Vec::new(),
            complete: false,
            warnings: vec![format!(
                "configuration_too_many_role_assignments: {} (candidate pool product {} exceeds {})",
                definition.id, raw_upper_bound, MAX_CONFIGURATION_ROLE_ASSIGNMENTS
            )],
        });
    }

    let mut assignments = Vec::new();
    let mut current: HashMap<&'static str, String> = HashMap::new();
    let mut used_bodies: HashSet<String> = HashSet::new();
    enumerate_role_assignments(
        definition,
        role_pools,
        object_types,
        aspect_definitions,
        aspect_orbs,
        0,
        &mut current,
        &mut used_bodies,
        &mut assignments,
    );
    let assignments = deduplicate_assignments(definition, assignments);

    if assignments.is_empty() {
        return Ok(ConfigurationSearchOutcome {
            matches: Vec::new(),
            complete: true,
            warnings: Vec::new(),
        });
    }

    // ─── Precompute fixed-role radix positions once ────────────────────
    let fixed_body_ids: Vec<String> = role_pools
        .values()
        .filter(|pool| pool.is_fixed)
        .flat_map(|pool| pool.candidates.iter().cloned())
        .collect();
    let radix_positions: HashMap<String, f64> = if fixed_body_ids.is_empty() {
        HashMap::new()
    } else {
        let ids: Vec<&str> = fixed_body_ids.iter().map(String::as_str).collect();
        ctx.radix_longitudes(&ids)?
    };

    // ─── Resolve each assignment's edges to concrete searches, sharing a
    //     memoized cache keyed by the actual (body,is_fixed) pair so the
    //     same pairwise search never runs twice across assignments that
    //     share an edge ────────────────────────────────────────────────
    let mut edge_keys: HashSet<EdgeSearchKey> = HashSet::new();
    let mut per_assignment_edges: Vec<Vec<(EdgeSearchKey, f64, f64)>> = Vec::new();

    for assignment in &assignments {
        let mut edges_for_assignment = Vec::new();
        for edge in definition.edges {
            let body_a = assignment[edge.role_a].clone();
            let body_b = assignment[edge.role_b].clone();
            let fixed_a = role_pools[edge.role_a].is_fixed;
            let fixed_b = role_pools[edge.role_b].is_fixed;
            let context = edge_context(fixed_a, fixed_b);
            let Some((exact_angle, allowed_orb)) = eligible_aspect_angle_and_orb(
                aspect_definitions,
                aspect_orbs,
                edge.aspect_id,
                context,
                object_types.get(&body_a),
                object_types.get(&body_b),
            ) else {
                // Already filtered during enumeration; defensive only.
                continue;
            };
            let key = normalized_edge_key(&body_a, fixed_a, &body_b, fixed_b, edge.aspect_id);
            edge_keys.insert(key.clone());
            edges_for_assignment.push((key, exact_angle, allowed_orb));
        }
        per_assignment_edges.push(edges_for_assignment);
    }

    let unique_edge_count = edge_keys.len().max(1);
    let per_edge_probes =
        (limits.max_probes / unique_edge_count as u32).max(MIN_PROBES_PER_EDGE_SEARCH);
    let edge_limits = EventSearchLimits {
        max_probes: per_edge_probes,
        ..limits
    };

    let mut complete = true;
    let mut warnings = Vec::new();
    let mut edge_interval_cache: HashMap<EdgeSearchKey, Vec<OrbInterval>> = HashMap::new();

    for key in &edge_keys {
        if edge_interval_cache.contains_key(key) {
            continue;
        }
        let intervals = if key.fixed_a && key.fixed_b {
            // Both fixed: a constant relationship for the whole period --
            // one evaluation, no root search.
            let Some(&lon_a) = radix_positions.get(&key.body_a) else {
                complete = false;
                warnings.push(format!("configuration_radix_unavailable: {}", key.body_a));
                edge_interval_cache.insert(key.clone(), Vec::new());
                continue;
            };
            let Some(&lon_b) = radix_positions.get(&key.body_b) else {
                complete = false;
                warnings.push(format!("configuration_radix_unavailable: {}", key.body_b));
                edge_interval_cache.insert(key.clone(), Vec::new());
                continue;
            };
            let Some((exact_angle, allowed_orb)) = eligible_aspect_angle_and_orb(
                aspect_definitions,
                aspect_orbs,
                &key.aspect_id,
                AspectContext::Chart,
                object_types.get(&key.body_a),
                object_types.get(&key.body_b),
            ) else {
                edge_interval_cache.insert(key.clone(), Vec::new());
                continue;
            };
            let satisfied = aspect_angle_branches(exact_angle).into_iter().any(|angle| {
                let separation = crate::domain::houses::normalize_deg(lon_a - lon_b);
                super::event_search::wrap_to_signed_180(separation - angle).abs() <= allowed_orb
            });
            if satisfied {
                vec![(None, None)]
            } else {
                Vec::new()
            }
        } else {
            let branches = {
                // The edge's exact angle is the same regardless of which
                // branch is searched; recover it from either eligible
                // lookup since both sides share the same aspect id.
                let context = edge_context(key.fixed_a, key.fixed_b);
                let Some((exact_angle, allowed_orb)) = eligible_aspect_angle_and_orb(
                    aspect_definitions,
                    aspect_orbs,
                    &key.aspect_id,
                    context,
                    object_types.get(&key.body_a),
                    object_types.get(&key.body_b),
                ) else {
                    edge_interval_cache.insert(key.clone(), Vec::new());
                    continue;
                };
                aspect_angle_branches(exact_angle)
                    .into_iter()
                    .map(|angle| (angle, allowed_orb))
                    .collect::<Vec<_>>()
            };

            let mut union_intervals: Vec<OrbInterval> = Vec::new();
            for (angle, allowed_orb) in branches {
                let outcome = if key.fixed_a || key.fixed_b {
                    let (moving_id, fixed_id) = if key.fixed_a {
                        (&key.body_b, &key.body_a)
                    } else {
                        (&key.body_a, &key.body_b)
                    };
                    let Some(&fixed_lon) = radix_positions.get(fixed_id) else {
                        complete = false;
                        warnings.push(format!("configuration_radix_unavailable: {fixed_id}"));
                        continue;
                    };
                    find_all_orb_intervals_against_fixed_point(
                        ctx,
                        moving_id,
                        fixed_lon,
                        angle,
                        allowed_orb,
                        start,
                        end,
                        discovery_step,
                        edge_limits,
                    )?
                } else {
                    find_all_orb_intervals_mutual(
                        ctx,
                        &key.body_a,
                        &key.body_b,
                        angle,
                        allowed_orb,
                        start,
                        end,
                        discovery_step,
                        edge_limits,
                    )?
                };
                if !outcome.complete {
                    complete = false;
                    warnings.push(format!(
                        "configuration_edge_search_incomplete: {}_{}_{}",
                        key.body_a, key.aspect_id, key.body_b
                    ));
                }
                union_intervals.extend(outcome.intervals);
            }
            union_orb_intervals(union_intervals)
        };
        edge_interval_cache.insert(key.clone(), intervals);
    }

    // ─── Intersect each assignment's own edges, build matches ──────────
    // A fast-moving candidate (e.g. the Moon) can recur in and out of a
    // configuration's orb many times across a long requested period, each
    // occurrence otherwise paying full best-fit refinement cost -- bounded
    // here independently of the role-assignment cap above, which only
    // bounds *distinct body combinations*, not *recurrences over time* of
    // any one of them.
    let mut best_fit_budget: usize = MAX_BEST_FIT_REFINEMENTS;
    let mut best_fit_skipped = false;
    let mut matches = Vec::new();
    for (assignment, edges) in assignments.iter().zip(per_assignment_edges.iter()) {
        if edges.len() != definition.edges.len() {
            // An edge had no eligible aspect at all (shouldn't happen post
            // enumeration-pruning, but never silently fabricate a match).
            continue;
        }
        let mut intersected: Option<Vec<OrbInterval>> = None;
        for (key, _, _) in edges {
            let edge_intervals = edge_interval_cache.get(key).cloned().unwrap_or_default();
            intersected = Some(match intersected {
                None => edge_intervals,
                Some(previous) => intersect_orb_intervals(&previous, &edge_intervals),
            });
        }
        let Some(final_intervals) = intersected else {
            continue;
        };

        for (entry, exit) in final_intervals {
            let participants: Vec<ConfigurationParticipant> = definition
                .roles
                .iter()
                .map(|&role| ConfigurationParticipant {
                    role: role.to_string(),
                    body_id: assignment[role].clone(),
                    is_fixed: role_pools[role].is_fixed,
                })
                .collect();

            let (entry_clipped, exit_clipped) = (
                entry.is_none().then(|| "period_start".to_string()),
                exit.is_none().then(|| "period_end".to_string()),
            );

            let best_fit = if best_fit_budget > 0 {
                best_fit_budget -= 1;
                refine_best_fit(
                    ctx,
                    aspect_definitions,
                    aspect_orbs,
                    object_types,
                    definition,
                    assignment,
                    role_pools,
                    &radix_positions,
                    entry.unwrap_or(start),
                    exit.unwrap_or(end),
                )?
            } else {
                best_fit_skipped = true;
                None
            };

            let evaluation_time = best_fit
                .as_ref()
                .and_then(|fit| DateTime::parse_from_rfc3339(&fit.datetime).ok())
                .map(|dt| dt.with_timezone(&Utc))
                .or(entry)
                .or(exit)
                .unwrap_or_else(|| start + (end - start) / 2);

            let constituent_aspects = evaluate_constituent_aspects(
                ctx,
                aspect_definitions,
                aspect_orbs,
                object_types,
                definition,
                assignment,
                role_pools,
                &radix_positions,
                evaluation_time,
            )?;

            matches.push(ConfigurationMatch {
                configuration_id: definition.id.to_string(),
                participants,
                entry: entry.map(|dt| dt.to_rfc3339()),
                entry_clipped,
                exit: exit.map(|dt| dt.to_rfc3339()),
                exit_clipped,
                constituent_aspects,
                best_fit,
            });
        }
    }

    if best_fit_skipped {
        warnings.push(format!(
            "configuration_best_fit_skipped_for_some_matches: {} (limit {MAX_BEST_FIT_REFINEMENTS} reached)",
            definition.id
        ));
    }

    Ok(ConfigurationSearchOutcome {
        matches,
        complete,
        warnings,
    })
}

fn edge_context(fixed_a: bool, fixed_b: bool) -> AspectContext {
    if fixed_a != fixed_b {
        AspectContext::Transit
    } else {
        AspectContext::Chart
    }
}

#[derive(Hash, PartialEq, Eq, Clone)]
struct EdgeSearchKey {
    body_a: String,
    fixed_a: bool,
    body_b: String,
    fixed_b: bool,
    aspect_id: String,
}

fn normalized_edge_key(
    body_a: &str,
    fixed_a: bool,
    body_b: &str,
    fixed_b: bool,
    aspect_id: &str,
) -> EdgeSearchKey {
    // Sort by (body_id, is_fixed) so the same physical pair always produces
    // the same cache key regardless of which role ordering discovered it.
    let (body_a, fixed_a, body_b, fixed_b) = if (body_a, fixed_a) <= (body_b, fixed_b) {
        (body_a.to_string(), fixed_a, body_b.to_string(), fixed_b)
    } else {
        (body_b.to_string(), fixed_b, body_a.to_string(), fixed_a)
    };
    EdgeSearchKey {
        body_a,
        fixed_a,
        body_b,
        fixed_b,
        aspect_id: aspect_id.to_string(),
    }
}

#[allow(clippy::too_many_arguments)]
fn enumerate_role_assignments(
    definition: &ConfigurationDefinition,
    role_pools: &HashMap<&'static str, ResolvedRole>,
    object_types: &HashMap<String, ObjectType>,
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    role_index: usize,
    current: &mut HashMap<&'static str, String>,
    used_bodies: &mut HashSet<String>,
    results: &mut Vec<HashMap<&'static str, String>>,
) {
    if role_index == definition.roles.len() {
        results.push(current.clone());
        return;
    }
    let role = definition.roles[role_index];
    let pool = &role_pools[role];
    for candidate in &pool.candidates {
        if used_bodies.contains(candidate) {
            continue;
        }
        current.insert(role, candidate.clone());
        let edges_ok = definition.edges.iter().all(|edge| {
            let (Some(body_a), Some(body_b)) = (current.get(edge.role_a), current.get(edge.role_b))
            else {
                return true; // not yet fully assigned; checked once both sides are known
            };
            let fixed_a = role_pools[edge.role_a].is_fixed;
            let fixed_b = role_pools[edge.role_b].is_fixed;
            eligible_aspect_angle_and_orb(
                aspect_definitions,
                aspect_orbs,
                edge.aspect_id,
                edge_context(fixed_a, fixed_b),
                object_types.get(body_a),
                object_types.get(body_b),
            )
            .is_some()
        });
        if edges_ok {
            used_bodies.insert(candidate.clone());
            enumerate_role_assignments(
                definition,
                role_pools,
                object_types,
                aspect_definitions,
                aspect_orbs,
                role_index + 1,
                current,
                used_bodies,
                results,
            );
            used_bodies.remove(candidate);
        }
        current.remove(role);
    }
}

fn canonicalize_assignment(
    definition: &ConfigurationDefinition,
    assignment: &HashMap<&'static str, String>,
) -> Vec<(&'static str, String)> {
    let mut best: Option<Vec<(&'static str, String)>> = None;
    for automorphism in definition.role_automorphisms {
        let permuted: Vec<(&'static str, String)> = definition
            .roles
            .iter()
            .map(|&role| {
                let mapped_role = automorphism
                    .iter()
                    .find(|(from, _)| *from == role)
                    .map(|(_, to)| *to)
                    .unwrap_or(role);
                (role, assignment[mapped_role].clone())
            })
            .collect();
        let is_better = match &best {
            None => true,
            Some(current_best) => permuted < *current_best,
        };
        if is_better {
            best = Some(permuted);
        }
    }
    best.unwrap_or_default()
}

fn deduplicate_assignments(
    definition: &ConfigurationDefinition,
    assignments: Vec<HashMap<&'static str, String>>,
) -> Vec<HashMap<&'static str, String>> {
    let mut seen: HashSet<Vec<(&'static str, String)>> = HashSet::new();
    let mut result = Vec::new();
    for assignment in assignments {
        let canonical = canonicalize_assignment(definition, &assignment);
        if seen.insert(canonical) {
            result.push(assignment);
        }
    }
    result
}

/// Merges a set of (possibly overlapping or adjacent) within-orb windows
/// from independently-searched aspect branches into their union — the
/// caller never assumes the branches are disjoint.
fn union_orb_intervals(mut intervals: Vec<OrbInterval>) -> Vec<OrbInterval> {
    if intervals.len() <= 1 {
        return intervals;
    }
    // Sort by entry, treating `None` (open at the search's own start) as
    // the earliest possible value.
    intervals.sort_by(|a, b| match (a.0, b.0) {
        (None, None) => std::cmp::Ordering::Equal,
        (None, Some(_)) => std::cmp::Ordering::Less,
        (Some(_), None) => std::cmp::Ordering::Greater,
        (Some(x), Some(y)) => x.cmp(&y),
    });

    let mut merged: Vec<OrbInterval> = Vec::new();
    for (entry, exit) in intervals {
        if let Some(last) = merged.last_mut() {
            let overlaps_or_touches = match (last.1, entry) {
                (None, _) => true, // last window never closed
                (Some(last_exit), Some(this_entry)) => this_entry <= last_exit,
                (Some(_), None) => false, // unreachable given the sort above
            };
            if overlaps_or_touches {
                last.1 = match (last.1, exit) {
                    (None, _) => None,
                    (Some(_), None) => None,
                    (Some(a), Some(b)) => Some(a.max(b)),
                };
                continue;
            }
        }
        merged.push((entry, exit));
    }
    merged
}

/// Intersects two sorted, non-overlapping lists of within-orb windows —
/// the time intervals during which *both* constraints hold simultaneously.
fn intersect_orb_intervals(a: &[OrbInterval], b: &[OrbInterval]) -> Vec<OrbInterval> {
    let mut result = Vec::new();
    for &(a_enter, a_exit) in a {
        for &(b_enter, b_exit) in b {
            let enter = match (a_enter, b_enter) {
                (None, None) => None,
                (None, Some(x)) | (Some(x), None) => Some(x),
                (Some(x), Some(y)) => Some(x.max(y)),
            };
            let exit = match (a_exit, b_exit) {
                (None, None) => None,
                (None, Some(x)) | (Some(x), None) => Some(x),
                (Some(x), Some(y)) => Some(x.min(y)),
            };
            let valid = match (enter, exit) {
                (Some(e), Some(x)) => e <= x,
                _ => true,
            };
            if valid {
                result.push((enter, exit));
            }
        }
    }
    result.sort_by(|p, q| match (p.0, q.0) {
        (None, None) => std::cmp::Ordering::Equal,
        (None, Some(_)) => std::cmp::Ordering::Less,
        (Some(_), None) => std::cmp::Ordering::Greater,
        (Some(x), Some(y)) => x.cmp(&y),
    });
    result
}

/// Signed offset (degrees) for one edge at `at`, resolving a fixed role's
/// longitude from the precomputed `radix_positions` rather than resampling
/// it. Picks whichever of the aspect's one or two geometric branches is
/// currently closer to exact, since at any single instant an edge is
/// "satisfied" via whichever branch actually holds then, independent of
/// which branch(es) contributed to the match interval as a whole.
#[allow(clippy::too_many_arguments)]
fn edge_offset_at(
    ctx: &EvaluationContext,
    role_pools: &HashMap<&'static str, ResolvedRole>,
    radix_positions: &HashMap<String, f64>,
    role_a: &str,
    role_b: &str,
    body_a: &str,
    body_b: &str,
    exact_angle: f64,
    at: DateTime<Utc>,
) -> Result<f64, String> {
    let fixed_a = role_pools[role_a].is_fixed;
    let fixed_b = role_pools[role_b].is_fixed;
    let branches = aspect_angle_branches(exact_angle);

    let mut best_offset: Option<f64> = None;
    for angle in branches {
        let offset = if fixed_a && fixed_b {
            let lon_a = *radix_positions
                .get(body_a)
                .ok_or_else(|| format!("{body_a}_unavailable"))?;
            let lon_b = *radix_positions
                .get(body_b)
                .ok_or_else(|| format!("{body_b}_unavailable"))?;
            let separation = crate::domain::houses::normalize_deg(lon_a - lon_b);
            super::event_search::wrap_to_signed_180(separation - angle)
        } else if fixed_a || fixed_b {
            let (moving_id, fixed_id) = if fixed_a {
                (body_b, body_a)
            } else {
                (body_a, body_b)
            };
            let fixed_lon = *radix_positions
                .get(fixed_id)
                .ok_or_else(|| format!("{fixed_id}_unavailable"))?;
            signed_aspect_offset_deg(ctx, moving_id, fixed_lon, angle, at)?
        } else {
            signed_mutual_aspect_offset_deg(ctx, body_a, body_b, angle, at)?
        };
        best_offset = Some(match best_offset {
            None => offset,
            Some(previous) => {
                if offset.abs() < previous.abs() {
                    offset
                } else {
                    previous
                }
            }
        });
    }
    best_offset.ok_or_else(|| "no_aspect_branch_evaluated".to_string())
}

#[allow(clippy::too_many_arguments)]
fn evaluate_constituent_aspects(
    ctx: &EvaluationContext,
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    object_types: &HashMap<String, ObjectType>,
    definition: &ConfigurationDefinition,
    assignment: &HashMap<&'static str, String>,
    role_pools: &HashMap<&'static str, ResolvedRole>,
    radix_positions: &HashMap<String, f64>,
    at: DateTime<Utc>,
) -> Result<Vec<ConstituentAspectState>, String> {
    let mut states = Vec::new();
    for edge in definition.edges {
        let body_a = &assignment[edge.role_a];
        let body_b = &assignment[edge.role_b];
        let fixed_a = role_pools[edge.role_a].is_fixed;
        let fixed_b = role_pools[edge.role_b].is_fixed;
        let Some((exact_angle, allowed_orb)) = eligible_aspect_angle_and_orb(
            aspect_definitions,
            aspect_orbs,
            edge.aspect_id,
            edge_context(fixed_a, fixed_b),
            object_types.get(body_a),
            object_types.get(body_b),
        ) else {
            continue;
        };
        let deviation = edge_offset_at(
            ctx,
            role_pools,
            radix_positions,
            edge.role_a,
            edge.role_b,
            body_a,
            body_b,
            exact_angle,
            at,
        )?;
        states.push(ConstituentAspectState {
            role_a: edge.role_a.to_string(),
            role_b: edge.role_b.to_string(),
            body_a: body_a.clone(),
            body_b: body_b.clone(),
            aspect_id: edge.aspect_id.to_string(),
            exact_angle,
            allowed_orb,
            deviation_deg: deviation,
        });
    }
    Ok(states)
}

/// Seeds a bounded local refinement from a coarse grid across `[lo, hi]`
/// rather than handing a bare optimizer the whole interval: the objective
/// (`max` over several independent, possibly-retrograde aspect-deviation
/// curves) is not generally unimodal over a multi-week interval, since the
/// controlling (argmax) edge can switch partway through. Grid-seeding first
/// and only refining locally around the best grid point avoids assuming
/// global unimodality the objective does not actually have.
#[allow(clippy::too_many_arguments)]
fn refine_best_fit(
    ctx: &EvaluationContext,
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    object_types: &HashMap<String, ObjectType>,
    definition: &ConfigurationDefinition,
    assignment: &HashMap<&'static str, String>,
    role_pools: &HashMap<&'static str, ResolvedRole>,
    radix_positions: &HashMap<String, f64>,
    lo: DateTime<Utc>,
    hi: DateTime<Utc>,
) -> Result<Option<BestFit>, String> {
    if hi <= lo {
        return Ok(None);
    }

    let objective = |at: DateTime<Utc>| -> Result<f64, String> {
        let states = evaluate_constituent_aspects(
            ctx,
            aspect_definitions,
            aspect_orbs,
            object_types,
            definition,
            assignment,
            role_pools,
            radix_positions,
            at,
        )?;
        if states.is_empty() {
            return Ok(f64::MAX);
        }
        Ok(states
            .iter()
            .map(|state| state.deviation_deg.abs() / state.allowed_orb.max(1e-9))
            .fold(f64::MIN, f64::max))
    };

    let span_ns = (hi - lo).num_nanoseconds().unwrap_or(0) as f64;
    let mut best_time = lo;
    let mut best_value = objective(lo)?;
    for step in 1..=BEST_FIT_GRID_POINTS {
        let fraction = step as f64 / (BEST_FIT_GRID_POINTS + 1) as f64;
        let candidate = lo + Duration::nanoseconds((span_ns * fraction).round() as i64);
        let value = objective(candidate)?;
        if value < best_value {
            best_value = value;
            best_time = candidate;
        }
    }
    let end_value = objective(hi)?;
    if end_value < best_value {
        best_value = end_value;
        best_time = hi;
    }

    // Local golden-section refinement in the grid cell bracketing the best
    // seed (clamped to `[lo, hi]`), assuming local unimodality only within
    // that one, much smaller cell.
    let cell_width_ns = span_ns / (BEST_FIT_GRID_POINTS + 1) as f64;
    let refine_lo = (best_time - Duration::nanoseconds(cell_width_ns.round() as i64)).max(lo);
    let refine_hi = (best_time + Duration::nanoseconds(cell_width_ns.round() as i64)).min(hi);
    const GOLDEN: f64 = 0.618_033_988_749_895;
    let mut lo_r = refine_lo;
    let mut hi_r = refine_hi;
    if hi_r > lo_r {
        let interp = |l: DateTime<Utc>, h: DateTime<Utc>, fraction: f64| -> DateTime<Utc> {
            let ns = (h - l).num_nanoseconds().unwrap_or(0) as f64;
            l + Duration::nanoseconds((ns * fraction).round() as i64)
        };
        let mut x1 = interp(lo_r, hi_r, 1.0 - GOLDEN);
        let mut x2 = interp(lo_r, hi_r, GOLDEN);
        let mut f1 = objective(x1)?;
        let mut f2 = objective(x2)?;
        for _ in 0..BEST_FIT_REFINEMENT_ITERATIONS {
            if x1 == x2 {
                break;
            }
            if f1 < f2 {
                hi_r = x2;
                x2 = x1;
                f2 = f1;
                x1 = interp(lo_r, hi_r, 1.0 - GOLDEN);
                if x1 == x2 {
                    break;
                }
                f1 = objective(x1)?;
            } else {
                lo_r = x1;
                x1 = x2;
                f1 = f2;
                x2 = interp(lo_r, hi_r, GOLDEN);
                if x1 == x2 {
                    break;
                }
                f2 = objective(x2)?;
            }
        }
        let (refined_time, refined_value) = if f1 < f2 { (x1, f1) } else { (x2, f2) };
        if refined_value < best_value {
            best_value = refined_value;
            best_time = refined_time;
        }
    }

    Ok(Some(BestFit {
        datetime: best_time.to_rfc3339(),
        max_normalized_deviation: best_value,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::chart_resolution::resolve_standalone_chart;
    use crate::application::computation::compute_positions;
    use crate::domain::configurations::{GRAND_CROSS, GRAND_TRINE, T_SQUARE, YOD};
    use crate::test_support::sample_chart_payload;

    fn resolved_sample_chart() -> super::super::computation::ResolvedChart {
        let payload = sample_chart_payload("configuration-search-test");
        resolve_standalone_chart(&payload, None).expect("sample chart payload should resolve")
    }

    fn moving_role(ids: &[&str]) -> ResolvedRole {
        ResolvedRole {
            candidates: ids.iter().map(|id| id.to_string()).collect(),
            is_fixed: false,
        }
    }

    fn year_2024() -> (DateTime<Utc>, DateTime<Utc>) {
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        (start, start + Duration::days(365))
    }

    /// A real full-year search still needs ~1460 coarse probes (6h step)
    /// just to scan the range once per unique edge -- generous enough that
    /// dividing it across a modest (not combinatorially huge) number of
    /// unique edges still clears that floor, matching how a real caller
    /// with few total planned searches would actually provision one
    /// configuration's share of the shared pool.
    fn generous_limits() -> EventSearchLimits {
        EventSearchLimits {
            max_probes: 200_000,
            ..EventSearchLimits::default()
        }
    }

    #[test]
    fn enumerate_role_assignments_prunes_ineligible_and_duplicate_bodies() {
        let resolved = resolved_sample_chart();
        let object_types =
            crate::domain::astrology::object_type_map(&resolved.model.body_definitions);
        let mut role_pools: HashMap<&'static str, ResolvedRole> = HashMap::new();
        role_pools.insert("a", moving_role(&["sun", "moon"]));
        role_pools.insert("b", moving_role(&["sun", "moon"]));
        role_pools.insert("c", moving_role(&["sun", "moon"]));

        let mut assignments = Vec::new();
        let mut current = HashMap::new();
        let mut used = HashSet::new();
        enumerate_role_assignments(
            &GRAND_TRINE,
            &role_pools,
            &object_types,
            &resolved.model.aspect_definitions,
            &resolved.settings.aspect_orbs,
            0,
            &mut current,
            &mut used,
            &mut assignments,
        );

        // Only 2 distinct bodies available for 3 roles that must all be
        // distinct -- no valid assignment exists.
        assert!(assignments.is_empty());
    }

    #[test]
    fn deduplicate_assignments_merges_symmetric_role_permutations() {
        let mut a: HashMap<&'static str, String> = HashMap::new();
        a.insert("apex", "mercury".to_string());
        a.insert("pole_a", "venus".to_string());
        a.insert("pole_b", "mars".to_string());

        let mut b: HashMap<&'static str, String> = HashMap::new();
        b.insert("apex", "mercury".to_string());
        b.insert("pole_a", "mars".to_string());
        b.insert("pole_b", "venus".to_string());

        let deduped = deduplicate_assignments(&T_SQUARE, vec![a, b]);
        assert_eq!(
            deduped.len(),
            1,
            "pole_a/pole_b-swapped assignments describe the same physical configuration"
        );
    }

    #[test]
    fn deduplicate_assignments_keeps_distinct_mixed_role_configurations() {
        let mut a: HashMap<&'static str, String> = HashMap::new();
        a.insert("apex", "mercury".to_string());
        a.insert("pole_a", "venus".to_string());
        a.insert("pole_b", "mars".to_string());

        let mut b: HashMap<&'static str, String> = HashMap::new();
        b.insert("apex", "venus".to_string());
        b.insert("pole_a", "mercury".to_string());
        b.insert("pole_b", "mars".to_string());

        let deduped = deduplicate_assignments(&T_SQUARE, vec![a, b]);
        assert_eq!(
            deduped.len(),
            2,
            "a different apex is a genuinely distinct configuration, not a symmetric relabeling"
        );
    }

    #[test]
    fn union_orb_intervals_merges_overlapping_and_touching_windows() {
        let t = |s: i64| DateTime::<Utc>::from_timestamp(s, 0).unwrap();
        let merged = union_orb_intervals(vec![
            (Some(t(0)), Some(t(100))),
            (Some(t(50)), Some(t(150))),  // overlaps the first
            (Some(t(200)), Some(t(300))), // disjoint
        ]);
        assert_eq!(
            merged,
            vec![(Some(t(0)), Some(t(150))), (Some(t(200)), Some(t(300)))]
        );
    }

    #[test]
    fn intersect_orb_intervals_finds_the_overlap_only() {
        let t = |s: i64| DateTime::<Utc>::from_timestamp(s, 0).unwrap();
        let a = vec![(Some(t(0)), Some(t(100)))];
        let b = vec![(Some(t(50)), Some(t(150)))];
        assert_eq!(
            intersect_orb_intervals(&a, &b),
            vec![(Some(t(50)), Some(t(100)))]
        );
    }

    #[test]
    fn intersect_orb_intervals_handles_open_boundaries() {
        let t = |s: i64| DateTime::<Utc>::from_timestamp(s, 0).unwrap();
        // Open at the end (None) intersected with a bounded window should
        // keep the bounded window's own exit.
        let a = vec![(Some(t(0)), None)];
        let b = vec![(Some(t(10)), Some(t(50)))];
        assert_eq!(
            intersect_orb_intervals(&a, &b),
            vec![(Some(t(10)), Some(t(50)))]
        );
    }

    #[test]
    fn search_configuration_finds_a_real_grand_trine_interval() {
        let resolved = resolved_sample_chart();
        let ctx = EvaluationContext::new(&resolved.chart, &resolved.model);
        let object_types =
            crate::domain::astrology::object_type_map(&resolved.model.body_definitions);
        // Mars/Jupiter/Saturn, not Mercury/Venus: both are elongation-bound
        // to the Sun (max ~28/~48 degrees) and can never reach a 120-degree
        // mutual separation at all -- confirmed empirically (a scratch
        // probe against real data found zero mercury-venus trine windows
        // across all of 2024, both branches). A real Mars-Jupiter-Saturn
        // Grand Trine window was located empirically the same way: each
        // pairwise mutual orb-interval search run independently found
        // mars-jupiter in orb 2025-10-18..11-06, mars-saturn in orb
        // 2025-10-21..11-06, and jupiter-saturn in orb from 2025-09-27
        // onward -- a genuine triple overlap around late October 2025, not
        // an assumed or fabricated date.
        let start = DateTime::parse_from_rfc3339("2025-09-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(90);
        let mut role_pools: HashMap<&'static str, ResolvedRole> = HashMap::new();
        for role in GRAND_TRINE.roles {
            role_pools.insert(role, moving_role(&["mars", "jupiter", "saturn"]));
        }

        let outcome = search_configuration(
            &ctx,
            &resolved.model.aspect_definitions,
            &resolved.settings.aspect_orbs,
            &object_types,
            &GRAND_TRINE,
            &role_pools,
            start,
            end,
            Duration::seconds(
                crate::application::event_search::DEFAULT_EVENT_DISCOVERY_STEP_SECONDS,
            ),
            generous_limits(),
        )
        .expect("search should not error");

        assert!(outcome.complete, "warnings: {:?}", outcome.warnings);
        assert!(
            !outcome.matches.is_empty(),
            "expected the real Mars-Jupiter-Saturn Grand Trine located empirically around late October 2025"
        );
        for configuration_match in &outcome.matches {
            assert_eq!(configuration_match.participants.len(), 3);
            let ids: HashSet<&str> = configuration_match
                .participants
                .iter()
                .map(|p| p.body_id.as_str())
                .collect();
            assert_eq!(
                ids.len(),
                3,
                "a configuration's participants must be distinct bodies"
            );
            for state in &configuration_match.constituent_aspects {
                assert_eq!(state.aspect_id, "trine");
            }
        }
    }

    /// Cross-checks a found Grand Trine interval against the existing,
    /// independent single-instant classifier
    /// (`domain::astrology::detect_chart_configurations`, untouched by this
    /// module) rather than only against this module's own machinery: an
    /// interior time must have the snapshot detector agree a Grand Trine is
    /// present, and (when the boundary is a real root, not clipped by the
    /// requested period) a moment before `entry` must not.
    #[test]
    fn search_configuration_match_is_confirmed_by_the_instantaneous_detector() {
        let resolved = resolved_sample_chart();
        let ctx = EvaluationContext::new(&resolved.chart, &resolved.model);
        let object_types =
            crate::domain::astrology::object_type_map(&resolved.model.body_definitions);
        let start = DateTime::parse_from_rfc3339("2025-09-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(90);
        let mut role_pools: HashMap<&'static str, ResolvedRole> = HashMap::new();
        for role in GRAND_TRINE.roles {
            role_pools.insert(role, moving_role(&["mars", "jupiter", "saturn"]));
        }

        let outcome = search_configuration(
            &ctx,
            &resolved.model.aspect_definitions,
            &resolved.settings.aspect_orbs,
            &object_types,
            &GRAND_TRINE,
            &role_pools,
            start,
            end,
            Duration::seconds(
                crate::application::event_search::DEFAULT_EVENT_DISCOVERY_STEP_SECONDS,
            ),
            generous_limits(),
        )
        .expect("search should not error");
        assert!(outcome.complete, "warnings: {:?}", outcome.warnings);
        let configuration_match = outcome
            .matches
            .first()
            .expect("expected the real Mars-Jupiter-Saturn Grand Trine");

        let snapshot_configurations_at = |at: DateTime<Utc>| -> Vec<String> {
            let body_ids: Vec<String> = configuration_match
                .participants
                .iter()
                .map(|p| p.body_id.clone())
                .collect();
            let mut sample = resolved.chart.clone();
            sample.subject.event_time = Some(at);
            let calc = compute_positions(&sample, &resolved.model, &body_ids, &[])
                .expect("positions should compute");
            let aspects = crate::domain::astrology::compute_chart_aspects(
                &calc.positions,
                &resolved.model.aspect_definitions,
                &resolved.settings.aspect_orbs,
                None,
                &object_types,
            );
            crate::domain::astrology::detect_chart_configurations(&calc.positions, &aspects)
        };

        let entry = configuration_match.entry.as_ref().map(|dt| {
            DateTime::parse_from_rfc3339(dt)
                .unwrap()
                .with_timezone(&Utc)
        });
        let exit = configuration_match.exit.as_ref().map(|dt| {
            DateTime::parse_from_rfc3339(dt)
                .unwrap()
                .with_timezone(&Utc)
        });
        let interior = match (entry, exit) {
            (Some(e), Some(x)) => e + (x - e) / 2,
            (Some(e), None) => e + Duration::days(1),
            (None, Some(x)) => x - Duration::days(1),
            (None, None) => start + (end - start) / 2,
        };

        let interior_configurations = snapshot_configurations_at(interior);
        assert!(
            interior_configurations
                .iter()
                .any(|id| id == "grand_trine"),
            "the instantaneous detector must independently confirm a Grand Trine at the interior time {interior}: found {interior_configurations:?}"
        );

        if let Some(entry_time) = entry {
            let before_entry = entry_time - Duration::days(1);
            if before_entry >= start {
                let before_configurations = snapshot_configurations_at(before_entry);
                assert!(
                    !before_configurations.iter().any(|id| id == "grand_trine"),
                    "the instantaneous detector must NOT report a Grand Trine a day before the found entry {entry_time}: found {before_configurations:?}"
                );
            }
        }
    }

    /// Re-running the same real search at a discovery step 6x finer must
    /// agree with the original (6-hour default) step within a small
    /// tolerance — demonstrating that discovery resolution, not just the
    /// unrelated graph-sampling step, does not materially change the
    /// detected configuration interval for a validated case.
    #[test]
    fn search_configuration_result_is_stable_under_a_finer_discovery_step() {
        let resolved = resolved_sample_chart();
        let ctx = EvaluationContext::new(&resolved.chart, &resolved.model);
        let object_types =
            crate::domain::astrology::object_type_map(&resolved.model.body_definitions);
        let start = DateTime::parse_from_rfc3339("2025-09-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(90);
        let mut role_pools: HashMap<&'static str, ResolvedRole> = HashMap::new();
        for role in GRAND_TRINE.roles {
            role_pools.insert(role, moving_role(&["mars", "jupiter", "saturn"]));
        }

        let coarse = search_configuration(
            &ctx,
            &resolved.model.aspect_definitions,
            &resolved.settings.aspect_orbs,
            &object_types,
            &GRAND_TRINE,
            &role_pools,
            start,
            end,
            Duration::seconds(
                crate::application::event_search::DEFAULT_EVENT_DISCOVERY_STEP_SECONDS,
            ),
            generous_limits(),
        )
        .expect("search should not error");
        let fine = search_configuration(
            &ctx,
            &resolved.model.aspect_definitions,
            &resolved.settings.aspect_orbs,
            &object_types,
            &GRAND_TRINE,
            &role_pools,
            start,
            end,
            Duration::seconds(
                crate::application::event_search::DEFAULT_EVENT_DISCOVERY_STEP_SECONDS / 6,
            ),
            generous_limits(),
        )
        .expect("search should not error");

        assert!(coarse.complete && fine.complete);
        assert_eq!(
            coarse.matches.len(),
            fine.matches.len(),
            "a 6x finer discovery step must find the same number of matches"
        );
        for (coarse_match, fine_match) in coarse.matches.iter().zip(fine.matches.iter()) {
            for (coarse_time, fine_time) in [
                (&coarse_match.entry, &fine_match.entry),
                (&coarse_match.exit, &fine_match.exit),
            ] {
                match (coarse_time, fine_time) {
                    (Some(a), Some(b)) => {
                        let a = DateTime::parse_from_rfc3339(a).unwrap().with_timezone(&Utc);
                        let b = DateTime::parse_from_rfc3339(b).unwrap().with_timezone(&Utc);
                        assert!(
                            (a - b).num_hours().abs() <= 1,
                            "boundary times must agree within an hour between discovery steps: {a} vs {b}"
                        );
                    }
                    (None, None) => {}
                    (a, b) => panic!(
                        "boundary clipping must agree between discovery steps: {a:?} vs {b:?}"
                    ),
                }
            }
        }
    }

    #[test]
    fn search_configuration_reports_incomplete_for_too_many_role_assignments() {
        let resolved = resolved_sample_chart();
        let ctx = EvaluationContext::new(&resolved.chart, &resolved.model);
        let object_types =
            crate::domain::astrology::object_type_map(&resolved.model.body_definitions);
        let (start, end) = year_2024();
        let many_bodies: Vec<&str> = vec![
            "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
            "pluto",
        ];
        let mut role_pools: HashMap<&'static str, ResolvedRole> = HashMap::new();
        for role in GRAND_CROSS.roles {
            role_pools.insert(role, moving_role(&many_bodies));
        }

        // 10 candidates ^ 4 roles far exceeds a tiny cap.
        let outcome = search_configuration(
            &ctx,
            &resolved.model.aspect_definitions,
            &resolved.settings.aspect_orbs,
            &object_types,
            &GRAND_CROSS,
            &role_pools,
            start,
            end,
            Duration::seconds(
                crate::application::event_search::DEFAULT_EVENT_DISCOVERY_STEP_SECONDS,
            ),
            EventSearchLimits::default(),
        );
        // 10^4 = 10000 > MAX_CONFIGURATION_ROLE_ASSIGNMENTS (5000).
        let outcome = outcome.expect("search should not error even when over the cap");
        assert!(!outcome.complete);
        assert!(outcome.matches.is_empty());
        assert!(outcome
            .warnings
            .iter()
            .any(|w| w.contains("configuration_too_many_role_assignments")));
    }

    #[test]
    fn search_configuration_finds_a_real_yod_with_a_fixed_radix_role() {
        let resolved = resolved_sample_chart();
        let ctx = EvaluationContext::new(&resolved.chart, &resolved.model);
        let object_types =
            crate::domain::astrology::object_type_map(&resolved.model.body_definitions);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(120);
        let mut role_pools: HashMap<&'static str, ResolvedRole> = HashMap::new();
        // `apex` is Mars only, not Mercury/Venus: both are elongation-bound
        // to the Sun (max ~28/~48 degrees) and can never reach the 150
        // degrees a quincunx to the fixed Sun role requires (same
        // orbital-mechanics reasoning as the Grand Trine test above).
        role_pools.insert("apex", moving_role(&["mars"]));
        role_pools.insert(
            "base_a",
            ResolvedRole {
                candidates: vec!["sun".to_string()],
                is_fixed: true,
            },
        );
        role_pools.insert("base_b", moving_role(&["jupiter"]));

        let outcome = search_configuration(
            &ctx,
            &resolved.model.aspect_definitions,
            &resolved.settings.aspect_orbs,
            &object_types,
            &YOD,
            &role_pools,
            start,
            end,
            Duration::seconds(
                crate::application::event_search::DEFAULT_EVENT_DISCOVERY_STEP_SECONDS,
            ),
            generous_limits(),
        )
        .expect("search should not error");

        assert!(outcome.complete, "warnings: {:?}", outcome.warnings);
        for configuration_match in &outcome.matches {
            let base_a = configuration_match
                .participants
                .iter()
                .find(|p| p.role == "base_a")
                .unwrap();
            assert_eq!(base_a.body_id, "sun");
            assert!(
                base_a.is_fixed,
                "base_a was requested as a fixed radix role"
            );
        }
    }

    /// Representative end-to-end multi-body configuration search: Grand
    /// Trine among 5 classical bodies (Mars/Jupiter/Saturn/Uranus/Neptune —
    /// C(5,3)=10 candidate trios after automorphism dedup) over a 3-year
    /// window, long enough to realistically contain a real match. Verifies
    /// at least one match is actually found and `complete: true` before
    /// timing it, so this cannot silently measure a no-op path.
    ///
    /// Each repetition constructs a **fresh** `EvaluationContext` (never
    /// reused across repetitions) — this is deliberate: a real
    /// `compute_transit_events` call builds exactly one context per request,
    /// so reusing one across repetitions here would measure an artificially
    /// warm cache (every body/epoch already seen) rather than the real,
    /// comparable per-request cost this benchmark exists to track against
    /// the pre-optimization baseline recorded in `ephemeris-validation.md`.
    /// `cache_stats()` is still reported from one representative fresh run,
    /// to show the *intra-request* sharing this cache provides (several
    /// edges reusing the same body's position at the same coarse-grid
    /// epoch), which the repetition loop's fresh-context design would
    /// otherwise hide.
    ///
    /// Run with: `cargo test --release --lib configuration_search_benchmark -- --ignored --nocapture`
    #[test]
    #[ignore = "diagnostic benchmark; run manually on the target machine"]
    fn configuration_search_benchmark() {
        use std::time::Instant;

        let resolved = resolved_sample_chart();
        let object_types =
            crate::domain::astrology::object_type_map(&resolved.model.body_definitions);
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start + Duration::days(365 * 3);
        let mut role_pools: HashMap<&'static str, ResolvedRole> = HashMap::new();
        for role in GRAND_TRINE.roles {
            role_pools.insert(
                role,
                moving_role(&["mars", "jupiter", "saturn", "uranus", "neptune"]),
            );
        }
        let discovery_step = Duration::seconds(
            crate::application::event_search::DEFAULT_EVENT_DISCOVERY_STEP_SECONDS,
        );
        // 10 repetitions. Percentile method (floor(n * pct / 100), clamped to
        // the last index): for n=10 this makes p50 the 6th-smallest sample
        // (index 5, the upper-median of an even-sized set) and p95 index
        // floor(10*95/100)=9 -- the LAST index, i.e. for this sample size
        // "p95" is mathematically identical to the sample maximum, not a
        // distinct higher percentile. (This floor-based formula only
        // produces an index below the maximum once n > 20; a prior version
        // of this comment incorrectly claimed otherwise for n=10.) Reported
        // as "p95" for consistency with this file's other benchmarks, not
        // because it is a true interpolated 95th percentile here.
        const REPETITIONS: u32 = 10;

        // Warm-up: its own fresh context, discarded afterward -- excludes
        // one-time process-wide costs (e.g. the `anise` Almanac's own
        // global, cross-request cache in `jpl_backend::almanac_cache`) from
        // the timed samples below, same as before this benchmark's cache
        // changes.
        {
            let warm_up_ctx = EvaluationContext::new(&resolved.chart, &resolved.model);
            let warm_up = search_configuration(
                &warm_up_ctx,
                &resolved.model.aspect_definitions,
                &resolved.settings.aspect_orbs,
                &object_types,
                &GRAND_TRINE,
                &role_pools,
                start,
                end,
                discovery_step,
                generous_limits(),
            )
            .expect("warm-up search should not error");
            assert!(warm_up.complete, "warnings: {:?}", warm_up.warnings);
            assert!(
                !warm_up.matches.is_empty(),
                "expected at least one real Grand Trine among 5 outer bodies over 3 years"
            );
        }

        let mut samples = Vec::with_capacity(REPETITIONS as usize);
        let mut last_match_count = 0usize;
        let mut last_matches_summary = String::new();
        let mut representative_cache_stats = None;
        for rep in 0..REPETITIONS {
            let ctx = EvaluationContext::new(&resolved.chart, &resolved.model);
            let run_start = Instant::now();
            let outcome = search_configuration(
                &ctx,
                &resolved.model.aspect_definitions,
                &resolved.settings.aspect_orbs,
                &object_types,
                &GRAND_TRINE,
                &role_pools,
                start,
                end,
                discovery_step,
                generous_limits(),
            )
            .expect("search should not error");
            samples.push(run_start.elapsed());
            assert!(outcome.complete);
            last_match_count = outcome.matches.len();
            if rep == 0 {
                representative_cache_stats = Some(ctx.cache_stats());
                last_matches_summary = outcome
                    .matches
                    .iter()
                    .map(|m| {
                        format!(
                            "(entry={:?}, exit={:?}, best_fit={:?})",
                            m.entry,
                            m.exit,
                            m.best_fit.as_ref().map(|b| &b.datetime)
                        )
                    })
                    .collect::<Vec<_>>()
                    .join(", ");
            }
        }

        samples.sort_unstable();
        let p50 = samples[samples.len() / 2];
        let p95 = samples[(samples.len() * 95 / 100).min(samples.len() - 1)];
        let stats = representative_cache_stats.expect("at least one repetition ran");
        println!(
            "configuration_search benchmark: pattern=grand_trine, candidates=5 (C(5,3)=10 trios), \
             window=3y, matches_found={last_match_count}, repetitions={REPETITIONS}, p50={p50:?}, p95={p95:?}"
        );
        println!(
            "configuration_search benchmark (one fresh request's cache_stats): hits={}, misses={}, \
             upgrades={}, entries={}, approx_bytes={}",
            stats.hits, stats.misses, stats.upgrades, stats.entries, stats.approx_bytes
        );
        println!("configuration_search benchmark (match details, one fresh request): {last_matches_summary}");
    }
}
