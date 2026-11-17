//! Canonical built-in aspect catalog, shared with the Python sidecar through
//! `contracts/catalogs/aspects.json` (Phase 0 decision D4).
//!
//! The JSON file is the single source for built-in aspect ids, angles,
//! harmonics and default orbs. Legacy ids from the Python catalog
//! (`semisquare`, `sesquiquadrate`) are accepted as aliases wherever an aspect
//! id is read and resolve to the canonical ids (`octile`, `trioctile`).

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Clone, Deserialize)]
pub struct AspectCatalogEntry {
    pub id: String,
    pub label: String,
    pub angle: f64,
    pub harmonic: u32,
    pub default_orb: f64,
    pub aspect_type: String,
}

#[derive(Debug, Deserialize)]
pub struct AspectCatalog {
    /// Semver of the shared catalog; checked by tests and available to tooling.
    #[allow(dead_code)]
    pub catalog_version: String,
    pub aliases: HashMap<String, String>,
    pub aspects: Vec<AspectCatalogEntry>,
}

pub fn aspect_catalog() -> &'static AspectCatalog {
    static CATALOG: OnceLock<AspectCatalog> = OnceLock::new();
    CATALOG.get_or_init(|| {
        serde_json::from_str(include_str!("../../../../contracts/catalogs/aspects.json"))
            .expect("validated built-in aspect catalog")
    })
}

/// Canonical id for an aspect id. Aliases match case-insensitively; any other
/// id is returned unchanged (custom workspace ids keep their spelling).
pub fn canonical_aspect_id(id: &str) -> String {
    let key = id.trim().to_ascii_lowercase();
    match aspect_catalog().aliases.get(&key) {
        Some(canonical) => canonical.clone(),
        None => id.to_string(),
    }
}

/// Canonicalize a list of aspect ids, dropping duplicates created by aliases
/// while keeping the first occurrence's position.
pub fn canonical_aspect_ids(ids: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::with_capacity(ids.len());
    for id in ids {
        let canonical = canonical_aspect_id(id);
        if !out.contains(&canonical) {
            out.push(canonical);
        }
    }
    out
}

/// Canonicalize the keys of an aspect-id map. When both an alias and its
/// canonical id are present, the explicitly canonical entry wins.
pub fn canonical_aspect_map<V: Clone>(values: &HashMap<String, V>) -> HashMap<String, V> {
    let mut out: HashMap<String, V> = HashMap::with_capacity(values.len());
    for (id, value) in values {
        if canonical_aspect_id(id) == *id {
            out.insert(id.clone(), value.clone());
        }
    }
    for (id, value) in values {
        let canonical = canonical_aspect_id(id);
        if canonical != *id {
            out.entry(canonical).or_insert_with(|| value.clone());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_has_24_unique_canonical_aspects() {
        let catalog = aspect_catalog();
        assert_eq!(catalog.aspects.len(), 24);
        let mut ids: Vec<_> = catalog.aspects.iter().map(|a| a.id.as_str()).collect();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), 24);
        for (alias, canonical) in &catalog.aliases {
            assert!(
                !ids.contains(&alias.as_str()),
                "alias {alias} must not be a canonical id"
            );
            assert!(
                ids.contains(&canonical.as_str()),
                "alias target {canonical} must exist"
            );
        }
    }

    #[test]
    fn aliases_resolve_and_other_ids_are_untouched() {
        assert_eq!(canonical_aspect_id("semisquare"), "octile");
        assert_eq!(canonical_aspect_id(" Sesquiquadrate "), "trioctile");
        assert_eq!(canonical_aspect_id("octile"), "octile");
        assert_eq!(canonical_aspect_id("MyCustom"), "MyCustom");
    }

    #[test]
    fn list_and_map_canonicalization_dedupes_with_canonical_precedence() {
        let ids = vec![
            "semisquare".to_string(),
            "octile".to_string(),
            "trine".to_string(),
        ];
        assert_eq!(canonical_aspect_ids(&ids), vec!["octile", "trine"]);

        let orbs = HashMap::from([
            ("semisquare".to_string(), 3.0),
            ("octile".to_string(), 1.0),
            ("sesquiquadrate".to_string(), 2.0),
        ]);
        let out = canonical_aspect_map(&orbs);
        assert_eq!(out.get("octile"), Some(&1.0));
        assert_eq!(out.get("trioctile"), Some(&2.0));
        assert_eq!(out.len(), 2);
    }
}
