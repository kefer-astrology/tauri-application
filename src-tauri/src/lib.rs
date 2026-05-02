mod astronomy;
mod backend;
mod commands;
mod ephemeris_manager;
mod houses;
mod jpl_backend;
mod storage;
mod workspace;
#[cfg(feature = "swisseph")]
mod swisseph;
use tauri::Manager;
use commands::default::{read, write};
use commands::ephemeris::{download_ephemeris, get_available_bodies, list_ephemeris_catalog};
use commands::storage::{
    compute_aspects, init_storage, query_aspects, query_positions, query_radix_relative,
    query_timestamps, store_positions, store_relation,
};
use commands::workspace::{
    compute_chart, compute_chart_from_data, compute_transit_series, create_chart, create_workspace,
    delete_chart, delete_workspace, get_chart_details, get_workspace_defaults, import_chart, load_workspace,
    open_folder_dialog, resolve_location, save_workspace, save_workspace_defaults, search_locations, update_chart,
};

#[allow(clippy::missing_panics_doc)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let backend_state = backend::BackendState::new().expect("failed to initialize backend state");
    tauri::Builder::default()
        .manage(backend_state)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialise the ephemeris cache dir from the platform app-data directory.
            if let Ok(data_dir) = app.path().app_data_dir() {
                ephemeris_manager::init_cache_dir(data_dir.join("ephemeris"));
            }

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<backend::BackendState>();
                if let Err(err) = backend::initialize_backend_availability(&app_handle, &state).await {
                    log::warn!("Python backend was not ready during startup: {err}");
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read,
            write,
            list_ephemeris_catalog,
            download_ephemeris,
            get_available_bodies,
            init_storage,
            store_positions,
            query_positions,
            store_relation,
            query_aspects,
            compute_aspects,
            query_radix_relative,
            query_timestamps,
            load_workspace,
            save_workspace,
            save_workspace_defaults,
            create_workspace,
            delete_workspace,
            create_chart,
            import_chart,
            update_chart,
            delete_chart,
            get_workspace_defaults,
            compute_chart,
            compute_chart_from_data,
            compute_transit_series,
            open_folder_dialog,
            resolve_location,
            search_locations,
            get_chart_details,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                let state = app.state::<backend::BackendState>();
                backend::shutdown_backend(&state);
            }
        });
}
