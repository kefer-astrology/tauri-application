use super::models::*;
use serde::de::DeserializeOwned;
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

pub fn load_chart_preset(base_dir: &Path, preset_path: &str) -> Result<ChartPreset, String> {
    let full_path = resolve_relative_path(base_dir, preset_path)?;
    let content = fs::read_to_string(&full_path)
        .map_err(|error| format!("Failed to read chart preset {preset_path}: {error}"))?;
    serde_yaml::from_str(&content)
        .map_err(|error| format!("Failed to parse chart preset {preset_path}: {error}"))
}

pub fn find_chart_preset(
    base_dir: &Path,
    manifest: &WorkspaceManifest,
    requested: &str,
) -> Result<Option<ChartPreset>, String> {
    let requested = requested.trim();
    if requested.is_empty() {
        return Ok(None);
    }

    for preset_path in &manifest.chart_presets {
        let preset = load_chart_preset(base_dir, preset_path)?;
        if preset.name == requested || preset_path == requested {
            return Ok(Some(preset));
        }
    }
    Ok(None)
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
        tag_colors: chart.tag_colors.clone(),
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

/// Load every typed item referenced by a workspace manifest.
///
/// A malformed reference becomes a structured diagnostic and does not make
/// another item disappear. Failure to load the manifest itself remains fatal.
pub fn load_workspace_aggregate(
    base_dir: &Path,
) -> Result<super::validation::LoadedWorkspace, String> {
    use std::collections::HashSet;

    use super::validation::LoadedWorkspace;

    let manifest = load_workspace_manifest(base_dir)?;
    let workspace_model_report = super::settings::current_model_report(&manifest, None);
    let validation_model = workspace_model_report.model;
    let mut diagnostics = workspace_model_report.diagnostics;
    let mut subjects = Vec::new();
    let mut charts = Vec::new();
    let mut chart_presets = Vec::new();
    let mut layouts = Vec::new();
    let mut annotations = Vec::new();

    for reference in &manifest.subjects {
        match load_yaml_reference::<ChartSubject>(base_dir, reference, "subject") {
            Ok(subject) => subjects.push(subject),
            Err(diagnostic) => diagnostics.push(diagnostic),
        }
    }
    for reference in &manifest.charts {
        match load_chart(base_dir, reference) {
            Ok(chart) => {
                let report = super::settings::current_model_report(&manifest, Some(&chart.config));
                diagnostics.extend(super::validation::validate_effective_settings(
                    &report.model,
                    &report.effective_settings,
                    &format!("charts.{reference}.effective_settings"),
                ));
                diagnostics.extend(super::validation::validate_chart_config(
                    &chart.config,
                    &report.model,
                    &format!("charts.{reference}.config"),
                ));
                validate_subject(
                    &chart.subject,
                    &format!("charts.{reference}.subject"),
                    &mut diagnostics,
                );
                charts.push(chart);
            }
            Err(error) => diagnostics.push(reference_error("chart", reference, error)),
        }
    }
    for reference in &manifest.chart_presets {
        match load_chart_preset(base_dir, reference) {
            Ok(preset) => {
                diagnostics.extend(super::validation::validate_chart_config(
                    &preset.config,
                    &validation_model,
                    &format!("chart_presets.{reference}.config"),
                ));
                chart_presets.push(preset);
            }
            Err(error) => diagnostics.push(reference_error("chart_preset", reference, error)),
        }
    }
    for reference in &manifest.layouts {
        match load_yaml_reference::<ViewLayout>(base_dir, reference, "layout") {
            Ok(layout) => layouts.push(layout),
            Err(diagnostic) => diagnostics.push(diagnostic),
        }
    }
    for reference in &manifest.annotations {
        match load_annotation(base_dir, reference) {
            Ok(annotation) => annotations.push(annotation),
            Err(diagnostic) => diagnostics.push(diagnostic),
        }
    }

    validate_named_items(
        subjects.iter().map(|subject| subject.id.as_str()),
        "duplicate_subject_id",
        "subject",
        &mut diagnostics,
    );
    validate_named_items(
        charts.iter().map(|chart| chart.id.as_str()),
        "duplicate_chart_id",
        "chart",
        &mut diagnostics,
    );
    validate_named_items(
        chart_presets.iter().map(|preset| preset.name.as_str()),
        "duplicate_preset_id",
        "chart preset",
        &mut diagnostics,
    );
    validate_named_items(
        layouts.iter().map(|layout| layout.name.as_str()),
        "duplicate_layout_id",
        "layout",
        &mut diagnostics,
    );
    validate_named_items(
        annotations
            .iter()
            .map(|annotation| annotation.title.as_str()),
        "duplicate_annotation_id",
        "annotation",
        &mut diagnostics,
    );
    for subject in &subjects {
        validate_subject(
            subject,
            &format!("subjects.{}", subject.id),
            &mut diagnostics,
        );
    }

    let chart_ids: HashSet<String> = charts
        .iter()
        .map(|chart| chart.id.trim().to_ascii_lowercase())
        .collect();
    for layout in &layouts {
        for chart_id in &layout.chart_instances {
            validate_layout_chart_reference(
                &chart_ids,
                chart_id,
                &layout.name,
                "chart_instances",
                &mut diagnostics,
            );
        }
        for relation in &layout.relations {
            validate_layout_chart_reference(
                &chart_ids,
                &relation.source,
                &layout.name,
                "relations.source",
                &mut diagnostics,
            );
            validate_layout_chart_reference(
                &chart_ids,
                &relation.target,
                &layout.name,
                "relations.target",
                &mut diagnostics,
            );
        }
    }

    Ok(LoadedWorkspace {
        manifest,
        subjects,
        charts,
        chart_presets,
        layouts,
        annotations,
        diagnostics,
    })
}

fn load_yaml_reference<T: DeserializeOwned>(
    base_dir: &Path,
    reference: &str,
    kind: &str,
) -> Result<T, super::validation::Diagnostic> {
    let full_path = resolve_relative_path(base_dir, reference)
        .map_err(|error| reference_error(kind, reference, error))?;
    let content = fs::read_to_string(&full_path)
        .map_err(|error| reference_error(kind, reference, error.to_string()))?;
    serde_yaml::from_str(&content)
        .map_err(|error| reference_error(kind, reference, error.to_string()))
}

fn load_annotation(
    base_dir: &Path,
    reference: &str,
) -> Result<Annotation, super::validation::Diagnostic> {
    let full_path = resolve_relative_path(base_dir, reference)
        .map_err(|error| reference_error("annotation", reference, error))?;
    let content = fs::read_to_string(&full_path)
        .map_err(|error| reference_error("annotation", reference, error.to_string()))?;
    let extension = full_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if matches!(extension.as_str(), "yaml" | "yml") {
        return serde_yaml::from_str(&content)
            .map_err(|error| reference_error("annotation", reference, error.to_string()));
    }
    Ok(Annotation {
        title: full_path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("note")
            .to_string(),
        content,
        created: None,
        author: "unknown".to_string(),
    })
}

fn reference_error(
    kind: &str,
    reference: &str,
    error: impl std::fmt::Display,
) -> super::validation::Diagnostic {
    super::validation::Diagnostic::error(
        "referenced_item_load_failed",
        format!("Failed to load {kind} '{reference}': {error}"),
        Some(reference.to_string()),
    )
}

fn validate_named_items<'a>(
    ids: impl Iterator<Item = &'a str>,
    code: &str,
    label: &str,
    diagnostics: &mut Vec<super::validation::Diagnostic>,
) {
    let mut seen = std::collections::HashSet::new();
    for id in ids {
        let normalized = id.trim().to_ascii_lowercase();
        if normalized.is_empty() {
            diagnostics.push(super::validation::Diagnostic::error(
                "empty_identifier",
                format!("{label} identifier must not be empty"),
                None,
            ));
        } else if !seen.insert(normalized) {
            diagnostics.push(super::validation::Diagnostic::error(
                code,
                format!("Duplicate {label} identifier '{id}'"),
                None,
            ));
        }
    }
}

