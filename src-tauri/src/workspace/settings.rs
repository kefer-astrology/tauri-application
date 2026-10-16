//! Layered astrological setting resolution.
//!
//! Precedence is deterministic:
//! application fallback < model < workspace < preset < chart < operation.
//! The resolved report includes provenance so callers can explain why a value
//! was selected.
//!
//! Facade for the `settings/` submodules: `layer` (the sparse per-scope
//! settings layer and its source enum), `report` (the resolved report types
//! and the `current_model_report*`/`standalone_model_report*` entry points),
//! `model_catalog_resolution` (picking and merging the workspace's model
//! catalog), `effective_settings` (the core layering algorithm), and `apply`
//! (materializing resolved settings, plus small shared helpers). Every
//! existing `crate::workspace::settings::X` import path keeps resolving
//! unchanged through the re-exports below.
//!
//! Some re-exports below are only ever reached through the shorter
//! `crate::workspace::X` path (via `workspace::mod`'s own further `pub use
//! settings::{...}`), never through the fully-qualified `settings::X` path
//! directly, so rustc's `unused_imports` lint fires on them in isolation even
//! though they are load-bearing public API — hence the blanket allow (see the
//! identical situation and rationale in `workspace/models.rs`).
#![allow(unused_imports)]

mod apply;
mod effective_settings;
mod layer;
mod model_catalog_resolution;
mod report;

