/// Pure-Rust astronomical and astrological calculations that do not depend on any
/// external C library. Used by JplAstronomyBackend in place of libswe's house routines.
///
/// All angles are in degrees unless stated otherwise.
/// Longitude conventions: ecliptic longitude in [0, 360).

use std::f64::consts::PI;

// ─── time helpers ────────────────────────────────────────────────────────────

/// Julian Day Number (UT) from a Unix timestamp (seconds since 1970-01-01 00:00:00 UTC).
pub fn julian_day_from_unix(unix_secs: f64) -> f64 {
    2440587.5 + unix_secs / 86400.0
}

/// Julian centuries from J2000.0.
fn j2000_centuries(jd_ut: f64) -> f64 {
    (jd_ut - 2451545.0) / 36525.0
}

/// General precession in longitude (arcseconds), IAU 1976-style polynomial.
/// Good enough here to shift J2000 ecliptic longitudes toward equinox-of-date tropical longitudes.
pub fn general_precession_deg(jd_ut: f64) -> f64 {
    let t = j2000_centuries(jd_ut);
    let arcsec =
        5028.796_195 * t + 1.105_434_8 * t * t + 0.000_079_64 * t * t * t;
    arcsec / 3600.0
}

// ─── obliquity ───────────────────────────────────────────────────────────────

/// Mean obliquity of the ecliptic (degrees), IAU 1980 formula.
/// Accurate to better than 0.01" over ±2000 years from J2000.
pub fn mean_obliquity_deg(jd_ut: f64) -> f64 {
    let t = j2000_centuries(jd_ut);
    23.439_291_111
        - 0.013_004_167 * t
        - 0.000_000_164 * t * t
        + 0.000_000_504 * t * t * t
}

// ─── sidereal time ───────────────────────────────────────────────────────────

/// Greenwich Mean Sidereal Time (degrees), IAU formula.
pub fn gmst_deg(jd_ut: f64) -> f64 {
    let d = jd_ut - 2451545.0;
    let t = d / 36525.0;
    let theta = 280.460_618_37
        + 360.985_647_366_29 * d
        + 0.000_387_933 * t * t
        - t * t * t / 38_710_000.0;
    normalize_deg(theta)
}

/// Local Sidereal Time (degrees) for a geographic longitude (degrees east positive).
pub fn local_sidereal_time_deg(jd_ut: f64, geo_lon_deg: f64) -> f64 {
    normalize_deg(gmst_deg(jd_ut) + geo_lon_deg)
}

// ─── ecliptic axes ───────────────────────────────────────────────────────────

/// Ecliptic longitude of the Midheaven (MC) from RAMC and obliquity (all degrees).
pub fn midheaven_lon(ramc_deg: f64, obliquity_deg: f64) -> f64 {
    let ramc = ramc_deg.to_radians();
    let eps = obliquity_deg.to_radians();
    let mc = f64::atan2(ramc.sin(), ramc.cos() * eps.cos()).to_degrees();
    normalize_deg(mc)
}

/// Ecliptic longitude of the Ascendant from RAMC, obliquity, and geographic latitude (all degrees).
///
/// Returns an error string when the Ascendant is undefined (observer at a geographic pole).
pub fn ascendant_lon(ramc_deg: f64, obliquity_deg: f64, geo_lat_deg: f64) -> Result<f64, String> {
    let ramc = ramc_deg.to_radians();
    let eps = obliquity_deg.to_radians();
    let lat = geo_lat_deg.to_radians();

    if lat.abs() >= PI / 2.0 - 1e-9 {
        return Err("Ascendant undefined at geographic poles".to_string());
    }

    // Standard formula: ASC = atan(-cos(RAMC) / (sin(eps)*tan(lat) + cos(eps)*sin(RAMC)))
    let y = -ramc.cos();
    let x = eps.sin() * lat.tan() + eps.cos() * ramc.sin();

    let asc = f64::atan2(y, x).to_degrees();
    // Quadrant: when denominator x < 0 the atan2 already places the angle in the
    // correct semicircle; normalise to [0, 360).
    Ok(normalize_deg(asc + 180.0))
}

