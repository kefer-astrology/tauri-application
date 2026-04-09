use crate::workspace::loader::load_chart;
use crate::workspace::{
    chart_to_summary, load_all_charts, load_workspace_manifest, ChartSummary, WorkspaceInfo,
};
use chrono::{DateTime, Duration, NaiveDate, NaiveDateTime, Utc};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, State};

/// Open a folder dialog and return the selected path
#[tauri::command]
pub async fn open_folder_dialog() -> Result<Option<String>, String> {
    // Use native file dialog via system command
    // This is a simple cross-platform approach
    #[cfg(target_os = "windows")]
    {
        // Windows: use PowerShell
        let output = Command::new("powershell")
            .args(&[
                "-NoProfile",
                "-Command",
                "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; if ($dialog.ShowDialog() -eq 'OK') { $dialog.SelectedPath }"
            ])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if path.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(path))
                }
            }
            _ => Ok(None),
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: use osascript
        let script = r#"tell application "System Events"
    activate
    set folderPath to choose folder with prompt "Select Workspace Folder"
    return POSIX path of folderPath
end tell"#;

        let output = Command::new("osascript").arg("-e").arg(script).output();

        match output {
            Ok(out) if out.status.success() => {
                let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if path.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(path))
                }
            }
            _ => Ok(None),
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: try zenity, kdialog, or yad
        let commands = vec![
            (
                "zenity",
                vec![
                    "--file-selection",
                    "--directory",
                    "--title=Select Workspace Folder",
                ],
            ),
            (
                "kdialog",
                vec![
                    "--getexistingdirectory",
                    ".",
                    "--title",
                    "Select Workspace Folder",
                ],
            ),
            (
                "yad",
                vec!["--file", "--directory", "--title=Select Workspace Folder"],
            ),
        ];

        for (cmd, args) in commands {
            if let Ok(output) = Command::new(cmd).args(args).output() {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Ok(Some(path));
                    }
                }
            }
        }

        Ok(None)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported platform".to_string())
    }
}

/// Save current charts to a workspace folder (creates workspace.yaml and chart YAMLs).
/// Implemented in Rust only — no Python required.
#[tauri::command]
pub async fn save_workspace(
    workspace_path: String,
    owner: String,
    charts: Vec<serde_json::Value>,
) -> Result<String, String> {
    use crate::workspace::models::{WorkspaceDefaults, WorkspaceManifest};
    use std::fs;
    use std::path::Path;

    let base = Path::new(&workspace_path);
    let charts_dir = base.join("charts");
    fs::create_dir_all(&charts_dir).map_err(|e| format!("Failed to create charts dir: {}", e))?;

    let mut chart_refs = Vec::new();
    for chart in &charts {
        let id = chart.get("id").and_then(|v| v.as_str()).unwrap_or("chart");
        let safe_name: String = id
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        let name = if safe_name.is_empty() {
            "chart"
        } else {
            safe_name.as_str()
        };
        let rel = format!("charts/{}.yml", name);
        let path = base.join(&rel);
        let yaml =
            serde_yaml::to_string(chart).map_err(|e| format!("Chart YAML serialization: {}", e))?;
        fs::write(&path, yaml).map_err(|e| format!("Write {}: {}", path.display(), e))?;
        chart_refs.push(rel);
    }

    let default = WorkspaceDefaults {
        ephemeris_engine: None,
        ephemeris_backend: None,
        element_colors: None,
        radix_point_colors: None,
        default_location: None,
        language: None,
        theme: None,
        default_house_system: None,
        default_bodies: None,
        default_aspects: None,
        time_system: None,
    };
    let manifest = WorkspaceManifest {
        owner: if owner.is_empty() {
            "User".to_string()
        } else {
            owner
        },
        active_model: None,
        aspects: vec![],
        bodies: vec![],
        models: HashMap::new(),
        model_overrides: None,
        default,
        chart_presets: vec![],
        subjects: vec![],
        charts: chart_refs,
        layouts: vec![],
        annotations: vec![],
    };
    let manifest_yaml =
        serde_yaml::to_string(&manifest).map_err(|e| format!("Manifest YAML: {}", e))?;
    let manifest_path = base.join("workspace.yaml");
    fs::write(&manifest_path, manifest_yaml).map_err(|e| format!("Write workspace.yaml: {}", e))?;

    Ok(workspace_path)
}

/// Create a new workspace with an empty manifest and charts directory.
#[tauri::command]
pub async fn create_workspace(workspace_path: String, owner: String) -> Result<String, String> {
    use std::fs;

    let base = Path::new(&workspace_path);
    fs::create_dir_all(base).map_err(|e| format!("Failed to create workspace dir: {}", e))?;
    fs::create_dir_all(base.join("charts"))
        .map_err(|e| format!("Failed to create charts dir: {}", e))?;

    let manifest_path = base.join("workspace.yaml");
    if manifest_path.exists() {
        return Err(format!(
            "Workspace already exists: {}",
            manifest_path.display()
        ));
    }

    let manifest = empty_workspace_manifest(&owner);
    write_workspace_manifest(base, &manifest)?;
    Ok(workspace_path)
}

/// Delete a workspace directory recursively.
#[tauri::command]
pub async fn delete_workspace(workspace_path: String) -> Result<bool, String> {
    use std::fs;

    let base = Path::new(&workspace_path);
    if !base.exists() {
        return Ok(false);
    }

    fs::remove_dir_all(base)
        .map_err(|e| format!("Failed to delete workspace {}: {}", base.display(), e))?;
    Ok(true)
}

