//! Built-in astrological model data.
//!
//! This module is the fallback catalog used when a workspace does not provide a
//! model. It contains data construction only; selecting a model and resolving
//! layered settings belongs to `settings`.

use std::collections::HashMap;

use super::models::{
    AspectDefinition, AstroModel, BodyDefinition, Element, EngineType, HouseSystem, ModelSettings,
    ObjectType, PositionMode, Sign, ZodiacType,
};

pub(super) fn builtin_model_settings() -> ModelSettings {
    ModelSettings {
        default_house_system: Some(HouseSystem::Placidus),
        position_mode: Some(PositionMode::Apparent),
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
            EngineSupport::Both,
        ),
        // Osculating/"true" Black Moon Lilith (lunar apogee), computed via the
        // eccentricity vector of the Moon's instantaneous orbit — see
        // `domain::houses::true_apogee_tropical_deg`. Swiss Ephemeris support
        // (`SE_OSCU_APOG`) is not yet wired up in this backend's swisseph adapter.
        body_definition(
            "true_lilith",
            "True Lilith",
            "⚸",
            ObjectType::CalculatedPoint,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        // Vertex/Antivertex: oblique-ascension formula at co-latitude — see
        // `domain::houses::vertex_lon`. Swiss Ephemeris already computes this
        // internally (`ascmc[SE_VERTEX]`); exposing it there is a small follow-up,
        // not yet wired into this backend's swisseph adapter.
        body_definition(
            "vertex",
            "Vertex",
            "Vx",
            ObjectType::CalculatedPoint,
            true,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "antivertex",
            "Antivertex",
            "AVx",
            ObjectType::CalculatedPoint,
            true,
            false,
            EngineSupport::JplOnly,
        ),
        // Arabic Parts (Lots) of Fortune and Spirit: day/night-sect arithmetic on
        // already-computed Sun/Moon/Ascendant — see `domain::astrology::day_night_parts`.
        body_definition(
            "part_of_fortune",
            "Part of Fortune",
            "PF",
            ObjectType::Part,
            true,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "part_of_spirit",
            "Part of Spirit",
            "PS",
            ObjectType::Part,
            true,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "chiron",
            "Chiron",
            "⚷",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::Both,
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
        // Resolvable via the bundled/downloadable `codes_300ast_20100725.bsp` kernel
        // (see `infrastructure::ephemeris::CODES_300AST_MAJOR_BODIES`), but none of
        // these has a dedicated astrological symbol in wide use — the glyph is the
        // circled digit matching the minor-planet number, a convention several
        // asteroid-ephemeris references already use for bodies without one.
        body_definition(
            "astraea",
            "Astraea",
            "⑤",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "hebe",
            "Hebe",
            "⑥",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "iris",
            "Iris",
            "⑦",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "flora",
            "Flora",
            "⑧",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "metis",
            "Metis",
            "⑨",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "hygiea",
            "Hygiea",
            "⑩",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "parthenope",
            "Parthenope",
            "⑪",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "victoria",
            "Victoria",
            "⑫",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "egeria",
            "Egeria",
            "⑬",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "irene",
            "Irene",
            "⑭",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "eunomia",
            "Eunomia",
            "⑮",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "psyche",
            "Psyche",
            "⑯",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "thetis",
            "Thetis",
            "⑰",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "melpomene",
            "Melpomene",
            "⑱",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "fortuna",
            "Fortuna",
            "⑲",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        body_definition(
            "massalia",
            "Massalia",
            "⑳",
            ObjectType::Asteroid,
            false,
            false,
            EngineSupport::JplOnly,
        ),
        // Osculating Black Moon Lilith — a third Lilith variant distinct from
        // the mean (`lilith`) and true/oscillating-apogee (`true_lilith`)
        // definitions above. Restored from the pre-Rust frontend catalog
        // (`observableObjects.ts` at commit 7cb443e); it was always a
        // UI-only placeholder there too, never backend-computed.
        body_definition(
            "lilith_oscu",
            "Osculating Lilith",
            "⚸",
            ObjectType::CalculatedPoint,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        // Geocentric planetary nodes (ascending-node crossings of each outer
        // planet's orbit, as seen from Earth) — restored from the same
        // pre-Rust catalog, always a UI-only placeholder there, never
        // computed by any backend before or since.
        body_definition(
            "geo_node_mercury",
            "Mercury node",
            "GMe",
            ObjectType::GeocentricNode,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "geo_node_venus",
            "Venus node",
            "GVe",
            ObjectType::GeocentricNode,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "geo_node_mars",
            "Mars node",
            "GMa",
            ObjectType::GeocentricNode,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "geo_node_jupiter",
            "Jupiter node",
            "GJu",
            ObjectType::GeocentricNode,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "geo_node_saturn",
            "Saturn node",
            "GSa",
            ObjectType::GeocentricNode,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "geo_node_uranus",
            "Uranus node",
            "GUr",
            ObjectType::GeocentricNode,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "geo_node_neptune",
            "Neptune node",
            "GNe",
            ObjectType::GeocentricNode,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "geo_node_pluto",
            "Pluto node",
            "GPl",
            ObjectType::GeocentricNode,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        // Trans-Neptunian dwarf planets — restored from the same pre-Rust
        // catalog. Unlike the extra minor planets above, these aren't yet
        // claimed by any engine (no bundled/downloadable kernel is wired up
        // for them here), so they stay a UI-only placeholder for now too.
        body_definition(
            "eris",
            "Eris",
            "Er",
            ObjectType::TransNeptunian,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "sedna",
            "Sedna",
            "Se",
            ObjectType::TransNeptunian,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "haumea",
            "Haumea",
            "Ha",
            ObjectType::TransNeptunian,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "makemake",
            "Makemake",
            "Mk",
            ObjectType::TransNeptunian,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "quaoar",
            "Quaoar",
            "Qu",
            ObjectType::TransNeptunian,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "orcus",
            "Orcus",
            "Or",
            ObjectType::TransNeptunian,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "varuna",
            "Varuna",
            "Va",
            ObjectType::TransNeptunian,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        // The Uranian/Hamburg-school hypothetical eight — restored from the
        // same pre-Rust catalog, always a UI-only placeholder there (these
        // aren't real astronomical bodies with an ephemeris to compute).
        body_definition(
            "cupido",
            "Cupido",
            "Cu",
            ObjectType::HypotheticalPlanet,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "hades",
            "Hades",
            "Hd",
            ObjectType::HypotheticalPlanet,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "zeus",
            "Zeus",
            "Ze",
            ObjectType::HypotheticalPlanet,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "kronos",
            "Kronos",
            "Kr",
            ObjectType::HypotheticalPlanet,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "apollon",
            "Apollon",
            "Ap",
            ObjectType::HypotheticalPlanet,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "admetos",
            "Admetos",
            "Ad",
            ObjectType::HypotheticalPlanet,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "vulcanus",
            "Vulcanus",
            "Vu",
            ObjectType::HypotheticalPlanet,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        body_definition(
            "poseidon",
            "Poseidon",
            "Po",
            ObjectType::HypotheticalPlanet,
            false,
            false,
            EngineSupport::NotYetSupported,
        ),
        // Fixed stars: a curated prototype catalog (~30 classically significant stars — the four
        // Royal Stars, the Behenian fixed stars, and other well-known zodiacal/navigational stars).
        // No engine computes star positions yet (no proper-motion/precession model is wired up),
        // so every entry here is `NotYetSupported`, same as the other restored placeholders above.
        // Zodiac sign/hemisphere/significance presentation metadata lives in the frontend
        // (`FIXED_STAR_METADATA` in `observableObjects.ts`), not here — these ids only establish
        // catalog membership, matching "Rust computes, React presents" for non-computed data.
        body_definition("star_alpheratz", "Alpheratz", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_algenib", "Algenib", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_hamal", "Hamal", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_algol", "Algol", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_alcyone", "Alcyone", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_aldebaran", "Aldebaran", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_rigel", "Rigel", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_capella", "Capella", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_bellatrix", "Bellatrix", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_betelgeuse", "Betelgeuse", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_sirius", "Sirius", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_canopus", "Canopus", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_procyon", "Procyon", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_pollux", "Pollux", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_regulus", "Regulus", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_denebola", "Denebola", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_zosma", "Zosma", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_vindemiatrix", "Vindemiatrix", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_spica", "Spica", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_arcturus", "Arcturus", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_alphecca", "Alphecca", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_zuben_elgenubi", "Zuben Elgenubi", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_zuben_eschamali", "Zuben Eschamali", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_antares", "Antares", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_vega", "Vega", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_altair", "Altair", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_deneb", "Deneb", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_fomalhaut", "Fomalhaut", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_deneb_algedi", "Deneb Algedi", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_scheat", "Scheat", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_markab", "Markab", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
        body_definition("star_achernar", "Achernar", "✦", ObjectType::FixedStar, false, false, EngineSupport::NotYetSupported),
    ]
}

#[derive(Clone, Copy)]
enum EngineSupport {
    Both,
    /// Resolvable today only via the anise/JPL path (bundled or downloadable BSP
    /// kernels). Swiss Ephemeris support would require asteroid `.se1` files this
    /// project does not bundle, so it is left unclaimed rather than guessed at.
    JplOnly,
    /// Catalogued but not computed by any engine yet — every `computation_map`
    /// entry is `None`. This is what drives the frontend's `status: 'planned'`
    /// (`ObservableObjectDefinition.status` in `observableObjects.ts`): a
    /// restored-but-disabled object shows up greyed out until a real compute
    /// path is wired up, the same treatment `vertex`/`true_lilith` etc. got
    /// before their JPL path existed. `validate_model` reports this as the
    /// non-fatal `body_not_computable` warning, which has no frontend
    /// consumer today (see `src-tauri/src/workspace/validation.rs`).
    NotYetSupported,
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
    let mut computation_map = HashMap::from([(
        "swisseph".to_string(),
        matches!(engine_support, EngineSupport::Both).then(|| id.to_string()),
    )]);
    computation_map.insert(
        "jpl".to_string(),
        matches!(engine_support, EngineSupport::Both | EngineSupport::JplOnly)
            .then(|| id.to_string()),
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

/// Suggested natal orbs below follow the common reference convention for each aspect.
/// `object_type_rule` stays `None` (unrestricted) at this baseline-catalog layer so that a
/// workspace which never visits the aspect-scope settings computes exactly as before — the
/// per-aspect "usual application" (planets-only vs. planets+angles) and the opt-in extended
/// orb are workspace-level choices applied in `settings::apply_workspace_aspect_scope_defaults`,
/// not a silent change to every existing chart's aspect grid.
fn builtin_aspect_definitions() -> Vec<AspectDefinition> {
    vec![
        aspect_definition("conjunction", "Conjunction", 0.0, 1, 8.0),
        aspect_definition("semisextile", "Semisextile", 30.0, 12, 1.0),
        aspect_definition("undecile", "Undecile", 360.0 / 11.0, 11, 0.5),
        aspect_definition("decile", "Decile", 36.0, 10, 1.0),
        aspect_definition("novile", "Novile", 40.0, 9, 1.0),
        aspect_definition("octile", "Octile", 45.0, 8, 1.5),
        aspect_definition("septile", "Septile", 360.0 / 7.0, 7, 1.0),
        aspect_definition("sextile", "Sextile", 60.0, 6, 5.0),
        aspect_definition("biundecile", "Biundecile", 720.0 / 11.0, 11, 0.5),
        aspect_definition("quintile", "Quintile", 72.0, 5, 1.0),
        aspect_definition("binovile", "Binovile", 80.0, 9, 1.0),
        aspect_definition("triundecile", "Triundecile", 1080.0 / 11.0, 11, 0.5),
        aspect_definition("square", "Square", 90.0, 4, 6.0),
        aspect_definition("biseptile", "Biseptile", 720.0 / 7.0, 7, 1.0),
        aspect_definition("tridecile", "Tridecile", 108.0, 10, 1.0),
        aspect_definition("trine", "Trine", 120.0, 3, 6.0),
        aspect_definition("quadriundecile", "Quadriundecile", 1440.0 / 11.0, 11, 0.5),
        aspect_definition("trioctile", "Trioctile", 135.0, 8, 1.5),
        aspect_definition("biquintile", "Biquintile", 144.0, 5, 1.0),
        aspect_definition("quincunx", "Quincunx", 150.0, 12, 2.0),
        aspect_definition("triseptile", "Triseptile", 1080.0 / 7.0, 7, 1.0),
        aspect_definition("quadrinovile", "Quadrinovile", 160.0, 9, 1.0),
        aspect_definition("quinundecile", "Quinundecile", 1800.0 / 11.0, 11, 0.5),
        aspect_definition("opposition", "Opposition", 180.0, 2, 8.0),
    ]
}

fn aspect_definition(
    id: &str,
    label: &str,
    angle: f64,
    harmonic: u32,
    default_orb: f64,
) -> AspectDefinition {
    AspectDefinition {
        id: id.to_string(),
        aspect_type: if matches!(
            id,
            "conjunction" | "sextile" | "square" | "trine" | "opposition"
        ) {
            "major".to_string()
        } else {
            "minor".to_string()
        },
        enabled: true,
        glyph: label.to_string(),
        angle,
        harmonic,
        default_orb,
        i18n: HashMap::from([("en".to_string(), label.to_string())]),
        color: None,
        importance: None,
        line_style: None,
        line_width: None,
        show_label: None,
        valid_contexts: None,
        interpretation_weight: None,
        object_type_rule: None,
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
        id: name.to_ascii_lowercase(),
        name: name.to_string(),
        glyph: glyph.to_string(),
        abbreviation: abbreviation.to_string(),
        element,
        i18n: HashMap::from([("en".to_string(), name.to_string())]),
    }
}
