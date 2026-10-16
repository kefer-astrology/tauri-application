use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::aspects::{AspectLineTierStyle, ObjectType};
use super::calculation::{EngineType, HouseSystem, PositionMode, TimeSystem};
use super::catalog::{AstroModel, ModelOverrides};
use super::chart::{AnalysisInstance, ChartSummary};
use super::colors::{ElementColorSettings, RadixPointColorSettings};
use super::location::Location;

/// Extensible astrological tradition/school identifier.
///
/// This deliberately remains a string instead of a closed enum so workspaces
/// can carry user-defined schools without requiring an application release.
pub type AstrologySchoolId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstrologySchool {
    pub id: AstrologySchoolId,
    #[serde(default)]
    pub extends: Option<AstrologySchoolId>,
    pub default_model: String,
}

/// A closed set of well-known astrological traditions, each with a characteristic
/// approach to objects, aspects, and orbs.
///
/// This is deliberately **not** the same concept as [`AstrologySchoolId`]/
/// [`AstrologySchool`] above, which remains an open, user-definable label whose
/// only job is picking a named [`AstroModel`]. `AspectTradition` is the
/// "Škola" workspace setting: choosing one rewrites the workspace's aspect
/// selection and per-aspect orbs (`WorkspaceDefaults::default_aspects` /
/// `default_aspect_orbs`), and ensures `Angle` is present in the global
/// `extended_object_types` — see `workspace::tradition::tradition_aspect_preset`.
/// A first iteration: it only touches aspects.
/// Object selection and a tradition-specific orb *model* (whole-sign tolerance,
/// planetary moieties, harmonic-scaled orbs, midpoint/dial orbs, or Jyotish
/// directional drishti) are intentionally out of scope for now and remain
/// future work — applying a tradition today is an approximation using the
/// existing per-aspect-orb computation engine, not a true implementation of
/// each school's native method.
///
/// Renamed from `AstrologicalTradition`: that name and `AstrologySchool`/
/// `AstrologySchoolId`/`WorkspaceManifest::active_school` are two unrelated
/// concepts that both got called "tradition/school" in code, which was
/// confusing; `AspectTradition` makes clear this one is specifically the
/// aspect-preset selector.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AspectTradition {
    /// Sign-based major aspects (conjunction/sextile/square/trine/opposition);
    /// angles and Lots are relevant targets. True whole-sign "no numeric orb"
    /// aspect detection is not implemented — wide orbs approximate it.
    Hellenistic,
    /// Major aspects (including conjunction); applying/separating and
    /// reception traditionally matter. True per-planet orb moieties are not
    /// implemented — a single widened orb per aspect approximates them.
    MedievalTraditional,
    /// Major aspects plus a curated set of minor aspects — the app's existing
    /// historical defaults.
    ModernWestern,
    /// Every harmonic family (quintile, septile, novile, undecile, …) enabled
    /// at once, using the catalog's existing per-aspect orbs (already roughly
    /// scaled down with harmonic number) rather than a true harmonic-number
    /// orb formula.
    Harmonic,
    /// The hard-aspect family (0/45/90/135/180 degrees) with tight orbs,
    /// echoing the 90-degree dial. True midpoint-dial computation is not
    /// implemented.
    Cosmobiology,
    /// Same hard-aspect family as Cosmobiology with even tighter orbs,
    /// echoing Uranian dial practice. True dial/midpoint computation and the
    /// Uranian hypothetical bodies are not implemented.
    UranianHamburg,
    /// Placeholder using Western major aspects at default orbs. Real Parāśari
    /// planetary aspects (directional per-planet "graha drishti", not a
    /// mutual angle-plus-orb model) are not representable by this engine yet
    /// and are explicitly future work.
    JyotishParashari,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceDefaults {
    #[serde(default)]
    pub ephemeris_engine: Option<EngineType>,
    #[serde(default)]
    pub position_mode: Option<PositionMode>,
    #[serde(default)]
    pub ephemeris_backend: Option<String>,
    #[serde(default)]
    pub element_colors: Option<ElementColorSettings>,
    #[serde(default)]
    pub radix_point_colors: Option<RadixPointColorSettings>,
    #[serde(default)]
    pub default_location: Option<Location>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub default_house_system: Option<HouseSystem>,
    #[serde(default)]
    pub default_bodies: Option<Vec<String>>,
    #[serde(default)]
    pub default_aspects: Option<Vec<String>>,
    #[serde(default)]
    pub default_aspect_orbs: Option<HashMap<String, f64>>,
    #[serde(default)]
    pub default_aspect_colors: Option<HashMap<String, String>>,
    /// Which object categories — `Planet` is always implicitly included and never appears here;
    /// every other category (`Angle`, asteroids, lunar nodes, parts, geocentric nodes,
    /// trans-Neptunian objects, hypothetical bodies) is opt-in — may participate in *any* aspect
    /// at all. Global, not per-aspect: every aspect's `object_type_rule` is rebuilt from the same
    /// set. `None` (never configured) keeps the catalog's own unrestricted baseline (every
    /// category eligible). See `apply_workspace_aspect_scope_defaults`.
    #[serde(default)]
    pub extended_object_types: Option<Vec<ObjectType>>,
    /// Per-object id: the orb to use whenever that object is on either side of a pair — narrows
    /// the aspect's own orb down to this value (never widens it; see
    /// `domain::astrology::resolve_allowed_orb`). Applies to *any* object category, including
    /// individual planets and angles, not just the opt-in `extended_object_types` ones — see
    /// `PER_OBJECT_ORB_TYPES`. Global across every aspect, unlike `default_aspect_orbs`. A
    /// missing entry means that object doesn't get a narrower orb (behaves like a plain core
    /// object) until the settings UI gives it a value.
    #[serde(default)]
    pub object_orbs: Option<HashMap<String, f64>>,
    /// The workspace's chosen astrological tradition ("Škola"). Remembered so
    /// the UI can show the current selection and so future iterations can use
    /// it to drive object/orb-model choices too. Setting it (re)populates
    /// `default_aspects`/`default_aspect_orbs` with that tradition's suggested
    /// values and ensures `Angle` is present in `extended_object_types` — see
    /// `workspace::tradition::tradition_aspect_preset`. Distinct from
    /// `WorkspaceManifest::active_school`.
    #[serde(default)]
    pub astrology_tradition: Option<AspectTradition>,
    #[serde(default)]
    pub aspect_line_tier_style: Option<AspectLineTierStyle>,
    #[serde(default)]
    pub time_system: Option<TimeSystem>,
}

