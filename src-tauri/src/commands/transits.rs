use crate::application::compute_router::{
    annotate_transit_fallback, normalize_transit_response, python_fallback_enabled,
    select_transit_compute_route, selected_compute_backend, ComputeBackend, ComputeRoute,
};
use crate::workspace::loader::{find_chart_ref_by_id, load_chart};
use crate::workspace::writer::{
    sanitize_chart_filename, write_transit_setup, write_workspace_manifest,
};
use crate::workspace::{load_workspace_manifest, TransitSetup};
use std::path::Path;
use tauri::{AppHandle, State};

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
    time_step_seconds: i64,
    transiting_objects: Vec<String>,
    transited_objects: Vec<String>,
    aspect_types: Vec<String>,
    preset_id: Option<String>,
    settings_overrides: Option<crate::workspace::settings::SettingsLayer>,
) -> Result<serde_json::Value, String> {
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
                Ok(result) => Ok(normalize_transit_response(result, Some("python"))),
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
                        preset_id.as_deref(),
                        settings_overrides.as_ref(),
                    )?,
                    "python_transit_compute_failed_auto_fallback",
                )),
                Err(err) => Err(err),
            }
        }
        ComputeRoute::Python => compute_transit_series_python(
            &app,
            &backend_state,
            &workspace_path,
            &chart_id,
            &start_datetime,
            &end_datetime,
            time_step_seconds,
            transiting_objects,
            transited_objects,
            aspect_types,
            preset_id.as_deref(),
            settings_overrides.as_ref(),
        )
        .await
        .map(|result| normalize_transit_response(result, Some("python"))),
    }
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
    preset_id: Option<&str>,
    settings_overrides: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<serde_json::Value, String> {
    if time_step_seconds <= 0 {
        return Err("time_step_seconds must be > 0".to_string());
    }

    let start_dt = crate::application::transit::parse_datetime_input(start_datetime)?;
    let end_dt = crate::application::transit::parse_datetime_input(end_datetime)?;

    let request = crate::application::transit::TransitSeriesRequest {
        resolved_chart: crate::application::chart_resolution::resolve_workspace_chart(
            workspace_path,
            chart_id,
            preset_id,
            settings_overrides,
        )?,
        start: start_dt,
        end: end_dt,
        time_step_seconds,
        transiting_objects: transiting_objects.to_vec(),
        transited_objects: transited_objects.to_vec(),
        aspect_types: aspect_types.to_vec(),
    };
    serde_json::to_value(crate::application::transit::compute_transit_series(
        request,
    )?)
    .map_err(|error| format!("Failed to serialize transit calculation: {error}"))
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
    time_step_seconds: i64,
    transiting_objects: Vec<String>,
    transited_objects: Vec<String>,
    aspect_types: Vec<String>,
    settings_overrides: Option<crate::workspace::settings::SettingsLayer>,
) -> Result<serde_json::Value, String> {
    if time_step_seconds <= 0 {
        return Err("time_step_seconds must be > 0".to_string());
    }
    let start_dt = crate::application::transit::parse_datetime_input(&start_datetime)?;
    let end_dt = crate::application::transit::parse_datetime_input(&end_datetime)?;

    let request = crate::application::transit::TransitSeriesRequest {
        resolved_chart: crate::application::chart_resolution::resolve_standalone_chart(
            &chart_json,
            settings_overrides.as_ref(),
        )?,
        start: start_dt,
        end: end_dt,
        time_step_seconds,
        transiting_objects,
        transited_objects,
        aspect_types,
    };
    serde_json::to_value(crate::application::transit::compute_transit_series(
        request,
    )?)
    .map_err(|error| format!("Failed to serialize transit calculation: {error}"))
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