pub use apply::apply_effective_settings;
pub use layer::{SettingSource, SettingsLayer};
pub use report::{
    current_model_report, current_model_report_with_layers,
    standalone_model_report_with_operation, CurrentModelReport, EffectiveModelSettings,
    EffectiveSettingsSources,
};
// `standalone_model_report` is itself `#[cfg(test)]` in `report` (only ever used from this
// module's own test suite), so its re-export must be cfg-gated the same way, or a plain
// `cargo check`/non-test build fails to resolve the always-on `pub use` above.
#[cfg(test)]
pub use report::standalone_model_report;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::models::{
        AspectContext, AstrologySchool, BaseChartPurpose, ChartDefinition, OverrideEntry,
        RadixPointColorSettings, WorkspaceDefaults, WorkspacePresentation,
    };
    use crate::workspace::models::{
        Ayanamsa, ChartConfig, EngineType, HouseSystem, ModelOverrides, PositionMode, TimeSystem,
        WorkspaceManifest, ZodiacType,
    };
    use crate::workspace::model_catalog::builtin_standard_model;
    use std::collections::HashMap;

    fn empty_defaults() -> WorkspaceDefaults {
        WorkspaceDefaults {
            ephemeris_engine: None,
            position_mode: None,
            ephemeris_backend: None,
            radix_point_colors: None::<RadixPointColorSettings>,
            default_location: None,
            default_house_system: None,
            default_bodies: None,
            default_aspects: None,
            default_aspect_orbs: None,
            default_aspect_colors: None,
            extended_object_types: None,
            object_orbs: None,
            astrology_tradition: None,
            aspect_line_tier_style: None,
            time_system: None,
        }
    }

    fn empty_manifest() -> WorkspaceManifest {
        WorkspaceManifest {
            schema_version: 1,
            owner: "Tester".to_string(),
            active_school: None,
            schools: HashMap::new(),
            active_model: Some("default".to_string()),
            aspects: vec![],
            bodies: vec![],
            models: HashMap::new(),
            model_overrides: None,
            default: empty_defaults(),
            presentation: WorkspacePresentation::default(),
            tag_catalog: vec![],
            chart_presets: vec![],
            subjects: vec![],
            charts: vec![],
            analyses: vec![],
            transit_analyses: vec![],
            layouts: vec![],
            annotations: vec![],
        }
    }

    fn chart_config() -> ChartConfig {
        ChartConfig {
            definition: ChartDefinition::Base {
                purpose: BaseChartPurpose::Natal,
            },
            house_system: Some(HouseSystem::WholeSign),
            zodiac_type: ZodiacType::Sidereal,
            aspect_orbs: HashMap::from([("conjunction".to_string(), 4.0)]),
            selected_aspects: Some(vec!["square".to_string()]),
            override_ephemeris: None,
            model: Some("western".to_string()),
            model_overrides: None,
            engine: Some(EngineType::Swisseph),
            position_mode: None,
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
                diagnostic.severity == crate::workspace::validation::DiagnosticSeverity::Error
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
                harmonic: None,
                default_orb: Some(5.0),
                only_for: None,
                i18n: None,
                computed: None,
                enabled: None,
                valid_contexts: None,
                interpretation_weight: None,
                object_type_rule: None,
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
    fn school_default_and_chart_definition_override_are_resolved() {
        let mut manifest = empty_manifest();
        let mut model = builtin_standard_model("traditional-default");
        model.school = Some("traditional".to_string());
        manifest.models.insert(model.name.clone(), model);
        manifest.schools.insert(
            "traditional".to_string(),
            AstrologySchool {
                id: "traditional".to_string(),
                extends: None,
                default_model: "traditional-default".to_string(),
            },
        );
        manifest.active_school = Some("traditional".to_string());
        manifest.active_model = None;
        let mut chart = chart_config();
        chart.model = None;
        chart.model_overrides = Some(ModelOverrides {
            points: Vec::new(),
            aspects: vec![OverrideEntry {
                id: "square".to_string(),
                glyph: None,
                angle: Some(91.0),
                harmonic: None,
                default_orb: Some(2.0),
                only_for: Some(vec!["traditional".to_string()]),
                i18n: None,
                computed: Some(true),
                enabled: Some(false),
                valid_contexts: Some(vec![AspectContext::Transit]),
                interpretation_weight: Some(0.5),
                object_type_rule: None,
            }],
            override_orbs: HashMap::new(),
        });

        let report = current_model_report(&manifest, Some(&chart));
        let square = report
            .model
            .aspect_definitions
            .iter()
            .find(|aspect| aspect.id == "square")
            .expect("square definition");

        assert_eq!(report.requested_school.as_deref(), Some("traditional"));
        assert_eq!(report.resolved_model, "traditional-default");
        assert!(!square.enabled);
        assert_eq!(square.angle, 91.0);
        assert_eq!(square.default_orb, 2.0);
        assert_eq!(square.interpretation_weight, Some(0.5));
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
    fn shared_resolution_fixture_matches_cross_language_contract() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../../contracts/settings-resolution.json"))
                .expect("shared settings fixture should be valid JSON");
        let workspace_layer: SettingsLayer = serde_json::from_value(fixture["workspace"].clone())
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
        manifest
            .models
            .insert("standard".to_string(), builtin_standard_model("standard"));
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
            report.model.aspect_definitions.len() as u64,
            fixture["catalog"]["aspectCount"]
                .as_u64()
                .expect("catalog aspect count should be an unsigned integer")
        );

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
            serde_json::to_value(settings.position_mode).unwrap(),
            expected["positionMode"]
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
        assert_eq!(settings.sources.default_bodies, SettingSource::Operation);
        assert_eq!(settings.sources.default_aspects, SettingSource::Operation);
        assert_eq!(settings.sources.engine, Some(SettingSource::Operation));
        assert_eq!(settings.sources.position_mode, SettingSource::Operation);
        assert_eq!(settings.sources.zodiac_type, Some(SettingSource::Chart));
        assert_eq!(settings.sources.ayanamsa, Some(SettingSource::Chart));
        assert_eq!(settings.sources.time_system, Some(SettingSource::Operation));
        for (aspect_id, source) in [
            ("conjunction", SettingSource::Workspace),
            ("square", SettingSource::Operation),
            ("trine", SettingSource::Chart),
        ] {
            assert_eq!(settings.sources.aspect_orbs.get(aspect_id), Some(&source));
        }
        assert!(report.diagnostics.iter().all(|diagnostic| {
            diagnostic.severity != crate::workspace::validation::DiagnosticSeverity::Error
        }));
    }

    #[test]
    fn untouched_workspace_leaves_aspect_object_type_rule_unrestricted() {
        let mut manifest = empty_manifest();
        manifest
            .models
            .insert("standard".to_string(), builtin_standard_model("standard"));
        manifest.active_model = Some("standard".to_string());

        let report = current_model_report(&manifest, None);
        let square = report
            .model
            .aspect_definitions
            .iter()
            .find(|aspect| aspect.id == "square")
            .expect("square definition");

        assert!(square.object_type_rule.is_none());
    }

    #[test]
    fn workspace_extended_object_types_apply_to_every_aspect_except_angle() {
        let mut manifest = empty_manifest();
        manifest
            .models
            .insert("standard".to_string(), builtin_standard_model("standard"));
        manifest.active_model = Some("standard".to_string());
        // Asteroid is physical (eligible everywhere); Angle is not (conjunction-only).
        manifest.default.extended_object_types = Some(vec![
            crate::workspace::models::ObjectType::Asteroid,
            crate::workspace::models::ObjectType::Angle,
        ]);

        let report = current_model_report(&manifest, None);
        for id in ["quincunx", "trine"] {
            let aspect = report
                .model
                .aspect_definitions
                .iter()
                .find(|aspect| aspect.id == id)
                .unwrap_or_else(|| panic!("{id} definition"));
            match &aspect.object_type_rule {
                Some(crate::workspace::models::ObjectTypeRule::OnlyBetween { types }) => {
                    assert!(types.contains(&crate::workspace::models::ObjectType::Planet));
                    assert!(types.contains(&crate::workspace::models::ObjectType::Asteroid));
                    assert!(!types.contains(&crate::workspace::models::ObjectType::Angle));
                }
                other => panic!("{id}: expected OnlyBetween rule, got {other:?}"),
            }
        }
    }

    #[test]
    fn conjunction_keeps_every_enabled_category_including_non_physical_ones() {
        let mut manifest = empty_manifest();
        manifest
            .models
            .insert("standard".to_string(), builtin_standard_model("standard"));
        manifest.active_model = Some("standard".to_string());
        manifest.default.extended_object_types = Some(vec![
            crate::workspace::models::ObjectType::Asteroid,
            crate::workspace::models::ObjectType::Angle,
            crate::workspace::models::ObjectType::LunarNode,
        ]);

        let report = current_model_report(&manifest, None);
        let conjunction = report
            .model
            .aspect_definitions
            .iter()
            .find(|aspect| aspect.id == "conjunction")
            .expect("conjunction definition");
        match &conjunction.object_type_rule {
            Some(crate::workspace::models::ObjectTypeRule::OnlyBetween { types }) => {
                assert!(types.contains(&crate::workspace::models::ObjectType::Planet));
                assert!(types.contains(&crate::workspace::models::ObjectType::Asteroid));
                assert!(types.contains(&crate::workspace::models::ObjectType::Angle));
                assert!(types.contains(&crate::workspace::models::ObjectType::LunarNode));
            }
            other => panic!("conjunction: expected OnlyBetween rule, got {other:?}"),
        }
    }
}
