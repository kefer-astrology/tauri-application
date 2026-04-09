use serde::{Deserialize, Serialize};

/// Physical position data for an astronomical object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionData {
    // Ecliptic coordinates
    pub longitude: f64,
    pub latitude: Option<f64>,

    // Equatorial coordinates (always present for JPL)
    pub declination: Option<f64>,     // Always Some for JPL
    pub right_ascension: Option<f64>, // Always Some for JPL
    pub distance: Option<f64>,        // Always Some for JPL (NOT optional - always computed)

    // Topocentric coordinates (JPL with location)
    pub altitude: Option<f64>,
    pub azimuth: Option<f64>,

    // Physical properties (JPL for planets)
    pub apparent_magnitude: Option<f64>,
    pub phase_angle: Option<f64>,
    pub elongation: Option<f64>,
    pub light_time: Option<f64>, // Light time in seconds

    // Motion properties
    pub speed: Option<f64>,
    pub retrograde: Option<bool>,
}

/// Row returned from position queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionRow {
    pub datetime: String,
    pub object_id: String,
    pub data: PositionData,
    #[serde(default)]
    pub radix_chart_id: Option<String>,
    #[serde(default = "default_true")]
    pub is_radix: bool,
}

fn default_true() -> bool {
    true
}

/// Aspect data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AspectData {
    pub relation_id: String,
    pub datetime: String,
    pub source_object: String,
    pub target_object: String,
    pub aspect_type: String,
    pub angle: f64,
    pub orb: f64,
    pub exact_datetime: Option<String>,
}

/// Radix-relative position row (transits vs base chart)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadixRelativeRow {
    pub datetime: String,
    pub object_id: String,
    pub transit_longitude: f64,
    pub radix_longitude: f64,
    pub longitude_diff: f64,
    pub transit_declination: Option<f64>,
    pub radix_declination: Option<f64>,
    pub declination_diff: Option<f64>,
    pub transit_distance: Option<f64>,
    pub radix_distance: Option<f64>,
    pub distance_diff: Option<f64>,
}

/// Relation metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationData {
    pub relation_id: String,
    pub relation_type: String, // 'transit', 'synastry', 'progression', 'composite'
    pub source_chart_id: String,
    pub target_chart_id: Option<String>,
    pub third_chart_id: Option<String>,
    pub method: Option<String>,
    pub time_span_start: Option<String>,
    pub time_span_end: Option<String>,
    pub source_config: Option<String>, // JSON string
    pub target_config: Option<String>, // JSON string
    pub engine: Option<String>,
    pub ephemeris_file: Option<String>,
    pub included_objects: Option<Vec<String>>,
    pub included_aspects: Option<Vec<String>>,
}
