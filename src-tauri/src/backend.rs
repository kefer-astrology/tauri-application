use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

const HOST: &str = "127.0.0.1";
const STARTUP_RETRIES: usize = 60;
const STARTUP_DELAY_MS: u64 = 250;

pub struct BackendState {
    base_url: String,
    child: Mutex<Option<Child>>,
    startup_lock: tauri::async_runtime::Mutex<()>,
    client: reqwest::Client,
}

impl BackendState {
    pub fn new() -> Result<Self, String> {
        let port = reserve_port()?;
        let base_url = format!("http://{HOST}:{port}");
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|err| format!("Failed to create backend HTTP client: {err}"))?;

        Ok(Self {
            base_url,
            child: Mutex::new(None),
            startup_lock: tauri::async_runtime::Mutex::new(()),
            client,
        })
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }
}

pub async fn ensure_backend<R: Runtime>(
    app: &AppHandle<R>,
    state: &BackendState,
) -> Result<String, String> {
    if backend_is_healthy(state).await {
        return Ok(state.base_url().to_string());
    }

    let _guard = state.startup_lock.lock().await;
    if backend_is_healthy(state).await {
        return Ok(state.base_url().to_string());
    }

    reap_exited_child(state)?;
    start_backend_process(app, state)?;

    for _ in 0..STARTUP_RETRIES {
        if backend_is_healthy(state).await {
            return Ok(state.base_url().to_string());
        }

        {
            let mut child_guard = state
                .child
                .lock()
                .map_err(|_| "Backend process lock poisoned".to_string())?;
            if let Some(child) = child_guard.as_mut() {
                if let Some(status) = child
                    .try_wait()
                    .map_err(|err| format!("Failed to poll backend process: {err}"))?
                {
                    *child_guard = None;
                    return Err(format!("Backend exited before becoming ready (status: {status})"));
                }
            }
        }

        std::thread::sleep(Duration::from_millis(STARTUP_DELAY_MS));
    }

    Err("Backend did not become ready in time".to_string())
}

pub async fn post_json<R: Runtime, T: Serialize>(
    app: &AppHandle<R>,
    state: &BackendState,
    path: &str,
    payload: &T,
) -> Result<serde_json::Value, String> {
    let base_url = ensure_backend(app, state).await?;
    let url = format!("{base_url}{path}");
    let response = state
        .client
        .post(url)
        .json(payload)
        .send()
        .await
        .map_err(|err| format!("Backend request failed: {err}"))?;

    parse_json_response(response).await
}

pub fn shutdown_backend(state: &BackendState) {
    if let Ok(mut child_guard) = state.child.lock() {
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

async fn parse_json_response(response: reqwest::Response) -> Result<serde_json::Value, String> {
    let status = response.status();
    let body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("Failed to decode backend response: {err}"))?;

    if status.is_success() {
        return Ok(body);
    }

    if let Some(detail) = body.get("detail") {
        if let Some(message) = detail.get("message").and_then(serde_json::Value::as_str) {
            return Err(message.to_string());
        }
        if let Some(message) = detail.as_str() {
            return Err(message.to_string());
        }
    }

    Err(format!("Backend request failed with status {status}"))
}

async fn backend_is_healthy(state: &BackendState) -> bool {
    let url = format!("{}/health", state.base_url());
    match state.client.get(url).send().await {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}

fn reap_exited_child(state: &BackendState) -> Result<(), String> {
    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| "Backend process lock poisoned".to_string())?;

    let should_clear = if let Some(child) = child_guard.as_mut() {
        child
            .try_wait()
            .map_err(|err| format!("Failed to check backend process: {err}"))?
            .is_some()
    } else {
        false
    };

    if should_clear {
        *child_guard = None;
    }

    Ok(())
}

fn start_backend_process<R: Runtime>(
    app: &AppHandle<R>,
    state: &BackendState,
) -> Result<(), String> {
    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| "Backend process lock poisoned".to_string())?;
    if child_guard.is_some() {
        return Ok(());
    }

    let port = state
        .base_url()
        .rsplit(':')
        .next()
        .ok_or("Missing backend port")?
        .to_string();

    let mut command = if let Some(binary_path) = resolve_backend_binary(app)? {
        let mut cmd = Command::new(binary_path);
        cmd.arg("--host").arg(HOST).arg("--port").arg(&port);
        cmd
    } else {
        let python = resolve_python()?;
        let backend_dir = backend_python_dir();
        let mut cmd = Command::new(python);
        cmd.current_dir(&backend_dir)
            .arg("-m")
            .arg("module.api")
            .arg("--host")
            .arg(HOST)
            .arg("--port")
            .arg(&port);
        cmd
    };

    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let child = command
        .spawn()
        .map_err(|err| format!("Failed to launch backend: {err}"))?;
    *child_guard = Some(child);
    Ok(())
}

fn resolve_backend_binary<R: Runtime>(app: &AppHandle<R>) -> Result<Option<PathBuf>, String> {
    let file_name = backend_binary_name();
    let dev_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(file_name);
    if dev_path.exists() {
        return Ok(Some(dev_path));
    }

    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|err| format!("Failed to resolve resource directory: {err}"))?
        .join("binaries")
        .join(file_name);
    if resource_path.exists() {
        return Ok(Some(resource_path));
    }

    Ok(None)
}

fn reserve_port() -> Result<u16, String> {
    let listener = TcpListener::bind((HOST, 0))
        .map_err(|err| format!("Failed to reserve backend port: {err}"))?;
    let port = listener
        .local_addr()
        .map_err(|err| format!("Failed to read backend port: {err}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn backend_python_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")))
        .join("backend-python")
}

fn resolve_python() -> Result<String, String> {
    if let Ok(explicit) = std::env::var("KEFER_PYTHON") {
        if !explicit.trim().is_empty() {
            return Ok(explicit);
        }
    }

    for candidate in ["python3", "python"] {
        if Command::new(candidate)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
        {
            return Ok(candidate.to_string());
        }
    }

    Err("Could not find a Python executable for backend fallback".to_string())
}

#[cfg(target_os = "windows")]
fn backend_binary_name() -> &'static str {
    "kefer-backend.exe"
}

#[cfg(not(target_os = "windows"))]
fn backend_binary_name() -> &'static str {
    "kefer-backend"
}
