use super::models::{AnalysisInstance, TransitSetup, WorkspaceManifest};
use std::fs;
use std::path::Path;

pub fn write_workspace_manifest(base: &Path, manifest: &WorkspaceManifest) -> Result<(), String> {
    let manifest_yaml = serde_yaml::to_string(manifest)
        .map_err(|e| format!("Manifest YAML serialization failed: {}", e))?;
    let manifest_path = base.join("workspace.yaml");
    fs::write(&manifest_path, manifest_yaml)
        .map_err(|e| format!("Write workspace.yaml failed: {}", e))
}

pub fn write_chart_yaml(
    base: &Path,
    relative_path: &str,
    chart: &serde_json::Value,
) -> Result<(), String> {
    let full_path = base.join(relative_path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create chart directory: {}", e))?;
    }

    let chart_yaml = serde_yaml::to_string(chart)
        .map_err(|e| format!("Chart YAML serialization failed: {}", e))?;
    fs::write(&full_path, chart_yaml)
        .map_err(|e| format!("Write chart file {} failed: {}", full_path.display(), e))
}

pub fn write_analysis_yaml(base: &Path, analysis: &AnalysisInstance) -> Result<String, String> {
    let relative_path = format!("analyses/{}.yml", sanitize_chart_filename(&analysis.id));
    let full_path = base.join(&relative_path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create analysis directory: {error}"))?;
    }
    let yaml = serde_yaml::to_string(analysis)
        .map_err(|error| format!("Analysis YAML serialization failed: {error}"))?;
    fs::write(&full_path, yaml).map_err(|error| {
        format!(
            "Write analysis file {} failed: {error}",
            full_path.display()
        )
    })?;
    Ok(relative_path)
}

/// Write a transit setup YAML file and return its workspace-relative path.
/// Does not update `workspace.yaml`; callers decide whether the manifest needs it.
pub fn write_transit_setup(base: &Path, setup: &TransitSetup) -> Result<String, String> {
    let transits_dir = base.join("transits");
    fs::create_dir_all(&transits_dir)
        .map_err(|e| format!("Failed to create transits dir: {}", e))?;
    let relative_path = format!(
        "transits/{}.yml",
        sanitize_chart_filename(&setup.source_chart_id)
    );
    let path = base.join(&relative_path);
    let yaml = serde_yaml::to_string(setup)
        .map_err(|e| format!("Transit setup YAML serialization failed: {}", e))?;
    fs::write(&path, yaml)
        .map_err(|e| format!("Write transit setup {} failed: {}", path.display(), e))?;
    Ok(relative_path)
}

pub fn sanitize_chart_filename(chart_id: &str) -> String {
    let safe: String = chart_id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if safe.is_empty() {
        "chart".to_string()
    } else {
        safe
    }
}

pub fn chart_relative_path(chart_id: &str) -> String {
    format!("charts/{}.yml", sanitize_chart_filename(chart_id))
}
