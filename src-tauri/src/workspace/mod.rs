pub mod loader;
mod model_catalog;
pub mod models;
pub mod morinus;
pub mod settings;
pub mod sfs;
pub mod solar_fire;
pub mod tradition;
pub mod validation;
pub mod writer;

pub use loader::{
    chart_to_summary, find_chart_preset, load_all_analyses, load_all_charts,
    load_workspace_aggregate, load_workspace_manifest,
};
pub(crate) use model_catalog::builtin_standard_model;
pub use models::*;
pub use settings::{current_model_report, CurrentModelReport};

use models::{DomainCatalog, DomainDefinition, GeneratedVariantRule, HouseSystemDefinition};

pub fn builtin_domain_catalog() -> DomainCatalog {
    domain_catalog_for_model(builtin_standard_model("builtin"))
}

pub fn domain_catalog_for_model(model: models::AstroModel) -> DomainCatalog {
    let mut model = model;
    for sign in &mut model.signs {
        if sign.id.trim().is_empty() {
            sign.id = sign.name.to_ascii_lowercase().replace(' ', "_");
        }
    }
    let house_systems = vec![
        ("Placidus", true),
        ("Whole Sign", true),
        ("Campanus", true),
        ("Koch", true),
        ("Equal", true),
        ("Regiomontanus", true),
        ("Vehlow", true),
        ("Porphyry", true),
        ("Alcabitius", true),
    ]
    .into_iter()
    .map(|(id, computation_supported)| HouseSystemDefinition {
        id: id.to_string(),
        computation_supported,
    })
    .collect();
    let mut shapes: Vec<DomainDefinition> = vec![
        ("bundle", "open_shape_bundle"),
        ("bowl", "open_shape_bowl"),
        ("bowl_east", "open_shape_bowl_east"),
        ("bowl_west", "open_shape_bowl_west"),
        ("bowl_day", "open_shape_bowl_day"),
        ("bowl_night", "open_shape_bowl_night"),
        ("locomotive", "open_shape_locomotive"),
        ("seesaw", "open_shape_seesaw"),
        ("splash", "open_shape_splash"),
        ("splay", "open_shape_splay"),
        ("shifted_center", "open_shape_shifted_center"),
        ("stellium", "info_stellium"),
    ]
    .into_iter()
    .map(|(id, translation_key)| DomainDefinition {
        id: id.to_string(),
        translation_key: translation_key.to_string(),
        parent_id: None,
        generated_variant: None,
    })
    .chain(
        [
            ("bowl_leader", "open_shape_leading_planet"),
            ("locomotive_leader", "open_shape_leading_planet"),
            ("bucket", "open_shape_bucket"),
        ]
        .into_iter()
        .map(|(id, translation_key)| DomainDefinition {
            id: id.to_string(),
            translation_key: translation_key.to_string(),
            parent_id: None,
            generated_variant: Some(GeneratedVariantRule {
                prefix: format!("{id}_"),
                source: "body_definitions".to_string(),
            }),
        }),
    )
    .collect();
    // These are concrete IDs because the computation emits them directly. The
    // parent entries above describe the generation rule; these entries make the
    // catalog independently consumable by filtering UIs.
    for (prefix, label_prefix) in [
        ("bowl_leader_", "planet_"),
        ("locomotive_leader_", "planet_"),
        ("bucket_", "planet_"),
    ] {
        for body in [
            "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
            "pluto",
        ] {
            shapes.push(DomainDefinition {
                id: format!("{prefix}{body}"),
                translation_key: format!("{label_prefix}{body}"),
                parent_id: Some(prefix.trim_end_matches('_').to_string()),
                generated_variant: None,
            });
        }
    }
    let mut configurations: Vec<DomainDefinition> = vec![
        ("t_square", "open_configuration_t_square"),
        ("grand_cross", "open_configuration_grand_cross"),
        ("grand_trine", "open_configuration_grand_trine"),
        ("kite", "open_configuration_kite"),
        ("mystic_rectangle", "open_configuration_mystic_rectangle"),
        ("hexagram", "open_configuration_hexagram"),
        ("pentagram", "open_configuration_pentagram"),
        ("double_quincunx", "open_configuration_double_quincunx"),
        ("double_biquintile", "open_configuration_double_biquintile"),
    ]
    .into_iter()
    .map(|(id, translation_key)| DomainDefinition {
        id: id.to_string(),
        translation_key: translation_key.to_string(),
        parent_id: None,
        generated_variant: None,
    })
    .chain(
        [
            ("t_square_", "open_modality_"),
            ("grand_cross_", "open_modality_"),
            ("grand_trine_", "open_element_"),
            ("kite_", "open_element_"),
        ]
        .into_iter()
        .map(|(prefix, translation_key)| DomainDefinition {
            id: prefix.to_string(),
            translation_key: translation_key.to_string(),
            parent_id: None,
            generated_variant: Some(GeneratedVariantRule {
                prefix: prefix.to_string(),
                source: "sign_definitions".to_string(),
            }),
        }),
    )
    .collect();
    for (prefix, suffixes, translation_prefix) in [
        (
            "t_square_",
            &["cardinal", "fixed", "mutable"][..],
            "open_modality_",
        ),
        (
            "grand_cross_",
            &["cardinal", "fixed", "mutable"][..],
            "open_modality_",
        ),
        (
            "grand_trine_",
            &["fire", "earth", "air", "water"][..],
            "open_element_",
        ),
        (
            "kite_",
            &["fire", "earth", "air", "water"][..],
            "open_element_",
        ),
    ] {
        for suffix in suffixes {
            configurations.push(DomainDefinition {
                id: format!("{prefix}{suffix}"),
                translation_key: format!("{translation_prefix}{suffix}"),
                parent_id: Some(prefix.trim_end_matches('_').to_string()),
                generated_variant: None,
            });
        }
    }
    DomainCatalog {
        model,
        house_systems,
        shapes,
        configurations,
    }
}

