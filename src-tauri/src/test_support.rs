use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) struct TestWorkspaceDir {
    pub(crate) path: PathBuf,
}

impl TestWorkspaceDir {
    pub(crate) fn new(prefix: &str) -> Self {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let path =
            std::env::temp_dir().join(format!("kefer-{prefix}-{}-{unique}", std::process::id()));
        fs::create_dir_all(&path).expect("temporary test directory should be creatable");
        Self { path }
    }
}

impl Drop for TestWorkspaceDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

pub(crate) fn sample_workspace_path() -> String {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../backend-python/tests/sample")
        .canonicalize()
        .expect("sample workspace should exist")
        .to_string_lossy()
        .into_owned()
}

pub(crate) fn sample_chart_source_path() -> String {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../backend-python/tests/sample/charts/base-chart.yml")
        .canonicalize()
        .expect("sample chart should exist")
        .to_string_lossy()
        .into_owned()
}

pub(crate) fn sample_chart_payload(chart_id: &str) -> serde_json::Value {
    serde_json::json!({
        "id": chart_id,
        "subject": {
            "id": chart_id,
            "name": chart_id,
            "event_time": "2024-01-01T12:00:00+01:00",
            "location": {
                "name": "Prague, CZ",
                "latitude": 50.0875,
                "longitude": 14.4214,
                "timezone": "Europe/Prague"
            }
        },
        "config": {
            "mode": "NATAL",
            "house_system": "Placidus",
            "zodiac_type": "Tropical",
            "included_points": [],
            "aspect_orbs": {
                "conjunction": 8.0,
                "square": 6.0
            },
            "display_style": "",
            "color_theme": "",
            "override_ephemeris": null,
            "model": null,
            "engine": "jpl",
            "ayanamsa": null,
            "observable_objects": ["sun", "moon", "asc"],
            "time_system": null
        },
        "computed_chart": null,
        "tags": ["test"]
    })
}
