//! Conformance of the Rust implementation to the vendored `kefer-contracts`
//! (`contracts/`, see `scripts/sync-kefer-contracts.py`).
//!
//! Independent references (JPL Horizons, ERFA, USNO) and exact parity
//! fixtures are compared with the tolerances in
//! `contracts/reference/tolerances.json`.

use std::collections::HashMap;
use std::path::PathBuf;

use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::infrastructure::jpl_backend::jpl_backend_for_chart;
use crate::infrastructure::position_provider::AstronomyBackend;
use crate::workspace::models::ChartInstance;

const PRAGUE: (f64, f64) = (50.0875, 14.4214);

fn contracts_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../contracts")
}

fn load(rel: &str) -> Value {
    let text = std::fs::read_to_string(contracts_dir().join(rel)).expect(rel);
    serde_json::from_str(&text).expect(rel)
}

fn chart_at(utc: &str) -> ChartInstance {
    serde_json::from_value(serde_json::json!({
        "id": "conformance",
        "subject": {
            "id": "conformance", "name": "conformance", "event_time": utc,
            "location": {"name": "Prague", "latitude": PRAGUE.0, "longitude": PRAGUE.1, "timezone": "UTC"}
        },
        "config": {"definition": {"kind": "base", "purpose": "natal"}, "zodiac_type": "Tropical",
                   "aspect_orbs": {}, "engine": "jpl"},
        "tags": []
    }))
    .expect("valid chart")
}

fn arcsec_diff(a: f64, b: f64) -> f64 {
    ((a - b + 540.0) % 360.0 - 180.0) * 3600.0
}

#[test]
fn vendored_contracts_match_manifest() {
    let manifest = load("manifest.json");
    let files = manifest["files"].as_object().unwrap();
    for (rel, digest) in files {
        let bytes =
            std::fs::read(contracts_dir().join(rel)).unwrap_or_else(|_| panic!("missing {rel}"));
        let actual = format!("{:x}", Sha256::digest(&bytes));
        assert_eq!(
            actual,
            digest.as_str().unwrap(),
            "modified vendored contract: {rel}"
        );
    }
    let mut stack = vec![contracts_dir()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(dir).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                stack.push(path);
            } else {
                let rel = path
                    .strip_prefix(contracts_dir())
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/");
                assert!(
                    rel == "manifest.json" || files.contains_key(&rel),
                    "unexpected file {rel}"
                );
            }
        }
    }
}

fn rust_capabilities() -> Value {
    load("capabilities.json")["implementations"]["rust"].clone()
}

#[test]
fn positions_match_jpl_horizons_on_the_mean_equinox() {
    let horizons = load("reference/positions-horizons.json");
    let erfa = load("reference/earth-orientation-erfa.json");
    let tol = &load("reference/tolerances.json")["positions_mean_equinox_arcsec"];
    let bodies: Vec<String> =
        serde_json::from_value(rust_capabilities()["ephemeris_grade_bodies"].clone()).unwrap();
    let mut worst: (f64, String) = (0.0, String::new());
    for (i, epoch) in horizons["epochs_utc"]
        .as_array()
        .unwrap()
        .iter()
        .enumerate()
    {
        let chart = chart_at(epoch.as_str().unwrap());
        let backend = jpl_backend_for_chart(&chart).unwrap();
        let data = backend.compute_chart_data(&chart, Some(&bodies)).unwrap();
        let dpsi = erfa["epochs"][i]["nutation_longitude_deg"]
            .as_f64()
            .unwrap();
        for body in &bodies {
            let reference = horizons["positions"][body][i]["lon_true_deg"]
                .as_f64()
                .unwrap()
                - dpsi;
            let limit = tol
                .get(body.as_str())
                .and_then(Value::as_f64)
                .unwrap_or(tol["default"].as_f64().unwrap());
            let got = *data
                .positions
                .get(body)
                .unwrap_or_else(|| panic!("{epoch} {body} missing: {:?}", data.warnings));
            let err = arcsec_diff(got, reference);
            if err.abs() > worst.0 {
                worst = (err.abs(), format!("{epoch} {body}"));
            }
            assert!(err.abs() <= limit, "{epoch} {body}: {err:.2}\" > {limit}\"");
        }
        // Within verified coverage nothing may come from the unrotated legacy kernel (KC-1).
        assert!(
            !data
                .warnings
                .iter()
                .any(|w| w.contains("_position_unreliable")),
            "{epoch}: {:?}",
            data.warnings
        );
    }
    eprintln!(
        "worst position error vs Horizons: {:.3}\" ({})",
        worst.0, worst.1
    );
}

