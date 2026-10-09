//! Rust/Python backend selection, fallback policy, and response normalization
//! shared by the chart and transit calculation commands.

use std::collections::HashMap;
use std::path::Path;

#[derive(Clone, Copy, Debug)]
pub enum ComputeBackend {
    Auto,
    Rust,
    Python,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ComputeRoute {
    Rust,
    Python,
}

pub fn selected_compute_backend() -> ComputeBackend {
    match std::env::var("KEFER_COMPUTE_BACKEND")
        .ok()
        .as_deref()
        .map(|value| value.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("rust") => ComputeBackend::Rust,
        Some("python") => ComputeBackend::Python,
        _ => ComputeBackend::Auto,
    }
}

pub fn python_fallback_enabled() -> bool {
    !matches!(
        std::env::var("KEFER_PYTHON_FALLBACK")
            .ok()
            .as_deref()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("0" | "false" | "no" | "off")
    )
}

pub fn select_chart_compute_route(
    backend: ComputeBackend,
    backend_available: bool,
    force_python: bool,
) -> Result<ComputeRoute, String> {
    if force_python {
        return match backend {
            ComputeBackend::Rust => Err(
                "Rust backend does not support this chart type yet. Use Python backend."
                    .to_string(),
            ),
            _ if backend_available => Ok(ComputeRoute::Python),
            _ => Err(
                "Python backend unavailable. This chart requires Python-backed computation."
                    .to_string(),
            ),
        };
    }

    match backend {
        ComputeBackend::Rust => Ok(ComputeRoute::Rust),
        ComputeBackend::Python => {
            if backend_available {
                Ok(ComputeRoute::Python)
            } else {
                Err("Python backend unavailable; use Rust fallback where supported".to_string())
            }
        }
        ComputeBackend::Auto => {
            if backend_available {
                Ok(ComputeRoute::Python)
            } else {
                Ok(ComputeRoute::Rust)
            }
        }
    }
}

pub fn select_transit_compute_route(
    backend: ComputeBackend,
    backend_available: bool,
) -> Result<ComputeRoute, String> {
    match backend {
        ComputeBackend::Rust => Ok(ComputeRoute::Rust),
        ComputeBackend::Python => {
            if backend_available {
                Ok(ComputeRoute::Python)
            } else {
                Err("Python backend unavailable; use Rust fallback where supported".to_string())
            }
        }
        ComputeBackend::Auto => {
            if backend_available {
                Ok(ComputeRoute::Python)
            } else {
                Ok(ComputeRoute::Rust)
            }
        }
    }
}

/// Only Jyotish and Custom require Python; JPL (including a per-chart
/// `override_ephemeris` kernel) and Swisseph can run through Rust.
/// `JplAstronomyBackend`/`jpl_backend_for_chart` (`infrastructure/jpl_backend.rs`)
/// implement `override_ephemeris` natively, so it is not a Python-only capability —
/// see the "Per-chart override" section of the ephemeris-manager documentation
/// for the history of this (former) discrepancy.
pub fn chart_json_requires_python_precision(chart_json: &serde_json::Value) -> bool {
    let cfg = chart_json.get("config").and_then(|v| v.as_object());
    let engine = cfg
        .and_then(|c| c.get("engine"))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_ascii_lowercase());

    matches!(engine.as_deref(), Some("jyotish" | "custom"))
}

pub fn chart_requires_python_precision(
    workspace_path: &str,
    chart_id: &str,
) -> Result<bool, String> {
    let base = Path::new(workspace_path);
    let manifest = crate::workspace::load_workspace_manifest(base)?;
    let chart_rel = crate::workspace::loader::find_chart_ref_by_id(base, &manifest, chart_id)?
        .ok_or_else(|| format!("Chart {} not found", chart_id))?;
    let chart = crate::workspace::loader::load_chart(base, &chart_rel)?;

    // Only Jyotish and Custom require Python; JPL (including a per-chart
    // override_ephemeris kernel) and Swisseph can use Rust — see
    // chart_json_requires_python_precision above.
    let requires = matches!(
        chart.config.engine,
        Some(
            crate::workspace::models::EngineType::Jyotish
                | crate::workspace::models::EngineType::Custom
        )
    );

    Ok(requires)
}

