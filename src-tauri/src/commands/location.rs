use crate::application::location::GeocodedLocation;

/// Resolve an IANA timezone name from geographic coordinates.
#[tauri::command]
pub fn resolve_timezone(latitude: f64, longitude: f64) -> Result<String, String> {
    crate::infrastructure::geocoding::timezone_for_coordinates(latitude, longitude)
}

/// Resolve a free-form place string into coordinates using a configurable geocoder endpoint.
#[tauri::command]
pub async fn resolve_location(query: String) -> Result<GeocodedLocation, String> {
    crate::application::location::search_locations(&query)
        .await?
        .into_iter()
        .next()
        .ok_or_else(|| "No location results found".to_string())
}

/// Search a free-form place string and return multiple candidate locations.
#[tauri::command]
pub async fn search_locations(query: String) -> Result<Vec<GeocodedLocation>, String> {
    crate::application::location::search_locations(&query).await
}
