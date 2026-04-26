use crate::workspace::loader::load_chart;
use crate::workspace::{
    chart_to_summary, load_all_charts, load_workspace_manifest, ChartSummary, WorkspaceInfo,
};
use chrono::{DateTime, Duration, NaiveDate, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, State};

const DEFAULT_GEOCODER_SEARCH_URL: &str = "https://nominatim.openstreetmap.org/search";
const GEOCODER_USER_AGENT: &str = "KeferAstrology/2.0 (desktop geocoding)";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeocodedLocation {
    pub query: String,
    pub display_name: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct SaveWorkspaceDefaultsInput {
    #[serde(default)]
    pub default_house_system: Option<String>,
    #[serde(default)]
    pub default_timezone: Option<String>,
    #[serde(default)]
    pub default_location_name: Option<String>,
    #[serde(default)]
    pub default_location_latitude: Option<f64>,
    #[serde(default)]
    pub default_location_longitude: Option<f64>,
    #[serde(default)]
    pub default_engine: Option<String>,
    #[serde(default)]
    pub default_bodies: Option<Vec<String>>,
    #[serde(default)]
    pub default_aspects: Option<Vec<String>>,
    #[serde(default)]
    pub default_aspect_orbs: Option<HashMap<String, f64>>,
    #[serde(default)]
    pub default_aspect_colors: Option<HashMap<String, String>>,
    #[serde(default)]
    pub aspect_line_tier_style: Option<crate::workspace::models::AspectLineTierStyle>,
}

#[derive(Debug, Clone, Deserialize)]
struct NominatimSearchResult {
    display_name: String,
    lat: String,
    lon: String,
}

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

/// Resolve a free-form place string into coordinates using a configurable geocoder endpoint.
#[tauri::command]
pub async fn resolve_location(query: String) -> Result<GeocodedLocation, String> {
    let results = search_locations(query).await?;
    results
        .into_iter()
        .next()
        .ok_or_else(|| "No location results found".to_string())
}

/// Search a free-form place string and return multiple candidate locations.
#[tauri::command]
pub async fn search_locations(query: String) -> Result<Vec<GeocodedLocation>, String> {
    let trimmed_query = query.trim();
    if trimmed_query.is_empty() {
        return Err("Location query is required".to_string());
    }

    let endpoint = std::env::var("KEFER_GEOCODER_SEARCH_URL")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_GEOCODER_SEARCH_URL.to_string());

    let client = reqwest::Client::builder()
        .user_agent(GEOCODER_USER_AGENT)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|err| format!("Failed to initialize geocoder client: {err}"))?;

    let response = client
        .get(&endpoint)
        .query(&[
            ("q", trimmed_query),
            ("format", "jsonv2"),
            ("limit", "5"),
            ("addressdetails", "0"),
        ])
        .send()
        .await
        .map_err(|err| format!("Location lookup failed: {err}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Location lookup failed with status {}",
            response.status()
        ));
    }

    let candidates = response
        .json::<Vec<NominatimSearchResult>>()
        .await
        .map_err(|err| format!("Failed to decode location lookup response: {err}"))?;

    select_nominatim_results(trimmed_query, &candidates)
}

