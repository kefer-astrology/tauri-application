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


#[derive(Debug, Clone, Serialize, Deserialize)]
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
pub struct Location {
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
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
    use serde::Deserialize;
    let s: Option<String> = Option::deserialize(deserializer)?;
    match s {
        Some(ref s) if !s.is_empty() => {
            // Try multiple datetime formats
            let formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d %H:%M",
                "%Y-%m-%d",
            ];

            for format in &formats {
                if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, format) {
                    return Ok(Some(dt.and_utc()));
                }
            }

            // Try parsing as ISO8601
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
                return Ok(Some(dt.with_timezone(&chrono::Utc)));
            }

            Ok(None)
        }
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
        Some(dt) => serializer.serialize_str(&dt.format("%Y-%m-%d %H:%M:%S").to_string()),
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
    pub display_style: String,
    #[serde(default)]
    pub color_theme: String,
    #[serde(default)]
    pub override_ephemeris: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
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
    pub time_system: Option<TimeSystem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceManifest {
    pub owner: String,
    #[serde(default)]
    pub active_model: Option<String>,
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
    pub chart_presets: Vec<String>, // File paths
    #[serde(default)]
    pub subjects: Vec<String>, // File paths
    #[serde(default)]
    pub charts: Vec<String>, // File paths
    #[serde(default)]
    pub layouts: Vec<String>, // File paths
    #[serde(default)]
    pub annotations: Vec<String>, // File paths
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartSummary {
    pub id: String,
    pub name: String,
    pub chart_type: String,
    pub date_time: String,
    pub location: String,
    pub tags: Vec<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    #[serde(default)]
    pub computed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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
