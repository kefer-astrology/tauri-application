//! Importer for Morinus saved horoscope files (`.hor`).
//!
//! Morinus writes one scalar value after another using Python's pickle
//! protocol.  We intentionally decode only the scalar subset used by the
//! horoscope format; no arbitrary pickle objects or code execution are
//! accepted.

use std::fs;
use std::path::Path;

use chrono::{DateTime, Duration, NaiveDate, Utc};
use std::collections::HashMap;

use super::models::{
    BaseChartPurpose, ChartConfig, ChartDefinition, ChartInstance, ChartSubject, EngineType,
    InputMode, Location, PositionMode, TimeSystem, ZodiacType,
};

const FIELD_COUNT: usize = 27;

/// Read a Morinus `.hor` file and convert it to a native workspace chart.
pub fn read_morinus_chart(path: &Path) -> Result<ChartInstance, String> {
    let bytes = fs::read(path)
        .map_err(|error| format!("Failed to read Morinus file '{}': {error}", path.display()))?;
    parse_morinus_bytes(&bytes, path.file_stem().and_then(|name| name.to_str()))
}

/// Parse the scalar pickle stream used by Morinus horoscope files.
pub fn parse_morinus_bytes(
    bytes: &[u8],
    source_name: Option<&str>,
) -> Result<ChartInstance, String> {
    let values = decode_pickle_scalars(bytes)?;
    if values.len() != FIELD_COUNT {
        return Err(format!(
            "Morinus horoscope contains {} values; expected {FIELD_COUNT}",
            values.len()
        ));
    }

    let name = values[0].text("name")?.trim().to_owned();
    let name = if name.is_empty() {
        source_name.unwrap_or("Imported Morinus chart").to_owned()
    } else {
        name
    };
    let bc = values[3].boolean("bc")?;
    let year = values[4].integer("year")?;
    let month = values[5].integer("month")?;
    let day = values[6].integer("day")?;
    let hour = values[7].integer("hour")?;
    let minute = values[8].integer("minute")?;
    let second = values[9].integer("second")?;
    let calendar = values[10].integer("calendar")?;
    let zone_type = values[11].integer("zone type")?;
    let plus = values[12].boolean("zone sign")?;
    let zone_hour = values[13].integer("zone hour")?;
    let zone_minute = values[14].integer("zone minute")?;
    let daylight_saving = values[15].boolean("daylight saving")?;
    let place = values[16].text("place")?.trim().to_owned();
    let longitude = signed_dms(
        values[17].integer("longitude degrees")?,
        values[18].integer("longitude minutes")?,
        values[19].integer("longitude seconds")?,
        values[20].boolean("east/west")?,
        "longitude",
    )?;
    let latitude = signed_dms(
        values[21].integer("latitude degrees")?,
        values[22].integer("latitude minutes")?,
        values[23].integer("latitude seconds")?,
        values[24].boolean("north/south")?,
        "latitude",
    )?;
    let _altitude = values[25].integer("altitude")?;
    let notes = values[26].text("notes")?.trim().to_owned();

    let (event_time, utc_offset, timezone) = build_event_time(
        year,
        month,
        day,
        hour,
        minute,
        second,
        bc,
        calendar,
        zone_type,
        plus,
        zone_hour,
        zone_minute,
        daylight_saving,
        longitude,
    )?;

    let purpose = match values[2].integer("chart type")? {
        5 => BaseChartPurpose::Horary,
        6 => BaseChartPurpose::Electional,
        _ => BaseChartPurpose::Natal,
    };

    let mut tags = Vec::new();
    if !notes.is_empty() {
        tags.push("morinus".to_string());
    }

    Ok(ChartInstance {
        id: name.clone(),
        subject: ChartSubject {
            id: name.clone(),
            name,
            event_time: Some(event_time),
            location: Location {
                name: if place.is_empty() {
                    format!("{latitude:.6}, {longitude:.6}")
                } else {
                    place
                },
                latitude,
                longitude,
                timezone,
                utc_offset: Some(utc_offset),
                location_mode: Some(InputMode::Manual),
                timezone_mode: Some(InputMode::Manual),
            },
        },
        config: ChartConfig {
            definition: ChartDefinition::Base { purpose },
            house_system: None,
            zodiac_type: ZodiacType::Tropical,
            aspect_orbs: HashMap::new(),
            selected_aspects: None,
            override_ephemeris: None,
            model: None,
            model_overrides: None,
            engine: Some(EngineType::Swisseph),
            position_mode: Some(PositionMode::Apparent),
            ayanamsa: None,
            observable_objects: None,
            time_system: Some(if calendar == 1 {
                TimeSystem::JulianCalendar
            } else {
                TimeSystem::Gregorian
            }),
        },
        tags,
        tag_colors: HashMap::new(),
        roden_rating: None,
    })
}