/// Save current charts to a workspace folder (creates workspace.yaml and chart YAMLs).
/// Implemented in Rust only — no Python required.
#[tauri::command]
pub async fn save_workspace(
    workspace_path: String,
    owner: String,
    charts: Vec<serde_json::Value>,
    defaults: Option<SaveWorkspaceDefaultsInput>,
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

    let parsed_defaults = defaults.unwrap_or_default();

    let default_house_system = parsed_defaults
        .default_house_system
        .as_deref()
        .and_then(|value| match value {
            "Placidus" => Some(crate::workspace::models::HouseSystem::Placidus),
            "Whole Sign" => Some(crate::workspace::models::HouseSystem::WholeSign),
            "Campanus" => Some(crate::workspace::models::HouseSystem::Campanus),
            "Koch" => Some(crate::workspace::models::HouseSystem::Koch),
            "Equal" => Some(crate::workspace::models::HouseSystem::Equal),
            "Regiomontanus" => Some(crate::workspace::models::HouseSystem::Regiomontanus),
            "Vehlow" => Some(crate::workspace::models::HouseSystem::Vehlow),
            "Porphyry" => Some(crate::workspace::models::HouseSystem::Porphyry),
            "Alcabitius" => Some(crate::workspace::models::HouseSystem::Alcabitius),
            _ => None,
        });
    let ephemeris_engine = parsed_defaults
        .default_engine
        .as_deref()
        .and_then(|value| match value {
            "swisseph" => Some(crate::workspace::models::EngineType::Swisseph),
            "jyotish" => Some(crate::workspace::models::EngineType::Jyotish),
            "jpl" => Some(crate::workspace::models::EngineType::Jpl),
            "custom" => Some(crate::workspace::models::EngineType::Custom),
            _ => None,
        })
        .or(Some(crate::workspace::models::EngineType::Swisseph));
    let default_location = match (
        parsed_defaults.default_location_name,
        parsed_defaults.default_location_latitude,
        parsed_defaults.default_location_longitude,
        parsed_defaults.default_timezone,
    ) {
        (Some(name), Some(latitude), Some(longitude), Some(timezone)) => Some(crate::workspace::models::Location {
            name,
            latitude,
            longitude,
            timezone,
        }),
        _ => None,
    };

    let default = WorkspaceDefaults {
        ephemeris_engine,
        ephemeris_backend: None,
        element_colors: None,
        radix_point_colors: None,
        default_location,
        language: None,
        theme: None,
        default_house_system,
        default_bodies: parsed_defaults.default_bodies,
        default_aspects: parsed_defaults.default_aspects,
        default_aspect_orbs: parsed_defaults.default_aspect_orbs,
        default_aspect_colors: parsed_defaults.default_aspect_colors,
        aspect_line_tier_style: parsed_defaults.aspect_line_tier_style,
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

/// Update workspace-level defaults in `workspace.yaml` without rewriting chart files.
#[tauri::command]
pub async fn save_workspace_defaults(
    workspace_path: String,
    defaults: SaveWorkspaceDefaultsInput,
) -> Result<serde_json::Value, String> {
    let base = Path::new(&workspace_path);
    let mut manifest = load_workspace_manifest(base)?;
    apply_workspace_defaults_patch(&mut manifest.default, defaults);
    write_workspace_manifest(base, &manifest)?;
    get_workspace_defaults(workspace_path).await
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

/// Import an existing chart file into the active workspace.
#[tauri::command]
pub async fn import_chart(workspace_path: String, source_path: String) -> Result<String, String> {
    let base = Path::new(&workspace_path);
    let mut manifest = load_workspace_manifest(base)?;
    let source = Path::new(&source_path);

    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().to_ascii_lowercase());

    let chart = match extension.as_deref() {
        Some("yml" | "yaml") => read_importable_chart_yaml(source)?,
        Some("sfs") => {
            return Err(
                "StarFisher/SFS import is not implemented in Rust yet. Use the Python-backed import path once available."
                    .to_string(),
            )
        }
        Some(other) => {
            return Err(format!(
                "Unsupported chart import format: .{other}. Supported formats: .yml, .yaml"
            ))
        }
        None => {
            return Err(
                "Imported chart file must have a supported extension (.yml, .yaml, .sfs)"
                    .to_string(),
            )
        }
    };

    let chart_id = chart.id.clone();
    if find_chart_ref_by_id(base, &manifest, &chart_id)?.is_some() {
        return Err(format!("Chart {} already exists", chart_id));
    }

    let rel = chart_relative_path(&chart_id);
    let chart_json =
        serde_json::to_value(&chart).map_err(|e| format!("Chart JSON serialization failed: {e}"))?;
    write_chart_yaml(base, &rel, &chart_json)?;

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
        "default_aspect_orbs": defaults.default_aspect_orbs,
        "default_aspect_colors": defaults.default_aspect_colors,
        "aspect_line_tier_style": defaults.aspect_line_tier_style,
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
    app: AppHandle,
    backend_state: State<'_, crate::backend::BackendState>,
    chart_json: serde_json::Value,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let backend = selected_compute_backend();
    let fallback_to_python = python_fallback_enabled();
    let force_python = chart_json_requires_python_precision(&chart_json);
    let backend_available = matches!(
        backend_state.availability()?,
        crate::backend::BackendAvailability::Available
    );
    match select_chart_compute_route(backend, backend_available, force_python)? {
        ComputeRoute::Rust => compute_chart_from_data_rust(chart_json),
        ComputeRoute::Python if matches!(backend, ComputeBackend::Auto) && !force_python => {
            match compute_chart_from_data_python(&app, &backend_state, chart_json.clone()).await {
                Ok(result) => Ok(normalize_chart_response(result, Some("python"))),
                Err(_err) if fallback_to_python => Ok(annotate_chart_fallback(
                    compute_chart_from_data_rust(chart_json)?,
                    "python_compute_failed_auto_fallback",
                )),
                Err(err) => Err(err),
            }
        }
        ComputeRoute::Python => compute_chart_from_data_python(&app, &backend_state, chart_json)
            .await
            .map(|result| normalize_chart_response(result, Some("python"))),
    }
}

fn compute_chart_from_data_rust(
    chart_json: serde_json::Value,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let chart: crate::workspace::models::ChartInstance =
        serde_json::from_value(chart_json).map_err(|e| format!("Invalid chart payload: {}", e))?;
    build_chart_result(&chart, None)
}

async fn compute_chart_from_data_python(
    app: &AppHandle,
    backend_state: &crate::backend::BackendState,
    chart_json: serde_json::Value,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let payload = serde_json::json!({
        "chart_json": chart_json,
    });
    let response =
        crate::backend::post_json(app, backend_state, "/charts/compute-from-data", &payload).await?;
    serde_json::from_value(response)
        .map_err(|err| format!("Failed to parse backend chart-from-data response: {err}"))
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
    let backend_available = matches!(
        backend_state.availability()?,
        crate::backend::BackendAvailability::Available
    );
    match select_chart_compute_route(backend, backend_available, force_python)? {
        ComputeRoute::Rust => compute_chart_rust(&workspace_path, &chart_id),
        ComputeRoute::Python if matches!(backend, ComputeBackend::Auto) && !force_python => {
            match compute_chart_python(&app, &backend_state, &workspace_path, &chart_id).await {
                Ok(result) => Ok(normalize_chart_response(result, Some("python"))),
                Err(_err) if fallback_to_python => Ok(annotate_chart_fallback(
                    compute_chart_rust(&workspace_path, &chart_id)?,
                    "python_compute_failed_auto_fallback",
                )),
                Err(err) => Err(err),
            }
        }
        ComputeRoute::Python => compute_chart_python(&app, &backend_state, &workspace_path, &chart_id)
            .await
            .map(|result| normalize_chart_response(result, Some("python"))),
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
    let backend_available = matches!(
        backend_state.availability()?,
        crate::backend::BackendAvailability::Available
    );

    match select_transit_compute_route(backend, backend_available)? {
        ComputeRoute::Rust => compute_transit_series_rust(
            &workspace_path,
            &chart_id,
            &start_datetime,
            &end_datetime,
            time_step_seconds,
            &transiting_objects,
            &transited_objects,
            &aspect_types,
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
                    )?,
                    "python_transit_compute_failed_auto_fallback",
                )),
                Err(err) => Err(err),
            }
        }
        ComputeRoute::Python => {
            compute_transit_series_python(
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
            .await
            .map(|result| normalize_transit_response(result, Some("python")))
        }
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
    let backend = crate::astronomy::backend_for_chart(&source_chart);

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
        "backend_used": backend.backend_id(),
        "fallback_used": false,
        "ephemeris_source": rust_ephemeris_source(&source_chart),
        "warnings": [],
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
struct AspectSpec {
    id: &'static str,
    angle: f64,
    default_orb: f64,
}

const MAJOR_ASPECTS: [AspectSpec; 6] = [
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
        id: "quincunx",
        angle: 150.0,
        default_orb: 3.0,
    },
    AspectSpec {
        id: "opposition",
        angle: 180.0,
        default_orb: 8.0,
    },
];

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RadixAxes {
    asc: f64,
    desc: f64,
    mc: f64,
    ic: f64,
}

fn rust_ephemeris_source(chart: &crate::workspace::models::ChartInstance) -> Option<String> {
    crate::astronomy::backend_for_chart(chart).ephemeris_source(chart)
}

fn merge_chart_warnings(
    existing: Option<&serde_json::Value>,
    additional: &[String],
) -> serde_json::Value {
    let mut merged: Vec<String> = existing
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    for warning in additional {
        if !merged.iter().any(|item| item == warning) {
            merged.push(warning.clone());
        }
    }

    serde_json::json!(merged)
}

fn normalize_chart_response(
    mut result: HashMap<String, serde_json::Value>,
    backend_used_fallback: Option<&str>,
) -> HashMap<String, serde_json::Value> {
    if !result.contains_key("backend_used") {
        result.insert(
            "backend_used".to_string(),
            serde_json::json!(backend_used_fallback),
        );
    }
    if !result.contains_key("fallback_used") {
        result.insert("fallback_used".to_string(), serde_json::json!(false));
    }
    if !result.contains_key("ephemeris_source") {
        result.insert("ephemeris_source".to_string(), serde_json::Value::Null);
    }
    if !result.contains_key("warnings") {
        result.insert("warnings".to_string(), serde_json::json!([]));
    }
    result
}

fn annotate_chart_fallback(
    mut result: HashMap<String, serde_json::Value>,
    warning: &str,
) -> HashMap<String, serde_json::Value> {
    result.insert("fallback_used".to_string(), serde_json::json!(true));
    let warnings = merge_chart_warnings(result.get("warnings"), &[warning.to_string()]);
    result.insert("warnings".to_string(), warnings);
    result
}

fn normalize_transit_response(
    mut result: serde_json::Value,
    backend_used_fallback: Option<&str>,
) -> serde_json::Value {
    if let Some(object) = result.as_object_mut() {
        object
            .entry("backend_used".to_string())
            .or_insert_with(|| serde_json::json!(backend_used_fallback));
        object
            .entry("fallback_used".to_string())
            .or_insert_with(|| serde_json::json!(false));
        object
            .entry("ephemeris_source".to_string())
            .or_insert(serde_json::Value::Null);
        object
            .entry("warnings".to_string())
            .or_insert_with(|| serde_json::json!([]));
    }
    result
}

fn annotate_transit_fallback(mut result: serde_json::Value, warning: &str) -> serde_json::Value {
    if let Some(object) = result.as_object_mut() {
        object.insert("fallback_used".to_string(), serde_json::json!(true));
        let warnings = merge_chart_warnings(object.get("warnings"), &[warning.to_string()]);
        object.insert("warnings".to_string(), warnings);
    }
    result
}

fn build_chart_result(
    chart: &crate::workspace::models::ChartInstance,
    aspect_types: Option<&[String]>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let backend = crate::astronomy::backend_for_chart(chart);
    let requested_objects = normalize_requested_objects(chart.config.observable_objects.as_ref());
    let computed = backend.compute_chart_data(
        chart,
        requested_objects,
    )?;
    let axes = RadixAxes {
        asc: computed.axes.asc,
        desc: computed.axes.desc,
        mc: computed.axes.mc,
        ic: computed.axes.ic,
    };
    let house_cusps = computed.house_cusps;
    let motion = computed.motion;
    let positions = computed.positions;
    let warnings = computed.warnings;
    let selected_aspects = aspect_types.or(chart.config.selected_aspects.as_deref());
    let aspects = compute_chart_aspects(&positions, &chart.config.aspect_orbs, selected_aspects);

    Ok(HashMap::from([
        ("positions".to_string(), serde_json::json!(positions)),
        ("motion".to_string(), serde_json::json!(motion)),
        ("aspects".to_string(), serde_json::json!(aspects)),
        ("axes".to_string(), serde_json::json!(axes)),
        ("house_cusps".to_string(), serde_json::json!(house_cusps)),
        ("chart_id".to_string(), serde_json::json!(chart.id)),
        (
            "backend_used".to_string(),
            serde_json::json!(backend.backend_id()),
        ),
        ("fallback_used".to_string(), serde_json::json!(false)),
        (
            "ephemeris_source".to_string(),
            serde_json::json!(rust_ephemeris_source(chart)),
        ),
        ("warnings".to_string(), serde_json::json!(warnings)),
    ]))
}

#[cfg(test)]
fn compute_radix_axes(
    chart: &crate::workspace::models::ChartInstance,
) -> Result<RadixAxes, String> {
    let backend = crate::astronomy::backend_for_chart(chart);
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
    crate::astronomy::backend_for_chart(chart)
        .compute_chart_data(chart, None)
        .map(|computed| computed.house_cusps)
        .unwrap_or_default()
}

fn compute_positions_for_chart_rust(
    chart: &crate::workspace::models::ChartInstance,
    requested_objects: Option<&Vec<String>>,
) -> Result<HashMap<String, f64>, String> {
    crate::astronomy::backend_for_chart(chart)
        .compute_chart_data(chart, normalize_requested_objects(requested_objects))
        .map(|computed| computed.positions)
}

fn normalize_requested_objects(
    requested_objects: Option<&Vec<String>>,
) -> Option<&Vec<String>> {
    match requested_objects {
        Some(list) if list.is_empty() => None,
        other => other,
    }
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ComputeRoute {
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

fn select_chart_compute_route(
    backend: ComputeBackend,
    backend_available: bool,
    force_python: bool,
) -> Result<ComputeRoute, String> {
    if force_python {
        return match backend {
            ComputeBackend::Rust => Err("Rust backend does not support precise Swiss Ephemeris/JPL chart computation yet. Use Python backend.".to_string()),
            _ if backend_available => Ok(ComputeRoute::Python),
            _ => Err("Python backend unavailable. This chart requires Python-backed computation.".to_string()),
        };
    }

    match backend {
        ComputeBackend::Rust => Ok(ComputeRoute::Rust),
        ComputeBackend::Python => {
            if backend_available {
                Ok(ComputeRoute::Python)
            } else {
                Err("Python backend unavailable; use Rust fallback where supported".to_string())
            }
        }
        ComputeBackend::Auto => {
            if backend_available {
                Ok(ComputeRoute::Python)
            } else {
                Ok(ComputeRoute::Rust)
            }
        }
    }
}

fn select_transit_compute_route(
    backend: ComputeBackend,
    backend_available: bool,
) -> Result<ComputeRoute, String> {
    match backend {
        ComputeBackend::Rust => Ok(ComputeRoute::Rust),
        ComputeBackend::Python => {
            if backend_available {
                Ok(ComputeRoute::Python)
            } else {
                Err("Python backend unavailable; use Rust fallback where supported".to_string())
            }
        }
        ComputeBackend::Auto => {
            if backend_available {
                Ok(ComputeRoute::Python)
            } else {
                Ok(ComputeRoute::Rust)
            }
        }
    }
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
            ephemeris_engine: Some(crate::workspace::models::EngineType::Swisseph),
            ephemeris_backend: None,
            element_colors: None,
            radix_point_colors: None,
            default_location: None,
            language: None,
            theme: None,
            default_house_system: None,
            default_bodies: None,
            default_aspects: None,
            default_aspect_orbs: None,
            default_aspect_colors: None,
            aspect_line_tier_style: None,
            time_system: None,
        },
        chart_presets: vec![],
        subjects: vec![],
        charts: vec![],
        layouts: vec![],
        annotations: vec![],
    }
}

fn parse_house_system(value: &str) -> Option<crate::workspace::models::HouseSystem> {
    match value {
        "Placidus" => Some(crate::workspace::models::HouseSystem::Placidus),
        "Whole Sign" => Some(crate::workspace::models::HouseSystem::WholeSign),
        "Campanus" => Some(crate::workspace::models::HouseSystem::Campanus),
        "Koch" => Some(crate::workspace::models::HouseSystem::Koch),
        "Equal" => Some(crate::workspace::models::HouseSystem::Equal),
        "Regiomontanus" => Some(crate::workspace::models::HouseSystem::Regiomontanus),
        "Vehlow" => Some(crate::workspace::models::HouseSystem::Vehlow),
        "Porphyry" => Some(crate::workspace::models::HouseSystem::Porphyry),
        "Alcabitius" => Some(crate::workspace::models::HouseSystem::Alcabitius),
        _ => None,
    }
}

fn parse_engine_type(value: &str) -> Option<crate::workspace::models::EngineType> {
    match value {
        "swisseph" => Some(crate::workspace::models::EngineType::Swisseph),
        "jyotish" => Some(crate::workspace::models::EngineType::Jyotish),
        "jpl" => Some(crate::workspace::models::EngineType::Jpl),
        "custom" => Some(crate::workspace::models::EngineType::Custom),
        _ => None,
    }
}

fn apply_workspace_defaults_patch(
    defaults: &mut crate::workspace::models::WorkspaceDefaults,
    patch: SaveWorkspaceDefaultsInput,
) {
    if let Some(value) = patch.default_house_system.as_deref() {
        defaults.default_house_system = parse_house_system(value);
    }

    if let Some(value) = patch.default_engine.as_deref() {
        if let Some(engine) = parse_engine_type(value) {
            defaults.ephemeris_engine = Some(engine);
        }
    }

    if patch.default_timezone.is_some()
        || patch.default_location_name.is_some()
        || patch.default_location_latitude.is_some()
        || patch.default_location_longitude.is_some()
    {
        let mut location = defaults.default_location.clone().unwrap_or(crate::workspace::models::Location {
            name: String::new(),
            latitude: 0.0,
            longitude: 0.0,
            timezone: "UTC".to_string(),
        });

        if let Some(value) = patch.default_location_name {
            location.name = value;
        }
        if let Some(value) = patch.default_location_latitude {
            location.latitude = value;
        }
        if let Some(value) = patch.default_location_longitude {
            location.longitude = value;
        }
        if let Some(value) = patch.default_timezone {
            location.timezone = value;
        }

        defaults.default_location = Some(location);
    }

    if let Some(value) = patch.default_bodies {
        defaults.default_bodies = Some(value);
    }
    if let Some(value) = patch.default_aspects {
        defaults.default_aspects = Some(value);
    }
    if let Some(value) = patch.default_aspect_orbs {
        defaults.default_aspect_orbs = Some(value);
    }
    if let Some(value) = patch.default_aspect_colors {
        defaults.default_aspect_colors = Some(value);
    }
    if let Some(value) = patch.aspect_line_tier_style {
        defaults.aspect_line_tier_style = Some(value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use serde_json::Value;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestWorkspaceDir {
        path: PathBuf,
    }

    impl TestWorkspaceDir {
        fn new(prefix: &str) -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be after unix epoch")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "kefer-{prefix}-{}-{unique}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("temporary test directory should be creatable");
            Self { path }
        }
    }

    impl Drop for TestWorkspaceDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn sample_workspace_path() -> String {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../backend-python/tests/sample")
            .canonicalize()
            .expect("sample workspace should exist")
            .to_string_lossy()
            .into_owned()
    }

    fn sample_chart_source_path() -> String {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../backend-python/tests/sample/charts/base-chart.yml")
            .canonicalize()
            .expect("sample chart should exist")
            .to_string_lossy()
            .into_owned()
    }

    fn sample_chart_payload(chart_id: &str) -> serde_json::Value {
        serde_json::json!({
            "id": chart_id,
            "subject": {
                "id": chart_id,
                "name": chart_id,
                "event_time": "2024-01-01T12:00:00+01:00",
                "location": {
                    "name": "Prague, CZ",
                    "latitude": 50.0875,
                    "longitude": 14.4214,
                    "timezone": "Europe/Prague"
                }
            },
            "config": {
                "mode": "NATAL",
                "house_system": "Placidus",
                "zodiac_type": "Tropical",
                "included_points": [],
                "aspect_orbs": {
                    "conjunction": 8.0,
                    "square": 6.0
                },
                "display_style": "",
                "color_theme": "",
                "override_ephemeris": null,
                "model": null,
                "engine": "swisseph",
                "ayanamsa": null,
                "observable_objects": ["sun", "moon", "asc"],
                "time_system": null
            },
            "computed_chart": null,
            "tags": ["test"]
        })
    }

    #[test]
    fn chart_route_uses_rust_when_backend_unavailable_in_auto_mode() {
        let route = select_chart_compute_route(ComputeBackend::Auto, false, false)
            .expect("auto mode should fall back to rust");
        assert_eq!(route, ComputeRoute::Rust);
    }

    #[test]
    fn chart_route_requires_python_when_precision_is_forced() {
        let err = select_chart_compute_route(ComputeBackend::Auto, false, true)
            .expect_err("forced precision should fail without python");
        assert!(err.contains("Python backend unavailable"));
    }

    #[test]
    fn chart_route_honors_python_when_available() {
        let route = select_chart_compute_route(ComputeBackend::Auto, true, true)
            .expect("python should be selected when available");
        assert_eq!(route, ComputeRoute::Python);
    }

    #[test]
    fn transit_route_uses_rust_when_backend_unavailable_in_auto_mode() {
        let route = select_transit_compute_route(ComputeBackend::Auto, false)
            .expect("auto transit mode should fall back to rust");
        assert_eq!(route, ComputeRoute::Rust);
    }

    #[test]
    fn compute_chart_rust_reads_sample_workspace() {
        let workspace_path = sample_workspace_path();
        let base = std::path::Path::new(&workspace_path);
        let manifest = load_workspace_manifest(base).expect("sample workspace manifest should load");
        let chart_rel = find_chart_ref_by_id(base, &manifest, "Base Chart")
            .expect("chart lookup should succeed")
            .expect("Base Chart should exist");
        let chart = load_chart(base, &chart_rel).expect("sample chart should load");

        let result = compute_chart_rust(&workspace_path, "Base Chart")
            .expect("sample workspace chart should compute");

        assert_eq!(result.get("chart_id"), Some(&serde_json::json!("Base Chart")));
        assert_eq!(
            result.get("backend_used"),
            Some(&serde_json::json!(
                crate::astronomy::backend_for_chart(&chart).backend_id()
            ))
        );
        assert_eq!(result.get("fallback_used"), Some(&serde_json::json!(false)));
        assert!(result.get("ephemeris_source").is_some());

        let warnings = result
            .get("warnings")
            .and_then(Value::as_array)
            .expect("warnings should be an array");
        if crate::astronomy::backend_for_chart(&chart).backend_id() == "jpl" {
            assert!(
                warnings.iter().any(|warning| warning == "true_node_not_available: anise backend uses mean node only"),
                "jpl path should surface true-node warning"
            );
        } else {
            assert!(warnings.is_empty(), "swisseph path should not emit jpl-only warnings");
        }

        let positions = result
            .get("positions")
            .and_then(Value::as_object)
            .expect("positions should be an object");
        assert!(positions.contains_key("sun"));
        assert!(positions.contains_key("moon"));

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
    fn annotate_chart_fallback_marks_result_and_preserves_existing_warnings() {
        let result = HashMap::from([
            ("backend_used".to_string(), serde_json::json!("swisseph")),
            ("fallback_used".to_string(), serde_json::json!(false)),
            (
                "warnings".to_string(),
                serde_json::json!(["partial_axes"]),
            ),
        ]);

        let annotated = annotate_chart_fallback(result, "python_compute_failed_auto_fallback");

        assert_eq!(annotated.get("fallback_used"), Some(&serde_json::json!(true)));
        assert_eq!(
            annotated.get("warnings"),
            Some(&serde_json::json!([
                "partial_axes",
                "python_compute_failed_auto_fallback"
            ]))
        );
    }

    #[test]
    fn annotate_transit_fallback_marks_result_and_preserves_existing_warnings() {
        let result = serde_json::json!({
            "backend_used": "swisseph",
            "fallback_used": false,
            "warnings": ["partial_axes"],
        });

        let annotated =
            annotate_transit_fallback(result, "python_transit_compute_failed_auto_fallback");

        assert_eq!(annotated.get("fallback_used"), Some(&serde_json::json!(true)));
        assert_eq!(
            annotated.get("warnings"),
            Some(&serde_json::json!([
                "partial_axes",
                "python_transit_compute_failed_auto_fallback"
            ]))
        );
    }

    #[test]
    fn compute_house_cusps_uses_whole_sign_boundaries() {
        let chart = load_chart(
            std::path::Path::new(&sample_workspace_path()),
            "charts/base-chart.yml",
        )
        .expect("sample chart should load");
        let mut whole_sign_chart = chart.clone();
        whole_sign_chart.config.house_system = Some(crate::workspace::models::HouseSystem::WholeSign);

        let axes = compute_radix_axes(&whole_sign_chart).expect("axes should compute");
        let cusps = compute_house_cusps(&whole_sign_chart, &axes);

        assert_eq!(cusps.len(), 12);
        let expected_first = (axes.asc / 30.0).floor() * 30.0;
        assert!((cusps[0] - expected_first).abs() < 0.000_1);
        assert!((normalize_deg(cusps[1] - cusps[0]) - 30.0).abs() < 0.000_1);
    }

    #[test]
    fn compute_transit_series_rust_applies_requested_filters() {
        let workspace_path = sample_workspace_path();
        let base = std::path::Path::new(&workspace_path);
        let manifest = load_workspace_manifest(base).expect("sample workspace manifest should load");
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
                crate::astronomy::backend_for_chart(&chart).backend_id()
            ))
        );
        assert_eq!(result.get("fallback_used"), Some(&serde_json::json!(false)));
        assert!(result.get("ephemeris_source").is_some());
        assert_eq!(result.get("warnings"), Some(&serde_json::json!([])));

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
    fn create_workspace_writes_manifest_and_charts_dir() {
        let temp = TestWorkspaceDir::new("workspace-create");
        let workspace_path = temp.path.join("project");

        let result = tauri::async_runtime::block_on(create_workspace(
            workspace_path.to_string_lossy().into_owned(),
            "Tester".to_string(),
        ))
        .expect("workspace should be created");

        assert_eq!(result, workspace_path.to_string_lossy());
        assert!(workspace_path.join("charts").is_dir());
        assert!(workspace_path.join("workspace.yaml").is_file());

        let manifest = load_workspace_manifest(&workspace_path).expect("manifest should load");
        assert_eq!(manifest.owner, "Tester");
        assert!(manifest.charts.is_empty());
    }

    #[test]
    fn get_workspace_defaults_reads_sample_workspace_defaults() {
        let defaults = tauri::async_runtime::block_on(get_workspace_defaults(sample_workspace_path()))
            .expect("sample defaults should load");

        assert_eq!(defaults.get("default_engine"), Some(&serde_json::json!("swisseph")));
        assert_eq!(defaults.get("default_bodies"), Some(&serde_json::Value::Null));
        assert_eq!(defaults.get("default_aspects"), Some(&serde_json::Value::Null));
    }

    #[test]
    fn save_workspace_defaults_updates_manifest_defaults_without_rewriting_charts() {
        let temp = TestWorkspaceDir::new("workspace-defaults");
        let workspace_path = temp.path.join("project");
        let workspace_path_str = workspace_path.to_string_lossy().into_owned();

        tauri::async_runtime::block_on(create_workspace(
            workspace_path_str.clone(),
            "Tester".to_string(),
        ))
        .expect("workspace should be created");

        let defaults = tauri::async_runtime::block_on(save_workspace_defaults(
            workspace_path_str.clone(),
            SaveWorkspaceDefaultsInput {
                default_house_system: Some("Whole Sign".to_string()),
                default_timezone: Some("Europe/Prague".to_string()),
                default_location_name: Some("Prague".to_string()),
                default_location_latitude: Some(50.0875),
                default_location_longitude: Some(14.4214),
                default_engine: Some("jpl".to_string()),
                default_bodies: Some(vec!["sun".to_string(), "moon".to_string(), "asc".to_string()]),
                default_aspects: Some(vec!["conjunction".to_string(), "trine".to_string()]),
                default_aspect_orbs: Some(HashMap::from([
                    ("conjunction".to_string(), 8.0),
                    ("trine".to_string(), 7.5),
                ])),
                ..Default::default()
            },
        ))
        .expect("workspace defaults should persist");

        assert_eq!(defaults.get("default_engine"), Some(&serde_json::json!("jpl")));
        assert_eq!(
            defaults.get("default_bodies"),
            Some(&serde_json::json!(["sun", "moon", "asc"]))
        );

        let manifest = load_workspace_manifest(&workspace_path).expect("manifest should load");
        assert!(matches!(
            manifest.default.default_house_system,
            Some(crate::workspace::models::HouseSystem::WholeSign)
        ));
        assert!(matches!(
            manifest.default.ephemeris_engine,
            Some(crate::workspace::models::EngineType::Jpl)
        ));
        assert_eq!(
            manifest
                .default
                .default_location
                .as_ref()
                .map(|location| location.timezone.as_str()),
            Some("Europe/Prague")
        );
        assert_eq!(
            manifest.default.default_bodies,
            Some(vec!["sun".to_string(), "moon".to_string(), "asc".to_string()])
        );
    }

    #[test]
    fn create_chart_registers_chart_and_loads_in_workspace_summary() {
        let temp = TestWorkspaceDir::new("chart-create");
        let workspace_path = temp.path.join("project");
        tauri::async_runtime::block_on(create_workspace(
            workspace_path.to_string_lossy().into_owned(),
            "Tester".to_string(),
        ))
        .expect("workspace should be created");

        let chart_id = tauri::async_runtime::block_on(create_chart(
            workspace_path.to_string_lossy().into_owned(),
            sample_chart_payload("Test Chart"),
        ))
        .expect("chart should be created");

        assert_eq!(chart_id, "Test Chart");
        assert!(workspace_path.join("charts/Test_Chart.yml").is_file());

        let info = tauri::async_runtime::block_on(load_workspace(
            workspace_path.to_string_lossy().into_owned(),
        ))
        .expect("workspace should load");

        assert_eq!(info.charts.len(), 1);
        assert_eq!(info.charts[0].id, "Test Chart");
        assert_eq!(info.charts[0].name, "Test Chart");
    }

    #[test]
    fn update_chart_rewrites_existing_chart_and_preserves_target_id() {
        let temp = TestWorkspaceDir::new("chart-update");
        let workspace_path = temp.path.join("project");
        let workspace_path_str = workspace_path.to_string_lossy().into_owned();

        tauri::async_runtime::block_on(create_workspace(
            workspace_path_str.clone(),
            "Tester".to_string(),
        ))
        .expect("workspace should be created");
        tauri::async_runtime::block_on(create_chart(
            workspace_path_str.clone(),
            sample_chart_payload("Original Chart"),
        ))
        .expect("chart should be created");

        let mut updated_chart = sample_chart_payload("Different Incoming Id");
        updated_chart["subject"]["name"] = serde_json::json!("Updated Name");
        updated_chart["subject"]["location"]["name"] = serde_json::json!("Brno, CZ");

        let updated_id = tauri::async_runtime::block_on(update_chart(
            workspace_path_str.clone(),
            "Original Chart".to_string(),
            updated_chart,
        ))
        .expect("chart should be updated");

        assert_eq!(updated_id, "Original Chart");

        let details = tauri::async_runtime::block_on(get_chart_details(
            workspace_path_str,
            "Original Chart".to_string(),
        ))
        .expect("updated chart details should load");

        assert_eq!(details.get("id"), Some(&serde_json::json!("Original Chart")));
        assert_eq!(
            details.pointer("/subject/name"),
            Some(&serde_json::json!("Updated Name"))
        );
        assert_eq!(
            details.pointer("/subject/location/name"),
            Some(&serde_json::json!("Brno, CZ"))
        );
    }

    #[test]
    fn import_chart_adds_external_yaml_chart_to_workspace() {
        let temp = TestWorkspaceDir::new("chart-import");
        let workspace_path = temp.path.join("project");
        let workspace_path_str = workspace_path.to_string_lossy().into_owned();

        tauri::async_runtime::block_on(create_workspace(
            workspace_path_str.clone(),
            "Tester".to_string(),
        ))
        .expect("workspace should be created");

        let imported_id = tauri::async_runtime::block_on(import_chart(
            workspace_path_str.clone(),
            sample_chart_source_path(),
        ))
        .expect("yaml chart should import");

        assert_eq!(imported_id, "Base Chart");
        assert!(workspace_path.join("charts/Base_Chart.yml").is_file());

        let info = tauri::async_runtime::block_on(load_workspace(workspace_path_str))
            .expect("workspace should load after import");
        assert_eq!(info.charts.len(), 1);
        assert_eq!(info.charts[0].id, "Base Chart");
    }

    #[test]
    fn import_chart_rejects_duplicate_chart_ids() {
        let temp = TestWorkspaceDir::new("chart-import-duplicate");
        let workspace_path = temp.path.join("project");
        let workspace_path_str = workspace_path.to_string_lossy().into_owned();

        tauri::async_runtime::block_on(create_workspace(
            workspace_path_str.clone(),
            "Tester".to_string(),
        ))
        .expect("workspace should be created");

        tauri::async_runtime::block_on(import_chart(
            workspace_path_str.clone(),
            sample_chart_source_path(),
        ))
        .expect("first import should succeed");

        let err = tauri::async_runtime::block_on(import_chart(
            workspace_path_str,
            sample_chart_source_path(),
        ))
        .expect_err("duplicate import should fail");

        assert!(err.contains("already exists"));
    }

    #[test]
    fn import_chart_rejects_unsupported_sfs_until_backend_path_exists() {
        let temp = TestWorkspaceDir::new("chart-import-sfs");
        let workspace_path = temp.path.join("project");
        let workspace_path_str = workspace_path.to_string_lossy().into_owned();
        let source_path = temp.path.join("sample.sfs");
        fs::write(&source_path, "_settings.Model.DefaultHouseSystem = \"Placidus\";\n")
            .expect("temporary sfs file should be writable");

        tauri::async_runtime::block_on(create_workspace(
            workspace_path_str.clone(),
            "Tester".to_string(),
        ))
        .expect("workspace should be created");

        let err = tauri::async_runtime::block_on(import_chart(
            workspace_path_str,
            source_path.to_string_lossy().into_owned(),
        ))
        .expect_err("sfs import should remain staged");

        assert!(err.contains("StarFisher/SFS import is not implemented in Rust yet"));
    }

    #[test]
    fn select_nominatim_result_returns_first_candidate() {
        let candidates = vec![NominatimSearchResult {
            display_name: "Prague, Czechia".to_string(),
            lat: "50.0875".to_string(),
            lon: "14.4214".to_string(),
        }];

        let result = select_nominatim_result("Prague", &candidates)
            .expect("candidate should resolve");

        assert_eq!(result.display_name, "Prague, Czechia");
        assert_eq!(result.latitude, 50.0875);
        assert_eq!(result.longitude, 14.4214);
    }

    #[test]
    fn select_nominatim_result_rejects_empty_candidate_list() {
        let err = select_nominatim_result("Unknown", &[])
            .expect_err("empty result list should fail");
        assert!(err.contains("No location results found"));
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

fn read_importable_chart_yaml(path: &Path) -> Result<crate::workspace::models::ChartInstance, String> {
    use std::fs;

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read import file {}: {}", path.display(), e))?;
    serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse chart YAML {}: {}", path.display(), e))
}

#[cfg(test)]
fn select_nominatim_result(
    query: &str,
    candidates: &[NominatimSearchResult],
) -> Result<GeocodedLocation, String> {
    select_nominatim_results(query, candidates)?
        .into_iter()
        .next()
        .ok_or_else(|| format!("No location results found for '{query}'"))
}

fn select_nominatim_results(
    query: &str,
    candidates: &[NominatimSearchResult],
) -> Result<Vec<GeocodedLocation>, String> {
    if candidates.is_empty() {
        return Err(format!("No location results found for '{query}'"));
    }

    candidates
        .iter()
        .map(|candidate| {
            let latitude = candidate
                .lat
                .parse::<f64>()
                .map_err(|err| format!("Invalid latitude returned by geocoder: {err}"))?;
            let longitude = candidate
                .lon
                .parse::<f64>()
                .map_err(|err| format!("Invalid longitude returned by geocoder: {err}"))?;

            Ok(GeocodedLocation {
                query: query.to_string(),
                display_name: candidate.display_name.clone(),
                latitude,
                longitude,
            })
        })
        .collect()
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
