//! Built-in astrological model data.
//!
//! This module is the fallback catalog used when a workspace does not provide a
//! model. It contains data construction only; selecting a model and resolving
//! layered settings belongs to `settings`.

use std::collections::HashMap;

use super::models::{
    AspectDefinition, AstroModel, BodyDefinition, Element, EngineType, HouseSystem, ModelSettings,
    ObjectType, Sign, ZodiacType,
};

pub(super) fn builtin_model_settings() -> ModelSettings {
    ModelSettings {
        default_house_system: Some(HouseSystem::Placidus),
        default_aspects: vec![
            "conjunction".to_string(),
            "sextile".to_string(),
            "square".to_string(),
            "trine".to_string(),
            "quincunx".to_string(),
            "opposition".to_string(),
        ],
        default_bodies: vec![
            "sun".to_string(),
            "moon".to_string(),
            "mercury".to_string(),
            "venus".to_string(),
            "mars".to_string(),
            "jupiter".to_string(),
            "saturn".to_string(),
            "uranus".to_string(),
            "neptune".to_string(),
            "pluto".to_string(),
            "asc".to_string(),
            "mc".to_string(),
            "desc".to_string(),
            "ic".to_string(),
            "north_node".to_string(),
            "south_node".to_string(),
            "lilith".to_string(),
            "chiron".to_string(),
        ],
        standard_orb: 1.0,
        default_transit_aspects: None,
        default_direction_aspects: None,
        default_transit_bodies: None,
        default_direction_bodies: None,
        degrees_in_circle: 360.0,
        obliquity_j2000: 23.439_291_1,
        coordinate_tolerance: 0.000_1,
    }
}

pub(crate) fn builtin_standard_model(name: &str) -> AstroModel {
    AstroModel {
        name: name.to_string(),
        school: None,
        version: 1,
        body_definitions: builtin_body_definitions(),
        aspect_definitions: builtin_aspect_definitions(),
        signs: builtin_signs(),
        settings: Some(builtin_model_settings()),
        engine: Some(EngineType::Jpl),
        zodiac_type: Some(ZodiacType::Tropical),
        ayanamsa: None,
    }
}

fn builtin_body_definitions() -> Vec<BodyDefinition> {
    vec![
        body_definition(
            "sun",
            "Sun",
            "☉",
            ObjectType::Planet,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "moon",
            "Moon",
            "☽",
            ObjectType::Planet,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "mercury",
            "Mercury",
            "☿",
            ObjectType::Planet,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "venus",
            "Venus",
            "♀",
            ObjectType::Planet,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "mars",
            "Mars",
            "♂",
            ObjectType::Planet,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "jupiter",
            "Jupiter",
            "♃",
            ObjectType::Planet,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "saturn",
            "Saturn",
            "♄",
            ObjectType::Planet,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "uranus",
            "Uranus",
            "♅",
            ObjectType::Planet,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "neptune",
            "Neptune",
            "♆",
            ObjectType::Planet,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "pluto",
            "Pluto",
            "♇",
            ObjectType::Planet,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "asc",
            "Ascendant",
            "Asc",
            ObjectType::Angle,
            true,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "mc",
            "Midheaven",
            "MC",
            ObjectType::Angle,
            true,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "desc",
            "Descendant",
            "Desc",
            ObjectType::Angle,
            true,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "ic",
            "Imum Coeli",
            "IC",
            ObjectType::Angle,
            true,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "north_node",
            "North Node",
            "☊",
            ObjectType::LunarNode,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "south_node",
            "South Node",
            "☋",
            ObjectType::LunarNode,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "true_north_node",
            "True North Node",
            "☊",
            ObjectType::LunarNode,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "true_south_node",
            "True South Node",
            "☋",
            ObjectType::LunarNode,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "lilith",
            "Lilith",
            "⚸",
            ObjectType::CalculatedPoint,
            false,
            false,
            EngineSupport::SwissOnly,
        ),
        body_definition(
            "chiron",
            "Chiron",
            "⚷",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::SwissOnly,
        ),
        body_definition(
            "ceres",
            "Ceres",
            "⚳",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "pallas",
            "Pallas",
            "⚴",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "juno",
            "Juno",
            "⚵",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::Both,
        ),
        body_definition(
            "vesta",
            "Vesta",
            "⚶",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::Both,
        ),
    ]
}

