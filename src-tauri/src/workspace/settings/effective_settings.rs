use crate::workspace::model_catalog::builtin_model_settings;
use crate::workspace::models::{
    AstroModel, ChartConfig, ObjectType, ObjectTypeRule, PositionMode, WorkspaceManifest,
    NON_PHYSICAL_OBJECT_TYPES,
};

use super::apply::{apply_orbs, apply_settings_layer, aspect_orbs_from_model, non_empty_vec};
use super::layer::{SettingSource, SettingsLayer};
use super::report::{EffectiveModelSettings, EffectiveSettingsSources};

/// Apply the workspace's "Settings > Aspects" object-scope choice onto the resolved model.
///
/// `extended_object_types` — which non-`Planet` categories (`Angle`, asteroids, lunar nodes,
/// parts, geocentric nodes, trans-Neptunian objects, hypothetical bodies) may participate — is
/// global: the same set is the eligibility baseline for every aspect. `None` (never configured)
/// leaves every aspect's baseline untouched (the catalog's own unrestricted default, or whatever
/// `model_overrides` already gave it). The per-object orb narrowing itself
/// (`WorkspaceDefaults::object_orbs`) is resolved later, during actual aspect matching in
/// `domain::astrology`, not here — this function only decides eligibility.
///
/// One exception to "global, same for every aspect": conjunction gets the full enabled set, but
/// every other aspect additionally excludes `NON_PHYSICAL_OBJECT_TYPES` — a trine/square/sextile/
/// etc. models a geometric ray of light between two bodies, which a pure mathematical point
/// (a node, Lilith, an angle, an Arabic Part, a never-confirmed Uranian hypothetical) can't
/// participate in; conjunction (bodily co-presence) still applies to them regardless.
pub(super) fn apply_workspace_aspect_scope_defaults(
    model: &mut AstroModel,
    manifest: &WorkspaceManifest,
) {
    let Some(extended_types) = manifest.default.extended_object_types.as_ref() else {
        return;
    };

    for aspect in &mut model.aspect_definitions {
        let mut types = vec![ObjectType::Planet];
        if aspect.id == "conjunction" {
            types.extend(extended_types.iter().copied());
        } else {
            types.extend(
                extended_types
                    .iter()
                    .copied()
                    .filter(|object_type| !NON_PHYSICAL_OBJECT_TYPES.contains(object_type)),
            );
        }
        aspect.object_type_rule = Some(ObjectTypeRule::OnlyBetween { types });
    }
}

pub(super) fn effective_model_settings(
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
    let mut position_mode = model_settings
        .position_mode
        .unwrap_or(PositionMode::Apparent);
    let mut position_mode_source = if model_settings.position_mode.is_some() {
        settings_source
    } else {
        SettingSource::Application
    };
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
    let object_orbs = manifest
        .and_then(|manifest| manifest.default.object_orbs.clone())
        .unwrap_or_default();

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
        if let Some(value) = manifest.default.position_mode {
            position_mode = value;
            position_mode_source = SettingSource::Workspace;
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
            &mut position_mode,
            &mut position_mode_source,
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
        if let Some(value) = config.observable_objects.clone() {
            bodies = value;
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
        if let Some(value) = config.position_mode {
            position_mode = value;
            position_mode_source = SettingSource::Chart;
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
            &mut position_mode,
            &mut position_mode_source,
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
        object_orbs,
        standard_orb: model_settings.standard_orb,
        engine,
        position_mode,
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
            position_mode: position_mode_source,
            zodiac_type: zodiac_source,
            ayanamsa: ayanamsa_source,
            time_system: time_source,
            computational_constants: settings_source,
        },
    }
}
