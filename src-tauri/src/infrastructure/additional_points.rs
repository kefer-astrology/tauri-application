//! Native offline star astrometry and versioned hypothetical orbits, sharing the JPL Earth state.
use super::position_provider::AstronomyMotion;
use crate::domain::astrology::{hypothetical_heliocentric, FixedStar, HypotheticalBody};
use crate::domain::houses::normalize_deg;
use crate::workspace::models::{ChartInstance, PositionMode};
use anise::constants::frames::{EARTH_J2000, SSB_J2000, SUN_J2000};
use anise::prelude::*;
use hifitime::Epoch;
use sofars::{
    astro::{ab, apcg, atccq, atciq, pmsafe, IauAstrom},
    coords::ecm06,
    pnp::pmat06,
    vm::{c2s, rxp, s2c, trxp},
};
use std::collections::HashMap;
const AU: f64 = 149_597_870.7;

fn observer(almanac: &Almanac, unix: f64) -> Result<(IauAstrom, [f64; 3], f64), String> {
    let epoch = Epoch::from_unix_seconds(unix);
    let earth = almanac
        .transform(EARTH_J2000, SSB_J2000, epoch, None)
        .map_err(|e| e.to_string())?;
    let sun = almanac
        .transform(SUN_J2000, SSB_J2000, epoch, None)
        .map_err(|e| e.to_string())?;
    let ebpv = [
        std::array::from_fn(|n| earth.radius_km[n] / AU),
        std::array::from_fn(|n| earth.velocity_km_s[n] * 86400.0 / AU),
    ];
    let ehp = std::array::from_fn(|n| (earth.radius_km[n] - sun.radius_km[n]) / AU);
    let jd = epoch.to_jde_tt_days();
    let mut astrom = IauAstrom::default();
    apcg(2451545.0, jd - 2451545.0, &ebpv, &ehp, &mut astrom);
    Ok((astrom, ehp, jd))
}
fn project(vector: &[f64; 3], jd: f64) -> (f64, f64, f64) {
    let mut equatorial = [0.0; 3];
    rxp(&pmat06(2451545.0, jd - 2451545.0), vector, &mut equatorial);
    let (ra, dec) = c2s(&equatorial);
    let mut ecliptic = [0.0; 3];
    rxp(&ecm06(2451545.0, jd - 2451545.0), vector, &mut ecliptic);
    let (longitude, _) = c2s(&ecliptic);
    (
        normalize_deg(longitude.to_degrees()),
        normalize_deg(ra.to_degrees()),
        dec.to_degrees(),
    )
}
fn star_place(
    star: &FixedStar,
    mut astrom: IauAstrom,
    jd: f64,
    apparent: bool,
) -> Result<(f64, f64, f64), String> {
    crate::domain::astrology::validate_star(star)?;
    let dec = star.dec_deg.to_radians();
    if dec.cos().abs() < 1e-12 {
        return Err("catalog RA proper motion is singular at the celestial pole".into());
    }
    let mas_to_rad = std::f64::consts::PI / (180.0 * 3600000.0);
    let mut entry = [
        star.ra_deg.to_radians(),
        dec,
        star.pm_ra_cosdec_mas_per_year.unwrap_or(0.0) * mas_to_rad / dec.cos(),
        star.pm_dec_mas_per_year.unwrap_or(0.0) * mas_to_rad,
        star.parallax_mas.unwrap_or(0.0) / 1000.0,
        star.radial_velocity_km_s.unwrap_or(0.0),
    ];
    if (star.epoch_jd - 2451545.0).abs() > 1e-9 {
        entry = pmsafe(
            entry[0],
            entry[1],
            entry[2],
            entry[3],
            entry[4],
            entry[5],
            star.epoch_jd,
            0.0,
            2451545.0,
            0.0,
        )
        .map_err(|status| format!("catalog epoch propagation failed ({status})"))?
        .0;
    }
    // apcg leaves BPN at identity: these are GCRS/ICRS-axis directions, not CIRS RA.
    let (ra, dec) = if apparent {
        atciq(
            entry[0],
            entry[1],
            entry[2],
            entry[3],
            entry[4],
            entry[5],
            &mut astrom,
        )
    } else {
        atccq(
            entry[0], entry[1], entry[2], entry[3], entry[4], entry[5], &astrom,
        )
    };
    let value = project(&s2c(ra, dec), jd);
    if ![value.0, value.1, value.2].iter().all(|v| v.is_finite()) {
        return Err("invalid propagated star position".into());
    }
    Ok(value)
}
fn hypothetical_place(
    body: &HypotheticalBody,
    astrom: &IauAstrom,
    earth: &[f64; 3],
    jd: f64,
    apparent: bool,
) -> Result<(f64, f64, f64), String> {
    let mut emitted = jd;
    let mut relative = [0.0; 3];
    for _ in 0..if apparent { 8 } else { 1 } {
        let ecliptic = hypothetical_heliocentric(body, emitted)?;
        let mut icrs = [0.0; 3];
        trxp(&ecm06(body.equinox_jd, 0.0), &ecliptic, &mut icrs);
        relative = std::array::from_fn(|n| icrs[n] - earth[n]);
        let distance = relative.iter().map(|v| v * v).sum::<f64>().sqrt();
        let next = jd - distance / 173.144632674240;
        if (next - emitted).abs() < 1e-10 {
            break;
        }
        emitted = next;
    }
    let distance = relative.iter().map(|v| v * v).sum::<f64>().sqrt();
    if !distance.is_finite() || distance <= 0.0 {
        return Err("degenerate Earth-relative hypothetical position".into());
    }
    let unit = relative.map(|v| v / distance);
    let direction = if apparent {
        ab(&unit, &astrom.v, astrom.em, astrom.bm1)
    } else {
        unit
    };
    Ok(project(&direction, jd))
}