/// KC-1 fallback: outside the verified kernels' 1900-2100 coverage the legacy
/// codes_300ast segment is still used, and must be disclosed.
#[test]
fn asteroid_outside_verified_coverage_falls_back_with_warning() {
    let chart = chart_at("1850-06-15T12:00:00Z");
    let data = jpl_backend_for_chart(&chart)
        .unwrap()
        .compute_chart_data(&chart, Some(&vec!["ceres".into()]))
        .unwrap();
    assert!(data.positions.contains_key("ceres"), "{:?}", data.warnings);
    assert!(
        data.warnings
            .iter()
            .any(|w| w.starts_with("ceres_position_unreliable")),
        "{:?}",
        data.warnings
    );
}

#[test]
fn declared_capabilities_match_the_implementation() {
    let caps = rust_capabilities();
    let native: Vec<String> = serde_json::from_value(caps["house_systems_native"].clone()).unwrap();
    assert_eq!(native, crate::domain::houses::NATIVE_HOUSE_SYSTEMS.to_vec());
    let conventions: Vec<String> = serde_json::from_value(caps["conventions"].clone()).unwrap();
    assert_eq!(
        conventions,
        crate::domain::conventions::IMPLEMENTED.to_vec()
    );
    let catalog = crate::workspace::builtin_domain_catalog();
    let substituted: Vec<String> =
        serde_json::from_value(caps["house_systems_substituted"].clone()).unwrap();
    for system in &catalog.house_systems {
        assert_eq!(
            !system.computation_supported,
            substituted.contains(&system.id),
            "{}",
            system.id
        );
    }
    assert_eq!(
        load("conventions.json")["default"],
        crate::application::computation::CALCULATION_CONVENTION
    );
}

#[test]
fn axes_match_erfa_mean_convention() {
    let erfa = load("reference/earth-orientation-erfa.json");
    let limit = load("reference/tolerances.json")["axes_mean_convention_arcsec"]
        .as_f64()
        .unwrap();
    for epoch in erfa["epochs"].as_array().unwrap() {
        let chart = chart_at(epoch["utc"].as_str().unwrap());
        let data = jpl_backend_for_chart(&chart)
            .unwrap()
            .compute_chart_data(&chart, Some(&vec!["asc".into(), "mc".into()]))
            .unwrap();
        let ramc = (epoch["gmst_deg"].as_f64().unwrap() + PRAGUE.1).to_radians();
        let eps = epoch["mean_obliquity_deg"].as_f64().unwrap().to_radians();
        let lat = PRAGUE.0.to_radians();
        let mc = f64::atan2(ramc.sin(), ramc.cos() * eps.cos()).to_degrees();
        let asc = f64::atan2(-ramc.cos(), eps.sin() * lat.tan() + eps.cos() * ramc.sin())
            .to_degrees()
            + 180.0;
        assert!(arcsec_diff(data.axes.mc, mc).abs() <= limit, "{epoch}: mc");
        assert!(
            arcsec_diff(data.axes.asc, asc).abs() <= limit,
            "{epoch}: asc"
        );
    }
}

