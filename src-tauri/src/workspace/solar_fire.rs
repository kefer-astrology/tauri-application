//! Solar Fire format/version matrix and import scaffold.
//!
//! This module deliberately does not parse Solar Fire files yet.  It gives the
//! import layer one place to document the formats and to produce useful errors
//! while format samples are being collected.

use std::path::Path;

/// Known Solar Fire-related file families.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SolarFireFormat {
    /// Solar Fire 6+ native chart file format.
    NativeV6Plus,
    /// Solar Fire 4/5 (and older-compatible) native chart format.
    LegacyChart,
    /// Solar Fire chart comments; not a standalone chart.
    ChartComments,
    /// Swiss Ephemeris data; not a chart file.
    SwissEphemeris,
    /// An extension reported in the wild but not yet mapped to a documented
    /// Solar Fire chart format.
    UnmappedLegacy,
}

impl SolarFireFormat {
    pub const fn label(self) -> &'static str {
        match self {
            Self::NativeV6Plus => "Solar Fire v6+ native chart (.SFcht)",
            Self::LegacyChart => "Solar Fire legacy chart (.cht)",
            Self::ChartComments => "Solar Fire chart comments (.chm)",
            Self::SwissEphemeris => "Swiss Ephemeris data (.se1)",
            Self::UnmappedLegacy => "Unmapped Solar Fire-related legacy file",
        }
    }
}

/// Classifies a Solar Fire-related extension without inspecting file bytes.
pub fn classify_extension(extension: &str) -> Option<SolarFireFormat> {
    match extension
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase()
        .as_str()
    {
        "sfcht" => Some(SolarFireFormat::NativeV6Plus),
        "cht" => Some(SolarFireFormat::LegacyChart),
        "chm" => Some(SolarFireFormat::ChartComments),
        "se1" => Some(SolarFireFormat::SwissEphemeris),
        "ald" | "cst" => Some(SolarFireFormat::UnmappedLegacy),
        _ => None,
    }
}

/// Placeholder for the eventual native Solar Fire parser.
pub fn read_solar_fire_chart(
    path: &Path,
) -> Result<crate::workspace::models::ChartInstance, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    let format = classify_extension(extension)
        .ok_or_else(|| format!("Unrecognized Solar Fire file: {}", path.display()))?;

    Err(match format {
        SolarFireFormat::NativeV6Plus | SolarFireFormat::LegacyChart => format!(
            "Solar Fire import scaffold: {} is recognized, but parsing is not implemented yet ({})",
            path.display(),
            format.label()
        ),
        _ => format!(
            "{} is not a standalone Solar Fire chart and cannot be imported as a horoscope",
            format.label()
        ),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_documented_chart_formats() {
        assert_eq!(
            classify_extension("SFcht"),
            Some(SolarFireFormat::NativeV6Plus)
        );
        assert_eq!(
            classify_extension(".cht"),
            Some(SolarFireFormat::LegacyChart)
        );
        assert_eq!(
            classify_extension("chm"),
            Some(SolarFireFormat::ChartComments)
        );
        assert_eq!(
            classify_extension("se1"),
            Some(SolarFireFormat::SwissEphemeris)
        );
    }

    #[test]
    fn keeps_unmapped_extensions_visible() {
        assert_eq!(
            classify_extension("ald"),
            Some(SolarFireFormat::UnmappedLegacy)
        );
        assert_eq!(
            classify_extension("cst"),
            Some(SolarFireFormat::UnmappedLegacy)
        );
        assert_eq!(classify_extension("txt"), None);
    }
}
