use crate::application::workspace::{
    extract_chart_id, upsert_chart_id, validate_chart_instance, validate_chart_payload,
};
use crate::workspace::loader::find_chart_ref_by_id;
use crate::workspace::writer::{
    chart_relative_path, sanitize_chart_filename, write_chart_yaml, write_workspace_manifest,
};
use crate::workspace::{load_all_charts, load_workspace_manifest};
use std::path::Path;

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
mod tests {
    use super::*;
    use crate::commands::workspace::create_workspace;
    use crate::test_support::{sample_chart_payload, sample_chart_source_path, TestWorkspaceDir};
    use std::fs;

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

        let info = tauri::async_runtime::block_on(crate::commands::workspace::load_workspace(
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

        let info = tauri::async_runtime::block_on(crate::commands::workspace::load_workspace(
            workspace_path_str,
        ))
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
}
