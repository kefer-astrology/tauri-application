//! Typed transit-series computation use case.

use std::collections::HashMap;

use chrono::{DateTime, Duration, NaiveDate, NaiveDateTime, Utc};
use serde::Serialize;

use crate::astrology::ComputedAspect;

use super::computation::{compute_positions, extend_unique, inherited_or_override, ResolvedChart};

const MAX_TRANSIT_STEPS: i64 = 50_000;

#[derive(Debug, Clone)]
pub struct TransitSeriesRequest {
    pub resolved_chart: ResolvedChart,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub time_step_seconds: i64,
    pub transiting_objects: Vec<String>,
    pub transited_objects: Vec<String>,
    pub aspect_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransitTimeRange {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransitSeriesStep {
    pub datetime: String,
    pub transit_positions: HashMap<String, f64>,
    pub aspects: Vec<ComputedAspect>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransitSeriesCalculation {
    pub source_chart_id: String,
    pub time_range: TransitTimeRange,
    pub time_step: String,
    pub results: Vec<TransitSeriesStep>,
    pub backend_used: String,
    pub fallback_used: bool,
    pub ephemeris_source: Option<String>,
    pub warnings: Vec<String>,
}

pub fn parse_datetime_input(value: &str) -> Result<DateTime<Utc>, String> {
    if let Ok(datetime) = DateTime::parse_from_rfc3339(value) {
        return Ok(datetime.with_timezone(&Utc));
    }

    let naive_formats = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"];
    for format in naive_formats {
        if let Ok(datetime) = NaiveDateTime::parse_from_str(value, format) {
            return Ok(datetime.and_utc());
        }
    }

    if let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        if let Some(datetime) = date.and_hms_opt(0, 0, 0) {
            return Ok(datetime.and_utc());
        }
    }

    Err(format!("Invalid datetime format: {value}"))
}

pub fn compute_transit_series(
    request: TransitSeriesRequest,
) -> Result<TransitSeriesCalculation, String> {
    if request.time_step_seconds <= 0 {
        return Err("time_step_seconds must be > 0".to_string());
    }
    if request.end < request.start {
        return Err("end_datetime must be greater than or equal to start_datetime".to_string());
    }

    let resolved = request.resolved_chart;
    let transited_ids = inherited_or_override(
        &resolved.settings.default_bodies,
        Some(&request.transited_objects),
    );
    let radix = compute_positions(
        &resolved.chart,
        &resolved.model,
        transited_ids,
        &resolved.warnings,
    )?;
    let backend_used = radix.backend_used.clone();
    let ephemeris_source = radix.ephemeris_source.clone();
    let mut warnings = radix.warnings;

    let transiting_ids = inherited_or_override(
        &resolved.settings.default_bodies,
        Some(&request.transiting_objects),
    );
    let mut current = request.start;
    let step = Duration::seconds(request.time_step_seconds);
    let mut step_count = 0_i64;
    let mut results = Vec::new();

    while current <= request.end {
        step_count += 1;
        if step_count > MAX_TRANSIT_STEPS {
            return Err(format!(
                "Transit range too large (>{MAX_TRANSIT_STEPS} steps). Increase time step or reduce range."
            ));
        }

        let mut transit_chart = resolved.chart.clone();
        transit_chart.subject.event_time = Some(current);
        let transit = compute_positions(&transit_chart, &resolved.model, transiting_ids, &[])?;
        extend_unique(&mut warnings, transit.warnings);
        let aspects = crate::astrology::compute_cross_aspects(
            &transit.positions,
            &radix.positions,
            &resolved.model.aspect_definitions,
            &resolved.settings.aspect_orbs,
            &request.aspect_types,
        );
        results.push(TransitSeriesStep {
            datetime: current.to_rfc3339(),
            transit_positions: transit.positions,
            aspects,
        });
        current += step;
    }

    Ok(TransitSeriesCalculation {
        source_chart_id: resolved.chart.id,
        time_range: TransitTimeRange {
            start: request.start.to_rfc3339(),
            end: request.end.to_rfc3339(),
        },
        time_step: format!("{}s", request.time_step_seconds),
        results,
        backend_used,
        fallback_used: false,
        ephemeris_source,
        warnings,
    })
}
