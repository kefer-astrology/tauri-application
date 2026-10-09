//! Data-driven multi-body "configuration" pattern definitions (Grand Trine,
//! T-square, Grand Cross, Yod) for the time-aware interval search in
//! `application::configuration_search`.
//!
//! This is deliberately separate from `astrology::detect_chart_configurations`
//! — that function is a single-instant snapshot classifier over a fixed
//! 10-body set, producing flat ids with no participant/role output and no
//! time dimension. Nothing here changes it, and nothing here is used by it.
//! Five of its nine pattern ids (kite, mystic_rectangle, hexagram,
//! pentagram, double_biquintile) have no interval-search counterpart in this
//! module — a documented scope gap, not a silent omission: kite/hexagram are
//! built by *extending* an already-found grand trine rather than a fixed
//! role topology, and pentagram needs a 5-way combinatorial search over a
//! minor-aspect pair; none of these fit this module's "N fixed roles, M
//! required pairwise aspects" shape as cleanly as the four implemented here.
//!
//! `Yod`'s id in this codebase's existing catalog/detector is
//! `double_quincunx` (two quincunxes + one sextile — the identical geometry
//! under a different name, confirmed by reading `detect_chart_configurations`
//! in `domain::astrology`). This module exposes it under the common
//! astrological name `yod`; `application::configuration_search` is
//! responsible for mapping a request's `"yod"` id to this definition and for
//! documenting the correspondence in the user-facing API, never silently
//! renaming it without explanation.
//!
//! Every edge references an aspect purely by its catalog `id` (e.g.
//! `"trine"`, `"square"`) — the actual angle/orb for that id stays fully
//! data-driven through the existing `AspectDefinition`/`aspect_orbs` lookup
//! (`domain::astrology::eligible_aspects_for_pair`), never duplicated here.
//! Only the *topology* (which roles, which aspect connects which role-pair,
//! which role-permutations are symmetries of that topology) is fixed Rust
//! data, the same kind of fixed-but-small catalog as `SEARCH_PLANET_IDS` in
//! `astrology.rs`.

/// One required aspect relationship between two named roles. Role order is
/// not semantically meaningful (an aspect is symmetric between its two
/// sides); `ConfigurationDefinition::automorphisms_are_valid` compares edges
/// as unordered pairs for exactly this reason.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigurationEdge {
    pub role_a: &'static str,
    pub role_b: &'static str,
    pub aspect_id: &'static str,
}

#[derive(Debug, Clone, Copy)]
pub struct ConfigurationDefinition {
    pub id: &'static str,
    pub roles: &'static [&'static str],
    pub edges: &'static [ConfigurationEdge],
    /// Every role-permutation (as `(from_role, to_role)` pairs) that maps
    /// this pattern's edge set onto itself — the pattern's actual
    /// automorphism group, not an independently-sortable partition of
    /// roles. A permutation that is wrong here produces incorrect
    /// deduplication in `application::configuration_search` (two physically
    /// distinct matches silently merged, or one physical match reported
    /// twice) rather than a visible error, which is why
    /// `automorphisms_are_valid` is asserted directly in this module's own
    /// tests for every built-in definition, not just trusted by inspection.
    pub role_automorphisms: &'static [&'static [(&'static str, &'static str)]],
}

impl ConfigurationDefinition {
    #[cfg(test)]
    fn permuted_edge(
        permutation: &[(&'static str, &'static str)],
        edge: &ConfigurationEdge,
    ) -> ConfigurationEdge {
        let map = |role: &'static str| -> &'static str {
            permutation
                .iter()
                .find(|(from, _)| *from == role)
                .map(|(_, to)| *to)
                .unwrap_or(role)
        };
        ConfigurationEdge {
            role_a: map(edge.role_a),
            role_b: map(edge.role_b),
            aspect_id: edge.aspect_id,
        }
    }

    #[cfg(test)]
    fn canonical_edge_key(edge: &ConfigurationEdge) -> (&'static str, &'static str, &'static str) {
        if edge.role_a <= edge.role_b {
            (edge.role_a, edge.role_b, edge.aspect_id)
        } else {
            (edge.role_b, edge.role_a, edge.aspect_id)
        }
    }

