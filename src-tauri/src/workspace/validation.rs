//! Workspace and model validation with stable, serializable diagnostics.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use super::models::{
    Annotation, AstroModel, ChartConfig, ChartInstance, ChartPreset, ChartSubject, ModelOverrides,
    ViewLayout, WorkspaceManifest,
};
use super::settings::EffectiveModelSettings;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
    Error,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Diagnostic {
    pub code: String,
    pub severity: DiagnosticSeverity,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct LoadedWorkspace {
    pub manifest: WorkspaceManifest,
    pub subjects: Vec<ChartSubject>,
    pub charts: Vec<ChartInstance>,
    pub chart_presets: Vec<ChartPreset>,
    pub layouts: Vec<ViewLayout>,
    pub annotations: Vec<Annotation>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceEntityCounts {
    pub subjects: usize,
    pub charts: usize,
    pub chart_presets: usize,
    pub layouts: usize,
    pub annotations: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceValidationReport {
    pub owner: String,
    #[serde(default)]
    pub active_model: Option<String>,
    pub valid: bool,
    pub counts: WorkspaceEntityCounts,
    pub diagnostics: Vec<Diagnostic>,
}

impl LoadedWorkspace {
    pub fn validation_report(&self) -> WorkspaceValidationReport {
        WorkspaceValidationReport {
            owner: self.manifest.owner.clone(),
            active_model: self.manifest.active_model.clone(),
            valid: !self
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.severity == DiagnosticSeverity::Error),
            counts: WorkspaceEntityCounts {
                subjects: self.subjects.len(),
                charts: self.charts.len(),
                chart_presets: self.chart_presets.len(),
                layouts: self.layouts.len(),
                annotations: self.annotations.len(),
            },
            diagnostics: self.diagnostics.clone(),
        }
    }
}

impl Diagnostic {
    pub fn error(code: &str, message: impl Into<String>, path: impl Into<Option<String>>) -> Self {
        Self {
            code: code.to_string(),
            severity: DiagnosticSeverity::Error,
            message: message.into(),
            path: path.into(),
        }
    }

    pub fn warning(
        code: &str,
        message: impl Into<String>,
        path: impl Into<Option<String>>,
    ) -> Self {
        Self {
            code: code.to_string(),
            severity: DiagnosticSeverity::Warning,
            message: message.into(),
            path: path.into(),
        }
    }
}

pub fn validate_model(model: &AstroModel, path: &str) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    let body_ids = validate_unique_ids(
        model.body_definitions.iter().map(|body| body.id.as_str()),
        "duplicate_body_id",
        "body",
        &format!("{path}.body_definitions"),
        &mut diagnostics,
    );
    let aspect_ids = validate_unique_ids(
        model
            .aspect_definitions
            .iter()
            .map(|aspect| aspect.id.as_str()),
        "duplicate_aspect_id",
        "aspect",
        &format!("{path}.aspect_definitions"),
        &mut diagnostics,
    );
    let mut sign_names = HashSet::new();
    let mut sign_abbreviations = HashSet::new();

    for (index, body) in model.body_definitions.iter().enumerate() {
        let body_path = format!("{path}.body_definitions[{index}]");
        if body.object_type.is_none() {
            diagnostics.push(Diagnostic::error(
                "body_object_type_missing",
                format!("Body '{}' has no object_type", body.id),
                Some(body_path.clone()),
            ));
        }
        if body.formula.trim().is_empty() {
            diagnostics.push(Diagnostic::warning(
                "body_formula_missing",
                format!("Body '{}' has no formula", body.id),
                Some(body_path.clone()),
            ));
        }
        if body.computation_map.is_empty() {
            diagnostics.push(Diagnostic::error(
                "body_computation_map_missing",
                format!("Body '{}' has no engine capability map", body.id),
                Some(body_path.clone()),
            ));
        } else if !body.computation_map.values().any(|target| {
            target
                .as_ref()
                .is_some_and(|value| !value.trim().is_empty())
        }) {
            diagnostics.push(Diagnostic::warning(
                "body_not_computable",
                format!("Body '{}' is unsupported by every declared engine", body.id),
                Some(body_path.clone()),
            ));
        }
        for (engine, target) in &body.computation_map {
            if engine.trim().is_empty() {
                diagnostics.push(Diagnostic::error(
                    "body_engine_id_empty",
                    format!("Body '{}' contains an empty engine identifier", body.id),
                    Some(body_path.clone()),
                ));
            }
            if target.as_ref().is_some_and(|value| value.trim().is_empty()) {
                diagnostics.push(Diagnostic::error(
                    "body_engine_target_empty",
                    format!(
                        "Body '{}' has an empty target for engine '{engine}'",
                        body.id
                    ),
                    Some(body_path.clone()),
                ));
            }
        }
    }

    for (index, aspect) in model.aspect_definitions.iter().enumerate() {
        let aspect_path = format!("{path}.aspect_definitions[{index}]");
        if !aspect.angle.is_finite() || !(0.0..=360.0).contains(&aspect.angle) {
            diagnostics.push(Diagnostic::error(
                "invalid_aspect_angle",
                format!("Aspect '{}' has invalid angle {}", aspect.id, aspect.angle),
                Some(aspect_path.clone()),
            ));
        }
        if !aspect.default_orb.is_finite() || aspect.default_orb < 0.0 {
            diagnostics.push(Diagnostic::error(
                "invalid_aspect_orb",
                format!(
                    "Aspect '{}' has invalid default orb {}",
                    aspect.id, aspect.default_orb
                ),
                Some(aspect_path),
            ));
        }
    }

    for (index, sign) in model.signs.iter().enumerate() {
        let sign_path = format!("{path}.signs[{index}]");
        insert_unique(
            &mut sign_names,
            &sign.name,
            "duplicate_sign_name",
            "sign name",
            &sign_path,
            &mut diagnostics,
        );
        insert_unique(
            &mut sign_abbreviations,
            &sign.abbreviation,
            "duplicate_sign_abbreviation",
            "sign abbreviation",
            &sign_path,
            &mut diagnostics,
        );
    }

    if let Some(settings) = &model.settings {
        validate_selection(
            &settings.default_bodies,
            &body_ids,
            "unknown_default_body",
            &format!("{path}.settings.default_bodies"),
            &mut diagnostics,
        );
        validate_selection(
            &settings.default_aspects,
            &aspect_ids,
            "unknown_default_aspect",
            &format!("{path}.settings.default_aspects"),
            &mut diagnostics,
        );
        for (values, code, field) in [
            (
                settings.default_transit_bodies.as_deref(),
                "unknown_default_transit_body",
                "default_transit_bodies",
            ),
            (
                settings.default_direction_bodies.as_deref(),
                "unknown_default_direction_body",
                "default_direction_bodies",
            ),
        ] {
            if let Some(values) = values {
                validate_selection(
                    values,
                    &body_ids,
                    code,
                    &format!("{path}.settings.{field}"),
                    &mut diagnostics,
                );
            }
        }
        for (values, code, field) in [
            (
                settings.default_transit_aspects.as_deref(),
                "unknown_default_transit_aspect",
                "default_transit_aspects",
            ),
            (
                settings.default_direction_aspects.as_deref(),
                "unknown_default_direction_aspect",
                "default_direction_aspects",
            ),
        ] {
            if let Some(values) = values {
                validate_selection(
                    values,
                    &aspect_ids,
                    code,
                    &format!("{path}.settings.{field}"),
                    &mut diagnostics,
                );
            }
        }
        if !settings.degrees_in_circle.is_finite() || settings.degrees_in_circle <= 0.0 {
            diagnostics.push(Diagnostic::error(
                "invalid_degrees_in_circle",
                "degrees_in_circle must be finite and greater than zero",
                Some(format!("{path}.settings.degrees_in_circle")),
            ));
        }
        if !settings.coordinate_tolerance.is_finite() || settings.coordinate_tolerance < 0.0 {
            diagnostics.push(Diagnostic::error(
                "invalid_coordinate_tolerance",
                "coordinate_tolerance must be finite and non-negative",
                Some(format!("{path}.settings.coordinate_tolerance")),
            ));
        }
    }

    diagnostics
}

pub fn validate_effective_settings(
    model: &AstroModel,
    settings: &EffectiveModelSettings,
    path: &str,
) -> Vec<Diagnostic> {
    let body_ids = normalized_set(model.body_definitions.iter().map(|body| body.id.as_str()));
    let aspect_ids = normalized_set(
        model
            .aspect_definitions
            .iter()
            .map(|aspect| aspect.id.as_str()),
    );
    let mut diagnostics = Vec::new();
    validate_selection(
        &settings.default_bodies,
        &body_ids,
        "unknown_selected_body",
        &format!("{path}.default_bodies"),
        &mut diagnostics,
    );
    validate_selection(
        &settings.default_aspects,
        &aspect_ids,
        "unknown_selected_aspect",
        &format!("{path}.default_aspects"),
        &mut diagnostics,
    );
    for aspect_id in settings.aspect_orbs.keys() {
        if !aspect_ids.contains(&normalize_id(aspect_id)) {
            diagnostics.push(Diagnostic::error(
                "unknown_aspect_orb",
                format!("Orb override references unknown aspect '{aspect_id}'"),
                Some(format!("{path}.aspect_orbs.{aspect_id}")),
            ));
        }
    }
    diagnostics
}

pub fn validate_manifest_model_references(
    manifest: &WorkspaceManifest,
    model: &AstroModel,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    if let Some(active_model) = manifest.active_model.as_deref() {
        if !manifest.models.contains_key(active_model) {
            diagnostics.push(Diagnostic::warning(
                "active_model_not_in_catalog",
                format!(
                    "Active model '{active_model}' is not present in the workspace model catalog"
                ),
                Some("workspace.active_model".to_string()),
            ));
        }
    }
    for (key, candidate) in &manifest.models {
        if candidate.name != *key {
            diagnostics.push(Diagnostic::warning(
                "model_key_name_mismatch",
                format!(
                    "Model key '{key}' contains model named '{}'",
                    candidate.name
                ),
                Some(format!("workspace.models.{key}")),
            ));
        }
        diagnostics.extend(validate_model(
            candidate,
            &format!("workspace.models.{key}"),
        ));
    }
    validate_model_overrides(manifest.model_overrides.as_ref(), model, &mut diagnostics);
    diagnostics
}

fn validate_model_overrides(
    overrides: Option<&ModelOverrides>,
    model: &AstroModel,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let Some(overrides) = overrides else {
        return;
    };
    let body_ids = normalized_set(model.body_definitions.iter().map(|body| body.id.as_str()));
    let aspect_ids = normalized_set(
        model
            .aspect_definitions
            .iter()
            .map(|aspect| aspect.id.as_str()),
    );
    for entry in &overrides.points {
        if !body_ids.contains(&normalize_id(&entry.id)) {
            diagnostics.push(Diagnostic::error(
                "unknown_body_override",
                format!("Point override references unknown body '{}'", entry.id),
                Some("workspace.model_overrides.points".to_string()),
            ));
        }
    }
    for entry in &overrides.aspects {
        if !aspect_ids.contains(&normalize_id(&entry.id)) {
            diagnostics.push(Diagnostic::error(
                "unknown_aspect_override",
                format!("Aspect override references unknown aspect '{}'", entry.id),
                Some("workspace.model_overrides.aspects".to_string()),
            ));
        }
    }
    for id in overrides.override_orbs.keys() {
        if !aspect_ids.contains(&normalize_id(id)) {
            diagnostics.push(Diagnostic::error(
                "unknown_override_orb",
                format!("Model orb override references unknown aspect '{id}'"),
                Some(format!("workspace.model_overrides.override_orbs.{id}")),
            ));
        }
    }
}

pub fn validate_chart_config(
    config: &ChartConfig,
    model: &AstroModel,
    path: &str,
) -> Vec<Diagnostic> {
    let body_ids = normalized_set(model.body_definitions.iter().map(|body| body.id.as_str()));
    let aspect_ids = normalized_set(
        model
            .aspect_definitions
            .iter()
            .map(|aspect| aspect.id.as_str()),
    );
    let mut diagnostics = Vec::new();
    if let Some(bodies) = &config.observable_objects {
        validate_selection(
            bodies,
            &body_ids,
            "unknown_chart_body",
            &format!("{path}.observable_objects"),
            &mut diagnostics,
        );
    }
    if let Some(aspects) = &config.selected_aspects {
        validate_selection(
            aspects,
            &aspect_ids,
            "unknown_chart_aspect",
            &format!("{path}.selected_aspects"),
            &mut diagnostics,
        );
    }
    for aspect_id in config.aspect_orbs.keys() {
        if !aspect_ids.contains(&normalize_id(aspect_id)) {
            diagnostics.push(Diagnostic::error(
                "unknown_chart_aspect_orb",
                format!("Chart orb references unknown aspect '{aspect_id}'"),
                Some(format!("{path}.aspect_orbs.{aspect_id}")),
            ));
        }
    }
    diagnostics
}

fn validate_unique_ids<'a>(
    values: impl Iterator<Item = &'a str>,
    duplicate_code: &str,
    label: &str,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> HashSet<String> {
    let mut ids = HashSet::new();
    for value in values {
        insert_unique(&mut ids, value, duplicate_code, label, path, diagnostics);
    }
    ids
}

fn insert_unique(
    values: &mut HashSet<String>,
    value: &str,
    duplicate_code: &str,
    label: &str,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let normalized = normalize_id(value);
    if normalized.is_empty() {
        diagnostics.push(Diagnostic::error(
            "empty_identifier",
            format!("{label} identifier must not be empty"),
            Some(path.to_string()),
        ));
    } else if !values.insert(normalized) {
        diagnostics.push(Diagnostic::error(
            duplicate_code,
            format!("Duplicate {label} identifier '{value}'"),
            Some(path.to_string()),
        ));
    }
}

fn validate_selection(
    selected: &[String],
    known: &HashSet<String>,
    code: &str,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let mut seen = HashSet::new();
    for id in selected {
        let normalized = normalize_id(id);
        if !known.contains(&normalized) {
            diagnostics.push(Diagnostic::error(
                code,
                format!("Selection references unknown identifier '{id}'"),
                Some(path.to_string()),
            ));
        } else if !seen.insert(normalized) {
            diagnostics.push(Diagnostic::warning(
                "duplicate_selection",
                format!("Selection contains duplicate identifier '{id}'"),
                Some(path.to_string()),
            ));
        }
    }
}

fn normalized_set<'a>(values: impl Iterator<Item = &'a str>) -> HashSet<String> {
    values.map(normalize_id).collect()
}

