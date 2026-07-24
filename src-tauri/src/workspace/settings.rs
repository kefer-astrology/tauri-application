//! Layered astrological setting resolution.
//!
//! Precedence is deterministic:
//! application fallback < model < workspace < preset < chart < operation.
//! The resolved report includes provenance so callers can explain why a value
//! was selected.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use super::model_catalog::{builtin_model_settings, builtin_standard_model};
use super::models::{
    AstroModel, Ayanamsa, ChartConfig, EngineType, HouseSystem, ModelOverrides, TimeSystem,
    WorkspaceManifest, ZodiacType,
};
use super::validation::Diagnostic;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SettingSource {
    Application,
    Model,
    Workspace,
    Preset,
    Chart,
    Operation,
}

/// Sparse settings supplied by a preset or a single compute operation.
///
/// `None` means inherit. Empty body/aspect lists are explicit values at these
/// scopes and therefore mean "select none".
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SettingsLayer {
    pub house_system: Option<HouseSystem>,
    pub bodies: Option<Vec<String>>,
    pub aspects: Option<Vec<String>>,
    pub aspect_orbs: HashMap<String, f64>,
    pub engine: Option<EngineType>,
    pub zodiac_type: Option<ZodiacType>,
    pub ayanamsa: Option<Ayanamsa>,
    pub time_system: Option<TimeSystem>,
}

