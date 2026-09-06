//! Backend-neutral astrological calculations.
//!
//! Astronomy adapters produce positions. This module applies model-defined
//! astrological rules to those positions without depending on Tauri, YAML, or a
//! specific ephemeris engine.

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::workspace::models::{AspectContext, AspectDefinition, BodyDefinition};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BodySelection {
    pub ids: Vec<String>,
    pub warnings: Vec<String>,
}

/// Validate and deduplicate canonical body IDs for a concrete astronomy engine.
///
/// Definitions own engine capability metadata. Astronomy adapters receive only
/// canonical IDs that the resolved model declares computable by that engine.
pub fn resolve_body_selection(
    body_definitions: &[BodyDefinition],
    requested_ids: &[String],
    engine_id: &str,
) -> BodySelection {
    let definitions: HashMap<String, &BodyDefinition> = body_definitions
        .iter()
        .map(|definition| (normalize_id(&definition.id), definition))
        .collect();
    let mut seen = HashSet::new();
    let mut ids = Vec::new();
    let mut warnings = Vec::new();

    for requested_id in requested_ids {
        let normalized = normalize_id(requested_id);
        if normalized.is_empty() {
            continue;
        }
        let Some(definition) = definitions.get(&normalized) else {
            warnings.push(format!("unknown_body_id: {requested_id}"));
            continue;
        };
        if !definition.enabled {
            warnings.push(format!("body_disabled_by_model: {}", definition.id));
            continue;
        }
        if !seen.insert(normalized) {
            warnings.push(format!("duplicate_body_id: {}", definition.id));
            continue;
        }

        match definition.computation_map.get(engine_id) {
            Some(Some(_)) => ids.push(definition.id.clone()),
            Some(None) | None => warnings.push(format!(
                "body_not_supported_by_engine: {} ({engine_id})",
                definition.id
            )),
        }
    }

    BodySelection { ids, warnings }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ComputedAspect {
    pub from: String,
    pub to: String,
    #[serde(rename = "type")]
    pub aspect_type: String,
    pub angle: f64,
    pub orb: f64,
    pub exact_angle: f64,
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

pub fn compute_chart_aspects(
    positions: &HashMap<String, f64>,
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    aspect_types: Option<&[String]>,
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
            if let Some((aspect_type, exact_angle, orb)) = detect_aspect(angle, &specs) {
                aspects.push(ComputedAspect {
                    from: (*from).clone(),
                    to: (*to).clone(),
                    aspect_type,
                    angle,
                    orb,
                    exact_angle,
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
            if let Some((aspect_type, exact_angle, orb)) = detect_aspect(angle, &specs) {
                aspects.push(ComputedAspect {
                    from: from.clone(),
                    to: (*to).clone(),
                    aspect_type,
                    angle,
                    orb,
                    exact_angle,
                    applying: false,
                    separating: false,
                });
            }
        }
    }
    aspects
}

fn selected_aspects(
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    selected_types: Option<&[String]>,
    context: AspectContext,
) -> Vec<(String, f64, f64)> {
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
            Some((id, definition.angle, orb))
        })
        .collect()
}

fn detect_aspect(angle: f64, specs: &[(String, f64, f64)]) -> Option<(String, f64, f64)> {
    for (id, exact_angle, allowed_orb) in specs {
        let normalized_exact = if *exact_angle > 180.0 {
            360.0 - *exact_angle
        } else {
            *exact_angle
        };
        let orb = (angle - normalized_exact).abs();
        if orb <= *allowed_orb {
            return Some((id.clone(), *exact_angle, orb));
        }
    }
    None
}

fn shortest_arc_deg(a: f64, b: f64) -> f64 {
    let mut difference = (normalize_deg(a) - normalize_deg(b)).abs();
    if difference > 180.0 {
        difference = 360.0 - difference;
    }
    difference
}

fn normalize_deg(value: f64) -> f64 {
    let normalized = value % 360.0;
    if normalized < 0.0 {
        normalized + 360.0
    } else {
        normalized
    }
}

fn normalize_id(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

/// Distribution shapes (Jones-inspired) and aspect-pattern configurations for chart search.
/// Ported from the frontend's former `chartSearch.ts` heuristics so every consumer shares one
/// implementation instead of duplicating the geometry in TypeScript.
const SEARCH_PLANET_IDS: [&str; 10] = [
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
];

const MODALITY_IDS: [&str; 3] = ["cardinal", "fixed", "mutable"];
const ELEMENT_IDS: [&str; 4] = ["fire", "earth", "air", "water"];

fn sign_index(longitude: f64) -> usize {
    (normalize_deg(longitude) / 30.0).floor() as usize % 12
}

fn modality_for_sign(index: usize) -> &'static str {
    MODALITY_IDS[index % 3]
}

fn element_for_sign(index: usize) -> &'static str {
    ELEMENT_IDS[index % 4]
}

