//! Typed transit-series computation use case.

use std::collections::HashMap;

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;

use crate::domain::astrology::ComputedAspect;
use crate::infrastructure::position_provider::AstronomyMotion;
use crate::workspace::models::AspectContext;

use super::computation::{compute_positions, extend_unique, inherited_or_override, ResolvedChart};
use super::configuration_search::{search_configuration, ConfigurationMatch, ResolvedRole};
use super::evaluation_context::EvaluationContext;
use super::event_search::{
    find_all_aspect_exact_times_against_fixed_point, find_all_mutual_aspect_exact_times,
    find_all_stationary_points, find_aspect_tangential_contacts_against_fixed_point,
    find_mutual_aspect_tangential_contacts, find_stationary_tangential_contacts, EventSearchLimits,
    DEFAULT_EVENT_DISCOVERY_STEP_SECONDS,
};

const MAX_TRANSIT_STEPS: i64 = 50_000;

#[derive(Debug, Clone)]
pub struct TransitSeriesRequest {
    pub resolved_chart: ResolvedChart,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub time_step_seconds: i64,
    pub transiting_objects: Vec<String>,
    pub transited_objects: Vec<String>,
    pub aspect_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransitTimeRange {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransitSeriesStep {
    pub datetime: String,
    pub transit_positions: HashMap<String, f64>,
    /// Daily motion (degrees/day) and retrograde flag per transiting body at this step — lets
    /// consumers annotate exact hits caused by a station/retrograde loop without re-deriving
    /// speed from position deltas.
    pub motion: HashMap<String, AstronomyMotion>,
    /// Transiting-vs-natal (fixed radix) aspects *and* mutual aspects among the transiting
    /// bodies themselves (moving-to-moving) — both share the same `ComputedAspect` shape, so
    /// consumers distinguish them by checking which side's id belongs to the transiting set.
    pub aspects: Vec<ComputedAspect>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransitSeriesCalculation {
    pub source_chart_id: String,
    pub time_range: TransitTimeRange,
    pub time_step: String,
    pub results: Vec<TransitSeriesStep>,
    pub backend_used: String,
    pub fallback_used: bool,
    pub ephemeris_source: Option<String>,
    pub warnings: Vec<String>,
}

pub fn parse_datetime_input(value: &str) -> Result<DateTime<Utc>, String> {
    crate::event_time::parse_event_time(value)
}

pub fn compute_transit_series(
    request: TransitSeriesRequest,
) -> Result<TransitSeriesCalculation, String> {
    if request.time_step_seconds <= 0 {
        return Err("time_step_seconds must be > 0".to_string());
    }
    if request.end < request.start {
        return Err("end_datetime must be greater than or equal to start_datetime".to_string());
    }

    let resolved = request.resolved_chart;
    let transited_ids = inherited_or_override(
        &resolved.settings.default_bodies,
        Some(&request.transited_objects),
    );
    let radix = compute_positions(
        &resolved.chart,
        &resolved.model,
        transited_ids,
        &resolved.warnings,
    )?;
    let backend_used = radix.backend_used.clone();
    let ephemeris_source = radix.ephemeris_source.clone();
    let mut warnings = radix.warnings;

    let transiting_ids = inherited_or_override(
        &resolved.settings.default_bodies,
        Some(&request.transiting_objects),
    );
    let object_types = crate::domain::astrology::object_type_map(&resolved.model.body_definitions);
    let mut current = request.start;
    let step = Duration::seconds(request.time_step_seconds);
    let mut step_count = 0_i64;
    let mut results = Vec::new();

    while current <= request.end {
        step_count += 1;
        if step_count > MAX_TRANSIT_STEPS {
            return Err(format!(
                "Transit range too large (>{MAX_TRANSIT_STEPS} steps). Increase time step or reduce range."
            ));
        }

        let mut transit_chart = resolved.chart.clone();
        transit_chart.subject.event_time = Some(current);
        let transit = compute_positions(&transit_chart, &resolved.model, transiting_ids, &[])?;
        extend_unique(&mut warnings, transit.warnings);
        let mut aspects = crate::domain::astrology::compute_cross_aspects(
            &transit.positions,
            &radix.positions,
            &resolved.model.aspect_definitions,
            &resolved.settings.aspect_orbs,
            &request.aspect_types,
            &object_types,
        );
        aspects.extend(crate::domain::astrology::compute_chart_aspects(
            &transit.positions,
            &resolved.model.aspect_definitions,
            &resolved.settings.aspect_orbs,
            Some(&request.aspect_types),
            &object_types,
        ));
        results.push(TransitSeriesStep {
            datetime: current.to_rfc3339(),
            transit_positions: transit.positions,
            motion: transit.motion,
            aspects,
        });
        current += step;
    }

    Ok(TransitSeriesCalculation {
        source_chart_id: resolved.chart.id,
        time_range: TransitTimeRange {
            start: request.start.to_rfc3339(),
            end: request.end.to_rfc3339(),
        },
        time_step: format!("{}s", request.time_step_seconds),
        results,
        backend_used,
        fallback_used: false,
        ephemeris_source,
        warnings,
    })
}

/// The `sampled_series: false` counterpart to [`compute_transit_series`]:
/// skips the sampled-series loop entirely (`results` is always empty, and
/// `time_step` is the fixed sentinel `"n/a"`, never a rounded or assumed
/// step) for a request that only wants `exact_hits`/`station_events`/a
/// configuration search and has no use for `time_step_seconds` at all. Still
/// resolves the radix once so `backend_used`/`ephemeris_source`/`warnings`
/// stay populated — the response shape is uniform whether or not sampling
/// was requested, so a frontend never has to branch on which path produced
/// it.
pub fn compute_transit_series_events_only(
    resolved_chart: ResolvedChart,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    transited_objects: &[String],
) -> Result<TransitSeriesCalculation, String> {
    if end < start {
        return Err("end_datetime must be greater than or equal to start_datetime".to_string());
    }
    let transited_ids = inherited_or_override(
        &resolved_chart.settings.default_bodies,
        Some(transited_objects),
    );
    let radix = compute_positions(
        &resolved_chart.chart,
        &resolved_chart.model,
        transited_ids,
        &resolved_chart.warnings,
    )?;
    Ok(TransitSeriesCalculation {
        source_chart_id: resolved_chart.chart.id,
        time_range: TransitTimeRange {
            start: start.to_rfc3339(),
            end: end.to_rfc3339(),
        },
        time_step: "n/a".to_string(),
        results: Vec::new(),
        backend_used: radix.backend_used,
        fallback_used: false,
        ephemeris_source: radix.ephemeris_source,
        warnings: radix.warnings,
    })
}

// ─── Exact event search (`exact_hits` / `station_events`) ───────────────────
//
// Deliberately a separate computation from `compute_transit_series` above,
// not a parameter that changes how the sampled series itself is produced:
// `time_step_seconds` stays the sampled-series graph resolution exactly as
// before, and an event's `datetime` is a real root-found instant, never
// rounded to the nearest plotted sample.

/// Whether an exact-aspect event is a genuine crossing (the angular offset
/// passed through exact) or a tangential contact (it grazed exact and
/// receded without crossing — see `event_search::find_tangential_contacts`
/// for the heuristic's scope and stated limitations).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AspectContactKind {
    Crossing,
    Tangential,
}

/// Whether a station event is a genuine direction change or a tangential
/// contact (speed grazed zero without actually switching direct/retrograde
/// — see `event_search::find_tangential_contacts`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StationDirectionChange {
    DirectToRetrograde,
    RetrogradeToDirect,
    TangentialNoChange,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TransitEventKind {
    /// A transiting body exactly at `aspect_type`/`exact_angle` from either
    /// a fixed radix (`to` is a `transited_objects` id) or another
    /// transiting body (`to` is a `transiting_objects` id) — the same two
    /// shapes `compute_transit_series`'s own sampled `aspects` field
    /// already covers (`compute_cross_aspects` + `compute_chart_aspects`),
    /// just resolved to an exact instant instead of a per-sample orb.
    AspectHit {
        from: String,
        to: String,
        #[serde(rename = "type")]
        aspect_type: String,
        exact_angle: f64,
        contact: AspectContactKind,
        /// Independent of `contact`: `contact` describes the *geometry*
        /// (crossing vs. tangential graze), `confirmed` describes detection
        /// *confidence*. Always `true` for `AspectContactKind::Crossing`
        /// (sign-change-based, never ambiguous). For
        /// `AspectContactKind::Tangential`, `false` means the refined
        /// residual did not actually converge within tolerance (or
        /// regressed relative to the coarse sample that triggered the
        /// candidate) — see `event_search::TangentialContact`. Never drop a
        /// candidate silently; this field is how an unconfirmed one stays
        /// visible instead.
        confirmed: bool,
    },
    /// `body` (one of `transiting_objects`) reaches a zero-longitude-speed
    /// instant. Check `direction_change` for whether it actually switched
    /// direct/retrograde or only grazed zero without switching.
    Station {
        body: String,
        direction_change: StationDirectionChange,
        /// Same meaning as `AspectHit::confirmed` — always `true` for a
        /// genuine sign-change station; may be `false` only for
        /// `StationDirectionChange::TangentialNoChange`.
        confirmed: bool,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct TransitEvent {
    /// RFC3339, full precision — a real found instant, never rounded or
    /// snapped to a `compute_transit_series` sample timestamp.
    pub datetime: String,
    #[serde(flatten)]
    pub kind: TransitEventKind,
    /// Motion for every body this event concerns that is actually moving at
    /// this instant — one entry for a station or a fixed-point aspect hit
    /// (the transiting body only; the fixed/radix side has no motion of its
    /// own at this instant to report), two for a mutual aspect hit.
    pub motion: HashMap<String, AstronomyMotion>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransitEventSearch {
    /// Chronologically ordered regardless of which body/pair/branch found
    /// them.
    pub events: Vec<TransitEvent>,
    /// Multi-body configuration interval matches (Grand Trine, T-square,
    /// Grand Cross, Yod) — see `application::configuration_search`. Folded
    /// into the same `complete`/`warnings` below as every other search
    /// kind, rather than a second completeness axis.
    pub configuration_matches: Vec<ConfigurationMatch>,
    /// `false` means at least one individual body/pair/branch/configuration
    /// search did not finish (budget exhaustion) or outright failed (e.g.
    /// missing coverage) — `events`/`configuration_matches` are then
    /// necessarily partial. Check `warnings` for which ones.
    pub complete: bool,
    pub warnings: Vec<String>,
}

/// One requested multi-body configuration search — see
/// `application::configuration_search` for the matching algorithm.
#[derive(Debug, Clone)]
pub struct ConfigurationSearchRequest {
    /// One of `domain::configurations::BUILT_IN_CONFIGURATIONS`'ids
    /// (`grand_trine`, `t_square`, `yod`, `grand_cross`); an unknown id is
    /// reported as a warning, not an error, consistent with how an
    /// unrecognized aspect/body id elsewhere in this request is handled.
    pub configuration_id: String,
    /// Role names (from the definition) to evaluate against the resolved
    /// chart's own radix positions rather than resampling them.
    pub fixed_roles: Vec<String>,
    /// Role name -> allowed body ids. A role absent from this map defaults
    /// to the request's own `transiting_objects` (if not listed in
    /// `fixed_roles`) or `transited_objects` (if it is) — the same
    /// "explicit selection, falling back to the request's own default
    /// body set" pattern `exact_hits`/`station_events` already use.
    pub role_candidates: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct TransitEventSearchRequest {
    pub resolved_chart: ResolvedChart,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub transiting_objects: Vec<String>,
    pub transited_objects: Vec<String>,
    pub aspect_types: Vec<String>,
    pub exact_hits: bool,
    pub station_events: bool,
    pub configuration_requests: Vec<ConfigurationSearchRequest>,
}

/// Total probe budget shared across *every* individual body/pair/branch
/// search one `compute_transit_events` call performs, not a per-search
/// constant — a request selecting many bodies and aspect types plans many
/// independent searches (see `PlannedSearch` below), and without a shared
/// ceiling the wall-clock cost would scale with that combinatorial count
/// with no visible bound. Divided evenly per planned search (floored at
/// `MIN_PROBES_PER_SEARCH`), so a request with too many combinations for
/// its time range degrades to explicit `complete: false` rather than an
/// unbounded-feeling hang — the same "bounded, explicit, never silent"
/// policy `MAX_TRANSIT_STEPS` already applies to the sampled series.
const DEFAULT_TOTAL_EVENT_SEARCH_PROBES: u32 = 300_000;
const MIN_PROBES_PER_SEARCH: u32 = 500;

enum PlannedSearch {
    Station {
        body: String,
    },
    StationTangential {
        body: String,
    },
    AspectAgainstRadix {
        transiting: String,
        transited: String,
        aspect_type: String,
        angle: f64,
        transited_lon_deg: f64,
    },
    AspectAgainstRadixTangential {
        transiting: String,
        transited: String,
        aspect_type: String,
        angle: f64,
        transited_lon_deg: f64,
    },
    MutualAspect {
        from: String,
        to: String,
        aspect_type: String,
        angle: f64,
    },
    MutualAspectTangential {
        from: String,
        to: String,
        aspect_type: String,
        angle: f64,
    },
}

/// The two geometrically distinct exact longitudes a non-symmetric aspect
/// angle corresponds to (`target + angle` and `target - angle`, i.e.
/// `360 - angle`) — see `find_all_aspect_exact_times_against_fixed_point`'s
/// own doc comment. Conjunction (0 degrees) and opposition (180 degrees)
/// are self-symmetric and contribute only one branch, not two identical
/// searches.
pub(crate) fn aspect_angle_branches(exact_angle_deg: f64) -> Vec<f64> {
    if exact_angle_deg <= 0.0 || exact_angle_deg >= 180.0 {
        vec![exact_angle_deg]
    } else {
        vec![exact_angle_deg, 360.0 - exact_angle_deg]
    }
}

/// Divides the total event-search work-limit pool evenly across every
/// planned search, with a floor so a request with very many planned
/// searches still gives each one enough probes to resolve ordinary cases
/// (a station or a single aspect crossing) rather than guaranteeing
/// `incomplete` by construction. A request that plans more than
/// `DEFAULT_TOTAL_EVENT_SEARCH_PROBES / MIN_PROBES_PER_SEARCH` searches can
/// therefore spend above the nominal total pool — an explicit, bounded
/// trade favoring honest floor-level completeness per search over a hard
/// global cap that would silently starve every search in a large request.
fn allocate_event_search_probes(planned_count: usize) -> u32 {
    let planned_count = planned_count.max(1) as u32;
    (DEFAULT_TOTAL_EVENT_SEARCH_PROBES / planned_count).max(MIN_PROBES_PER_SEARCH)
}

pub fn compute_transit_events(
    request: TransitEventSearchRequest,
) -> Result<TransitEventSearch, String> {
    if !request.exact_hits && !request.station_events && request.configuration_requests.is_empty() {
        return Ok(TransitEventSearch {
            events: Vec::new(),
            configuration_matches: Vec::new(),
            complete: true,
            warnings: Vec::new(),
        });
    }
    if request.end < request.start {
        return Err("end_datetime must be greater than or equal to start_datetime".to_string());
    }

    let resolved = &request.resolved_chart;
    let ctx = EvaluationContext::new(&resolved.chart, &resolved.model);
    let transited_ids = inherited_or_override(
        &resolved.settings.default_bodies,
        Some(&request.transited_objects),
    );
    let transiting_ids = inherited_or_override(
        &resolved.settings.default_bodies,
        Some(&request.transiting_objects),
    );
    let object_types = crate::domain::astrology::object_type_map(&resolved.model.body_definitions);

    let mut planned: Vec<PlannedSearch> = Vec::new();

    if request.station_events {
        for body in transiting_ids {
            planned.push(PlannedSearch::Station { body: body.clone() });
            planned.push(PlannedSearch::StationTangential { body: body.clone() });
        }
    }

    if request.exact_hits {
        // Transiting-vs-radix: mirrors `compute_cross_aspects`'s own pairing
        // and eligibility rules exactly (same `AspectContext::Transit`),
        // using the radix chart's *own* resolved positions as the fixed
        // reference longitudes.
        let transited_refs: Vec<&str> = transited_ids.iter().map(String::as_str).collect();
        let radix_positions = ctx.radix_longitudes(&transited_refs)?;
        for transiting in transiting_ids {
            for transited in transited_ids {
                let Some(&transited_lon_deg) = radix_positions.get(transited) else {
                    continue; // radix side unavailable; compute_positions already warned.
                };
                let specs = crate::domain::astrology::eligible_aspects_for_pair(
                    &resolved.model.aspect_definitions,
                    &resolved.settings.aspect_orbs,
                    Some(&request.aspect_types),
                    AspectContext::Transit,
                    object_types.get(transiting),
                    object_types.get(transited),
                );
                for (aspect_type, exact_angle) in specs {
                    for angle in aspect_angle_branches(exact_angle) {
                        planned.push(PlannedSearch::AspectAgainstRadix {
                            transiting: transiting.clone(),
                            transited: transited.clone(),
                            aspect_type: aspect_type.clone(),
                            angle,
                            transited_lon_deg,
                        });
                        planned.push(PlannedSearch::AspectAgainstRadixTangential {
                            transiting: transiting.clone(),
                            transited: transited.clone(),
                            aspect_type: aspect_type.clone(),
                            angle,
                            transited_lon_deg,
                        });
                    }
                }
            }
        }

        // Transiting-vs-transiting (mutual): mirrors `compute_chart_aspects`'s
        // own pairing exactly (same `AspectContext::Chart`, same
        // structurally-locked-pair exclusion, same from < to ordering so a
        // pair is never searched twice in both directions).
        let mut sorted_transiting = transiting_ids.to_vec();
        sorted_transiting.sort();
        for (index, from) in sorted_transiting.iter().enumerate() {
            for to in sorted_transiting.iter().skip(index + 1) {
                if crate::domain::astrology::is_structurally_locked_aspect_pair(from, to) {
                    continue;
                }
                let specs = crate::domain::astrology::eligible_aspects_for_pair(
                    &resolved.model.aspect_definitions,
                    &resolved.settings.aspect_orbs,
                    Some(&request.aspect_types),
                    AspectContext::Chart,
                    object_types.get(from),
                    object_types.get(to),
                );
                for (aspect_type, exact_angle) in specs {
                    for angle in aspect_angle_branches(exact_angle) {
                        planned.push(PlannedSearch::MutualAspect {
                            from: from.clone(),
                            to: to.clone(),
                            aspect_type: aspect_type.clone(),
                            angle,
                        });
                        planned.push(PlannedSearch::MutualAspectTangential {
                            from: from.clone(),
                            to: to.clone(),
                            aspect_type: aspect_type.clone(),
                            angle,
                        });
                    }
                }
            }
        }
    }

    let per_search_probes =
        allocate_event_search_probes(planned.len() + request.configuration_requests.len());
    let limits = EventSearchLimits {
        max_probes: per_search_probes,
        ..EventSearchLimits::default()
    };
    let discovery_step = Duration::seconds(DEFAULT_EVENT_DISCOVERY_STEP_SECONDS);

    let mut events = Vec::new();
    let mut warnings = Vec::new();
    let mut complete = true;

    for item in planned {
        match item {
            PlannedSearch::Station { body } => {
                match find_all_stationary_points(
                    &ctx,
                    &body,
                    request.start,
                    request.end,
                    discovery_step,
                    limits,
                ) {
                    Ok(outcome) => {
                        if !outcome.complete {
                            complete = false;
                            warnings.push(format!("station_search_incomplete: {body}"));
                        }
                        for at in outcome.roots {
                            let direction = match station_direction_change(&ctx, &body, at) {
                                Ok(direction) => direction,
                                Err(error) => {
                                    complete = false;
                                    warnings.push(format!(
                                        "station_direction_unavailable: {body} at {at}: {error}"
                                    ));
                                    continue;
                                }
                            };
                            match motion_at(&ctx, &[&body], at) {
                                Ok(motion) => events.push(TransitEvent {
                                    datetime: at.to_rfc3339(),
                                    kind: TransitEventKind::Station {
                                        body: body.clone(),
                                        direction_change: direction,
                                        confirmed: true,
                                    },
                                    motion,
                                }),
                                Err(error) => {
                                    complete = false;
                                    warnings.push(format!(
                                        "station_event_motion_failed: {body} at {at}: {error}"
                                    ));
                                }
                            }
                        }
                    }
                    Err(error) => {
                        complete = false;
                        warnings.push(format!("station_search_failed: {body}: {error}"));
                    }
                }
            }
            PlannedSearch::StationTangential { body } => {
                match find_stationary_tangential_contacts(
                    &ctx,
                    &body,
                    request.start,
                    request.end,
                    discovery_step,
                    limits,
                ) {
                    Ok(outcome) => {
                        if !outcome.complete {
                            complete = false;
                            warnings.push(format!("station_tangential_search_incomplete: {body}"));
                        }
                        for contact in outcome.contacts {
                            let at = contact.time;
                            if !contact.confirmed {
                                warnings.push(format!(
                                    "station_tangential_contact_unconfirmed: {body} at {at}: residual={:.6} bracket_width_seconds={:.3}",
                                    contact.residual, contact.bracket_width_seconds
                                ));
                            }
                            match motion_at(&ctx, &[&body], at) {
                                Ok(motion) => events.push(TransitEvent {
                                    datetime: at.to_rfc3339(),
                                    kind: TransitEventKind::Station {
                                        body: body.clone(),
                                        direction_change:
                                            StationDirectionChange::TangentialNoChange,
                                        confirmed: contact.confirmed,
                                    },
                                    motion,
                                }),
                                Err(error) => {
                                    complete = false;
                                    warnings.push(format!(
                                        "station_tangential_event_motion_failed: {body} at {at}: {error}"
                                    ));
                                }
                            }
                        }
                    }
                    Err(error) => {
                        complete = false;
                        warnings.push(format!("station_tangential_search_failed: {body}: {error}"));
                    }
                }
            }
            PlannedSearch::AspectAgainstRadix {
                transiting,
                transited,
                aspect_type,
                angle,
                transited_lon_deg,
            } => {
                match find_all_aspect_exact_times_against_fixed_point(
                    &ctx,
                    &transiting,
                    transited_lon_deg,
                    angle,
                    request.start,
                    request.end,
                    discovery_step,
                    limits,
                ) {
                    Ok(outcome) => {
                        if !outcome.complete {
                            complete = false;
                            warnings.push(format!(
                                "aspect_search_incomplete: {transiting}_{aspect_type}_{transited}"
                            ));
                        }
                        for at in outcome.roots {
                            match motion_at(&ctx, &[&transiting], at) {
                                Ok(motion) => events.push(TransitEvent {
                                    datetime: at.to_rfc3339(),
                                    kind: TransitEventKind::AspectHit {
                                        from: transiting.clone(),
                                        to: transited.clone(),
                                        aspect_type: aspect_type.clone(),
                                        exact_angle: angle,
                                        contact: AspectContactKind::Crossing,
                                        confirmed: true,
                                    },
                                    motion,
                                }),
                                Err(error) => {
                                    complete = false;
                                    warnings.push(format!(
                                        "aspect_event_motion_failed: {transiting}_{aspect_type}_{transited} at {at}: {error}"
                                    ));
                                }
                            }
                        }
                    }
                    Err(error) => {
                        complete = false;
                        warnings.push(format!(
                            "aspect_search_failed: {transiting}_{aspect_type}_{transited}: {error}"
                        ));
                    }
                }
            }
            PlannedSearch::AspectAgainstRadixTangential {
                transiting,
                transited,
                aspect_type,
                angle,
                transited_lon_deg,
            } => {
                match find_aspect_tangential_contacts_against_fixed_point(
                    &ctx,
                    &transiting,
                    transited_lon_deg,
                    angle,
                    request.start,
                    request.end,
                    discovery_step,
                    limits,
                ) {
                    Ok(outcome) => {
                        if !outcome.complete {
                            complete = false;
                            warnings.push(format!(
                                "aspect_tangential_search_incomplete: {transiting}_{aspect_type}_{transited}"
                            ));
                        }
                        for contact in outcome.contacts {
                            let at = contact.time;
                            if !contact.confirmed {
                                warnings.push(format!(
                                    "aspect_tangential_contact_unconfirmed: {transiting}_{aspect_type}_{transited} at {at}: residual={:.6} bracket_width_seconds={:.3}",
                                    contact.residual, contact.bracket_width_seconds
                                ));
                            }
                            match motion_at(&ctx, &[&transiting], at) {
                                Ok(motion) => events.push(TransitEvent {
                                    datetime: at.to_rfc3339(),
                                    kind: TransitEventKind::AspectHit {
                                        from: transiting.clone(),
                                        to: transited.clone(),
                                        aspect_type: aspect_type.clone(),
                                        exact_angle: angle,
                                        contact: AspectContactKind::Tangential,
                                        confirmed: contact.confirmed,
                                    },
                                    motion,
                                }),
                                Err(error) => {
                                    complete = false;
                                    warnings.push(format!(
                                        "aspect_tangential_event_motion_failed: {transiting}_{aspect_type}_{transited} at {at}: {error}"
                                    ));
                                }
                            }
                        }
                    }
                    Err(error) => {
                        complete = false;
                        warnings.push(format!(
                            "aspect_tangential_search_failed: {transiting}_{aspect_type}_{transited}: {error}"
                        ));
                    }
                }
            }
            PlannedSearch::MutualAspect {
                from,
                to,
                aspect_type,
                angle,
            } => {
                match find_all_mutual_aspect_exact_times(
                    &ctx,
                    &from,
                    &to,
                    angle,
                    request.start,
                    request.end,
                    discovery_step,
                    limits,
                ) {
                    Ok(outcome) => {
                        if !outcome.complete {
                            complete = false;
                            warnings.push(format!(
                                "aspect_search_incomplete: {from}_{aspect_type}_{to}"
                            ));
                        }
                        for at in outcome.roots {
                            match motion_at(&ctx, &[&from, &to], at) {
                                Ok(motion) => events.push(TransitEvent {
                                    datetime: at.to_rfc3339(),
                                    kind: TransitEventKind::AspectHit {
                                        from: from.clone(),
                                        to: to.clone(),
                                        aspect_type: aspect_type.clone(),
                                        exact_angle: angle,
                                        contact: AspectContactKind::Crossing,
                                        confirmed: true,
                                    },
                                    motion,
                                }),
                                Err(error) => {
                                    complete = false;
                                    warnings.push(format!(
                                        "aspect_event_motion_failed: {from}_{aspect_type}_{to} at {at}: {error}"
                                    ));
                                }
                            }
                        }
                    }
                    Err(error) => {
                        complete = false;
                        warnings.push(format!(
                            "aspect_search_failed: {from}_{aspect_type}_{to}: {error}"
                        ));
                    }
                }
            }
            PlannedSearch::MutualAspectTangential {
                from,
                to,
                aspect_type,
                angle,
            } => {
                match find_mutual_aspect_tangential_contacts(
                    &ctx,
                    &from,
                    &to,
                    angle,
                    request.start,
                    request.end,
                    discovery_step,
                    limits,
                ) {
                    Ok(outcome) => {
                        if !outcome.complete {
                            complete = false;
                            warnings.push(format!(
                                "aspect_tangential_search_incomplete: {from}_{aspect_type}_{to}"
                            ));
                        }
                        for contact in outcome.contacts {
                            let at = contact.time;
                            if !contact.confirmed {
                                warnings.push(format!(
                                    "aspect_tangential_contact_unconfirmed: {from}_{aspect_type}_{to} at {at}: residual={:.6} bracket_width_seconds={:.3}",
                                    contact.residual, contact.bracket_width_seconds
                                ));
                            }
                            match motion_at(&ctx, &[&from, &to], at) {
                                Ok(motion) => events.push(TransitEvent {
                                    datetime: at.to_rfc3339(),
                                    kind: TransitEventKind::AspectHit {
                                        from: from.clone(),
                                        to: to.clone(),
                                        aspect_type: aspect_type.clone(),
                                        exact_angle: angle,
                                        contact: AspectContactKind::Tangential,
                                        confirmed: contact.confirmed,
                                    },
                                    motion,
                                }),
                                Err(error) => {
                                    complete = false;
                                    warnings.push(format!(
                                        "aspect_tangential_event_motion_failed: {from}_{aspect_type}_{to} at {at}: {error}"
                                    ));
                                }
                            }
                        }
                    }
                    Err(error) => {
                        complete = false;
                        warnings.push(format!(
                            "aspect_tangential_search_failed: {from}_{aspect_type}_{to}: {error}"
                        ));
                    }
                }
            }
        }
    }

    let mut configuration_matches = Vec::new();
    for configuration_request in &request.configuration_requests {
        let Some(definition) = crate::domain::configurations::configuration_definition(
            &configuration_request.configuration_id,
        ) else {
            complete = false;
            warnings.push(format!(
                "configuration_unknown_id: {}",
                configuration_request.configuration_id
            ));
            continue;
        };

        let mut role_pools: HashMap<&'static str, ResolvedRole> = HashMap::new();
        for &role in definition.roles {
            let is_fixed = configuration_request
                .fixed_roles
                .iter()
                .any(|fixed_role| fixed_role == role);
            let candidates = configuration_request
                .role_candidates
                .get(role)
                .filter(|candidates| !candidates.is_empty())
                .cloned()
                .unwrap_or_else(|| {
                    if is_fixed {
                        transited_ids.to_vec()
                    } else {
                        transiting_ids.to_vec()
                    }
                });
            role_pools.insert(
                role,
                ResolvedRole {
                    candidates,
                    is_fixed,
                },
            );
        }

        match search_configuration(
            &ctx,
            &resolved.model.aspect_definitions,
            &resolved.settings.aspect_orbs,
            &object_types,
            definition,
            &role_pools,
            request.start,
            request.end,
            discovery_step,
            limits,
        ) {
            Ok(outcome) => {
                if !outcome.complete {
                    complete = false;
                }
                for warning in outcome.warnings {
                    warnings.push(warning);
                }
                configuration_matches.extend(outcome.matches);
            }
            Err(error) => {
                complete = false;
                warnings.push(format!(
                    "configuration_search_failed: {}: {error}",
                    configuration_request.configuration_id
                ));
            }
        }
    }

    events.sort_by(|a, b| a.datetime.cmp(&b.datetime));

    Ok(TransitEventSearch {
        events,
        configuration_matches,
        complete,
        warnings,
    })
}

/// Motion for `ids` at the exact event instant `at` — a fresh, separate
/// sample from whatever coarse/bisection probes found the event, so a
/// reported event's motion is never interpolated or reused from a nearby
/// search probe.
fn motion_at(
    ctx: &EvaluationContext,
    ids: &[&str],
    at: DateTime<Utc>,
) -> Result<HashMap<String, AstronomyMotion>, String> {
    ctx.motions(ids, at)
}

/// A station found via ordinary sign-change discovery (`find_all_stationary_points`)
/// is *by construction* a real direction change — its bracket's two endpoints
/// already disagree in sign. Resampling at a small fixed offset either side
/// of the found instant and comparing signs is therefore a cheap (two extra
/// `motion_at` probes), reliable way to label which direction, rather than
/// threading the original bisection bracket's signs all the way out of
/// `event_search`'s validated, already-tested internals. Safe because
/// stations are weeks apart for every body this application supports — see
/// `DEFAULT_EVENT_DISCOVERY_STEP_SECONDS`'s own justification — so a
/// +/-10 minute resample can never straddle a second, different station.
const STATION_DIRECTION_SAMPLE_OFFSET_MINUTES: i64 = 10;

fn station_direction_change(
    ctx: &EvaluationContext,
    body_id: &str,
    at: DateTime<Utc>,
) -> Result<StationDirectionChange, String> {
    let offset = Duration::minutes(STATION_DIRECTION_SAMPLE_OFFSET_MINUTES);
    let before = motion_at(ctx, &[body_id], at - offset)?;
    let after = motion_at(ctx, &[body_id], at + offset)?;
    let before_speed = before
        .get(body_id)
        .map(|motion| motion.speed)
        .ok_or_else(|| format!("{body_id}_motion_unavailable"))?;
    let after_speed = after
        .get(body_id)
        .map(|motion| motion.speed)
        .ok_or_else(|| format!("{body_id}_motion_unavailable"))?;
    match (before_speed >= 0.0, after_speed >= 0.0) {
        (true, false) => Ok(StationDirectionChange::DirectToRetrograde),
        (false, true) => Ok(StationDirectionChange::RetrogradeToDirect),
        _ => Err(format!(
            "station_direction_ambiguous: before_speed={before_speed}, after_speed={after_speed}"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::chart_resolution::resolve_standalone_chart;
    use crate::test_support::sample_chart_payload;

    fn resolved_sample_chart() -> ResolvedChart {
        // Resolved the same way a real standalone-chart request resolves
        // one, so these orchestration tests exercise the same settings
        // resolution (default bodies, aspect definitions/orbs) a live
        // Tauri call would — not a hand-built stand-in.
        let payload = sample_chart_payload("transit-event-orchestration-test");
        resolve_standalone_chart(&payload, None).expect("sample chart payload should resolve")
    }

    fn year_2024() -> (DateTime<Utc>, DateTime<Utc>) {
        let start = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        (start, start + Duration::days(365))
    }

    #[allow(clippy::too_many_arguments)]
    fn request(
        resolved_chart: ResolvedChart,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        transiting_objects: Vec<String>,
        transited_objects: Vec<String>,
        aspect_types: Vec<String>,
        exact_hits: bool,
        station_events: bool,
    ) -> TransitEventSearchRequest {
        TransitEventSearchRequest {
            resolved_chart,
            start,
            end,
            transiting_objects,
            transited_objects,
            aspect_types,
            exact_hits,
            station_events,
            configuration_requests: Vec::new(),
        }
    }

    fn assert_chronological(events: &[TransitEvent]) {
        for pair in events.windows(2) {
            assert!(
                pair[0].datetime <= pair[1].datetime,
                "events must be sorted chronologically: {:?} then {:?}",
                pair[0].datetime,
                pair[1].datetime
            );
        }
    }

    // ─── Flag combinations ──────────────────────────────────────────────

    #[test]
    fn both_flags_false_preserves_existing_sampled_series_behavior_by_returning_no_events() {
        let (start, end) = year_2024();
        let result = compute_transit_events(request(
            resolved_sample_chart(),
            start,
            end,
            vec!["mercury".to_string()],
            vec!["sun".to_string()],
            vec!["conjunction".to_string()],
            false,
            false,
        ))
        .expect("a both-false request must not error");

        assert!(result.events.is_empty());
        assert!(result.complete);
        assert!(result.warnings.is_empty());
    }

    #[test]
    fn exact_hits_only_finds_moving_vs_fixed_radix_aspect_hits_and_no_stations() {
        let (start, end) = year_2024();
        let result = compute_transit_events(request(
            resolved_sample_chart(),
            start,
            end,
            vec!["moon".to_string()],
            vec!["sun".to_string()],
            vec!["conjunction".to_string(), "square".to_string()],
            true,
            false,
        ))
        .expect("search should not error");

        assert!(result.complete, "warnings: {:?}", result.warnings);
        assert!(
            !result.events.is_empty(),
            "the Moon should hit conjunction/square against the natal Sun repeatedly over a year"
        );
        for event in &result.events {
            match &event.kind {
                TransitEventKind::AspectHit { from, to, .. } => {
                    assert_eq!(from, "moon");
                    assert_eq!(to, "sun");
                }
                TransitEventKind::Station { .. } => {
                    panic!("station_events was false; no Station event should be produced")
                }
            }
        }
        assert_chronological(&result.events);

        // Every real crossing found must be reported as a genuine crossing,
        // not mislabeled tangential -- the Moon-vs-Sun conjunction/square
        // cycle has no tangential contacts (it's the Moon's ordinary,
        // monotonic monthly cycle against a fixed point, never a
        // near-miss retrograde dance).
        assert!(
            result.events.iter().all(|e| matches!(
                &e.kind,
                TransitEventKind::AspectHit {
                    contact: AspectContactKind::Crossing,
                    ..
                }
            )),
            "expected no tangential contacts for a simple lunar cycle: {:?}",
            result.events
        );

        // Roughly one conjunction (New Moon) and two square hits (first/last
        // quarter) per ~29.5-day synodic month: a sanity range, not a
        // precise external reference.
        let conjunctions = result
            .events
            .iter()
            .filter(|e| matches!(&e.kind, TransitEventKind::AspectHit { aspect_type, .. } if aspect_type == "conjunction"))
            .count();
        assert!(
            (11..=14).contains(&conjunctions),
            "expected ~12-13 lunar conjunctions with the natal Sun in a year, found {conjunctions}"
        );
    }

    #[test]
    fn station_events_only_finds_stations_and_no_aspect_hits() {
        let (start, end) = year_2024();
        let result = compute_transit_events(request(
            resolved_sample_chart(),
            start,
            end,
            vec!["mercury".to_string()],
            vec!["sun".to_string()],
            vec!["conjunction".to_string()],
            false,
            true,
        ))
        .expect("search should not error");

        assert!(result.complete, "warnings: {:?}", result.warnings);
        let mut direction_changes = Vec::new();
        for event in &result.events {
            match &event.kind {
                TransitEventKind::Station {
                    body,
                    direction_change,
                    ..
                } => {
                    assert_eq!(body, "mercury");
                    direction_changes.push(*direction_change);
                }
                TransitEventKind::AspectHit { .. } => {
                    panic!("exact_hits was false; no AspectHit event should be produced")
                }
            }
        }
        assert_chronological(&result.events);

        // A real Mercury station alternates direct<->retrograde every time;
        // over a full year it should never report two consecutive stations
        // changing in the *same* direction, and tangential (non-crossing)
        // grazes are not expected for Mercury's ordinary retrograde loops.
        assert!(
            direction_changes
                .iter()
                .all(|d| *d != StationDirectionChange::TangentialNoChange),
            "expected no tangential station contacts for Mercury's ordinary retrograde loops: {direction_changes:?}"
        );
        for pair in direction_changes.windows(2) {
            assert_ne!(
                pair[0], pair[1],
                "consecutive real stations must alternate direction: {direction_changes:?}"
            );
        }

        // Mirrors `find_all_stationary_points_finds_every_mercury_station_in_a_full_year`
        // in `event_search.rs` — this is the same search reached through the
        // orchestration layer rather than called directly.
        assert!(
            result.events.len() >= 5 && result.events.len() <= 8,
            "expected roughly 6-7 Mercury stations in a full year, found {}",
            result.events.len()
        );
    }

    #[test]
    fn both_flags_true_finds_both_stations_and_aspect_hits_interleaved_chronologically() {
        let (start, end) = year_2024();
        let result = compute_transit_events(request(
            resolved_sample_chart(),
            start,
            end,
            vec!["mercury".to_string()],
            vec!["sun".to_string()],
            vec!["conjunction".to_string()],
            true,
            true,
        ))
        .expect("search should not error");

        assert!(result.complete, "warnings: {:?}", result.warnings);
        let has_station = result
            .events
            .iter()
            .any(|e| matches!(e.kind, TransitEventKind::Station { .. }));
        let has_aspect_hit = result
            .events
            .iter()
            .any(|e| matches!(e.kind, TransitEventKind::AspectHit { .. }));
        assert!(has_station, "expected at least one Station event");
        assert!(has_aspect_hit, "expected at least one AspectHit event");
        assert_chronological(&result.events);
    }

    /// Exact-aspect, station, and configuration search all requested in one
    /// call, sharing the single `EvaluationContext` `compute_transit_events`
    /// constructs for the whole request. Proves the shared context didn't
    /// change search semantics for any of the three kinds when run
    /// together, not just individually (the other tests in this module).
    /// Reuses the same real Mars-Jupiter-Saturn Grand Trine window already
    /// validated in `application::configuration_search`'s own tests.
    #[test]
    fn combined_exact_hits_station_events_and_configuration_request_in_one_call() {
        let start = DateTime::parse_from_rfc3339("2025-09-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = DateTime::parse_from_rfc3339("2025-12-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let configuration_requests = vec![ConfigurationSearchRequest {
            configuration_id: "grand_trine".to_string(),
            fixed_roles: Vec::new(),
            role_candidates: HashMap::new(),
        }];

        let result = compute_transit_events(TransitEventSearchRequest {
            resolved_chart: resolved_sample_chart(),
            start,
            end,
            transiting_objects: vec![
                "mars".to_string(),
                "jupiter".to_string(),
                "saturn".to_string(),
            ],
            transited_objects: vec!["sun".to_string()],
            aspect_types: vec!["conjunction".to_string()],
            exact_hits: true,
            station_events: true,
            configuration_requests,
        })
        .expect("search should not error");

        assert!(result.complete, "warnings: {:?}", result.warnings);
        assert!(
            !result.configuration_matches.is_empty(),
            "expected the real Mars-Jupiter-Saturn Grand Trine to still be found alongside exact_hits/station_events"
        );
        assert_chronological(&result.events);
    }

    #[test]
    fn exact_hits_finds_mutual_aspect_hits_between_two_moving_bodies() {
        let (start, end) = year_2024();
        // `transited_objects` is deliberately unrelated to the transiting
        // pair, isolating the moving-vs-moving (New Moon) count from any
        // moving-vs-radix combos the same request also plans.
        let result = compute_transit_events(request(
            resolved_sample_chart(),
            start,
            end,
            vec!["moon".to_string(), "sun".to_string()],
            vec!["mercury".to_string()],
            vec!["conjunction".to_string()],
            true,
            false,
        ))
        .expect("search should not error");

        assert!(result.complete, "warnings: {:?}", result.warnings);
        let mutual_conjunctions: Vec<_> = result
            .events
            .iter()
            .filter(|e| {
                matches!(&e.kind, TransitEventKind::AspectHit { from, to, .. }
                    if (from == "moon" && to == "sun") || (from == "sun" && to == "moon"))
            })
            .collect();
        assert!(
            mutual_conjunctions.len() >= 12 && mutual_conjunctions.len() <= 13,
            "expected 12-13 New Moons (moon-sun mutual conjunctions) in a year, found {}",
            mutual_conjunctions.len()
        );
        // Mutual aspects are reported from the alphabetically-sorted pair,
        // mirroring the existing sampled-series `compute_cross_aspects`
        // ordering convention (`moon` < `sun`).
        for event in &mutual_conjunctions {
            if let TransitEventKind::AspectHit { from, to, .. } = &event.kind {
                assert_eq!(from, "moon");
                assert_eq!(to, "sun");
            }
        }
    }

    #[test]
    fn structurally_locked_pairs_are_excluded_from_mutual_aspect_search() {
        let (start, end) = year_2024();
        let result = compute_transit_events(request(
            resolved_sample_chart(),
            start,
            end,
            vec!["north_node".to_string(), "south_node".to_string()],
            vec!["sun".to_string()],
            vec!["opposition".to_string()],
            true,
            false,
        ))
        .expect("search should not error");

        assert!(result.complete, "warnings: {:?}", result.warnings);
        let locked_pair_hit = result.events.iter().any(|e| {
            matches!(&e.kind, TransitEventKind::AspectHit { from, to, .. }
                if (from == "north_node" && to == "south_node")
                    || (from == "south_node" && to == "north_node"))
        });
        assert!(
            !locked_pair_hit,
            "the structurally-fixed node/anti-node pair must never be searched as a mutual aspect"
        );
    }

    // ─── Local execution / missing coverage ────────────────────────────

    #[test]
    fn missing_kernel_coverage_surfaces_as_an_explicit_warning_not_a_silent_empty_success() {
        let result = compute_transit_events(request(
            resolved_sample_chart(),
            DateTime::parse_from_rfc3339("3000-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            DateTime::parse_from_rfc3339("3000-02-01T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            vec!["mercury".to_string()],
            vec!["sun".to_string()],
            vec!["conjunction".to_string()],
            false,
            true,
        ))
        .expect("an out-of-coverage epoch must not hard-error the whole request");

        assert!(
            !result.complete,
            "a failed search must not be reported as a complete, successful no-events result"
        );
        assert!(
            !result.warnings.is_empty(),
            "a failed search must leave an explicit diagnostic behind"
        );
        assert!(result.events.is_empty());
    }

    #[test]
    fn invalid_range_is_rejected_before_any_search_runs() {
        let start = DateTime::parse_from_rfc3339("2024-06-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let end = start - Duration::days(1);
        let result = compute_transit_events(request(
            resolved_sample_chart(),
            start,
            end,
            vec!["mercury".to_string()],
            vec!["sun".to_string()],
            vec!["conjunction".to_string()],
            true,
            true,
        ));
        assert!(result.is_err());
    }

    // ─── Independence from the sampled-series graph resolution ─────────

    #[test]
    fn event_search_request_has_no_sampling_resolution_parameter() {
        // `time_step_seconds` governs `TransitSeriesRequest` (the sampled
        // series) only; `TransitEventSearchRequest` has no equivalent field,
        // so there is structurally nothing for a graph sampling resolution
        // to couple to. This test documents that guarantee and confirms the
        // search itself is deterministic given identical inputs.
        let (start, end) = year_2024();
        let build = || {
            request(
                resolved_sample_chart(),
                start,
                end,
                vec!["mercury".to_string()],
                vec!["sun".to_string()],
                vec!["conjunction".to_string()],
                true,
                true,
            )
        };
        let first = compute_transit_events(build()).expect("first run should not error");
        let second = compute_transit_events(build()).expect("second run should not error");

        let first_times: Vec<&str> = first.events.iter().map(|e| e.datetime.as_str()).collect();
        let second_times: Vec<&str> = second.events.iter().map(|e| e.datetime.as_str()).collect();
        assert_eq!(
            first_times, second_times,
            "identical requests must find identical events regardless of any \
             graph-sampling setting, since none is ever consulted here"
        );
    }

    // ─── Work-limit allocation (pure function; no ephemeris calls) ─────
    //
    // Forcing a real, ephemeris-backed search to exhaust `max_probes` costs
    // up to the entire `DEFAULT_TOTAL_EVENT_SEARCH_PROBES` pool by design
    // (see `allocate_event_search_probes`'s doc comment) — too slow for a
    // routine test. `find_all_stationary_points_reports_incomplete_when_budget_is_too_small_for_a_real_search`
    // in `event_search.rs` already proves the underlying completeness flag
    // propagates correctly for a cheap, deliberately tiny budget; these
    // tests cover the allocation formula itself in isolation.

    #[test]
    fn probe_allocation_gives_a_single_search_the_whole_pool() {
        assert_eq!(
            allocate_event_search_probes(1),
            DEFAULT_TOTAL_EVENT_SEARCH_PROBES
        );
    }

    #[test]
    fn probe_allocation_divides_the_pool_evenly_before_the_floor() {
        assert_eq!(
            allocate_event_search_probes(10),
            DEFAULT_TOTAL_EVENT_SEARCH_PROBES / 10
        );
    }

    #[test]
    fn probe_allocation_never_drops_below_the_floor_for_very_large_requests() {
        assert_eq!(allocate_event_search_probes(10_000), MIN_PROBES_PER_SEARCH);
        assert_eq!(
            allocate_event_search_probes(usize::MAX),
            MIN_PROBES_PER_SEARCH
        );
    }

    /// Representative end-to-end `compute_transit_events` call: one
    /// transiting body, one fixed radix point, one aspect type, both
    /// `exact_hits` and `station_events` on, over a full year — the same
    /// combination exercised functionally by
    /// `both_flags_true_finds_both_stations_and_aspect_hits_interleaved_chronologically`
    /// above, timed here instead of merely asserted correct. Verifies the
    /// search actually finds both event kinds before timing it, so this
    /// cannot silently measure a no-op path.
    /// Run with: `cargo test --release --lib compute_transit_events_benchmark -- --ignored --nocapture`
    #[test]
    #[ignore = "diagnostic benchmark; run manually on the target machine"]
    fn compute_transit_events_benchmark() {
        use std::time::Instant;

        // 10, not a smaller round number: at n=10 the p95 index is a
        // genuine 9th-of-10 rank, not simply the sample maximum.
        const REPETITIONS: u32 = 10;

        let (start, end) = year_2024();
        let build = || {
            request(
                resolved_sample_chart(),
                start,
                end,
                vec!["mercury".to_string()],
                vec!["sun".to_string()],
                vec!["conjunction".to_string()],
                true,
                true,
            )
        };

        // Warm-up (excludes almanac construction from timed samples).
        let warm_up = compute_transit_events(build()).expect("warm-up search should not error");
        assert!(warm_up.complete, "warnings: {:?}", warm_up.warnings);

        let mut samples = Vec::with_capacity(REPETITIONS as usize);
        let mut last_event_count = 0usize;
        for _ in 0..REPETITIONS {
            let run_start = Instant::now();
            let result = compute_transit_events(build()).expect("search should not error");
            samples.push(run_start.elapsed());
            assert!(result.complete, "warnings: {:?}", result.warnings);
            assert!(
                result
                    .events
                    .iter()
                    .any(|e| matches!(e.kind, TransitEventKind::Station { .. })),
                "expected at least one station event"
            );
            assert!(
                result
                    .events
                    .iter()
                    .any(|e| matches!(e.kind, TransitEventKind::AspectHit { .. })),
                "expected at least one aspect-hit event"
            );
            last_event_count = result.events.len();
        }

        samples.sort_unstable();
        let p50 = samples[samples.len() / 2];
        let p95 = samples[(samples.len() * 95 / 100).min(samples.len() - 1)];
        println!(
            "compute_transit_events benchmark: body=mercury, target=sun (radix), \
             aspect=conjunction, window=1y, exact_hits=true, station_events=true, \
             events_found={last_event_count}, repetitions={REPETITIONS}, p50={p50:?}, p95={p95:?}"
        );
    }
}