    /// `true` if every listed automorphism actually maps this definition's
    /// edge set onto itself (compared as unordered-role-pair, since an
    /// edge's own `role_a`/`role_b` order carries no meaning). Test-only
    /// (`#[cfg(test)]`): asserted directly by this module's own tests for
    /// every built-in definition, never called from production matching/
    /// dedup logic, which trusts `role_automorphisms` as given.
    #[cfg(test)]
    pub(crate) fn automorphisms_are_valid(&self) -> bool {
        let mut original: Vec<_> = self.edges.iter().map(Self::canonical_edge_key).collect();
        original.sort_unstable();

        self.role_automorphisms.iter().all(|permutation| {
            let mut permuted: Vec<_> = self
                .edges
                .iter()
                .map(|edge| Self::canonical_edge_key(&Self::permuted_edge(permutation, edge)))
                .collect();
            permuted.sort_unstable();
            permuted == original
        })
    }
}

pub const GRAND_TRINE: ConfigurationDefinition = ConfigurationDefinition {
    id: "grand_trine",
    roles: &["a", "b", "c"],
    edges: &[
        ConfigurationEdge {
            role_a: "a",
            role_b: "b",
            aspect_id: "trine",
        },
        ConfigurationEdge {
            role_a: "a",
            role_b: "c",
            aspect_id: "trine",
        },
        ConfigurationEdge {
            role_a: "b",
            role_b: "c",
            aspect_id: "trine",
        },
    ],
    // Fully symmetric: every one of the 6 permutations of {a,b,c} (the full
    // symmetric group S3).
    role_automorphisms: &[
        &[("a", "a"), ("b", "b"), ("c", "c")],
        &[("a", "a"), ("b", "c"), ("c", "b")],
        &[("a", "b"), ("b", "a"), ("c", "c")],
        &[("a", "b"), ("b", "c"), ("c", "a")],
        &[("a", "c"), ("b", "a"), ("c", "b")],
        &[("a", "c"), ("b", "b"), ("c", "a")],
    ],
};

pub const T_SQUARE: ConfigurationDefinition = ConfigurationDefinition {
    id: "t_square",
    roles: &["apex", "pole_a", "pole_b"],
    edges: &[
        ConfigurationEdge {
            role_a: "apex",
            role_b: "pole_a",
            aspect_id: "square",
        },
        ConfigurationEdge {
            role_a: "apex",
            role_b: "pole_b",
            aspect_id: "square",
        },
        ConfigurationEdge {
            role_a: "pole_a",
            role_b: "pole_b",
            aspect_id: "opposition",
        },
    ],
    // `apex` is structurally distinct (squares both poles); the two poles
    // are interchangeable with each other.
    role_automorphisms: &[
        &[("apex", "apex"), ("pole_a", "pole_a"), ("pole_b", "pole_b")],
        &[("apex", "apex"), ("pole_a", "pole_b"), ("pole_b", "pole_a")],
    ],
};

/// Catalog/detector id for this geometry elsewhere in the codebase is
/// `double_quincunx` — see this module's own doc comment for why the role
/// topology is exposed under the common name `yod` here regardless.
pub const YOD: ConfigurationDefinition = ConfigurationDefinition {
    id: "yod",
    roles: &["apex", "base_a", "base_b"],
    edges: &[
        ConfigurationEdge {
            role_a: "apex",
            role_b: "base_a",
            aspect_id: "quincunx",
        },
        ConfigurationEdge {
            role_a: "apex",
            role_b: "base_b",
            aspect_id: "quincunx",
        },
        ConfigurationEdge {
            role_a: "base_a",
            role_b: "base_b",
            aspect_id: "sextile",
        },
    ],
    role_automorphisms: &[
        &[("apex", "apex"), ("base_a", "base_a"), ("base_b", "base_b")],
        &[("apex", "apex"), ("base_a", "base_b"), ("base_b", "base_a")],
    ],
};

