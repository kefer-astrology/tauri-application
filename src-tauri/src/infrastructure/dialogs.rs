//! Native file and folder pickers through `tauri-plugin-dialog` (GTK / XDG portal on Linux,
//! system dialogs on macOS and Windows). Cancelling returns `Ok(None)`.

use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, FilePath};

/// Extensions accepted by `import_chart`. Listed in both cases because some platform pickers
/// match filter patterns case-sensitively.
const CHART_FILE_EXTENSIONS: [&str; 21] = [
    "yml", "yaml", "sfs", "hor", "sfcht", "cht", "chm", "se1", "ald", "cst", "YML", "YAML", "SFS",
    "HOR", "SFcht", "SFCHT", "CHT", "CHM", "SE1", "ALD", "CST",
];

fn into_string(path: FilePath) -> Result<String, String> {
    path.into_path()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| format!("Selected path is not a local file: {error}"))
}

/// Folder picker for choosing a workspace. Must not run on the main thread.
pub fn select_folder(app: &AppHandle) -> Result<Option<String>, String> {
    app.dialog()
        .file()
        .set_title("Select Workspace Folder")
        .blocking_pick_folder()
        .map(into_string)
        .transpose()
}

/// File picker for the chart formats accepted by `import_chart`. Must not run on the main
/// thread.
pub fn select_chart_file(app: &AppHandle) -> Result<Option<String>, String> {
    app.dialog()
        .file()
        .set_title("Import Horoscope")
        .add_filter("Horoscope files", &CHART_FILE_EXTENSIONS)
        .blocking_pick_file()
        .map(into_string)
        .transpose()
}
