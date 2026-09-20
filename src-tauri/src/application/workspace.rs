//! Workspace and chart use cases shared by the command adapters.

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
