//! Backend-neutral astrological calculations.
//!
//! Astronomy adapters produce positions. This module applies model-defined
//! astrological rules to those positions without depending on Tauri, YAML, or a
//! specific ephemeris engine.

use std::collections::{HashMap, HashSet};

use serde::Serialize;

use crate::workspace::models::{AspectDefinition, BodyDefinition};

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

#[derive(Debug, Clone, PartialEq, Serialize)]
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

pub fn compute_chart_aspects(
    positions: &HashMap<String, f64>,
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    aspect_types: Option<&[String]>,
) -> Vec<ComputedAspect> {
    let specs = selected_aspects(aspect_definitions, aspect_orbs, aspect_types);
    let mut ids: Vec<&String> = positions.keys().collect();
    ids.sort();

    let mut aspects = Vec::new();
    for (index, from) in ids.iter().enumerate() {
        for to in ids.iter().skip(index + 1) {
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
    let specs = selected_aspects(aspect_definitions, aspect_orbs, Some(aspect_types));
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_definition_and_effective_orb_control_detection() {
        let definitions = vec![AspectDefinition {
            id: "semisextile".to_string(),
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
    fn cross_aspects_preserve_transiting_and_transited_direction() {
        let definitions = vec![AspectDefinition {
            id: "square".to_string(),
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
}
