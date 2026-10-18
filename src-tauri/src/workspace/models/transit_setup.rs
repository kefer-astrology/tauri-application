use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::catalog::ModelOverrides;
use super::manifest::AstrologySchoolId;
use super::shared::default_true;

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
    /// Whether the sampled `results` graph series is computed at all —
    /// `#[serde(default = "default_true")]` so a setup saved before this
    /// field existed still behaves exactly as before (the sampled series
    /// was always computed unconditionally).
    #[serde(default = "default_true")]
    pub sampled_series: bool,
    /// Persisted multi-body configuration searches (Grand Trine, T-square,
    /// Grand Cross, Yod) — see `application::transit::ConfigurationSearchRequest`.
    #[serde(default)]
    pub configuration_requests: Vec<ConfigurationSearchSetup>,
    pub transit_limits: bool,
    pub precession_correction: bool,
}

/// Persisted form of one `application::transit::ConfigurationSearchRequest`
/// — kept as its own serializable type here (rather than deriving
/// `Serialize`/`Deserialize` on the application-layer type itself) for the
/// same reason `TransitSetup` is a workspace-layer type distinct from
/// `application::transit::TransitEventSearchRequest`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConfigurationSearchSetup {
    pub configuration_id: String,
    #[serde(default)]
    pub fixed_roles: Vec<String>,
    #[serde(default)]
    pub role_candidates: HashMap<String, Vec<String>>,
}
