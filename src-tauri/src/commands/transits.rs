use crate::application::compute_router::{
    annotate_transit_fallback, normalize_transit_response, python_fallback_enabled,
    select_transit_compute_route, selected_compute_backend, ComputeBackend, ComputeRoute,
};
use crate::workspace::loader::{find_chart_ref_by_id, load_chart};
use crate::workspace::writer::{
    sanitize_chart_filename, write_transit_setup, write_workspace_manifest,
};
use crate::workspace::{load_workspace_manifest, TransitSetup};
use std::collections::HashMap;
use std::path::Path;
use tauri::{AppHandle, State};

/// Tauri-facing request shape for one multi-body configuration search — see
/// `application::transit::ConfigurationSearchRequest` for field semantics.
/// A separate `Deserialize`-only type at this boundary so the domain type
/// itself never needs to derive `Deserialize` just to satisfy the Tauri
/// command macro.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct ConfigurationSearchRequestDto {
    pub configuration_id: String,
    #[serde(default)]
    pub fixed_roles: Vec<String>,
    #[serde(default)]
    pub role_candidates: HashMap<String, Vec<String>>,
}

impl ConfigurationSearchRequestDto {
    fn into_domain(self) -> crate::application::transit::ConfigurationSearchRequest {
        crate::application::transit::ConfigurationSearchRequest {
            configuration_id: self.configuration_id,
            fixed_roles: self.fixed_roles,
            role_candidates: self.role_candidates,
        }
    }
}

/// Persist the transit form state for one source chart without storing computed output.
#[tauri::command]
pub async fn save_transit_setup(
    workspace_path: String,
    setup: TransitSetup,
) -> Result<TransitSetup, String> {
    let base = Path::new(&workspace_path);
    let mut manifest = load_workspace_manifest(base)?;
    if setup.version != 1 {
        return Err(format!(
            "Unsupported transit setup version: {}",
            setup.version
        ));
    }
    if setup.source_chart_id.trim().is_empty() {
        return Err("Transit setup source_chart_id cannot be empty".to_string());
    }
    if setup.time_step_seconds == 0 {
        return Err("Transit setup time_step_seconds must be greater than zero".to_string());
    }
    let source_chart_ref = find_chart_ref_by_id(base, &manifest, &setup.source_chart_id)?
        .ok_or_else(|| format!("Transit source chart not found: {}", setup.source_chart_id))?;
    let source_chart = load_chart(base, &source_chart_ref)?;
    let source_report =
        crate::workspace::current_model_report(&manifest, Some(&source_chart.config));
    if let Some(school) = setup.school.as_deref() {
        if !manifest.schools.contains_key(school)
            && source_report.resolved_school.as_deref() != Some(school)
        {
            return Err(format!("Transit setup references unknown school: {school}"));
        }
    }
    if let Some(model) = setup.model.as_deref() {
        if !manifest.models.contains_key(model) && source_report.resolved_model != model {
            return Err(format!("Transit setup references unknown model: {model}"));
        }
    }

    let relative_path = write_transit_setup(base, &setup)?;
    if !manifest.transit_analyses.contains(&relative_path) {
        manifest.transit_analyses.push(relative_path);
        write_workspace_manifest(base, &manifest)?;
    }
    Ok(setup)
}

/// Load the saved transit form state for a source chart, if one exists.
#[tauri::command]
pub async fn load_transit_setup(
    workspace_path: String,
    chart_id: String,
) -> Result<Option<TransitSetup>, String> {
    use std::fs;

    let base = Path::new(&workspace_path);
    let manifest = load_workspace_manifest(base)?;
    if find_chart_ref_by_id(base, &manifest, &chart_id)?.is_none() {
        return Err(format!("Transit source chart not found: {}", chart_id));
    }

    let path = base
        .join("transits")
        .join(format!("{}.yml", sanitize_chart_filename(&chart_id)));
    if !path.is_file() {
        return Ok(None);
    }
    let yaml = fs::read_to_string(&path)
        .map_err(|e| format!("Read transit setup {} failed: {}", path.display(), e))?;
    let setup: TransitSetup = serde_yaml::from_str(&yaml)
        .map_err(|e| format!("Parse transit setup {} failed: {}", path.display(), e))?;
    if setup.version != 1 {
        return Err(format!(
            "Unsupported transit setup version: {}",
            setup.version
        ));
    }
    if setup.source_chart_id != chart_id {
        return Err(format!(
            "Transit setup source chart mismatch: expected {}, found {}",
            chart_id, setup.source_chart_id
        ));
    }
    Ok(Some(setup))
}