fn forward_arc(from: f64, to: f64) -> f64 {
    ((to - from) % 360.0 + 360.0) % 360.0
}

fn house_for_longitude(longitude: f64, cusps: &[f64]) -> Option<usize> {
    if cusps.len() != 12 {
        return None;
    }
    for index in 0..12 {
        let start = normalize_deg(cusps[index]);
        let end = normalize_deg(cusps[(index + 1) % 12]);
        if forward_arc(start, longitude) < forward_arc(start, end) {
            return Some(index + 1);
        }
    }
    Some(12)
}

struct OccupiedArc<'a> {
    arc: f64,
    largest_gap: f64,
    leader: Option<&'a str>,
    sorted: Vec<(&'a str, f64)>,
}

fn smallest_occupied_arc<'a>(entries: &[(&'a str, f64)]) -> OccupiedArc<'a> {
    let mut sorted: Vec<(&'a str, f64)> = entries.to_vec();
    sorted.sort_by(|left, right| left.1.partial_cmp(&right.1).unwrap());
    let mut largest_gap = -1.0_f64;
    let mut gap_index = 0usize;
    for index in 0..sorted.len() {
        let next = sorted[(index + 1) % sorted.len()].1;
        let gap = forward_arc(sorted[index].1, next);
        if gap > largest_gap {
            largest_gap = gap;
            gap_index = index;
        }
    }
    let leader = sorted
        .get((gap_index + 1) % sorted.len())
        .map(|entry| entry.0);
    OccupiedArc {
        arc: 360.0 - largest_gap,
        largest_gap,
        leader,
        sorted,
    }
}

fn combinations<T: Copy>(items: &[T], size: usize) -> Vec<Vec<T>> {
    fn walk<T: Copy>(
        items: &[T],
        size: usize,
        start: usize,
        selected: &mut Vec<T>,
        result: &mut Vec<Vec<T>>,
    ) {
        if selected.len() == size {
            result.push(selected.clone());
            return;
        }
        let limit = items.len() as isize - (size - selected.len()) as isize;
        let mut index = start as isize;
        while index <= limit {
            selected.push(items[index as usize]);
            walk(items, size, index as usize + 1, selected, result);
            selected.pop();
            index += 1;
        }
    }
    let mut result = Vec::new();
    let mut selected = Vec::new();
    walk(items, size, 0, &mut selected, &mut result);
    result
}

fn pair_key(left: &str, right: &str) -> String {
    if left < right {
        format!("{left}::{right}")
    } else {
        format!("{right}::{left}")
    }
}

