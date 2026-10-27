//! Batch loading and Rust computation of every chart in a workspace.
//!
//! Replaces per-chart round trips (each of which re-read the manifest and every chart file)
//! with one manifest/chart read, parallel computation, and a content-addressed cache so
//! reopening an unchanged workspace skips computation entirely.

use std::path::Path;

use crate::application::computation::{compute_chart, ChartComputeRequest, ResolvedChart};
use crate::infrastructure::compute_cache;
use crate::workspace::models::{ChartInstance, WorkspaceManifest};

/// Bumped when the serialized calculation layout changes.
const CALCULATION_CACHE_FORMAT: u32 = 1;

pub enum ChartComputeOutcome {
    /// Serialized `ChartCalculation`.
    Computed(serde_json::Value),
    Failed(String),
    /// Not computed here (e.g. routed to the Python backend); the caller computes it on its own.
    Deferred,
}

pub struct WorkspaceChartComputation {
    pub chart: ChartInstance,
    pub outcome: ChartComputeOutcome,
}

/// Load every chart and compute those `defer` does not claim, in manifest order.
pub fn compute_workspace_charts(
    workspace_dir: &Path,
    defer: &(dyn Fn(&ChartInstance) -> bool + Sync),
) -> Result<Vec<WorkspaceChartComputation>, String> {
    let manifest = crate::workspace::load_workspace_manifest(workspace_dir)?;
    let charts = crate::workspace::load_all_charts(workspace_dir, &manifest)?;
    if charts.is_empty() {
        return Ok(Vec::new());
    }
    let ephemerides: Vec<String> =
        crate::infrastructure::ephemeris::EphemerisManager::from_global()
            .available_bsp_paths()
            .iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect();

    let workers = std::thread::available_parallelism()
        .map(|count| count.get())
        .unwrap_or(1)
        .min(charts.len());
    let chunk_size = charts.len().div_ceil(workers);
    let manifest = &manifest;
    let ephemerides = &ephemerides;

    std::thread::scope(|scope| {
        let handles: Vec<_> = charts
            .chunks(chunk_size)
            .map(|chunk| {
                scope.spawn(move || {
                    chunk
                        .iter()
                        .map(|chart| WorkspaceChartComputation {
                            chart: chart.clone(),
                            outcome: if defer(chart) {
                                ChartComputeOutcome::Deferred
                            } else {
                                compute_cached(manifest, chart, ephemerides)
                            },
                        })
                        .collect::<Vec<_>>()
                })
            })
            .collect();
        handles
            .into_iter()
            .map(|handle| {
                handle
                    .join()
                    .map_err(|_| "Chart computation worker panicked".to_string())
            })
            .collect::<Result<Vec<_>, _>>()
            .map(|chunks| chunks.into_iter().flatten().collect())
    })
}

fn compute_cached(
    manifest: &WorkspaceManifest,
    chart: &ChartInstance,
    ephemerides: &[String],
) -> ChartComputeOutcome {
    let report = crate::workspace::settings::current_model_report_with_layers(
        manifest,
        None,
        Some(&chart.config),
        None,
    );
    let resolved = ResolvedChart::from_report(chart.clone(), report);
    let key = compute_cache::cache_key(&serde_json::json!({
        "format": CALCULATION_CACHE_FORMAT,
        "facts": crate::domain::astrology::CHART_FACTS_VERSION,
        "app": env!("CARGO_PKG_VERSION"),
        "chart": chart,
        "model": resolved.model,
        "settings": resolved.settings,
        "ephemerides": ephemerides,
    }));
    if let Some(cached) = compute_cache::get(&key) {
        return ChartComputeOutcome::Computed(cached);
    }
    match compute_chart(ChartComputeRequest::for_resolved_chart(resolved)).and_then(|calculation| {
        serde_json::to_value(calculation)
            .map_err(|error| format!("Failed to serialize chart calculation: {error}"))
    }) {
        Ok(value) => {
            compute_cache::put(&key, &value);
            ChartComputeOutcome::Computed(value)
        }
        Err(error) => ChartComputeOutcome::Failed(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::sample_workspace_path;

    #[test]
    fn batch_computes_every_chart_with_facts_and_honours_defer() {
        let workspace_path = sample_workspace_path();
        let base = Path::new(&workspace_path);

        let first = compute_workspace_charts(base, &|_| false).expect("batch should load");
        assert!(!first.is_empty());
        for entry in &first {
            match &entry.outcome {
                ChartComputeOutcome::Computed(value) => {
                    assert_eq!(value["chart_id"], serde_json::json!(entry.chart.id));
                    assert!(
                        value["facts"]["bodies"].is_object(),
                        "facts missing for {}",
                        entry.chart.id
                    );
                }
                ChartComputeOutcome::Failed(error) => panic!("{} failed: {error}", entry.chart.id),
                ChartComputeOutcome::Deferred => panic!("nothing should be deferred"),
            }
        }

        // Second run is served from the in-memory cache with identical output.
        let second = compute_workspace_charts(base, &|_| false).expect("batch should load again");
        for (a, b) in first.iter().zip(&second) {
            match (&a.outcome, &b.outcome) {
                (ChartComputeOutcome::Computed(x), ChartComputeOutcome::Computed(y)) => {
                    assert_eq!(x, y)
                }
                _ => panic!("cached run should compute the same charts"),
            }
        }

        let deferred = compute_workspace_charts(base, &|_| true).expect("batch should load");
        assert!(deferred
            .iter()
            .all(|entry| matches!(entry.outcome, ChartComputeOutcome::Deferred)));
    }
}
