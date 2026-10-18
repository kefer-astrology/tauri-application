use std::collections::{HashMap, HashSet};

use crate::workspace::models::{BodyDefinition, ObjectType};

use super::geometry::normalize_id;

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

/// Build an id -> category lookup from a model's body catalog, for restricting
/// which object pairs an aspect definition may apply to via `AspectDefinition
/// ::object_type_rule`. Bodies without a declared `object_type` are omitted;
/// a missing entry is treated as "unknown category" by `pair_allowed`, not as
/// unrestricted.
pub fn object_type_map(body_definitions: &[BodyDefinition]) -> HashMap<String, ObjectType> {
    body_definitions
        .iter()
        .filter_map(|body| {
            body.object_type
                .map(|object_type| (body.id.clone(), object_type))
        })
        .collect()
}