/// Bundle/bowl/bucket/seesaw/splash/stellium distribution shapes for the 10 classical bodies.
pub fn detect_chart_shapes(positions: &HashMap<String, f64>, house_cusps: &[f64]) -> Vec<String> {
    let mut result: HashSet<String> = HashSet::new();
    let entries: Vec<(&str, f64)> = SEARCH_PLANET_IDS
        .iter()
        .copied()
        .filter_map(|id| positions.get(id).map(|lon| (id, normalize_deg(*lon))))
        .collect();
    if entries.len() < 7 {
        return Vec::new();
    }

    let full = smallest_occupied_arc(&entries);
    if full.arc <= 120.0 {
        result.insert("bundle".to_string());
    } else if full.arc <= 180.0 {
        result.insert("bowl".to_string());
        if let Some(leader) = full.leader {
            result.insert(format!("bowl_leader_{leader}"));
        }
        let houses: Vec<usize> = entries
            .iter()
            .copied()
            .filter_map(|(_, lon)| house_for_longitude(lon, house_cusps))
            .collect();
        if houses.len() == entries.len() {
            if houses
                .iter()
                .all(|house| matches!(house, 10 | 11 | 12 | 1 | 2 | 3))
            {
                result.insert("bowl_east".to_string());
            }
            if houses
                .iter()
                .all(|house| matches!(house, 4 | 5 | 6 | 7 | 8 | 9))
            {
                result.insert("bowl_west".to_string());
            }
            if houses.iter().all(|house| *house >= 7) {
                result.insert("bowl_day".to_string());
            }
            if houses.iter().all(|house| *house <= 6) {
                result.insert("bowl_night".to_string());
            }
        }
    } else if full.arc <= 240.0 {
        result.insert("locomotive".to_string());
        if let Some(leader) = full.leader {
            result.insert(format!("locomotive_leader_{leader}"));
        }
    }

    for (handle, longitude) in entries.iter().copied() {
        let remainder: Vec<(&str, f64)> = entries
            .iter()
            .copied()
            .filter(|pair| pair.0 != handle)
            .collect();
        let clears_gap = remainder
            .iter()
            .all(|pair| forward_arc(longitude, pair.1).min(forward_arc(pair.1, longitude)) >= 30.0);
        if smallest_occupied_arc(&remainder).arc <= 180.0 && clears_gap {
            result.insert("bucket".to_string());
            result.insert(format!("bucket_{handle}"));
            break;
        }
    }

    let gaps: Vec<f64> = full
        .sorted
        .iter()
        .enumerate()
        .map(|(index, entry)| forward_arc(entry.1, full.sorted[(index + 1) % full.sorted.len()].1))
        .collect();
    let large_gaps = gaps.iter().filter(|gap| **gap >= 60.0).count();
    if large_gaps >= 2 {
        result.insert("seesaw".to_string());
    }
    if full.largest_gap < 60.0 {
        result.insert("splash".to_string());
    }
    if large_gaps == 1 && full.arc > 240.0 {
        result.insert("splay".to_string());
    }

    let (sum_x, sum_y) = entries
        .iter()
        .copied()
        .fold((0.0_f64, 0.0_f64), |(x, y), (_, lon)| {
            let radians = lon.to_radians();
            (x + radians.cos(), y + radians.sin())
        });
    if sum_x.hypot(sum_y) / entries.len() as f64 >= 0.35 {
        result.insert("shifted_center".to_string());
    }

    let mut sign_counts: HashMap<usize, usize> = HashMap::new();
    for (_, lon) in entries.iter().copied() {
        *sign_counts.entry(sign_index(lon)).or_insert(0) += 1;
    }
    if sign_counts.values().any(|count| *count >= 3) {
        result.insert("stellium".to_string());
    }

    result.into_iter().collect()
}

