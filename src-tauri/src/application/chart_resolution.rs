//! Chart-input validation and resolution shared by command adapters.
//!
//! This module turns transport/persisted chart input into `ResolvedChart` values
//! for application computation. Workspace YAML representation and I/O remain in
//! `crate::workspace`.

use std::path::Path;

pub(crate) fn non_empty_str(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

pub fn resolve_settings_preset(
    workspace_dir: &Path,
    manifest: &crate::workspace::models::WorkspaceManifest,
    preset_id: Option<&str>,
) -> Result<Option<crate::workspace::settings::SettingsLayer>, String> {
    let Some(preset_id) = preset_id.and_then(non_empty_str) else {
        return Ok(None);
    };
    let preset = crate::workspace::find_chart_preset(workspace_dir, manifest, preset_id)?
        .ok_or_else(|| format!("Chart preset not found: {preset_id}"))?;
    Ok(Some(
        crate::workspace::settings::SettingsLayer::from_chart_config(&preset.config),
    ))
}

pub fn extract_chart_id(chart: &serde_json::Value) -> Result<&str, String> {
    chart
        .get("id")
        .and_then(|v| v.as_str())
        .filter(|v| !v.trim().is_empty())
        .ok_or_else(|| "Chart id is required".to_string())
}

pub fn upsert_chart_id(chart: &mut serde_json::Value, chart_id: &str) -> Result<(), String> {
    let obj = chart
        .as_object_mut()
        .ok_or_else(|| "Chart payload must be a JSON object".to_string())?;
    obj.insert("id".to_string(), serde_json::json!(chart_id));
    Ok(())
}

pub fn validate_chart_payload(
    chart: &serde_json::Value,
) -> Result<crate::workspace::models::ChartInstance, String> {
    let parsed: crate::workspace::models::ChartInstance = serde_json::from_value(chart.clone())
        .map_err(|error| format!("Invalid chart payload: {error}"))?;
    validate_chart_instance(&parsed)?;
    Ok(parsed)
}

/// Resolve a standalone chart and operation overrides into the input expected by
/// Rust calculation use cases. The original JSON remains a transport payload;
/// callers receive the validated, typed chart instead.
pub fn resolve_standalone_chart(
    chart_json: &serde_json::Value,
    operation: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<crate::application::computation::ResolvedChart, String> {
    let chart = validate_chart_payload(chart_json)?;
    let report = crate::workspace::settings::standalone_model_report_with_operation(
        &chart.config,
        operation,
    );
    Ok(crate::application::computation::ResolvedChart::from_report(
        chart, report,
    ))
}

/// Load a workspace chart, optional preset, and operation overrides through one
/// shared path before a Rust use case computes it.
pub fn resolve_workspace_chart(
    workspace_path: &str,
    chart_id: &str,
    preset_id: Option<&str>,
    operation: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<crate::application::computation::ResolvedChart, String> {
    let workspace_dir = Path::new(workspace_path);
    let manifest = crate::workspace::load_workspace_manifest(workspace_dir)?;
    let chart_ref =
        crate::workspace::loader::find_chart_ref_by_id(workspace_dir, &manifest, chart_id)?
            .ok_or_else(|| format!("Chart {chart_id} not found"))?;
    let chart = crate::workspace::loader::load_chart(workspace_dir, &chart_ref)?;
    let preset = resolve_settings_preset(workspace_dir, &manifest, preset_id)?;
    let report = crate::workspace::settings::current_model_report_with_layers(
        &manifest,
        preset.as_ref(),
        Some(&chart.config),
        operation,
    );
    Ok(crate::application::computation::ResolvedChart::from_report(
        chart, report,
    ))
}

/// Enforce that a project uses exactly one house system across all of its charts.
///
/// A chart with no explicit `house_system` always inherits the project's
/// choice and is never in conflict. The first chart to set an explicit house
/// system establishes the project's house system (persisted onto
/// `manifest.default.default_house_system`); every later chart must agree
/// with it. This only gates persistence (chart create/update/import) — it
/// intentionally leaves `current_model_report_with_layers`'s general
/// workspace/preset/chart/operation precedence chain untouched, since that
/// resolution path also serves ephemeral, non-persisted overrides (e.g. a
/// one-off compute with a different house system for comparison) that this
/// restriction is not meant to block.
///
/// Returns `Ok(true)` if it set the project's house system for the first
/// time, so the caller knows to persist the updated manifest.
pub fn enforce_single_project_house_system(
    manifest: &mut crate::workspace::models::WorkspaceManifest,
    chart: &crate::workspace::models::ChartInstance,
) -> Result<bool, String> {
    let Some(requested) = chart.config.house_system.clone() else {
        return Ok(false);
    };
    match &manifest.default.default_house_system {
        Some(existing) if *existing != requested => Err(format!(
            "This project uses '{}' houses; chart '{}' cannot select a different house system ('{}'). Change the project's house system in workspace settings instead.",
            existing.label(),
            chart.id,
            requested.label(),
        )),
        Some(_) => Ok(false),
        None => {
            manifest.default.default_house_system = Some(requested);
            Ok(true)
        }
    }
}

pub fn validate_chart_instance(
    chart: &crate::workspace::models::ChartInstance,
) -> Result<(), String> {
    if chart.id.trim().is_empty() {
        return Err("Chart id is required".to_string());
    }
    if chart.subject.name.trim().is_empty() {
        return Err("Chart name is required".to_string());
    }
    if chart.subject.event_time.is_none() {
        return Err("Chart event time is required".to_string());
    }
    crate::workspace::models::validate_location(&chart.subject.location)?;
    if matches!(
        chart.subject.location.timezone_mode.as_ref(),
        Some(crate::workspace::models::InputMode::Auto)
    ) {
        let expected = crate::infrastructure::geocoding::timezone_for_coordinates(
            chart.subject.location.latitude,
            chart.subject.location.longitude,
        )?;
        if chart.subject.location.timezone != expected {
            return Err(format!(
                "Timezone '{}' does not match coordinates in auto mode; expected '{expected}'",
                chart.subject.location.timezone
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::sample_chart_payload;

    #[test]
    fn auto_timezone_must_match_chart_coordinates() {
        let mut payload = sample_chart_payload("auto-timezone");
        payload["subject"]["location"]["timezone_mode"] = serde_json::json!("auto");
        payload["subject"]["location"]["timezone"] = serde_json::json!("UTC");

        let error = validate_chart_payload(&payload)
            .expect_err("mismatched auto timezone should be rejected");
        assert!(error.contains("expected 'Europe/Prague'"));
    }
}
