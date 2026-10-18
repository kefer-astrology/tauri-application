use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::calculation::{Ayanamsa, EngineType, HouseSystem, PositionMode, TimeSystem, ZodiacType};
use super::catalog::ModelOverrides;
use super::location::Location;

/// Why an independently calculated base chart exists.
///
/// This is deliberately separate from [`DerivedChartMethod`]: a natal chart and an
/// event chart are both calculated directly from subject facts, whereas a return or
/// composite chart is calculated from one or more other charts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BaseChartPurpose {
    Natal,
    Event,
    Horary,
    Electional,
    Moment,
}

/// The operation that produces a chart from one or more chart inputs.
///
/// Variants are intentionally composable. For example, progressed synastry is not a
/// chart method: it is a `synastry` analysis whose operands have a `progression` step.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DerivedChartMethod {
    Return,
    Progression,
    Direction,
    Relocation,
    Harmonic,
    Persona,
    Composite,
    Davison,
    Draconic,
    Coalescent,
}

/// Canonical chart classification. `parameters` contains method-specific, versioned
/// values (for example `return_kind: solar` or `harmonic: 9`) without multiplying the
/// top-level taxonomy for every algorithm option.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ChartDefinition {
    Base {
        purpose: BaseChartPurpose,
    },
    Derived {
        method: DerivedChartMethod,
        #[serde(default)]
        inputs: Vec<String>,
        #[serde(default)]
        parameters: serde_json::Value,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisMethod {
    Synastry,
    TransitComparison,
    ChartComparison,
}

/// An optional derivation applied to an analysis operand. This is what makes compound
/// workflows such as progressed or draconic synastry possible without inventing new
/// analysis methods.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DerivedChartStep {
    pub method: DerivedChartMethod,
    #[serde(default)]
    pub parameters: serde_json::Value,
}

/// A chart supplied to an analysis. Exactly one of `chart_id` and `inline_subject`
/// should be present. Inline subjects support unsaved manual entries in comparison UIs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chart_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inline_subject: Option<ChartSubject>,
    #[serde(default)]
    pub derivations: Vec<DerivedChartStep>,
}

/// A relationship/comparison produces analysis output, not another chart. It therefore
/// has its own identity and operands and can be rendered by one or more view layouts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisInstance {
    #[serde(default = "default_analysis_schema_version")]
    pub version: u32,
    pub id: String,
    pub name: String,
    pub method: AnalysisMethod,
    pub inputs: Vec<AnalysisInput>,
    #[serde(default)]
    pub parameters: serde_json::Value,
    #[serde(default)]
    pub tags: Vec<String>,
}

fn default_analysis_schema_version() -> u32 {
    1
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
    pub definition: ChartDefinition,
    #[serde(default)]
    pub house_system: Option<HouseSystem>,
    pub zodiac_type: ZodiacType,
    #[serde(default)]
    pub aspect_orbs: HashMap<String, f64>,
    #[serde(default)]
    pub selected_aspects: Option<Vec<String>>,
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
    pub position_mode: Option<PositionMode>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartSummary {
    pub id: String,
    pub name: String,
    pub definition: ChartDefinition,
    pub date_time: String,
    pub location: String,
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub tag_colors: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Annotation {
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub created: Option<chrono::DateTime<chrono::Utc>>,
    pub author: String,
}