#[cfg(test)]
mod catalog_tests {
    use super::*;

    #[test]
    fn builtin_catalog_covers_every_emitted_shape_and_configuration_id() {
        let catalog = builtin_domain_catalog();
        let shapes: std::collections::HashSet<_> =
            catalog.shapes.iter().map(|item| item.id.as_str()).collect();
        let configurations: std::collections::HashSet<_> = catalog
            .configurations
            .iter()
            .map(|item| item.id.as_str())
            .collect();
        for id in [
            "bundle",
            "bowl",
            "bowl_east",
            "bowl_west",
            "bowl_day",
            "bowl_night",
            "bucket",
            "locomotive",
            "seesaw",
            "splash",
            "splay",
            "shifted_center",
            "stellium",
        ] {
            assert!(shapes.contains(id), "missing emitted shape {id}");
        }
        for id in [
            "t_square",
            "grand_cross",
            "grand_trine",
            "kite",
            "mystic_rectangle",
            "hexagram",
            "pentagram",
            "double_quincunx",
            "double_biquintile",
        ] {
            assert!(
                configurations.contains(id),
                "missing emitted configuration {id}"
            );
        }
        assert!(catalog.model.signs.len() == 12);
        assert!(catalog.model.signs.iter().all(|sign| !sign.id.is_empty()));
        assert!(catalog
            .shapes
            .iter()
            .all(|item| !item.translation_key.is_empty()));
        assert!(catalog
            .configurations
            .iter()
            .all(|item| !item.translation_key.is_empty()));
        assert!(catalog
            .model
            .body_definitions
            .iter()
            .any(|body| body.id == "sun"));
        assert!(catalog
            .model
            .aspect_definitions
            .iter()
            .any(|aspect| aspect.id == "conjunction"));
    }
}
pub use validation::WorkspaceValidationReport;