/// Create a chart YAML file and register it in workspace.yaml.
#[tauri::command]
pub async fn create_chart(
    workspace_path: String,
    mut chart: serde_json::Value,
) -> Result<String, String> {
    let base = Path::new(&workspace_path);
    let mut manifest = load_workspace_manifest(base)?;

    let chart_id = extract_chart_id(&chart)?.to_string();
    if find_chart_ref_by_id(base, &manifest, &chart_id)?.is_some() {
        return Err(format!("Chart {} already exists", chart_id));
    }

    upsert_chart_id(&mut chart, &chart_id)?;
    let rel = chart_relative_path(&chart_id);
    write_chart_yaml(base, &rel, &chart)?;

    manifest.charts.push(rel);
    write_workspace_manifest(base, &manifest)?;
    Ok(chart_id)
}

/// Update chart YAML by chart id. The chart id is enforced in written content.
#[tauri::command]
pub async fn update_chart(
    workspace_path: String,
    chart_id: String,
    mut chart: serde_json::Value,
) -> Result<String, String> {
    let base = Path::new(&workspace_path);
    let manifest = load_workspace_manifest(base)?;

    let rel = find_chart_ref_by_id(base, &manifest, &chart_id)?
        .ok_or_else(|| format!("Chart {} not found", chart_id))?;

    upsert_chart_id(&mut chart, &chart_id)?;
    write_chart_yaml(base, &rel, &chart)?;
    Ok(chart_id)
}

/// Delete chart YAML by chart id and remove it from workspace.yaml.
#[tauri::command]
pub async fn delete_chart(workspace_path: String, chart_id: String) -> Result<bool, String> {
    use std::fs;

    let base = Path::new(&workspace_path);
    let mut manifest = load_workspace_manifest(base)?;

    let rel = match find_chart_ref_by_id(base, &manifest, &chart_id)? {
        Some(path) => path,
        None => return Ok(false),
    };

    manifest.charts.retain(|p| p != &rel);
    write_workspace_manifest(base, &manifest)?;

    let chart_path = base.join(&rel);
    if chart_path.exists() {
        fs::remove_file(&chart_path).map_err(|e| {
            format!(
                "Failed to delete chart file {}: {}",
                chart_path.display(),
                e
            )
        })?;
    }

    Ok(true)
}

/// Load workspace from a directory containing workspace.yaml
#[tauri::command]
pub async fn load_workspace(workspace_path: String) -> Result<WorkspaceInfo, String> {
    let workspace_dir = Path::new(&workspace_path);

    // Load manifest using Rust YAML parser
    let manifest = load_workspace_manifest(workspace_dir)?;

    // Load all charts
    let charts = load_all_charts(workspace_dir, &manifest)?;

    // Convert to summaries
    let chart_summaries: Vec<ChartSummary> = charts.iter().map(chart_to_summary).collect();

    Ok(WorkspaceInfo {
        path: workspace_path,
        owner: manifest.owner,
        active_model: manifest.active_model,
        charts: chart_summaries,
    })
}

/// Load workspace default settings from workspace.yaml.
#[tauri::command]
pub async fn get_workspace_defaults(workspace_path: String) -> Result<serde_json::Value, String> {
    use serde_json::json;

    let workspace_dir = Path::new(&workspace_path);
    let manifest = load_workspace_manifest(workspace_dir)?;
    let defaults = manifest.default;

    let default_house_system = defaults.default_house_system.map(|h| match h {
        crate::workspace::models::HouseSystem::Placidus => "Placidus",
        crate::workspace::models::HouseSystem::WholeSign => "Whole Sign",
        crate::workspace::models::HouseSystem::Campanus => "Campanus",
        crate::workspace::models::HouseSystem::Koch => "Koch",
        crate::workspace::models::HouseSystem::Equal => "Equal",
        crate::workspace::models::HouseSystem::Regiomontanus => "Regiomontanus",
        crate::workspace::models::HouseSystem::Vehlow => "Vehlow",
        crate::workspace::models::HouseSystem::Porphyry => "Porphyry",
        crate::workspace::models::HouseSystem::Alcabitius => "Alcabitius",
    });

    let default_engine = defaults.ephemeris_engine.map(|e| match e {
        crate::workspace::models::EngineType::Swisseph => "swisseph",
        crate::workspace::models::EngineType::Jyotish => "jyotish",
        crate::workspace::models::EngineType::Jpl => "jpl",
        crate::workspace::models::EngineType::Custom => "custom",
    });

    let default_location_name = defaults
        .default_location
        .as_ref()
        .map(|location| location.name.clone());

    let default_location_latitude = defaults
        .default_location
        .as_ref()
        .map(|location| location.latitude);

    let default_location_longitude = defaults
        .default_location
        .as_ref()
        .map(|location| location.longitude);

    let default_timezone = defaults
        .default_location
        .as_ref()
        .map(|location| location.timezone.clone());

    Ok(json!({
        "default_house_system": default_house_system,
        "default_engine": default_engine,
        "default_location_name": default_location_name,
        "default_location_latitude": default_location_latitude,
        "default_location_longitude": default_location_longitude,
        "default_timezone": default_timezone,
        "default_bodies": defaults.default_bodies,
        "default_aspects": defaults.default_aspects,
        "time_system": defaults.time_system,
    }))
}

