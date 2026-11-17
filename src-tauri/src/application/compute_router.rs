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

/// Engines whose semantics exist *only* in the Python sidecar, so a chart
/// using them must be routed there (and fail clearly without a sidecar).
///
/// Empty on purpose. `jyotish`/`custom` used to be listed, but no backend
/// implements them: Python silently ran the same JPL computation, while a
/// missing sidecar turned those charts into a hard error. Both routes now
/// compute with JPL and attach `engine_<e>_not_implemented: <backend>_used`
/// (see `position_provider::engine_substitution_warning`). Add an engine here
/// only together with a real Python-side implementation.
pub const PYTHON_ONLY_ENGINES: &[&str] = &[];

pub fn engine_requires_python(engine: Option<&str>) -> bool {
    engine
        .map(|value| value.trim().to_ascii_lowercase())
        .is_some_and(|value| PYTHON_ONLY_ENGINES.contains(&value.as_str()))
}

/// JPL (including a per-chart `override_ephemeris` kernel) and Swisseph run
/// through Rust; `override_ephemeris` is implemented natively by
/// `jpl_backend_for_chart`, so it is not a Python-only capability either.
pub fn chart_json_requires_python_precision(chart_json: &serde_json::Value) -> bool {
    engine_requires_python(
        chart_json
            .get("config")
            .and_then(|config| config.get("engine"))
            .and_then(|engine| engine.as_str()),
    )
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
    Ok(chart_engine_requires_python(&chart))
}

pub fn chart_engine_requires_python(chart: &crate::workspace::models::ChartInstance) -> bool {
    engine_requires_python(
        chart
            .config
            .engine
            .as_ref()
            .and_then(|engine| serde_json::to_value(engine).ok())
            .as_ref()
            .and_then(|value| value.as_str()),
    )
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

    /// Regression (Phase 0 D2): jyotish/custom were force-routed to a sidecar
    /// that has no implementation for them either, and failed outright with no
    /// sidecar. They now take the normal route and carry an explicit warning.
    #[test]
    fn no_engine_forces_python_because_none_is_python_only() {
        for engine in ["jyotish", "custom", "swisseph", "jpl", " JYOTISH "] {
            let with_override = serde_json::json!({
                "config": { "engine": engine, "override_ephemeris": "/some/path.bsp" }
            });
            assert!(
                !chart_json_requires_python_precision(&with_override),
                "{engine}"
            );
            let without_override = serde_json::json!({ "config": { "engine": engine } });
            assert!(
                !chart_json_requires_python_precision(&without_override),
                "{engine}"
            );
        }
        let route = select_chart_compute_route(
            ComputeBackend::Auto,
            false,
            chart_json_requires_python_precision(
                &serde_json::json!({ "config": { "engine": "jyotish" } }),
            ),
        )
        .expect("a jyotish chart must compute without a sidecar");
        assert_eq!(route, ComputeRoute::Rust);
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

/// These objects have a native JPL calculation path; Auto must not send them to a sidecar
/// that does not implement their source-versioned formulas or installed data packages.
pub fn native_point_selection(ids: &[String]) -> bool {
    ids.iter().any(|id| {
        id.starts_with("lot_")
            || id.starts_with("star_")
            || id.starts_with("hypo_user_")
            || id.starts_with("tno_user_")
            || id.starts_with("minor_user_")
            || [
                "cupido", "hades", "zeus", "kronos", "apollon", "admetos", "vulcanus", "poseidon",
                "eris", "sedna", "haumea", "makemake", "quaoar", "orcus", "varuna",
            ]
            .contains(&id.as_str())
    })
}
pub fn select_chart_route_for_points(
    backend: ComputeBackend,
    available: bool,
    force_python: bool,
    ids: &[String],
) -> Result<ComputeRoute, String> {
    if native_point_selection(ids) {
        if force_python || matches!(backend, ComputeBackend::Python) {
            return Err("Selected additional points require the native JPL engine; this request requires or explicitly selects Python".into());
        }
        return Ok(ComputeRoute::Rust);
    }
    select_chart_compute_route(backend, available, force_python)
}

#[cfg(test)]
mod additional_point_routing_tests {
    use super::*;
    #[test]
    fn auto_routes_native_points_to_rust_without_silently_overriding_explicit_python() {
        assert_eq!(
            select_chart_route_for_points(
                ComputeBackend::Auto,
                true,
                false,
                &["star_sirius".into()]
            )
            .unwrap(),
            ComputeRoute::Rust
        );
        assert_eq!(
            select_chart_route_for_points(ComputeBackend::Auto, true, false, &["sun".into()])
                .unwrap(),
            ComputeRoute::Python
        );
        assert!(select_chart_route_for_points(
            ComputeBackend::Python,
            true,
            false,
            &["lot_victory".into()]
        )
        .is_err());
        assert!(select_chart_route_for_points(
            ComputeBackend::Auto,
            true,
            true,
            &["cupido".into()]
        )
        .is_err());
    }
}
