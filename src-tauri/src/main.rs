// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn restart_appimage_with_system_wayland() {
    use std::{ffi::OsString, os::unix::process::CommandExt, path::Path, process::Command};

    const RESTARTED_ENV: &str = "KEFER_SYSTEM_WAYLAND_PRELOADED";
    const SYSTEM_WAYLAND_LIBRARIES: [&str; 4] = [
        "/usr/lib64/libwayland-client.so.0",
        "/usr/lib/x86_64-linux-gnu/libwayland-client.so.0",
        "/usr/lib/libwayland-client.so.0",
        "/lib/x86_64-linux-gnu/libwayland-client.so.0",
    ];

    if std::env::var_os("APPIMAGE").is_none()
        || std::env::var_os("WAYLAND_DISPLAY").is_none()
        || std::env::var_os(RESTARTED_ENV).is_some()
    {
        return;
    }

    let Some(system_wayland) = SYSTEM_WAYLAND_LIBRARIES
        .iter()
        .find(|library| Path::new(library).is_file())
    else {
        return;
    };

    let mut preload = OsString::from(system_wayland);
    if let Some(existing) = std::env::var_os("LD_PRELOAD").filter(|value| !value.is_empty()) {
        preload.push(":");
        preload.push(existing);
    }

    let Ok(executable) = std::env::current_exe() else {
        return;
    };

    std::env::set_var(RESTARTED_ENV, "1");
    std::env::set_var("LD_PRELOAD", preload);

    let error = Command::new(executable)
        .args(std::env::args_os().skip(1))
        .exec();
    eprintln!("Failed to restart AppImage with the system Wayland library: {error}");
}

fn main() {
    #[cfg(target_os = "linux")]
    restart_appimage_with_system_wayland();

    // Work around WebKitGTK EGL_BAD_PARAMETER on Linux (AppImage, Wayland/NVIDIA, some X11 setups).
    // Must be set before the WebView is created.
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("GDK_GL", "disable");
    }
    app_lib::run();
}
