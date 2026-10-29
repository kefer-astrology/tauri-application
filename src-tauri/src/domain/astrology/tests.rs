//! Combined test suite for the `domain::astrology` facade's submodules. Kept as one file
//! (rather than split alongside each submodule) because several tests exercise more than one
//! submodule together (e.g. aspect detection combined with object-type rules, or midpoint
//! contacts combined with geometry helpers) — splitting them would mean either duplicating
//! fixtures across files or introducing cross-file test dependencies, neither of which is worth
//! it for a test-only module. Imports everything from the facade (`super::*`) the same way
//! external callers would, plus the one private geometry helper (`normalize_deg`) a couple of
//! fixtures need directly.

use super::geometry::normalize_deg;
use super::*;
use crate::workspace::models::{AspectContext, AspectDefinition, ObjectType, ObjectTypeRule};
use std::collections::HashMap;

#[test]
fn day_night_parts_night_chart_swaps_fortune_and_spirit() {
    // Sun at asc+100 is in houses 1-6 (below the horizon) -> night chart.
    let (fortune, spirit) = day_night_parts(0.0, 100.0, 200.0);
    assert!((fortune - 260.0).abs() < 1e-9, "fortune={fortune}");
    assert!((spirit - 100.0).abs() < 1e-9, "spirit={spirit}");
}

#[test]
fn day_night_parts_day_chart_uses_the_day_formula() {
    // Sun at asc+280 is in houses 7-12 (above the horizon) -> day chart.
    let (fortune, spirit) = day_night_parts(0.0, 280.0, 50.0);
    assert!((fortune - 130.0).abs() < 1e-9, "fortune={fortune}");
    assert!((spirit - 230.0).abs() < 1e-9, "spirit={spirit}");
}