/// Get full chart details including all settings
#[tauri::command]
pub async fn get_chart_details(
    workspace_path: String,
    chart_id: String,
) -> Result<serde_json::Value, String> {
    use serde_json::json;

    let workspace_dir = Path::new(&workspace_path);

    let manifest = load_workspace_manifest(workspace_dir)?;
    let charts = load_all_charts(workspace_dir, &manifest)?;
    let chart = charts
        .into_iter()
        .find(|ch| ch.id == chart_id)
        .ok_or_else(|| format!("Chart {} not found in workspace", chart_id))?;

    // Serialize to JSON

    let mode_str = match chart.config.mode {
        crate::workspace::models::ChartMode::NATAL => "NATAL",
        crate::workspace::models::ChartMode::EVENT => "EVENT",
        crate::workspace::models::ChartMode::HORARY => "HORARY",
        crate::workspace::models::ChartMode::COMPOSITE => "COMPOSITE",
    };

    let house_system_str = chart.config.house_system.as_ref().map(|h| match h {
        crate::workspace::models::HouseSystem::Placidus => "Placidus",
        crate::workspace::models::HouseSystem::WholeSign => "Whole Sign",
        crate::workspace::models::HouseSystem::Campanus => "Campanus",
        crate::workspace::models::HouseSystem::Koch => "Koch",
        crate::workspace::models::HouseSystem::Equal => "Equal",
        crate::workspace::models::HouseSystem::Regiomontanus => "Regiomontanus",
        crate::workspace::models::HouseSystem::Vehlow => "Vehlow",
        crate::workspace::models::HouseSystem::Porphyry => "Porphyry",
        crate::workspace::models::HouseSystem::Alcabitius => "Alcabitius",
    });

    let zodiac_type_str = match chart.config.zodiac_type {
        crate::workspace::models::ZodiacType::Tropical => "Tropical",
        crate::workspace::models::ZodiacType::Sidereal => "Sidereal",
    };

    let engine_str = chart.config.engine.as_ref().map(|e| match e {
        crate::workspace::models::EngineType::Swisseph => "swisseph",
        crate::workspace::models::EngineType::Jyotish => "jyotish",
        crate::workspace::models::EngineType::Jpl => "jpl",
        crate::workspace::models::EngineType::Custom => "custom",
    });

    Ok(json!({
        "id": chart.id,
        "subject": {
            "id": chart.subject.id,
            "name": chart.subject.name,
            "event_time": chart.subject.event_time.map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string()),
            "location": {
                "name": chart.subject.location.name,
                "latitude": chart.subject.location.latitude,
                "longitude": chart.subject.location.longitude,
                "timezone": chart.subject.location.timezone,
            }
        },
        "config": {
            "mode": mode_str,
            "house_system": house_system_str,
            "zodiac_type": zodiac_type_str,
            "engine": engine_str,
            "model": chart.config.model,
            "override_ephemeris": chart.config.override_ephemeris,
        },
        "tags": chart.tags,
    }))
}

/// Compute chart positions and aspects from in-memory chart data (no workspace on disk).
#[tauri::command]
pub async fn compute_chart_from_data(
    chart_json: serde_json::Value,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let backend = selected_compute_backend();
    let fallback_to_python = python_fallback_enabled();
    let force_python = chart_json_requires_python_precision(&chart_json);

    if force_python {
        return match backend {
            ComputeBackend::Rust => Err("Rust backend does not support precise Swiss Ephemeris/JPL chart computation yet. Use Python backend.".to_string()),
            _ => compute_chart_from_data_python(chart_json),
        };
    }

    match backend {
        ComputeBackend::Python => compute_chart_from_data_python(chart_json),
        ComputeBackend::Rust => compute_chart_from_data_rust(chart_json),
        ComputeBackend::Auto => match compute_chart_from_data_python(chart_json.clone()) {
            Ok(result) => Ok(result),
            Err(_err) if fallback_to_python => {
                compute_chart_from_data_rust(chart_json)
            }
            Err(err) => Err(err),
        },
    }
}

fn compute_chart_from_data_rust(
    chart_json: serde_json::Value,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let chart: crate::workspace::models::ChartInstance =
        serde_json::from_value(chart_json).map_err(|e| format!("Invalid chart payload: {}", e))?;
    build_chart_result(&chart, None)
}

fn compute_chart_from_data_python(
    chart_json: serde_json::Value,
) -> Result<HashMap<String, serde_json::Value>, String> {
    use std::io::Write;
    let python_exe = find_python_executable()?;
    let module_path = get_module_path()?;
    let json_str = chart_json.to_string();
    let mut child = Command::new(&python_exe)
        .arg("-c")
        .arg(format!(
            r#"
import sys
import json
sys.path.insert(0, '{}')
from module.utils import parse_chart_yaml
from module.services import compute_positions_for_chart, compute_aspects_for_chart

try:
    data = json.load(sys.stdin)
    chart = parse_chart_yaml(data)
    positions = compute_positions_for_chart(chart)
    aspects = compute_aspects_for_chart(chart)
    result = {{
        'positions': positions or {{}},
        'aspects': aspects or [],
        'chart_id': chart.id
    }}
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({{'error': str(e)}}))
    sys.exit(1)
"#,
            module_path.display()
        ))
        .current_dir(&module_path)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(json_str.as_bytes()).ok();
    }
    let output = child
        .wait_with_output()
        .map_err(|e| format!("Python process error: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let error = if !stderr.is_empty() { stderr } else { stdout };
        return Err(format!("Python error: {}", error));
    }

    let result_str = String::from_utf8(output.stdout)
        .map_err(|e| format!("Failed to read Python output: {}", e))?;
    let result: HashMap<String, serde_json::Value> = serde_json::from_str(&result_str)
        .map_err(|e| format!("Failed to parse computation result: {}", e))?;
    if let Some(error) = result.get("error") {
        return Err(error.as_str().unwrap_or("Unknown error").to_string());
    }
    Ok(result)
}

