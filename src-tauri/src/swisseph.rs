use std::collections::{HashMap, HashSet};
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_double, c_int};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use chrono::{DateTime, Datelike, Timelike, Utc};

use crate::astronomy::AstronomyMotion;
use crate::workspace::models::{Ayanamsa, ChartInstance, HouseSystem, ZodiacType};

const SE_SUN: c_int = 0;
const SE_MOON: c_int = 1;
const SE_MERCURY: c_int = 2;
const SE_VENUS: c_int = 3;
const SE_MARS: c_int = 4;
const SE_JUPITER: c_int = 5;
const SE_SATURN: c_int = 6;
const SE_URANUS: c_int = 7;
const SE_NEPTUNE: c_int = 8;
const SE_PLUTO: c_int = 9;
const SE_MEAN_NODE: c_int = 10;
const SE_TRUE_NODE: c_int = 11;
const SE_MEAN_APOG: c_int = 12;
const SE_CHIRON: c_int = 15;
const SE_CERES: c_int = 17;
const SE_PALLAS: c_int = 18;
const SE_JUNO: c_int = 19;
const SE_VESTA: c_int = 20;

const SEFLG_JPLEPH: i32 = 1;
const SEFLG_SWIEPH: i32 = 2;
const SEFLG_SPEED: i32 = 256;
const SEFLG_SIDEREAL: i32 = 64 * 1024;

const SE_GREG_CAL: c_int = 1;

const SE_ASC: usize = 0;
const SE_MC: usize = 1;

const SE_SIDM_FAGAN_BRADLEY: i32 = 0;
const SE_SIDM_LAHIRI: i32 = 1;
const SE_SIDM_DELUCE: i32 = 2;
const SE_SIDM_RAMAN: i32 = 3;
const SE_SIDM_KRISHNAMURTI: i32 = 5;

#[derive(Debug, Clone)]
pub struct SwissAxes {
    pub asc: f64,
    pub desc: f64,
    pub mc: f64,
    pub ic: f64,
}

#[derive(Debug, Clone)]
pub struct SwissChartData {
    pub positions: HashMap<String, f64>,
    pub motion: HashMap<String, AstronomyMotion>,
    pub axes: SwissAxes,
    pub house_cusps: Vec<f64>,
}

static SWISS_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

unsafe extern "C" {
    fn swe_close();
    fn swe_set_ephe_path(path: *const c_char);
    fn swe_set_jpl_file(fname: *const c_char);
    fn swe_set_sid_mode(sid_mode: i32, t0: c_double, ayan_t0: c_double);
    fn swe_calc_ut(tjd_ut: c_double, ipl: i32, iflag: i32, xx: *mut c_double, serr: *mut c_char) -> i32;
    fn swe_houses_ex(
        tjd_ut: c_double,
        iflag: i32,
        geolat: c_double,
        geolon: c_double,
        hsys: c_int,
        cusps: *mut c_double,
        ascmc: *mut c_double,
    ) -> c_int;
}

pub fn compute_chart_data(
    chart: &ChartInstance,
    requested_objects: Option<&Vec<String>>,
    ephemeris_path: Option<&Path>,
) -> Result<SwissChartData, String> {
    let _guard = SWISS_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "Swiss Ephemeris lock poisoned".to_string())?;

    configure_swisseph(chart, ephemeris_path)?;
    let result = compute_chart_data_locked(chart, requested_objects, SEFLG_SWIEPH);
    unsafe {
        swe_close();
    }
    result
}

/// Compute chart data using the Swiss Ephemeris library's JPL DE mode.
///
/// `jpl_file` must point to a JPL binary ephemeris file (e.g. de440.eph).
/// Returns an error when no file is provided or the file cannot be opened.
pub fn compute_chart_data_jpl(
    chart: &ChartInstance,
    requested_objects: Option<&Vec<String>>,
    jpl_file: Option<&Path>,
) -> Result<SwissChartData, String> {
    let file = jpl_file.ok_or_else(|| {
        "JPL engine requires an ephemeris file — set override_ephemeris in chart config or KEFER_SWISSEPH_PATH to a .eph file".to_string()
    })?;

    let _guard = SWISS_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "Swiss Ephemeris lock poisoned".to_string())?;

    configure_swisseph(chart, None)?;

    let c_fname = CString::new(file.to_string_lossy().as_bytes())
        .map_err(|_| "JPL ephemeris path contains an interior null byte".to_string())?;
    unsafe {
        swe_set_jpl_file(c_fname.as_ptr());
    }

    let result = compute_chart_data_locked(chart, requested_objects, SEFLG_JPLEPH);
    unsafe {
        swe_close();
    }
    result
}

pub fn default_ephemeris_source() -> Option<String> {
    default_ephemeris_dir().map(|path| path.to_string_lossy().into_owned())
}

