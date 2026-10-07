//! Provider boundary for chart positions, motion, axes, and house cusps.
//!
//! The JPL provider primarily exposes astronomical state vectors. The optional
//! Swiss Ephemeris provider also performs astrology-oriented operations, so
//! this module deliberately describes the shared output rather than calling
//! every provider an astronomy backend.

use std::collections::HashMap;
#[cfg(feature = "swisseph")]
use std::path::Path;

use serde::Serialize;

use crate::workspace::models::{ChartInstance, EngineType};

#[derive(Debug, Clone)]
pub struct AstronomyAxes {
    pub asc: f64,
    pub desc: f64,
    pub mc: f64,
    pub ic: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AstronomyMotion {
    pub speed: f64,
    pub retrograde: bool,
}

#[derive(Debug, Clone)]
pub struct AstronomyChartData {
    pub positions: HashMap<String, f64>,
    pub motion: HashMap<String, AstronomyMotion>,
    /// Equatorial/topocentric coordinates (degrees), keyed by body id. Only
    /// populated by providers which support them for the requested bodies.
    pub right_ascension: HashMap<String, f64>,
    pub declination: HashMap<String, f64>,
    pub altitude: HashMap<String, f64>,
    pub azimuth: HashMap<String, f64>,
    pub axes: AstronomyAxes,
    pub house_cusps: Vec<f64>,
    pub warnings: Vec<String>,
}

pub trait AstronomyBackend {
    fn backend_id(&self) -> &'static str;
    fn ephemeris_source(&self, chart: &ChartInstance) -> Option<String>;
    fn compute_chart_data(
        &self,
        chart: &ChartInstance,
        requested_objects: Option<&Vec<String>>,
    ) -> Result<AstronomyChartData, String>;
}

#[cfg(feature = "swisseph")]
#[derive(Debug, Clone, Copy, Default)]
pub struct SwissAstronomyBackend;

#[cfg(feature = "swisseph")]
impl AstronomyBackend for SwissAstronomyBackend {
    fn backend_id(&self) -> &'static str {
        "swisseph"
    }

    fn ephemeris_source(&self, chart: &ChartInstance) -> Option<String> {
        chart
            .config
            .override_ephemeris
            .clone()
            .filter(|value| !value.trim().is_empty())
            .or_else(crate::infrastructure::swisseph::default_ephemeris_source)
    }

    fn compute_chart_data(
        &self,
        chart: &ChartInstance,
        requested_objects: Option<&Vec<String>>,
    ) -> Result<AstronomyChartData, String> {
        let computed =
            crate::infrastructure::swisseph::compute_chart_data(chart, requested_objects, None)?;
        Ok(AstronomyChartData {
            positions: computed.positions,
            motion: computed.motion,
            right_ascension: HashMap::new(),
            declination: HashMap::new(),
            altitude: HashMap::new(),
            azimuth: HashMap::new(),
            axes: AstronomyAxes {
                asc: computed.axes.asc,
                desc: computed.axes.desc,
                mc: computed.axes.mc,
                ic: computed.axes.ic,
            },
            house_cusps: computed.house_cusps,
            warnings: Vec::new(),
        })
    }
}

/// JPL DE provider routed through Swiss Ephemeris compatibility mode.
#[cfg(feature = "swisseph")]
#[derive(Debug, Clone, Copy, Default)]
pub struct JplViaSwissAstronomyBackend;

#[cfg(feature = "swisseph")]
impl AstronomyBackend for JplViaSwissAstronomyBackend {
    fn backend_id(&self) -> &'static str {
        "jpl"
    }

    fn ephemeris_source(&self, chart: &ChartInstance) -> Option<String> {
        chart
            .config
            .override_ephemeris
            .clone()
            .filter(|value| !value.trim().is_empty())
    }

    fn compute_chart_data(
        &self,
        chart: &ChartInstance,
        requested_objects: Option<&Vec<String>>,
    ) -> Result<AstronomyChartData, String> {
        let jpl_file = chart
            .config
            .override_ephemeris
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .map(Path::new);
        let computed = crate::infrastructure::swisseph::compute_chart_data_jpl(
            chart,
            requested_objects,
            jpl_file,
        )?;
        Ok(AstronomyChartData {
            positions: computed.positions,
            motion: computed.motion,
            right_ascension: HashMap::new(),
            declination: HashMap::new(),
            altitude: HashMap::new(),
            azimuth: HashMap::new(),
            axes: AstronomyAxes {
                asc: computed.axes.asc,
                desc: computed.axes.desc,
                mc: computed.axes.mc,
                ic: computed.axes.ic,
            },
            house_cusps: computed.house_cusps,
            warnings: Vec::new(),
        })
    }
}

/// Select the provider for a chart based on its engine configuration.
pub fn backend_for_chart(chart: &ChartInstance) -> Box<dyn AstronomyBackend + Send + Sync> {
    if matches!(chart.config.engine, Some(EngineType::Jpl)) {
        if let Ok(backend) = crate::infrastructure::jpl_backend::jpl_backend_for_chart(chart) {
            return Box::new(backend);
        }
        #[cfg(feature = "swisseph")]
        return Box::new(JplViaSwissAstronomyBackend);
    }
    #[cfg(feature = "swisseph")]
    return Box::new(SwissAstronomyBackend);
    #[cfg(not(feature = "swisseph"))]
    {
        Box::new(
            crate::infrastructure::jpl_backend::jpl_backend_for_chart(chart).unwrap_or_else(|_| {
                crate::infrastructure::jpl_backend::JplAstronomyBackend::new(
                    crate::infrastructure::ephemeris::EphemerisManager::from_global()
                        .available_bsp_paths(),
                )
            }),
        )
    }
}