/// Compute chart positions and aspects using Python
#[tauri::command]
pub async fn compute_chart(
    app: AppHandle,
    backend_state: State<'_, crate::backend::BackendState>,
    workspace_path: String,
    chart_id: String,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let backend = selected_compute_backend();
    let fallback_to_python = python_fallback_enabled();
    let force_python = chart_requires_python_precision(&workspace_path, &chart_id).unwrap_or(false);

    if force_python {
        return match backend {
            ComputeBackend::Rust => Err("Rust backend does not support precise Swiss Ephemeris/JPL chart computation yet. Use Python backend.".to_string()),
            _ => compute_chart_python(&app, &backend_state, &workspace_path, &chart_id).await,
        };
    }

    match backend {
        ComputeBackend::Python => {
            compute_chart_python(&app, &backend_state, &workspace_path, &chart_id).await
        }
        ComputeBackend::Rust => compute_chart_rust(&workspace_path, &chart_id),
        ComputeBackend::Auto => match compute_chart_python(
            &app,
            &backend_state,
            &workspace_path,
            &chart_id,
        )
        .await
        {
            Ok(result) => Ok(result),
            Err(_err) if fallback_to_python => compute_chart_rust(&workspace_path, &chart_id),
            Err(err) => Err(err),
        },
    }
}

fn compute_chart_rust(
    workspace_path: &str,
    chart_id: &str,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let base = Path::new(workspace_path);
    let manifest = load_workspace_manifest(base)?;
    let chart_rel = find_chart_ref_by_id(base, &manifest, chart_id)?
        .ok_or_else(|| format!("Chart {} not found", chart_id))?;
    let chart = load_chart(base, &chart_rel)?;
    build_chart_result(&chart, None)
}

async fn compute_chart_python(
    app: &AppHandle,
    backend_state: &crate::backend::BackendState,
    workspace_path: &str,
    chart_id: &str,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let payload = serde_json::json!({
        "workspace_path": Path::new(workspace_path)
            .join("workspace.yaml")
            .to_str()
            .ok_or("Invalid workspace manifest path")?,
        "chart_id": chart_id,
    });
    let response =
        crate::backend::post_json(app, backend_state, "/charts/compute", &payload).await?;
    serde_json::from_value(response)
        .map_err(|err| format!("Failed to parse backend chart response: {err}"))
}

/// Compute transit series using Python
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn compute_transit_series(
    app: AppHandle,
    backend_state: State<'_, crate::backend::BackendState>,
    workspace_path: String,
    chart_id: String,
    start_datetime: String,
    end_datetime: String,
    time_step_seconds: i64,
    transiting_objects: Vec<String>,
    transited_objects: Vec<String>,
    aspect_types: Vec<String>,
) -> Result<serde_json::Value, String> {
    let backend = selected_compute_backend();
    let fallback_to_python = python_fallback_enabled();

    match backend {
        ComputeBackend::Python => compute_transit_series_python(
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
        )
        .await,
        ComputeBackend::Rust => compute_transit_series_rust(
            &workspace_path,
            &chart_id,
            &start_datetime,
            &end_datetime,
            time_step_seconds,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
        ),
        ComputeBackend::Auto => match compute_transit_series_python(
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
        )
        .await
        {
            Ok(result) => Ok(result),
            Err(_err) if fallback_to_python => compute_transit_series_rust(
                &workspace_path,
                &chart_id,
                &start_datetime,
                &end_datetime,
                time_step_seconds,
                &transiting_objects,
                &transited_objects,
                &aspect_types,
            ),
            Err(err) => Err(err),
        },
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
) -> Result<serde_json::Value, String> {
    if time_step_seconds <= 0 {
        return Err("time_step_seconds must be > 0".to_string());
    }

    let start_dt = parse_datetime_input(start_datetime)?;
    let end_dt = parse_datetime_input(end_datetime)?;
    if end_dt < start_dt {
        return Err("end_datetime must be greater than or equal to start_datetime".to_string());
    }

    let base = Path::new(workspace_path);
    let manifest = load_workspace_manifest(base)?;
    let chart_rel = find_chart_ref_by_id(base, &manifest, chart_id)?
        .ok_or_else(|| format!("Chart {} not found", chart_id))?;
    let source_chart = load_chart(base, &chart_rel)?;

    let transited_filter = if transited_objects.is_empty() {
        source_chart.config.observable_objects.clone()
    } else {
        Some(transited_objects.to_vec())
    };
    let radix_positions =
        compute_positions_for_chart_rust(&source_chart, transited_filter.as_ref())?;

    let mut current = start_dt;
    let step = Duration::seconds(time_step_seconds);
    let max_steps = 50_000_i64;
    let mut step_count = 0_i64;
    let mut results = Vec::new();
    while current <= end_dt {
        step_count += 1;
        if step_count > max_steps {
            return Err(format!(
                "Transit range too large (>{max_steps} steps). Increase time step or reduce range."
            ));
        }

        let mut transit_chart = source_chart.clone();
        transit_chart.subject.event_time = Some(current);
        let transiting_filter = if transiting_objects.is_empty() {
            transit_chart.config.observable_objects.clone()
        } else {
            Some(transiting_objects.to_vec())
        };
        let transit_positions =
            compute_positions_for_chart_rust(&transit_chart, transiting_filter.as_ref())?;
        let aspects = compute_cross_aspects(
            &transit_positions,
            &radix_positions,
            &source_chart.config.aspect_orbs,
            aspect_types,
        );

        results.push(serde_json::json!({
            "datetime": current.to_rfc3339(),
            "transit_positions": transit_positions,
            "aspects": aspects,
        }));

        current += step;
    }

    Ok(serde_json::json!({
        "source_chart_id": chart_id,
        "time_range": {
            "start": start_dt.to_rfc3339(),
            "end": end_dt.to_rfc3339(),
        },
        "time_step": format!("{}s", time_step_seconds),
        "results": results,
    }))
}

#[allow(clippy::too_many_arguments)]
async fn compute_transit_series_python(
    app: &AppHandle,
    backend_state: &crate::backend::BackendState,
    workspace_path: &str,
    chart_id: &str,
    start_datetime: &str,
    end_datetime: &str,
    time_step_seconds: i64,
    transiting_objects: Vec<String>,
    transited_objects: Vec<String>,
    aspect_types: Vec<String>,
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
    });
    crate::backend::post_json(app, backend_state, "/transits/compute-series", &payload).await
}

