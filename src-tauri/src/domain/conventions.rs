//! Calculation conventions (kefer-contracts `conventions.json`).
//!
//! `kefer-positions/1` (mean equinox of date, GMST, mean obliquity) is the
//! default and is never changed implicitly. `kefer-positions/1-true-equinox`
//! adds IAU 2000A nutation (sofars `nut06a`) and the equation of the
//! equinoxes (`ee06a`) to exactly the same inputs, so the two conventions
//! differ only by those terms. An unknown or unimplemented id is computed
//! with the default and always reported with a warning, never silently.

/// Default convention id.
pub const MEAN_EQUINOX: &str = "kefer-positions/1";
/// Optional true-equinox convention id.
pub const TRUE_EQUINOX: &str = "kefer-positions/1-true-equinox";
/// Every convention this implementation computes.
#[cfg_attr(not(test), allow(dead_code))]
pub const IMPLEMENTED: [&str; 2] = [MEAN_EQUINOX, TRUE_EQUINOX];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Equinox {
    Mean,
    True,
}

/// The convention actually used for a requested id, plus a warning when the
/// request could not be honoured.
#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedConvention {
    pub id: &'static str,
    pub equinox: Equinox,
    pub warning: Option<String>,
}

pub fn resolve(requested: Option<&str>) -> ResolvedConvention {
    match requested.map(str::trim).filter(|id| !id.is_empty()) {
        None | Some(MEAN_EQUINOX) => ResolvedConvention {
            id: MEAN_EQUINOX,
            equinox: Equinox::Mean,
            warning: None,
        },
        Some(TRUE_EQUINOX) => ResolvedConvention {
            id: TRUE_EQUINOX,
            equinox: Equinox::True,
            warning: None,
        },
        Some(other) => ResolvedConvention {
            id: MEAN_EQUINOX,
            equinox: Equinox::Mean,
            warning: Some(format!(
                "calculation_convention_unsupported: {other}; {MEAN_EQUINOX}_used"
            )),
        },
    }
}

/// Nutation for a TT Julian date: (Δψ, Δε, equation of the equinoxes), degrees.
pub fn nutation_deg(jd_tt: f64) -> (f64, f64, f64) {
    let (date1, date2) = (2_400_000.5, jd_tt - 2_400_000.5);
    let (dpsi, deps) = sofars::pnp::nut06a(date1, date2);
    let ee = sofars::erst::ee06a(date1, date2);
    (dpsi.to_degrees(), deps.to_degrees(), ee.to_degrees())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_and_explicit_ids_resolve_without_warning() {
        assert_eq!(resolve(None).id, MEAN_EQUINOX);
        assert_eq!(resolve(Some(" ")).equinox, Equinox::Mean);
        assert_eq!(resolve(Some(MEAN_EQUINOX)).warning, None);
        let t = resolve(Some(TRUE_EQUINOX));
        assert_eq!(
            (t.id, t.equinox, t.warning),
            (TRUE_EQUINOX, Equinox::True, None)
        );
    }

    #[test]
    fn unknown_id_never_falls_back_silently() {
        let r = resolve(Some("kefer-positions/9"));
        assert_eq!(r.id, MEAN_EQUINOX);
        assert_eq!(
            r.warning.as_deref(),
            Some("calculation_convention_unsupported: kefer-positions/9; kefer-positions/1_used")
        );
    }

    #[test]
    fn nutation_matches_erfa_reference_at_j2000() {
        // ERFA nut06a at JD(TT) 2451545.0007428704 (contracts reference epoch 3).
        let (dpsi, _deps, ee) = nutation_deg(2_451_545.000_742_870_4);
        assert!(
            (dpsi - (-0.003_869_999_279_056_249)).abs() < 1e-12,
            "{dpsi}"
        );
        // Equation of the equinoxes = ERFA gst06a - gmst06 at the same epoch.
        let erfa_ee = 280.457_072_360_536_76 - 280.460_622_430_541_5;
        assert!((ee - erfa_ee).abs() < 1e-11, "{ee} vs {erfa_ee}");
    }
}
