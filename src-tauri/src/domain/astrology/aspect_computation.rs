use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::workspace::models::{
    AspectContext, AspectDefinition, ObjectType, ObjectTypeRule, PER_OBJECT_ORB_TYPES,
};

use super::geometry::shortest_arc_deg;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ComputedAspect {
    pub from: String,
    pub to: String,
    #[serde(rename = "type")]
    pub aspect_type: String,
    pub angle: f64,
    pub orb: f64,
    pub exact_angle: f64,
    /// The orb limit that admitted this aspect (model default or user override, whichever
    /// `detect_aspect` matched against) — lets consumers express "closeness to exact" as a
    /// fraction of the boundary that was actually used, rather than re-resolving orb settings.
    pub allowed_orb: f64,
    pub applying: bool,
    pub separating: bool,
}

/// Point pairs whose separation is fixed at exactly 180° by definition (the second point is
/// computed as the first plus 180°), so any "opposition" between them is a mathematical
/// certainty rather than an astrological observation. Excluded from aspect detection entirely —
/// no other aspect type could ever fire for a pair locked at 180° anyway.
const STRUCTURALLY_LOCKED_PAIRS: [(&str, &str); 3] =
    [("asc", "desc"), ("ic", "mc"), ("north_node", "south_node")];

fn is_structurally_locked_pair(from: &str, to: &str) -> bool {
    STRUCTURALLY_LOCKED_PAIRS
        .iter()
        .any(|(a, b)| (from == *a && to == *b) || (from == *b && to == *a))
}

fn pair_allowed(
    rule: Option<&ObjectTypeRule>,
    from_type: Option<&ObjectType>,
    to_type: Option<&ObjectType>,
) -> bool {
    match rule {
        None => true,
        Some(ObjectTypeRule::Exclude { types }) => {
            !from_type.is_some_and(|value| types.contains(value))
                && !to_type.is_some_and(|value| types.contains(value))
        }
        Some(ObjectTypeRule::OnlyBetween { types }) => {
            from_type.is_some_and(|value| types.contains(value))
                && to_type.is_some_and(|value| types.contains(value))
        }
    }
}

pub fn compute_chart_aspects(
    positions: &HashMap<String, f64>,
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    aspect_types: Option<&[String]>,
    object_types: &HashMap<String, ObjectType>,
    object_orbs: &HashMap<String, f64>,
) -> Vec<ComputedAspect> {
    let specs = selected_aspects(
        aspect_definitions,
        aspect_orbs,
        aspect_types,
        AspectContext::Chart,
    );
    let mut ids: Vec<&String> = positions.keys().collect();
    ids.sort();

    let mut aspects = Vec::new();
    for (index, from) in ids.iter().enumerate() {
        for to in ids.iter().skip(index + 1) {
            if is_structurally_locked_pair(from, to) {
                continue;
            }
            let angle = shortest_arc_deg(
                *positions.get(*from).unwrap_or(&0.0),
                *positions.get(*to).unwrap_or(&0.0),
            );
            if let Some((aspect_type, exact_angle, orb, allowed_orb)) = detect_aspect(
                angle,
                &specs,
                from,
                to,
                object_types.get(*from),
                object_types.get(*to),
                object_orbs,
            ) {
                aspects.push(ComputedAspect {
                    from: (*from).clone(),
                    to: (*to).clone(),
                    aspect_type,
                    angle,
                    orb,
                    exact_angle,
                    allowed_orb,
                    applying: false,
                    separating: false,
                });
            }
        }
    }
    aspects
}

