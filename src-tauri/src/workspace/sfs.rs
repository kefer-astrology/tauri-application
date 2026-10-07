use std::collections::HashMap;
use std::fs;
use std::path::Path;

use chrono::{DateTime, Duration, NaiveDateTime, Utc};

use super::models::{
    BaseChartPurpose, ChartConfig, ChartDefinition, ChartInstance, ChartSubject, EngineType,
    InputMode, Location, PositionMode, TimeSystem, ZodiacType,
};

/// Reads a StarFisher EventData (`.sfs`) file and converts it to a workspace chart.
pub fn read_sfs_chart(path: &Path) -> Result<ChartInstance, String> {
    let bytes = fs::read(path)
        .map_err(|error| format!("Failed to read SFS file '{}': {error}", path.display()))?;
    parse_sfs_bytes(&bytes, path.file_name().and_then(|name| name.to_str()))
}

/// Parses a StarFisher EventData document from UTF-8 or BOM-marked UTF-16 bytes.
pub fn parse_sfs_bytes(bytes: &[u8], source_name: Option<&str>) -> Result<ChartInstance, String> {
    let text = decode_sfs_text(bytes)?;
    let fields = parse_event_data(&text)?;

    let latitude_text = required_field(&fields, "latitude")?;
    let longitude_text = required_field(&fields, "longitude")?;
    let date_text = required_field(&fields, "date")?;

    let latitude = parse_dms(latitude_text, CoordinateAxis::Latitude)?;
    let longitude = parse_dms(longitude_text, CoordinateAxis::Longitude)?;
    let (event_time, utc_offset) = parse_event_date(date_text)?;

    let caption = fields
        .get("caption")
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::trim)
        .map(str::to_owned)
        .or_else(|| source_stem(source_name))
        .unwrap_or_else(|| "Imported SFS chart".to_string());

    let location_name = fields
        .get("location")
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::trim)
        .map(str::to_owned)
        .unwrap_or_else(|| format!("{latitude:.6}, {longitude:.6}"));
    let timezone = fields
        .get("zone")
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::trim)
        .map(str::to_owned)
        .unwrap_or_else(|| utc_offset.clone());

    let tags = fields
        .get("keywords")
        .map(|keywords| split_tags(keywords))
        .unwrap_or_default();

    Ok(ChartInstance {
        id: caption.clone(),
        subject: ChartSubject {
            id: caption.clone(),
            name: caption,
            event_time: Some(event_time),
            location: Location {
                name: location_name,
                latitude,
                longitude,
                timezone,
                utc_offset: Some(utc_offset),
                location_mode: Some(InputMode::Manual),
                timezone_mode: Some(InputMode::Manual),
            },
        },
        config: ChartConfig {
            definition: ChartDefinition::Base {
                purpose: BaseChartPurpose::Event,
            },
            house_system: None,
            zodiac_type: ZodiacType::Tropical,
            aspect_orbs: HashMap::new(),
            selected_aspects: None,
            override_ephemeris: None,
            model: None,
            model_overrides: None,
            engine: Some(EngineType::Jpl),
            position_mode: Some(PositionMode::Apparent),
            ayanamsa: None,
            observable_objects: None,
            time_system: Some(TimeSystem::Gregorian),
        },
        tags,
        tag_colors: HashMap::new(),
        roden_rating: None,
    })
}

fn decode_sfs_text(bytes: &[u8]) -> Result<String, String> {
    if bytes.starts_with(&[0xff, 0xfe]) {
        decode_utf16(&bytes[2..], true)
    } else if bytes.starts_with(&[0xfe, 0xff]) {
        decode_utf16(&bytes[2..], false)
    } else {
        let bytes = bytes.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(bytes);
        std::str::from_utf8(bytes)
            .map(str::to_owned)
            .map_err(|error| format!("SFS input is not valid UTF-8: {error}"))
    }
}

fn decode_utf16(bytes: &[u8], little_endian: bool) -> Result<String, String> {
    if bytes.len() % 2 != 0 {
        return Err("SFS UTF-16 input has an incomplete code unit".to_string());
    }

    let units = bytes.chunks_exact(2).map(|pair| {
        let pair = [pair[0], pair[1]];
        if little_endian {
            u16::from_le_bytes(pair)
        } else {
            u16::from_be_bytes(pair)
        }
    });
    char::decode_utf16(units)
        .collect::<Result<String, _>>()
        .map_err(|error| format!("SFS input contains invalid UTF-16: {error}"))
}