/// T-square/grand-trine/grand-cross/kite/mystic-rectangle/hexagram/pentagram configurations
/// derived from the same already-computed internal aspect graph used for the radix wheel.
pub fn detect_chart_configurations(
    positions: &HashMap<String, f64>,
    aspects: &[ComputedAspect],
) -> Vec<String> {
    let mut result: HashSet<String> = HashSet::new();
    let bodies: Vec<&str> = SEARCH_PLANET_IDS
        .iter()
        .copied()
        .filter(|id| positions.contains_key(*id))
        .collect();

    let mut aspect_map: HashMap<String, String> = HashMap::new();
    for aspect in aspects {
        aspect_map.insert(
            pair_key(&aspect.from, &aspect.to),
            aspect.aspect_type.clone(),
        );
    }
    let is = |left: &str, right: &str, aspect_type: &str| {
        aspect_map.get(&pair_key(left, right)).map(String::as_str) == Some(aspect_type)
    };

    let mut trines: Vec<Vec<&str>> = Vec::new();

    for trio in combinations(&bodies, 3) {
        let (a, b, c) = (trio[0], trio[1], trio[2]);
        let pair_types = [
            aspect_map.get(&pair_key(a, b)).map(String::as_str),
            aspect_map.get(&pair_key(a, c)).map(String::as_str),
            aspect_map.get(&pair_key(b, c)).map(String::as_str),
        ];
        let square_count = pair_types.iter().filter(|t| **t == Some("square")).count();
        if square_count == 2 && pair_types.contains(&Some("opposition")) {
            result.insert("t_square".to_string());
            result.insert(format!(
                "t_square_{}",
                modality_for_sign(sign_index(*positions.get(a).unwrap()))
            ));
        }
        if pair_types.iter().all(|t| *t == Some("trine")) {
            result.insert("grand_trine".to_string());
            result.insert(format!(
                "grand_trine_{}",
                element_for_sign(sign_index(*positions.get(a).unwrap()))
            ));
            trines.push(trio.clone());
        }
        let quincunx_count = pair_types
            .iter()
            .filter(|t| **t == Some("quincunx"))
            .count();
        if quincunx_count == 2 && pair_types.contains(&Some("sextile")) {
            result.insert("double_quincunx".to_string());
        }
        let biquintile_count = pair_types
            .iter()
            .filter(|t| **t == Some("biquintile"))
            .count();
        if biquintile_count >= 2 {
            result.insert("double_biquintile".to_string());
        }
    }

    for quartet in combinations(&bodies, 4) {
        let pair_types: Vec<Option<&str>> = combinations(&quartet, 2)
            .into_iter()
            .map(|pair| {
                aspect_map
                    .get(&pair_key(pair[0], pair[1]))
                    .map(String::as_str)
            })
            .collect();
        let square_count = pair_types.iter().filter(|t| **t == Some("square")).count();
        let opposition_count = pair_types
            .iter()
            .filter(|t| **t == Some("opposition"))
            .count();
        if square_count == 4 && opposition_count == 2 {
            result.insert("grand_cross".to_string());
            result.insert(format!(
                "grand_cross_{}",
                modality_for_sign(sign_index(*positions.get(quartet[0]).unwrap()))
            ));
        }
        let trine_count = pair_types.iter().filter(|t| **t == Some("trine")).count();
        let sextile_count = pair_types.iter().filter(|t| **t == Some("sextile")).count();
        if opposition_count == 2 && trine_count == 2 && sextile_count == 2 {
            result.insert("mystic_rectangle".to_string());
        }
    }

    for trine in &trines {
        for body in bodies.iter().copied().filter(|b| !trine.contains(b)) {
            for &opposed in trine {
                let others: Vec<&str> = trine.iter().copied().filter(|c| *c != opposed).collect();
                if is(body, opposed, "opposition") && others.iter().all(|c| is(body, *c, "sextile"))
                {
                    result.insert("kite".to_string());
                    result.insert(format!(
                        "kite_{}",
                        element_for_sign(sign_index(*positions.get(opposed).unwrap()))
                    ));
                }
            }
        }
    }

    if trines.len() >= 2
        && trines.iter().enumerate().any(|(index, a)| {
            trines[index + 1..]
                .iter()
                .any(|b| a.iter().all(|body| !b.contains(body)))
        })
    {
        result.insert("hexagram".to_string());
    }

    if combinations(&bodies, 5).iter().any(|group| {
        combinations(group, 2)
            .iter()
            .filter(|pair| {
                matches!(
                    aspect_map
                        .get(&pair_key(pair[0], pair[1]))
                        .map(String::as_str),
                    Some("quintile") | Some("biquintile")
                )
            })
            .count()
            >= 5
    }) {
        result.insert("pentagram".to_string());
    }

    result.into_iter().collect()
}