pub fn compute_cross_aspects(
    transiting_positions: &HashMap<String, f64>,
    transited_positions: &HashMap<String, f64>,
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    aspect_types: &[String],
    object_types: &HashMap<String, ObjectType>,
    object_orbs: &HashMap<String, f64>,
) -> Vec<ComputedAspect> {
    let specs = selected_aspects(
        aspect_definitions,
        aspect_orbs,
        Some(aspect_types),
        AspectContext::Transit,
    );
    let mut transiting_ids: Vec<&String> = transiting_positions.keys().collect();
    let mut transited_ids: Vec<&String> = transited_positions.keys().collect();
    transiting_ids.sort();
    transited_ids.sort();

    let mut aspects = Vec::new();
    for from in transiting_ids {
        let from_lon = *transiting_positions.get(from).unwrap_or(&0.0);
        for to in &transited_ids {
            let to_lon = *transited_positions.get(*to).unwrap_or(&0.0);
            let angle = shortest_arc_deg(from_lon, to_lon);
            if let Some((aspect_type, exact_angle, orb, allowed_orb)) = detect_aspect(
                angle,
                &specs,
                from,
                to,
                object_types.get(from),
                object_types.get(*to),
                object_orbs,
            ) {
                aspects.push(ComputedAspect {
                    from: from.clone(),
                    to: (*to).clone(),
                    aspect_type,
                    angle,
                    orb,
                    exact_angle,
                    allowed_orb,
                    applying: false,
                    separating: false,
                });
            }
        }
    }
    aspects
}

struct AspectSpec<'a> {
    id: String,
    exact_angle: f64,
    allowed_orb: f64,
    object_type_rule: Option<&'a ObjectTypeRule>,
}

fn is_extended_object(object_type: Option<&ObjectType>) -> bool {
    object_type.is_some_and(|value| PER_OBJECT_ORB_TYPES.contains(value))
}

/// Narrows `base_orb` to the tightest per-object override in `object_orbs` for
/// whichever side(s) of the pair are eligible for one (see [`PER_OBJECT_ORB_TYPES`]
/// — in practice every real object category) — global across every aspect, unlike
/// the old per-aspect `extended_orb` it replaces (see
/// `workspace::models::WorkspaceDefaults::object_orbs`). Never widens: an object
/// with no override set yet keeps `base_orb`.
#[allow(clippy::too_many_arguments)]
fn resolve_allowed_orb(
    base_orb: f64,
    from_id: &str,
    to_id: &str,
    from_type: Option<&ObjectType>,
    to_type: Option<&ObjectType>,
    object_orbs: &HashMap<String, f64>,
) -> f64 {
    [
        is_extended_object(from_type)
            .then(|| object_orbs.get(from_id))
            .flatten(),
        is_extended_object(to_type)
            .then(|| object_orbs.get(to_id))
            .flatten(),
    ]
    .into_iter()
    .flatten()
    .copied()
    .fold(base_orb, f64::min)
}

/// Enabled, context-valid, type-selected aspect ids and their exact angle for
/// one specific body-type pair — "which aspects would even be considered for
/// this pair," independent of any particular instantaneous separation (no
/// orb is applied or returned). This is the same eligibility logic
/// `compute_chart_aspects`/`compute_cross_aspects` use via `selected_aspects`
/// + `pair_allowed` internally, exposed so exact-event-time discovery (which
/// has no "current separation" to test an orb against) can determine exactly
/// the same set of (aspect, exact_angle) combinations the sampled path would
/// ever report for this pair, rather than re-deriving selection rules
/// separately and risking the two silently drifting apart.
pub fn eligible_aspects_for_pair(
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    aspect_types: Option<&[String]>,
    context: AspectContext,
    from_type: Option<&ObjectType>,
    to_type: Option<&ObjectType>,
) -> Vec<(String, f64)> {
    selected_aspects(aspect_definitions, aspect_orbs, aspect_types, context)
        .into_iter()
        .filter(|spec| pair_allowed(spec.object_type_rule, from_type, to_type))
        .map(|spec| (spec.id, spec.exact_angle))
        .collect()
}

