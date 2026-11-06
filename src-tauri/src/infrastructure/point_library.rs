//! Validated user point packages. Imported JSON is data only; model IDs cannot be overwritten.
use crate::domain::astrology::{
    fixed_star_catalog, hypothetical_catalog, lot_catalog, validate_hypothetical, validate_star,
    FixedStar, HypotheticalBody, LotContext, LotDefinition,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    path::PathBuf,
    sync::{Arc, Mutex, OnceLock},
    time::SystemTime,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PointPackage {
    pub schema_version: u32,
    pub source: String,
    #[serde(default)]
    pub stars: Vec<FixedStar>,
    #[serde(default)]
    pub hypotheticals: Vec<HypotheticalBody>,
    #[serde(default)]
    pub lots: Vec<LotDefinition>,
}
#[derive(Debug, Clone, Serialize)]
pub struct PointLibrary {
    pub stars: Vec<FixedStar>,
    pub hypotheticals: Vec<HypotheticalBody>,
    pub lots: Vec<LotDefinition>,
    pub imported_sources: Vec<String>,
}
type Fingerprint = Option<(u64, Option<SystemTime>)>;
type CachedLibrary = Option<(PathBuf, Fingerprint, Arc<PointLibrary>)>;
fn cache() -> &'static Mutex<CachedLibrary> {
    static CACHE: OnceLock<Mutex<CachedLibrary>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}
fn path() -> PathBuf {
    super::ephemeris::point_data_dir().join("point-library.json")
}
pub fn point_library() -> Result<Arc<PointLibrary>, String> {
    let path = path();
    let fingerprint = fs::metadata(&path)
        .ok()
        .map(|m| (m.len(), m.modified().ok()));
    let mut cache = cache().lock().map_err(|_| "point library cache poisoned")?;
    if let Some((old_path, old_fingerprint, library)) = &*cache {
        if old_path == &path && old_fingerprint == &fingerprint {
            return Ok(library.clone());
        }
    }
    let mut library = PointLibrary {
        stars: fixed_star_catalog().stars.clone(),
        hypotheticals: hypothetical_catalog().bodies.clone(),
        lots: lot_catalog().lots.clone(),
        imported_sources: vec![],
    };
    if path.exists() {
        let bytes = fs::read(&path).map_err(|e| format!("cannot read point library: {e}"))?;
        if bytes.len() > 4 * 1024 * 1024 {
            return Err("point library exceeds 4 MiB".into());
        }
        let packages: Vec<PointPackage> =
            serde_json::from_slice(&bytes).map_err(|e| format!("invalid point library: {e}"))?;
        for package in packages {
            validate_package(&package, &library)?;
            append(&mut library, package);
        }
    }
    let library = Arc::new(library);
    *cache = Some((path, fingerprint, library.clone()));
    Ok(library)
}
fn append(library: &mut PointLibrary, package: PointPackage) {
    library.imported_sources.push(package.source);
    library.stars.extend(package.stars);
    library.hypotheticals.extend(package.hypotheticals);
    library.lots.extend(package.lots);
}
fn validate_package(package: &PointPackage, existing: &PointLibrary) -> Result<(), String> {
    if package.schema_version != 1 || package.source.trim().is_empty() {
        return Err("point package requires schema_version 1 and a source".into());
    }
    let count = package.stars.len() + package.hypotheticals.len() + package.lots.len();
    if count == 0 || count > 256 {
        return Err("a point package must contain 1–256 entries".into());
    }
    let mut ids: HashSet<&str> = existing
        .stars
        .iter()
        .map(|s| s.id.as_str())
        .chain(existing.hypotheticals.iter().map(|s| s.id.as_str()))
        .chain(existing.lots.iter().map(|s| s.id.as_str()))
        .collect();
    for (id, prefix) in package
        .stars
        .iter()
        .map(|s| (&s.id, "star_user_"))
        .chain(package.hypotheticals.iter().map(|s| (&s.id, "hypo_user_")))
        .chain(package.lots.iter().map(|s| (&s.id, "lot_user_")))
    {
        if !id.starts_with(prefix)
            || id.len() > 80
            || !id
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
            || !ids.insert(id)
        {
            return Err(format!(
                "duplicate or invalid imported ID {id}; expected {prefix}…"
            ));
        }
    }
    for star in &package.stars {
        validate_star(star)?;
    }
    for body in &package.hypotheticals {
        validate_hypothetical(body)?;
    }
    let positions = [
        "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
        "pluto", "asc", "desc", "mc", "ic",
    ]
    .into_iter()
    .map(|id| (id.to_string(), 30.0))
    .collect();
    let cusps: Vec<f64> = (0..12).map(|n| n as f64 * 30.0).collect();
    let context = LotContext {
        positions: &positions,
        asc: 0.0,
        house_cusps: &cusps,
        syzygy: Some(0.0),
    };
    for lot in &package.lots {
        if !lot.supported || lot.name.trim().is_empty() {
            return Err("custom Lots must have a name and an explicit supported formula".into());
        }
        context.evaluate(lot)?;
    }
    Ok(())
}
pub fn import_point_package(json: &str) -> Result<usize, String> {
    static WRITE_LOCK: Mutex<()> = Mutex::new(());
    let _guard = WRITE_LOCK
        .lock()
        .map_err(|_| "point library write lock poisoned")?;
    if json.len() > 1024 * 1024 {
        return Err("point package exceeds 1 MiB".into());
    }
    let package: PointPackage =
        serde_json::from_str(json).map_err(|e| format!("invalid point package JSON: {e}"))?;
    let existing = point_library()?;
    validate_package(&package, &existing)?;
    if existing.stars.len()
        + existing.hypotheticals.len()
        + existing.lots.len()
        + package.stars.len()
        + package.hypotheticals.len()
        + package.lots.len()
        > 1024
    {
        return Err("point library limit is 1024 entries".into());
    }
    let path = path();
    let mut packages: Vec<PointPackage> = if path.exists() {
        serde_json::from_slice(&fs::read(&path).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?
    } else {
        vec![]
    };
    let count = package.stars.len() + package.hypotheticals.len() + package.lots.len();
    packages.push(package);
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let temp = path.with_extension("json.partial");
    fs::write(
        &temp,
        serde_json::to_vec_pretty(&packages).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(&temp, &path).map_err(|e| e.to_string())?;
    *cache().lock().map_err(|_| "point library cache poisoned")? = None;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn imports_do_not_replace_builtins_or_accept_executable_formulas() {
        let existing = PointLibrary {
            stars: fixed_star_catalog().stars.clone(),
            hypotheticals: vec![],
            lots: vec![],
            imported_sources: vec![],
        };
        let mut star = existing.stars[0].clone();
        let mut package = PointPackage {
            schema_version: 1,
            source: "test".into(),
            stars: vec![star.clone()],
            hypotheticals: vec![],
            lots: vec![],
        };
        assert!(validate_package(&package, &existing).is_err());
        star.id = "star_user_test".into();
        package.stars = vec![star];
        assert!(validate_package(&package, &existing).is_ok());
        let mut lot = lot_catalog().lots[0].clone();
        lot.id = "lot_user_test".into();
        lot.add = "system('command')".into();
        package.lots.push(lot);
        assert!(validate_package(&package, &existing).is_err());
    }
}