fn parse_event_data(text: &str) -> Result<HashMap<String, String>, String> {
    let mut fields = HashMap::new();

    for (line_index, line) in text.lines().enumerate() {
        let line = line.trim();
        let Some(assignment) = line.strip_prefix("_eventData.") else {
            continue;
        };
        let (field, value) = assignment.split_once('=').ok_or_else(|| {
            format!(
                "Malformed SFS EventData assignment on line {}",
                line_index + 1
            )
        })?;
        let field = field.trim();
        if field.is_empty()
            || !field
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '_')
        {
            return Err(format!(
                "Invalid SFS EventData field on line {}",
                line_index + 1
            ));
        }
        let value = parse_quoted_value(value.trim(), line_index + 1)?;
        fields.insert(field.to_ascii_lowercase(), value);
    }

    Ok(fields)
}

fn parse_quoted_value(input: &str, line_number: usize) -> Result<String, String> {
    let Some(mut input) = input.strip_prefix('"') else {
        return Err(format!(
            "SFS EventData value on line {line_number} must be quoted"
        ));
    };
    let mut value = String::new();
    let mut escaped = false;

    while let Some(character) = input.chars().next() {
        input = &input[character.len_utf8()..];
        if escaped {
            value.push(match character {
                '"' => '"',
                '\\' => '\\',
                'n' => '\n',
                'r' => '\r',
                't' => '\t',
                _ => {
                    return Err(format!(
                        "Unsupported escape sequence on SFS line {line_number}"
                    ));
                }
            });
            escaped = false;
        } else {
            match character {
                '\\' => escaped = true,
                '"' => {
                    if input.trim() == ";" {
                        return Ok(value);
                    }
                    return Err(format!(
                        "Unexpected text after SFS value on line {line_number}"
                    ));
                }
                _ => value.push(character),
            }
        }
    }

    Err(format!(
        "Unterminated quoted SFS value on line {line_number}"
    ))
}

fn required_field<'a>(fields: &'a HashMap<String, String>, name: &str) -> Result<&'a str, String> {
    fields
        .get(name)
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("SFS EventData is missing required field '{name}'"))
}

#[derive(Clone, Copy)]
enum CoordinateAxis {
    Latitude,
    Longitude,
}

impl CoordinateAxis {
    fn name(self) -> &'static str {
        match self {
            Self::Latitude => "Latitude",
            Self::Longitude => "Longitude",
        }
    }

    fn maximum(self) -> f64 {
        match self {
            Self::Latitude => 90.0,
            Self::Longitude => 180.0,
        }
    }

    fn accepts(self, hemisphere: char) -> bool {
        matches!(
            (self, hemisphere),
            (Self::Latitude, 'N' | 'S') | (Self::Longitude, 'E' | 'W')
        )
    }
}

fn parse_dms(input: &str, axis: CoordinateAxis) -> Result<f64, String> {
    let input = input.trim();
    let hemispheres: Vec<(usize, char)> = input
        .char_indices()
        .filter_map(|(index, character)| {
            let character = character.to_ascii_uppercase();
            matches!(character, 'N' | 'S' | 'E' | 'W').then_some((index, character))
        })
        .collect();
    let [(hemisphere_index, hemisphere)] = hemispheres.as_slice() else {
        return Err(format!(
            "Invalid {} coordinate '{input}': expected one hemisphere",
            axis.name()
        ));
    };
    if !axis.accepts(*hemisphere) {
        return Err(format!(
            "Invalid {} hemisphere '{hemisphere}' in '{input}'",
            axis.name()
        ));
    }

    let degrees_text = input[..*hemisphere_index]
        .trim()
        .trim_end_matches(['°', 'º'])
        .trim();
    let remainder = input[*hemisphere_index + hemisphere.len_utf8()..].trim();
    let (minutes_text, seconds_text) = remainder.split_once('\'').ok_or_else(|| {
        format!(
            "Invalid {} coordinate '{input}': expected DMS minutes and seconds",
            axis.name()
        )
    })?;
    let minutes_text = minutes_text.trim().trim_end_matches('′').trim();
    let seconds_text = seconds_text.trim().trim_end_matches(['"', '″']).trim();

    if degrees_text.starts_with(['+', '-']) {
        return Err(format!(
            "Invalid {} coordinate '{input}': use a hemisphere instead of a sign",
            axis.name()
        ));
    }
    let degrees = parse_coordinate_part(degrees_text, axis, input, "degrees")?;
    let minutes = parse_coordinate_part(minutes_text, axis, input, "minutes")?;
    let seconds = parse_coordinate_part(seconds_text, axis, input, "seconds")?;
    if minutes >= 60.0 || seconds >= 60.0 {
        return Err(format!(
            "Invalid {} coordinate '{input}': minutes and seconds must be below 60",
            axis.name()
        ));
    }

    let maximum = axis.maximum();
    if degrees > maximum || (degrees == maximum && (minutes != 0.0 || seconds != 0.0)) {
        return Err(format!(
            "Invalid {} coordinate '{input}': value exceeds {maximum} degrees",
            axis.name()
        ));
    }

    let value = degrees + minutes / 60.0 + seconds / 3600.0;
    Ok(if matches!(*hemisphere, 'S' | 'W') {
        -value
    } else {
        value
    })
}

