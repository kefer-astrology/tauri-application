use std::collections::HashMap;

use crate::workspace::model_catalog::builtin_standard_model;
use crate::workspace::models::{AstroModel, OverrideEntry, WorkspaceManifest};

pub(super) fn sorted_model_names(models: &HashMap<String, AstroModel>) -> Vec<String> {
    let mut names: Vec<String> = models.keys().cloned().collect();
    names.sort();
    names
}

pub(super) fn resolve_model_catalog(
    manifest: &WorkspaceManifest,
    requested_model: Option<&str>,
    available_models: &[String],
    warnings: &mut Vec<String>,
) -> (AstroModel, String) {
    if let Some(name) = requested_model {
        if let Some(model) = manifest.models.get(name) {
            return (model.clone(), "workspace_model".to_string());
        }
        warnings.push(format!("model_not_found: {name}"));
    }

    if let Some(first) = available_models.first() {
        if requested_model.is_none() {
            warnings.push(format!(
                "active_model_missing_using_first_available: {first}"
            ));
        } else {
            warnings.push(format!("using_first_available_model: {first}"));
        }
        if let Some(model) = manifest.models.get(first) {
            return (model.clone(), "workspace_model_fallback".to_string());
        }
    }

    let fallback_name = requested_model.unwrap_or("standard");
    warnings.push("using_builtin_standard_model".to_string());
    (
        builtin_standard_model(fallback_name),
        "builtin_standard_model".to_string(),
    )
}

pub(super) fn merge_model_with_overrides(
    model: AstroModel,
    overrides: Option<&crate::workspace::models::ModelOverrides>,
) -> AstroModel {
    let Some(overrides) = overrides else {
        return model;
    };

    let mut merged = model;
    for override_entry in &overrides.points {
        if !override_applies(override_entry, &merged) {
            continue;
        }
        if let Some(body) = merged
            .body_definitions
            .iter_mut()
            .find(|body| body.id == override_entry.id)
        {
            if let Some(glyph) = &override_entry.glyph {
                body.glyph = glyph.clone();
            }
            if let Some(i18n) = &override_entry.i18n {
                body.i18n = i18n.clone();
            }
            if let Some(enabled) = override_entry.enabled {
                body.enabled = enabled;
            }
        }
    }

    for override_entry in &overrides.aspects {
        if !override_applies(override_entry, &merged) {
            continue;
        }
        if let Some(aspect) = merged
            .aspect_definitions
            .iter_mut()
            .find(|aspect| aspect.id == override_entry.id)
        {
            if let Some(glyph) = &override_entry.glyph {
                aspect.glyph = glyph.clone();
            }
            if let Some(angle) = override_entry.angle {
                aspect.angle = angle;
            }
            if let Some(harmonic) = override_entry.harmonic {
                aspect.harmonic = harmonic;
            }
            if let Some(default_orb) = override_entry.default_orb {
                aspect.default_orb = default_orb;
            }
            if let Some(i18n) = &override_entry.i18n {
                aspect.i18n = i18n.clone();
            }
            if let Some(enabled) = override_entry.enabled {
                aspect.enabled = enabled;
            }
            if let Some(valid_contexts) = &override_entry.valid_contexts {
                aspect.valid_contexts = Some(valid_contexts.clone());
            }
            if let Some(weight) = override_entry.interpretation_weight {
                aspect.interpretation_weight = Some(weight);
            }
            if let Some(object_type_rule) = &override_entry.object_type_rule {
                aspect.object_type_rule = Some(object_type_rule.clone());
            }
        }
    }

    for aspect in &mut merged.aspect_definitions {
        if let Some(default_orb) = overrides.override_orbs.get(&aspect.id) {
            aspect.default_orb = *default_orb;
        }
    }
    merged
}

pub(super) fn override_applies(entry: &OverrideEntry, model: &AstroModel) -> bool {
    entry.only_for.as_ref().is_none_or(|selectors| {
        selectors.iter().any(|selector| {
            selector.eq_ignore_ascii_case(&model.name)
                || model
                    .school
                    .as_deref()
                    .is_some_and(|school| selector.eq_ignore_ascii_case(school))
        })
    })
}
