use crate::application::workspace::non_empty_str;
use crate::workspace::loader::{find_chart_ref_by_id, load_chart};
use crate::workspace::writer::write_workspace_manifest;
use crate::workspace::{
    chart_to_summary, load_all_charts, load_workspace_manifest, ChartSummary, CurrentModelReport,
    WorkspaceInfo, WorkspaceValidationReport,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;

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
        crate::application::workspace::validate_chart_payload(chart)?;
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
    use crate::commands::charts::create_chart;
    use crate::test_support::{sample_chart_payload, sample_workspace_path, TestWorkspaceDir};

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
}
