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

#[test]
fn positions_match_jpl_horizons_on_the_mean_equinox() {
    let horizons = load("reference/positions-horizons.json");
    let erfa = load("reference/earth-orientation-erfa.json");
    let tolerances = load("reference/tolerances.json");
    let tol = &tolerances["positions_mean_equinox_arcsec"];
    let bodies: Vec<String> =
        serde_json::from_value(tolerances["ephemeris_grade_bodies"].clone()).unwrap();
    for (i, epoch) in horizons["epochs_utc"]
        .as_array()
        .unwrap()
        .iter()
        .enumerate()
    {
        let chart = chart_at(epoch.as_str().unwrap());
        let backend = jpl_backend_for_chart(&chart).unwrap();
        let mut ids = bodies.clone();
        ids.push("ceres".into());
        let data = backend.compute_chart_data(&chart, Some(&ids)).unwrap();
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
            let err = arcsec_diff(data.positions[body], reference);
            assert!(err.abs() <= limit, "{epoch} {body}: {err:.2}\" > {limit}\"");
        }
        // Not ephemeris grade (KC-1): must be disclosed, never silent.
        assert!(data
            .warnings
            .iter()
            .any(|w| w.starts_with("ceres_position_unreliable")));
    }
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