#[derive(Debug, Clone, PartialEq)]
enum Scalar {
    Text(String),
    Integer(i64),
    Boolean(bool),
}

impl Scalar {
    fn text(&self, field: &str) -> Result<&str, String> {
        match self {
            Self::Text(value) => Ok(value),
            _ => Err(format!("Morinus field '{field}' is not text")),
        }
    }

    fn integer(&self, field: &str) -> Result<i64, String> {
        match self {
            Self::Integer(value) => Ok(*value),
            Self::Boolean(value) => Ok(i64::from(*value)),
            _ => Err(format!("Morinus field '{field}' is not an integer")),
        }
    }

    fn boolean(&self, field: &str) -> Result<bool, String> {
        match self {
            Self::Boolean(value) => Ok(*value),
            Self::Integer(0) => Ok(false),
            Self::Integer(1) => Ok(true),
            _ => Err(format!("Morinus field '{field}' is not a boolean")),
        }
    }
}

fn decode_pickle_scalars(bytes: &[u8]) -> Result<Vec<Scalar>, String> {
    let mut cursor = 0;
    let mut values = Vec::new();
    while cursor < bytes.len() {
        if bytes[cursor] == 0x80 {
            cursor += 1;
            let version = *bytes.get(cursor).ok_or("Truncated Morinus pickle header")?;
            cursor += 1;
            if version != 2 {
                return Err(format!("Unsupported Morinus pickle protocol {version}"));
            }
        }

        while cursor < bytes.len() && matches!(bytes[cursor], b' ' | b'\n' | b'\r' | b'\t') {
            cursor += 1;
        }
        if cursor >= bytes.len() {
            break;
        }
        let opcode = *bytes.get(cursor).ok_or("Truncated Morinus pickle value")?;
        cursor += 1;
        let value = match opcode {
            b'V' => Scalar::Text(read_line(bytes, &mut cursor)?),
            b'X' => {
                let length = read_u32(bytes, &mut cursor)? as usize;
                let end = cursor
                    .checked_add(length)
                    .ok_or("Morinus string length overflow")?;
                let text =
                    std::str::from_utf8(bytes.get(cursor..end).ok_or("Truncated Morinus string")?)
                        .map_err(|error| format!("Morinus string is not UTF-8: {error}"))?
                        .to_owned();
                cursor = end;
                Scalar::Text(text)
            }
            b'I' => Scalar::Integer(
                read_line(bytes, &mut cursor)?
                    .parse::<i64>()
                    .map_err(|error| format!("Invalid Morinus integer: {error}"))?,
            ),
            b'K' => Scalar::Integer(read_byte(bytes, &mut cursor)? as i64),
            b'M' => Scalar::Integer(read_u16(bytes, &mut cursor)? as i64),
            b'J' => Scalar::Integer(read_i32(bytes, &mut cursor)? as i64),
            0x88 => Scalar::Boolean(true),
            0x89 => Scalar::Boolean(false),
            b'p' => {
                let _ = read_line(bytes, &mut cursor)?;
                continue;
            }
            b'q' => {
                let _ = read_byte(bytes, &mut cursor)?;
                continue;
            }
            b'.' => continue,
            other => return Err(format!("Unsupported Morinus pickle opcode 0x{other:02x}")),
        };
        values.push(value);
        if values.len() > FIELD_COUNT {
            return Err(format!(
                "Morinus horoscope contains more than {FIELD_COUNT} values"
            ));
        }
    }
    Ok(values)
}

fn read_line(bytes: &[u8], cursor: &mut usize) -> Result<String, String> {
    let start = *cursor;
    let relative_end = bytes
        .get(start..)
        .and_then(|tail| tail.iter().position(|byte| *byte == b'\n'))
        .ok_or("Unterminated Morinus pickle line")?;
    let end = start + relative_end;
    *cursor = end + 1;
    String::from_utf8(bytes[start..end].to_vec())
        .map_err(|error| format!("Morinus pickle text is not UTF-8: {error}"))
}

