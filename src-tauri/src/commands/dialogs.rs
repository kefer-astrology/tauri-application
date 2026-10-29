use tauri::AppHandle;

/// Open a folder dialog and return the selected path (`None` when cancelled).
#[tauri::command]
pub async fn open_folder_dialog(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::infrastructure::dialogs::select_folder(&app)
    })
    .await
    .map_err(|error| format!("Folder dialog failed: {error}"))?
}

/// Open a chart-file dialog and return the selected source path (`None` when cancelled).
#[tauri::command]
pub async fn open_chart_file_dialog(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::infrastructure::dialogs::select_chart_file(&app)
    })
    .await
    .map_err(|error| format!("File dialog failed: {error}"))?
}