fn parse_coordinate_part(
    part: &str,
    axis: CoordinateAxis,
    input: &str,
    component: &str,
) -> Result<f64, String> {
    let value = part.parse::<f64>().map_err(|_| {
        format!(
            "Invalid {} coordinate '{input}': invalid {component}",
            axis.name()
        )
    })?;
    if !value.is_finite() || value < 0.0 {
        return Err(format!(
            "Invalid {} coordinate '{input}': invalid {component}",
            axis.name()
        ));
    }
    Ok(value)
}

fn parse_event_date(input: &str) -> Result<(DateTime<Utc>, String), String> {
    let (local_text, zone_text) = input
        .trim()
        .rsplit_once(" GMT")
        .ok_or_else(|| format!("Invalid SFS Date '{input}': expected local date and GMT offset"))?;
    let local = NaiveDateTime::parse_from_str(local_text.trim(), "%Y-%m-%d %H:%M:%S")
        .map_err(|error| format!("Invalid SFS Date '{input}': {error}"))?;

    let mut zone_parts = zone_text.split_whitespace();
    let standard_offset = parse_gmt_offset(
        zone_parts
            .next()
            .ok_or_else(|| format!("Invalid SFS Date '{input}': missing GMT offset"))?,
        input,
    )?;
    let daylight_saving = match zone_parts.next() {
        None => false,
        Some("DST") => true,
        Some(_) => {
            return Err(format!(
                "Invalid SFS Date '{input}': expected optional DST marker"
            ));
        }
    };
    if zone_parts.next().is_some() {
        return Err(format!(
            "Invalid SFS Date '{input}': unexpected trailing text"
        ));
    }

    let effective_offset = standard_offset + if daylight_saving { 3600 } else { 0 };
    if effective_offset.abs() > 14 * 3600 {
        return Err(format!(
            "Invalid SFS Date '{input}': effective UTC offset exceeds 14 hours"
        ));
    }
    let utc_naive = local
        .checked_sub_signed(Duration::seconds(i64::from(effective_offset)))
        .ok_or_else(|| format!("Invalid SFS Date '{input}': UTC conversion overflow"))?;
    let utc = DateTime::from_naive_utc_and_offset(utc_naive, Utc);
    let sign = if effective_offset < 0 { '-' } else { '+' };
    let absolute = effective_offset.abs();
    let offset = format!(
        "UTC{sign}{:02}:{:02}",
        absolute / 3600,
        absolute % 3600 / 60
    );

    Ok((utc, offset))
}