#[allow(clippy::too_many_arguments)]
pub fn inject_model_points(
    almanac: &Almanac,
    chart: &ChartInstance,
    unix: f64,
    wanted: &impl Fn(&str) -> bool,
    positions: &mut HashMap<String, f64>,
    motion: &mut HashMap<String, AstronomyMotion>,
    ra: &mut HashMap<String, f64>,
    dec: &mut HashMap<String, f64>,
    warnings: &mut Vec<String>,
) -> Result<(), String> {
    if wanted("lilith") {
        // Meeus mean lunar perigee, shifted by 180 degrees to the mean apogee.
        let t = (Epoch::from_unix_seconds(unix).to_jde_tt_days() - 2451545.0) / 36525.0;
        let longitude = normalize_deg(
            263.3532465 + 4069.0137287 * t - 0.0103200 * t * t - t * t * t / 80053.0
                + t.powi(4) / 18999000.0,
        );
        let speed = (4069.0137287 - 0.0206400 * t - 3.0 * t * t / 80053.0
            + 4.0 * t.powi(3) / 18999000.0)
            / 36525.0;
        positions.insert("lilith".into(), longitude);
        motion.insert(
            "lilith".into(),
            AstronomyMotion {
                speed,
                retrograde: speed < 0.0,
            },
        );
    }
    let library = super::point_library::point_library()?;
    let stars: Vec<_> = library.stars.iter().filter(|s| wanted(&s.id)).collect();
    let bodies: Vec<_> = library
        .hypotheticals
        .iter()
        .filter(|s| wanted(&s.id))
        .collect();
    if stars.is_empty() && bodies.is_empty() {
        return Ok(());
    }
    let apparent =
        chart.config.position_mode.unwrap_or(PositionMode::Apparent) == PositionMode::Apparent;
    let (astrom, earth, jd) = observer(almanac, unix)?;
    let mut central = HashMap::new();
    for star in &stars {
        match star_place(star, astrom.clone(), jd, apparent) {
            Ok(value) => {
                central.insert(star.id.clone(), value);
            }
            Err(e) => warnings.push(format!("{}_unavailable: {e}", star.id)),
        }
    }
    for body in &bodies {
        match hypothetical_place(body, &astrom, &earth, jd, apparent) {
            Ok(value) => {
                central.insert(body.id.clone(), value);
            }
            Err(e) => warnings.push(format!("{}_unavailable: {e}", body.id)),
        }
    }
    let step = 60.0;
    let before = observer(almanac, unix - step);
    let after = observer(almanac, unix + step);
    for (id, (longitude, right_ascension, declination)) in central {
        positions.insert(id.clone(), longitude);
        ra.insert(id.clone(), right_ascension);
        dec.insert(id.clone(), declination);
        if let (Ok((a, earth_a, jd_a)), Ok((b, earth_b, jd_b))) = (&before, &after) {
            let sample = |astrom: &IauAstrom, earth: &[f64; 3], jd: f64| -> Result<f64, String> {
                if let Some(star) = stars.iter().find(|s| s.id == id) {
                    Ok(star_place(star, astrom.clone(), jd, apparent)?.0)
                } else {
                    Ok(hypothetical_place(
                        bodies.iter().find(|s| s.id == id).unwrap(),
                        astrom,
                        earth,
                        jd,
                        apparent,
                    )?
                    .0)
                }
            };
            if let (Ok(left), Ok(right)) = (sample(a, earth_a, *jd_a), sample(b, earth_b, *jd_b)) {
                let speed =
                    ((right - left + 180.0).rem_euclid(360.0) - 180.0) * 86400.0 / (2.0 * step);
                motion.insert(
                    id,
                    AstronomyMotion {
                        speed,
                        retrograde: speed < 0.0,
                    },
                );
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn proper_motion_and_epoch_are_used() {
        let star = FixedStar {
            id: "star_test".into(),
            name: "Test".into(),
            identifier: "test".into(),
            epoch_jd: 2451545.0,
            ra_deg: 40.0,
            dec_deg: 20.0,
            pm_ra_cosdec_mas_per_year: Some(1000.0),
            pm_dec_mas_per_year: Some(0.0),
            parallax_mas: None,
            radial_velocity_km_s: None,
        };
        let mut astrom = IauAstrom::default();
        astrom.pmt = 100.0;
        let later = star_place(&star, astrom.clone(), 2451545.0, false).unwrap();
        astrom.pmt = 0.0;
        let now = star_place(&star, astrom, 2451545.0, false).unwrap();
        assert!((later.1 - now.1) > 0.029);
    }
}