#[derive(Clone, Copy)]
struct OrbitalBody {
    id: &'static str,
    semi_major_axis_au: f64,
    mean_longitude_j2000_deg: f64,
    orbital_period_days: f64,
}

#[derive(Clone, Copy)]
struct AspectSpec {
    id: &'static str,
    angle: f64,
    default_orb: f64,
}

const EARTH_HELIO_LONGITUDE_J2000: f64 = 100.466_457;
const OBLIQUITY_DEGREES: f64 = 23.439_291_1;
const ORBITAL_BODIES: [OrbitalBody; 8] = [
    OrbitalBody {
        id: "mercury",
        semi_major_axis_au: 0.387_098,
        mean_longitude_j2000_deg: 252.250_84,
        orbital_period_days: 87.969,
    },
    OrbitalBody {
        id: "venus",
        semi_major_axis_au: 0.723_332,
        mean_longitude_j2000_deg: 181.979_73,
        orbital_period_days: 224.701,
    },
    OrbitalBody {
        id: "mars",
        semi_major_axis_au: 1.523_679,
        mean_longitude_j2000_deg: 355.433,
        orbital_period_days: 686.980,
    },
    OrbitalBody {
        id: "jupiter",
        semi_major_axis_au: 5.203_8,
        mean_longitude_j2000_deg: 34.351,
        orbital_period_days: 4_332.589,
    },
    OrbitalBody {
        id: "saturn",
        semi_major_axis_au: 9.537,
        mean_longitude_j2000_deg: 50.077,
        orbital_period_days: 10_759.22,
    },
    OrbitalBody {
        id: "uranus",
        semi_major_axis_au: 19.191,
        mean_longitude_j2000_deg: 314.055,
        orbital_period_days: 30_688.5,
    },
    OrbitalBody {
        id: "neptune",
        semi_major_axis_au: 30.07,
        mean_longitude_j2000_deg: 304.348,
        orbital_period_days: 60_182.0,
    },
    OrbitalBody {
        id: "pluto",
        semi_major_axis_au: 39.482,
        mean_longitude_j2000_deg: 238.929,
        orbital_period_days: 90_560.0,
    },
];
const MAJOR_ASPECTS: [AspectSpec; 5] = [
    AspectSpec {
        id: "conjunction",
        angle: 0.0,
        default_orb: 8.0,
    },
    AspectSpec {
        id: "sextile",
        angle: 60.0,
        default_orb: 6.0,
    },
    AspectSpec {
        id: "square",
        angle: 90.0,
        default_orb: 8.0,
    },
    AspectSpec {
        id: "trine",
        angle: 120.0,
        default_orb: 8.0,
    },
    AspectSpec {
        id: "opposition",
        angle: 180.0,
        default_orb: 8.0,
    },
];

fn build_chart_result(
    chart: &crate::workspace::models::ChartInstance,
    aspect_types: Option<&[String]>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let positions =
        compute_positions_for_chart_rust(chart, chart.config.observable_objects.as_ref())?;
    let aspects = compute_chart_aspects(&positions, &chart.config.aspect_orbs, aspect_types);

    Ok(HashMap::from([
        ("positions".to_string(), serde_json::json!(positions)),
        ("aspects".to_string(), serde_json::json!(aspects)),
        ("chart_id".to_string(), serde_json::json!(chart.id)),
    ]))
}

