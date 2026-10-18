//! How a chart/radix is calculated: house system, zodiac type, ayanamsa,
//! engine, position mode, and time system all belong together as one
//! cluster of calculation-configuration choices.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum HouseSystem {
    #[serde(rename = "Placidus")]
    Placidus,
    #[serde(rename = "Whole Sign")]
    WholeSign,
    #[serde(rename = "Campanus")]
    Campanus,
    #[serde(rename = "Koch")]
    Koch,
    #[serde(rename = "Equal")]
    Equal,
    #[serde(rename = "Regiomontanus")]
    Regiomontanus,
    #[serde(rename = "Vehlow")]
    Vehlow,
    #[serde(rename = "Porphyry")]
    Porphyry,
    #[serde(rename = "Alcabitius")]
    Alcabitius,
}

impl HouseSystem {
    /// Human-readable label matching the serde wire representation.
    pub fn label(&self) -> &'static str {
        match self {
            HouseSystem::Placidus => "Placidus",
            HouseSystem::WholeSign => "Whole Sign",
            HouseSystem::Campanus => "Campanus",
            HouseSystem::Koch => "Koch",
            HouseSystem::Equal => "Equal",
            HouseSystem::Regiomontanus => "Regiomontanus",
            HouseSystem::Vehlow => "Vehlow",
            HouseSystem::Porphyry => "Porphyry",
            HouseSystem::Alcabitius => "Alcabitius",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum ZodiacType {
    Tropical,
    Sidereal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EngineType {
    #[serde(rename = "swisseph")]
    Swisseph,
    #[serde(rename = "jyotish")]
    Jyotish,
    #[serde(rename = "jpl")]
    Jpl,
    #[serde(rename = "custom")]
    Custom,
}

/// Observer-relative correction applied to ephemeris body positions.
/// `Apparent` includes light-time and stellar aberration; `Geometric` is the
/// instantaneous true vector without those observational corrections.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PositionMode {
    Apparent,
    Geometric,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Ayanamsa {
    #[serde(rename = "Lahiri")]
    Lahiri,
    #[serde(rename = "Raman")]
    Raman,
    #[serde(rename = "Krishnamurti")]
    Krishnamurti,
    #[serde(rename = "FaganBradley")]
    FaganBradley,
    #[serde(rename = "DeLuce")]
    DeLuce,
    #[serde(rename = "UserDefined")]
    UserDefined,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TimeSystem {
    #[serde(rename = "gregorian")]
    Gregorian,
    #[serde(rename = "julian_day")]
    JulianDay,
    #[serde(rename = "julian_calendar")]
    JulianCalendar,
    #[serde(rename = "unix_timestamp")]
    UnixTimestamp,
    #[serde(rename = "ordinal_date")]
    OrdinalDate,
    #[serde(rename = "iso_week_date")]
    IsoWeekDate,
    #[serde(rename = "compact_date")]
    CompactDate,
}