fn read_byte(bytes: &[u8], cursor: &mut usize) -> Result<u8, String> {
    let value = *bytes.get(*cursor).ok_or("Truncated Morinus pickle byte")?;
    *cursor += 1;
    Ok(value)
}

fn read_u16(bytes: &[u8], cursor: &mut usize) -> Result<u16, String> {
    let end = *cursor + 2;
    let value = u16::from_le_bytes(
        bytes
            .get(*cursor..end)
            .ok_or("Truncated Morinus pickle u16")?
            .try_into()
            .expect("slice length checked"),
    );
    *cursor = end;
    Ok(value)
}

fn read_u32(bytes: &[u8], cursor: &mut usize) -> Result<u32, String> {
    let end = *cursor + 4;
    let value = u32::from_le_bytes(
        bytes
            .get(*cursor..end)
            .ok_or("Truncated Morinus pickle u32")?
            .try_into()
            .expect("slice length checked"),
    );
    *cursor = end;
    Ok(value)
}

fn read_i32(bytes: &[u8], cursor: &mut usize) -> Result<i32, String> {
    Ok(read_u32(bytes, cursor)? as i32)
}

fn signed_dms(
    degrees: i64,
    minutes: i64,
    seconds: i64,
    positive: bool,
    field: &str,
) -> Result<f64, String> {
    if !(0..60).contains(&minutes) || !(0..60).contains(&seconds) || degrees < 0 {
        return Err(format!("Invalid Morinus {field} DMS value"));
    }
    let value = degrees as f64 + minutes as f64 / 60.0 + seconds as f64 / 3600.0;
    Ok(if positive { value } else { -value })
}

fn build_event_time(
    year: i64,
    month: i64,
    day: i64,
    hour: i64,
    minute: i64,
    second: i64,
    bc: bool,
    calendar: i64,
    zone_type: i64,
    plus: bool,
    zone_hour: i64,
    zone_minute: i64,
    daylight_saving: bool,
    longitude: f64,
) -> Result<(DateTime<Utc>, String, String), String> {
    if !(1..=12).contains(&month)
        || !(0..24).contains(&hour)
        || !(0..60).contains(&minute)
        || !(0..60).contains(&second)
    {
        return Err("Invalid Morinus date or time".to_string());
    }
    let astronomical_year = if bc { 1 - year } else { year };
    let (gregorian_year, gregorian_month, gregorian_day) = if calendar == 1 {
        julian_to_gregorian(astronomical_year, month, day)?
    } else {
        (astronomical_year, month, day)
    };
    let date = NaiveDate::from_ymd_opt(
        i32::try_from(gregorian_year).map_err(|_| "Morinus year is out of range")?,
        u32::try_from(gregorian_month).unwrap_or_default(),
        u32::try_from(gregorian_day).unwrap_or_default(),
    )
    .ok_or("Invalid Morinus calendar date")?;
    let local = date
        .and_hms_opt(hour as u32, minute as u32, second as u32)
        .ok_or("Invalid Morinus clock time")?;

    let offset_hours = match zone_type {
        0 => {
            (if plus { 1.0 } else { -1.0 }) * (zone_hour as f64 + zone_minute as f64 / 60.0)
                + f64::from(daylight_saving)
        }
        1 => 0.0,
        2 => longitude / 15.0,
        3 => {
            longitude / 15.0
                + equation_of_time_hours(gregorian_year, gregorian_month, gregorian_day)
        }
        other => return Err(format!("Unsupported Morinus time-zone mode {other}")),
    };
    let utc = local - Duration::seconds((offset_hours * 3600.0).round() as i64);
    let utc = DateTime::<Utc>::from_naive_utc_and_offset(utc, Utc);
    let offset = format_offset(offset_hours);
    let timezone = match zone_type {
        0 | 1 => offset.clone(),
        2 => "LMT".to_string(),
        3 => "LAT".to_string(),
        _ => unreachable!(),
    };
    Ok((utc, offset, timezone))
}

fn format_offset(hours: f64) -> String {
    let total_minutes = (hours * 60.0).round() as i64;
    let sign = if total_minutes < 0 { '-' } else { '+' };
    let absolute = total_minutes.abs();
    format!("UTC{sign}{:02}:{:02}", absolute / 60, absolute % 60)
}

fn equation_of_time_hours(year: i64, month: i64, day: i64) -> f64 {
    let day_of_year = (1..month)
        .map(|m| match m {
            2 => 28 + i64::from(is_leap_year(year)),
            4 | 6 | 9 | 11 => 30,
            _ => 31,
        })
        .sum::<i64>()
        + day;
    let angle = (2.0 * std::f64::consts::PI / 365.0) * (day_of_year as f64 - 81.0);
    (9.87 * (2.0 * angle).sin() - 7.53 * angle.cos() - 1.5 * angle.sin()) / 60.0
}