fn compute_positions_for_chart_rust(
    chart: &crate::workspace::models::ChartInstance,
    requested_objects: Option<&Vec<String>>,
) -> Result<HashMap<String, f64>, String> {
    let event_time = chart
        .subject
        .event_time
        .ok_or_else(|| "Chart has no subject.event_time".to_string())?;
    let jd = julian_day(event_time);
    let d = jd - 2_451_545.0;

    let mut positions = HashMap::new();

    let sun = sun_longitude_deg(d);
    let moon = moon_longitude_deg(d);
    positions.insert("sun".to_string(), sun);
    positions.insert("moon".to_string(), moon);

    let earth_helio = normalize_deg(EARTH_HELIO_LONGITUDE_J2000 + (360.0 / 365.256_363_004) * d);
    for body in ORBITAL_BODIES {
        let longitude = geocentric_longitude_deg(body, d, earth_helio);
        positions.insert(body.id.to_string(), longitude);
    }

    let (asc, mc) = asc_mc_longitudes(
        jd,
        chart.subject.location.latitude,
        chart.subject.location.longitude,
    );
    positions.insert("asc".to_string(), asc);
    positions.insert("desc".to_string(), normalize_deg(asc + 180.0));
    positions.insert("mc".to_string(), mc);
    positions.insert("ic".to_string(), normalize_deg(mc + 180.0));

    if let Some(requested) = requested_objects {
        if !requested.is_empty() {
            let requested_norm: HashSet<String> =
                requested.iter().map(|id| normalize_object_id(id)).collect();
            positions.retain(|key, _| requested_norm.contains(&normalize_object_id(key)));
        }
    }

    Ok(positions)
}

fn compute_chart_aspects(
    positions: &HashMap<String, f64>,
    aspect_orbs: &HashMap<String, f64>,
    aspect_types: Option<&[String]>,
) -> Vec<serde_json::Value> {
    let specs = selected_aspects(aspect_orbs, aspect_types);
    let mut ids: Vec<&String> = positions.keys().collect();
    ids.sort();

    let mut out = Vec::new();
    for i in 0..ids.len() {
        for j in (i + 1)..ids.len() {
            let from = ids[i];
            let to = ids[j];
            let angle = shortest_arc_deg(
                *positions.get(from).unwrap_or(&0.0),
                *positions.get(to).unwrap_or(&0.0),
            );

            if let Some((aspect_id, exact_angle, orb)) = detect_aspect(angle, &specs) {
                out.push(serde_json::json!({
                    "from": from,
                    "to": to,
                    "type": aspect_id,
                    "angle": angle,
                    "orb": orb,
                    "exact_angle": exact_angle,
                    "applying": false,
                    "separating": false,
                }));
            }
        }
    }
    out
}

fn compute_cross_aspects(
    transiting_positions: &HashMap<String, f64>,
    transited_positions: &HashMap<String, f64>,
    aspect_orbs: &HashMap<String, f64>,
    aspect_types: &[String],
) -> Vec<serde_json::Value> {
    let specs = selected_aspects(aspect_orbs, Some(aspect_types));
    let mut transiting_ids: Vec<&String> = transiting_positions.keys().collect();
    let mut transited_ids: Vec<&String> = transited_positions.keys().collect();
    transiting_ids.sort();
    transited_ids.sort();

    let mut out = Vec::new();
    for from in transiting_ids {
        let from_lon = *transiting_positions.get(from).unwrap_or(&0.0);
        for to in &transited_ids {
            let to_lon = *transited_positions.get(*to).unwrap_or(&0.0);
            let angle = shortest_arc_deg(from_lon, to_lon);
            if let Some((aspect_id, exact_angle, orb)) = detect_aspect(angle, &specs) {
                out.push(serde_json::json!({
                    "from": from,
                    "to": to,
                    "type": aspect_id,
                    "angle": angle,
                    "orb": orb,
                    "exact_angle": exact_angle,
                    "applying": false,
                    "separating": false,
                }));
            }
        }
    }
    out
}

fn selected_aspects(
    aspect_orbs: &HashMap<String, f64>,
    selected_types: Option<&[String]>,
) -> Vec<(String, f64, f64)> {
    let selected: Option<HashSet<String>> = selected_types.map(|types| {
        types
            .iter()
            .map(|t| t.trim().to_ascii_lowercase())
            .collect()
    });

    MAJOR_ASPECTS
        .iter()
        .filter_map(|spec| {
            let id = spec.id.to_string();
            if let Some(filter) = &selected {
                if !filter.contains(&id) {
                    return None;
                }
            }
            let orb = aspect_orbs
                .get(spec.id)
                .copied()
                .unwrap_or(spec.default_orb)
                .max(0.0);
            Some((id, spec.angle, orb))
        })
        .collect()
}

fn detect_aspect(angle: f64, specs: &[(String, f64, f64)]) -> Option<(String, f64, f64)> {
    for (id, exact_angle, allowed_orb) in specs {
        let normalized_exact = if *exact_angle > 180.0 {
            360.0 - *exact_angle
        } else {
            *exact_angle
        };
        let orb = (angle - normalized_exact).abs();
        if orb <= *allowed_orb {
            return Some((id.clone(), *exact_angle, orb));
        }
    }
    None
}

fn parse_datetime_input(value: &str) -> Result<DateTime<Utc>, String> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(value) {
        return Ok(dt.with_timezone(&Utc));
    }

    let naive_formats = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"];
    for fmt in naive_formats {
        if let Ok(dt) = NaiveDateTime::parse_from_str(value, fmt) {
            return Ok(dt.and_utc());
        }
    }

    if let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        if let Some(dt) = date.and_hms_opt(0, 0, 0) {
            return Ok(dt.and_utc());
        }
    }

    Err(format!("Invalid datetime format: {}", value))
}

fn normalize_object_id(id: &str) -> String {
    match id.trim().to_ascii_lowercase().as_str() {
        "ascendant" => "asc".to_string(),
        "descendant" => "desc".to_string(),
        "midheaven" | "medium_coeli" => "mc".to_string(),
        "imum_coeli" => "ic".to_string(),
        other => other.to_string(),
    }
}