#[derive(Clone, Copy)]
enum EngineSupport {
    Both,
    SwissOnly,
}

fn body_definition(
    id: &str,
    label: &str,
    glyph: &str,
    object_type: ObjectType,
    requires_location: bool,
    requires_house_system: bool,
    engine_support: EngineSupport,
) -> BodyDefinition {
    let mut computation_map = HashMap::from([("swisseph".to_string(), Some(id.to_string()))]);
    computation_map.insert(
        "jpl".to_string(),
        matches!(engine_support, EngineSupport::Both).then(|| id.to_string()),
    );

    BodyDefinition {
        id: id.to_string(),
        enabled: true,
        glyph: glyph.to_string(),
        formula: id.to_string(),
        element: None,
        avg_speed: 0.0,
        max_orb: 0.0,
        i18n: HashMap::from([("en".to_string(), label.to_string())]),
        object_type: Some(object_type),
        computation_map,
        requires_location,
        requires_house_system,
    }
}

fn builtin_aspect_definitions() -> Vec<AspectDefinition> {
    vec![
        aspect_definition("conjunction", "Conjunction", 0.0, 8.0),
        aspect_definition("sextile", "Sextile", 60.0, 6.0),
        aspect_definition("square", "Square", 90.0, 8.0),
        aspect_definition("trine", "Trine", 120.0, 8.0),
        aspect_definition("quincunx", "Quincunx", 150.0, 3.0),
        aspect_definition("opposition", "Opposition", 180.0, 8.0),
        aspect_definition("semisextile", "Semisextile", 30.0, 2.0),
        aspect_definition("decile", "Decile", 36.0, 1.0),
        aspect_definition("novile", "Novile", 40.0, 1.0),
        aspect_definition("semisquare", "Semisquare", 45.0, 2.0),
        aspect_definition("septile", "Septile", 51.428_571_428_571_43, 1.0),
        aspect_definition("quintile", "Quintile", 72.0, 2.0),
        aspect_definition("binovile", "Binovile", 80.0, 1.0),
        aspect_definition("tridecile", "Tridecile", 108.0, 1.0),
        aspect_definition("sesquiquadrate", "Sesquiquadrate", 135.0, 2.0),
        aspect_definition("biquintile", "Biquintile", 144.0, 2.0),
        aspect_definition("quadrinovile", "Quadrinovile", 160.0, 1.0),
    ]
}

fn aspect_definition(id: &str, label: &str, angle: f64, default_orb: f64) -> AspectDefinition {
    AspectDefinition {
        id: id.to_string(),
        enabled: true,
        glyph: label.to_string(),
        angle,
        default_orb,
        i18n: HashMap::from([("en".to_string(), label.to_string())]),
        color: None,
        importance: None,
        line_style: None,
        line_width: None,
        show_label: None,
        valid_contexts: None,
        interpretation_weight: None,
    }
}

fn builtin_signs() -> Vec<Sign> {
    vec![
        sign("Aries", "Ar", "Ari", Element::Fire),
        sign("Taurus", "Ta", "Tau", Element::Earth),
        sign("Gemini", "Ge", "Gem", Element::Air),
        sign("Cancer", "Ca", "Can", Element::Water),
        sign("Leo", "Le", "Leo", Element::Fire),
        sign("Virgo", "Vi", "Vir", Element::Earth),
        sign("Libra", "Li", "Lib", Element::Air),
        sign("Scorpio", "Sc", "Sco", Element::Water),
        sign("Sagittarius", "Sg", "Sag", Element::Fire),
        sign("Capricorn", "Cp", "Cap", Element::Earth),
        sign("Aquarius", "Aq", "Aqu", Element::Air),
        sign("Pisces", "Pi", "Pis", Element::Water),
    ]
}

fn sign(name: &str, glyph: &str, abbreviation: &str, element: Element) -> Sign {
    Sign {
        name: name.to_string(),
        glyph: glyph.to_string(),
        abbreviation: abbreviation.to_string(),
        element,
        i18n: HashMap::from([("en".to_string(), name.to_string())]),
    }
}
