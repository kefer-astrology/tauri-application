/// Whether the Sun is above the horizon (a "day chart") given the Ascendant — the standard
/// sect determination used by Arabic Parts without needing full house cusps: the Sun sits in
/// the ecliptic semicircle from the Descendant to the Ascendant through the MC (houses 7-12).
pub fn is_day_chart(asc_deg: f64, sun_deg: f64) -> bool {
    crate::domain::houses::normalize_deg(sun_deg - asc_deg) >= 180.0
}

/// Generic Arabic Part (Lot): `Asc + a_deg − b_deg` by day, swapped (`Asc + b_deg − a_deg`) by
/// night — the classical day/night-sect reversal shared by every Hermetic Lot, not just Fortune
/// and Spirit. Callers pass the pair in "day order" (e.g. Fortune is day-order `(moon, sun)`),
/// and this function swaps it for a night chart. Returns degrees in [0, 360).
pub fn arabic_part(asc_deg: f64, is_day: bool, a_deg: f64, b_deg: f64) -> f64 {
    let part = if is_day {
        asc_deg + a_deg - b_deg
    } else {
        asc_deg + b_deg - a_deg
    };
    crate::domain::houses::normalize_deg(part)
}

/// Day/night-sect-dependent Arabic Parts (Lots) of Fortune and Spirit, degrees [0,360).
/// Returns `(part_of_fortune, part_of_spirit)`.
///
/// Day chart (Sun above the horizon — in the ecliptic semicircle from the
/// Descendant to the Ascendant through the MC, i.e. houses 7-12): Fortune =
/// Asc + Moon − Sun, Spirit = Asc + Sun − Moon. Night chart: the two formulas
/// swap. Day/night is read from the Sun's position relative to the Ascendant
/// along the ecliptic — the standard sect determination used without needing
/// full house cusps.
pub fn day_night_parts(asc_deg: f64, sun_deg: f64, moon_deg: f64) -> (f64, f64) {
    let is_day = is_day_chart(asc_deg, sun_deg);
    (
        arabic_part(asc_deg, is_day, moon_deg, sun_deg),
        arabic_part(asc_deg, is_day, sun_deg, moon_deg),
    )
}
