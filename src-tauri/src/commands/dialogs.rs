/// Open a folder dialog and return the selected path
#[tauri::command]
pub async fn open_folder_dialog() -> Result<Option<String>, String> {
    crate::infrastructure::dialogs::select_folder()
}

/// Open a chart-file dialog and return the selected source path.
#[tauri::command]
pub async fn open_chart_file_dialog() -> Result<Option<String>, String> {
    crate::infrastructure::dialogs::select_chart_file()
}