/// If `shapes`/`configurations` are absent (e.g. a Python-backend chart response), derive them
/// from the same already-computed `positions`/`house_cusps`/`aspects` fields so every compute
/// route exposes them, not just the Rust one.
pub fn inject_shapes_and_configurations_into_chart_map(
    result: &mut HashMap<String, serde_json::Value>,
) {
    let need_shapes = matches!(result.get("shapes"), None | Some(serde_json::Value::Null));
    let need_configurations = matches!(
        result.get("configurations"),
        None | Some(serde_json::Value::Null)
    );
    if !need_shapes && !need_configurations {
        return;
    }
    let Some(positions_obj) = result
        .get("positions")
        .and_then(serde_json::Value::as_object)
    else {
        return;
    };
    let positions: HashMap<String, f64> = positions_obj
        .iter()
        .filter_map(|(id, value)| value.as_f64().map(|lon| (id.clone(), lon)))
        .collect();

    if need_shapes {
        let house_cusps: Vec<f64> = result
            .get("house_cusps")
            .and_then(serde_json::Value::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(serde_json::Value::as_f64)
                    .collect()
            })
            .unwrap_or_default();
        let shapes = detect_chart_shapes(&positions, &house_cusps);
        result.insert("shapes".to_string(), serde_json::json!(shapes));
    }

    if need_configurations {
        let aspects: Vec<ComputedAspect> = result
            .get("aspects")
            .and_then(|value| serde_json::from_value(value.clone()).ok())
            .unwrap_or_default();
        let configurations = detect_chart_configurations(&positions, &aspects);
        result.insert(
            "configurations".to_string(),
            serde_json::json!(configurations),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_definition_and_effective_orb_control_detection() {
        let definitions = vec![AspectDefinition {
            id: "semisextile".to_string(),
            enabled: true,
            glyph: "⚺".to_string(),
            angle: 30.0,
            default_orb: 0.5,
            i18n: HashMap::new(),
            color: None,
            importance: None,
            line_style: None,
            line_width: None,
            show_label: None,
            valid_contexts: None,
            interpretation_weight: None,
        }];
        let positions = HashMap::from([("moon".to_string(), 30.75), ("sun".to_string(), 0.0)]);
        let selected = vec!["semisextile".to_string()];

        let without_override =
            compute_chart_aspects(&positions, &definitions, &HashMap::new(), Some(&selected));
        assert!(without_override.is_empty());

        let effective_orbs = HashMap::from([("semisextile".to_string(), 1.0)]);
        let with_override =
            compute_chart_aspects(&positions, &definitions, &effective_orbs, Some(&selected));

        assert_eq!(
            with_override,
            vec![ComputedAspect {
                from: "moon".to_string(),
                to: "sun".to_string(),
                aspect_type: "semisextile".to_string(),
                angle: 30.75,
                orb: 0.75,
                exact_angle: 30.0,
                applying: false,
                separating: false,
            }]
        );
    }

    #[test]
    fn chart_aspects_exclude_structurally_locked_axis_and_node_pairs() {
        let definitions = vec![AspectDefinition {
            id: "opposition".to_string(),
            enabled: true,
            glyph: "☍".to_string(),
            angle: 180.0,
            default_orb: 8.0,
            i18n: HashMap::new(),
            color: None,
            importance: None,
            line_style: None,
            line_width: None,
            show_label: None,
            valid_contexts: None,
            interpretation_weight: None,
        }];
        let positions = HashMap::from([
            ("asc".to_string(), 10.0),
            ("desc".to_string(), 190.0),
            ("mc".to_string(), 100.0),
            ("ic".to_string(), 280.0),
            ("north_node".to_string(), 50.0),
            ("south_node".to_string(), 230.0),
            // A real opposition between two ordinary bodies should still be reported.
            ("sun".to_string(), 0.0),
            ("moon".to_string(), 180.0),
        ]);
        let selected = vec!["opposition".to_string()];

        let aspects =
            compute_chart_aspects(&positions, &definitions, &HashMap::new(), Some(&selected));

        assert_eq!(aspects.len(), 1);
        assert_eq!(aspects[0].from, "moon");
        assert_eq!(aspects[0].to, "sun");
    }

    #[test]
    fn cross_aspects_preserve_transiting_and_transited_direction() {
        let definitions = vec![AspectDefinition {
            id: "square".to_string(),
            enabled: true,
            glyph: "□".to_string(),
            angle: 90.0,
            default_orb: 1.0,
            i18n: HashMap::new(),
            color: None,
            importance: None,
            line_style: None,
            line_width: None,
            show_label: None,
            valid_contexts: None,
            interpretation_weight: None,
        }];
        let transiting = HashMap::from([("mars".to_string(), 90.0)]);
        let transited = HashMap::from([("sun".to_string(), 0.0)]);

        let aspects = compute_cross_aspects(
            &transiting,
            &transited,
            &definitions,
            &HashMap::new(),
            &["square".to_string()],
        );

        assert_eq!(aspects[0].from, "mars");
        assert_eq!(aspects[0].to, "sun");
    }

    #[test]
    fn aspect_enabled_and_context_are_computation_rules() {
        let positions = HashMap::from([("mars".to_string(), 90.0), ("sun".to_string(), 0.0)]);
        let mut definition = AspectDefinition {
            id: "square".to_string(),
            enabled: true,
            glyph: String::new(),
            angle: 90.0,
            default_orb: 1.0,
            i18n: HashMap::new(),
            color: None,
            importance: None,
            line_style: None,
            line_width: None,
            show_label: None,
            valid_contexts: Some(vec![AspectContext::Transit]),
            interpretation_weight: None,
        };

        assert!(compute_chart_aspects(
            &positions,
            std::slice::from_ref(&definition),
            &HashMap::new(),
            None,
        )
        .is_empty());
        assert_eq!(
            compute_cross_aspects(
                &HashMap::from([("mars".to_string(), 90.0)]),
                &HashMap::from([("sun".to_string(), 0.0)]),
                std::slice::from_ref(&definition),
                &HashMap::new(),
                &["square".to_string()],
            )
            .len(),
            1
        );

        definition.enabled = false;
        assert!(compute_cross_aspects(
            &HashMap::from([("mars".to_string(), 90.0)]),
            &HashMap::from([("sun".to_string(), 0.0)]),
            &[definition],
            &HashMap::new(),
            &["square".to_string()],
        )
        .is_empty());
    }

    #[test]
    fn body_selection_is_canonical_deduplicated_and_engine_aware() {
        let model = crate::workspace::builtin_standard_model("standard");
        let requested = vec![
            " ASC ".to_string(),
            "asc".to_string(),
            "lilith".to_string(),
            "unknown_point".to_string(),
        ];

        let selection = resolve_body_selection(&model.body_definitions, &requested, "jpl");

        assert_eq!(selection.ids, vec!["asc"]);
        assert!(selection
            .warnings
            .iter()
            .any(|warning| warning == "duplicate_body_id: asc"));
        assert!(selection
            .warnings
            .iter()
            .any(|warning| warning == "body_not_supported_by_engine: lilith (jpl)"));
        assert!(selection
            .warnings
            .iter()
            .any(|warning| warning == "unknown_body_id: unknown_point"));
    }

    #[test]
    fn detect_chart_shapes_flags_bundle_and_stellium() {
        let positions = HashMap::from([
            ("sun".to_string(), 0.0),
            ("moon".to_string(), 10.0),
            ("mercury".to_string(), 20.0),
            ("venus".to_string(), 30.0),
            ("mars".to_string(), 40.0),
            ("jupiter".to_string(), 50.0),
            ("saturn".to_string(), 60.0),
            ("uranus".to_string(), 70.0),
            ("neptune".to_string(), 80.0),
            ("pluto".to_string(), 90.0),
        ]);

        let shapes = detect_chart_shapes(&positions, &[]);

        assert!(shapes.contains(&"bundle".to_string()));
        assert!(shapes.contains(&"stellium".to_string()));
    }

    #[test]
    fn detect_chart_configurations_flags_grand_trine() {
        let positions = HashMap::from([
            ("sun".to_string(), 0.0),
            ("moon".to_string(), 120.0),
            ("mercury".to_string(), 240.0),
        ]);
        let aspect = |from: &str, to: &str| ComputedAspect {
            from: from.to_string(),
            to: to.to_string(),
            aspect_type: "trine".to_string(),
            angle: 120.0,
            orb: 0.0,
            exact_angle: 120.0,
            applying: false,
            separating: false,
        };
        let aspects = vec![
            aspect("sun", "moon"),
            aspect("sun", "mercury"),
            aspect("moon", "mercury"),
        ];

        let configurations = detect_chart_configurations(&positions, &aspects);

        assert!(configurations.contains(&"grand_trine".to_string()));
        assert!(configurations.contains(&"grand_trine_fire".to_string()));
    }
}
