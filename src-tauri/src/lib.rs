mod application;
mod commands;
mod domain;
mod event_time;
mod infrastructure;
mod lunar_phase;
mod storage;
#[cfg(test)]
mod test_support;
mod workspace;
use commands::calculation::{
    compute_chart, compute_chart_from_data, compute_cross_aspects_from_data,
};
use commands::charts::{create_chart, delete_chart, get_chart_details, import_chart, update_chart};
use commands::default::{read, write};
use commands::dialogs::open_folder_dialog;
use commands::ephemeris::{download_ephemeris, get_available_bodies, list_ephemeris_catalog};
use commands::location::{resolve_location, resolve_timezone, search_locations};
use commands::storage::{
    compute_aspects, init_storage, query_aspects, query_positions, query_radix_relative,
    query_timestamps, store_positions, store_relation,
};
use commands::transits::{compute_transit_series, load_transit_setup, save_transit_setup};
use commands::workspace::{
    create_workspace, delete_workspace, get_current_model_report, get_workspace_defaults,
    load_workspace, save_workspace, save_workspace_defaults, validate_workspace,
};
use tauri::Manager;

#[allow(clippy::missing_panics_doc)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let backend_state = infrastructure::python_sidecar::BackendState::new()
        .expect("failed to initialize backend state");
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
                infrastructure::ephemeris::init_cache_dir(data_dir.join("ephemeris"));
            }
            if let Ok(resource_dir) = app.path().resource_dir() {
                infrastructure::ephemeris::init_resource_dir(resource_dir);
            }

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<infrastructure::python_sidecar::BackendState>();
                if let Err(err) = infrastructure::python_sidecar::initialize_backend_availability(
                    &app_handle,
                    &state,
                )
                .await
                {
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
            validate_workspace,
            save_workspace,
            save_workspace_defaults,
            create_workspace,
            delete_workspace,
            create_chart,
            import_chart,
            update_chart,
            delete_chart,
            get_workspace_defaults,
            load_transit_setup,
            save_transit_setup,
            compute_chart,
            compute_chart_from_data,
            compute_cross_aspects_from_data,
            compute_transit_series,
            open_folder_dialog,
            resolve_location,
            resolve_timezone,
            search_locations,
            get_chart_details,
            get_current_model_report,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                let state = app.state::<infrastructure::python_sidecar::BackendState>();
                infrastructure::python_sidecar::shutdown_backend(&state);
            }
        });
}