pub const GRAND_CROSS: ConfigurationDefinition = ConfigurationDefinition {
    id: "grand_cross",
    // Two opposition pairs, A = (a1,a2) and B = (b1,b2), with every
    // cross-pair between them square.
    roles: &["a1", "a2", "b1", "b2"],
    edges: &[
        ConfigurationEdge {
            role_a: "a1",
            role_b: "a2",
            aspect_id: "opposition",
        },
        ConfigurationEdge {
            role_a: "b1",
            role_b: "b2",
            aspect_id: "opposition",
        },
        ConfigurationEdge {
            role_a: "a1",
            role_b: "b1",
            aspect_id: "square",
        },
        ConfigurationEdge {
            role_a: "a1",
            role_b: "b2",
            aspect_id: "square",
        },
        ConfigurationEdge {
            role_a: "a2",
            role_b: "b1",
            aspect_id: "square",
        },
        ConfigurationEdge {
            role_a: "a2",
            role_b: "b2",
            aspect_id: "square",
        },
    ],
    // The dihedral group of order 8: any permutation that preserves the
    // *partition* of {a1,a2,b1,b2} into the two opposition pairs {a1,a2} and
    // {b1,b2} (independently flipping within either pair, and/or swapping
    // the two pairs with each other) automatically preserves the square
    // cross-edges too, since those are exactly every pair *not* within the
    // same opposition pair. This is the complete set of 8 such
    // permutations, not an arbitrarily chosen subset.
    role_automorphisms: &[
        &[("a1", "a1"), ("a2", "a2"), ("b1", "b1"), ("b2", "b2")], // identity
        &[("a1", "a2"), ("a2", "a1"), ("b1", "b1"), ("b2", "b2")], // flip A
        &[("a1", "a1"), ("a2", "a2"), ("b1", "b2"), ("b2", "b1")], // flip B
        &[("a1", "a2"), ("a2", "a1"), ("b1", "b2"), ("b2", "b1")], // flip A and B
        &[("a1", "b1"), ("a2", "b2"), ("b1", "a1"), ("b2", "a2")], // swap A<->B
        &[("a1", "b2"), ("a2", "b1"), ("b1", "a2"), ("b2", "a1")], // swap, A side flipped
        &[("a1", "b1"), ("a2", "b2"), ("b1", "a2"), ("b2", "a1")], // swap, B side flipped
        &[("a1", "b2"), ("a2", "b1"), ("b1", "a1"), ("b2", "a2")], // swap, both sides flipped
    ],
};

pub const BUILT_IN_CONFIGURATIONS: &[&ConfigurationDefinition] =
    &[&GRAND_TRINE, &T_SQUARE, &YOD, &GRAND_CROSS];

pub fn configuration_definition(id: &str) -> Option<&'static ConfigurationDefinition> {
    BUILT_IN_CONFIGURATIONS
        .iter()
        .find(|definition| definition.id == id)
        .copied()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grand_trine_automorphisms_preserve_the_edge_set() {
        assert!(GRAND_TRINE.automorphisms_are_valid());
        assert_eq!(GRAND_TRINE.role_automorphisms.len(), 6);
    }

    #[test]
    fn t_square_automorphisms_preserve_the_edge_set() {
        assert!(T_SQUARE.automorphisms_are_valid());
        assert_eq!(T_SQUARE.role_automorphisms.len(), 2);
    }

    #[test]
    fn yod_automorphisms_preserve_the_edge_set() {
        assert!(YOD.automorphisms_are_valid());
        assert_eq!(YOD.role_automorphisms.len(), 2);
    }

    #[test]
    fn grand_cross_automorphisms_preserve_the_edge_set() {
        assert!(GRAND_CROSS.automorphisms_are_valid());
        assert_eq!(GRAND_CROSS.role_automorphisms.len(), 8);
    }

    #[test]
    fn automorphisms_are_valid_rejects_a_genuinely_wrong_permutation() {
        // A deliberately invalid "automorphism" (apex and pole_a swapped,
        // which does NOT preserve t_square's edge set: apex squares both
        // poles, pole_a/pole_b are only opposed to each other) -- proves
        // `automorphisms_are_valid` actually checks something, rather than
        // vacuously passing for any permutation list.
        let broken = ConfigurationDefinition {
            role_automorphisms: &[&[("apex", "pole_a"), ("pole_a", "apex"), ("pole_b", "pole_b")]],
            ..T_SQUARE
        };
        assert!(!broken.automorphisms_are_valid());
    }

    #[test]
    fn configuration_definition_looks_up_built_ins_by_id() {
        assert_eq!(
            configuration_definition("grand_trine").unwrap().id,
            "grand_trine"
        );
        assert_eq!(configuration_definition("t_square").unwrap().id, "t_square");
        assert_eq!(configuration_definition("yod").unwrap().id, "yod");
        assert_eq!(
            configuration_definition("grand_cross").unwrap().id,
            "grand_cross"
        );
        assert!(configuration_definition("kite").is_none());
        assert!(configuration_definition("double_quincunx").is_none());
    }
}