fn midpoint_contact_aspect_definition(id: &str, angle: f64, default_orb: f64) -> AspectDefinition {
    AspectDefinition {
        id: id.to_string(),
        aspect_type: "major".to_string(),
        enabled: true,
        glyph: String::new(),
        angle,
        harmonic: 1,
        default_orb,
        i18n: HashMap::new(),
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

/// Matches the real catalog's angles/default orbs (`model_catalog.rs`'s
/// `builtin_aspect_definitions`) closely enough for these tests' purposes.
fn midpoint_contact_aspect_definitions() -> Vec<AspectDefinition> {
    vec![
        midpoint_contact_aspect_definition("conjunction", 0.0, 8.0),
        midpoint_contact_aspect_definition("opposition", 180.0, 8.0),
        midpoint_contact_aspect_definition("square", 90.0, 6.0),
        midpoint_contact_aspect_definition("octile", 45.0, 1.5),
        midpoint_contact_aspect_definition("trioctile", 135.0, 1.5),
    ]
}

fn single_midpoint(position: f64) -> crate::domain::midpoints::Midpoint {
    crate::domain::midpoints::Midpoint {
        object_a: "sun".to_string(),
        object_b: "moon".to_string(),
        chart_id: None,
        position,
        opposite: normalize_deg(position + 180.0),
        ambiguous: false,
    }
}

#[test]
fn midpoint_contact_detects_each_of_the_five_supported_aspects() {
    let midpoint = single_midpoint(100.0); // opposite = 280.0
    let definitions = midpoint_contact_aspect_definitions();
    let aspect_types: Vec<String> = MIDPOINT_CONTACT_ASPECT_IDS
        .iter()
        .map(|id| id.to_string())
        .collect();

    let cases: [(&str, f64, MidpointContactPoint); 5] = [
        ("conjunction", 100.0, MidpointContactPoint::Position), // at position
        ("opposition", 280.0, MidpointContactPoint::Opposite),  // at opposite
        ("square", 10.0, MidpointContactPoint::Both), // 90 deg from position (and opposite)
        ("octile", 145.0, MidpointContactPoint::Position), // 45 deg from position
        ("trioctile", 235.0, MidpointContactPoint::Opposite), // 135 deg from position = 45 from opposite
    ];

    for (expected_aspect, contact_lon, expected_point) in cases {
        let contacts = compute_midpoint_contacts(
            std::slice::from_ref(&midpoint),
            &HashMap::from([("mars".to_string(), contact_lon)]),
            &definitions,
            &HashMap::new(),
            &aspect_types,
            &HashMap::new(),
            &HashMap::new(),
        );
        assert_eq!(
            contacts.len(),
            1,
            "{expected_aspect}: expected exactly one contact, got {contacts:?}"
        );
        assert_eq!(contacts[0].aspect_type, expected_aspect);
        assert_eq!(contacts[0].contact_point, expected_point);
        assert!((contacts[0].orb).abs() < 1e-9, "orb={}", contacts[0].orb);
    }
}

#[test]
fn midpoint_contact_respects_the_orb_boundary() {
    let midpoint = single_midpoint(0.0);
    let definitions = vec![midpoint_contact_aspect_definition("conjunction", 0.0, 2.0)];
    let aspect_types = vec!["conjunction".to_string()];

    let just_inside = compute_midpoint_contacts(
        std::slice::from_ref(&midpoint),
        &HashMap::from([("mars".to_string(), 2.0)]),
        &definitions,
        &HashMap::new(),
        &aspect_types,
        &HashMap::new(),
        &HashMap::new(),
    );
    assert_eq!(
        just_inside.len(),
        1,
        "2.0 deg orb should be exactly admitted"
    );

    let just_outside = compute_midpoint_contacts(
        &[midpoint],
        &HashMap::from([("mars".to_string(), 2.1)]),
        &definitions,
        &HashMap::new(),
        &aspect_types,
        &HashMap::new(),
        &HashMap::new(),
    );
    assert!(
        just_outside.is_empty(),
        "2.1 deg should exceed the 2.0 deg orb"
    );
}

#[test]
fn midpoint_contact_skips_the_source_objects_of_their_own_midpoint() {
    let midpoint = single_midpoint(0.0); // sun/moon midpoint at 0 deg
    let definitions = vec![midpoint_contact_aspect_definition("conjunction", 0.0, 8.0)];
    let aspect_types = vec!["conjunction".to_string()];

    let contacts = compute_midpoint_contacts(
        &[midpoint],
        &HashMap::from([("sun".to_string(), 0.0), ("moon".to_string(), 0.0)]),
        &definitions,
        &HashMap::new(),
        &aspect_types,
        &HashMap::new(),
        &HashMap::new(),
    );
    assert!(
        contacts.is_empty(),
        "the pair's own objects must not be reported as contacting their own midpoint"
    );
}

#[test]
fn midpoint_contact_never_duplicates_across_the_two_axis_ends() {
    // A square is 90 deg from BOTH `position` and `opposite` (180-90=90) — a naive
    // implementation that scanned both ends separately would report this twice.
    let midpoint = single_midpoint(0.0);
    let definitions = vec![midpoint_contact_aspect_definition("square", 90.0, 6.0)];
    let aspect_types = vec!["square".to_string()];

    let contacts = compute_midpoint_contacts(
        &[midpoint],
        &HashMap::from([("mars".to_string(), 90.0)]),
        &definitions,
        &HashMap::new(),
        &aspect_types,
        &HashMap::new(),
        &HashMap::new(),
    );
    assert_eq!(
        contacts.len(),
        1,
        "exactly one contact, not one per axis end"
    );
    assert_eq!(contacts[0].contact_point, MidpointContactPoint::Both);
}

#[test]
fn is_day_chart_matches_sun_asc_relationship() {
    assert!(!is_day_chart(0.0, 100.0), "sun in houses 1-6 is night");
    assert!(is_day_chart(0.0, 280.0), "sun in houses 7-12 is day");
}

#[test]
fn arabic_part_swaps_pair_order_by_night() {
    let day = arabic_part(10.0, true, 50.0, 20.0);
    let night = arabic_part(10.0, false, 50.0, 20.0);
    assert!((day - 40.0).abs() < 1e-9, "day={day}");
    assert!((night - 340.0).abs() < 1e-9, "night={night}");
}

#[test]
fn arabic_part_composes_into_day_night_parts_for_sun_moon() {
    let asc = 0.0;
    let sun = 280.0;
    let moon = 50.0;
    let is_day = is_day_chart(asc, sun);
    let fortune = arabic_part(asc, is_day, moon, sun);
    let spirit = arabic_part(asc, is_day, sun, moon);
    let (expected_fortune, expected_spirit) = day_night_parts(asc, sun, moon);
    assert!((fortune - expected_fortune).abs() < 1e-9);
    assert!((spirit - expected_spirit).abs() < 1e-9);
}

#[test]
fn model_definition_and_effective_orb_control_detection() {
    let definitions = vec![AspectDefinition {
        id: "semisextile".to_string(),
        aspect_type: "minor".to_string(),
        enabled: true,
        glyph: "⚺".to_string(),
        angle: 30.0,
        harmonic: 12,
        default_orb: 0.5,
        i18n: HashMap::new(),
        color: None,
        importance: None,
        line_style: None,
        line_width: None,
        show_label: None,
        valid_contexts: None,
        interpretation_weight: None,
        object_type_rule: None,
    }];
    let positions = HashMap::from([("moon".to_string(), 30.75), ("sun".to_string(), 0.0)]);
    let selected = vec!["semisextile".to_string()];

    let without_override = compute_chart_aspects(
        &positions,
        &definitions,
        &HashMap::new(),
        Some(&selected),
        &HashMap::new(),
        &HashMap::new(),
    );
    assert!(without_override.is_empty());

    let effective_orbs = HashMap::from([("semisextile".to_string(), 1.0)]);
    let with_override = compute_chart_aspects(
        &positions,
        &definitions,
        &effective_orbs,
        Some(&selected),
        &HashMap::new(),
        &HashMap::new(),
    );

    assert_eq!(
        with_override,
        vec![ComputedAspect {
            from: "moon".to_string(),
            to: "sun".to_string(),
            aspect_type: "semisextile".to_string(),
            angle: 30.75,
            orb: 0.75,
            exact_angle: 30.0,
            allowed_orb: 1.0,
            applying: false,
            separating: false,
            exact: false,
            phase: None,
        }]
    );
}

#[test]
fn chart_aspects_exclude_structurally_locked_axis_and_node_pairs() {
    let definitions = vec![AspectDefinition {
        id: "opposition".to_string(),
        aspect_type: "major".to_string(),
        enabled: true,
        glyph: "☍".to_string(),
        angle: 180.0,
        harmonic: 2,
        default_orb: 8.0,
        i18n: HashMap::new(),
        color: None,
        importance: None,
        line_style: None,
        line_width: None,
        show_label: None,
        valid_contexts: None,
        interpretation_weight: None,
        object_type_rule: None,
    }];
    let positions = HashMap::from([
        ("asc".to_string(), 10.0),
        ("desc".to_string(), 190.0),
        ("mc".to_string(), 100.0),
        ("ic".to_string(), 280.0),
        ("north_node".to_string(), 50.0),
        ("south_node".to_string(), 230.0),
        // A real opposition between two ordinary bodies should still be reported.
        ("sun".to_string(), 0.0),
        ("moon".to_string(), 180.0),
    ]);
    let selected = vec!["opposition".to_string()];

    let aspects = compute_chart_aspects(
        &positions,
        &definitions,
        &HashMap::new(),
        Some(&selected),
        &HashMap::new(),
        &HashMap::new(),
    );

    assert_eq!(aspects.len(), 1);
    assert_eq!(aspects[0].from, "moon");
    assert_eq!(aspects[0].to, "sun");
}

#[test]
fn cross_aspects_preserve_transiting_and_transited_direction() {
    let definitions = vec![AspectDefinition {
        id: "square".to_string(),
        aspect_type: "major".to_string(),
        enabled: true,
        glyph: "□".to_string(),
        angle: 90.0,
        harmonic: 4,
        default_orb: 1.0,
        i18n: HashMap::new(),
        color: None,
        importance: None,
        line_style: None,
        line_width: None,
        show_label: None,
        valid_contexts: None,
        interpretation_weight: None,
        object_type_rule: None,
    }];
    let transiting = HashMap::from([("mars".to_string(), 90.0)]);
    let transited = HashMap::from([("sun".to_string(), 0.0)]);

    let aspects = compute_cross_aspects(
        &transiting,
        &transited,
        &definitions,
        &HashMap::new(),
        &["square".to_string()],
        &HashMap::new(),
        &HashMap::new(),
    );

    assert_eq!(aspects[0].from, "mars");
    assert_eq!(aspects[0].to, "sun");
}

#[test]
fn aspect_enabled_and_context_are_computation_rules() {
    let positions = HashMap::from([("mars".to_string(), 90.0), ("sun".to_string(), 0.0)]);
    let mut definition = AspectDefinition {
        id: "square".to_string(),
        aspect_type: "major".to_string(),
        enabled: true,
        glyph: String::new(),
        angle: 90.0,
        harmonic: 4,
        default_orb: 1.0,
        i18n: HashMap::new(),
        color: None,
        importance: None,
        line_style: None,
        line_width: None,
        show_label: None,
        valid_contexts: Some(vec![AspectContext::Transit]),
        interpretation_weight: None,
        object_type_rule: None,
    };

    assert!(compute_chart_aspects(
        &positions,
        std::slice::from_ref(&definition),
        &HashMap::new(),
        None,
        &HashMap::new(),
        &HashMap::new(),
    )
    .is_empty());
    assert_eq!(
        compute_cross_aspects(
            &HashMap::from([("mars".to_string(), 90.0)]),
            &HashMap::from([("sun".to_string(), 0.0)]),
            std::slice::from_ref(&definition),
            &HashMap::new(),
            &["square".to_string()],
            &HashMap::new(),
            &HashMap::new(),
        )
        .len(),
        1
    );

    definition.enabled = false;
    assert!(compute_cross_aspects(
        &HashMap::from([("mars".to_string(), 90.0)]),
        &HashMap::from([("sun".to_string(), 0.0)]),
        &[definition],
        &HashMap::new(),
        &["square".to_string()],
        &HashMap::new(),
        &HashMap::new(),
    )
    .is_empty());
}

#[test]
fn object_type_rule_excludes_configured_categories() {
    let mut definitions = vec![AspectDefinition {
        id: "quincunx".to_string(),
        aspect_type: "minor".to_string(),
        enabled: true,
        glyph: String::new(),
        angle: 150.0,
        harmonic: 12,
        default_orb: 2.0,
        i18n: HashMap::new(),
        color: None,
        importance: None,
        line_style: None,
        line_width: None,
        show_label: None,
        valid_contexts: None,
        interpretation_weight: None,
        object_type_rule: Some(ObjectTypeRule::Exclude {
            types: vec![ObjectType::Angle],
        }),
    }];
    let positions = HashMap::from([
        ("asc".to_string(), 0.0),
        ("venus".to_string(), 150.0),
        ("mars".to_string(), 300.0),
    ]);
    let object_types = HashMap::from([
        ("asc".to_string(), ObjectType::Angle),
        ("venus".to_string(), ObjectType::Planet),
        ("mars".to_string(), ObjectType::Planet),
    ]);
    let selected = vec!["quincunx".to_string()];

    let aspects = compute_chart_aspects(
        &positions,
        &definitions,
        &HashMap::new(),
        Some(&selected),
        &object_types,
        &HashMap::new(),
    );

    assert_eq!(aspects.len(), 1, "aspects: {aspects:?}");
    assert_eq!(aspects[0].from, "mars");
    assert_eq!(aspects[0].to, "venus");

    definitions[0].object_type_rule = None;
    let aspects_without_rule = compute_chart_aspects(
        &positions,
        &definitions,
        &HashMap::new(),
        Some(&selected),
        &object_types,
        &HashMap::new(),
    );
    assert_eq!(
        aspects_without_rule.len(),
        2,
        "aspects: {aspects_without_rule:?}"
    );
}

#[test]
fn object_type_rule_only_between_restricts_to_listed_categories() {
    let definitions = vec![AspectDefinition {
        id: "square".to_string(),
        aspect_type: "major".to_string(),
        enabled: true,
        glyph: String::new(),
        angle: 90.0,
        harmonic: 4,
        default_orb: 1.0,
        i18n: HashMap::new(),
        color: None,
        importance: None,
        line_style: None,
        line_width: None,
        show_label: None,
        valid_contexts: None,
        interpretation_weight: None,
        object_type_rule: Some(ObjectTypeRule::OnlyBetween {
            types: vec![ObjectType::Angle, ObjectType::Planet],
        }),
    }];
    let positions = HashMap::from([
        ("asc".to_string(), 0.0),
        ("pallas".to_string(), 90.0),
        ("mars".to_string(), 90.0),
    ]);
    let object_types = HashMap::from([
        ("asc".to_string(), ObjectType::Angle),
        ("pallas".to_string(), ObjectType::Asteroid),
        ("mars".to_string(), ObjectType::Planet),
    ]);
    let selected = vec!["square".to_string()];

    let aspects = compute_chart_aspects(
        &positions,
        &definitions,
        &HashMap::new(),
        Some(&selected),
        &object_types,
        &HashMap::new(),
    );

    // asc-pallas is also exactly square, but pallas (Asteroid) is not in
    // the OnlyBetween allow-list, so only asc-mars (Angle-Planet) matches.
    assert_eq!(aspects.len(), 1, "aspects: {aspects:?}");
    assert_eq!(aspects[0].from, "asc");
    assert_eq!(aspects[0].to, "mars");
}

#[test]
fn global_object_orbs_tighten_the_match_window_per_object() {
    let definitions = vec![AspectDefinition {
        id: "conjunction".to_string(),
        aspect_type: "major".to_string(),
        enabled: true,
        glyph: String::new(),
        angle: 0.0,
        harmonic: 1,
        default_orb: 8.0,
        i18n: HashMap::new(),
        color: None,
        importance: None,
        line_style: None,
        line_width: None,
        show_label: None,
        valid_contexts: None,
        interpretation_weight: None,
        object_type_rule: Some(ObjectTypeRule::OnlyBetween {
            types: vec![ObjectType::Planet, ObjectType::Asteroid],
        }),
    }];
    // sun-moon (7 deg apart, both planets, no override) fits the normal 8 deg orb.
    // ceres-sun (0.5 deg apart) fits its own 1 deg object_orbs override.
    // chiron-sun (5 deg apart) would fit the normal orb but not its own 1 deg override.
    let positions = HashMap::from([
        ("sun".to_string(), 0.0),
        ("moon".to_string(), 7.0),
        ("chiron".to_string(), 5.0),
        ("ceres".to_string(), 0.5),
    ]);
    let object_types = HashMap::from([
        ("sun".to_string(), ObjectType::Planet),
        ("moon".to_string(), ObjectType::Planet),
        ("chiron".to_string(), ObjectType::Asteroid),
        ("ceres".to_string(), ObjectType::Asteroid),
    ]);
    let object_orbs = HashMap::from([("ceres".to_string(), 1.0), ("chiron".to_string(), 1.0)]);
    let selected = vec!["conjunction".to_string()];

    let mut aspects = compute_chart_aspects(
        &positions,
        &definitions,
        &HashMap::new(),
        Some(&selected),
        &object_types,
        &object_orbs,
    );
    aspects.sort_by(|a, b| a.from.cmp(&b.from));

    assert_eq!(aspects.len(), 2, "aspects: {aspects:?}");
    assert_eq!(aspects[0].from, "ceres");
    assert_eq!(aspects[0].to, "sun");
    assert_eq!(aspects[0].allowed_orb, 1.0);
    assert_eq!(aspects[1].from, "moon");
    assert_eq!(aspects[1].to, "sun");
    assert_eq!(aspects[1].allowed_orb, 8.0);
}

#[test]
fn body_selection_is_canonical_deduplicated_and_engine_aware() {
    let model = crate::workspace::builtin_standard_model("standard");
    let requested = vec![
        " ASC ".to_string(),
        "asc".to_string(),
        "astraea".to_string(),
        "unknown_point".to_string(),
    ];

    let selection = resolve_body_selection(&model.body_definitions, &requested, "swisseph");

    assert_eq!(selection.ids, vec!["asc"]);
    assert!(selection
        .warnings
        .iter()
        .any(|warning| warning == "duplicate_body_id: asc"));
    assert!(selection
        .warnings
        .iter()
        .any(|warning| warning == "body_not_supported_by_engine: astraea (swisseph)"));
    assert!(selection
        .warnings
        .iter()
        .any(|warning| warning == "unknown_body_id: unknown_point"));
}

#[test]
fn detect_chart_shapes_flags_bundle() {
    let positions = HashMap::from([
        ("sun".to_string(), 0.0),
        ("moon".to_string(), 10.0),
        ("mercury".to_string(), 20.0),
        ("venus".to_string(), 30.0),
        ("mars".to_string(), 40.0),
        ("jupiter".to_string(), 50.0),
        ("saturn".to_string(), 60.0),
        ("uranus".to_string(), 70.0),
        ("neptune".to_string(), 80.0),
        ("pluto".to_string(), 90.0),
    ]);

    let shapes = detect_chart_shapes(&positions, &[]);

    assert!(shapes.contains(&"bundle".to_string()));
}

#[test]
fn detect_chart_configurations_flags_grand_trine() {
    let positions = HashMap::from([
        ("sun".to_string(), 0.0),
        ("moon".to_string(), 120.0),
        ("mercury".to_string(), 240.0),
    ]);
    let aspect = |from: &str, to: &str| ComputedAspect {
        from: from.to_string(),
        to: to.to_string(),
        aspect_type: "trine".to_string(),
        angle: 120.0,
        orb: 0.0,
        exact_angle: 120.0,
        allowed_orb: 8.0,
        applying: false,
        separating: false,
        exact: false,
        phase: None,
    };
    let aspects = vec![
        aspect("sun", "moon"),
        aspect("sun", "mercury"),
        aspect("moon", "mercury"),
    ];

    let configurations = detect_chart_configurations(&positions, &aspects);

    assert!(configurations.contains(&"grand_trine".to_string()));
    assert!(configurations.contains(&"grand_trine_fire".to_string()));
}