/// Portable presentation choices. They are persisted with the workspace but
/// never enter astrological setting resolution or computation.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WorkspacePresentation {
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub glyph_set: Option<String>,
    #[serde(default)]
    pub element_colors: Option<ElementColorSettings>,
    #[serde(default)]
    pub radix_point_colors: Option<RadixPointColorSettings>,
    #[serde(default)]
    pub aspect_colors: Option<HashMap<String, String>>,
    #[serde(default)]
    pub aspect_line_tier_style: Option<AspectLineTierStyle>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkspaceTagDefinition {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceManifest {
    #[serde(default = "default_workspace_schema_version")]
    pub schema_version: u32,
    pub owner: String,
    #[serde(default)]
    pub active_school: Option<AstrologySchoolId>,
    #[serde(default)]
    pub active_model: Option<String>,
    #[serde(default)]
    pub schools: HashMap<AstrologySchoolId, AstrologySchool>,
    #[serde(default)]
    pub aspects: Vec<String>,
    #[serde(default)]
    pub bodies: Vec<String>,
    #[serde(default)]
    pub models: HashMap<String, AstroModel>,
    #[serde(default)]
    pub model_overrides: Option<ModelOverrides>,
    pub default: WorkspaceDefaults,
    #[serde(default)]
    pub presentation: WorkspacePresentation,
    #[serde(default)]
    pub tag_catalog: Vec<WorkspaceTagDefinition>,
    #[serde(default)]
    pub chart_presets: Vec<String>, // File paths
    #[serde(default)]
    pub subjects: Vec<String>, // File paths
    #[serde(default)]
    pub charts: Vec<String>, // File paths
    #[serde(default)]
    pub analyses: Vec<String>, // File paths
    #[serde(default)]
    pub layouts: Vec<String>, // File paths
    #[serde(default)]
    pub annotations: Vec<String>, // File paths
    #[serde(default)]
    pub transit_analyses: Vec<String>, // File paths
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub path: String,
    pub owner: String,
    pub active_model: Option<String>,
    pub tag_catalog: Vec<WorkspaceTagDefinition>,
    pub charts: Vec<ChartSummary>,
    pub analyses: Vec<AnalysisInstance>,
}

fn default_workspace_schema_version() -> u32 {
    1
}