fn julian_day(dt: DateTime<Utc>) -> f64 {
    2_440_587.5
        + (dt.timestamp() as f64 / 86_400.0)
        + (f64::from(dt.timestamp_subsec_nanos()) / 86_400_000_000_000.0)
}

fn geocentric_longitude_deg(body: OrbitalBody, d: f64, earth_helio_longitude: f64) -> f64 {
    let mean_motion = 360.0 / body.orbital_period_days;
    let planet_helio = normalize_deg(body.mean_longitude_j2000_deg + mean_motion * d);
    let px = body.semi_major_axis_au * cos_deg(planet_helio);
    let py = body.semi_major_axis_au * sin_deg(planet_helio);
    let ex = cos_deg(earth_helio_longitude);
    let ey = sin_deg(earth_helio_longitude);
    normalize_deg(rad_to_deg((py - ey).atan2(px - ex)))
}

fn sun_longitude_deg(d: f64) -> f64 {
    let m = normalize_deg(357.529_11 + 0.985_600_28 * d);
    normalize_deg(
        280.466_46
            + 0.985_647_36 * d
            + 1.914_602 * sin_deg(m)
            + 0.019_993 * sin_deg(2.0 * m)
            + 0.000_289 * sin_deg(3.0 * m),
    )
}

fn moon_longitude_deg(d: f64) -> f64 {
    let l0 = normalize_deg(218.316 + 13.176_396 * d);
    let mm = normalize_deg(134.963 + 13.064_993 * d);
    let ms = normalize_deg(357.529 + 0.985_600_28 * d);
    let dd = normalize_deg(297.850 + 12.190_749 * d);
    let ff = normalize_deg(93.272 + 13.229_350 * d);

    normalize_deg(
        l0 + 6.289 * sin_deg(mm)
            + 1.274 * sin_deg(2.0 * dd - mm)
            + 0.658 * sin_deg(2.0 * dd)
            + 0.214 * sin_deg(2.0 * mm)
            - 0.186 * sin_deg(ms)
            - 0.059 * sin_deg(2.0 * dd - 2.0 * mm)
            - 0.057 * sin_deg(2.0 * dd - ms - mm)
            + 0.053 * sin_deg(2.0 * dd + mm)
            + 0.046 * sin_deg(2.0 * dd - ms)
            + 0.041 * sin_deg(ms - mm)
            - 0.035 * sin_deg(dd)
            - 0.031 * sin_deg(ms + mm)
            - 0.015 * sin_deg(2.0 * ff - 2.0 * dd)
            + 0.011 * sin_deg(2.0 * dd - 4.0 * mm),
    )
}

fn asc_mc_longitudes(jd: f64, latitude_deg: f64, longitude_deg: f64) -> (f64, f64) {
    let t = (jd - 2_451_545.0) / 36_525.0;
    let gmst = normalize_deg(
        280.460_618_37 + 360.985_647_366_29 * (jd - 2_451_545.0) + 0.000_387_933 * t * t
            - (t * t * t) / 38_710_000.0,
    );
    let lst = normalize_deg(gmst + longitude_deg);
    let theta = deg_to_rad(lst);
    let eps = deg_to_rad(OBLIQUITY_DEGREES);
    let phi = deg_to_rad(latitude_deg);

    let mc = normalize_deg(rad_to_deg((theta.sin() / eps.cos()).atan2(theta.cos())));
    let asc = normalize_deg(rad_to_deg(
        (-theta.cos()).atan2(theta.sin() * eps.cos() + phi.tan() * eps.sin()),
    ));
    (asc, mc)
}

fn shortest_arc_deg(a: f64, b: f64) -> f64 {
    let mut diff = (normalize_deg(a) - normalize_deg(b)).abs();
    if diff > 180.0 {
        diff = 360.0 - diff;
    }
    diff
}

fn normalize_deg(value: f64) -> f64 {
    let mut out = value % 360.0;
    if out < 0.0 {
        out += 360.0;
    }
    out
}

fn sin_deg(value: f64) -> f64 {
    deg_to_rad(value).sin()
}

fn cos_deg(value: f64) -> f64 {
    deg_to_rad(value).cos()
}

fn deg_to_rad(value: f64) -> f64 {
    value * std::f64::consts::PI / 180.0
}

fn rad_to_deg(value: f64) -> f64 {
    value * 180.0 / std::f64::consts::PI
}

/// Only JPL, Jyotish and Custom require Python; Swisseph can use Python (preferred) with Rust fallback.
fn chart_json_requires_python_precision(chart_json: &serde_json::Value) -> bool {
    let cfg = chart_json.get("config").and_then(|v| v.as_object());
    let engine = cfg
        .and_then(|c| c.get("engine"))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_ascii_lowercase());
    let has_override_ephemeris = cfg
        .and_then(|c| c.get("override_ephemeris"))
        .and_then(|v| v.as_str())
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);

    matches!(engine.as_deref(), Some("jpl" | "jyotish" | "custom")) || has_override_ephemeris
}

fn chart_requires_python_precision(workspace_path: &str, chart_id: &str) -> Result<bool, String> {
    let base = Path::new(workspace_path);
    let manifest = load_workspace_manifest(base)?;
    let chart_rel = find_chart_ref_by_id(base, &manifest, chart_id)?
        .ok_or_else(|| format!("Chart {} not found", chart_id))?;
    let chart = load_chart(base, &chart_rel)?;

    // Only JPL, Jyotish, Custom require Python; Swisseph can use Rust fallback.
    let requires = matches!(
        chart.config.engine,
        Some(
            crate::workspace::models::EngineType::Jpl
                | crate::workspace::models::EngineType::Jyotish
                | crate::workspace::models::EngineType::Custom
        )
    ) || chart
        .config
        .override_ephemeris
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);

    Ok(requires)
}

