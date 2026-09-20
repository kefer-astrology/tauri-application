//! Typed radix computation use case.

use std::collections::HashMap;

use serde::Serialize;

use crate::domain::astrology::ComputedAspect;
use crate::infrastructure::astronomy::AstronomyMotion;
use crate::lunar_phase::LunarPhaseDetails;
use crate::workspace::models::{AstroModel, ChartInstance};
use crate::workspace::settings::{
    apply_effective_settings, CurrentModelReport, EffectiveModelSettings,
};

/// A chart plus the model and effective settings required for deterministic
/// computation. Persistence input is cloned before settings are materialized.
#[derive(Debug, Clone)]
pub struct ResolvedChart {
    pub chart: ChartInstance,
    pub model: AstroModel,
    pub settings: EffectiveModelSettings,
    pub warnings: Vec<String>,
}

impl ResolvedChart {
    pub fn from_report(mut chart: ChartInstance, report: CurrentModelReport) -> Self {
        apply_effective_settings(&mut chart.config, &report.effective_settings);
        Self {
            chart,
            model: report.model,
            settings: report.effective_settings,
            warnings: report.warnings,
        }
    }
}

/// Typed application request. `None` inherits the resolved chart selection.
/// Existing command adapters also treat an empty override as inheritance.
#[derive(Debug, Clone)]
pub struct ChartComputeRequest {
    pub resolved_chart: ResolvedChart,
    pub body_ids: Option<Vec<String>>,
    pub aspect_types: Option<Vec<String>>,
}

impl ChartComputeRequest {
    pub fn for_resolved_chart(resolved_chart: ResolvedChart) -> Self {
        Self {
            resolved_chart,
            body_ids: None,
            aspect_types: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ChartAxes {
    pub asc: f64,
    pub desc: f64,
    pub mc: f64,
    pub ic: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChartCalculation {
    pub positions: HashMap<String, f64>,
    pub motion: HashMap<String, AstronomyMotion>,
    pub aspects: Vec<ComputedAspect>,
    pub axes: ChartAxes,
    pub house_cusps: Vec<f64>,
    pub shapes: Vec<String>,
    pub configurations: Vec<String>,
    pub moon_details: Option<LunarPhaseDetails>,
    pub chart_id: String,
    pub backend_used: String,
    pub fallback_used: bool,
    pub ephemeris_source: Option<String>,
    pub warnings: Vec<String>,
}

pub fn compute_chart(request: ChartComputeRequest) -> Result<ChartCalculation, String> {
    let resolved = request.resolved_chart;
    let selected_bodies = inherited_or_override(
        &resolved.settings.default_bodies,
        request.body_ids.as_deref(),
    );
    let selected_aspects = inherited_or_override(
        &resolved.settings.default_aspects,
        request.aspect_types.as_deref(),
    );
    let computed = compute_positions(
        &resolved.chart,
        &resolved.model,
        selected_bodies,
        &resolved.warnings,
    )?;
    let aspects = crate::domain::astrology::compute_chart_aspects(
        &computed.positions,
        &resolved.model.aspect_definitions,
        &resolved.settings.aspect_orbs,
        Some(selected_aspects),
    );
    let moon_details = crate::lunar_phase::from_position_map(&computed.positions);
    let shapes =
        crate::domain::astrology::detect_chart_shapes(&computed.positions, &computed.house_cusps);
    let configurations =
        crate::domain::astrology::detect_chart_configurations(&computed.positions, &aspects);

    Ok(ChartCalculation {
        positions: computed.positions,
        motion: computed.motion,
        aspects,
        axes: computed.axes,
        house_cusps: computed.house_cusps,
        shapes,
        configurations,
        moon_details,
        chart_id: resolved.chart.id,
        backend_used: computed.backend_used,
        fallback_used: false,
        ephemeris_source: computed.ephemeris_source,
        warnings: computed.warnings,
    })
}

pub(super) struct PositionCalculation {
    pub positions: HashMap<String, f64>,
    pub motion: HashMap<String, AstronomyMotion>,
    pub axes: ChartAxes,
    pub house_cusps: Vec<f64>,
    pub backend_used: String,
    pub ephemeris_source: Option<String>,
    pub warnings: Vec<String>,
}

pub(super) fn compute_positions(
    chart: &ChartInstance,
    model: &AstroModel,
    requested_ids: &[String],
    initial_warnings: &[String],
) -> Result<PositionCalculation, String> {
    let backend = crate::infrastructure::astronomy::backend_for_chart(chart);
    let selection = crate::domain::astrology::resolve_body_selection(
        &model.body_definitions,
        requested_ids,
        backend.backend_id(),
    );
    let mut warnings = initial_warnings.to_vec();
    extend_unique(&mut warnings, selection.warnings);
    let computed = backend.compute_chart_data(chart, Some(&selection.ids))?;
    extend_unique(&mut warnings, computed.warnings);
    warn_for_missing_selected_bodies(&mut warnings, &selection.ids, &computed.positions);

    Ok(PositionCalculation {
        positions: computed.positions,
        motion: computed.motion,
        axes: ChartAxes {
            asc: computed.axes.asc,
            desc: computed.axes.desc,
            mc: computed.axes.mc,
            ic: computed.axes.ic,
        },
        house_cusps: computed.house_cusps,
        backend_used: backend.backend_id().to_string(),
        ephemeris_source: backend.ephemeris_source(chart),
        warnings,
    })
}

pub(super) fn inherited_or_override<'a>(
    inherited: &'a [String],
    operation_override: Option<&'a [String]>,
) -> &'a [String] {
    operation_override
        .filter(|items| !items.is_empty())
        .unwrap_or(inherited)
}

pub(super) fn extend_unique(target: &mut Vec<String>, additional: Vec<String>) {
    for warning in additional {
        if !target.contains(&warning) {
            target.push(warning);
        }
    }
}

fn warn_for_missing_selected_bodies(
    warnings: &mut Vec<String>,
    selected_ids: &[String],
    positions: &HashMap<String, f64>,
) {
    extend_unique(
        warnings,
        selected_ids
            .iter()
            .filter(|id| !positions.contains_key(*id))
            .map(|id| format!("body_not_returned_by_engine: {id}"))
            .collect(),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn operation_selection_overrides_inherited_selection() {
        let inherited = vec!["sun".to_string(), "moon".to_string()];
        let operation = vec!["mars".to_string()];

        assert_eq!(
            inherited_or_override(&inherited, Some(&operation)),
            operation
        );
        assert_eq!(inherited_or_override(&inherited, None), inherited);
        assert_eq!(inherited_or_override(&inherited, Some(&[])), inherited);
    }

    #[test]
    fn warning_merge_preserves_order_and_removes_duplicates() {
        let mut warnings = vec!["model_warning".to_string()];
        extend_unique(
            &mut warnings,
            vec!["model_warning".to_string(), "engine_warning".to_string()],
        );

        assert_eq!(warnings, vec!["model_warning", "engine_warning"]);
    }
}