impl SettingsLayer {
    pub fn from_chart_config(config: &ChartConfig) -> Self {
        let bodies = config.observable_objects.clone().or_else(|| {
            (!config.included_points.is_empty()).then(|| config.included_points.clone())
        });
        Self {
            house_system: config.house_system.clone(),
            bodies,
            aspects: config.selected_aspects.clone(),
            aspect_orbs: config.aspect_orbs.clone(),
            engine: config.engine.clone(),
            zodiac_type: Some(config.zodiac_type.clone()),
            ayanamsa: config.ayanamsa.clone(),
            time_system: config.time_system.clone(),
        }
    }
}

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
    #[serde(default)]
    pub standard_orb: f64,
    #[serde(default)]
    pub engine: Option<EngineType>,
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
    let mut warnings = Vec::new();
    append_chart_compatibility_warnings(Some(chart_config), &mut warnings);
    let mut diagnostics = super::validation::validate_model(&model, "model");
    diagnostics.extend(super::validation::validate_effective_settings(
        &model,
        &effective_settings,
        "effective_settings",
    ));
    diagnostics.extend(super::validation::validate_chart_config(
        chart_config,
        &model,
        "chart.config",
    ));

    CurrentModelReport {
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
    let requested_model = chart_config
        .and_then(|config| non_empty_string(config.model.as_deref()))
        .or_else(|| non_empty_string(manifest.active_model.as_deref()))
        .map(str::to_string);

    let (base_model, source) = resolve_model_catalog(
        manifest,
        requested_model.as_deref(),
        &available_models,
        &mut warnings,
    );
    let model = merge_model_with_overrides(base_model, manifest.model_overrides.as_ref());
    let effective_settings =
        effective_model_settings(Some(manifest), &model, preset, chart_config, operation);
    append_chart_compatibility_warnings(chart_config, &mut warnings);
    let mut diagnostics = super::validation::validate_manifest_model_references(manifest, &model);
    if source == "builtin_standard_model" {
        diagnostics.extend(super::validation::validate_model(&model, "model"));
    }
    diagnostics.extend(super::validation::validate_effective_settings(
        &model,
        &effective_settings,
        "effective_settings",
    ));
    if let Some(chart_config) = chart_config {
        diagnostics.extend(super::validation::validate_chart_config(
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

fn sorted_model_names(models: &HashMap<String, AstroModel>) -> Vec<String> {
    let mut names: Vec<String> = models.keys().cloned().collect();
    names.sort();
    names
}

fn resolve_model_catalog(
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

fn merge_model_with_overrides(model: AstroModel, overrides: Option<&ModelOverrides>) -> AstroModel {
    let Some(overrides) = overrides else {
        return model;
    };

    let mut merged = model;
    for override_entry in &overrides.points {
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
        }
    }

    for override_entry in &overrides.aspects {
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
            if let Some(default_orb) = override_entry.default_orb {
                aspect.default_orb = default_orb;
            }
            if let Some(i18n) = &override_entry.i18n {
                aspect.i18n = i18n.clone();
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

fn effective_model_settings(
    manifest: Option<&WorkspaceManifest>,
    model: &AstroModel,
    preset: Option<&SettingsLayer>,
    chart_config: Option<&ChartConfig>,
    operation: Option<&SettingsLayer>,
) -> EffectiveModelSettings {
    let baseline = builtin_model_settings();
    let (model_settings, settings_source) = match model.settings.as_ref() {
        Some(settings) => (settings, SettingSource::Model),
        None => (&baseline, SettingSource::Application),
    };

    let mut house_system = model_settings.default_house_system.clone();
    let mut house_source = house_system.as_ref().map(|_| settings_source);
    let mut bodies = model_settings.default_bodies.clone();
    let mut bodies_source = settings_source;
    let mut aspects = model_settings.default_aspects.clone();
    let mut aspects_source = settings_source;
    let mut engine = model.engine.clone();
    let mut engine_source = engine.as_ref().map(|_| SettingSource::Model);
    let mut zodiac_type = model.zodiac_type.clone();
    let mut zodiac_source = zodiac_type.as_ref().map(|_| SettingSource::Model);
    let mut ayanamsa = model.ayanamsa.clone();
    let mut ayanamsa_source = ayanamsa.as_ref().map(|_| SettingSource::Model);
    let mut time_system = None;
    let mut time_source = None;

    let mut aspect_orbs = aspect_orbs_from_model(model);
    let mut aspect_orb_sources = aspect_orbs
        .keys()
        .map(|id| (id.clone(), SettingSource::Model))
        .collect();

    if let Some(manifest) = manifest {
        if let Some(value) = manifest.default.default_house_system.clone() {
            house_system = Some(value);
            house_source = Some(SettingSource::Workspace);
        }
        if let Some(value) = non_empty_vec(manifest.default.default_bodies.as_ref()) {
            bodies = value;
            bodies_source = SettingSource::Workspace;
        }
        if !manifest.bodies.is_empty() {
            bodies.clone_from(&manifest.bodies);
            bodies_source = SettingSource::Workspace;
        }
        if let Some(value) = manifest.default.default_aspects.clone() {
            aspects = value;
            aspects_source = SettingSource::Workspace;
        }
        if !manifest.aspects.is_empty() {
            aspects.clone_from(&manifest.aspects);
            aspects_source = SettingSource::Workspace;
        }
        apply_orbs(
            &mut aspect_orbs,
            &mut aspect_orb_sources,
            manifest.default.default_aspect_orbs.as_ref(),
            SettingSource::Workspace,
        );
        if let Some(value) = manifest.default.ephemeris_engine.clone() {
            engine = Some(value);
            engine_source = Some(SettingSource::Workspace);
        }
        if let Some(value) = manifest.default.time_system.clone() {
            time_system = Some(value);
            time_source = Some(SettingSource::Workspace);
        }
    }

    if let Some(layer) = preset {
        apply_settings_layer(
            layer,
            SettingSource::Preset,
            &mut house_system,
            &mut house_source,
            &mut bodies,
            &mut bodies_source,
            &mut aspects,
            &mut aspects_source,
            &mut aspect_orbs,
            &mut aspect_orb_sources,
            &mut engine,
            &mut engine_source,
            &mut zodiac_type,
            &mut zodiac_source,
            &mut ayanamsa,
            &mut ayanamsa_source,
            &mut time_system,
            &mut time_source,
        );
    }

    if let Some(config) = chart_config {
        if let Some(value) = config.house_system.clone() {
            house_system = Some(value);
            house_source = Some(SettingSource::Chart);
        }
        if let Some(value) = non_empty_vec(config.observable_objects.as_ref()) {
            bodies = value;
            bodies_source = SettingSource::Chart;
        } else if !config.included_points.is_empty() {
            bodies.clone_from(&config.included_points);
            bodies_source = SettingSource::Chart;
        }
        if let Some(value) = config.selected_aspects.clone() {
            aspects = value;
            aspects_source = SettingSource::Chart;
        }
        apply_orbs(
            &mut aspect_orbs,
            &mut aspect_orb_sources,
            Some(&config.aspect_orbs),
            SettingSource::Chart,
        );
        if let Some(value) = config.engine.clone() {
            engine = Some(value);
            engine_source = Some(SettingSource::Chart);
        }
        zodiac_type = Some(config.zodiac_type.clone());
        zodiac_source = Some(SettingSource::Chart);
        if let Some(value) = config.ayanamsa.clone() {
            ayanamsa = Some(value);
            ayanamsa_source = Some(SettingSource::Chart);
        }
        if let Some(value) = config.time_system.clone() {
            time_system = Some(value);
            time_source = Some(SettingSource::Chart);
        }
    }

    if let Some(layer) = operation {
        apply_settings_layer(
            layer,
            SettingSource::Operation,
            &mut house_system,
            &mut house_source,
            &mut bodies,
            &mut bodies_source,
            &mut aspects,
            &mut aspects_source,
            &mut aspect_orbs,
            &mut aspect_orb_sources,
            &mut engine,
            &mut engine_source,
            &mut zodiac_type,
            &mut zodiac_source,
            &mut ayanamsa,
            &mut ayanamsa_source,
            &mut time_system,
            &mut time_source,
        );
    }

    EffectiveModelSettings {
        default_house_system: house_system,
        default_bodies: bodies,
        default_aspects: aspects,
        default_transit_aspects: model_settings.default_transit_aspects.clone(),
        default_direction_aspects: model_settings.default_direction_aspects.clone(),
        default_transit_bodies: model_settings.default_transit_bodies.clone(),
        default_direction_bodies: model_settings.default_direction_bodies.clone(),
        aspect_orbs,
        standard_orb: model_settings.standard_orb,
        engine,
        zodiac_type,
        ayanamsa,
        time_system,
        degrees_in_circle: model_settings.degrees_in_circle,
        obliquity_j2000: model_settings.obliquity_j2000,
        coordinate_tolerance: model_settings.coordinate_tolerance,
        sources: EffectiveSettingsSources {
            default_house_system: house_source,
            default_bodies: bodies_source,
            default_aspects: aspects_source,
            aspect_orbs: aspect_orb_sources,
            standard_orb: settings_source,
            engine: engine_source,
            zodiac_type: zodiac_source,
            ayanamsa: ayanamsa_source,
            time_system: time_source,
            computational_constants: settings_source,
        },
    }
}

/// Materialize resolved settings on a chart configuration immediately before
/// computation. Persisted input remains unchanged unless a caller explicitly
/// saves the resulting configuration.
pub fn apply_effective_settings(config: &mut ChartConfig, settings: &EffectiveModelSettings) {
    config.house_system = settings.default_house_system.clone();
    config.observable_objects = Some(settings.default_bodies.clone());
    config.selected_aspects = Some(settings.default_aspects.clone());
    config.aspect_orbs.clone_from(&settings.aspect_orbs);
    config.engine = settings.engine.clone();
    if let Some(zodiac_type) = settings.zodiac_type.clone() {
        config.zodiac_type = zodiac_type;
    }
    config.ayanamsa = settings.ayanamsa.clone();
    config.time_system = settings.time_system.clone();
}

#[allow(clippy::too_many_arguments)]
fn apply_settings_layer(
    layer: &SettingsLayer,
    source: SettingSource,
    house_system: &mut Option<HouseSystem>,
    house_source: &mut Option<SettingSource>,
    bodies: &mut Vec<String>,
    bodies_source: &mut SettingSource,
    aspects: &mut Vec<String>,
    aspects_source: &mut SettingSource,
    aspect_orbs: &mut HashMap<String, f64>,
    aspect_orb_sources: &mut HashMap<String, SettingSource>,
    engine: &mut Option<EngineType>,
    engine_source: &mut Option<SettingSource>,
    zodiac_type: &mut Option<ZodiacType>,
    zodiac_source: &mut Option<SettingSource>,
    ayanamsa: &mut Option<Ayanamsa>,
    ayanamsa_source: &mut Option<SettingSource>,
    time_system: &mut Option<TimeSystem>,
    time_source: &mut Option<SettingSource>,
) {
    if let Some(value) = layer.house_system.clone() {
        *house_system = Some(value);
        *house_source = Some(source);
    }
    if let Some(value) = layer.bodies.clone() {
        *bodies = value;
        *bodies_source = source;
    }
    if let Some(value) = layer.aspects.clone() {
        *aspects = value;
        *aspects_source = source;
    }
    apply_orbs(
        aspect_orbs,
        aspect_orb_sources,
        Some(&layer.aspect_orbs),
        source,
    );
    if let Some(value) = layer.engine.clone() {
        *engine = Some(value);
        *engine_source = Some(source);
    }
    if let Some(value) = layer.zodiac_type.clone() {
        *zodiac_type = Some(value);
        *zodiac_source = Some(source);
    }
    if let Some(value) = layer.ayanamsa.clone() {
        *ayanamsa = Some(value);
        *ayanamsa_source = Some(source);
    }
    if let Some(value) = layer.time_system.clone() {
        *time_system = Some(value);
        *time_source = Some(source);
    }
}

fn apply_orbs(
    values: &mut HashMap<String, f64>,
    sources: &mut HashMap<String, SettingSource>,
    overrides: Option<&HashMap<String, f64>>,
    source: SettingSource,
) {
    if let Some(overrides) = overrides {
        for (id, orb) in overrides {
            values.insert(id.clone(), *orb);
            sources.insert(id.clone(), source);
        }
    }
}

fn non_empty_string(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

fn append_chart_compatibility_warnings(
    chart_config: Option<&ChartConfig>,
    warnings: &mut Vec<String>,
) {
    if chart_config.is_some_and(|config| {
        config.observable_objects.as_ref().is_none_or(Vec::is_empty)
            && !config.included_points.is_empty()
    }) {
        warnings.push("included_points_deprecated: use observable_objects".to_string());
    }
}

fn non_empty_vec(value: Option<&Vec<String>>) -> Option<Vec<String>> {
    value.filter(|items| !items.is_empty()).cloned()
}

fn aspect_orbs_from_model(model: &AstroModel) -> HashMap<String, f64> {
    model
        .aspect_definitions
        .iter()
        .map(|aspect| (aspect.id.clone(), aspect.default_orb))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::models::{
        ChartMode, ElementColorSettings, OverrideEntry, RadixPointColorSettings, WorkspaceDefaults,
    };

    fn empty_defaults() -> WorkspaceDefaults {
        WorkspaceDefaults {
            ephemeris_engine: None,
            ephemeris_backend: None,
            element_colors: None::<ElementColorSettings>,
            radix_point_colors: None::<RadixPointColorSettings>,
            default_location: None,
            language: None,
            theme: None,
            default_house_system: None,
            default_bodies: None,
            default_aspects: None,
            default_aspect_orbs: None,
            default_aspect_colors: None,
            aspect_line_tier_style: None,
            time_system: None,
        }
    }

    fn empty_manifest() -> WorkspaceManifest {
        WorkspaceManifest {
            owner: "Tester".to_string(),
            active_model: Some("default".to_string()),
            aspects: vec![],
            bodies: vec![],
            models: HashMap::new(),
            model_overrides: None,
            default: empty_defaults(),
            chart_presets: vec![],
            subjects: vec![],
            charts: vec![],
            layouts: vec![],
            annotations: vec![],
        }
    }

    fn chart_config() -> ChartConfig {
        ChartConfig {
            mode: ChartMode::NATAL,
            house_system: Some(HouseSystem::WholeSign),
            zodiac_type: ZodiacType::Sidereal,
            included_points: vec![],
            aspect_orbs: HashMap::from([("conjunction".to_string(), 4.0)]),
            selected_aspects: Some(vec!["square".to_string()]),
            display_style: String::new(),
            color_theme: String::new(),
            override_ephemeris: None,
            model: Some("western".to_string()),
            engine: Some(EngineType::Swisseph),
            ayanamsa: Some(Ayanamsa::Lahiri),
            observable_objects: Some(vec!["moon".to_string()]),
            time_system: Some(TimeSystem::Gregorian),
        }
    }

    #[test]
    fn report_synthesizes_builtin_shape_for_empty_workspace_models() {
        let report = current_model_report(&empty_manifest(), None);

        assert_eq!(report.requested_model.as_deref(), Some("default"));
        assert_eq!(report.resolved_model, "default");
        assert_eq!(report.source, "builtin_standard_model");
        assert!(report.available_models.is_empty());
        assert_eq!(
            report.effective_settings.sources.default_bodies,
            SettingSource::Model
        );
        assert!(matches!(
            report.effective_settings.engine,
            Some(EngineType::Jpl)
        ));
        assert!(
            !report.diagnostics.iter().any(|diagnostic| {
                diagnostic.severity == super::super::validation::DiagnosticSeverity::Error
            }),
            "the built-in model should satisfy its own invariants"
        );
    }

    #[test]
    fn report_applies_workspace_and_chart_overrides_with_provenance() {
        let mut manifest = empty_manifest();
        manifest.active_model = Some("western".to_string());
        manifest.default.ephemeris_engine = Some(EngineType::Jpl);
        manifest.default.default_aspect_orbs =
            Some(HashMap::from([("conjunction".to_string(), 9.0)]));
        manifest.model_overrides = Some(ModelOverrides {
            points: vec![],
            aspects: vec![OverrideEntry {
                id: "square".to_string(),
                glyph: None,
                angle: None,
                default_orb: Some(5.0),
                only_for: None,
                i18n: None,
                computed: None,
            }],
            override_orbs: HashMap::new(),
        });
        manifest
            .models
            .insert("western".to_string(), builtin_standard_model("western"));

        let report = current_model_report(&manifest, Some(&chart_config()));

        assert_eq!(report.source, "workspace_model");
        assert_eq!(report.effective_settings.default_bodies, vec!["moon"]);
        assert_eq!(report.effective_settings.default_aspects, vec!["square"]);
        assert_eq!(
            report.effective_settings.aspect_orbs.get("conjunction"),
            Some(&4.0)
        );
        assert_eq!(
            report
                .effective_settings
                .sources
                .aspect_orbs
                .get("conjunction"),
            Some(&SettingSource::Chart)
        );
        assert_eq!(
            report.effective_settings.sources.engine,
            Some(SettingSource::Chart)
        );
    }

    #[test]
    fn operation_layer_wins_without_mutating_chart_configuration() {
        let mut manifest = empty_manifest();
        manifest
            .models
            .insert("western".to_string(), builtin_standard_model("western"));
        let operation = SettingsLayer {
            house_system: Some(HouseSystem::Campanus),
            bodies: Some(vec!["sun".to_string()]),
            aspects: Some(vec![]),
            aspect_orbs: HashMap::from([("square".to_string(), 2.0)]),
            engine: Some(EngineType::Jpl),
            ..SettingsLayer::default()
        };

        let report = current_model_report_with_layers(
            &manifest,
            None,
            Some(&chart_config()),
            Some(&operation),
        );

        assert!(matches!(
            report.effective_settings.default_house_system,
            Some(HouseSystem::Campanus)
        ));
        assert_eq!(report.effective_settings.default_bodies, vec!["sun"]);
        assert!(report.effective_settings.default_aspects.is_empty());
        assert_eq!(
            report.effective_settings.sources.default_house_system,
            Some(SettingSource::Operation)
        );
        assert_eq!(
            report.effective_settings.sources.default_aspects,
            SettingSource::Operation
        );
    }

    #[test]
    fn standalone_report_uses_model_defaults_then_chart_overrides() {
        let mut config = chart_config();
        config.model = None;
        config.house_system = None;
        config.observable_objects = None;
        config.selected_aspects = None;
        config.aspect_orbs.clear();
        config.engine = None;
        config.ayanamsa = None;
        config.time_system = None;

        let report = standalone_model_report(&config);

        assert_eq!(report.requested_model, None);
        assert_eq!(report.resolved_model, "standard");
        assert_eq!(report.source, "builtin_standard_model");
        assert!(report.warnings.is_empty());
        assert!(matches!(
            report.effective_settings.default_house_system,
            Some(HouseSystem::Placidus)
        ));
        assert!(matches!(
            report.effective_settings.engine,
            Some(EngineType::Jpl)
        ));
        assert_eq!(
            report.effective_settings.sources.default_bodies,
            SettingSource::Model
        );
        assert_eq!(
            report.effective_settings.sources.zodiac_type,
            Some(SettingSource::Chart)
        );

        let mut materialized = config;
        apply_effective_settings(&mut materialized, &report.effective_settings);
        assert!(matches!(
            materialized.house_system,
            Some(HouseSystem::Placidus)
        ));
        assert_eq!(
            materialized.observable_objects,
            Some(report.effective_settings.default_bodies)
        );
    }

    #[test]
    fn legacy_included_points_are_resolved_as_a_deprecated_chart_override() {
        let mut config = chart_config();
        config.observable_objects = None;
        config.included_points = vec!["sun".to_string(), "asc".to_string()];

        let report = standalone_model_report(&config);

        assert_eq!(report.effective_settings.default_bodies, vec!["sun", "asc"]);
        assert_eq!(
            report.effective_settings.sources.default_bodies,
            SettingSource::Chart
        );
        assert_eq!(
            report.warnings,
            vec!["included_points_deprecated: use observable_objects"]
        );
    }

    #[test]
    fn shared_resolution_fixture_matches_cross_language_contract() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../contracts/settings-resolution.json"
        ))
        .expect("shared settings fixture should be valid JSON");
        let workspace_layer: SettingsLayer =
            serde_json::from_value(fixture["workspace"].clone())
                .expect("workspace fixture layer should deserialize");
        let preset: SettingsLayer = serde_json::from_value(fixture["preset"].clone())
            .expect("preset fixture layer should deserialize");
        let chart: ChartConfig = serde_json::from_value(fixture["chart"].clone())
            .expect("chart fixture should deserialize");
        let operation: SettingsLayer = serde_json::from_value(fixture["operation"].clone())
            .expect("operation fixture layer should deserialize");
        let expected = &fixture["expected"];

        let mut manifest = empty_manifest();
        manifest.active_model = Some("standard".to_string());
        manifest.models.insert(
            "standard".to_string(),
            builtin_standard_model("standard"),
        );
        manifest.default.default_house_system = workspace_layer.house_system;
        manifest.default.default_bodies = workspace_layer.bodies;
        manifest.default.default_aspects = workspace_layer.aspects;
        manifest.default.default_aspect_orbs = Some(workspace_layer.aspect_orbs);
        manifest.default.ephemeris_engine = workspace_layer.engine;
        manifest.default.time_system = workspace_layer.time_system;

        let report = current_model_report_with_layers(
            &manifest,
            Some(&preset),
            Some(&chart),
            Some(&operation),
        );
        let settings = &report.effective_settings;

        assert_eq!(
            serde_json::to_value(&settings.default_house_system).unwrap(),
            expected["houseSystem"]
        );
        assert_eq!(
            serde_json::to_value(&settings.default_bodies).unwrap(),
            expected["bodies"]
        );
        assert_eq!(
            serde_json::to_value(&settings.default_aspects).unwrap(),
            expected["aspects"]
        );
        assert_eq!(
            serde_json::to_value(&settings.engine).unwrap(),
            expected["engine"]
        );
        assert_eq!(
            serde_json::to_value(&settings.zodiac_type).unwrap(),
            expected["zodiacType"]
        );
        assert_eq!(
            serde_json::to_value(&settings.ayanamsa).unwrap(),
            expected["ayanamsa"]
        );
        assert_eq!(
            serde_json::to_value(&settings.time_system).unwrap(),
            expected["timeSystem"]
        );
        for (aspect_id, expected_orb) in expected["aspectOrbs"]
            .as_object()
            .expect("expected aspect orbs should be an object")
        {
            assert_eq!(
                settings.aspect_orbs.get(aspect_id).copied(),
                expected_orb.as_f64()
            );
        }
        assert_eq!(
            settings.sources.default_house_system,
            Some(SettingSource::Chart)
        );
        assert_eq!(
            settings.sources.default_bodies,
            SettingSource::Operation
        );
        assert_eq!(
            settings.sources.default_aspects,
            SettingSource::Operation
        );
        assert_eq!(settings.sources.engine, Some(SettingSource::Operation));
        assert_eq!(
            settings.sources.zodiac_type,
            Some(SettingSource::Chart)
        );
        assert_eq!(settings.sources.ayanamsa, Some(SettingSource::Chart));
        assert_eq!(
            settings.sources.time_system,
            Some(SettingSource::Operation)
        );
        for (aspect_id, source) in [
            ("conjunction", SettingSource::Workspace),
            ("square", SettingSource::Operation),
            ("trine", SettingSource::Chart),
        ] {
            assert_eq!(settings.sources.aspect_orbs.get(aspect_id), Some(&source));
        }
        assert!(report.diagnostics.iter().all(|diagnostic| {
            diagnostic.severity != super::super::validation::DiagnosticSeverity::Error
        }));
    }
}
