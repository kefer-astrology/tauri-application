use tauri::AppHandle;

use crate::infrastructure::ephemeris::{EphemerisInfo, EphemerisManager};

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
    let manager = EphemerisManager::from_global();
    let available_paths = manager.available_bsp_paths();
    crate::infrastructure::ephemeris::bodies_available_for_bsp_paths(&available_paths)
}

/// Inspect actual loaded SPK segment domains.  This is intentionally raw target
/// coverage; a client must not treat it as guaranteed Earth-relative coverage
/// without considering required center-chain segments.
#[tauri::command]
pub fn get_loaded_spk_coverage(
) -> Result<Vec<crate::infrastructure::ephemeris::LoadedSpkCoverage>, String> {
    let manager = EphemerisManager::from_global();
    crate::infrastructure::ephemeris::loaded_spk_coverage(&manager.available_bsp_paths())
}

/// Usable Earth-relative coverage for one NAIF target id: the actual windows
/// where a chart compute would succeed end-to-end (full center chain, real
/// evaluator precedence), not just that target's own raw segment domain.
/// `apparent = true` probes with the converged light-time + stellar aberration
/// correction instead of the geometric transform.
#[tauri::command]
pub fn get_usable_coverage(
    naif_target_id: i32,
    apparent: bool,
) -> Result<crate::infrastructure::ephemeris::UsableCoverageReport, String> {
    let manager = EphemerisManager::from_global();
    crate::infrastructure::ephemeris::usable_earth_relative_coverage(
        &manager.available_bsp_paths(),
        naif_target_id,
        apparent,
    )
}