#[test]
fn usno_new_and_full_moons_have_conjunction_or_opposition_elongation() {
    let phases = load("reference/moon-phases-usno-2024.json");
    let limit = load("reference/tolerances.json")["moon_phase_elongation_arcsec"]
        .as_f64()
        .unwrap();
    for phase in phases["phases"].as_array().unwrap() {
        let chart = chart_at(phase["utc"].as_str().unwrap());
        let data = jpl_backend_for_chart(&chart)
            .unwrap()
            .compute_chart_data(&chart, Some(&vec!["sun".into(), "moon".into()]))
            .unwrap();
        let target = if phase["phase"] == "New Moon" {
            0.0
        } else {
            180.0
        };
        let elongation = data.positions["moon"] - data.positions["sun"];
        let err = arcsec_diff(elongation, target);
        assert!(err.abs() <= limit, "{}: {err:.1}\"", phase["utc"]);
    }
}

#[test]
fn aspect_detection_matches_contract_fixture() {
    let fixture = load("aspects/detection.json");
    let definitions = crate::workspace::builtin_standard_model("builtin").aspect_definitions;
    let all: Vec<String> = definitions.iter().map(|a| a.id.clone()).collect();
    let object_types = HashMap::new();
    for case in fixture["cases"].as_array().unwrap() {
        let orbs: HashMap<String, f64> =
            serde_json::from_value(case["aspect_orbs"].clone()).unwrap();
        let got = if case["kind"] == "chart" {
            let positions: HashMap<String, f64> =
                serde_json::from_value(case["positions"].clone()).unwrap();
            crate::domain::astrology::compute_chart_aspects(
                &positions,
                &definitions,
                &orbs,
                Some(&all),
                &object_types,
                &HashMap::new(),
            )
        } else {
            let transiting: HashMap<String, f64> =
                serde_json::from_value(case["transiting"].clone()).unwrap();
            let transited: HashMap<String, f64> =
                serde_json::from_value(case["transited"].clone()).unwrap();
            crate::domain::astrology::compute_cross_aspects(
                &transiting,
                &transited,
                &definitions,
                &orbs,
                &all,
                &object_types,
                &HashMap::new(),
            )
        };
        let key = |from: &str, to: &str, kind: &str| {
            if case["kind"] == "chart" && from > to {
                format!("{to}|{from}|{kind}")
            } else {
                format!("{from}|{to}|{kind}")
            }
        };
        let mut actual: Vec<(String, f64)> = got
            .iter()
            .map(|a| (key(&a.from, &a.to, &a.aspect_type), a.orb))
            .collect();
        let mut expected: Vec<(String, f64)> = case["expected"]
            .as_array()
            .unwrap()
            .iter()
            .map(|e| {
                (
                    key(
                        e["from"].as_str().unwrap(),
                        e["to"].as_str().unwrap(),
                        e["type"].as_str().unwrap(),
                    ),
                    e["orb"].as_f64().unwrap(),
                )
            })
            .collect();
        actual.sort_by(|a, b| a.0.cmp(&b.0));
        expected.sort_by(|a, b| a.0.cmp(&b.0));
        let names = |v: &[(String, f64)]| v.iter().map(|x| x.0.clone()).collect::<Vec<_>>();
        assert_eq!(names(&actual), names(&expected), "case {}", case["id"]);
        for (a, e) in actual.iter().zip(&expected) {
            assert!(
                (a.1 - e.1).abs() < 1e-6,
                "case {} {}: orb {} vs {}",
                case["id"],
                a.0,
                a.1,
                e.1
            );
        }
    }
}

#[test]
fn chart_result_has_every_field_required_by_the_api_schema() {
    use crate::application::computation::{compute_chart, ChartComputeRequest, ResolvedChart};
    let schema = load("schemas/api/chart-result.schema.json");
    let chart = chart_at("2024-01-01T12:00:00Z");
    let report = crate::workspace::settings::standalone_model_report(&chart.config);
    let result = compute_chart(ChartComputeRequest::for_resolved_chart(
        ResolvedChart::from_report(chart, report),
    ))
    .unwrap();
    let value = serde_json::to_value(&result).unwrap();
    for field in schema["required"].as_array().unwrap() {
        assert!(
            value.get(field.as_str().unwrap()).is_some(),
            "missing {field}"
        );
    }
    for aspect in value["aspects"].as_array().unwrap() {
        for field in schema["properties"]["aspects"]["items"]["required"]
            .as_array()
            .unwrap()
        {
            assert!(
                aspect.get(field.as_str().unwrap()).is_some(),
                "aspect missing {field}"
            );
        }
    }
}

