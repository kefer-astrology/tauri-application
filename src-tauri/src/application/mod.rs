//! Application use cases.
//!
//! This layer coordinates resolved domain input and infrastructure adapters. It
//! does not know about Tauri commands, workspace YAML paths, or Python HTTP.

pub mod computation;
pub mod compute_router;
pub mod location;
pub mod transit;
pub mod workspace;