pub fn merge_chart_warnings(
    existing: Option<&serde_json::Value>,
    additional: &[String],
) -> serde_json::Value {
    let mut merged: Vec<String> = existing
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    for warning in additional {
        if !merged.iter().any(|item| item == warning) {
            merged.push(warning.clone());
        }
    }

    serde_json::json!(merged)
}

pub fn normalize_chart_response(
    mut result: HashMap<String, serde_json::Value>,
    backend_used_fallback: Option<&str>,
) -> HashMap<String, serde_json::Value> {
    if !result.contains_key("backend_used") {
        result.insert(
            "backend_used".to_string(),
            serde_json::json!(backend_used_fallback),
        );
    }
    if !result.contains_key("fallback_used") {
        result.insert("fallback_used".to_string(), serde_json::json!(false));
    }
    if !result.contains_key("ephemeris_source") {
        result.insert("ephemeris_source".to_string(), serde_json::Value::Null);
    }
    if !result.contains_key("warnings") {
        result.insert("warnings".to_string(), serde_json::json!([]));
    }
    crate::lunar_phase::inject_moon_details_into_chart_map(&mut result);
    crate::domain::astrology::inject_shapes_and_configurations_into_chart_map(&mut result);
    result
}

pub fn annotate_chart_fallback(
    mut result: HashMap<String, serde_json::Value>,
    warning: &str,
) -> HashMap<String, serde_json::Value> {
    result.insert("fallback_used".to_string(), serde_json::json!(true));
    let warnings = merge_chart_warnings(result.get("warnings"), &[warning.to_string()]);
    result.insert("warnings".to_string(), warnings);
    result
}

pub fn normalize_transit_response(
    mut result: serde_json::Value,
    backend_used_fallback: Option<&str>,
) -> serde_json::Value {
    if let Some(object) = result.as_object_mut() {
        object
            .entry("backend_used".to_string())
            .or_insert_with(|| serde_json::json!(backend_used_fallback));
        object
            .entry("fallback_used".to_string())
            .or_insert_with(|| serde_json::json!(false));
        object
            .entry("ephemeris_source".to_string())
            .or_insert(serde_json::Value::Null);
        object
            .entry("warnings".to_string())
            .or_insert_with(|| serde_json::json!([]));
    }
    result
}