fn validate_subject(
    subject: &ChartSubject,
    path: &str,
    diagnostics: &mut Vec<super::validation::Diagnostic>,
) {
    if subject.event_time.is_none() {
        diagnostics.push(super::validation::Diagnostic::error(
            "subject_event_time_missing",
            format!("Subject '{}' has no valid event_time", subject.id),
            Some(format!("{path}.event_time")),
        ));
    }
    if !(-90.0..=90.0).contains(&subject.location.latitude) {
        diagnostics.push(super::validation::Diagnostic::error(
            "invalid_location_latitude",
            format!(
                "Subject '{}' has latitude {} outside [-90, 90]",
                subject.id, subject.location.latitude
            ),
            Some(format!("{path}.location.latitude")),
        ));
    }
    if !(-180.0..=180.0).contains(&subject.location.longitude) {
        diagnostics.push(super::validation::Diagnostic::error(
            "invalid_location_longitude",
            format!(
                "Subject '{}' has longitude {} outside [-180, 180]",
                subject.id, subject.location.longitude
            ),
            Some(format!("{path}.location.longitude")),
        ));
    }
    if let Err(error) = super::models::validate_timezone_identifier(&subject.location.timezone) {
        diagnostics.push(super::validation::Diagnostic::error(
            "invalid_location_timezone",
            format!("Subject '{}': {error}", subject.id),
            Some(format!("{path}.location.timezone")),
        ));
    }
    if let Some(offset) = subject.location.utc_offset.as_deref() {
        if let Err(error) = super::models::validate_utc_offset(offset) {
            diagnostics.push(super::validation::Diagnostic::error(
                "invalid_location_utc_offset",
                format!("Subject '{}': {error}", subject.id),
                Some(format!("{path}.location.utc_offset")),
            ));
        }
    }
}

fn validate_layout_chart_reference(
    chart_ids: &std::collections::HashSet<String>,
    chart_id: &str,
    layout_name: &str,
    field: &str,
    diagnostics: &mut Vec<super::validation::Diagnostic>,
) {
    if !chart_ids.contains(&chart_id.trim().to_ascii_lowercase()) {
        diagnostics.push(super::validation::Diagnostic::error(
            "unknown_layout_chart",
            format!("Layout '{layout_name}' references unknown chart '{chart_id}'"),
            Some(format!("layouts.{layout_name}.{field}")),
        ));
    }
}
