/// Pure-Rust astronomical and astrological calculations that do not depend on any
/// external C library. Used by JplAstronomyBackend in place of libswe's house routines.
///
/// All angles are in degrees unless stated otherwise.
/// Longitude conventions: ecliptic longitude in [0, 360).
use std::f64::consts::PI;

use crate::infrastructure::astronomy::AstronomyMotion;

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
    let arcsec = 5028.796_195 * t + 1.105_434_8 * t * t + 0.000_079_64 * t * t * t;
    arcsec / 3600.0
}

// ─── obliquity ───────────────────────────────────────────────────────────────

/// Mean obliquity of the ecliptic (degrees), IAU 1980 formula.
/// Accurate to better than 0.01" over ±2000 years from J2000.
pub fn mean_obliquity_deg(jd_ut: f64) -> f64 {
    let t = j2000_centuries(jd_ut);
    23.439_291_111 - 0.013_004_167 * t - 0.000_000_164 * t * t + 0.000_000_504 * t * t * t
}

// ─── sidereal time ───────────────────────────────────────────────────────────

/// Greenwich Mean Sidereal Time (degrees), IAU formula.
pub fn gmst_deg(jd_ut: f64) -> f64 {
    let d = jd_ut - 2451545.0;
    let t = d / 36525.0;
    let theta =
        280.460_618_37 + 360.985_647_366_29 * d + 0.000_387_933 * t * t - t * t * t / 38_710_000.0;
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

/// Campanus house cusps: divide the prime vertical into equal 30° arcs and
/// project those division circles onto the ecliptic.
///
/// Returns 12 values in order (house 1 through 12). Houses 1, 4, 7, and 10 are
/// the ascendant, IC, descendant, and MC respectively.
pub fn campanus_cusps(
    jd_ut: f64,
    geo_lat_deg: f64,
    geo_lon_deg: f64,
    asc_lon_deg: f64,
    mc_lon_deg: f64,
) -> (Vec<f64>, Vec<String>) {
    let eps = mean_obliquity_deg(jd_ut);
    let ramc = local_sidereal_time_deg(jd_ut, geo_lon_deg);

    let lat = geo_lat_deg.to_radians();
    let sin_lat = lat.sin();
    let cos_lat = lat.cos();
    if cos_lat.abs() < 1e-12 {
        return (
            whole_sign_cusps(asc_lon_deg),
            vec!["campanus_undefined_at_geographic_pole; whole_sign_used".to_string()],
        );
    }

    let sqrt3 = 3.0_f64.sqrt();
    let fh1 = (sin_lat * 0.5).asin().to_degrees();
    let fh2 = (sin_lat * sqrt3 * 0.5).asin().to_degrees();
    let xh1 = (sqrt3 / cos_lat).atan().to_degrees();
    let xh2 = ((1.0 / sqrt3) / cos_lat).atan().to_degrees();

    let h11 = great_circle_ecliptic_intersection(ramc + 90.0 - xh1, fh1, eps);
    let h12 = great_circle_ecliptic_intersection(ramc + 90.0 - xh2, fh2, eps);
    let h2 = great_circle_ecliptic_intersection(ramc + 90.0 + xh2, fh2, eps);
    let h3 = great_circle_ecliptic_intersection(ramc + 90.0 + xh1, fh1, eps);

    let desc = normalize_deg(asc_lon_deg + 180.0);
    let ic = normalize_deg(mc_lon_deg + 180.0);
    let cusps = vec![
        asc_lon_deg,
        h2,
        h3,
        ic,
        normalize_deg(h11 + 180.0),
        normalize_deg(h12 + 180.0),
        desc,
        normalize_deg(h2 + 180.0),
        normalize_deg(h3 + 180.0),
        mc_lon_deg,
        h11,
        h12,
    ];
    (cusps, vec![])
}

/// Placidus house cusps (houses 2–5, 8–11 computed iteratively; 1, 4, 7, 10 are the angles).
/// Returns 12 values in order (house 1 through 12).
/// Falls back to Whole Sign with a warning when Placidus is undefined (high latitudes).
pub fn placidus_cusps(
    jd_ut: f64,
    geo_lat_deg: f64,
    geo_lon_deg: f64,
    asc_lon_deg: f64,
    mc_lon_deg: f64,
) -> (Vec<f64>, Vec<String>) {
    let eps = mean_obliquity_deg(jd_ut);
    let ramc = local_sidereal_time_deg(jd_ut, geo_lon_deg);
    let lat = geo_lat_deg.to_radians();

    // Placidus is undefined inside the polar circle.
    if geo_lat_deg.abs() >= 90.0 - eps {
        return (
            whole_sign_cusps(asc_lon_deg),
            vec!["placidus_undefined_at_latitude; whole_sign_used".to_string()],
        );
    }

    let desc = normalize_deg(asc_lon_deg + 180.0);
    let ic = normalize_deg(mc_lon_deg + 180.0);

    // The intermediate Placidus cusps are derived from RAMC, not from MC/IC
    // ecliptic longitude. Using longitude as RAMC preserves the angles but can
    // put houses 2/3/8/9 into the wrong quadrant.
    let tan_eps = eps.to_radians().tan();
    let a = (lat.tan() * tan_eps).asin().to_degrees();
    let fh1 = ((a / 3.0).to_radians().sin() / tan_eps).atan().to_degrees();
    let fh2 = ((a * 2.0 / 3.0).to_radians().sin() / tan_eps)
        .atan()
        .to_degrees();

    let h11 = placidus_cusp(normalize_deg(ramc + 30.0), fh1, 3.0, eps, lat);
    let h12 = placidus_cusp(normalize_deg(ramc + 60.0), fh2, 1.5, eps, lat);
    let h2 = placidus_cusp(normalize_deg(ramc + 120.0), fh2, 1.5, eps, lat);
    let h3 = placidus_cusp(normalize_deg(ramc + 150.0), fh1, 3.0, eps, lat);

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

/// Single Placidus cusp following the Swiss Ephemeris iterative projection.
/// `rectasc_deg` is the cusp's right ascension seed derived from RAMC.
fn placidus_cusp(
    rectasc_deg: f64,
    initial_pole_height_deg: f64,
    divisor: f64,
    obliquity_deg: f64,
    lat_rad: f64,
) -> f64 {
    let mut cusp =
        great_circle_ecliptic_intersection(rectasc_deg, initial_pole_height_deg, obliquity_deg);
    let tan_lat = lat_rad.tan();

    for _ in 0..100 {
        let decl_tan = (obliquity_deg.to_radians().sin() * cusp.to_radians().sin())
            .asin()
            .tan();
        if decl_tan.abs() < 1e-12 {
            return rectasc_deg;
        }

        let asin_arg = (tan_lat * decl_tan).clamp(-1.0, 1.0);
        let pole_height = ((asin_arg.asin() / divisor).sin() / decl_tan)
            .atan()
            .to_degrees();
        let next = great_circle_ecliptic_intersection(rectasc_deg, pole_height, obliquity_deg);

        if angular_delta_deg_shortest(cusp, next).abs() < 1.0 / 360_000.0 {
            return next;
        }
        cusp = next;
    }

    cusp
}

/// Intersection of the ecliptic with a great circle. `equator_crossing_deg` is
/// the great circle's ascending-node-like crossing on the equator; `pole_height_deg`
/// is the circle pole's height above the equator.
fn great_circle_ecliptic_intersection(
    equator_crossing_deg: f64,
    pole_height_deg: f64,
    obliquity_deg: f64,
) -> f64 {
    let x = normalize_deg(equator_crossing_deg);
    let quadrant = (x / 90.0).floor() as i32 + 1;
    if (90.0 - pole_height_deg).abs() < 1e-10 {
        return 180.0;
    }
    if (90.0 + pole_height_deg).abs() < 1e-10 {
        return 0.0;
    }

    let projected = match quadrant {
        1 => great_circle_ecliptic_intersection_q1(x, pole_height_deg, obliquity_deg),
        2 => {
            180.0
                - great_circle_ecliptic_intersection_q1(180.0 - x, -pole_height_deg, obliquity_deg)
        }
        3 => {
            180.0
                + great_circle_ecliptic_intersection_q1(x - 180.0, -pole_height_deg, obliquity_deg)
        }
        _ => {
            360.0 - great_circle_ecliptic_intersection_q1(360.0 - x, pole_height_deg, obliquity_deg)
        }
    };
    normalize_deg(projected)
}

fn great_circle_ecliptic_intersection_q1(
    x_deg: f64,
    pole_height_deg: f64,
    obliquity_deg: f64,
) -> f64 {
    let x = x_deg.to_radians();
    let pole_height = pole_height_deg.to_radians();
    let eps = obliquity_deg.to_radians();
    let denominator = -pole_height.tan() * eps.sin() + eps.cos() * x.cos();
    let angle = x.sin().atan2(denominator).to_degrees();
    if angle < 0.0 {
        angle + 180.0
    } else {
        angle
    }
}

// ─── lunar node ──────────────────────────────────────────────────────────────

/// Mean ecliptic longitude of the ascending lunar node (Mean North Node), degrees.
/// IAU 1980 formula, accurate to ~0.1" over a few centuries.
pub fn mean_node_lon(jd_ut: f64) -> f64 {
    let t = j2000_centuries(jd_ut);
    let omega =
        125.044_555_01 - 1934.136_261_97 * t + 0.002_075_81 * t * t + 0.000_002_15 * t * t * t;
    normalize_deg(omega)
}

fn angular_delta_deg_shortest(from_deg: f64, to_deg: f64) -> f64 {
    let mut d = normalize_deg(to_deg) - normalize_deg(from_deg);
    if d > 180.0 {
        d -= 360.0;
    } else if d < -180.0 {
        d += 360.0;
    }
    d
}

/// Mean-node apparent motion (degrees per tropical day) from a short finite-difference
/// on `mean_node_lon` — closer to ephemeris than a constant −0.05295°/day.
pub fn mean_node_motion(jd_ut: f64) -> AstronomyMotion {
    const SAMPLE_STEP_SECONDS: f64 = 3600.0;
    let dt_days = SAMPLE_STEP_SECONDS / 86400.0;
    let before = mean_node_lon(jd_ut - dt_days);
    let after = mean_node_lon(jd_ut + dt_days);
    let delta = angular_delta_deg_shortest(before, after);
    let speed = delta / ((SAMPLE_STEP_SECONDS * 2.0) / 86_400.0);
    AstronomyMotion {
        speed,
        retrograde: speed < 0.0,
    }
}

/// Rotate an ICRF/J2000 equatorial vector (km or km/s) into the mean ecliptic of date
/// frame using the same obliquity convention as `icrf_to_ecliptic`.
pub fn icrf_xyz_to_ecliptic_xyz(x: f64, y: f64, z: f64, obliquity_deg: f64) -> (f64, f64, f64) {
    let eps = obliquity_deg.to_radians();
    let cos_eps = eps.cos();
    let sin_eps = eps.sin();
    let x_e = x;
    let y_e = y * cos_eps + z * sin_eps;
    let z_e = -y * sin_eps + z * cos_eps;
    (x_e, y_e, z_e)
}

/// Ecliptic longitude (degrees, [0,360)) of the direction `(x,y,z)` in ICRF equatorial,
/// using mean obliquity of date (same longitude definition as planetary longitudes here).
pub fn ecliptic_longitude_deg_from_icrf_xyz(x: f64, y: f64, z: f64, obliquity_deg: f64) -> f64 {
    let (x_e, y_e, _) = icrf_xyz_to_ecliptic_xyz(x, y, z, obliquity_deg);
    normalize_deg(y_e.atan2(x_e).to_degrees())
}

/// True (osculating) ascending lunar node, **tropical** longitude (degrees).
///
/// Uses the geocentric Moon position and velocity in the same inertial frame as the
/// planetary BSP vectors (km, km/s), the mean obliquity of date, and `general_precession_deg`
/// so the result matches other JPL/anise tropical longitudes in this backend.
///
/// The line of nodes is `K × h` with `K` the ecliptic north pole in equatorial coordinates
/// and `h = r × v` the Moon's orbital angular momentum. Returns `None` if degenerate.
pub fn true_node_tropical_deg(
    rx: f64,
    ry: f64,
    rz: f64,
    vx: f64,
    vy: f64,
    vz: f64,
    jd_ut: f64,
) -> Option<f64> {
    let hx = ry * vz - rz * vy;
    let hy = rz * vx - rx * vz;
    let hz = rx * vy - ry * vx;
    let h_sq = hx * hx + hy * hy + hz * hz;
    if !h_sq.is_finite() || h_sq < 1e-50 {
        return None;
    }

    let eps_deg = mean_obliquity_deg(jd_ut);
    let eps = eps_deg.to_radians();
    let kx = 0.0_f64;
    let ky = -eps.sin();
    let kz = eps.cos();
    // Line of nodes: K × h (ascending-node direction for prograde Moon motion).
    let nx = ky * hz - kz * hy;
    let ny = kz * hx - kx * hz;
    let nz = kx * hy - ky * hx;
    let n_norm = (nx * nx + ny * ny + nz * nz).sqrt();
    if !n_norm.is_finite() || n_norm < 1e-30 {
        return None;
    }
    let nxs = nx / n_norm;
    let nys = ny / n_norm;
    let nzs = nz / n_norm;

    let lambda_mean_ecliptic = ecliptic_longitude_deg_from_icrf_xyz(nxs, nys, nzs, eps_deg);
    let mut tropical = normalize_deg(lambda_mean_ecliptic + general_precession_deg(jd_ut));

    // Resolve ascending vs descending along the line of nodes: use Moon ecliptic latitude rate.
    let (_, _, mz_e) = icrf_xyz_to_ecliptic_xyz(rx, ry, rz, eps_deg);
    let (_, _, vz_e) = icrf_xyz_to_ecliptic_xyz(vx, vy, vz, eps_deg);
    let ascending = mz_e * vz_e < 0.0 || (mz_e.abs() < 1e-9 && vz_e > 0.0);
    if !ascending {
        tropical = normalize_deg(tropical + 180.0);
    }

    Some(tropical)
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
        assert!(
            (eps - 23.439291).abs() < 0.0001,
            "obliquity at J2000: {eps}"
        );
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

    #[test]
    fn campanus_cusps_are_not_whole_sign() {
        let jd = 2451545.0;
        let lat = 50.0875;
        let lon = 14.4214;
        let (asc, mc, desc, ic) = compute_axes(jd, lat, lon).expect("axes");
        let (campanus, warnings) = campanus_cusps(jd, lat, lon, asc, mc);
        assert!(warnings.is_empty(), "unexpected warnings: {warnings:?}");
        assert_eq!(campanus.len(), 12);
        assert!(campanus.iter().all(|cusp| cusp.is_finite()));
        assert!((campanus[0] - asc).abs() < 1e-9);
        assert!((campanus[3] - ic).abs() < 1e-9);
        assert!((campanus[6] - desc).abs() < 1e-9);
        assert!((campanus[9] - mc).abs() < 1e-9);

        let whole = whole_sign_cusps(asc);
        assert!(
            campanus
                .iter()
                .zip(whole.iter())
                .any(|(a, b)| angular_delta_deg_shortest(*a, *b).abs() > 1.0),
            "Campanus collapsed to Whole Sign: {campanus:?}"
        );
    }

    #[test]
    fn placidus_cusps_advance_in_house_order() {
        let jd = 2451545.0;
        let lat = 50.0875;
        let lon = 14.4214;
        let (asc, mc, desc, ic) = compute_axes(jd, lat, lon).expect("axes");
        let (cusps, warnings) = placidus_cusps(jd, lat, lon, asc, mc);
        assert!(warnings.is_empty(), "unexpected warnings: {warnings:?}");
        assert_eq!(cusps.len(), 12);
        assert!((cusps[0] - asc).abs() < 1e-9);
        assert!((cusps[3] - ic).abs() < 1e-9);
        assert!((cusps[6] - desc).abs() < 1e-9);
        assert!((cusps[9] - mc).abs() < 1e-9);

        for index in 0..cusps.len() {
            let current = cusps[index];
            let next = cusps[(index + 1) % cusps.len()];
            let arc = normalize_deg(next - current);
            assert!(
                arc > 0.0 && arc < 90.0,
                "cusp {} to {} should advance by a plausible house arc, got {arc} from {current} to {next}; cusps={cusps:?}",
                index + 1,
                (index + 1) % cusps.len() + 1
            );
        }
    }
}