/// Compute transit series using Python
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn compute_transit_series(
    app: AppHandle,
    backend_state: State<'_, crate::infrastructure::python_sidecar::BackendState>,
    workspace_path: String,
    chart_id: String,
    start_datetime: String,
    end_datetime: String,
    // `Option`: required only when `sampled_series` is (explicitly or by
    // default) true. A request that only wants `exact_hits`/`station_events`/
    // a configuration search has no use for a graph-sampling step at all.
    time_step_seconds: Option<i64>,
    transiting_objects: Vec<String>,
    transited_objects: Vec<String>,
    aspect_types: Vec<String>,
    // `Option` (not `bool`) so existing callers that predate these flags —
    // neither frontend bridge sends them yet — keep working unchanged,
    // deserializing a missing field as "not requested" rather than failing
    // the whole command.
    exact_hits: Option<bool>,
    station_events: Option<bool>,
    configuration_requests: Option<Vec<ConfigurationSearchRequestDto>>,
    // Defaults to `true` so every existing caller (which always wants the
    // sampled `results` series and never sends this field) keeps working
    // unchanged.
    sampled_series: Option<bool>,
    preset_id: Option<String>,
    settings_overrides: Option<crate::workspace::settings::SettingsLayer>,
) -> Result<serde_json::Value, String> {
    let exact_hits = exact_hits.unwrap_or(false);
    let station_events = station_events.unwrap_or(false);
    let configuration_requests: Vec<crate::application::transit::ConfigurationSearchRequest> =
        configuration_requests
            .unwrap_or_default()
            .into_iter()
            .map(ConfigurationSearchRequestDto::into_domain)
            .collect();
    let sampled_series = sampled_series.unwrap_or(true);

    if !sampled_series {
        return compute_transit_events_only_response(
            &workspace_path,
            &chart_id,
            &start_datetime,
            &end_datetime,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
            exact_hits,
            station_events,
            configuration_requests,
            preset_id.as_deref(),
            settings_overrides.as_ref(),
        );
    }
    let time_step_seconds = time_step_seconds
        .ok_or_else(|| "time_step_seconds is required when sampled_series is true".to_string())?;

    let backend = selected_compute_backend();
    let fallback_to_python = python_fallback_enabled();
    let backend_available = matches!(
        backend_state.availability()?,
        crate::infrastructure::python_sidecar::BackendAvailability::Available
    );

    let route = select_transit_compute_route(backend, backend_available)?;
    match route {
        ComputeRoute::Rust => compute_transit_series_rust(
            &workspace_path,
            &chart_id,
            &start_datetime,
            &end_datetime,
            time_step_seconds,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
            exact_hits,
            station_events,
            configuration_requests,
            preset_id.as_deref(),
            settings_overrides.as_ref(),
        ),
        ComputeRoute::Python if matches!(backend, ComputeBackend::Auto) => {
            match compute_transit_series_python(
                &app,
                &backend_state,
                &workspace_path,
                &chart_id,
                &start_datetime,
                &end_datetime,
                time_step_seconds,
                transiting_objects.clone(),
                transited_objects.clone(),
                aspect_types.clone(),
                preset_id.as_deref(),
                settings_overrides.as_ref(),
            )
            .await
            {
                Ok(result) => {
                    let mut value = normalize_transit_response(result, Some("python"));
                    merge_local_event_search(
                        &mut value,
                        &workspace_path,
                        &chart_id,
                        &start_datetime,
                        &end_datetime,
                        &transiting_objects,
                        &transited_objects,
                        &aspect_types,
                        exact_hits,
                        station_events,
                        configuration_requests.clone(),
                        preset_id.as_deref(),
                        settings_overrides.as_ref(),
                    )?;
                    Ok(value)
                }
                Err(_err) if fallback_to_python => Ok(annotate_transit_fallback(
                    compute_transit_series_rust(
                        &workspace_path,
                        &chart_id,
                        &start_datetime,
                        &end_datetime,
                        time_step_seconds,
                        &transiting_objects,
                        &transited_objects,
                        &aspect_types,
                        exact_hits,
                        station_events,
                        configuration_requests,
                        preset_id.as_deref(),
                        settings_overrides.as_ref(),
                    )?,
                    "python_transit_compute_failed_auto_fallback",
                )),
                Err(err) => Err(err),
            }
        }
        ComputeRoute::Python => {
            let result = compute_transit_series_python(
                &app,
                &backend_state,
                &workspace_path,
                &chart_id,
                &start_datetime,
                &end_datetime,
                time_step_seconds,
                transiting_objects.clone(),
                transited_objects.clone(),
                aspect_types.clone(),
                preset_id.as_deref(),
                settings_overrides.as_ref(),
            )
            .await?;
            let mut value = normalize_transit_response(result, Some("python"));
            merge_local_event_search(
                &mut value,
                &workspace_path,
                &chart_id,
                &start_datetime,
                &end_datetime,
                &transiting_objects,
                &transited_objects,
                &aspect_types,
                exact_hits,
                station_events,
                configuration_requests,
                preset_id.as_deref(),
                settings_overrides.as_ref(),
            )?;
            Ok(value)
        }
    }
}

