use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
#[allow(clippy::upper_case_acronyms)]
pub enum ChartMode {
    NATAL,
    EVENT,
    HORARY,
    COMPOSITE,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HouseSystem {
    #[serde(rename = "Placidus")]
    Placidus,
    #[serde(rename = "Whole Sign")]
    WholeSign,
    #[serde(rename = "Campanus")]
    Campanus,
    #[serde(rename = "Koch")]
    Koch,
    #[serde(rename = "Equal")]
    Equal,
    #[serde(rename = "Regiomontanus")]
    Regiomontanus,
    #[serde(rename = "Vehlow")]
    Vehlow,
    #[serde(rename = "Porphyry")]
    Porphyry,
    #[serde(rename = "Alcabitius")]
    Alcabitius,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum ZodiacType {
    Tropical,
    Sidereal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EngineType {
    #[serde(rename = "swisseph")]
    Swisseph,
    #[serde(rename = "jyotish")]
    Jyotish,
    #[serde(rename = "jpl")]
    Jpl,
    #[serde(rename = "custom")]
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Ayanamsa {
    #[serde(rename = "Lahiri")]
    Lahiri,
    #[serde(rename = "Raman")]
    Raman,
    #[serde(rename = "Krishnamurti")]
    Krishnamurti,
    #[serde(rename = "FaganBradley")]
    FaganBradley,
    #[serde(rename = "DeLuce")]
    DeLuce,
    #[serde(rename = "UserDefined")]
    UserDefined,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AspectContext {
    Chart,
    Transit,
    Direction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum Element {
    Fire,
    Earth,
    Air,
    Water,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TimeSystem {
    #[serde(rename = "gregorian")]
    Gregorian,
    #[serde(rename = "julian_day")]
    JulianDay,
    #[serde(rename = "julian_calendar")]
    JulianCalendar,
    #[serde(rename = "unix_timestamp")]
    UnixTimestamp,
    #[serde(rename = "ordinal_date")]
    OrdinalDate,
    #[serde(rename = "iso_week_date")]
    IsoWeekDate,
    #[serde(rename = "compact_date")]
    CompactDate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RelationType {
    Transit,
    Synastry,
    Progression,
    Composite,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ViewModuleType {
    WheelView,
    TransitTimeline,
    AspectGrid,
    SummaryTable,
    InterpretationText,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LayoutStyle {
    Single,
    TimelineOverlay,
    DualWheel,
    Comparison,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InputMode {
    Auto,
    Manual,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub utc_offset: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location_mode: Option<InputMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone_mode: Option<InputMode>,
}

pub fn validate_timezone_identifier(value: &str) -> Result<(), String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("Timezone is required".to_string());
    }
    if valid_utc_offset(value) || matches!(value, "UTC" | "GMT") {
        return Ok(());
    }
    if value.starts_with("UTC") || value.starts_with("GMT") {
        return Err(format!("Invalid fixed-offset timezone: '{value}'"));
    }
    if value.starts_with('/')
        || value.ends_with('/')
        || value.contains("//")
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "/_+-".contains(character))
    {
        return Err(format!("Invalid timezone identifier: '{value}'"));
    }
    Ok(())
}

pub fn validate_utc_offset(value: &str) -> Result<(), String> {
    if valid_utc_offset(value.trim()) {
        Ok(())
    } else {
        Err(format!(
            "Invalid UTC offset: '{value}' (expected UTC±HH:MM, maximum ±14:00)"
        ))
    }
}

fn valid_utc_offset(value: &str) -> bool {
    if value.is_empty() {
        return false;
    }
    if matches!(value, "UTC" | "GMT") {
        return true;
    }
    let value = value
        .strip_prefix("UTC")
        .or_else(|| value.strip_prefix("GMT"))
        .unwrap_or(value);
    let Some(signless) = value.strip_prefix('+').or_else(|| value.strip_prefix('-')) else {
        return false;
    };
    let Some((hours, minutes)) = signless.split_once(':') else {
        return false;
    };
    if hours.len() != 2 || minutes.len() != 2 {
        return false;
    }
    let (Ok(hours), Ok(minutes)) = (hours.parse::<u8>(), minutes.parse::<u8>()) else {
        return false;
    };
    minutes < 60 && (hours < 14 || (hours == 14 && minutes == 0))
}

pub fn validate_location(location: &Location) -> Result<(), String> {
    if location.name.trim().is_empty() {
        return Err("Location name is required".to_string());
    }
    if !location.latitude.is_finite() || !(-90.0..=90.0).contains(&location.latitude) {
        return Err("Latitude must be between -90 and 90 degrees".to_string());
    }
    if !location.longitude.is_finite() || !(-180.0..=180.0).contains(&location.longitude) {
        return Err("Longitude must be between -180 and 180 degrees".to_string());
    }
    validate_timezone_identifier(&location.timezone)?;
    if let Some(offset) = location.utc_offset.as_deref() {
        validate_utc_offset(offset)?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartSubject {
    pub id: String,
    pub name: String,
    #[serde(
        deserialize_with = "deserialize_datetime",
        serialize_with = "serialize_datetime"
    )]
    pub event_time: Option<chrono::DateTime<chrono::Utc>>,
    pub location: Location,
}

fn deserialize_datetime<'de, D>(
    deserializer: D,
) -> Result<Option<chrono::DateTime<chrono::Utc>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::{de::Error, Deserialize};
    let s: Option<String> = Option::deserialize(deserializer)?;
    match s {
        Some(ref s) if !s.trim().is_empty() => crate::event_time::parse_event_time(s)
            .map(Some)
            .map_err(D::Error::custom),
        _ => Ok(None),
    }
}

fn serialize_datetime<S>(
    dt: &Option<chrono::DateTime<chrono::Utc>>,
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    match dt {
        Some(dt) => {
            serializer.serialize_str(&dt.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        }
        None => serializer.serialize_none(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartConfig {
    pub mode: ChartMode,
    #[serde(default)]
    pub house_system: Option<HouseSystem>,
    pub zodiac_type: ZodiacType,
    #[serde(default)]
    pub included_points: Vec<String>,
    #[serde(default)]
    pub aspect_orbs: HashMap<String, f64>,
    #[serde(default)]
    pub selected_aspects: Option<Vec<String>>,
    #[serde(default)]
    pub display_style: String,
    #[serde(default)]
    pub color_theme: String,
    #[serde(default)]
    pub override_ephemeris: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    /// Sparse calculation-definition changes local to this chart.
    #[serde(default)]
    pub model_overrides: Option<ModelOverrides>,
    #[serde(default)]
    pub engine: Option<EngineType>,
    #[serde(default)]
    pub ayanamsa: Option<Ayanamsa>,
    #[serde(default)]
    pub observable_objects: Option<Vec<String>>,
    #[serde(default)]
    pub time_system: Option<TimeSystem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartInstance {
    pub id: String,
    pub subject: ChartSubject,
    pub config: ChartConfig,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub tag_colors: HashMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub roden_rating: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartPreset {
    pub name: String,
    pub config: ChartConfig,
}

/// Persisted transit calculation intent. Results remain derived and are
/// recomputed so ephemeris/model upgrades cannot leave stale values behind.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TransitSetup {
    pub version: u32,
    pub source_chart_id: String,
    pub transit_type: String,
    pub period_mode: String,
    pub from_date: String,
    pub from_time: String,
    pub to_date: String,
    pub to_time: String,
    pub time_step_seconds: u64,
    pub transiting_bodies: Vec<String>,
    pub transited_bodies: Vec<String>,
    pub aspect_types: Vec<String>,
    #[serde(default)]
    pub aspect_orbs: HashMap<String, f64>,
    #[serde(default)]
    pub school: Option<AstrologySchoolId>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub model_overrides: Option<ModelOverrides>,
    pub house_transitions: bool,
    pub sign_transitions: bool,
    #[serde(default)]
    pub exact_hits: bool,
    #[serde(default)]
    pub station_events: bool,
    pub transit_limits: bool,
    pub precession_correction: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub start: chrono::DateTime<chrono::Utc>,
    pub end: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartRelation {
    #[serde(rename = "type")]
    pub relation_type: RelationType,
    pub source: String,
    pub target: String,
    pub method: String,
    #[serde(default)]
    pub time_span: Option<DateRange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewModule {
    #[serde(rename = "type")]
    pub module_type: ViewModuleType,
    #[serde(default)]
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewLayout {
    pub name: String,
    pub layout_style: LayoutStyle,
    #[serde(default)]
    pub chart_instances: Vec<String>,
    #[serde(default)]
    pub relations: Vec<ChartRelation>,
    #[serde(default)]
    pub modules: Vec<ViewModule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Annotation {
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub created: Option<chrono::DateTime<chrono::Utc>>,
    pub author: String,
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
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceDefaults {
    #[serde(default)]
    pub ephemeris_engine: Option<EngineType>,
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
    pub chart_presets: Vec<String>, // File paths
    #[serde(default)]
    pub subjects: Vec<String>, // File paths
    #[serde(default)]
    pub charts: Vec<String>, // File paths
    #[serde(default)]
    pub layouts: Vec<String>, // File paths
    #[serde(default)]
    pub annotations: Vec<String>, // File paths
    #[serde(default)]
    pub transit_analyses: Vec<String>, // File paths
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartSummary {
    pub id: String,
    pub name: String,
    pub chart_type: String,
    pub date_time: String,
    pub location: String,
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub tag_colors: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub path: String,
    pub owner: String,
    pub active_model: Option<String>,
    pub charts: Vec<ChartSummary>,
}

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
pub struct AspectDefinition {
    pub id: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Legacy presentation metadata retained for YAML compatibility.
    pub glyph: String,
    #[serde(default)]
    pub angle: f64,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sign {
    pub name: String,
    pub glyph: String,
    pub abbreviation: String,
    pub element: Element,
    #[serde(default)]
    pub i18n: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSettings {
    #[serde(default)]
    pub default_house_system: Option<HouseSystem>,
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OverrideEntry {
    pub id: String,
    #[serde(default)]
    pub glyph: Option<String>,
    #[serde(default)]
    pub angle: Option<f64>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementColorSettings {
    #[serde(default = "default_element_fire")]
    pub fire: String,
    #[serde(default = "default_element_earth")]
    pub earth: String,
    #[serde(default = "default_element_air")]
    pub air: String,
    #[serde(default = "default_element_water")]
    pub water: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RadixPointColorSettings {
    #[serde(default)]
    pub colors: HashMap<String, String>,
}

fn default_degrees_in_circle() -> f64 {
    360.0
}

fn default_true() -> bool {
    true
}

fn default_model_version() -> u32 {
    1
}

fn default_workspace_schema_version() -> u32 {
    1
}

fn default_obliquity_j2000() -> f64 {
    23.4392911
}

fn default_coordinate_tolerance() -> f64 {
    0.0001
}

fn default_element_fire() -> String {
    "#C00000".to_string()
}

fn default_element_earth() -> String {
    "#909030".to_string()
}

fn default_element_air() -> String {
    "#8000FF".to_string()
}

fn default_element_water() -> String {
    "#0000A0".to_string()
}

#[cfg(test)]
mod location_validation_tests {
    use super::*;

    fn valid_location() -> Location {
        Location {
            name: "Prague".to_string(),
            latitude: 50.0875,
            longitude: 14.4214,
            timezone: "Europe/Prague".to_string(),
            utc_offset: None,
            location_mode: Some(InputMode::Auto),
            timezone_mode: Some(InputMode::Auto),
        }
    }

    #[test]
    fn accepts_iana_timezone_and_fractional_offset_override() {
        let mut location = valid_location();
        location.utc_offset = Some("UTC+05:45".to_string());
        assert!(validate_location(&location).is_ok());
    }

    #[test]
    fn rejects_invalid_coordinates_timezone_and_offset() {
        let mut location = valid_location();
        location.latitude = 91.0;
        assert!(validate_location(&location).is_err());

        location = valid_location();
        location.timezone = "Europe Prague".to_string();
        assert!(validate_location(&location).is_err());

        location = valid_location();
        location.timezone = "UTC+14:15".to_string();
        assert!(validate_location(&location).is_err());

        location = valid_location();
        location.utc_offset = Some("UTC+14:15".to_string());
        assert!(validate_location(&location).is_err());

        location = valid_location();
        location.utc_offset = Some(String::new());
        assert!(validate_location(&location).is_err());
    }
}