/// Compute all four cardinal axes (asc, mc, desc, ic) in degrees.
pub fn compute_axes(
    jd_ut: f64,
    geo_lat_deg: f64,
    geo_lon_deg: f64,
) -> Result<(f64, f64, f64, f64), String> {
    let eps = mean_obliquity_deg(jd_ut);
    let ramc = local_sidereal_time_deg(jd_ut, geo_lon_deg);
    let mc = midheaven_lon(ramc, eps);
    let asc = ascendant_lon(ramc, eps, geo_lat_deg)?;
    let desc = normalize_deg(asc + 180.0);
    let ic = normalize_deg(mc + 180.0);
    Ok((asc, mc, desc, ic))
}

// ─── house cusps ─────────────────────────────────────────────────────────────

/// Whole Sign house cusps: 12 values, each the start of a 30° sign band.
/// House 1 begins at the start of the sign containing the Ascendant.
pub fn whole_sign_cusps(asc_lon_deg: f64) -> Vec<f64> {
    let first_house_start = (asc_lon_deg / 30.0).floor() * 30.0;
    (0..12)
        .map(|i| normalize_deg(first_house_start + i as f64 * 30.0))
        .collect()
}

/// Placidus house cusps (houses 2–5, 8–11 computed iteratively; 1, 4, 7, 10 are the angles).
/// Returns 12 values in order (house 1 through 12).
/// Falls back to Whole Sign with a warning when Placidus is undefined (high latitudes).
pub fn placidus_cusps(
    jd_ut: f64,
    geo_lat_deg: f64,
    _geo_lon_deg: f64,
    asc_lon_deg: f64,
    mc_lon_deg: f64,
) -> (Vec<f64>, Vec<String>) {
    let eps = mean_obliquity_deg(jd_ut).to_radians();
    let lat = geo_lat_deg.to_radians();

    // Placidus is undefined above ~66° (midnight sun region)
    if geo_lat_deg.abs() > 66.0 {
        return (
            whole_sign_cusps(asc_lon_deg),
            vec!["placidus_undefined_at_latitude; whole_sign_used".to_string()],
        );
    }

    let desc = normalize_deg(asc_lon_deg + 180.0);
    let ic = normalize_deg(mc_lon_deg + 180.0);

    // Cusps 2, 3 (between IC and ASC going clockwise) computed by trisecting the
    // semi-arc below the horizon.
    let h11 = placidus_cusp(mc_lon_deg, 1.0 / 3.0, eps, lat);
    let h12 = placidus_cusp(mc_lon_deg, 2.0 / 3.0, eps, lat);
    let h2 = placidus_cusp(ic, 2.0 / 3.0, eps, lat);
    let h3 = placidus_cusp(ic, 1.0 / 3.0, eps, lat);

    // Houses 5, 6, 8, 9 are opposite to 11, 12, 2, 3
    let h5 = normalize_deg(h11 + 180.0);
    let h6 = normalize_deg(h12 + 180.0);
    let h8 = normalize_deg(h2 + 180.0);
    let h9 = normalize_deg(h3 + 180.0);

    let cusps = vec![
        asc_lon_deg, // H1
        h2,          // H2
        h3,          // H3
        ic,          // H4
        h5,          // H5
        h6,          // H6
        desc,        // H7
        h8,          // H8
        h9,          // H9
        mc_lon_deg,  // H10
        h11,         // H11
        h12,         // H12
    ];
    (cusps, vec![])
}

/// Single Placidus cusp via the trisection formula.
/// `anchor` is MC or IC ecliptic longitude; `fraction` is 1/3 or 2/3.
fn placidus_cusp(anchor_deg: f64, fraction: f64, eps_rad: f64, lat_rad: f64) -> f64 {
    // Iterative solution: find λ such that its oblique ascension divided by the
    // semi-arc equals the fraction. Converges in ~5 iterations for most latitudes.
    let mut lon = anchor_deg;
    for _ in 0..20 {
        let lon_rad = lon.to_radians();
        let dec = f64::asin(eps_rad.sin() * lon_rad.sin()); // declination of the cusp
        let cos_dec = dec.cos();
        if cos_dec.abs() < 1e-10 {
            break;
        }
        // Semi-diurnal arc: angle from meridian to horizon
        let cos_sa = -(lat_rad.tan() * dec.tan());
        if cos_sa.abs() > 1.0 {
            break; // circumpolar or never rises
        }
        let sa = cos_sa.acos();
        // RAMC of the cusp
        let ramc_cusp = local_ramc_from_fraction(anchor_deg, fraction, sa.to_degrees());
        // Convert RAMC to ecliptic longitude
        let ramc_rad = ramc_cusp.to_radians();
        let new_lon = f64::atan2(ramc_rad.sin(), ramc_rad.cos() * eps_rad.cos()).to_degrees();
        let new_lon = normalize_deg(new_lon);
        if (new_lon - lon).abs() < 1e-6 {
            return new_lon;
        }
        lon = new_lon;
    }
    lon
}