/// Like [`eligible_aspects_for_pair`], but for one already-known aspect id
/// rather than a selection filter, additionally returning its resolved
/// allowed orb for this specific pair (including the global per-object
/// `object_orbs` narrowing — see [`resolve_allowed_orb`]) — exactly the orb a
/// live `detect_aspect` call would use for this pair. `None` if the aspect is
/// disabled, invalid for `context`, or excluded for this pair by
/// `object_type_rule`. Exposed for `application::configuration_search`'s
/// edge-eligibility and orb-interval lookups, for the same "don't re-derive
/// selection rules separately and risk drift" reason `eligible_aspects_for_pair`
/// itself was added.
#[allow(clippy::too_many_arguments)]
pub fn eligible_aspect_angle_and_orb(
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    aspect_id: &str,
    context: AspectContext,
    from_id: &str,
    to_id: &str,
    from_type: Option<&ObjectType>,
    to_type: Option<&ObjectType>,
    object_orbs: &HashMap<String, f64>,
) -> Option<(f64, f64)> {
    let spec = selected_aspects(aspect_definitions, aspect_orbs, None, context)
        .into_iter()
        .find(|spec| spec.id == aspect_id)?;
    if !pair_allowed(spec.object_type_rule, from_type, to_type) {
        return None;
    }
    let allowed_orb = resolve_allowed_orb(
        spec.allowed_orb,
        from_id,
        to_id,
        from_type,
        to_type,
        object_orbs,
    );
    Some((spec.exact_angle, allowed_orb))
}

/// Whether `(from, to)` is excluded from moving-vs-moving aspect detection
/// because their separation is fixed by definition (see
/// `STRUCTURALLY_LOCKED_PAIRS`). Exposed so event-time discovery mirrors
/// `compute_chart_aspects`'s own exclusion instead of silently omitting or
/// re-deriving it.
pub fn is_structurally_locked_aspect_pair(from: &str, to: &str) -> bool {
    is_structurally_locked_pair(from, to)
}

fn selected_aspects<'a>(
    aspect_definitions: &'a [AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    selected_types: Option<&[String]>,
    context: AspectContext,
) -> Vec<AspectSpec<'a>> {
    let selected: Option<HashSet<String>> = selected_types.map(|types| {
        types
            .iter()
            .map(|aspect_type| aspect_type.trim().to_ascii_lowercase())
            .collect()
    });

    aspect_definitions
        .iter()
        .filter_map(|definition| {
            if !definition.enabled
                || definition.valid_contexts.as_ref().is_some_and(|contexts| {
                    !contexts.is_empty()
                        && !contexts.iter().any(|candidate| {
                            std::mem::discriminant(candidate) == std::mem::discriminant(&context)
                        })
                })
            {
                return None;
            }
            let id = definition.id.clone();
            if let Some(filter) = &selected {
                if !filter.contains(&id.trim().to_ascii_lowercase()) {
                    return None;
                }
            }
            let orb = aspect_orbs
                .get(&definition.id)
                .copied()
                .unwrap_or(definition.default_orb)
                .max(0.0);
            Some(AspectSpec {
                id,
                exact_angle: definition.angle,
                allowed_orb: orb,
                object_type_rule: definition.object_type_rule.as_ref(),
            })
        })
        .collect()
}

#[allow(clippy::too_many_arguments)]
fn detect_aspect(
    angle: f64,
    specs: &[AspectSpec],
    from_id: &str,
    to_id: &str,
    from_type: Option<&ObjectType>,
    to_type: Option<&ObjectType>,
    object_orbs: &HashMap<String, f64>,
) -> Option<(String, f64, f64, f64)> {
    for spec in specs {
        if !pair_allowed(spec.object_type_rule, from_type, to_type) {
            continue;
        }
        let allowed_orb = resolve_allowed_orb(
            spec.allowed_orb,
            from_id,
            to_id,
            from_type,
            to_type,
            object_orbs,
        );
        let normalized_exact = if spec.exact_angle > 180.0 {
            360.0 - spec.exact_angle
        } else {
            spec.exact_angle
        };
        let orb = (angle - normalized_exact).abs();
        if orb <= allowed_orb {
            return Some((spec.id.clone(), spec.exact_angle, orb, allowed_orb));
        }
    }
    None
}