fn normalize_id(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn model_validation_reports_duplicates_unknown_defaults_and_missing_capabilities() {
        let mut model = crate::workspace::builtin_standard_model("invalid");
        let mut duplicate = model.body_definitions[0].clone();
        duplicate.id = " SUN ".to_string();
        duplicate.computation_map.clear();
        model.body_definitions.push(duplicate);
        model
            .settings
            .as_mut()
            .expect("built-in settings")
            .default_bodies
            .push("mystery".to_string());

        let diagnostics = validate_model(&model, "model");
        let codes: HashSet<&str> = diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_str())
            .collect();

        assert!(codes.contains("duplicate_body_id"));
        assert!(codes.contains("body_computation_map_missing"));
        assert!(codes.contains("unknown_default_body"));
    }

    #[test]
    fn effective_orb_keys_must_reference_the_model_catalog() {
        let config = ChartConfig {
            mode: crate::workspace::models::ChartMode::NATAL,
            house_system: None,
            zodiac_type: crate::workspace::models::ZodiacType::Tropical,
            included_points: Vec::new(),
            aspect_orbs: HashMap::new(),
            selected_aspects: None,
            display_style: String::new(),
            color_theme: String::new(),
            override_ephemeris: None,
            model: None,
            engine: None,
            ayanamsa: None,
            observable_objects: None,
            time_system: None,
        };
        let report = crate::workspace::settings::standalone_model_report(&config);
        let model = report.model;
        let mut settings = report.effective_settings;
        settings
            .aspect_orbs
            .insert("invented_aspect".to_string(), 1.0);

        let diagnostics = validate_effective_settings(&model, &settings, "effective");

        assert!(diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "unknown_aspect_orb"));
    }
}
