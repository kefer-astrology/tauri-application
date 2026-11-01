//! Content-addressed cache for serialized chart calculations.
//!
//! Keys are SHA-256 digests of everything that determines a calculation (chart, model,
//! effective settings, installed ephemerides, format versions), so a changed input simply
//! misses; nothing is ever invalidated explicitly. Entries live in memory for the process and,
//! once `init_compute_cache_dir` has run, as one JSON file per key on disk.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use sha2::{Digest, Sha256};

static CACHE_DIR: OnceLock<PathBuf> = OnceLock::new();

fn memory() -> &'static Mutex<HashMap<String, serde_json::Value>> {
    static MEMORY: OnceLock<Mutex<HashMap<String, serde_json::Value>>> = OnceLock::new();
    MEMORY.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Called once during Tauri setup with the platform app-cache directory.
pub fn init_compute_cache_dir(dir: PathBuf) {
    CACHE_DIR.set(dir).ok();
}

pub fn cache_key(parts: &serde_json::Value) -> String {
    let digest = Sha256::digest(parts.to_string().as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn entry_path(key: &str) -> Option<PathBuf> {
    CACHE_DIR.get().map(|dir| dir.join(format!("{key}.json")))
}

pub fn get(key: &str) -> Option<serde_json::Value> {
    if let Some(value) = memory().lock().ok()?.get(key).cloned() {
        return Some(value);
    }
    let content = std::fs::read_to_string(entry_path(key)?).ok()?;
    let value: serde_json::Value = serde_json::from_str(&content).ok()?;
    if let Ok(mut memory) = memory().lock() {
        memory.insert(key.to_string(), value.clone());
    }
    Some(value)
}

/// Best effort: a failed disk write only costs a recomputation next time.
pub fn put(key: &str, value: &serde_json::Value) {
    if let Ok(mut memory) = memory().lock() {
        memory.insert(key.to_string(), value.clone());
    }
    let Some(path) = entry_path(key) else {
        return;
    };
    if let Some(parent) = path.parent() {
        if std::fs::create_dir_all(parent).is_err() {
            return;
        }
    }
    if let Err(error) = std::fs::write(&path, value.to_string()) {
        log::warn!("compute cache write failed for {}: {error}", path.display());
    }
}
