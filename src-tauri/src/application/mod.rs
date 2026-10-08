//! Application use cases.
//!
//! This layer coordinates resolved domain input and infrastructure adapters. It
//! does not know about Tauri commands, workspace YAML paths, or Python HTTP.

pub mod chart_resolution;
pub mod computation;
pub mod compute_router;
pub mod configuration_search;
pub mod evaluation_context;
pub mod event_search;
pub mod location;
pub mod transit;
