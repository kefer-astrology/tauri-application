//! Canonical event-time parsing shared by persistence and application inputs.
//!
//! New inputs should be RFC 3339 timestamps with an explicit offset. Legacy
//! naive timestamps and dates remain readable and are interpreted as UTC.

use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};

const LEGACY_DATETIME_FORMATS: [&str; 3] =
    ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"];

pub fn parse_event_time(value: &str) -> Result<DateTime<Utc>, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(invalid_event_time(value));
    }
    if let Ok(datetime) = DateTime::parse_from_rfc3339(value) {
        return Ok(datetime.with_timezone(&Utc));
    }
    for format in LEGACY_DATETIME_FORMATS {
        if let Ok(datetime) = NaiveDateTime::parse_from_str(value, format) {
            return Ok(datetime.and_utc());
        }
    }
    if let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        if let Some(datetime) = date.and_hms_opt(0, 0, 0) {
            return Ok(datetime.and_utc());
        }
    }
    Err(invalid_event_time(value))
}

fn invalid_event_time(value: &str) -> String {
    format!(
        "invalid_event_time: '{value}' must be RFC3339 with an offset; \
         legacy YYYY-MM-DD[ HH:MM[:SS]] values are interpreted as UTC"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_event_time_fixture_matches_contract() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../contracts/event-time.json"))
                .expect("event-time fixture should be valid JSON");
        for case in fixture["accepted"]
            .as_array()
            .expect("accepted cases should be an array")
        {
            let parsed = parse_event_time(case["input"].as_str().expect("input should be text"))
                .expect("accepted event time should parse");
            assert_eq!(
                parsed.to_rfc3339(),
                case["utc"].as_str().expect("utc should be text")
            );
        }
        for value in fixture["rejected"]
            .as_array()
            .expect("rejected cases should be an array")
        {
            let error = parse_event_time(value.as_str().expect("input should be text"))
                .expect_err("rejected event time should fail");
            assert!(error.starts_with("invalid_event_time:"));
        }
    }
}