fn chart_with_convention(utc: &str, convention: Option<&str>) -> ChartInstance {
    let mut chart = chart_at(utc);
    chart.config.calculation_convention = convention.map(str::to_string);
    chart
}

const TRUE_EQUINOX: &str = crate::domain::conventions::TRUE_EQUINOX;

/// kefer-positions/1-true-equinox against JPL Horizons true-equinox longitudes
/// directly (independent reference, nothing subtracted).
#[test]
fn true_equinox_positions_match_jpl_horizons() {
    let horizons = load("reference/positions-horizons.json");
    let tol = &load("reference/tolerances.json")["positions_true_equinox_arcsec"];
    let bodies: Vec<String> =
        serde_json::from_value(rust_capabilities()["ephemeris_grade_bodies"].clone()).unwrap();
    for (i, epoch) in horizons["epochs_utc"]
        .as_array()
        .unwrap()
        .iter()
        .enumerate()
    {
        let chart = chart_with_convention(epoch.as_str().unwrap(), Some(TRUE_EQUINOX));
        let data = jpl_backend_for_chart(&chart)
            .unwrap()
            .compute_chart_data(&chart, Some(&bodies))
            .unwrap();
        for body in &bodies {
            let reference = horizons["positions"][body][i]["lon_true_deg"]
                .as_f64()
                .unwrap();
            let limit = tol
                .get(body.as_str())
                .and_then(Value::as_f64)
                .unwrap_or(tol["default"].as_f64().unwrap());
            let err = arcsec_diff(data.positions[body], reference);
            assert!(err.abs() <= limit, "{epoch} {body}: {err:.2}\" > {limit}\"");
        }
    }
}

#[test]
fn true_equinox_axes_match_erfa_gast_and_true_obliquity() {
    let erfa = load("reference/earth-orientation-erfa.json");
    let limit = load("reference/tolerances.json")["axes_true_convention_arcsec"]
        .as_f64()
        .unwrap();
    for epoch in erfa["epochs"].as_array().unwrap() {
        let chart = chart_with_convention(epoch["utc"].as_str().unwrap(), Some(TRUE_EQUINOX));
        let data = jpl_backend_for_chart(&chart)
            .unwrap()
            .compute_chart_data(&chart, Some(&vec!["asc".into(), "mc".into()]))
            .unwrap();
        let ramc = (epoch["gast_deg"].as_f64().unwrap() + PRAGUE.1).to_radians();
        let eps = epoch["true_obliquity_deg"].as_f64().unwrap().to_radians();
        let lat = PRAGUE.0.to_radians();
        let mc = f64::atan2(ramc.sin(), ramc.cos() * eps.cos()).to_degrees();
        let asc = f64::atan2(-ramc.cos(), eps.sin() * lat.tan() + eps.cos() * ramc.sin())
            .to_degrees()
            + 180.0;
        assert!(arcsec_diff(data.axes.mc, mc).abs() <= limit, "{epoch}: mc");
        assert!(
            arcsec_diff(data.axes.asc, asc).abs() <= limit,
            "{epoch}: asc"
        );
    }
}

