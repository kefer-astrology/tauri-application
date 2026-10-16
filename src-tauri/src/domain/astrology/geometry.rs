//! Small angular/arc geometry helpers shared by aspect detection and chart-pattern
//! detection (`aspect_computation`, `patterns`) — no astrological domain concepts
//! here, just degrees-on-a-circle math.

pub(super) fn shortest_arc_deg(a: f64, b: f64) -> f64 {
    let mut difference = (normalize_deg(a) - normalize_deg(b)).abs();
    if difference > 180.0 {
        difference = 360.0 - difference;
    }
    difference
}

pub(super) fn normalize_deg(value: f64) -> f64 {
    let normalized = value % 360.0;
    if normalized < 0.0 {
        normalized + 360.0
    } else {
        normalized
    }
}

pub(super) fn normalize_id(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

const MODALITY_IDS: [&str; 3] = ["cardinal", "fixed", "mutable"];
const ELEMENT_IDS: [&str; 4] = ["fire", "earth", "air", "water"];

pub(super) fn sign_index(longitude: f64) -> usize {
    (normalize_deg(longitude) / 30.0).floor() as usize % 12
}

pub(super) fn modality_for_sign(index: usize) -> &'static str {
    MODALITY_IDS[index % 3]
}

pub(super) fn element_for_sign(index: usize) -> &'static str {
    ELEMENT_IDS[index % 4]
}

pub(super) fn forward_arc(from: f64, to: f64) -> f64 {
    ((to - from) % 360.0 + 360.0) % 360.0
}

pub(super) fn house_for_longitude(longitude: f64, cusps: &[f64]) -> Option<usize> {
    if cusps.len() != 12 {
        return None;
    }
    for index in 0..12 {
        let start = normalize_deg(cusps[index]);
        let end = normalize_deg(cusps[(index + 1) % 12]);
        if forward_arc(start, longitude) < forward_arc(start, end) {
            return Some(index + 1);
        }
    }
    Some(12)
}

pub(super) struct OccupiedArc<'a> {
    pub(super) arc: f64,
    pub(super) largest_gap: f64,
    pub(super) leader: Option<&'a str>,
    pub(super) sorted: Vec<(&'a str, f64)>,
}

pub(super) fn smallest_occupied_arc<'a>(entries: &[(&'a str, f64)]) -> OccupiedArc<'a> {
    let mut sorted: Vec<(&'a str, f64)> = entries.to_vec();
    sorted.sort_by(|left, right| left.1.partial_cmp(&right.1).unwrap());
    let mut largest_gap = -1.0_f64;
    let mut gap_index = 0usize;
    for index in 0..sorted.len() {
        let next = sorted[(index + 1) % sorted.len()].1;
        let gap = forward_arc(sorted[index].1, next);
        if gap > largest_gap {
            largest_gap = gap;
            gap_index = index;
        }
    }
    let leader = sorted
        .get((gap_index + 1) % sorted.len())
        .map(|entry| entry.0);
    OccupiedArc {
        arc: 360.0 - largest_gap,
        largest_gap,
        leader,
        sorted,
    }
}

pub(super) fn combinations<T: Copy>(items: &[T], size: usize) -> Vec<Vec<T>> {
    fn walk<T: Copy>(
        items: &[T],
        size: usize,
        start: usize,
        selected: &mut Vec<T>,
        result: &mut Vec<Vec<T>>,
    ) {
        if selected.len() == size {
            result.push(selected.clone());
            return;
        }
        let limit = items.len() as isize - (size - selected.len()) as isize;
        let mut index = start as isize;
        while index <= limit {
            selected.push(items[index as usize]);
            walk(items, size, index as usize + 1, selected, result);
            selected.pop();
            index += 1;
        }
    }
    let mut result = Vec::new();
    let mut selected = Vec::new();
    walk(items, size, 0, &mut selected, &mut result);
    result
}

pub(super) fn pair_key(left: &str, right: &str) -> String {
    if left < right {
        format!("{left}::{right}")
    } else {
        format!("{right}::{left}")
    }
}
