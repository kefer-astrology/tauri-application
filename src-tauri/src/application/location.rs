//! Location resolution use case: turns a free-form place query into resolved,
//! timezone-annotated candidates using the geocoding infrastructure.

use crate::infrastructure::geocoding::{self, NominatimSearchResult};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeocodedLocation {
    pub query: String,
    pub display_name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
}

/// Search a free-form place string and return multiple candidate locations.
pub async fn search_locations(query: &str) -> Result<Vec<GeocodedLocation>, String> {
    let trimmed_query = query.trim();
    if trimmed_query.is_empty() {
        return Err("Location query is required".to_string());
    }

    let candidates = geocoding::fetch_candidates(trimmed_query).await?;
    select_nominatim_results(trimmed_query, &candidates)
}

fn select_nominatim_results(
    query: &str,
    candidates: &[NominatimSearchResult],
) -> Result<Vec<GeocodedLocation>, String> {
    if candidates.is_empty() {
        return Err(format!("No location results found for '{query}'"));
    }

    candidates
        .iter()
        .map(|candidate| {
            let latitude = candidate
                .lat
                .parse::<f64>()
                .map_err(|err| format!("Invalid latitude returned by geocoder: {err}"))?;
            let longitude = candidate
                .lon
                .parse::<f64>()
                .map_err(|err| format!("Invalid longitude returned by geocoder: {err}"))?;

            Ok(GeocodedLocation {
                query: query.to_string(),
                display_name: candidate.display_name.clone(),
                latitude,
                longitude,
                timezone: geocoding::timezone_for_coordinates(latitude, longitude)?,
            })
        })
        .collect()
}

#[cfg(test)]
fn select_nominatim_result(
    query: &str,
    candidates: &[NominatimSearchResult],
) -> Result<GeocodedLocation, String> {
    select_nominatim_results(query, candidates)?
        .into_iter()
        .next()
        .ok_or_else(|| format!("No location results found for '{query}'"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn select_nominatim_result_returns_first_candidate() {
        let candidates = vec![NominatimSearchResult {
            display_name: "Prague, Czechia".to_string(),
            lat: "50.0875".to_string(),
            lon: "14.4214".to_string(),
        }];

        let result =
            select_nominatim_result("Prague", &candidates).expect("candidate should resolve");

        assert_eq!(result.display_name, "Prague, Czechia");
        assert_eq!(result.latitude, 50.0875);
        assert_eq!(result.longitude, 14.4214);
        assert_eq!(result.timezone, "Europe/Prague");
    }

    #[test]
    fn select_nominatim_result_rejects_empty_candidate_list() {
        let err =
            select_nominatim_result("Unknown", &[]).expect_err("empty result list should fail");
        assert!(err.contains("No location results found"));
    }
}
