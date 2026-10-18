use std::collections::{HashMap, HashSet};

use super::aspect_computation::ComputedAspect;
use super::geometry::{
    combinations, element_for_sign, forward_arc, house_for_longitude, modality_for_sign,
    normalize_deg, pair_key, sign_index, smallest_occupied_arc,
};

/// Distribution shapes (Jones-inspired) and aspect-pattern configurations for chart search.
/// Ported from the frontend's former `chartSearch.ts` heuristics so every consumer shares one
/// implementation instead of duplicating the geometry in TypeScript.
const SEARCH_PLANET_IDS: [&str; 10] = [
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
];

/// Bundle/bowl/bucket/seesaw/splash/stellium distribution shapes for the 10 classical bodies.
pub fn detect_chart_shapes(positions: &HashMap<String, f64>, house_cusps: &[f64]) -> Vec<String> {
    let mut result: HashSet<String> = HashSet::new();
    let entries: Vec<(&str, f64)> = SEARCH_PLANET_IDS
        .iter()
        .copied()
        .filter_map(|id| positions.get(id).map(|lon| (id, normalize_deg(*lon))))
        .collect();
    if entries.len() < 7 {
        return Vec::new();
    }

    let full = smallest_occupied_arc(&entries);
    if full.arc <= 120.0 {
        result.insert("bundle".to_string());
    } else if full.arc <= 180.0 {
        result.insert("bowl".to_string());
        if let Some(leader) = full.leader {
            result.insert(format!("bowl_leader_{leader}"));
        }
        let houses: Vec<usize> = entries
            .iter()
            .copied()
            .filter_map(|(_, lon)| house_for_longitude(lon, house_cusps))
            .collect();
        if houses.len() == entries.len() {
            if houses
                .iter()
                .all(|house| matches!(house, 10 | 11 | 12 | 1 | 2 | 3))
            {
                result.insert("bowl_east".to_string());
            }
            if houses
                .iter()
                .all(|house| matches!(house, 4 | 5 | 6 | 7 | 8 | 9))
            {
                result.insert("bowl_west".to_string());
            }
            if houses.iter().all(|house| *house >= 7) {
                result.insert("bowl_day".to_string());
            }
            if houses.iter().all(|house| *house <= 6) {
                result.insert("bowl_night".to_string());
            }
        }
    } else if full.arc <= 240.0 {
        result.insert("locomotive".to_string());
        if let Some(leader) = full.leader {
            result.insert(format!("locomotive_leader_{leader}"));
        }
    }

    for (handle, longitude) in entries.iter().copied() {
        let remainder: Vec<(&str, f64)> = entries
            .iter()
            .copied()
            .filter(|pair| pair.0 != handle)
            .collect();
        let clears_gap = remainder
            .iter()
            .all(|pair| forward_arc(longitude, pair.1).min(forward_arc(pair.1, longitude)) >= 30.0);
        if smallest_occupied_arc(&remainder).arc <= 180.0 && clears_gap {
            result.insert("bucket".to_string());
            result.insert(format!("bucket_{handle}"));
            break;
        }
    }

    let gaps: Vec<f64> = full
        .sorted
        .iter()
        .enumerate()
        .map(|(index, entry)| forward_arc(entry.1, full.sorted[(index + 1) % full.sorted.len()].1))
        .collect();
    let large_gaps = gaps.iter().filter(|gap| **gap >= 60.0).count();
    if large_gaps >= 2 {
        result.insert("seesaw".to_string());
    }
    if full.largest_gap < 60.0 {
        result.insert("splash".to_string());
    }
    if large_gaps == 1 && full.arc > 240.0 {
        result.insert("splay".to_string());
    }

    let (sum_x, sum_y) = entries
        .iter()
        .copied()
        .fold((0.0_f64, 0.0_f64), |(x, y), (_, lon)| {
            let radians = lon.to_radians();
            (x + radians.cos(), y + radians.sin())
        });
    if sum_x.hypot(sum_y) / entries.len() as f64 >= 0.35 {
        result.insert("shifted_center".to_string());
    }

    let mut sign_counts: HashMap<usize, usize> = HashMap::new();
    for (_, lon) in entries.iter().copied() {
        *sign_counts.entry(sign_index(lon)).or_insert(0) += 1;
    }
    if sign_counts.values().any(|count| *count >= 3) {
        result.insert("stellium".to_string());
    }

    result.into_iter().collect()
}

