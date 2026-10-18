use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InputMode {
    Auto,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub utc_offset: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location_mode: Option<InputMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone_mode: Option<InputMode>,
}

pub fn validate_timezone_identifier(value: &str) -> Result<(), String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("Timezone is required".to_string());
    }
    if valid_utc_offset(value) || matches!(value, "UTC" | "GMT") {
        return Ok(());
    }
    if value.starts_with("UTC") || value.starts_with("GMT") {
        return Err(format!("Invalid fixed-offset timezone: '{value}'"));
    }
    if value.starts_with('/')
        || value.ends_with('/')
        || value.contains("//")
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "/_+-".contains(character))
    {
        return Err(format!("Invalid timezone identifier: '{value}'"));
    }
    Ok(())
}

pub fn validate_utc_offset(value: &str) -> Result<(), String> {
    if valid_utc_offset(value.trim()) {
        Ok(())
    } else {
        Err(format!(
            "Invalid UTC offset: '{value}' (expected UTC±HH:MM, maximum ±14:00)"
        ))
    }
}

fn valid_utc_offset(value: &str) -> bool {
    if value.is_empty() {
        return false;
    }
    if matches!(value, "UTC" | "GMT") {
        return true;
    }
    let value = value
        .strip_prefix("UTC")
        .or_else(|| value.strip_prefix("GMT"))
        .unwrap_or(value);
    let Some(signless) = value.strip_prefix('+').or_else(|| value.strip_prefix('-')) else {
        return false;
    };
    let Some((hours, minutes)) = signless.split_once(':') else {
        return false;
    };
    if hours.len() != 2 || minutes.len() != 2 {
        return false;
    }
    let (Ok(hours), Ok(minutes)) = (hours.parse::<u8>(), minutes.parse::<u8>()) else {
        return false;
    };
    minutes < 60 && (hours < 14 || (hours == 14 && minutes == 0))
}

pub fn validate_location(location: &Location) -> Result<(), String> {
    if location.name.trim().is_empty() {
        return Err("Location name is required".to_string());
    }
    if !location.latitude.is_finite() || !(-90.0..=90.0).contains(&location.latitude) {
        return Err("Latitude must be between -90 and 90 degrees".to_string());
    }
    if !location.longitude.is_finite() || !(-180.0..=180.0).contains(&location.longitude) {
        return Err("Longitude must be between -180 and 180 degrees".to_string());
    }
    validate_timezone_identifier(&location.timezone)?;
    if let Some(offset) = location.utc_offset.as_deref() {
        validate_utc_offset(offset)?;
    }
    Ok(())
}

#[cfg(test)]
mod location_validation_tests {
    use super::*;

    fn valid_location() -> Location {
        Location {
            name: "Prague".to_string(),
            latitude: 50.0875,
            longitude: 14.4214,
            timezone: "Europe/Prague".to_string(),
            utc_offset: None,
            location_mode: Some(InputMode::Auto),
            timezone_mode: Some(InputMode::Auto),
        }
    }

    #[test]
    fn accepts_iana_timezone_and_fractional_offset_override() {
        let mut location = valid_location();
        location.utc_offset = Some("UTC+05:45".to_string());
        assert!(validate_location(&location).is_ok());
    }

    #[test]
    fn rejects_invalid_coordinates_timezone_and_offset() {
        let mut location = valid_location();
        location.latitude = 91.0;
        assert!(validate_location(&location).is_err());

        location = valid_location();
        location.timezone = "Europe Prague".to_string();
        assert!(validate_location(&location).is_err());

        location = valid_location();
        location.timezone = "UTC+14:15".to_string();
        assert!(validate_location(&location).is_err());

        location = valid_location();
        location.utc_offset = Some("UTC+14:15".to_string());
        assert!(validate_location(&location).is_err());

        location = valid_location();
        location.utc_offset = Some(String::new());
        assert!(validate_location(&location).is_err());
    }
}