#[derive(Clone, Copy, Debug)]
enum ComputeBackend {
    Auto,
    Rust,
    Python,
}

fn selected_compute_backend() -> ComputeBackend {
    match std::env::var("KEFER_COMPUTE_BACKEND")
        .ok()
        .as_deref()
        .map(|value| value.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("rust") => ComputeBackend::Rust,
        Some("python") => ComputeBackend::Python,
        _ => ComputeBackend::Auto,
    }
}

fn python_fallback_enabled() -> bool {
    !matches!(
        std::env::var("KEFER_PYTHON_FALLBACK")
        .ok()
        .as_deref()
        .map(|value| value.trim().to_ascii_lowercase())
        .as_deref(),
        Some("0" | "false" | "no" | "off")
    )
}

fn find_python_executable() -> Result<PathBuf, String> {
    // First, try to find a virtual environment in external_package
    if let Ok(module_path) = get_module_path() {
        let venv_candidates = vec![
            module_path.join("venv").join("bin").join("python"),
            module_path.join("venv").join("bin").join("python3"),
            module_path.join(".venv").join("bin").join("python"),
            module_path.join(".venv").join("bin").join("python3"),
        ];

        for venv_python in venv_candidates {
            if venv_python.exists() && Command::new(&venv_python).arg("--version").output().is_ok()
            {
                return Ok(venv_python);
            }
        }
    }

    // Fall back to system Python
    let candidates = vec!["python3", "python", "py"];

    for cmd in candidates {
        if Command::new(cmd).arg("--version").output().is_ok() {
            return Ok(PathBuf::from(cmd));
        }
    }

    Err("Python executable not found. Please install Python or create a virtual environment in external_package/".to_string())
}

fn get_module_path() -> Result<PathBuf, String> {
    // Prefer packaged resources when bundled
    // Resolve external_package relative to repo
    let current_dir =
        std::env::current_dir().map_err(|e| format!("Failed to get current directory: {}", e))?;

    let candidates = vec![
        current_dir.join("external_package"),
        current_dir.join("..").join("external_package"),
    ];

    for path in candidates {
        if path.exists() && path.is_dir() {
            return Ok(path);
        }
    }

    Err("external_package directory not found".to_string())
}

fn empty_workspace_manifest(owner: &str) -> crate::workspace::models::WorkspaceManifest {
    let owner_value = if owner.is_empty() {
        "User".to_string()
    } else {
        owner.to_string()
    };
    crate::workspace::models::WorkspaceManifest {
        owner: owner_value,
        active_model: None,
        aspects: vec![],
        bodies: vec![],
        models: HashMap::new(),
        model_overrides: None,
        default: crate::workspace::models::WorkspaceDefaults {
            ephemeris_engine: None,
            ephemeris_backend: None,
            element_colors: None,
            radix_point_colors: None,
            default_location: None,
            language: None,
            theme: None,
            default_house_system: None,
            default_bodies: None,
            default_aspects: None,
            time_system: None,
        },
        chart_presets: vec![],
        subjects: vec![],
        charts: vec![],
        layouts: vec![],
        annotations: vec![],
    }
}

fn write_workspace_manifest(
    base: &Path,
    manifest: &crate::workspace::models::WorkspaceManifest,
) -> Result<(), String> {
    use std::fs;

    let manifest_yaml = serde_yaml::to_string(manifest)
        .map_err(|e| format!("Manifest YAML serialization failed: {}", e))?;
    let manifest_path = base.join("workspace.yaml");
    fs::write(&manifest_path, manifest_yaml)
        .map_err(|e| format!("Write workspace.yaml failed: {}", e))
}

fn extract_chart_id(chart: &serde_json::Value) -> Result<&str, String> {
    chart
        .get("id")
        .and_then(|v| v.as_str())
        .filter(|v| !v.trim().is_empty())
        .ok_or_else(|| "Chart id is required".to_string())
}

fn upsert_chart_id(chart: &mut serde_json::Value, chart_id: &str) -> Result<(), String> {
    let obj = chart
        .as_object_mut()
        .ok_or_else(|| "Chart payload must be a JSON object".to_string())?;
    obj.insert("id".to_string(), serde_json::json!(chart_id));
    Ok(())
}

fn sanitize_chart_filename(chart_id: &str) -> String {
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

fn chart_relative_path(chart_id: &str) -> String {
    format!("charts/{}.yml", sanitize_chart_filename(chart_id))
}

fn write_chart_yaml(
    base: &Path,
    relative_path: &str,
    chart: &serde_json::Value,
) -> Result<(), String> {
    use std::fs;

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

fn find_chart_ref_by_id(
    base: &Path,
    manifest: &crate::workspace::models::WorkspaceManifest,
    chart_id: &str,
) -> Result<Option<String>, String> {
    for chart_ref in &manifest.charts {
        match load_chart(base, chart_ref) {
            Ok(chart) if chart.id == chart_id => return Ok(Some(chart_ref.clone())),
            Ok(_) => {}
            Err(err) => {
                eprintln!(
                    "Warning: Failed to load chart {} while searching id {}: {}",
                    chart_ref, chart_id, err
                );
            }
        }
    }
    Ok(None)
}
