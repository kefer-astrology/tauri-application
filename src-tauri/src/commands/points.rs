//! Additional point definitions and validated local package installation.
use serde_json::{json, Value};
#[tauri::command]
pub fn get_point_library() -> Result<Value, String> {
    let library = crate::infrastructure::point_library::point_library()?;
    let paths =
        crate::infrastructure::ephemeris::EphemerisManager::from_global().available_bsp_paths();
    let installed = crate::infrastructure::ephemeris::bodies_available_for_bsp_paths(&paths);
    let tnos: Vec<_> = [
        "eris", "sedna", "haumea", "makemake", "quaoar", "orcus", "varuna",
    ]
    .into_iter()
    .map(|id| json!({"id":id,"installed":installed.iter().any(|body|body==id)}))
    .collect();
    Ok(
        json!({"lots":library.lots,"stars":library.stars,"hypotheticals":library.hypotheticals,
        "imported_sources":library.imported_sources,"tnos":tnos,
        "lot_source":crate::domain::astrology::lot_catalog(),
        "star_source":crate::domain::astrology::fixed_star_catalog().source,
        "hypothetical_model":crate::domain::astrology::hypothetical_catalog().model}),
    )
}
#[tauri::command]
pub fn import_point_package(json: String) -> Result<usize, String> {
    crate::infrastructure::point_library::import_point_package(&json)
}
#[tauri::command]
pub async fn import_small_body_package(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use tauri_plugin_dialog::DialogExt;
        let Some(file) = app
            .dialog()
            .file()
            .set_title("Import ephemeris package manifest")
            .add_filter("SPK package manifest", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = file.into_path().map_err(|e| e.to_string())?;
        crate::infrastructure::ephemeris::install_small_body_package(&path).map(Some)
    })
    .await
    .map_err(|e| format!("Package import failed: {e}"))?
}
