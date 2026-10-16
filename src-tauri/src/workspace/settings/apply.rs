use std::collections::HashMap;

use crate::workspace::models::{
    Ayanamsa, AstroModel, ChartConfig, EngineType, HouseSystem, PositionMode, TimeSystem,
    ZodiacType,
};

use super::layer::{SettingSource, SettingsLayer};
use super::report::EffectiveModelSettings;

/// Materialize resolved settings on a chart configuration immediately before
/// computation. Persisted input remains unchanged unless a caller explicitly
/// saves the resulting configuration.
pub fn apply_effective_settings(config: &mut ChartConfig, settings: &EffectiveModelSettings) {
    config.house_system = settings.default_house_system.clone();
    config.observable_objects = Some(settings.default_bodies.clone());
    config.selected_aspects = Some(settings.default_aspects.clone());
    config.aspect_orbs.clone_from(&settings.aspect_orbs);
    config.engine = settings.engine.clone();
    config.position_mode = Some(settings.position_mode);
    if let Some(zodiac_type) = settings.zodiac_type.clone() {
        config.zodiac_type = zodiac_type;
    }
    config.ayanamsa = settings.ayanamsa.clone();
    config.time_system = settings.time_system.clone();
}

#[allow(clippy::too_many_arguments)]
pub(super) fn apply_settings_layer(
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
    position_mode: &mut PositionMode,
    position_mode_source: &mut SettingSource,
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
    if let Some(value) = layer.position_mode {
        *position_mode = value;
        *position_mode_source = source;
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

pub(super) fn apply_orbs(
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

pub(super) fn non_empty_string(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

pub(super) fn non_empty_vec(value: Option<&Vec<String>>) -> Option<Vec<String>> {
    value.filter(|items| !items.is_empty()).cloned()
}

pub(super) fn aspect_orbs_from_model(model: &AstroModel) -> HashMap<String, f64> {
    model
        .aspect_definitions
        .iter()
        .map(|aspect| (aspect.id.clone(), aspect.default_orb))
        .collect()
}
