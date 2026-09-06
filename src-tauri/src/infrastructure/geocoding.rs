use serde::Deserialize;
use std::sync::OnceLock;

const DEFAULT_GEOCODER_SEARCH_URL: &str = "https://nominatim.openstreetmap.org/search";
const GEOCODER_USER_AGENT: &str = "KeferAstrology/2.0 (desktop geocoding)";

#[derive(Debug, Clone, Deserialize)]
pub struct NominatimSearchResult {
    pub display_name: String,
    pub lat: String,
    pub lon: String,
}

/// Query the configured Nominatim-compatible endpoint for place candidates.
pub async fn fetch_candidates(query: &str) -> Result<Vec<NominatimSearchResult>, String> {
    let endpoint = std::env::var("KEFER_GEOCODER_SEARCH_URL")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_GEOCODER_SEARCH_URL.to_string());

    let client = reqwest::Client::builder()
        .user_agent(GEOCODER_USER_AGENT)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|err| format!("Failed to initialize geocoder client: {err}"))?;

    let response = client
        .get(&endpoint)
        .query(&[
            ("q", query),
            ("format", "jsonv2"),
            ("limit", "5"),
            ("addressdetails", "0"),
        ])
        .send()
        .await
        .map_err(|err| format!("Location lookup failed: {err}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Location lookup failed with status {}",
            response.status()
        ));
    }

    response
        .json::<Vec<NominatimSearchResult>>()
        .await
        .map_err(|err| format!("Failed to decode location lookup response: {err}"))
}

static TIMEZONE_FINDER: OnceLock<tzf_rs::DefaultFinder> = OnceLock::new();

/// Resolve an IANA timezone name from geographic coordinates.
pub fn timezone_for_coordinates(latitude: f64, longitude: f64) -> Result<String, String> {
    if !latitude.is_finite() || !(-90.0..=90.0).contains(&latitude) {
        return Err("Latitude must be between -90 and 90 degrees".to_string());
    }
    if !longitude.is_finite() || !(-180.0..=180.0).contains(&longitude) {
        return Err("Longitude must be between -180 and 180 degrees".to_string());
    }

    let finder = TIMEZONE_FINDER.get_or_init(tzf_rs::DefaultFinder::new);
    let timezone = finder.get_tz_name(longitude, latitude).trim();
    if timezone.is_empty() {
        Err(format!(
            "No timezone found for coordinates {latitude}, {longitude}"
        ))
    } else {
        Ok(timezone.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timezone_resolution_uses_coordinate_order() {
        assert_eq!(
            timezone_for_coordinates(50.0875, 14.4214).expect("Prague timezone should resolve"),
            "Europe/Prague"
        );
    }
}