/// `sampled_series: false` path: skip backend routing entirely (there is no
/// sampled series to compute from either backend) and return just the
/// locally-computed `event_search`, with the response's other fields
/// populated the same way `compute_transit_series_events_only` always does.
#[allow(clippy::too_many_arguments)]
fn compute_transit_events_only_response(
    workspace_path: &str,
    chart_id: &str,
    start_datetime: &str,
    end_datetime: &str,
    transiting_objects: &[String],
    transited_objects: &[String],
    aspect_types: &[String],
    exact_hits: bool,
    station_events: bool,
    configuration_requests: Vec<crate::application::transit::ConfigurationSearchRequest>,
    preset_id: Option<&str>,
    settings_overrides: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<serde_json::Value, String> {
    let start_dt = crate::application::transit::parse_datetime_input(start_datetime)?;
    let end_dt = crate::application::transit::parse_datetime_input(end_datetime)?;
    let resolved_chart = crate::application::chart_resolution::resolve_workspace_chart(
        workspace_path,
        chart_id,
        preset_id,
        settings_overrides,
    )?;
    let series = crate::application::transit::compute_transit_series_events_only(
        resolved_chart.clone(),
        start_dt,
        end_dt,
        transited_objects,
    )?;
    let mut value = serde_json::to_value(series)
        .map_err(|error| format!("Failed to serialize transit calculation: {error}"))?;

    let event_search = if exact_hits || station_events || !configuration_requests.is_empty() {
        crate::application::transit::compute_transit_events(
            crate::application::transit::TransitEventSearchRequest {
                resolved_chart,
                start: start_dt,
                end: end_dt,
                transiting_objects: transiting_objects.to_vec(),
                transited_objects: transited_objects.to_vec(),
                aspect_types: aspect_types.to_vec(),
                exact_hits,
                station_events,
                configuration_requests,
            },
        )?
    } else {
        crate::application::transit::TransitEventSearch {
            events: Vec::new(),
            configuration_matches: Vec::new(),
            complete: true,
            warnings: Vec::new(),
        }
    };
    value["event_search"] = serde_json::to_value(event_search)
        .map_err(|error| format!("Failed to serialize transit event search: {error}"))?;
    Ok(value)
}

/// Exact-event search (`exact_hits` / `station_events`) always runs locally
/// through the Rust event-search module, independently of which backend
/// computed the sampled series — it only needs the resolved chart, not the
/// Python sidecar. Adds (or, for a both-false request, cheaply no-ops into)
/// a `event_search` field on the response alongside the existing sampled
/// `results`, without touching any existing field.
#[allow(clippy::too_many_arguments)]
fn merge_local_event_search(
    value: &mut serde_json::Value,
    workspace_path: &str,
    chart_id: &str,
    start_datetime: &str,
    end_datetime: &str,
    transiting_objects: &[String],
    transited_objects: &[String],
    aspect_types: &[String],
    exact_hits: bool,
    station_events: bool,
    configuration_requests: Vec<crate::application::transit::ConfigurationSearchRequest>,
    preset_id: Option<&str>,
    settings_overrides: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<(), String> {
    let event_search = if exact_hits || station_events || !configuration_requests.is_empty() {
        let start_dt = crate::application::transit::parse_datetime_input(start_datetime)?;
        let end_dt = crate::application::transit::parse_datetime_input(end_datetime)?;
        let resolved_chart = crate::application::chart_resolution::resolve_workspace_chart(
            workspace_path,
            chart_id,
            preset_id,
            settings_overrides,
        )?;
        crate::application::transit::compute_transit_events(
            crate::application::transit::TransitEventSearchRequest {
                resolved_chart,
                start: start_dt,
                end: end_dt,
                transiting_objects: transiting_objects.to_vec(),
                transited_objects: transited_objects.to_vec(),
                aspect_types: aspect_types.to_vec(),
                exact_hits,
                station_events,
                configuration_requests,
            },
        )?
    } else {
        crate::application::transit::TransitEventSearch {
            events: Vec::new(),
            configuration_matches: Vec::new(),
            complete: true,
            warnings: Vec::new(),
        }
    };
    value["event_search"] = serde_json::to_value(event_search)
        .map_err(|error| format!("Failed to serialize transit event search: {error}"))?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn compute_transit_series_rust(
    workspace_path: &str,
    chart_id: &str,
    start_datetime: &str,
    end_datetime: &str,
    time_step_seconds: i64,
    transiting_objects: &[String],
    transited_objects: &[String],
    aspect_types: &[String],
    exact_hits: bool,
    station_events: bool,
    configuration_requests: Vec<crate::application::transit::ConfigurationSearchRequest>,
    preset_id: Option<&str>,
    settings_overrides: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<serde_json::Value, String> {
    if time_step_seconds <= 0 {
        return Err("time_step_seconds must be > 0".to_string());
    }

    let start_dt = crate::application::transit::parse_datetime_input(start_datetime)?;
    let end_dt = crate::application::transit::parse_datetime_input(end_datetime)?;
    let resolved_chart = crate::application::chart_resolution::resolve_workspace_chart(
        workspace_path,
        chart_id,
        preset_id,
        settings_overrides,
    )?;

    let series_request = crate::application::transit::TransitSeriesRequest {
        resolved_chart: resolved_chart.clone(),
        start: start_dt,
        end: end_dt,
        time_step_seconds,
        transiting_objects: transiting_objects.to_vec(),
        transited_objects: transited_objects.to_vec(),
        aspect_types: aspect_types.to_vec(),
    };
    let mut value = serde_json::to_value(crate::application::transit::compute_transit_series(
        series_request,
    )?)
    .map_err(|error| format!("Failed to serialize transit calculation: {error}"))?;

    let event_search = if exact_hits || station_events || !configuration_requests.is_empty() {
        crate::application::transit::compute_transit_events(
            crate::application::transit::TransitEventSearchRequest {
                resolved_chart,
                start: start_dt,
                end: end_dt,
                transiting_objects: transiting_objects.to_vec(),
                transited_objects: transited_objects.to_vec(),
                aspect_types: aspect_types.to_vec(),
                exact_hits,
                station_events,
                configuration_requests,
            },
        )?
    } else {
        crate::application::transit::TransitEventSearch {
            events: Vec::new(),
            configuration_matches: Vec::new(),
            complete: true,
            warnings: Vec::new(),
        }
    };
    value["event_search"] = serde_json::to_value(event_search)
        .map_err(|error| format!("Failed to serialize transit event search: {error}"))?;

    Ok(value)
}

/// Compute a transit series from in-memory chart data (no workspace on disk) — the
/// `compute_transit_series` counterpart to `compute_chart_from_data`. Rust-native engine only for
/// now; there is no "from data" Python-sidecar endpoint, so this never routes to Python.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn compute_transit_series_from_data(
    chart_json: serde_json::Value,
    start_datetime: String,
    end_datetime: String,
    time_step_seconds: Option<i64>,
    transiting_objects: Vec<String>,
    transited_objects: Vec<String>,
    aspect_types: Vec<String>,
    // `Option` for the same backward-compatibility reason as
    // `compute_transit_series` above.
    exact_hits: Option<bool>,
    station_events: Option<bool>,
    configuration_requests: Option<Vec<ConfigurationSearchRequestDto>>,
    sampled_series: Option<bool>,
    settings_overrides: Option<crate::workspace::settings::SettingsLayer>,
) -> Result<serde_json::Value, String> {
    let exact_hits = exact_hits.unwrap_or(false);
    let station_events = station_events.unwrap_or(false);
    let configuration_requests: Vec<crate::application::transit::ConfigurationSearchRequest> =
        configuration_requests
            .unwrap_or_default()
            .into_iter()
            .map(ConfigurationSearchRequestDto::into_domain)
            .collect();
    let sampled_series = sampled_series.unwrap_or(true);

    let start_dt = crate::application::transit::parse_datetime_input(&start_datetime)?;
    let end_dt = crate::application::transit::parse_datetime_input(&end_datetime)?;
    let resolved_chart = crate::application::chart_resolution::resolve_standalone_chart(
        &chart_json,
        settings_overrides.as_ref(),
    )?;

    let mut value = if sampled_series {
        let time_step_seconds = time_step_seconds.ok_or_else(|| {
            "time_step_seconds is required when sampled_series is true".to_string()
        })?;
        if time_step_seconds <= 0 {
            return Err("time_step_seconds must be > 0".to_string());
        }
        let series_request = crate::application::transit::TransitSeriesRequest {
            resolved_chart: resolved_chart.clone(),
            start: start_dt,
            end: end_dt,
            time_step_seconds,
            transiting_objects: transiting_objects.clone(),
            transited_objects: transited_objects.clone(),
            aspect_types: aspect_types.clone(),
        };
        serde_json::to_value(crate::application::transit::compute_transit_series(
            series_request,
        )?)
        .map_err(|error| format!("Failed to serialize transit calculation: {error}"))?
    } else {
        let series = crate::application::transit::compute_transit_series_events_only(
            resolved_chart.clone(),
            start_dt,
            end_dt,
            &transited_objects,
        )?;
        serde_json::to_value(series)
            .map_err(|error| format!("Failed to serialize transit calculation: {error}"))?
    };

    let event_search = if exact_hits || station_events || !configuration_requests.is_empty() {
        crate::application::transit::compute_transit_events(
            crate::application::transit::TransitEventSearchRequest {
                resolved_chart,
                start: start_dt,
                end: end_dt,
                transiting_objects,
                transited_objects,
                aspect_types,
                exact_hits,
                station_events,
                configuration_requests,
            },
        )?
    } else {
        crate::application::transit::TransitEventSearch {
            events: Vec::new(),
            configuration_matches: Vec::new(),
            complete: true,
            warnings: Vec::new(),
        }
    };
    value["event_search"] = serde_json::to_value(event_search)
        .map_err(|error| format!("Failed to serialize transit event search: {error}"))?;

    Ok(value)
}

#[allow(clippy::too_many_arguments)]
async fn compute_transit_series_python(
    app: &AppHandle,
    backend_state: &crate::infrastructure::python_sidecar::BackendState,
    workspace_path: &str,
    chart_id: &str,
    start_datetime: &str,
    end_datetime: &str,
    time_step_seconds: i64,
    transiting_objects: Vec<String>,
    transited_objects: Vec<String>,
    aspect_types: Vec<String>,
    preset_id: Option<&str>,
    settings_overrides: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "workspace_path": Path::new(workspace_path)
            .join("workspace.yaml")
            .to_str()
            .ok_or("Invalid workspace manifest path")?,
        "source_chart_id": chart_id,
        "start_datetime": start_datetime,
        "end_datetime": end_datetime,
        "time_step": format!("{time_step_seconds} seconds"),
        "transiting_objects": transiting_objects,
        "transited_objects": transited_objects,
        "aspect_types": aspect_types,
        "preset_id": preset_id,
        "settings_overrides": settings_overrides,
    });
    crate::infrastructure::python_sidecar::post_json(
        app,
        backend_state,
        "/transits/compute-series",
        &payload,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::charts::create_chart;
    use crate::commands::workspace::create_workspace;
    use crate::test_support::{sample_chart_payload, sample_workspace_path, TestWorkspaceDir};
    use serde_json::Value;
    use std::collections::HashMap;

    #[test]
    fn compute_transit_series_rust_positions_actually_advance_over_time() {
        // Regression guard: a transit series must sample *different* instants, not silently
        // recompute the same moment N times (which would make every curve look flat/"stale"
        // regardless of how fast the body actually moves).
        let workspace_path = sample_workspace_path();

        let transiting_objects = vec!["sun".to_string(), "jupiter".to_string()];
        let transited_objects = vec!["moon".to_string()];
        let aspect_types = vec!["conjunction".to_string()];

        let result = compute_transit_series_rust(
            &workspace_path,
            "Base Chart",
            "2024-01-01T00:00:00Z",
            "2024-01-15T00:00:00Z",
            86_400,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
            false,
            false,
            Vec::new(),
            None,
            None,
        )
        .expect("sample transit series should compute");

        let results = result
            .get("results")
            .and_then(Value::as_array)
            .expect("results should be an array");
        assert_eq!(
            results.len(),
            15,
            "one sample per day over 14 days inclusive"
        );

        let longitude_at = |entry: &Value, body: &str| -> f64 {
            entry
                .get("transit_positions")
                .and_then(Value::as_object)
                .and_then(|positions| positions.get(body))
                .and_then(Value::as_f64)
                .unwrap_or_else(|| panic!("{body} position missing from entry"))
        };

        let first = &results[0];
        let last = &results[results.len() - 1];

        // The Sun moves ~1°/day — unmistakable over two weeks even allowing for the 0°/360° wrap.
        let sun_delta =
            (longitude_at(last, "sun") - longitude_at(first, "sun") + 540.0) % 360.0 - 180.0;
        assert!(
            sun_delta.abs() > 5.0,
            "sun should have moved several degrees over 14 days, moved {sun_delta}"
        );

        // Jupiter moves slowly (~0.08°/day) but 14 days is still unambiguously non-zero motion —
        // if this were ~0.0, the series would be recomputing one frozen instant.
        let jupiter_delta =
            (longitude_at(last, "jupiter") - longitude_at(first, "jupiter") + 540.0) % 360.0
                - 180.0;
        assert!(
            jupiter_delta.abs() > 0.01,
            "jupiter should have moved measurably over 14 days, moved {jupiter_delta}"
        );

        // No two consecutive samples should be bit-for-bit identical.
        for window in results.windows(2) {
            let a = longitude_at(&window[0], "sun");
            let b = longitude_at(&window[1], "sun");
            assert!(
                a != b,
                "consecutive daily samples produced the same sun longitude ({a})"
            );
        }
    }

    #[test]
    fn compute_transit_series_rust_applies_requested_filters() {
        let workspace_path = sample_workspace_path();
        let base = std::path::Path::new(&workspace_path);
        let manifest =
            load_workspace_manifest(base).expect("sample workspace manifest should load");
        let chart_rel = find_chart_ref_by_id(base, &manifest, "Base Chart")
            .expect("chart lookup should succeed")
            .expect("Base Chart should exist");
        let chart = load_chart(base, &chart_rel).expect("sample chart should load");

        let transiting_objects = vec!["sun".to_string()];
        let transited_objects = vec!["moon".to_string()];
        let aspect_types = vec!["square".to_string()];

        let result = compute_transit_series_rust(
            &workspace_path,
            "Base Chart",
            "2024-01-01T00:00:00Z",
            "2024-01-01T02:00:00Z",
            3600,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
            false,
            false,
            Vec::new(),
            None,
            None,
        )
        .expect("sample transit series should compute");

        let results = result
            .get("results")
            .and_then(Value::as_array)
            .expect("results should be an array");
        assert_eq!(results.len(), 3);
        assert_eq!(
            result.get("backend_used"),
            Some(&serde_json::json!(
                crate::infrastructure::position_provider::backend_for_chart(&chart).backend_id()
            ))
        );
        assert_eq!(result.get("fallback_used"), Some(&serde_json::json!(false)));
        assert!(result.get("ephemeris_source").is_some());
        let mut expected_warnings =
            crate::workspace::current_model_report(&manifest, Some(&chart.config)).warnings;
        // The Rust JPL backend always discloses its UT1-as-UTC sidereal-time
        // approximation (no bundled EOP/ΔUT1 table); `extend_unique` folds the
        // identical warning from the radix and every transit step into one
        // entry. See the astronomy coordinate contract's time-pipeline section.
        if result.get("backend_used") == Some(&serde_json::json!("jpl")) {
            expected_warnings.push(
                "ut1_approximated_from_utc: no EOP/ΔUT1 data loaded; sidereal quantities are approximate"
                    .to_string(),
            );
        }
        assert_eq!(
            result.get("warnings"),
            Some(&serde_json::json!(expected_warnings))
        );

        for entry in results {
            let positions = entry
                .get("transit_positions")
                .and_then(Value::as_object)
                .expect("transit_positions should be an object");
            assert_eq!(positions.len(), 1);
            assert!(positions.contains_key("sun"));

            let aspects = entry
                .get("aspects")
                .and_then(Value::as_array)
                .expect("aspects should be an array");
            for aspect in aspects {
                assert_eq!(aspect.get("type"), Some(&serde_json::json!("square")));
                assert_eq!(aspect.get("from"), Some(&serde_json::json!("sun")));
                assert_eq!(aspect.get("to"), Some(&serde_json::json!("moon")));
            }
        }
    }

    #[test]
    fn compute_transit_series_rust_omits_events_when_both_flags_are_false() {
        let workspace_path = sample_workspace_path();
        let transiting_objects = vec!["mercury".to_string()];
        let transited_objects = vec!["sun".to_string()];
        let aspect_types = vec!["conjunction".to_string()];

        let result = compute_transit_series_rust(
            &workspace_path,
            "Base Chart",
            "2024-01-01T00:00:00Z",
            "2024-01-15T00:00:00Z",
            86_400,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
            false,
            false,
            Vec::new(),
            None,
            None,
        )
        .expect("sample transit series should compute");

        let event_search = result
            .get("event_search")
            .expect("event_search field must always be present, even when both flags are false");
        assert_eq!(
            event_search.get("events"),
            Some(&serde_json::json!(Vec::<serde_json::Value>::new()))
        );
        assert_eq!(event_search.get("complete"), Some(&serde_json::json!(true)));
        assert_eq!(
            event_search.get("warnings"),
            Some(&serde_json::json!(Vec::<String>::new()))
        );
        // The sampled series itself must be entirely unaffected by the new flags.
        let results = result
            .get("results")
            .and_then(Value::as_array)
            .expect("results should be an array");
        assert_eq!(results.len(), 15);
    }

    #[test]
    fn compute_transit_series_rust_includes_typed_events_when_flags_are_set() {
        let workspace_path = sample_workspace_path();
        let transiting_objects = vec!["mercury".to_string()];
        let transited_objects = vec!["sun".to_string()];
        let aspect_types = vec!["conjunction".to_string()];

        let result = compute_transit_series_rust(
            &workspace_path,
            "Base Chart",
            "2024-01-01T00:00:00Z",
            "2024-12-31T00:00:00Z",
            // A deliberately coarse graph-sampling step: the event search
            // must still find real root-found instants, not samples rounded
            // to this step.
            30 * 86_400,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
            true,
            true,
            Vec::new(),
            None,
            None,
        )
        .expect("sample transit series should compute");

        let event_search = result
            .get("event_search")
            .expect("event_search field should be present");
        assert_eq!(event_search.get("complete"), Some(&serde_json::json!(true)));
        let events = event_search
            .get("events")
            .and_then(Value::as_array)
            .expect("events should be an array");
        assert!(
            !events.is_empty(),
            "expected both aspect-hit and station events for Mercury vs the natal Sun over a year"
        );

        // The sampled series must still use the requested (coarse) step,
        // confirming `time_step_seconds` was not silently redefined as
        // event-time precision.
        let results = result
            .get("results")
            .and_then(Value::as_array)
            .expect("results should be an array");
        assert_eq!(results.len(), 13, "one sample per 30-day step over a year");
        let sampled_datetimes: std::collections::HashSet<&str> = results
            .iter()
            .filter_map(|entry| entry.get("datetime").and_then(Value::as_str))
            .collect();

        let mut saw_aspect_hit = false;
        let mut saw_station = false;
        for event in events {
            let datetime_str = event
                .get("datetime")
                .and_then(Value::as_str)
                .expect("event datetime should be a string");
            crate::application::transit::parse_datetime_input(datetime_str)
                .expect("event datetime should parse");
            // An event's time must be a real root-found instant, never
            // rounded onto one of the coarse 30-day graph samples.
            assert!(
                !sampled_datetimes.contains(datetime_str),
                "event at {datetime_str} exactly matches a coarse graph sample timestamp"
            );
            assert!(
                event.get("motion").is_some(),
                "event should carry motion data"
            );
            match event.get("kind").and_then(Value::as_str) {
                Some("aspect_hit") => saw_aspect_hit = true,
                Some("station") => saw_station = true,
                other => panic!("unexpected event kind: {other:?}"),
            }
        }
        assert!(saw_aspect_hit, "expected at least one aspect_hit event");
        assert!(saw_station, "expected at least one station event");
    }

    #[test]
    fn compute_transit_series_rust_includes_configuration_matches_when_requested() {
        let workspace_path = sample_workspace_path();
        // The real Mars-Jupiter-Saturn Grand Trine window located
        // empirically in `application::configuration_search`'s own tests
        // (around late October 2025).
        let transiting_objects = vec![
            "mars".to_string(),
            "jupiter".to_string(),
            "saturn".to_string(),
        ];
        let transited_objects = vec!["sun".to_string()];
        let aspect_types = vec!["conjunction".to_string()];
        let configuration_requests =
            vec![crate::application::transit::ConfigurationSearchRequest {
                configuration_id: "grand_trine".to_string(),
                fixed_roles: Vec::new(),
                role_candidates: HashMap::new(),
            }];

        let result = compute_transit_series_rust(
            &workspace_path,
            "Base Chart",
            "2025-09-01T00:00:00Z",
            "2025-12-01T00:00:00Z",
            30 * 86_400,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
            false,
            false,
            configuration_requests,
            None,
            None,
        )
        .expect("sample transit series should compute");

        let event_search = result
            .get("event_search")
            .expect("event_search field should be present");
        assert_eq!(event_search.get("complete"), Some(&serde_json::json!(true)));
        let matches = event_search
            .get("configuration_matches")
            .and_then(Value::as_array)
            .expect("configuration_matches should be an array");
        assert!(
            !matches.is_empty(),
            "expected the real Mars-Jupiter-Saturn Grand Trine to be found through the command layer"
        );
        let first = &matches[0];
        assert_eq!(
            first.get("configuration_id"),
            Some(&serde_json::json!("grand_trine"))
        );
        let participants = first
            .get("participants")
            .and_then(Value::as_array)
            .expect("participants should be an array");
        assert_eq!(participants.len(), 3);
    }

    #[test]
    fn compute_transit_series_rust_without_configuration_requests_omits_matches() {
        let workspace_path = sample_workspace_path();
        let transiting_objects = vec!["mercury".to_string()];
        let transited_objects = vec!["sun".to_string()];
        let aspect_types = vec!["conjunction".to_string()];

        let result = compute_transit_series_rust(
            &workspace_path,
            "Base Chart",
            "2024-01-01T00:00:00Z",
            "2024-01-15T00:00:00Z",
            86_400,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
            false,
            false,
            Vec::new(),
            None,
            None,
        )
        .expect("sample transit series should compute");

        let event_search = result
            .get("event_search")
            .expect("event_search field should be present");
        assert_eq!(
            event_search.get("configuration_matches"),
            Some(&serde_json::json!(Vec::<serde_json::Value>::new()))
        );
    }

    #[test]
    fn compute_transit_events_only_response_skips_sampled_series_but_computes_events() {
        let workspace_path = sample_workspace_path();
        let transiting_objects = vec!["mercury".to_string()];
        let transited_objects = vec!["sun".to_string()];
        let aspect_types = vec!["conjunction".to_string()];

        let result = compute_transit_events_only_response(
            &workspace_path,
            "Base Chart",
            "2024-01-01T00:00:00Z",
            "2024-12-31T00:00:00Z",
            &transiting_objects,
            &transited_objects,
            &aspect_types,
            false,
            true,
            Vec::new(),
            None,
            None,
        )
        .expect("events-only response should compute");

        assert_eq!(
            result.get("results"),
            Some(&serde_json::json!(Vec::<serde_json::Value>::new())),
            "sampled_series=false must never compute the sampled loop"
        );
        assert_eq!(result.get("time_step"), Some(&serde_json::json!("n/a")));
        assert!(result.get("backend_used").is_some());
        let event_search = result
            .get("event_search")
            .expect("event_search field should be present");
        let events = event_search
            .get("events")
            .and_then(Value::as_array)
            .expect("events should be an array");
        assert!(
            !events.is_empty(),
            "expected Mercury station events even with no sampled series requested"
        );
    }

    #[test]
    fn transit_setup_round_trips_without_computed_results() {
        let temp = TestWorkspaceDir::new("transit-setup");
        let workspace_path = temp.path.join("project");
        let workspace_path_string = workspace_path.to_string_lossy().into_owned();

        tauri::async_runtime::block_on(create_workspace(
            workspace_path_string.clone(),
            "Tester".to_string(),
        ))
        .expect("workspace should be created");
        tauri::async_runtime::block_on(create_chart(
            workspace_path_string.clone(),
            sample_chart_payload("Transit Source"),
        ))
        .expect("chart should be created");

        let setup = TransitSetup {
            version: 1,
            source_chart_id: "Transit Source".to_string(),
            transit_type: "transit".to_string(),
            period_mode: "custom".to_string(),
            from_date: "2026-08-27".to_string(),
            from_time: "10:15".to_string(),
            to_date: "2026-08-28".to_string(),
            to_time: "11:30".to_string(),
            time_step_seconds: 3600,
            transiting_bodies: vec!["sun".to_string(), "moon".to_string()],
            transited_bodies: vec!["saturn".to_string()],
            aspect_types: vec!["conjunction".to_string(), "square".to_string()],
            aspect_orbs: HashMap::from([("square".to_string(), 4.0)]),
            school: None,
            model: None,
            model_overrides: None,
            house_transitions: false,
            sign_transitions: true,
            exact_hits: true,
            station_events: true,
            sampled_series: true,
            configuration_requests: vec![crate::workspace::models::ConfigurationSearchSetup {
                configuration_id: "grand_trine".to_string(),
                fixed_roles: Vec::new(),
                role_candidates: HashMap::new(),
            }],
            transit_limits: false,
            precession_correction: true,
        };

        let saved = tauri::async_runtime::block_on(save_transit_setup(
            workspace_path_string.clone(),
            setup.clone(),
        ))
        .expect("transit setup should save");
        assert_eq!(saved, setup);
        assert!(workspace_path.join("transits/Transit_Source.yml").is_file());
        let manifest =
            load_workspace_manifest(&workspace_path).expect("transit reference should load");
        assert_eq!(
            manifest.transit_analyses,
            vec!["transits/Transit_Source.yml".to_string()]
        );

        let loaded = tauri::async_runtime::block_on(load_transit_setup(
            workspace_path_string.clone(),
            "Transit Source".to_string(),
        ))
        .expect("transit setup should load");
        assert_eq!(loaded, Some(setup));

        tauri::async_runtime::block_on(crate::commands::charts::delete_chart(
            workspace_path_string,
            "Transit Source".to_string(),
        ))
        .expect("chart should be deleted");
        assert!(!workspace_path.join("transits/Transit_Source.yml").exists());
    }

    #[test]
    fn load_transit_setup_defaults_exact_hits_and_station_events_for_a_pre_existing_file() {
        // A hand-written YAML file with no `exact_hits`/`station_events`/
        // `sampled_series`/`configuration_requests` keys at all -- standing
        // in for a setup saved before any of these fields existed, never a
        // setup this codebase itself wrote. `#[serde(default...)]` on every
        // one of them must make this load cleanly (`false`/`false`/`true`/
        // empty), not fail or panic -- `sampled_series` specifically must
        // default to `true` (not `false`, unlike the others), since an old
        // setup always computed the sampled series unconditionally.
        let temp = TestWorkspaceDir::new("transit-setup-pre-existing");
        let workspace_path = temp.path.join("project");
        let workspace_path_string = workspace_path.to_string_lossy().into_owned();

        tauri::async_runtime::block_on(create_workspace(
            workspace_path_string.clone(),
            "Tester".to_string(),
        ))
        .expect("workspace should be created");
        tauri::async_runtime::block_on(create_chart(
            workspace_path_string.clone(),
            sample_chart_payload("Old Setup"),
        ))
        .expect("chart should be created");

        let transits_dir = workspace_path.join("transits");
        std::fs::create_dir_all(&transits_dir).expect("transits dir should create");
        std::fs::write(
            transits_dir.join("Old_Setup.yml"),
            r#"version: 1
source_chart_id: "Old Setup"
transit_type: transit
period_mode: custom
from_date: "2024-01-01"
from_time: "00:00"
to_date: "2024-01-02"
to_time: "00:00"
time_step_seconds: 3600
transiting_bodies: [sun]
transited_bodies: [moon]
aspect_types: [conjunction]
house_transitions: false
sign_transitions: false
transit_limits: false
precession_correction: false
"#,
        )
        .expect("pre-existing transit setup file should write");

        let loaded = tauri::async_runtime::block_on(load_transit_setup(
            workspace_path_string,
            "Old Setup".to_string(),
        ))
        .expect("a pre-existing setup file missing exact_hits/station_events should still load")
        .expect("setup should be found");

        assert!(!loaded.exact_hits);
        assert!(!loaded.station_events);
        assert!(
            loaded.sampled_series,
            "an old setup must still compute the sampled series by default"
        );
        assert!(loaded.configuration_requests.is_empty());
        assert_eq!(loaded.transiting_bodies, vec!["sun".to_string()]);
    }

    /// Nearest-rank p50/p95 over `samples`. With a small sample count the
    /// p95 index collapses toward (or onto) the maximum — report `n`
    /// alongside these numbers rather than presenting them as a
    /// statistically robust percentile on their own.
    fn percentiles(
        mut samples: Vec<std::time::Duration>,
    ) -> (std::time::Duration, std::time::Duration) {
        samples.sort_unstable();
        let p50 = samples[samples.len() / 2];
        let p95 = samples[(samples.len() * 95 / 100).min(samples.len() - 1)];
        (p50, p95)
    }

    /// Representative dense single-body series: 10,000 hourly epochs, one
    /// transiting body against one natal point, through the full
    /// `compute_transit_series_rust` application path (workspace load,
    /// settings resolution, per-step position + cross-aspect detection) —
    /// not just a raw position-evaluation loop. Verifies the requested body
    /// actually resolves at every step rather than only timing the call.
    /// Run with: `cargo test --release --lib dense_single_body_transit_series_benchmark -- --ignored --nocapture`
    #[test]
    #[ignore = "diagnostic benchmark; run manually on the target machine"]
    fn dense_single_body_transit_series_benchmark() {
        use std::time::Instant;

        const EPOCHS: i64 = 10_000;
        const STEP_SECONDS: i64 = 3600;
        // 20, not 5: with n=5 the "p95" index collapses to the sample maximum,
        // which is not a meaningful tail estimate (see ephemeris-validation.md).
        const REPETITIONS: u32 = 20;

        let workspace_path = sample_workspace_path();
        let transiting_objects = vec!["mercury".to_string()];
        let transited_objects = vec!["sun".to_string()];
        let aspect_types = vec!["conjunction".to_string()];
        let start_dt = crate::application::transit::parse_datetime_input("2024-01-01T00:00:00Z")
            .expect("start should parse");
        let end_dt = start_dt + chrono::Duration::seconds((EPOCHS - 1) * STEP_SECONDS);

        // Warm-up: exclude workspace/manifest parsing and almanac construction
        // from the timed samples below.
        compute_transit_series_rust(
            &workspace_path,
            "Base Chart",
            &start_dt.to_rfc3339(),
            &end_dt.to_rfc3339(),
            STEP_SECONDS,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
            false,
            false,
            Vec::new(),
            None,
            None,
        )
        .expect("warm-up run should succeed");

        let mut samples = Vec::with_capacity(REPETITIONS as usize);
        for _ in 0..REPETITIONS {
            let run_start = Instant::now();
            let result = compute_transit_series_rust(
                &workspace_path,
                "Base Chart",
                &start_dt.to_rfc3339(),
                &end_dt.to_rfc3339(),
                STEP_SECONDS,
                &transiting_objects,
                &transited_objects,
                &aspect_types,
                false,
                false,
                Vec::new(),
                None,
                None,
            )
            .expect("dense series should compute");
            let elapsed = run_start.elapsed();

            let results = result
                .get("results")
                .and_then(Value::as_array)
                .expect("results should be an array");
            assert_eq!(
                results.len() as i64,
                EPOCHS,
                "expected every requested epoch"
            );
            assert!(
                results.iter().all(|entry| entry
                    .get("transit_positions")
                    .and_then(Value::as_object)
                    .is_some_and(|positions| positions.contains_key("mercury"))),
                "every epoch must resolve the requested body, not just time the call"
            );

            samples.push(elapsed);
        }

        let (p50, p95) = percentiles(samples.clone());
        let total: std::time::Duration = samples.iter().sum();
        let throughput = EPOCHS as f64 * REPETITIONS as f64 / total.as_secs_f64();
        println!(
            "dense single-body transit series benchmark: epochs={EPOCHS}, step={STEP_SECONDS}s, \
             repetitions={REPETITIONS}, p50={p50:?}, p95={p95:?}, throughput={throughput:.1} epochs/s"
        );
    }

    /// Representative multi-body series: an explicit 1,000-epoch, daily-step
    /// range with the full classical-planet transiting set (10 bodies) and
    /// the full default aspect set against two natal points — through the
    /// same application path as the single-body benchmark above, so the two
    /// numbers are directly comparable (cost scaling with body count).
    /// Run with: `cargo test --release --lib multi_body_transit_series_benchmark -- --ignored --nocapture`
    #[test]
    #[ignore = "diagnostic benchmark; run manually on the target machine"]
    fn multi_body_transit_series_benchmark() {
        use std::time::Instant;

        const EPOCHS: i64 = 1_000;
        const STEP_SECONDS: i64 = 86_400;
        // See the single-body benchmark above for why this is 20, not 5.
        const REPETITIONS: u32 = 20;

        let workspace_path = sample_workspace_path();
        let transiting_objects: Vec<String> = [
            "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
            "pluto",
        ]
        .into_iter()
        .map(str::to_string)
        .collect();
        let transited_objects = vec!["sun".to_string(), "moon".to_string()];
        let aspect_types: Vec<String> = [
            "conjunction",
            "sextile",
            "square",
            "trine",
            "opposition",
            "quincunx",
        ]
        .into_iter()
        .map(str::to_string)
        .collect();

        let start_dt = crate::application::transit::parse_datetime_input("2024-01-01T00:00:00Z")
            .expect("start should parse");
        let end_dt = start_dt + chrono::Duration::seconds((EPOCHS - 1) * STEP_SECONDS);

        compute_transit_series_rust(
            &workspace_path,
            "Base Chart",
            &start_dt.to_rfc3339(),
            &end_dt.to_rfc3339(),
            STEP_SECONDS,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
            false,
            false,
            Vec::new(),
            None,
            None,
        )
        .expect("warm-up run should succeed");

        let mut samples = Vec::with_capacity(REPETITIONS as usize);
        let mut last_results_len = 0usize;
        for _ in 0..REPETITIONS {
            let run_start = Instant::now();
            let result = compute_transit_series_rust(
                &workspace_path,
                "Base Chart",
                &start_dt.to_rfc3339(),
                &end_dt.to_rfc3339(),
                STEP_SECONDS,
                &transiting_objects,
                &transited_objects,
                &aspect_types,
                false,
                false,
                Vec::new(),
                None,
                None,
            )
            .expect("multi-body series should compute");
            let elapsed = run_start.elapsed();

            let results = result
                .get("results")
                .and_then(Value::as_array)
                .expect("results should be an array");
            assert_eq!(results.len() as i64, EPOCHS);
            assert!(
                results.iter().all(|entry| {
                    entry
                        .get("transit_positions")
                        .and_then(Value::as_object)
                        .is_some_and(|positions| {
                            transiting_objects
                                .iter()
                                .all(|id| positions.contains_key(id))
                        })
                }),
                "every epoch must resolve every requested body"
            );
            last_results_len = results.len();

            samples.push(elapsed);
        }

        let (p50, p95) = percentiles(samples.clone());
        let total: std::time::Duration = samples.iter().sum();
        let throughput = EPOCHS as f64 * REPETITIONS as f64 / total.as_secs_f64();
        println!(
            "multi-body transit series benchmark: epochs={EPOCHS} (verified {last_results_len}), \
             bodies={}, step={STEP_SECONDS}s, repetitions={REPETITIONS}, p50={p50:?}, p95={p95:?}, \
             throughput={throughput:.1} epochs/s",
            transiting_objects.len()
        );
    }
}