fn parse_gmt_offset(input: &str, full_date: &str) -> Result<i32, String> {
    let (sign, unsigned) = match input.as_bytes().first() {
        Some(b'+') => (1, &input[1..]),
        Some(b'-') => (-1, &input[1..]),
        _ => {
            return Err(format!(
                "Invalid SFS Date '{full_date}': GMT offset must have a sign"
            ));
        }
    };
    let (hours, minutes) = unsigned
        .split_once(':')
        .ok_or_else(|| format!("Invalid SFS Date '{full_date}': expected GMT±H:MM offset"))?;
    if hours.is_empty()
        || hours.len() > 2
        || minutes.len() != 2
        || !hours.bytes().all(|byte| byte.is_ascii_digit())
        || !minutes.bytes().all(|byte| byte.is_ascii_digit())
    {
        return Err(format!(
            "Invalid SFS Date '{full_date}': expected GMT±H:MM offset"
        ));
    }
    let hours: i32 = hours
        .parse()
        .map_err(|_| format!("Invalid GMT offset in SFS Date '{full_date}'"))?;
    let minutes: i32 = minutes
        .parse()
        .map_err(|_| format!("Invalid GMT offset in SFS Date '{full_date}'"))?;
    if minutes >= 60 || hours > 14 || (hours == 14 && minutes != 0) {
        return Err(format!(
            "Invalid SFS Date '{full_date}': GMT offset exceeds 14 hours"
        ));
    }
    Ok(sign * (hours * 3600 + minutes * 60))
}

fn source_stem(source_name: Option<&str>) -> Option<String> {
    source_name
        .and_then(|name| Path::new(name).file_stem())
        .and_then(|stem| stem.to_str())
        .map(str::trim)
        .filter(|stem| !stem.is_empty())
        .map(str::to_owned)
}

