use std::collections::HashMap;

use serde::Serialize;
#[cfg(feature = "swisseph")]
use std::path::Path;

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
            .or_else(crate::swisseph::default_ephemeris_source)
    }

    fn compute_chart_data(
        &self,
        chart: &ChartInstance,
        requested_objects: Option<&Vec<String>>,
    ) -> Result<AstronomyChartData, String> {
        let computed = crate::swisseph::compute_chart_data(chart, requested_objects, None)?;
        Ok(AstronomyChartData {
            positions: computed.positions,
            motion: computed.motion,
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

/// JPL DE backend routed through the Swiss Ephemeris C library's JPL mode.
///
/// Uses `SEFLG_JPLEPH` and requires a JPL binary ephemeris file (e.g. de440.eph)
/// supplied via `chart.config.override_ephemeris`.
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
            .filter(|v| !v.trim().is_empty())
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
            .filter(|v| !v.trim().is_empty())
            .map(Path::new);

        let computed = crate::swisseph::compute_chart_data_jpl(chart, requested_objects, jpl_file)?;
        Ok(AstronomyChartData {
            positions: computed.positions,
            motion: computed.motion,
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

/// Select the astronomy backend for a chart based on its engine configuration.
///
/// - `jpl` engine + resolvable `.bsp` → `JplAstronomyBackend` (anise/MPL-2.0, license-clean)
/// - `jpl` engine + no BSP, feature `swisseph` → `JplViaSwissAstronomyBackend` (AGPL)
/// - anything else + feature `swisseph` → `SwissAstronomyBackend` (AGPL)
/// - without feature `swisseph` → `JplAstronomyBackend` is the only backend
pub fn backend_for_chart(chart: &ChartInstance) -> Box<dyn AstronomyBackend + Send + Sync> {
    if matches!(chart.config.engine, Some(EngineType::Jpl)) {
        if let Ok(backend) = crate::jpl_backend::jpl_backend_for_chart(chart) {
            return Box::new(backend);
        }
        #[cfg(feature = "swisseph")]
        return Box::new(JplViaSwissAstronomyBackend);
    }
    #[cfg(feature = "swisseph")]
    return Box::new(SwissAstronomyBackend);
    // License-clean default when swisseph feature is not enabled.
    #[cfg(not(feature = "swisseph"))]
    {
        let backend = crate::jpl_backend::jpl_backend_for_chart(chart)
            .unwrap_or_else(|_| crate::jpl_backend::JplAstronomyBackend::new("de421.bsp"));
        Box::new(backend)
    }
}