fn compute_chart_data_locked(
    chart: &ChartInstance,
    requested_objects: Option<&Vec<String>>,
    ephemeris_flag: i32,
) -> Result<SwissChartData, String> {
    let event_time = chart
        .subject
        .event_time
        .ok_or_else(|| "Chart has no subject.event_time".to_string())?;
    let jd_ut = julian_day_ut(event_time);
    let iflag = calc_flags(chart, ephemeris_flag);

    let mut cusps = [0.0_f64; 13];
    let mut ascmc = [0.0_f64; 10];
    let hsys = house_system_code(chart.config.house_system.clone());
    let house_rc = unsafe {
        swe_houses_ex(
            jd_ut,
            iflag,
            chart.subject.location.latitude,
            chart.subject.location.longitude,
            hsys as c_int,
            cusps.as_mut_ptr(),
            ascmc.as_mut_ptr(),
        )
    };
    if house_rc < 0 {
        return Err("Swiss Ephemeris failed to compute houses".to_string());
    }

    let axes = SwissAxes {
        asc: normalize_deg(ascmc[SE_ASC]),
        desc: normalize_deg(ascmc[SE_ASC] + 180.0),
        mc: normalize_deg(ascmc[SE_MC]),
        ic: normalize_deg(ascmc[SE_MC] + 180.0),
    };
    let house_cusps = (1..=12).map(|index| normalize_deg(cusps[index])).collect::<Vec<_>>();

    let requested = requested_objects
        .filter(|items| !items.is_empty())
        .map(|items| items.iter().map(|item| normalize_object_id(item)).collect::<HashSet<_>>());
    let wanted = |id: &str| requested.as_ref().map(|set| set.contains(id)).unwrap_or(true);
    let should_compute = |id: &str| match id {
        "north_node" => wanted("north_node") || wanted("south_node"),
        "mean_node" => wanted("mean_node") || wanted("mean_south_node"),
        "true_north_node" => wanted("true_north_node") || wanted("true_south_node"),
        _ => wanted(id),
    };

    let mut positions = HashMap::new();
    let mut motion = HashMap::new();
    for &(id, planet) in object_planets() {
        if !should_compute(id) {
            continue;
        }
        let (longitude, speed) = calc_longitude_and_speed_ut(jd_ut, planet, iflag)?;
        positions.insert(id.to_string(), longitude);
        motion.insert(
            id.to_string(),
            AstronomyMotion {
                speed,
                retrograde: speed < 0.0,
            },
        );
        match id {
            "true_north_node" => {
                if wanted("true_south_node") {
                    positions.insert("true_south_node".to_string(), normalize_deg(longitude + 180.0));
                    motion.insert(
                        "true_south_node".to_string(),
                        AstronomyMotion {
                            speed,
                            retrograde: speed < 0.0,
                        },
                    );
                }
            }
            "north_node" | "mean_node" => {
                if wanted("south_node") {
                    positions.insert("south_node".to_string(), normalize_deg(longitude + 180.0));
                    motion.insert(
                        "south_node".to_string(),
                        AstronomyMotion {
                            speed,
                            retrograde: speed < 0.0,
                        },
                    );
                }
                if wanted("mean_south_node") {
                    positions.insert("mean_south_node".to_string(), normalize_deg(longitude + 180.0));
                    motion.insert(
                        "mean_south_node".to_string(),
                        AstronomyMotion {
                            speed,
                            retrograde: speed < 0.0,
                        },
                    );
                }
            }
            _ => {}
        }
    }

    if wanted("asc") {
        positions.insert("asc".to_string(), axes.asc);
    }
    if wanted("desc") {
        positions.insert("desc".to_string(), axes.desc);
    }
    if wanted("mc") {
        positions.insert("mc".to_string(), axes.mc);
    }
    if wanted("ic") {
        positions.insert("ic".to_string(), axes.ic);
    }

    Ok(SwissChartData {
        positions,
        motion,
        axes,
        house_cusps,
    })
}

fn configure_swisseph(chart: &ChartInstance, ephemeris_path: Option<&Path>) -> Result<(), String> {
    let resolved = chart
        .config
        .override_ephemeris
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| ephemeris_path.map(PathBuf::from))
        .or_else(default_ephemeris_dir);

    if let Some(path) = resolved {
        let directory = if path.is_file() {
            path.parent().map(Path::to_path_buf).unwrap_or(path)
        } else {
            path
        };
        let c_path = CString::new(directory.to_string_lossy().as_bytes())
            .map_err(|_| "Ephemeris path contains an interior null byte".to_string())?;
        unsafe {
            swe_set_ephe_path(c_path.as_ptr());
        }
    }

    if matches!(chart.config.zodiac_type, ZodiacType::Sidereal) {
        unsafe {
            swe_set_sid_mode(ayanamsa_code(chart.config.ayanamsa.clone()), 0.0, 0.0);
        }
    }

    Ok(())
}

fn calc_longitude_and_speed_ut(jd_ut: f64, planet: i32, iflag: i32) -> Result<(f64, f64), String> {
    let mut xx = [0.0_f64; 6];
    let mut serr = [0_i8; 256];
    let rc = unsafe { swe_calc_ut(jd_ut, planet, iflag, xx.as_mut_ptr(), serr.as_mut_ptr()) };
    if rc < 0 {
        return Err(read_error(&serr));
    }
    Ok((normalize_deg(xx[0]), xx[3]))
}

