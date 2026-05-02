use tauri::AppHandle;

use crate::ephemeris_manager::{EphemerisInfo, EphemerisManager};

/// Return the full ephemeris catalog with download status for each entry.
#[tauri::command]
pub fn list_ephemeris_catalog() -> Vec<EphemerisInfo> {
    EphemerisManager::from_global().catalog_status()
}

/// Trigger an async download of the given catalog entry.
/// Progress is reported via `ephemeris-progress` events; completion via `ephemeris-ready`.
#[tauri::command]
pub async fn download_ephemeris(id: String, app: AppHandle) -> Result<(), String> {
    EphemerisManager::from_global().download(&id, &app).await
}

/// Return the body IDs queryable given currently available BSP files.
#[tauri::command]
pub fn get_available_bodies() -> Vec<String> {
    use std::collections::HashSet;
    let manager = EphemerisManager::from_global();
    let available_paths = manager.available_bsp_paths();

    crate::ephemeris_manager::CATALOG
        .iter()
        .filter(|entry| {
            available_paths
                .iter()
                .any(|p| p.file_name().map(|f| f == entry.filename).unwrap_or(false))
        })
        .flat_map(|entry| entry.bodies.iter().map(|b| b.to_string()))
        .collect::<HashSet<_>>()
        .into_iter()
        .collect()
}
