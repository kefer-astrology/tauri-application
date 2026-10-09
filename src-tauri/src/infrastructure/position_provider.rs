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

#[derive(Debug, Clone, Default)]
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

/// How much of [`AstronomyChartData`] a caller actually needs. A minimal-path
/// caller never gets *less* correctness than the full path for the same
/// `body_ids` — only RA/Dec/Alt/Az and axes/house cusps (irrelevant to a
/// longitude- or motion-based root-finder) are allowed to be skipped, and
/// only when the requested ids don't themselves depend on those (see
/// `JplAstronomyBackend::compute_minimal`'s angle-id guard).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RequiredQuantities {
    /// Longitude only — aspect/orb root-finders.
    LongitudeOnly,
    /// Longitude and direct/retrograde motion — stationary-point root-finders.
    LongitudeAndMotion,
}

/// Trimmed-down counterpart to [`AstronomyChartData`] for
/// [`AstronomyBackend::compute_minimal`] — only what [`RequiredQuantities`]
/// ever asks for. Deliberately has no `warnings` field: this is a hot,
/// per-probe cache-fill path (`evaluation_context::EvaluationContext`), and
/// an unresolved id there simply stays absent from `positions`/`motion` —
/// the caller already turns that into its own `{id}_unavailable` error. Any
/// *detailed* reason a body failed to resolve (e.g. ephemeris coverage) is
/// still visible via the full `AstronomyChartData::warnings` path, which
/// every request also exercises once for its radix/source chart.
#[derive(Debug, Clone, Default)]
pub(crate) struct MinimalChartData {
    pub positions: HashMap<String, f64>,
    pub motion: HashMap<String, AstronomyMotion>,
}

pub trait AstronomyBackend {
    fn backend_id(&self) -> &'static str;
    fn ephemeris_source(&self, chart: &ChartInstance) -> Option<String>;
    fn compute_chart_data(
        &self,
        chart: &ChartInstance,
        requested_objects: Option<&Vec<String>>,
    ) -> Result<AstronomyChartData, String>;

    /// Same contract as `compute_chart_data`, but may skip quantities
    /// `quantities` says aren't needed. The default delegates to the full
    /// path unchanged — always correct, just not faster — so a provider that
    /// doesn't override this (the Swiss Ephemeris backends; their own
    /// per-call FFI setup/teardown cost dwarfs this optimization anyway)
    /// never needs touching. `JplAstronomyBackend` is the one real override.
    fn compute_minimal(
        &self,
        chart: &ChartInstance,
        body_ids: &[String],
        quantities: RequiredQuantities,
    ) -> Result<MinimalChartData, String> {
        let _ = quantities;
        let full = self.compute_chart_data(chart, Some(&body_ids.to_vec()))?;
        Ok(MinimalChartData {
            positions: full.positions,
            motion: full.motion,
        })
    }
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
