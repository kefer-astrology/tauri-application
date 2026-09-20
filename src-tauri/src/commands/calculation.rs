use crate::application::compute_router::{
    annotate_chart_fallback, chart_json_requires_python_precision, chart_requires_python_precision,
    normalize_chart_response, select_chart_compute_route, selected_compute_backend, ComputeBackend,
    ComputeRoute,
};
use crate::application::workspace::resolve_settings_preset;
use crate::workspace::load_workspace_manifest;
use crate::workspace::loader::{find_chart_ref_by_id, load_chart};
use std::collections::HashMap;
use std::path::Path;
use tauri::{AppHandle, State};

/// Compute chart positions and aspects from in-memory chart data (no workspace on disk).
#[tauri::command]
pub async fn compute_chart_from_data(
    app: AppHandle,
    backend_state: State<'_, crate::infrastructure::python_sidecar::BackendState>,
    chart_json: serde_json::Value,
    settings_overrides: Option<crate::workspace::settings::SettingsLayer>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    crate::application::workspace::validate_chart_payload(&chart_json)?;
    let backend = selected_compute_backend();
    let fallback_to_python = crate::application::compute_router::python_fallback_enabled();
    let force_python = chart_json_requires_python_precision(&chart_json);
    let backend_available = matches!(
        backend_state.availability()?,
        crate::infrastructure::python_sidecar::BackendAvailability::Available
    );
    let route = select_chart_compute_route(backend, backend_available, force_python)?;
    match route {
        ComputeRoute::Rust => compute_chart_from_data_rust(chart_json, settings_overrides.as_ref()),
        ComputeRoute::Python if matches!(backend, ComputeBackend::Auto) && !force_python => {
            match compute_chart_from_data_python(
                &app,
                &backend_state,
                chart_json.clone(),
                settings_overrides.as_ref(),
            )
            .await
            {
                Ok(result) => Ok(normalize_chart_response(result, Some("python"))),
                Err(_err) if fallback_to_python => Ok(annotate_chart_fallback(
                    compute_chart_from_data_rust(chart_json, settings_overrides.as_ref())?,
                    "python_compute_failed_auto_fallback",
                )),
                Err(err) => Err(err),
            }
        }
        ComputeRoute::Python => compute_chart_from_data_python(
            &app,
            &backend_state,
            chart_json,
            settings_overrides.as_ref(),
        )
        .await
        .map(|result| normalize_chart_response(result, Some("python"))),
    }
}

fn compute_chart_from_data_rust(
    chart_json: serde_json::Value,
    settings_overrides: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let chart: crate::workspace::models::ChartInstance =
        serde_json::from_value(chart_json).map_err(|e| format!("Invalid chart payload: {}", e))?;
    let report = crate::workspace::settings::standalone_model_report_with_operation(
        &chart.config,
        settings_overrides,
    );
    let request = crate::application::computation::ChartComputeRequest::for_resolved_chart(
        crate::application::computation::ResolvedChart::from_report(chart, report),
    );
    let calculation = crate::application::computation::compute_chart(request)?;
    chart_calculation_to_map(calculation)
}

/// Detect cross-chart aspects (e.g. a transit overlay) between two already-computed
/// position maps, using the same resolved model definitions and orb overrides as
/// `compute_chart_from_data`. Callers that have no persisted workspace chart id should
/// use this instead of re-implementing aspect-detection geometry client-side.
#[tauri::command]
pub async fn compute_cross_aspects_from_data(
    chart_json: serde_json::Value,
    transiting_positions: HashMap<String, f64>,
    transited_positions: HashMap<String, f64>,
    aspect_types: Vec<String>,
    settings_overrides: Option<crate::workspace::settings::SettingsLayer>,
) -> Result<Vec<crate::domain::astrology::ComputedAspect>, String> {
    crate::application::workspace::validate_chart_payload(&chart_json)?;
    let chart: crate::workspace::models::ChartInstance =
        serde_json::from_value(chart_json).map_err(|e| format!("Invalid chart payload: {}", e))?;
    let report = crate::workspace::settings::standalone_model_report_with_operation(
        &chart.config,
        settings_overrides.as_ref(),
    );
    Ok(crate::domain::astrology::compute_cross_aspects(
        &transiting_positions,
        &transited_positions,
        &report.model.aspect_definitions,
        &report.effective_settings.aspect_orbs,
        &aspect_types,
    ))
}

