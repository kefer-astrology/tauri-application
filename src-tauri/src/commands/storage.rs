//! DuckDB-backed workspace storage is **disabled** while the React UI is the focus.
//! These commands stay registered so `invoke` from the frontend does not break.
//! `init_storage` still creates `data/`; queries return empty results; writes are no-ops.

use crate::storage::models::{
    AspectData, PositionData, PositionRow, RadixRelativeRow, RelationData,
};
use std::collections::HashMap;
use std::path::PathBuf;

#[tauri::command]
pub async fn init_storage(workspace_path: String) -> Result<String, String> {
    let workspace_dir = PathBuf::from(&workspace_path);
    let data_dir = workspace_dir.join("data");
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;
    let db_path = data_dir.join("workspace.db");
    let s = db_path.to_str().ok_or("Invalid database path")?.to_string();
    log::info!(
        "Storage (DuckDB) disabled: ensured data dir at {}",
        data_dir.display()
    );
    Ok(s)
}

#[tauri::command]
pub async fn store_positions(
    workspace_path: String,
    chart_id: String,
    _datetime: String,
    _positions: HashMap<String, PositionData>,
    _engine: String,
) -> Result<(), String> {
    log::debug!("store_positions (no-op) workspace={workspace_path} chart={chart_id}");
    Ok(())
}

#[tauri::command]
pub async fn query_positions(
    _workspace_path: String,
    _chart_id: String,
    _start_datetime: Option<String>,
    _end_datetime: Option<String>,
    _use_parquet: bool,
) -> Result<Vec<PositionRow>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn store_relation(workspace_path: String, relation: RelationData) -> Result<(), String> {
    log::debug!(
        "store_relation (no-op) workspace={workspace_path} id={}",
        relation.relation_id
    );
    Ok(())
}

#[tauri::command]
pub async fn query_aspects(
    _workspace_path: String,
    _relation_id: String,
    _start: String,
    _end: String,
    _aspect_types: Option<Vec<String>>,
) -> Result<Vec<AspectData>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn compute_aspects(
    _workspace_path: String,
    _chart_id: String,
    _datetime: String,
    _aspect_types: Vec<String>,
    _max_orb: f64,
) -> Result<Vec<AspectData>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn query_timestamps(
    _workspace_path: String,
    _chart_id: String,
) -> Result<Vec<String>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn query_radix_relative(
    _workspace_path: String,
    _transit_chart_id: String,
    _radix_chart_id: String,
    _start_datetime: Option<String>,
    _end_datetime: Option<String>,
) -> Result<Vec<RadixRelativeRow>, String> {
    Ok(vec![])
}