fn is_leap_year(year: i64) -> bool {
    year.rem_euclid(4) == 0 && (year.rem_euclid(100) != 0 || year.rem_euclid(400) == 0)
}

fn julian_to_gregorian(year: i64, month: i64, day: i64) -> Result<(i64, i64, i64), String> {
    let a = (14 - month).div_euclid(12);
    let y = year + 4800 - a;
    let m = month + 12 * a - 3;
    let jdn = day + (153 * m + 2).div_euclid(5) + 365 * y + y.div_euclid(4) - 32083;
    let a = jdn + 32044;
    let b = (4 * a + 3).div_euclid(146097);
    let c = a - (146097 * b).div_euclid(4);
    let d = (4 * c + 3).div_euclid(1461);
    let e = c - (1461 * d).div_euclid(4);
    let m = (5 * e + 2).div_euclid(153);
    let day = e - (153 * m + 2).div_euclid(5) + 1;
    let month = m + 3 - 12 * (m.div_euclid(10));
    let year = 100 * b + d - 4800 + m.div_euclid(10);
    if !(1..=12).contains(&month) || day < 1 || day > 31 {
        return Err("Invalid Morinus Julian date".to_string());
    }
    Ok((year, month, day))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_protocol_two_morinus_chart() {
        let bytes = protocol_two_fixture();
        let chart =
            parse_morinus_bytes(&bytes, Some("Morinus")).expect("Morinus chart should parse");
        assert_eq!(chart.subject.name, "Morinus");
        assert_eq!(chart.subject.location.name, "Villefranche");
        assert_eq!(chart.subject.location.latitude, 45.983333333333334);
        assert_eq!(chart.subject.location.longitude, 4.716666666666667);
        assert!(matches!(
            chart.config.time_system,
            Some(TimeSystem::Gregorian)
        ));
    }

    #[test]
    fn parses_protocol_zero_ancient_chart() {
        let mut bytes = Vec::new();
        for value in [
            "", "1", "0", "1", "591", "2", "17", "12", "0", "0", "1", "0", "1", "3", "0", "0",
            "Baghdad", "44", "24", "0", "1", "33", "20", "0", "1", "45", "",
        ] {
            if value == "" || value == "Baghdad" {
                bytes.extend_from_slice(format!("V{value}\np0\n.\n").as_bytes());
            } else {
                bytes.extend_from_slice(format!("I{value}\n.\n").as_bytes());
            }
        }
        let chart =
            parse_morinus_bytes(&bytes, Some("Ancient")).expect("ancient chart should parse");
        assert_eq!(chart.subject.name, "Ancient");
        assert!(matches!(
            chart.config.time_system,
            Some(TimeSystem::JulianCalendar)
        ));
        assert!(chart.subject.event_time.is_some());
    }

    fn protocol_two_fixture() -> Vec<u8> {
        let values = [
            "Morinus",
            "true",
            "0",
            "false",
            "1583",
            "2",
            "23",
            "8",
            "29",
            "0",
            "0",
            "1",
            "true",
            "1",
            "0",
            "false",
            "Villefranche",
            "4",
            "43",
            "0",
            "true",
            "45",
            "59",
            "0",
            "true",
            "100",
            "",
        ];
        let mut bytes = Vec::new();
        for (index, value) in values.into_iter().enumerate() {
            bytes.extend_from_slice(&[0x80, 0x02]);
            if matches!(index, 1 | 3 | 12 | 15 | 20 | 24) {
                bytes.push(if value == "true" { 0x88 } else { 0x89 });
            } else if index == 0 || index == 16 || index == 26 {
                bytes.push(b'X');
                bytes.extend_from_slice(&(value.len() as u32).to_le_bytes());
                bytes.extend_from_slice(value.as_bytes());
            } else {
                let number = value.parse::<u16>().expect("fixture integer");
                if number <= u8::MAX as u16 {
                    bytes.extend_from_slice(&[b'K', number as u8]);
                } else {
                    bytes.push(b'M');
                    bytes.extend_from_slice(&number.to_le_bytes());
                }
            }
            bytes.extend_from_slice(b".");
        }
        bytes.extend_from_slice(b"q\0.");
        bytes
    }
}