async fn compute_chart_from_data_python(
    app: &AppHandle,
    backend_state: &crate::infrastructure::python_sidecar::BackendState,
    chart_json: serde_json::Value,
    settings_overrides: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let payload = serde_json::json!({
        "chart_json": chart_json,
        "settings_overrides": settings_overrides,
    });
    let response = crate::infrastructure::python_sidecar::post_json(
        app,
        backend_state,
        "/charts/compute-from-data",
        &payload,
    )
    .await?;
    serde_json::from_value(response)
        .map_err(|err| format!("Failed to parse backend chart-from-data response: {err}"))
}

/// Compute chart positions and aspects using Python
#[tauri::command]
pub async fn compute_chart(
    app: AppHandle,
    backend_state: State<'_, crate::infrastructure::python_sidecar::BackendState>,
    workspace_path: String,
    chart_id: String,
    preset_id: Option<String>,
    settings_overrides: Option<crate::workspace::settings::SettingsLayer>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let backend = selected_compute_backend();
    let fallback_to_python = crate::application::compute_router::python_fallback_enabled();
    let force_python = chart_requires_python_precision(&workspace_path, &chart_id).unwrap_or(false);
    let backend_available = matches!(
        backend_state.availability()?,
        crate::infrastructure::python_sidecar::BackendAvailability::Available
    );
    let route = select_chart_compute_route(backend, backend_available, force_python)?;
    match route {
        ComputeRoute::Rust => compute_chart_rust(
            &workspace_path,
            &chart_id,
            preset_id.as_deref(),
            settings_overrides.as_ref(),
        ),
        ComputeRoute::Python if matches!(backend, ComputeBackend::Auto) && !force_python => {
            match compute_chart_python(
                &app,
                &backend_state,
                &workspace_path,
                &chart_id,
                preset_id.as_deref(),
                settings_overrides.as_ref(),
            )
            .await
            {
                Ok(result) => Ok(normalize_chart_response(result, Some("python"))),
                Err(_err) if fallback_to_python => Ok(annotate_chart_fallback(
                    compute_chart_rust(
                        &workspace_path,
                        &chart_id,
                        preset_id.as_deref(),
                        settings_overrides.as_ref(),
                    )?,
                    "python_compute_failed_auto_fallback",
                )),
                Err(err) => Err(err),
            }
        }
        ComputeRoute::Python => compute_chart_python(
            &app,
            &backend_state,
            &workspace_path,
            &chart_id,
            preset_id.as_deref(),
            settings_overrides.as_ref(),
        )
        .await
        .map(|result| normalize_chart_response(result, Some("python"))),
    }
}

fn compute_chart_rust(
    workspace_path: &str,
    chart_id: &str,
    preset_id: Option<&str>,
    settings_overrides: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let base = Path::new(workspace_path);
    let manifest = load_workspace_manifest(base)?;
    let chart_rel = find_chart_ref_by_id(base, &manifest, chart_id)?
        .ok_or_else(|| format!("Chart {} not found", chart_id))?;
    let chart = load_chart(base, &chart_rel)?;
    let preset = resolve_settings_preset(base, &manifest, preset_id)?;
    let report = crate::workspace::settings::current_model_report_with_layers(
        &manifest,
        preset.as_ref(),
        Some(&chart.config),
        settings_overrides,
    );
    let request = crate::application::computation::ChartComputeRequest::for_resolved_chart(
        crate::application::computation::ResolvedChart::from_report(chart, report),
    );
    let calculation = crate::application::computation::compute_chart(request)?;
    chart_calculation_to_map(calculation)
}

async fn compute_chart_python(
    app: &AppHandle,
    backend_state: &crate::infrastructure::python_sidecar::BackendState,
    workspace_path: &str,
    chart_id: &str,
    preset_id: Option<&str>,
    settings_overrides: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let payload = serde_json::json!({
        "workspace_path": Path::new(workspace_path)
            .join("workspace.yaml")
            .to_str()
            .ok_or("Invalid workspace manifest path")?,
        "chart_id": chart_id,
        "preset_id": preset_id,
        "settings_overrides": settings_overrides,
    });
    let response = crate::infrastructure::python_sidecar::post_json(
        app,
        backend_state,
        "/charts/compute",
        &payload,
    )
    .await?;
    serde_json::from_value(response)
        .map_err(|err| format!("Failed to parse backend chart response: {err}"))
}

#[cfg(test)]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct RadixAxes {
    asc: f64,
    desc: f64,
    mc: f64,
    ic: f64,
}

fn chart_calculation_to_map(
    calculation: crate::application::computation::ChartCalculation,
) -> Result<HashMap<String, serde_json::Value>, String> {
    match serde_json::to_value(calculation)
        .map_err(|error| format!("Failed to serialize chart calculation: {error}"))?
    {
        serde_json::Value::Object(values) => Ok(values.into_iter().collect()),
        _ => Err("Chart calculation did not serialize as an object".to_string()),
    }
}