fn split_tags(keywords: &str) -> Vec<String> {
    let mut tags = Vec::new();
    for tag in keywords
        .split([',', ';'])
        .map(str::trim)
        .filter(|tag| !tag.is_empty())
    {
        if !tags.iter().any(|existing| existing == tag) {
            tags.push(tag.to_string());
        }
    }
    tags
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use serde_json::Value;

    fn document(date: &str, latitude: &str, longitude: &str) -> String {
        format!(
            r#"StarFisher EventData
_eventData.Latitude = "{latitude}";
_eventData.Longitude = "{longitude}";
_eventData.Date = "{date}";
_eventData.Caption = "Launch \"Alpha\" \\ Test";
_eventData.Location = "Prague";
_eventData.Zone = "Europe/Prague";
_eventData.Note = "Imported specimen";
_eventData.Keywords = "mission, public; night";
"#
        )
    }

    fn utf16_bytes(text: &str, little_endian: bool) -> Vec<u8> {
        let mut bytes = if little_endian {
            vec![0xff, 0xfe]
        } else {
            vec![0xfe, 0xff]
        };
        for unit in text.encode_utf16() {
            let encoded = if little_endian {
                unit.to_le_bytes()
            } else {
                unit.to_be_bytes()
            };
            bytes.extend_from_slice(&encoded);
        }
        bytes
    }

    #[test]
    fn parses_real_shape_utf16le_event_data() {
        let input = document("2019-7-30 13:27:00 GMT+1:00 DST", "49N13'35", "16E35'20");
        let chart = parse_sfs_bytes(&utf16_bytes(&input, true), Some("specimen.sfs")).unwrap();

        assert_eq!(chart.id, "Launch \"Alpha\" \\ Test");
        assert_eq!(chart.subject.name, chart.id);
        assert_eq!(chart.subject.location.name, "Prague");
        assert_eq!(chart.subject.location.timezone, "Europe/Prague");
        assert_eq!(
            chart.subject.location.utc_offset.as_deref(),
            Some("UTC+02:00")
        );
        assert_eq!(chart.tags, ["mission", "public", "night"]);
        assert!((chart.subject.location.latitude - 49.2263888889).abs() < 1e-9);
        assert!((chart.subject.location.longitude - 16.5888888889).abs() < 1e-9);
    }

    #[test]
    fn applies_dst_to_utc_conversion() {
        let dst = parse_sfs_bytes(
            document("2019-7-30 13:27:00 GMT+1:00 DST", "49N13'35", "16E35'20").as_bytes(),
            None,
        )
        .unwrap();
        let standard = parse_sfs_bytes(
            document("2019-7-30 13:27:00 GMT+1:00", "49N13'35", "16E35'20").as_bytes(),
            None,
        )
        .unwrap();

        assert_eq!(
            dst.subject.event_time,
            Some(Utc.with_ymd_and_hms(2019, 7, 30, 11, 27, 0).unwrap())
        );
        assert_eq!(
            standard.subject.event_time,
            Some(Utc.with_ymd_and_hms(2019, 7, 30, 12, 27, 0).unwrap())
        );
        assert_eq!(
            standard.subject.location.utc_offset.as_deref(),
            Some("UTC+01:00")
        );
    }

    #[test]
    fn parses_utf8_and_uses_source_stem_and_fixed_offset_fallbacks() {
        let input = "_eventData.Latitude = \"0N0'0\";\n\
                     _eventData.Longitude = \"0E0'0\";\n\
                     _eventData.Date = \"2024-1-2 03:04:05 GMT-5:30\";\n\
                     _eventData.Keywords = \"one; two,one\";\n";
        let chart = parse_sfs_bytes(input.as_bytes(), Some("/tmp/My Event.sfs")).unwrap();

        assert_eq!(chart.id, "My Event");
        assert_eq!(chart.subject.location.timezone, "UTC-05:30");
        assert_eq!(chart.subject.location.name, "0.000000, 0.000000");
        assert_eq!(chart.tags, ["one", "two"]);
        assert_eq!(
            chart.subject.event_time,
            Some(Utc.with_ymd_and_hms(2024, 1, 2, 8, 34, 5).unwrap())
        );
    }

    #[test]
    fn decodes_utf16be_and_applies_south_west_signs() {
        let input = document("2020-1-1 00:00:00 GMT+0:00", "33S30'0", "151W12'0");
        let chart = parse_sfs_bytes(&utf16_bytes(&input, false), None).unwrap();

        assert_eq!(chart.subject.location.latitude, -33.5);
        assert_eq!(chart.subject.location.longitude, -151.2);
    }

    #[test]
    fn rejects_missing_required_fields() {
        let error = parse_sfs_bytes(
            b"_eventData.Latitude = \"49N13'35\";\n_eventData.Longitude = \"16E35'20\";",
            None,
        )
        .unwrap_err();
        assert!(error.contains("required field 'date'"));
    }

    #[test]
    fn rejects_malformed_dates() {
        for date in [
            "2019-13-30 13:27:00 GMT+1:00",
            "2019-7-30 13:27:00 UTC+1:00",
            "2019-7-30 13:27:00 GMT+1:99",
            "2019-7-30 13:27:00 GMT+1:00 SUMMER",
        ] {
            let error = parse_sfs_bytes(document(date, "49N13'35", "16E35'20").as_bytes(), None)
                .unwrap_err();
            assert!(error.contains("Invalid SFS Date"), "{error}");
        }
    }

    #[test]
    fn rejects_malformed_or_out_of_range_coordinates() {
        for (latitude, longitude) in [
            ("49Q13'35", "16E35'20"),
            ("49N60'0", "16E35'20"),
            ("91N0'0", "16E35'20"),
            ("49N13'35", "181E0'0"),
            ("49N13", "16E35'20"),
        ] {
            let error = parse_sfs_bytes(
                document("2019-7-30 13:27:00 GMT+1:00", latitude, longitude).as_bytes(),
                None,
            )
            .unwrap_err();
            assert!(error.contains("coordinate"), "{error}");
        }
    }

    #[test]
    fn emits_sparse_jpl_event_chart_without_computed_fields() {
        let chart = parse_sfs_bytes(
            document("2019-7-30 13:27:00 GMT+1:00", "49N13'35", "16E35'20").as_bytes(),
            None,
        )
        .unwrap();
        let value = serde_json::to_value(chart).unwrap();

        assert_eq!(value["config"]["definition"]["kind"], "base");
        assert_eq!(value["config"]["definition"]["purpose"], "event");
        assert_eq!(value["config"]["engine"], "jpl");
        assert_eq!(value["config"]["position_mode"], "apparent");
        assert_eq!(value["config"]["time_system"], "gregorian");
        assert_eq!(value["config"]["zodiac_type"], "Tropical");
        assert_eq!(value["subject"]["location"]["location_mode"], "manual");
        assert_eq!(value["subject"]["location"]["timezone_mode"], "manual");
        assert_eq!(value.get("tag_colors"), None);
        assert_eq!(value.get("roden_rating"), None);
        assert_eq!(value.get("computed"), None);
        assert_eq!(value.get("positions"), None);
        assert!(matches!(value, Value::Object(_)));
    }
}
