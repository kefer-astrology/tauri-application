use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::workspace::model_catalog::builtin_standard_model;
use crate::workspace::models::HouseSystem;
use crate::workspace::models::{
    AstroModel, Ayanamsa, ChartConfig, EngineType, ModelOverrides, PositionMode, TimeSystem,
    WorkspaceManifest, ZodiacType,
};
use crate::workspace::validation::Diagnostic;

use super::apply::non_empty_string;
use super::effective_settings::{apply_workspace_aspect_scope_defaults, effective_model_settings};
use super::layer::{SettingSource, SettingsLayer};
use super::model_catalog_resolution::{
    merge_model_with_overrides, resolve_model_catalog, sorted_model_names,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectiveSettingsSources {
    #[serde(default)]
    pub default_house_system: Option<SettingSource>,
    pub default_bodies: SettingSource,
    pub default_aspects: SettingSource,
    #[serde(default)]
    pub aspect_orbs: HashMap<String, SettingSource>,
    pub standard_orb: SettingSource,
    #[serde(default)]
    pub engine: Option<SettingSource>,
    pub position_mode: SettingSource,
    #[serde(default)]
    pub zodiac_type: Option<SettingSource>,
    #[serde(default)]
    pub ayanamsa: Option<SettingSource>,
    #[serde(default)]
    pub time_system: Option<SettingSource>,
    pub computational_constants: SettingSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectiveModelSettings {
    #[serde(default)]
    pub default_house_system: Option<HouseSystem>,
    #[serde(default)]
    pub default_bodies: Vec<String>,
    #[serde(default)]
    pub default_aspects: Vec<String>,
    #[serde(default)]
    pub default_transit_aspects: Option<Vec<String>>,
    #[serde(default)]
    pub default_direction_aspects: Option<Vec<String>>,
    #[serde(default)]
    pub default_transit_bodies: Option<Vec<String>>,
    #[serde(default)]
    pub default_direction_bodies: Option<Vec<String>>,
    #[serde(default)]
    pub aspect_orbs: HashMap<String, f64>,
    /// Per-object orb override (body id -> degrees), global across every
    /// aspect — see `WorkspaceDefaults::object_orbs`. Workspace-level only,
    /// unlike `aspect_orbs`: no preset/chart/operation layer overrides this.
    #[serde(default)]
    pub object_orbs: HashMap<String, f64>,
    #[serde(default)]
    pub standard_orb: f64,
    #[serde(default)]
    pub engine: Option<EngineType>,
    pub position_mode: PositionMode,
    #[serde(default)]
    pub zodiac_type: Option<ZodiacType>,
    #[serde(default)]
    pub ayanamsa: Option<Ayanamsa>,
    #[serde(default)]
    pub time_system: Option<TimeSystem>,
    pub degrees_in_circle: f64,
    pub obliquity_j2000: f64,
    pub coordinate_tolerance: f64,
    pub sources: EffectiveSettingsSources,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrentModelReport {
    #[serde(default)]
    pub requested_school: Option<String>,
    #[serde(default)]
    pub resolved_school: Option<String>,
    #[serde(default)]
    pub requested_model: Option<String>,
    pub resolved_model: String,
    pub source: String,
    #[serde(default)]
    pub available_models: Vec<String>,
    pub model: AstroModel,
    pub effective_settings: EffectiveModelSettings,
    #[serde(default)]
    pub model_overrides: Option<ModelOverrides>,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(default)]
    pub diagnostics: Vec<Diagnostic>,
}

pub fn current_model_report(
    manifest: &WorkspaceManifest,
    chart_config: Option<&ChartConfig>,
) -> CurrentModelReport {
    current_model_report_with_layers(manifest, None, chart_config, None)
}

/// Resolve an in-memory chart without inventing a workspace manifest.
///
/// Standalone charts have application and built-in model defaults followed by
/// chart overrides. They intentionally have no workspace or preset scope.
#[cfg(test)]
pub fn standalone_model_report(chart_config: &ChartConfig) -> CurrentModelReport {
    standalone_model_report_with_operation(chart_config, None)
}

pub fn standalone_model_report_with_operation(
    chart_config: &ChartConfig,
    operation: Option<&SettingsLayer>,
) -> CurrentModelReport {
    let requested_model = non_empty_string(chart_config.model.as_deref()).map(str::to_string);
    let resolved_model = requested_model
        .clone()
        .unwrap_or_else(|| "standard".to_string());
    let model = builtin_standard_model(&resolved_model);
    let effective_settings =
        effective_model_settings(None, &model, None, Some(chart_config), operation);
    let warnings = Vec::new();
    let mut diagnostics = crate::workspace::validation::validate_model(&model, "model");
    diagnostics.extend(crate::workspace::validation::validate_effective_settings(
        &model,
        &effective_settings,
        "effective_settings",
    ));
    diagnostics.extend(crate::workspace::validation::validate_chart_config(
        chart_config,
        &model,
        "chart.config",
    ));

    CurrentModelReport {
        requested_school: None,
        resolved_school: model.school.clone(),
        requested_model,
        resolved_model,
        source: "builtin_standard_model".to_string(),
        available_models: Vec::new(),
        model,
        effective_settings,
        model_overrides: None,
        warnings,
        diagnostics,
    }
}

/// Resolve a model report with optional preset and operation layers.
///
/// Chart commands use `current_model_report`; application services can use this
/// expanded entry point once presets and ephemeral compute overrides are wired
/// into their request DTOs.
pub fn current_model_report_with_layers(
    manifest: &WorkspaceManifest,
    preset: Option<&SettingsLayer>,
    chart_config: Option<&ChartConfig>,
    operation: Option<&SettingsLayer>,
) -> CurrentModelReport {
    let mut warnings = Vec::new();
    let available_models = sorted_model_names(&manifest.models);
    let requested_school = chart_config
        .and_then(|config| config.model.as_deref())
        .and_then(|model_name| manifest.models.get(model_name))
        .and_then(|model| model.school.clone())
        .or_else(|| manifest.active_school.clone());
    let requested_model = chart_config
        .and_then(|config| non_empty_string(config.model.as_deref()))
        .or_else(|| non_empty_string(manifest.active_model.as_deref()))
        .or_else(|| {
            requested_school
                .as_deref()
                .and_then(|school| manifest.schools.get(school))
                .and_then(|school| non_empty_string(Some(&school.default_model)))
        })
        .map(str::to_string);

    let (base_model, source) = resolve_model_catalog(
        manifest,
        requested_model.as_deref(),
        &available_models,
        &mut warnings,
    );
    let mut model = merge_model_with_overrides(base_model, manifest.model_overrides.as_ref());
    if let Some(layer) = preset {
        model = merge_model_with_overrides(model, layer.model_overrides.as_ref());
    }
    if let Some(config) = chart_config {
        model = merge_model_with_overrides(model, config.model_overrides.as_ref());
    }
    if let Some(layer) = operation {
        model = merge_model_with_overrides(model, layer.model_overrides.as_ref());
    }
    apply_workspace_aspect_scope_defaults(&mut model, manifest);
    let effective_settings =
        effective_model_settings(Some(manifest), &model, preset, chart_config, operation);
    let mut diagnostics =
        crate::workspace::validation::validate_manifest_model_references(manifest, &model);
    if source == "builtin_standard_model" {
        diagnostics.extend(crate::workspace::validation::validate_model(
            &model, "model",
        ));
    }
    diagnostics.extend(crate::workspace::validation::validate_effective_settings(
        &model,
        &effective_settings,
        "effective_settings",
    ));
    if let Some(chart_config) = chart_config {
        diagnostics.extend(crate::workspace::validation::validate_chart_config(
            chart_config,
            &model,
            "chart.config",
        ));
    }
    for warning in &warnings {
        if let Some(model_name) = warning.strip_prefix("model_not_found: ") {
            diagnostics.push(Diagnostic::warning(
                "model_not_found",
                format!(
                    "Requested model '{model_name}' was not found; fallback resolution applied"
                ),
                Some("chart.config.model".to_string()),
            ));
        }
    }

    CurrentModelReport {
        requested_school,
        resolved_school: model.school.clone(),
        requested_model,
        resolved_model: model.name.clone(),
        source,
        available_models,
        model,
        effective_settings,
        model_overrides: manifest.model_overrides.clone(),
        warnings,
        diagnostics,
    }
}
