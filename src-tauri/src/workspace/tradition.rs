//! Astrological tradition ("Škola") presets.
//!
//! Each [`AstrologicalTradition`] maps to a suggested bundle of aspect settings (which aspects
//! are enabled and their orbs). Selecting a tradition writes this bundle into the workspace's
//! `default_aspects` / `default_aspect_orbs` fields — the same fields the Settings > Aspects
//! panel edits by hand — so no new resolution-engine code is needed to make it take effect, and
//! a user can still fine-tune individual aspects afterward (their edits simply overwrite the
//! preset's suggestion for that one aspect). It also ensures `Angle` is present in the
//! workspace's global `extended_object_types` (see `models::WorkspaceDefaults`) — angle
//! participation is a global toggle, not a per-aspect one, so unlike `enabled_aspects`/`orbs`
//! there is no per-aspect angle variation left to seed here.
//!
//! This is a first iteration: object selection and each tradition's native
//! orb *model* (whole-sign tolerance, planetary moieties, harmonic-scaled
//! orbs, midpoint/dial orbs, Jyotish directional drishti) are not
//! implemented — see [`AstrologicalTradition`]'s doc comments for the
//! specific approximation each preset makes instead.

use std::collections::HashMap;

use super::models::AstrologicalTradition;

/// The aspect-settings bundle a tradition seeds into `WorkspaceDefaults`.
pub struct TraditionAspectPreset {
    pub enabled_aspects: Vec<String>,
    pub orbs: HashMap<String, f64>,
}

fn preset(entries: &[(&str, f64)]) -> TraditionAspectPreset {
    TraditionAspectPreset {
        enabled_aspects: entries.iter().map(|(id, _)| id.to_string()).collect(),
        orbs: entries.iter().map(|(id, orb)| (id.to_string(), *orb)).collect(),
    }
}

/// Suggested aspect settings for a given tradition. See [`AstrologicalTradition`]
/// for the scope and caveats of this first-iteration approximation.
pub fn tradition_aspect_preset(tradition: AstrologicalTradition) -> TraditionAspectPreset {
    match tradition {
        // Sign-based major aspects; wide orbs stand in for whole-sign tolerance.
        AstrologicalTradition::Hellenistic => preset(&[
            ("conjunction", 10.0),
            ("sextile", 8.0),
            ("square", 9.0),
            ("trine", 9.0),
            ("opposition", 10.0),
        ]),
        // Majors plus conjunction, slightly widened to stand in for per-planet moieties.
        AstrologicalTradition::MedievalTraditional => preset(&[
            ("conjunction", 8.0),
            ("sextile", 6.0),
            ("square", 7.0),
            ("trine", 8.0),
            ("opposition", 8.0),
        ]),
        // Majors plus the app's established curated minor aspects.
        AstrologicalTradition::ModernWestern => preset(&[
            ("conjunction", 8.0),
            ("sextile", 5.0),
            ("square", 6.0),
            ("trine", 6.0),
            ("quincunx", 2.0),
            ("semisextile", 1.0),
            ("opposition", 8.0),
        ]),
        // Every harmonic family at once, reusing the catalog's existing
        // per-aspect orbs (already roughly tighter for higher harmonics).
        AstrologicalTradition::Harmonic => preset(&[
            ("conjunction", 8.0),
            ("semisextile", 1.0),
            ("undecile", 0.5),
            ("decile", 1.0),
            ("novile", 1.0),
            ("octile", 1.5),
            ("septile", 1.0),
            ("sextile", 5.0),
            ("biundecile", 0.5),
            ("quintile", 1.0),
            ("binovile", 1.0),
            ("triundecile", 0.5),
            ("square", 6.0),
            ("biseptile", 1.0),
            ("tridecile", 1.0),
            ("trine", 6.0),
            ("quadriundecile", 0.5),
            ("trioctile", 1.5),
            ("biquintile", 1.0),
            ("quincunx", 2.0),
            ("triseptile", 1.0),
            ("quadrinovile", 1.0),
            ("quinundecile", 0.5),
            ("opposition", 8.0),
        ]),
        // The hard-aspect / 90-degree-dial family with tight orbs.
        AstrologicalTradition::Cosmobiology => preset(&[
            ("conjunction", 2.0),
            ("octile", 2.0),
            ("square", 2.0),
            ("trioctile", 2.0),
            ("opposition", 2.0),
        ]),
        // Same hard-aspect family, tighter still, echoing Uranian dial practice.
        AstrologicalTradition::UranianHamburg => preset(&[
            ("conjunction", 1.5),
            ("octile", 1.5),
            ("square", 1.5),
            ("trioctile", 1.5),
            ("opposition", 1.5),
        ]),
        // Placeholder: Western majors at default orbs. Real graha drishti is
        // directional and per-planet, not a mutual angle-plus-orb model, and
        // is not implemented.
        AstrologicalTradition::JyotishParashari => preset(&[
            ("conjunction", 8.0),
            ("sextile", 5.0),
            ("square", 6.0),
            ("trine", 6.0),
            ("opposition", 8.0),
        ]),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL_TRADITIONS: [AstrologicalTradition; 7] = [
        AstrologicalTradition::Hellenistic,
        AstrologicalTradition::MedievalTraditional,
        AstrologicalTradition::ModernWestern,
        AstrologicalTradition::Harmonic,
        AstrologicalTradition::Cosmobiology,
        AstrologicalTradition::UranianHamburg,
        AstrologicalTradition::JyotishParashari,
    ];

    #[test]
    fn every_tradition_preset_is_internally_consistent() {
        for tradition in ALL_TRADITIONS {
            let preset = tradition_aspect_preset(tradition);
            assert!(
                !preset.enabled_aspects.is_empty(),
                "{tradition:?} preset is empty"
            );
            assert_eq!(preset.enabled_aspects.len(), preset.orbs.len());
            for id in &preset.enabled_aspects {
                let orb = preset
                    .orbs
                    .get(id)
                    .unwrap_or_else(|| panic!("{tradition:?} preset is missing an orb for '{id}'"));
                assert!(
                    orb.is_finite() && *orb > 0.0,
                    "{tradition:?} preset has an invalid orb for '{id}': {orb}"
                );
            }
        }
    }

    #[test]
    fn every_tradition_only_references_known_catalog_aspects() {
        let model = crate::workspace::builtin_standard_model("standard");
        let known_ids: std::collections::HashSet<&str> = model
            .aspect_definitions
            .iter()
            .map(|aspect| aspect.id.as_str())
            .collect();
        for tradition in ALL_TRADITIONS {
            let preset = tradition_aspect_preset(tradition);
            for id in &preset.enabled_aspects {
                assert!(
                    known_ids.contains(id.as_str()),
                    "{tradition:?} preset references unknown aspect '{id}'"
                );
            }
        }
    }

    #[test]
    fn harmonic_preset_enables_every_catalog_aspect() {
        let model = crate::workspace::builtin_standard_model("standard");
        let preset = tradition_aspect_preset(AstrologicalTradition::Harmonic);
        for aspect in &model.aspect_definitions {
            assert!(
                preset.enabled_aspects.contains(&aspect.id),
                "harmonic preset is missing catalog aspect '{}'",
                aspect.id
            );
        }
    }
}