#[cfg(test)]
fn compute_radix_axes(
    chart: &crate::workspace::models::ChartInstance,
) -> Result<RadixAxes, String> {
    let backend = crate::infrastructure::astronomy::backend_for_chart(chart);
    let computed = backend.compute_chart_data(chart, Some(&vec!["asc".into(), "mc".into()]))?;
    Ok(RadixAxes {
        asc: computed.axes.asc,
        desc: computed.axes.desc,
        mc: computed.axes.mc,
        ic: computed.axes.ic,
    })
}

#[cfg(test)]
fn compute_house_cusps(
    chart: &crate::workspace::models::ChartInstance,
    _axes: &RadixAxes,
) -> Vec<f64> {
    crate::infrastructure::astronomy::backend_for_chart(chart)
        .compute_chart_data(chart, None)
        .map(|computed| computed.house_cusps)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::{sample_chart_payload, sample_workspace_path};
    use serde_json::Value;

    #[test]
    fn compute_chart_rust_reads_sample_workspace() {
        let workspace_path = sample_workspace_path();
        let base = std::path::Path::new(&workspace_path);
        let manifest =
            load_workspace_manifest(base).expect("sample workspace manifest should load");
        let chart_rel = find_chart_ref_by_id(base, &manifest, "Base Chart")
            .expect("chart lookup should succeed")
            .expect("Base Chart should exist");
        let chart = load_chart(base, &chart_rel).expect("sample chart should load");

        let result = compute_chart_rust(&workspace_path, "Base Chart", None, None)
            .expect("sample workspace chart should compute");

        assert_eq!(
            result.get("chart_id"),
            Some(&serde_json::json!("Base Chart"))
        );
        assert_eq!(
            result.get("backend_used"),
            Some(&serde_json::json!(
                crate::infrastructure::astronomy::backend_for_chart(&chart).backend_id()
            ))
        );
        assert_eq!(result.get("fallback_used"), Some(&serde_json::json!(false)));
        assert!(result.get("ephemeris_source").is_some());

        let warnings = result
            .get("warnings")
            .and_then(Value::as_array)
            .expect("warnings should be an array");
        if crate::infrastructure::astronomy::backend_for_chart(&chart).backend_id() == "jpl" {
            assert!(
                !warnings.iter().any(|warning| {
                    warning.as_str()
                        == Some("true_node_not_available: anise backend uses mean node only")
                }),
                "jpl path should provide true lunar nodes from Moon state"
            );
        } else {
            assert!(
                warnings.is_empty(),
                "swisseph path should not emit jpl-only warnings"
            );
        }

        let positions = result
            .get("positions")
            .and_then(Value::as_object)
            .expect("positions should be an object");
        assert!(positions.contains_key("sun"));
        assert!(positions.contains_key("moon"));
        assert!(positions.contains_key("asc"));
        assert!(positions.contains_key("mc"));

        let moon = result.get("moon_details").expect("moon_details key");
        assert!(
            !moon.is_null(),
            "moon_details should be populated when sun and moon exist"
        );
        let obj = moon.as_object().expect("moon_details object");
        assert!(obj.contains_key("elongation_deg"));
        assert!(obj.contains_key("illuminated_fraction"));
        assert!(obj.contains_key("phase_id"));

        let axes = result
            .get("axes")
            .and_then(Value::as_object)
            .expect("axes should be an object");
        assert!(axes.contains_key("asc"));
        assert!(axes.contains_key("mc"));

        let house_cusps = result
            .get("house_cusps")
            .and_then(Value::as_array)
            .expect("house_cusps should be an array");
        assert_eq!(house_cusps.len(), 12);

        let aspects = result
            .get("aspects")
            .and_then(Value::as_array)
            .expect("aspects should be an array");
        assert!(aspects.iter().all(Value::is_object));
    }

    #[test]
    fn standalone_compute_materializes_resolved_model_defaults() {
        let mut payload = sample_chart_payload("standalone-defaults");
        let config = payload
            .get_mut("config")
            .and_then(Value::as_object_mut)
            .expect("sample chart config should be an object");
        config.insert("house_system".to_string(), Value::Null);
        config.insert("engine".to_string(), Value::Null);
        config.insert("observable_objects".to_string(), Value::Null);
        config.insert("selected_aspects".to_string(), Value::Null);
        config.insert("aspect_orbs".to_string(), serde_json::json!({}));

        let result =
            compute_chart_from_data_rust(payload, None).expect("standalone chart should compute");

        assert_eq!(result.get("backend_used"), Some(&serde_json::json!("jpl")));
        let positions = result
            .get("positions")
            .and_then(Value::as_object)
            .expect("positions should be an object");
        assert!(positions.contains_key("sun"));
        assert!(positions.contains_key("asc"));
        let aspects = result
            .get("aspects")
            .and_then(Value::as_array)
            .expect("aspects should be an array");
        assert!(aspects.iter().all(Value::is_object));
    }

    #[test]
    fn standalone_operation_overrides_are_applied_by_the_resolver() {
        let payload = sample_chart_payload("standalone-operation");
        let overrides = crate::workspace::settings::SettingsLayer {
            bodies: Some(vec!["sun".to_string()]),
            aspects: Some(Vec::new()),
            ..crate::workspace::settings::SettingsLayer::default()
        };

        let result = compute_chart_from_data_rust(payload, Some(&overrides))
            .expect("standalone chart with operation overrides should compute");
        let positions = result
            .get("positions")
            .and_then(Value::as_object)
            .expect("positions should be an object");
        assert_eq!(positions.len(), 1);
        assert!(positions.contains_key("sun"));
        assert_eq!(result.get("aspects"), Some(&serde_json::json!([])));
    }

    #[test]
    fn workspace_chart_preset_is_loaded_and_applied_before_chart_settings() {
        use crate::commands::workspace::create_workspace;
        use crate::test_support::TestWorkspaceDir;
        use std::fs;

        let temp = TestWorkspaceDir::new("chart-preset");
        let workspace_path = temp.path.join("project");
        tauri::async_runtime::block_on(create_workspace(
            workspace_path.to_string_lossy().into_owned(),
            "Preset Tester".to_string(),
        ))
        .expect("workspace should be created");
        let mut persisted_chart = sample_chart_payload("Preset Chart");
        let persisted_config = persisted_chart
            .get_mut("config")
            .and_then(Value::as_object_mut)
            .expect("chart config");
        persisted_config.insert("observable_objects".to_string(), Value::Null);
        persisted_config.insert("selected_aspects".to_string(), Value::Null);
        tauri::async_runtime::block_on(crate::commands::charts::create_chart(
            workspace_path.to_string_lossy().into_owned(),
            persisted_chart,
        ))
        .expect("chart should be created");

        let chart: crate::workspace::models::ChartInstance =
            serde_json::from_value(sample_chart_payload("preset-template"))
                .expect("preset source chart should deserialize");
        let mut preset_config = chart.config;
        preset_config.observable_objects = Some(vec!["sun".to_string()]);
        preset_config.selected_aspects = Some(Vec::new());
        let preset = crate::workspace::models::ChartPreset {
            name: "Minimal".to_string(),
            config: preset_config,
        };
        fs::create_dir_all(workspace_path.join("presets")).expect("preset directory");
        fs::write(
            workspace_path.join("presets/minimal.yml"),
            serde_yaml::to_string(&preset).expect("preset should serialize"),
        )
        .expect("preset should be written");
        let mut manifest = load_workspace_manifest(&workspace_path).expect("manifest should load");
        manifest
            .chart_presets
            .push("presets/minimal.yml".to_string());
        crate::workspace::writer::write_workspace_manifest(&workspace_path, &manifest)
            .expect("manifest should include preset");

        let result = compute_chart_rust(
            workspace_path.to_string_lossy().as_ref(),
            "Preset Chart",
            Some("Minimal"),
            None,
        )
        .expect("chart with preset should compute");
        let positions = result
            .get("positions")
            .and_then(Value::as_object)
            .expect("positions should be an object");

        assert_eq!(positions.len(), 1);
        assert!(positions.contains_key("sun"));
    }

    #[test]
    fn compute_house_cusps_uses_whole_sign_boundaries() {
        let chart = load_chart(
            std::path::Path::new(&sample_workspace_path()),
            "charts/base-chart.yml",
        )
        .expect("sample chart should load");
        let mut whole_sign_chart = chart.clone();
        whole_sign_chart.config.house_system =
            Some(crate::workspace::models::HouseSystem::WholeSign);

        let axes = compute_radix_axes(&whole_sign_chart).expect("axes should compute");
        let cusps = compute_house_cusps(&whole_sign_chart, &axes);

        assert_eq!(cusps.len(), 12);
        let expected_first = (axes.asc / 30.0).floor() * 30.0;
        assert!((cusps[0] - expected_first).abs() < 0.000_1);
        assert!((crate::domain::houses::normalize_deg(cusps[1] - cusps[0]) - 30.0).abs() < 0.000_1);
    }
}
