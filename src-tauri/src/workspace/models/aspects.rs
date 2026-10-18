use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::shared::default_true;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ObjectType {
    Planet,
    Asteroid,
    Angle,
    #[serde(rename = "house_cusp")]
    HouseCusp,
    #[serde(rename = "calculated_point")]
    CalculatedPoint,
    #[serde(rename = "lunar_node")]
    LunarNode,
    Part,
    #[serde(rename = "geocentric_node")]
    GeocentricNode,
    #[serde(rename = "trans_neptunian")]
    TransNeptunian,
    #[serde(rename = "hypothetical_planet")]
    HypotheticalPlanet,
    #[serde(rename = "fixed_star")]
    FixedStar,
}

/// Restricts which object categories an aspect definition may form between.
///
/// Mirrors how most astrology engines scope aspect sets (e.g. limiting fixed
/// stars to conjunction-only, or hard aspects to angles) without hand-listing
/// individual object ids: the rule is expressed over `ObjectType` categories
/// and evaluated per candidate pair at aspect-detection time. A `None` object
/// known only by an id with no catalog `object_type` never satisfies
/// `OnlyBetween` and is never matched by `Exclude`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum ObjectTypeRule {
    /// The aspect never forms when either side belongs to one of these categories.
    Exclude { types: Vec<ObjectType> },
    /// The aspect only forms when both sides belong to one of these categories.
    OnlyBetween { types: Vec<ObjectType> },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AspectContext {
    Chart,
    Transit,
    Direction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AspectDefinition {
    pub id: String,
    #[serde(rename = "type", default = "default_aspect_type")]
    pub aspect_type: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Legacy presentation metadata retained for YAML compatibility.
    pub glyph: String,
    #[serde(default)]
    pub angle: f64,
    /// Harmonic series number associated with the exact aspect angle.
    #[serde(default = "default_harmonic")]
    pub harmonic: u32,
    #[serde(default)]
    pub default_orb: f64,
    #[serde(default)]
    pub i18n: HashMap<String, String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub importance: Option<i64>,
    #[serde(default)]
    pub line_style: Option<String>,
    #[serde(default)]
    pub line_width: Option<f64>,
    #[serde(default)]
    pub show_label: Option<bool>,
    #[serde(default)]
    pub valid_contexts: Option<Vec<AspectContext>>,
    #[serde(default)]
    pub interpretation_weight: Option<f64>,
    /// Restricts which object categories this aspect may form between. `None`
    /// means unrestricted (every pair of selected objects is eligible), which
    /// matches prior behavior for existing catalogs.
    #[serde(default)]
    pub object_type_rule: Option<ObjectTypeRule>,
}

/// Line weight on the radix wheel from orb tightness vs the configured max orb for that aspect type.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AspectLineTierStyle {
    /// Orb within this percentage of the configured max orb uses `width_tight` (e.g. 1.0 = 1%).
    #[serde(default = "aspect_line_tier_default_tight_pct")]
    pub tight_threshold_pct: f64,
    #[serde(default = "aspect_line_tier_default_medium_pct")]
    pub medium_threshold_pct: f64,
    #[serde(default = "aspect_line_tier_default_loose_pct")]
    pub loose_threshold_pct: f64,
    #[serde(default = "aspect_line_tier_default_width_tight")]
    pub width_tight: f64,
    #[serde(default = "aspect_line_tier_default_width_medium")]
    pub width_medium: f64,
    #[serde(default = "aspect_line_tier_default_width_loose")]
    pub width_loose: f64,
    /// Used when the aspect is valid but looser than `loose_threshold_pct` of the max orb.
    #[serde(default = "aspect_line_tier_default_width_outer")]
    pub width_outer: f64,
    /// Stroke style for the outer (loosest) tier only — `"solid"`, `"dashed"`, or `"dotted"`.
    #[serde(default = "aspect_line_tier_default_outer_line_style")]
    pub outer_line_style: String,
}

fn aspect_line_tier_default_tight_pct() -> f64 {
    1.0
}
fn aspect_line_tier_default_medium_pct() -> f64 {
    2.0
}
fn aspect_line_tier_default_loose_pct() -> f64 {
    10.0
}
fn aspect_line_tier_default_width_tight() -> f64 {
    5.0
}
fn aspect_line_tier_default_width_medium() -> f64 {
    2.0
}
fn aspect_line_tier_default_width_loose() -> f64 {
    1.0
}
fn aspect_line_tier_default_width_outer() -> f64 {
    1.0
}
fn aspect_line_tier_default_outer_line_style() -> String {
    "dotted".to_string()
}

impl Default for AspectLineTierStyle {
    fn default() -> Self {
        Self {
            tight_threshold_pct: aspect_line_tier_default_tight_pct(),
            medium_threshold_pct: aspect_line_tier_default_medium_pct(),
            loose_threshold_pct: aspect_line_tier_default_loose_pct(),
            width_tight: aspect_line_tier_default_width_tight(),
            width_medium: aspect_line_tier_default_width_medium(),
            width_loose: aspect_line_tier_default_width_loose(),
            width_outer: aspect_line_tier_default_width_outer(),
            outer_line_style: aspect_line_tier_default_outer_line_style(),
        }
    }
}

fn default_harmonic() -> u32 {
    1
}

fn default_aspect_type() -> String {
    "minor".to_string()
}

/// Every object category eligible for a per-object orb override (see
/// `WorkspaceDefaults::object_orbs`, `domain::astrology::resolve_allowed_orb`) — this is
/// deliberately *every* category, not just the once-"extended" ones: `Planet` and `Angle` are
/// always eligible to form any aspect (see `apply_workspace_aspect_scope_defaults`), but a user
/// can still give an individual planet or angle its own narrower orb, the same as an asteroid or
/// node. A missing `object_orbs` entry for a given object simply means no narrowing, regardless
/// of which category it's in.
pub const PER_OBJECT_ORB_TYPES: [ObjectType; 9] = [
    ObjectType::Planet,
    ObjectType::Angle,
    ObjectType::Asteroid,
    ObjectType::LunarNode,
    ObjectType::Part,
    ObjectType::CalculatedPoint,
    ObjectType::GeocentricNode,
    ObjectType::TransNeptunian,
    ObjectType::HypotheticalPlanet,
];

/// Object categories with no physical substance — nothing there to reflect or emit light.
/// Classical (Ptolemaic) aspect theory modeled aspects as geometric "rays" cast between actual
/// bodies in the sky; it covered the Sun, Moon, and the visible planets specifically because a
/// ray needs something to cast and receive it. Lunar/geocentric nodes are orbital-plane
/// intersections, Lilith/Vertex (`CalculatedPoint`) are derived geometric points, Arabic Parts
/// (`Part`) are arithmetic combinations, angles are horizon/meridian directions, and the Uranian
/// "hypothetical" bodies have never been astronomically confirmed to exist at all — none of them
/// are objects a ray of light could pass through. Conjunction (bodily co-presence, a real
/// geometric coincidence regardless of substance) is the one exception and stays unrestricted;
/// see `apply_workspace_aspect_scope_defaults`, the only place this is consulted.
pub const NON_PHYSICAL_OBJECT_TYPES: [ObjectType; 6] = [
    ObjectType::Angle,
    ObjectType::LunarNode,
    ObjectType::CalculatedPoint,
    ObjectType::Part,
    ObjectType::GeocentricNode,
    ObjectType::HypotheticalPlanet,
];
