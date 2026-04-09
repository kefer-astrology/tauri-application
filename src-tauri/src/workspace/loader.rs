use super::models::*;
use serde_yaml;
use std::fs;
use std::path::{Path, PathBuf};

/// Load workspace manifest from YAML file
pub fn load_workspace_manifest(workspace_path: &Path) -> Result<WorkspaceManifest, String> {
    let manifest_path = workspace_path.join("workspace.yaml");

    if !manifest_path.exists() {
        return Err(format!(
            "Workspace manifest not found: {}",
            manifest_path.display()
        ));
    }

    let content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read workspace.yaml: {}", e))?;

    let manifest: WorkspaceManifest = serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse workspace.yaml: {}", e))?;

    Ok(manifest)
}

/// Load a chart from YAML file
pub fn load_chart(base_dir: &Path, chart_path: &str) -> Result<ChartInstance, String> {
    let full_path = resolve_relative_path(base_dir, chart_path)?;

    let content = fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read chart file {}: {}", chart_path, e))?;

    let chart: ChartInstance = serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse chart file {}: {}", chart_path, e))?;

    Ok(chart)
}

/// Load all charts referenced in manifest
pub fn load_all_charts(
    base_dir: &Path,
    manifest: &WorkspaceManifest,
) -> Result<Vec<ChartInstance>, String> {
    let mut charts = Vec::new();

    for chart_path in &manifest.charts {
        match load_chart(base_dir, chart_path) {
            Ok(chart) => charts.push(chart),
            Err(e) => {
                // Log error but continue loading other charts
                eprintln!("Warning: Failed to load chart {}: {}", chart_path, e);
            }
        }
    }

    Ok(charts)
}

/// Convert ChartInstance to ChartSummary
pub fn chart_to_summary(chart: &ChartInstance) -> ChartSummary {
    let date_time = chart
        .subject
        .event_time
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default();

    let chart_type = match chart.config.mode {
        crate::workspace::models::ChartMode::NATAL => "NATAL",
        crate::workspace::models::ChartMode::EVENT => "EVENT",
        crate::workspace::models::ChartMode::HORARY => "HORARY",
        crate::workspace::models::ChartMode::COMPOSITE => "COMPOSITE",
    }
    .to_string();

    ChartSummary {
        id: chart.id.clone(),
        name: chart.subject.name.clone(),
        chart_type,
        date_time,
        location: chart.subject.location.name.clone(),
        tags: chart.tags.clone(),
    }
}

/// Resolve relative path under base directory (prevent path traversal)
fn resolve_relative_path(base: &Path, rel_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(rel_path);

    // Prevent absolute paths
    if path.is_absolute() {
        return Err(format!("Absolute paths not allowed: {}", rel_path));
    }

    // Resolve path
    let full_path = base
        .join(path)
        .canonicalize()
        .map_err(|e| format!("Failed to resolve path {}: {}", rel_path, e))?;

    // Ensure resolved path is still under base directory
    let base_canonical = base
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize base path: {}", e))?;

    if !full_path.starts_with(&base_canonical) {
        return Err(format!("Path traversal detected: {}", rel_path));
    }

    Ok(full_path)
}