/// T-square/grand-trine/grand-cross/kite/mystic-rectangle/hexagram/pentagram configurations
/// derived from the same already-computed internal aspect graph used for the radix wheel.
///
/// This is a single-instant chart-snapshot *detection* function, distinct from
/// `domain::configuration_topology`'s role-topology definitions, which drive a
/// time-aware multi-body *search* across a transit date range — see that
/// module's doc comment for the full distinction (and why it was renamed from
/// `domain::configurations` to avoid being confused with this function).
pub fn detect_chart_configurations(
    positions: &HashMap<String, f64>,
    aspects: &[ComputedAspect],
) -> Vec<String> {
    let mut result: HashSet<String> = HashSet::new();
    let bodies: Vec<&str> = SEARCH_PLANET_IDS
        .iter()
        .copied()
        .filter(|id| positions.contains_key(*id))
        .collect();

    let mut aspect_map: HashMap<String, String> = HashMap::new();
    for aspect in aspects {
        aspect_map.insert(
            pair_key(&aspect.from, &aspect.to),
            aspect.aspect_type.clone(),
        );
    }
    let is = |left: &str, right: &str, aspect_type: &str| {
        aspect_map.get(&pair_key(left, right)).map(String::as_str) == Some(aspect_type)
    };

    let mut trines: Vec<Vec<&str>> = Vec::new();

    for trio in combinations(&bodies, 3) {
        let (a, b, c) = (trio[0], trio[1], trio[2]);
        let pair_types = [
            aspect_map.get(&pair_key(a, b)).map(String::as_str),
            aspect_map.get(&pair_key(a, c)).map(String::as_str),
            aspect_map.get(&pair_key(b, c)).map(String::as_str),
        ];
        let square_count = pair_types.iter().filter(|t| **t == Some("square")).count();
        if square_count == 2 && pair_types.contains(&Some("opposition")) {
            result.insert("t_square".to_string());
            result.insert(format!(
                "t_square_{}",
                modality_for_sign(sign_index(*positions.get(a).unwrap()))
            ));
        }
        if pair_types.iter().all(|t| *t == Some("trine")) {
            result.insert("grand_trine".to_string());
            result.insert(format!(
                "grand_trine_{}",
                element_for_sign(sign_index(*positions.get(a).unwrap()))
            ));
            trines.push(trio.clone());
        }
        let quincunx_count = pair_types
            .iter()
            .filter(|t| **t == Some("quincunx"))
            .count();
        if quincunx_count == 2 && pair_types.contains(&Some("sextile")) {
            result.insert("double_quincunx".to_string());
        }
        let biquintile_count = pair_types
            .iter()
            .filter(|t| **t == Some("biquintile"))
            .count();
        if biquintile_count >= 2 {
            result.insert("double_biquintile".to_string());
        }
    }

    for quartet in combinations(&bodies, 4) {
        let pair_types: Vec<Option<&str>> = combinations(&quartet, 2)
            .into_iter()
            .map(|pair| {
                aspect_map
                    .get(&pair_key(pair[0], pair[1]))
                    .map(String::as_str)
            })
            .collect();
        let square_count = pair_types.iter().filter(|t| **t == Some("square")).count();
        let opposition_count = pair_types
            .iter()
            .filter(|t| **t == Some("opposition"))
            .count();
        if square_count == 4 && opposition_count == 2 {
            result.insert("grand_cross".to_string());
            result.insert(format!(
                "grand_cross_{}",
                modality_for_sign(sign_index(*positions.get(quartet[0]).unwrap()))
            ));
        }
        let trine_count = pair_types.iter().filter(|t| **t == Some("trine")).count();
        let sextile_count = pair_types.iter().filter(|t| **t == Some("sextile")).count();
        if opposition_count == 2 && trine_count == 2 && sextile_count == 2 {
            result.insert("mystic_rectangle".to_string());
        }
    }

    for trine in &trines {
        for body in bodies.iter().copied().filter(|b| !trine.contains(b)) {
            for &opposed in trine {
                let others: Vec<&str> = trine.iter().copied().filter(|c| *c != opposed).collect();
                if is(body, opposed, "opposition") && others.iter().all(|c| is(body, *c, "sextile"))
                {
                    result.insert("kite".to_string());
                    result.insert(format!(
                        "kite_{}",
                        element_for_sign(sign_index(*positions.get(opposed).unwrap()))
                    ));
                }
            }
        }
    }

    if trines.len() >= 2
        && trines.iter().enumerate().any(|(index, a)| {
            trines[index + 1..]
                .iter()
                .any(|b| a.iter().all(|body| !b.contains(body)))
        })
    {
        result.insert("hexagram".to_string());
    }

    if combinations(&bodies, 5).iter().any(|group| {
        combinations(group, 2)
            .iter()
            .filter(|pair| {
                matches!(
                    aspect_map
                        .get(&pair_key(pair[0], pair[1]))
                        .map(String::as_str),
                    Some("quintile") | Some("biquintile")
                )
            })
            .count()
            >= 5
    }) {
        result.insert("pentagram".to_string());
    }

    result.into_iter().collect()
}

/// If `shapes`/`configurations` are absent (e.g. a Python-backend chart response), derive them
/// from the same already-computed `positions`/`house_cusps`/`aspects` fields so every compute
/// route exposes them, not just the Rust one.
pub fn inject_shapes_and_configurations_into_chart_map(
    result: &mut HashMap<String, serde_json::Value>,
) {
    let need_shapes = matches!(result.get("shapes"), None | Some(serde_json::Value::Null));
    let need_configurations = matches!(
        result.get("configurations"),
        None | Some(serde_json::Value::Null)
    );
    if !need_shapes && !need_configurations {
        return;
    }
    let Some(positions_obj) = result
        .get("positions")
        .and_then(serde_json::Value::as_object)
    else {
        return;
    };
    let positions: HashMap<String, f64> = positions_obj
        .iter()
        .filter_map(|(id, value)| value.as_f64().map(|lon| (id.clone(), lon)))
        .collect();

    if need_shapes {
        let house_cusps: Vec<f64> = result
            .get("house_cusps")
            .and_then(serde_json::Value::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(serde_json::Value::as_f64)
                    .collect()
            })
            .unwrap_or_default();
        let shapes = detect_chart_shapes(&positions, &house_cusps);
        result.insert("shapes".to_string(), serde_json::json!(shapes));
    }

    if need_configurations {
        let aspects: Vec<ComputedAspect> = result
            .get("aspects")
            .and_then(|value| serde_json::from_value(value.clone()).ok())
            .unwrap_or_default();
        let configurations = detect_chart_configurations(&positions, &aspects);
        result.insert(
            "configurations".to_string(),
            serde_json::json!(configurations),
        );
    }
}
