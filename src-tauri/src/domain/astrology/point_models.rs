//! Astrometric and hypothetical model data; no global mutable catalog or implicit file execution.
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FixedStar {
    pub id: String,
    pub name: String,
    pub identifier: String,
    pub epoch_jd: f64,
    pub ra_deg: f64,
    pub dec_deg: f64,
    pub pm_ra_cosdec_mas_per_year: Option<f64>,
    pub pm_dec_mas_per_year: Option<f64>,
    pub parallax_mas: Option<f64>,
    pub radial_velocity_km_s: Option<f64>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixedStarCatalog {
    pub schema_version: u32,
    pub source: String,
    pub source_url: String,
    pub retrieved_at: String,
    pub reference_frame: String,
    pub stars: Vec<FixedStar>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HypotheticalBody {
    pub id: String,
    pub name: String,
    pub epoch_jd: f64,
    pub equinox_jd: f64,
    pub mean_anomaly_deg: f64,
    pub semimajor_axis_au: f64,
    pub eccentricity: f64,
    pub argument_perihelion_deg: f64,
    pub ascending_node_deg: f64,
    pub inclination_deg: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HypotheticalCatalog {
    pub schema_version: u32,
    pub source: String,
    pub source_url: String,
    pub model: String,
    pub bodies: Vec<HypotheticalBody>,
}
pub fn fixed_star_catalog() -> &'static FixedStarCatalog {
    static CATALOG: OnceLock<FixedStarCatalog> = OnceLock::new();
    CATALOG.get_or_init(|| {
        serde_json::from_str(include_str!(
            "../../../../contracts/points/fixed-stars.json"
        ))
        .expect("validated fixed star catalog")
    })
}
pub fn hypothetical_catalog() -> &'static HypotheticalCatalog {
    static CATALOG: OnceLock<HypotheticalCatalog> = OnceLock::new();
    CATALOG.get_or_init(|| {
        serde_json::from_str(include_str!(
            "../../../../contracts/points/hypothetical-bodies.json"
        ))
        .expect("validated hypothetical catalog")
    })
}
pub fn validate_star(star: &FixedStar) -> Result<(), String> {
    if !star.id.starts_with("star_")
        || star.name.trim().is_empty()
        || star.identifier.trim().is_empty()
        || !star.epoch_jd.is_finite()
        || !(2_000_000.0..3_000_000.0).contains(&star.epoch_jd)
        || !star.ra_deg.is_finite()
        || !(0.0..360.0).contains(&star.ra_deg)
        || !star.dec_deg.is_finite()
        || !(-90.0..=90.0).contains(&star.dec_deg)
        || [
            star.pm_ra_cosdec_mas_per_year,
            star.pm_dec_mas_per_year,
            star.parallax_mas,
            star.radial_velocity_km_s,
        ]
        .into_iter()
        .flatten()
        .any(|v| !v.is_finite())
        || star.parallax_mas.is_some_and(|v| v < 0.0)
        || star
            .radial_velocity_km_s
            .is_some_and(|v| v.abs() >= 299_792.458)
    {
        return Err(format!("invalid star data: {}", star.id));
    }
    Ok(())
}
pub fn validate_hypothetical(body: &HypotheticalBody) -> Result<(), String> {
    if body.id.is_empty()
        || body.name.trim().is_empty()
        || [
            body.epoch_jd,
            body.equinox_jd,
            body.mean_anomaly_deg,
            body.semimajor_axis_au,
            body.eccentricity,
            body.argument_perihelion_deg,
            body.ascending_node_deg,
            body.inclination_deg,
        ]
        .iter()
        .any(|v| !v.is_finite())
        || !(0.0..1.0).contains(&body.eccentricity)
        || !(0.001..=1_000_000.0).contains(&body.semimajor_axis_au)
        || !(0.0..=180.0).contains(&body.inclination_deg)
    {
        return Err(format!(
            "invalid hypothetical orbital elements: {}",
            body.id
        ));
    }
    Ok(())
}
/// Fixed-element Keplerian orbit in its source equinox's ecliptic, AU.
pub fn hypothetical_heliocentric(body: &HypotheticalBody, jd_tt: f64) -> Result<[f64; 3], String> {
    validate_hypothetical(body)?;
    let m = (body.mean_anomaly_deg.to_radians()
        + 0.01720209895 * (jd_tt - body.epoch_jd) / body.semimajor_axis_au.powf(1.5))
    .rem_euclid(std::f64::consts::TAU);
    let (mut low, mut high) = (0.0, std::f64::consts::TAU);
    let mut e = if body.eccentricity < 0.8 {
        m
    } else {
        std::f64::consts::PI
    };
    for _ in 0..80 {
        let residual = e - body.eccentricity * e.sin() - m;
        if residual.abs() < 1e-14 {
            break;
        }
        if residual > 0.0 {
            high = e;
        } else {
            low = e;
        }
        let candidate = e - residual / (1.0 - body.eccentricity * e.cos());
        e = if candidate > low && candidate < high {
            candidate
        } else {
            (low + high) / 2.0
        };
    }
    if (e - body.eccentricity * e.sin() - m).abs() > 1e-12 {
        return Err("Keplerian model did not converge".into());
    }
    let x = body.semimajor_axis_au * (e.cos() - body.eccentricity);
    let y = body.semimajor_axis_au * (1.0 - body.eccentricity.powi(2)).sqrt() * e.sin();
    let (sw, cw) = body.argument_perihelion_deg.to_radians().sin_cos();
    let (sn, cn) = body.ascending_node_deg.to_radians().sin_cos();
    let (si, ci) = body.inclination_deg.to_radians().sin_cos();
    Ok([
        (cw * cn - sw * ci * sn) * x + (-sw * cn - cw * ci * sn) * y,
        (cw * sn + sw * ci * cn) * x + (-sw * sn + cw * ci * cn) * y,
        sw * si * x + cw * si * y,
    ])
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn curated_catalogs_validate() {
        assert_eq!(fixed_star_catalog().stars.len(), 32);
        for star in &fixed_star_catalog().stars {
            validate_star(star).unwrap();
        }
        assert_eq!(hypothetical_catalog().bodies.len(), 8);
        for body in &hypothetical_catalog().bodies {
            let v = hypothetical_heliocentric(body, body.epoch_jd).unwrap();
            let r = v.iter().map(|v| v * v).sum::<f64>().sqrt();
            assert!(r >= body.semimajor_axis_au * (1.0 - body.eccentricity) - 1e-12);
            assert!(r <= body.semimajor_axis_au * (1.0 + body.eccentricity) + 1e-12);
        }
    }
    #[test]
    fn circular_model_returns_after_one_period_and_rejects_invalid_elements() {
        let mut body = hypothetical_catalog().bodies[4].clone();
        let period = std::f64::consts::TAU * body.semimajor_axis_au.powf(1.5) / 0.01720209895;
        let a = hypothetical_heliocentric(&body, body.epoch_jd).unwrap();
        let b = hypothetical_heliocentric(&body, body.epoch_jd + period).unwrap();
        for n in 0..3 {
            assert!((a[n] - b[n]).abs() < 1e-10);
        }
        body.eccentricity = 1.0;
        assert!(validate_hypothetical(&body).is_err());
    }
}