pub fn annotate_transit_fallback(
    mut result: serde_json::Value,
    warning: &str,
) -> serde_json::Value {
    if let Some(object) = result.as_object_mut() {
        object.insert("fallback_used".to_string(), serde_json::json!(true));
        let warnings = merge_chart_warnings(object.get("warnings"), &[warning.to_string()]);
        object.insert("warnings".to_string(), warnings);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chart_route_uses_rust_when_backend_unavailable_in_auto_mode() {
        let route = select_chart_compute_route(ComputeBackend::Auto, false, false)
            .expect("auto mode should fall back to rust");
        assert_eq!(route, ComputeRoute::Rust);
    }

    #[test]
    fn chart_route_requires_python_when_precision_is_forced() {
        let err = select_chart_compute_route(ComputeBackend::Auto, false, true)
            .expect_err("forced precision should fail without python");
        assert!(err.contains("Python backend unavailable"));
    }

    #[test]
    fn chart_route_honors_python_when_available() {
        let route = select_chart_compute_route(ComputeBackend::Auto, true, true)
            .expect("python should be selected when available");
        assert_eq!(route, ComputeRoute::Python);
    }

    /// `JplAstronomyBackend`/`jpl_backend_for_chart` implement `override_ephemeris`
    /// natively (`infrastructure/jpl_backend.rs`), so it must not force Python —
    /// regression test for the router/backend discrepancy this previously had.
    #[test]
    fn override_ephemeris_alone_does_not_force_python_precision() {
        let chart_json = serde_json::json!({
            "config": {
                "engine": "jpl",
                "override_ephemeris": "/some/path/to.bsp",
            }
        });
        assert!(!chart_json_requires_python_precision(&chart_json));

        let no_engine = serde_json::json!({
            "config": { "override_ephemeris": "/some/path/to.bsp" }
        });
        assert!(!chart_json_requires_python_precision(&no_engine));
    }

    #[test]
    fn jyotish_and_custom_engines_force_python_precision_regardless_of_override() {
        for engine in ["jyotish", "custom"] {
            let with_override = serde_json::json!({
                "config": { "engine": engine, "override_ephemeris": "/some/path.bsp" }
            });
            assert!(chart_json_requires_python_precision(&with_override));

            let without_override = serde_json::json!({ "config": { "engine": engine } });
            assert!(chart_json_requires_python_precision(&without_override));
        }
    }

    #[test]
    fn empty_override_ephemeris_string_is_not_treated_as_set() {
        let chart_json = serde_json::json!({
            "config": { "engine": "jpl", "override_ephemeris": "" }
        });
        assert!(!chart_json_requires_python_precision(&chart_json));
    }

    #[test]
    fn override_ephemeris_chart_routes_to_rust_in_rust_only_mode() {
        // force_python=false (override no longer forces it) — explicit Rust
        // backend selection must succeed instead of erroring with "Rust backend
        // does not support this chart type yet."
        let route = select_chart_compute_route(ComputeBackend::Rust, false, false)
            .expect("Rust must support an override-ephemeris JPL chart directly");
        assert_eq!(route, ComputeRoute::Rust);
    }

    #[test]
    fn override_ephemeris_chart_falls_back_to_rust_in_auto_mode_without_python() {
        let route = select_chart_compute_route(ComputeBackend::Auto, false, false)
            .expect("auto mode should use the Rust JPL override path when Python is unavailable");
        assert_eq!(route, ComputeRoute::Rust);
    }

    #[test]
    fn override_ephemeris_chart_still_prefers_python_in_auto_mode_when_available() {
        // Auto mode's ordinary Python-preferred policy is untouched; only the
        // *forced, no-fallback* requirement tied to override_ephemeris is gone.
        let route = select_chart_compute_route(ComputeBackend::Auto, true, false)
            .expect("auto mode with python available should still prefer python");
        assert_eq!(route, ComputeRoute::Python);
    }

    #[test]
    fn transit_route_uses_rust_when_backend_unavailable_in_auto_mode() {
        let route = select_transit_compute_route(ComputeBackend::Auto, false)
            .expect("auto transit mode should fall back to rust");
        assert_eq!(route, ComputeRoute::Rust);
    }

    #[test]
    fn layered_requests_use_the_selected_backend_after_python_parity() {
        assert_eq!(
            select_chart_compute_route(ComputeBackend::Auto, true, false)
                .expect("auto should route layered computation normally"),
            ComputeRoute::Python
        );
        assert_eq!(
            select_transit_compute_route(ComputeBackend::Python, true)
                .expect("python should accept layered transit computation"),
            ComputeRoute::Python
        );
    }

    #[test]
    fn annotate_chart_fallback_marks_result_and_preserves_existing_warnings() {
        let result = HashMap::from([
            ("backend_used".to_string(), serde_json::json!("swisseph")),
            ("fallback_used".to_string(), serde_json::json!(false)),
            ("warnings".to_string(), serde_json::json!(["partial_axes"])),
        ]);

        let annotated = annotate_chart_fallback(result, "python_compute_failed_auto_fallback");

        assert_eq!(
            annotated.get("fallback_used"),
            Some(&serde_json::json!(true))
        );
        assert_eq!(
            annotated.get("warnings"),
            Some(&serde_json::json!([
                "partial_axes",
                "python_compute_failed_auto_fallback"
            ]))
        );
    }

    #[test]
    fn annotate_transit_fallback_marks_result_and_preserves_existing_warnings() {
        let result = serde_json::json!({
            "backend_used": "swisseph",
            "fallback_used": false,
            "warnings": ["partial_axes"],
        });

        let annotated =
            annotate_transit_fallback(result, "python_transit_compute_failed_auto_fallback");

        assert_eq!(
            annotated.get("fallback_used"),
            Some(&serde_json::json!(true))
        );
        assert_eq!(
            annotated.get("warnings"),
            Some(&serde_json::json!([
                "partial_axes",
                "python_transit_compute_failed_auto_fallback"
            ]))
        );
    }
}