#[test]
fn true_equinox_house_fixture_parity() {
    use crate::domain::houses::{compute_axes_with, house_cusps_for_system_with};
    use crate::workspace::models::HouseSystem;
    let fixture = load("houses/cusps-true-equinox.json");
    let tol = fixture["tolerance_deg"].as_f64().unwrap();
    for case in fixture["cases"].as_array().unwrap() {
        let (jd_ut, jd_tt) = (
            case["jd_ut"].as_f64().unwrap(),
            case["jd_tt"].as_f64().unwrap(),
        );
        let (lat, lon) = (
            case["latitude"].as_f64().unwrap(),
            case["longitude"].as_f64().unwrap(),
        );
        let (_dpsi, deps, ee) = crate::domain::conventions::nutation_deg(jd_tt);
        let ramc = crate::domain::houses::normalize_deg(
            crate::domain::houses::local_sidereal_time_deg(jd_ut, lon) + ee,
        );
        let eps = crate::domain::houses::mean_obliquity_deg(jd_ut) + deps;
        assert!((ramc - case["ramc_deg"].as_f64().unwrap()).abs() <= tol);
        assert!((eps - case["obliquity_deg"].as_f64().unwrap()).abs() <= tol);
        let (asc, mc, _, _) = compute_axes_with(ramc, eps, lat).unwrap();
        for (system, expected) in case["systems"].as_object().unwrap() {
            let sys: HouseSystem = serde_json::from_value(serde_json::json!(system)).unwrap();
            let (cusps, warnings) =
                house_cusps_for_system_with(Some(&sys), ramc, eps, lat, asc, mc);
            for (got, want) in cusps.iter().zip(expected["cusps"].as_array().unwrap()) {
                assert!(arcsec_diff(*got, want.as_f64().unwrap()).abs() / 3600.0 <= tol);
            }
            let want: Vec<String> = serde_json::from_value(expected["warnings"].clone()).unwrap();
            assert_eq!(warnings, want, "{} {system}", case["id"]);
        }
    }
}

#[test]
fn chart_results_report_the_convention_used_and_never_switch_silently() {
    use crate::application::computation::{compute_chart, ChartComputeRequest, ResolvedChart};
    let run = |convention: Option<&str>| {
        let chart = chart_with_convention("2024-01-01T12:00:00Z", convention);
        let report = crate::workspace::settings::standalone_model_report(&chart.config);
        compute_chart(ChartComputeRequest::for_resolved_chart(
            ResolvedChart::from_report(chart, report),
        ))
        .unwrap()
    };
    let default = run(None);
    assert_eq!(default.calculation_convention, "kefer-positions/1");
    let true_eq = run(Some(TRUE_EQUINOX));
    assert_eq!(true_eq.calculation_convention, TRUE_EQUINOX);
    assert_ne!(default.positions["sun"], true_eq.positions["sun"]);
    let unknown = run(Some("kefer-positions/9"));
    assert_eq!(unknown.calculation_convention, "kefer-positions/1");
    assert_eq!(unknown.positions["sun"], default.positions["sun"]);
    assert!(unknown.warnings.contains(
        &"calculation_convention_unsupported: kefer-positions/9; kefer-positions/1_used"
            .to_string()
    ));
}

#[test]
fn bundled_hypothetical_pack_conforms_to_the_contract_format() {
    // kefer-contracts ships only the format; the element values are this
    // application's own (non-MIT, provenance-unresolved) data pack.
    assert!(!contracts_dir()
        .join("points/hypothetical-bodies.json")
        .exists());
    let schema = load("schemas/points/hypothetical-bodies.schema.json");
    let pack: Value = serde_json::from_str(include_str!(
        "../resources/third-party/hypothetical-bodies.json"
    ))
    .expect("hypothetical data pack");
    for key in schema["required"].as_array().unwrap() {
        assert!(
            pack.get(key.as_str().unwrap()).is_some(),
            "pack lacks {key}"
        );
    }
    let item = &schema["properties"]["bodies"]["items"];
    let allowed: Vec<&str> = item["properties"]
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    let bodies = pack["bodies"].as_array().unwrap();
    assert!(!bodies.is_empty());
    for body in bodies {
        let fields = body.as_object().unwrap();
        for key in item["required"].as_array().unwrap() {
            assert!(fields.contains_key(key.as_str().unwrap()), "{body}");
        }
        for key in fields.keys() {
            assert!(allowed.contains(&key.as_str()), "unexpected field {key}");
        }
    }
    let catalog = crate::domain::astrology::hypothetical_catalog();
    assert_eq!(catalog.model, pack["model"].as_str().unwrap());
    for body in &catalog.bodies {
        crate::domain::astrology::validate_hypothetical(body).expect("valid elements");
    }
}