fn calc_flags(chart: &ChartInstance, ephemeris_flag: i32) -> i32 {
    let mut flags = ephemeris_flag | SEFLG_SPEED;
    if matches!(chart.config.zodiac_type, ZodiacType::Sidereal) {
        flags |= SEFLG_SIDEREAL;
    }
    flags
}

fn read_error(buffer: &[i8]) -> String {
    let ptr = buffer.as_ptr();
    if ptr.is_null() {
        return "Swiss Ephemeris returned an unknown error".to_string();
    }
    let cstr = unsafe { CStr::from_ptr(ptr) };
    let message = cstr.to_string_lossy().trim().to_string();
    if message.is_empty() {
        "Swiss Ephemeris returned an unknown error".to_string()
    } else {
        message
    }
}

fn default_ephemeris_dir() -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("KEFER_SWISSEPH_PATH") {
        let candidate = PathBuf::from(explicit);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    let manifest_candidate = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("swisseph");
    if manifest_candidate.exists() {
        return Some(manifest_candidate);
    }

    let current_exe = std::env::current_exe().ok()?;
    for base in current_exe.ancestors() {
        let direct = base.join("swisseph");
        if direct.exists() {
            return Some(direct);
        }
        let resources = base.join("resources").join("swisseph");
        if resources.exists() {
            return Some(resources);
        }
        let macos = base.join("../Resources/swisseph");
        if macos.exists() {
            return Some(macos);
        }
    }

    None
}

fn object_planets() -> &'static [(&'static str, i32)] {
    &[
        ("sun", SE_SUN),
        ("moon", SE_MOON),
        ("mercury", SE_MERCURY),
        ("venus", SE_VENUS),
        ("mars", SE_MARS),
        ("jupiter", SE_JUPITER),
        ("saturn", SE_SATURN),
        ("uranus", SE_URANUS),
        ("neptune", SE_NEPTUNE),
        ("pluto", SE_PLUTO),
        ("ceres", SE_CERES),
        ("pallas", SE_PALLAS),
        ("juno", SE_JUNO),
        ("vesta", SE_VESTA),
        ("true_north_node", SE_TRUE_NODE),
        ("north_node", SE_MEAN_NODE),
        ("mean_node", SE_MEAN_NODE),
        ("lilith", SE_MEAN_APOG),
        ("chiron", SE_CHIRON),
    ]
}

fn house_system_code(system: Option<HouseSystem>) -> u8 {
    match system.unwrap_or(HouseSystem::Placidus) {
        HouseSystem::Placidus => b'P',
        HouseSystem::WholeSign => b'W',
        HouseSystem::Campanus => b'C',
        HouseSystem::Koch => b'K',
        HouseSystem::Equal => b'A',
        HouseSystem::Regiomontanus => b'R',
        HouseSystem::Vehlow => b'V',
        HouseSystem::Porphyry => b'O',
        HouseSystem::Alcabitius => b'B',
    }
}

fn ayanamsa_code(ayanamsa: Option<Ayanamsa>) -> i32 {
    match ayanamsa.unwrap_or(Ayanamsa::FaganBradley) {
        Ayanamsa::Lahiri => SE_SIDM_LAHIRI,
        Ayanamsa::Raman => SE_SIDM_RAMAN,
        Ayanamsa::Krishnamurti => SE_SIDM_KRISHNAMURTI,
        Ayanamsa::FaganBradley => SE_SIDM_FAGAN_BRADLEY,
        Ayanamsa::DeLuce => SE_SIDM_DELUCE,
        Ayanamsa::UserDefined => SE_SIDM_FAGAN_BRADLEY,
    }
}

fn julian_day_ut(dt: DateTime<Utc>) -> f64 {
    let hour = f64::from(dt.hour())
        + f64::from(dt.minute()) / 60.0
        + f64::from(dt.second()) / 3600.0
        + f64::from(dt.nanosecond()) / 3_600_000_000_000.0;
    // Swiss Ephemeris expects Gregorian dates for modern timestamps.
    unsafe { swe_julday(dt.year(), dt.month() as c_int, dt.day() as c_int, hour, SE_GREG_CAL) }
}

unsafe extern "C" {
    fn swe_julday(year: c_int, month: c_int, day: c_int, hour: c_double, gregflag: c_int) -> c_double;
}

fn normalize_deg(value: f64) -> f64 {
    let mut out = value % 360.0;
    if out < 0.0 {
        out += 360.0;
    }
    out
}

fn normalize_object_id(id: &str) -> String {
    match id.trim().to_ascii_lowercase().as_str() {
        "ascendant" => "asc".to_string(),
        "descendant" => "desc".to_string(),
        "midheaven" | "medium_coeli" => "mc".to_string(),
        "imum_coeli" => "ic".to_string(),
        other => other.to_string(),
    }
}
