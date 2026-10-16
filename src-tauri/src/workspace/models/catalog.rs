use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::aspects::{AspectContext, AspectDefinition, ObjectType, ObjectTypeRule};
use super::calculation::{Ayanamsa, EngineType, HouseSystem, PositionMode, ZodiacType};
use super::elements::{Element, Sign};
use super::manifest::AstrologySchoolId;
use super::shared::default_true;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BodyDefinition {
    pub id: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Legacy presentation metadata. New workspaces should resolve glyphs in
    /// the frontend presentation profile instead.
    pub glyph: String,
    #[serde(default)]
    pub formula: String,
    #[serde(default)]
    pub element: Option<Element>,
    #[serde(default)]
    pub avg_speed: f64,
    #[serde(default)]
    pub max_orb: f64,
    #[serde(default)]
    pub i18n: HashMap<String, String>,
    #[serde(default)]
    pub object_type: Option<ObjectType>,
    #[serde(default)]
    pub computation_map: HashMap<String, Option<String>>,
    #[serde(default)]
    pub requires_location: bool,
    #[serde(default)]
    pub requires_house_system: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSettings {
    #[serde(default)]
    pub default_house_system: Option<HouseSystem>,
    #[serde(default)]
    pub position_mode: Option<PositionMode>,
    #[serde(default)]
    pub default_aspects: Vec<String>,
    #[serde(default)]
    pub default_bodies: Vec<String>,
    #[serde(default)]
    pub standard_orb: f64,
    #[serde(default)]
    pub default_transit_aspects: Option<Vec<String>>,
    #[serde(default)]
    pub default_direction_aspects: Option<Vec<String>>,
    #[serde(default)]
    pub default_transit_bodies: Option<Vec<String>>,
    #[serde(default)]
    pub default_direction_bodies: Option<Vec<String>>,
    #[serde(default = "default_degrees_in_circle")]
    pub degrees_in_circle: f64,
    #[serde(default = "default_obliquity_j2000")]
    pub obliquity_j2000: f64,
    #[serde(default = "default_coordinate_tolerance")]
    pub coordinate_tolerance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstroModel {
    pub name: String,
    #[serde(default)]
    pub school: Option<AstrologySchoolId>,
    #[serde(default = "default_model_version")]
    pub version: u32,
    #[serde(default)]
    pub body_definitions: Vec<BodyDefinition>,
    #[serde(default)]
    pub aspect_definitions: Vec<AspectDefinition>,
    #[serde(default)]
    pub signs: Vec<Sign>,
    #[serde(default)]
    pub settings: Option<ModelSettings>,
    #[serde(default)]
    pub engine: Option<EngineType>,
    #[serde(default)]
    pub zodiac_type: Option<ZodiacType>,
    #[serde(default)]
    pub ayanamsa: Option<Ayanamsa>,
}

/// Runtime domain catalog shared by all frontends. Presentation concerns such as
/// colors and glyph-file choices intentionally do not belong here.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainCatalog {
    pub model: AstroModel,
    pub house_systems: Vec<HouseSystemDefinition>,
    pub shapes: Vec<DomainDefinition>,
    pub configurations: Vec<DomainDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HouseSystemDefinition {
    pub id: String,
    pub computation_supported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainDefinition {
    pub id: String,
    pub translation_key: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub generated_variant: Option<GeneratedVariantRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedVariantRule {
    pub prefix: String,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OverrideEntry {
    pub id: String,
    #[serde(default)]
    pub glyph: Option<String>,
    #[serde(default)]
    pub angle: Option<f64>,
    #[serde(default)]
    pub harmonic: Option<u32>,
    #[serde(default)]
    pub default_orb: Option<f64>,
    #[serde(default)]
    pub only_for: Option<Vec<String>>,
    #[serde(default)]
    pub i18n: Option<HashMap<String, String>>,
    /// Legacy function-wrapper metadata, retained losslessly. It does not
    /// enable/disable a catalog entry because its historical meaning was not
    /// implemented consistently.
    #[serde(default)]
    pub computed: Option<bool>,
    /// Whether the definition participates in computation.
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub valid_contexts: Option<Vec<AspectContext>>,
    #[serde(default)]
    pub interpretation_weight: Option<f64>,
    #[serde(default)]
    pub object_type_rule: Option<ObjectTypeRule>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct ModelOverrides {
    #[serde(default)]
    pub points: Vec<OverrideEntry>,
    #[serde(default)]
    pub aspects: Vec<OverrideEntry>,
    #[serde(default)]
    pub override_orbs: HashMap<String, f64>,
}

fn default_degrees_in_circle() -> f64 {
    360.0
}

fn default_model_version() -> u32 {
    1
}

fn default_obliquity_j2000() -> f64 {
    23.4392911
}

fn default_coordinate_tolerance() -> f64 {
    0.0001
}