fn local_ramc_from_fraction(anchor_deg: f64, fraction: f64, sa_deg: f64) -> f64 {
    normalize_deg(anchor_deg + fraction * sa_deg)
}

// ─── lunar node ──────────────────────────────────────────────────────────────

/// Mean ecliptic longitude of the ascending lunar node (Mean North Node), degrees.
/// IAU 1980 formula, accurate to ~0.1" over a few centuries.
pub fn mean_node_lon(jd_ut: f64) -> f64 {
    let t = j2000_centuries(jd_ut);
    let omega = 125.044_555_01
        - 1934.136_261_97 * t
        + 0.002_075_81 * t * t
        + 0.000_002_15 * t * t * t;
    normalize_deg(omega)
}

// ─── ecliptic transform ───────────────────────────────────────────────────────

/// Convert an ICRF/J2000 position vector (km) to ecliptic longitude and latitude (degrees).
pub fn icrf_to_ecliptic(x_km: f64, y_km: f64, z_km: f64, obliquity_deg: f64) -> (f64, f64) {
    let eps = obliquity_deg.to_radians();
    let cos_eps = eps.cos();
    let sin_eps = eps.sin();

    let x_ecl = x_km;
    let y_ecl = y_km * cos_eps + z_km * sin_eps;
    let z_ecl = -y_km * sin_eps + z_km * cos_eps;

    let lon = f64::atan2(y_ecl, x_ecl).to_degrees();
    let lat = f64::atan2(z_ecl, (x_ecl * x_ecl + y_ecl * y_ecl).sqrt()).to_degrees();

    (normalize_deg(lon), lat)
}

// ─── utilities ───────────────────────────────────────────────────────────────

/// Normalize an angle to [0, 360).
pub fn normalize_deg(deg: f64) -> f64 {
    ((deg % 360.0) + 360.0) % 360.0
}

// ─── tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn obliquity_j2000() {
        let jd = 2451545.0; // J2000.0
        let eps = mean_obliquity_deg(jd);
        assert!((eps - 23.439291).abs() < 0.0001, "obliquity at J2000: {eps}");
    }

    #[test]
    fn mean_node_known_value() {
        let jd = 2451545.0; // J2000.0
        let omega = mean_node_lon(jd);
        // USNO gives ~125.04° at J2000.0
        assert!((omega - 125.04).abs() < 0.1, "mean node at J2000: {omega}");
    }

    #[test]
    fn normalize_wraps_correctly() {
        assert!((normalize_deg(360.0) - 0.0).abs() < 1e-10);
        assert!((normalize_deg(-10.0) - 350.0).abs() < 1e-10);
        assert!((normalize_deg(370.0) - 10.0).abs() < 1e-10);
    }

    #[test]
    fn icrf_to_ecliptic_x_axis() {
        // A point on the ICRF X axis should have lon=0, lat=0
        let (lon, lat) = icrf_to_ecliptic(1.0, 0.0, 0.0, 23.439291);
        assert!(lon.abs() < 1e-9, "lon={lon}");
        assert!(lat.abs() < 1e-9, "lat={lat}");
    }

    #[test]
    fn whole_sign_cusps_count() {
        let cusps = whole_sign_cusps(45.0); // ASC at 15° Taurus
        assert_eq!(cusps.len(), 12);
        assert!((cusps[0] - 30.0).abs() < 1e-9); // Taurus starts at 30°
    }
}
