use crate::workspace::loader::load_chart;
use crate::workspace::{
    chart_to_summary, load_all_charts, load_workspace_manifest, ChartSummary, CurrentModelReport,
    TransitSetup, WorkspaceInfo, WorkspaceValidationReport,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;
use std::sync::OnceLock;
use tauri::{AppHandle, State};

const DEFAULT_GEOCODER_SEARCH_URL: &str = "https://nominatim.openstreetmap.org/search";
const GEOCODER_USER_AGENT: &str = "KeferAstrology/2.0 (desktop geocoding)";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeocodedLocation {
    pub query: String,
    pub display_name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
}

static TIMEZONE_FINDER: OnceLock<tzf_rs::DefaultFinder> = OnceLock::new();

fn timezone_for_coordinates(latitude: f64, longitude: f64) -> Result<String, String> {
    if !latitude.is_finite() || !(-90.0..=90.0).contains(&latitude) {
        return Err("Latitude must be between -90 and 90 degrees".to_string());
    }
    if !longitude.is_finite() || !(-180.0..=180.0).contains(&longitude) {
        return Err("Longitude must be between -180 and 180 degrees".to_string());
    }

    let finder = TIMEZONE_FINDER.get_or_init(tzf_rs::DefaultFinder::new);
    let timezone = finder.get_tz_name(longitude, latitude).trim();
    if timezone.is_empty() {
        Err(format!(
            "No timezone found for coordinates {latitude}, {longitude}"
        ))
    } else {
        Ok(timezone.to_string())
    }
}

/// Resolve an IANA timezone name from geographic coordinates.
#[tauri::command]
pub fn resolve_timezone(latitude: f64, longitude: f64) -> Result<String, String> {
    timezone_for_coordinates(latitude, longitude)
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
        // Linux: prefer a native Tk folder picker when available, then fall back to common desktop helpers.
        let python_dialogs = vec!["python3", "python"];
        let python_script = r#"
import sys
try:
    import tkinter as tk
    from tkinter import filedialog
except Exception:
    sys.exit(1)
root = tk.Tk()
root.withdraw()
try:
    root.attributes('-topmost', True)
except Exception:
    pass
path = filedialog.askdirectory(title='Select Workspace Folder')
print(path or '', end='')
"#;

        for python in python_dialogs {
            if let Ok(output) = Command::new(python).args(["-c", python_script]).output() {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Ok(Some(path));
                    }
                }
            }
        }

        // Fall back to common Linux dialog tools when Python/Tk is unavailable.
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

        Err(
            "No native folder picker was available. Install python3-tk, zenity, kdialog, or yad."
                .to_string(),
        )
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
    use std::fs;
    use std::path::Path;

    let base = Path::new(&workspace_path);
    let charts_dir = base.join("charts");
    fs::create_dir_all(&charts_dir).map_err(|e| format!("Failed to create charts dir: {}", e))?;
    fs::create_dir_all(base.join("transits"))
        .map_err(|e| format!("Failed to create transits dir: {}", e))?;

    let mut chart_refs = Vec::new();
    for chart in &charts {
        validate_chart_payload(chart)?;
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

    // Saving an open workspace is an update, not an export. Preserve model
    // catalogs, school definitions, definition overrides, referenced entities,
    // presentation settings, and extension fields represented by the contract.
    let manifest_path = base.join("workspace.yaml");
    let mut manifest = if manifest_path.exists() {
        load_workspace_manifest(base)?
    } else {
        empty_workspace_manifest(&owner)
    };
    manifest.owner = if owner.is_empty() {
        manifest.owner
    } else {
        owner
    };
    manifest.charts = chart_refs;
    if let Some(defaults) = defaults {
        apply_workspace_presentation_patch(&mut manifest.presentation, &defaults);
        apply_workspace_defaults_patch(&mut manifest.default, defaults);
    }
    if let Some(location) = manifest.default.default_location.as_ref() {
        crate::workspace::models::validate_location(location)?;
    }
    let manifest_yaml =
        serde_yaml::to_string(&manifest).map_err(|e| format!("Manifest YAML: {}", e))?;
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
    apply_workspace_presentation_patch(&mut manifest.presentation, &defaults);
    apply_workspace_defaults_patch(&mut manifest.default, defaults);
    if let Some(location) = manifest.default.default_location.as_ref() {
        crate::workspace::models::validate_location(location)?;
    }
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
    fs::create_dir_all(base.join("transits"))
        .map_err(|e| format!("Failed to create transits dir: {}", e))?;

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

/// Persist the transit form state for one source chart without storing computed output.
#[tauri::command]
pub async fn save_transit_setup(
    workspace_path: String,
    setup: TransitSetup,
) -> Result<TransitSetup, String> {
    use std::fs;

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

    let transits_dir = base.join("transits");
    fs::create_dir_all(&transits_dir)
        .map_err(|e| format!("Failed to create transits dir: {}", e))?;
    let relative_path = format!(
        "transits/{}.yml",
        sanitize_chart_filename(&setup.source_chart_id)
    );
    let path = base.join(&relative_path);
    let yaml = serde_yaml::to_string(&setup)
        .map_err(|e| format!("Transit setup YAML serialization failed: {}", e))?;
    fs::write(&path, yaml)
        .map_err(|e| format!("Write transit setup {} failed: {}", path.display(), e))?;
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
    validate_chart_payload(&chart)?;
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
    validate_chart_instance(&chart)?;
    if find_chart_ref_by_id(base, &manifest, &chart_id)?.is_some() {
        return Err(format!("Chart {} already exists", chart_id));
    }

    let rel = chart_relative_path(&chart_id);
    let chart_json = serde_json::to_value(&chart)
        .map_err(|e| format!("Chart JSON serialization failed: {e}"))?;
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
    validate_chart_payload(&chart)?;
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

    let transit_setup_rel = format!("transits/{}.yml", sanitize_chart_filename(&chart_id));
    manifest.charts.retain(|p| p != &rel);
    manifest
        .transit_analyses
        .retain(|path| path != &transit_setup_rel);
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

    let transit_setup_path = base.join(transit_setup_rel);
    if transit_setup_path.exists() {
        fs::remove_file(&transit_setup_path).map_err(|e| {
            format!(
                "Failed to delete transit setup {}: {}",
                transit_setup_path.display(),
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

/// Validate the complete typed workspace aggregate without silently dropping
/// malformed referenced items.
#[tauri::command]
pub async fn validate_workspace(
    workspace_path: String,
) -> Result<WorkspaceValidationReport, String> {
    Ok(crate::workspace::load_workspace_aggregate(Path::new(&workspace_path))?.validation_report())
}

/// Load workspace default settings from workspace.yaml.
#[tauri::command]
pub async fn get_workspace_defaults(workspace_path: String) -> Result<serde_json::Value, String> {
    use serde_json::json;

    let workspace_dir = Path::new(&workspace_path);
    let manifest = load_workspace_manifest(workspace_dir)?;
    let presentation = manifest.presentation;
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
        "default_aspect_colors": presentation.aspect_colors.or(defaults.default_aspect_colors),
        "aspect_line_tier_style": presentation.aspect_line_tier_style.or(defaults.aspect_line_tier_style),
        "time_system": defaults.time_system,
    }))
}

/// Report the resolved workspace/chart model catalog and effective settings.
#[tauri::command]
pub async fn get_current_model_report(
    workspace_path: String,
    chart_id: Option<String>,
) -> Result<CurrentModelReport, String> {
    let workspace_dir = Path::new(&workspace_path);
    let manifest = load_workspace_manifest(workspace_dir)?;
    let chart = match chart_id.as_deref().and_then(non_empty_str) {
        Some(chart_id) => {
            let rel = find_chart_ref_by_id(workspace_dir, &manifest, chart_id)?
                .ok_or_else(|| format!("Chart {} not found in workspace", chart_id))?;
            Some(load_chart(workspace_dir, &rel)?)
        }
        None => None,
    };

    Ok(crate::workspace::current_model_report(
        &manifest,
        chart.as_ref().map(|chart| &chart.config),
    ))
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

    let ayanamsa_str = chart.config.ayanamsa.as_ref().map(|a| match a {
        crate::workspace::models::Ayanamsa::Lahiri => "Lahiri",
        crate::workspace::models::Ayanamsa::Raman => "Raman",
        crate::workspace::models::Ayanamsa::Krishnamurti => "Krishnamurti",
        crate::workspace::models::Ayanamsa::FaganBradley => "FaganBradley",
        crate::workspace::models::Ayanamsa::DeLuce => "DeLuce",
        crate::workspace::models::Ayanamsa::UserDefined => "UserDefined",
    });

    let time_system_str = chart.config.time_system.as_ref().map(|t| match t {
        crate::workspace::models::TimeSystem::Gregorian => "gregorian",
        crate::workspace::models::TimeSystem::JulianDay => "julian_day",
        crate::workspace::models::TimeSystem::JulianCalendar => "julian_calendar",
        crate::workspace::models::TimeSystem::UnixTimestamp => "unix_timestamp",
        crate::workspace::models::TimeSystem::OrdinalDate => "ordinal_date",
        crate::workspace::models::TimeSystem::IsoWeekDate => "iso_week_date",
        crate::workspace::models::TimeSystem::CompactDate => "compact_date",
    });

    Ok(json!({
        "id": chart.id,
        "subject": {
            "id": chart.subject.id,
            "name": chart.subject.name,
            "event_time": chart.subject.event_time.map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)),
            "location": {
                "name": chart.subject.location.name,
                "latitude": chart.subject.location.latitude,
                "longitude": chart.subject.location.longitude,
                "timezone": chart.subject.location.timezone,
                "utc_offset": chart.subject.location.utc_offset,
                "location_mode": chart.subject.location.location_mode,
                "timezone_mode": chart.subject.location.timezone_mode,
            }
        },
        "config": {
            "mode": mode_str,
            "house_system": house_system_str,
            "zodiac_type": zodiac_type_str,
            "engine": engine_str,
            "model": chart.config.model,
            "model_overrides": chart.config.model_overrides,
            "override_ephemeris": chart.config.override_ephemeris,
            "included_points": chart.config.included_points,
            "observable_objects": chart.config.observable_objects,
            "aspect_orbs": chart.config.aspect_orbs,
            "selected_aspects": chart.config.selected_aspects,
            "ayanamsa": ayanamsa_str,
            "time_system": time_system_str,
            "display_style": chart.config.display_style,
            "color_theme": chart.config.color_theme,
        },
        "tags": chart.tags,
        "tag_colors": chart.tag_colors,
        "roden_rating": chart.roden_rating,
    }))
}

/// Compute chart positions and aspects from in-memory chart data (no workspace on disk).
#[tauri::command]
pub async fn compute_chart_from_data(
    app: AppHandle,
    backend_state: State<'_, crate::backend::BackendState>,
    chart_json: serde_json::Value,
    settings_overrides: Option<crate::workspace::settings::SettingsLayer>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    validate_chart_payload(&chart_json)?;
    let backend = selected_compute_backend();
    let fallback_to_python = python_fallback_enabled();
    let force_python = chart_json_requires_python_precision(&chart_json);
    let backend_available = matches!(
        backend_state.availability()?,
        crate::backend::BackendAvailability::Available
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
) -> Result<Vec<crate::astrology::ComputedAspect>, String> {
    validate_chart_payload(&chart_json)?;
    let chart: crate::workspace::models::ChartInstance =
        serde_json::from_value(chart_json).map_err(|e| format!("Invalid chart payload: {}", e))?;
    let report = crate::workspace::settings::standalone_model_report_with_operation(
        &chart.config,
        settings_overrides.as_ref(),
    );
    Ok(crate::astrology::compute_cross_aspects(
        &transiting_positions,
        &transited_positions,
        &report.model.aspect_definitions,
        &report.effective_settings.aspect_orbs,
        &aspect_types,
    ))
}

async fn compute_chart_from_data_python(
    app: &AppHandle,
    backend_state: &crate::backend::BackendState,
    chart_json: serde_json::Value,
    settings_overrides: Option<&crate::workspace::settings::SettingsLayer>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let payload = serde_json::json!({
        "chart_json": chart_json,
        "settings_overrides": settings_overrides,
    });
    let response =
        crate::backend::post_json(app, backend_state, "/charts/compute-from-data", &payload)
            .await?;
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
    preset_id: Option<String>,
    settings_overrides: Option<crate::workspace::settings::SettingsLayer>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let backend = selected_compute_backend();
    let fallback_to_python = python_fallback_enabled();
    let force_python = chart_requires_python_precision(&workspace_path, &chart_id).unwrap_or(false);
    let backend_available = matches!(
        backend_state.availability()?,
        crate::backend::BackendAvailability::Available
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
    backend_state: &crate::backend::BackendState,
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
    preset_id: Option<String>,
    settings_overrides: Option<crate::workspace::settings::SettingsLayer>,
) -> Result<serde_json::Value, String> {
    let backend = selected_compute_backend();
    let fallback_to_python = python_fallback_enabled();
    let backend_available = matches!(
        backend_state.availability()?,
        crate::backend::BackendAvailability::Available
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

    let base = Path::new(workspace_path);
    let manifest = load_workspace_manifest(base)?;
    let chart_rel = find_chart_ref_by_id(base, &manifest, chart_id)?
        .ok_or_else(|| format!("Chart {} not found", chart_id))?;
    let source_chart = load_chart(base, &chart_rel)?;
    let preset = resolve_settings_preset(base, &manifest, preset_id)?;
    let report = crate::workspace::settings::current_model_report_with_layers(
        &manifest,
        preset.as_ref(),
        Some(&source_chart.config),
        settings_overrides,
    );
    let request = crate::application::transit::TransitSeriesRequest {
        resolved_chart: crate::application::computation::ResolvedChart::from_report(
            source_chart,
            report,
        ),
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
    crate::backend::post_json(app, backend_state, "/transits/compute-series", &payload).await
}

#[cfg(test)]
#[derive(Debug, Clone, Serialize, Deserialize)]
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

fn resolve_settings_preset(
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
    crate::lunar_phase::inject_moon_details_into_chart_map(&mut result);
    crate::astrology::inject_shapes_and_configurations_into_chart_map(&mut result);
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

/// Only Jyotish and Custom require Python; JPL and Swisseph can run through Rust.
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

    matches!(engine.as_deref(), Some("jyotish" | "custom")) || has_override_ephemeris
}

fn chart_requires_python_precision(workspace_path: &str, chart_id: &str) -> Result<bool, String> {
    let base = Path::new(workspace_path);
    let manifest = load_workspace_manifest(base)?;
    let chart_rel = find_chart_ref_by_id(base, &manifest, chart_id)?
        .ok_or_else(|| format!("Chart {} not found", chart_id))?;
    let chart = load_chart(base, &chart_rel)?;

    // Only Jyotish and Custom require Python; JPL and Swisseph can use Rust.
    let requires = matches!(
        chart.config.engine,
        Some(
            crate::workspace::models::EngineType::Jyotish
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
            ComputeBackend::Rust => Err(
                "Rust backend does not support this chart type yet. Use Python backend."
                    .to_string(),
            ),
            _ if backend_available => Ok(ComputeRoute::Python),
            _ => Err(
                "Python backend unavailable. This chart requires Python-backed computation."
                    .to_string(),
            ),
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
        schema_version: 1,
        owner: owner_value,
        active_school: None,
        active_model: None,
        schools: HashMap::new(),
        aspects: vec![],
        bodies: vec![],
        models: HashMap::new(),
        model_overrides: None,
        default: crate::workspace::models::WorkspaceDefaults {
            ephemeris_engine: Some(crate::workspace::models::EngineType::Jpl),
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
        presentation: crate::workspace::models::WorkspacePresentation::default(),
        chart_presets: vec![],
        subjects: vec![],
        charts: vec![],
        layouts: vec![],
        annotations: vec![],
        transit_analyses: vec![],
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

fn non_empty_str(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
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
        let mut location =
            defaults
                .default_location
                .clone()
                .unwrap_or(crate::workspace::models::Location {
                    name: String::new(),
                    latitude: 0.0,
                    longitude: 0.0,
                    timezone: "UTC".to_string(),
                    utc_offset: None,
                    location_mode: None,
                    timezone_mode: None,
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

fn apply_workspace_presentation_patch(
    presentation: &mut crate::workspace::models::WorkspacePresentation,
    patch: &SaveWorkspaceDefaultsInput,
) {
    if let Some(value) = patch.default_aspect_colors.as_ref() {
        presentation.aspect_colors = Some(value.clone());
    }
    if let Some(value) = patch.aspect_line_tier_style.as_ref() {
        presentation.aspect_line_tier_style = Some(value.clone());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::fs;
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
            let path = std::env::temp_dir()
                .join(format!("kefer-{prefix}-{}-{unique}", std::process::id()));
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
                "engine": "jpl",
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
    fn layered_requests_use_the_selected_backend_after_python_parity() {
        assert_eq!(
            select_chart_compute_route(ComputeBackend::Auto, true, false)
                .expect("auto should route layered computation normally"),
            ComputeRoute::Python
        );
        assert_eq!(
            select_transit_compute_route(ComputeBackend::Python, true)
                .expect("python should accept layered transit computation"),
            ComputeRoute::Python
        );
    }

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
            Some(&serde_json::json!(crate::astronomy::backend_for_chart(
                &chart
            )
            .backend_id()))
        );
        assert_eq!(result.get("fallback_used"), Some(&serde_json::json!(false)));
        assert!(result.get("ephemeris_source").is_some());

        let warnings = result
            .get("warnings")
            .and_then(Value::as_array)
            .expect("warnings should be an array");
        if crate::astronomy::backend_for_chart(&chart).backend_id() == "jpl" {
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
        tauri::async_runtime::block_on(create_chart(
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
        write_workspace_manifest(&workspace_path, &manifest)
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
    fn annotate_chart_fallback_marks_result_and_preserves_existing_warnings() {
        let result = HashMap::from([
            ("backend_used".to_string(), serde_json::json!("swisseph")),
            ("fallback_used".to_string(), serde_json::json!(false)),
            ("warnings".to_string(), serde_json::json!(["partial_axes"])),
        ]);

        let annotated = annotate_chart_fallback(result, "python_compute_failed_auto_fallback");

        assert_eq!(
            annotated.get("fallback_used"),
            Some(&serde_json::json!(true))
        );
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

        assert_eq!(
            annotated.get("fallback_used"),
            Some(&serde_json::json!(true))
        );
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
        whole_sign_chart.config.house_system =
            Some(crate::workspace::models::HouseSystem::WholeSign);

        let axes = compute_radix_axes(&whole_sign_chart).expect("axes should compute");
        let cusps = compute_house_cusps(&whole_sign_chart, &axes);

        assert_eq!(cusps.len(), 12);
        let expected_first = (axes.asc / 30.0).floor() * 30.0;
        assert!((cusps[0] - expected_first).abs() < 0.000_1);
        assert!((crate::houses::normalize_deg(cusps[1] - cusps[0]) - 30.0).abs() < 0.000_1);
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
            Some(&serde_json::json!(crate::astronomy::backend_for_chart(
                &chart
            )
            .backend_id()))
        );
        assert_eq!(result.get("fallback_used"), Some(&serde_json::json!(false)));
        assert!(result.get("ephemeris_source").is_some());
        let expected_warnings =
            crate::workspace::current_model_report(&manifest, Some(&chart.config)).warnings;
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
        assert!(workspace_path.join("transits").is_dir());
        assert!(workspace_path.join("workspace.yaml").is_file());

        let manifest = load_workspace_manifest(&workspace_path).expect("manifest should load");
        assert_eq!(manifest.owner, "Tester");
        assert!(manifest.charts.is_empty());
    }

    #[test]
    fn workspace_validation_reports_missing_references_and_duplicate_ids() {
        let temp = TestWorkspaceDir::new("workspace-validation");
        let workspace_path = temp.path.join("project");
        let workspace_path_string = workspace_path.to_string_lossy().into_owned();
        tauri::async_runtime::block_on(create_workspace(
            workspace_path_string.clone(),
            "Validator".to_string(),
        ))
        .expect("workspace should be created");
        tauri::async_runtime::block_on(create_chart(
            workspace_path_string.clone(),
            sample_chart_payload("Validation Chart"),
        ))
        .expect("chart should be created");

        let mut manifest = load_workspace_manifest(&workspace_path).expect("manifest should load");
        let existing_chart = manifest.charts[0].clone();
        manifest.charts.push(existing_chart);
        manifest.charts.push("charts/missing.yml".to_string());
        write_workspace_manifest(&workspace_path, &manifest)
            .expect("invalid fixture manifest should be written");

        let report = tauri::async_runtime::block_on(validate_workspace(workspace_path_string))
            .expect("validation should return a report");
        let codes: std::collections::HashSet<&str> = report
            .diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_str())
            .collect();

        assert!(!report.valid);
        assert_eq!(report.counts.charts, 2);
        assert!(codes.contains("duplicate_chart_id"));
        assert!(codes.contains("referenced_item_load_failed"));
    }

    #[test]
    fn get_workspace_defaults_reads_sample_workspace_defaults() {
        let defaults =
            tauri::async_runtime::block_on(get_workspace_defaults(sample_workspace_path()))
                .expect("sample defaults should load");

        assert_eq!(
            defaults.get("default_engine"),
            Some(&serde_json::json!("swisseph"))
        );
        assert_eq!(
            defaults.get("default_bodies"),
            Some(&serde_json::Value::Null)
        );
        assert_eq!(
            defaults.get("default_aspects"),
            Some(&serde_json::Value::Null)
        );
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
                default_bodies: Some(vec![
                    "sun".to_string(),
                    "moon".to_string(),
                    "asc".to_string(),
                ]),
                default_aspects: Some(vec!["conjunction".to_string(), "trine".to_string()]),
                default_aspect_orbs: Some(HashMap::from([
                    ("conjunction".to_string(), 8.0),
                    ("trine".to_string(), 7.5),
                ])),
                ..Default::default()
            },
        ))
        .expect("workspace defaults should persist");

        assert_eq!(
            defaults.get("default_engine"),
            Some(&serde_json::json!("jpl"))
        );
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
            Some(vec![
                "sun".to_string(),
                "moon".to_string(),
                "asc".to_string()
            ])
        );
    }

    #[test]
    fn save_workspace_preserves_the_complete_manifest_contract() {
        let temp = TestWorkspaceDir::new("manifest-preservation");
        let workspace_path = temp.path.join("project");
        let workspace_path_string = workspace_path.to_string_lossy().into_owned();
        tauri::async_runtime::block_on(create_workspace(
            workspace_path_string.clone(),
            "Original owner".to_string(),
        ))
        .expect("workspace should be created");

        let mut manifest = load_workspace_manifest(&workspace_path).expect("manifest should load");
        let mut model = crate::workspace::builtin_standard_model("traditional-default");
        model.school = Some("traditional".to_string());
        manifest.models.insert(model.name.clone(), model);
        manifest.schools.insert(
            "traditional".to_string(),
            crate::workspace::models::AstrologySchool {
                id: "traditional".to_string(),
                extends: None,
                default_model: "traditional-default".to_string(),
            },
        );
        manifest.active_school = Some("traditional".to_string());
        manifest.model_overrides = Some(crate::workspace::models::ModelOverrides {
            points: vec![crate::workspace::models::OverrideEntry {
                id: "pluto".to_string(),
                glyph: None,
                angle: None,
                default_orb: None,
                only_for: Some(vec!["traditional".to_string()]),
                i18n: None,
                computed: Some(true),
                enabled: Some(false),
                valid_contexts: None,
                interpretation_weight: None,
            }],
            aspects: Vec::new(),
            override_orbs: HashMap::new(),
        });
        manifest.presentation.glyph_set = Some("classic".to_string());
        write_workspace_manifest(&workspace_path, &manifest).expect("fixture manifest write");

        tauri::async_runtime::block_on(save_workspace(
            workspace_path_string,
            "Updated owner".to_string(),
            vec![sample_chart_payload("Preserved Chart")],
            None,
        ))
        .expect("workspace save should succeed");

        let persisted = load_workspace_manifest(&workspace_path).expect("manifest should reload");
        assert_eq!(persisted.owner, "Updated owner");
        assert_eq!(persisted.active_school.as_deref(), Some("traditional"));
        assert!(persisted.models.contains_key("traditional-default"));
        let point_override = &persisted
            .model_overrides
            .as_ref()
            .expect("model overrides should survive")
            .points[0];
        assert_eq!(point_override.computed, Some(true));
        assert_eq!(point_override.enabled, Some(false));
        assert_eq!(persisted.presentation.glyph_set.as_deref(), Some("classic"));
        assert_eq!(persisted.charts, vec!["charts/Preserved_Chart.yml"]);
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

        tauri::async_runtime::block_on(delete_chart(
            workspace_path_string,
            "Transit Source".to_string(),
        ))
        .expect("chart should be deleted");
        assert!(!workspace_path.join("transits/Transit_Source.yml").exists());
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

        assert_eq!(
            details.get("id"),
            Some(&serde_json::json!("Original Chart"))
        );
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
        fs::write(
            &source_path,
            "_settings.Model.DefaultHouseSystem = \"Placidus\";\n",
        )
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

        let result =
            select_nominatim_result("Prague", &candidates).expect("candidate should resolve");

        assert_eq!(result.display_name, "Prague, Czechia");
        assert_eq!(result.latitude, 50.0875);
        assert_eq!(result.longitude, 14.4214);
        assert_eq!(result.timezone, "Europe/Prague");
    }

    #[test]
    fn timezone_resolution_uses_coordinate_order() {
        assert_eq!(
            timezone_for_coordinates(50.0875, 14.4214).expect("Prague timezone should resolve"),
            "Europe/Prague"
        );
    }

    #[test]
    fn auto_timezone_must_match_chart_coordinates() {
        let mut payload = sample_chart_payload("auto-timezone");
        payload["subject"]["location"]["timezone_mode"] = serde_json::json!("auto");
        payload["subject"]["location"]["timezone"] = serde_json::json!("UTC");

        let error = validate_chart_payload(&payload)
            .expect_err("mismatched auto timezone should be rejected");
        assert!(error.contains("expected 'Europe/Prague'"));
    }

    #[test]
    fn select_nominatim_result_rejects_empty_candidate_list() {
        let err =
            select_nominatim_result("Unknown", &[]).expect_err("empty result list should fail");
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

fn validate_chart_payload(
    chart: &serde_json::Value,
) -> Result<crate::workspace::models::ChartInstance, String> {
    let parsed: crate::workspace::models::ChartInstance = serde_json::from_value(chart.clone())
        .map_err(|error| format!("Invalid chart payload: {error}"))?;
    validate_chart_instance(&parsed)?;
    Ok(parsed)
}

fn validate_chart_instance(chart: &crate::workspace::models::ChartInstance) -> Result<(), String> {
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
        let expected = timezone_for_coordinates(
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

fn read_importable_chart_yaml(
    path: &Path,
) -> Result<crate::workspace::models::ChartInstance, String> {
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
                timezone: timezone_for_coordinates(latitude, longitude)?,
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
