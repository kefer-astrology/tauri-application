//! Per-chart "facts": precomputed astrological classifications that chart search filters
//! compare against (sign/house/motion per body, distributions, stelliums, angular planets,
//! rulers, dispositors, phases). Computed once per base chart so the frontends only count and
//! compare, never re-derive astrology rules.
//!
//! Every orb-based fact (stellium chains, angular planets, aspect counts, unaspected planets)
//! resolves its orb through the same model/workspace settings as aspect detection
//! (`eligible_aspect_angle_and_orb`), so a changed orb setting changes the facts too.

use std::collections::{BTreeMap, HashMap};

use serde::{Deserialize, Serialize};

use crate::workspace::models::{AspectContext, AspectDefinition, ObjectType};

use super::aspect_computation::eligible_aspect_angle_and_orb;
use super::geometry::{
    element_for_sign, forward_arc, house_for_longitude, modality_for_sign, normalize_deg,
    shortest_arc_deg, sign_index,
};

/// Bumped whenever a fact's meaning changes, so cached facts are recomputed.
pub const CHART_FACTS_VERSION: u32 = 1;

/// The ten classical planets most facts are defined over.
pub const FACT_PLANET_IDS: [&str; 10] = [
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
];

const TRADITIONAL_PLANET_IDS: [&str; 7] = [
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
];

/// Sign rulers, Aries..Pisces.
const TRADITIONAL_RULERS: [&str; 12] = [
    "mars", "venus", "mercury", "moon", "sun", "mercury", "venus", "mars", "jupiter", "saturn",
    "saturn", "jupiter",
];
const MODERN_RULERS: [&str; 12] = [
    "mars", "venus", "mercury", "moon", "sun", "mercury", "venus", "pluto", "jupiter", "saturn",
    "uranus", "neptune",
];

const PTOLEMAIC_ASPECT_IDS: [&str; 5] = ["conjunction", "sextile", "square", "trine", "opposition"];

/// Below this absolute daily speed (degrees/day) a body counts as stationary.
const STATIONARY_SPEED_DEG_PER_DAY: f64 = 0.0001;

const AXIS_IDS: [&str; 6] = ["asc", "desc", "mc", "ic", "vertex", "antivertex"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BodyMotion {
    Direct,
    Retrograde,
    Stationary,
}

/// House group by house position: angular (1, 4, 7, 10) = active, succedent (2, 5, 8, 11) =
/// reactive, cadent (3, 6, 9, 12) = resulting.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HouseGroup {
    Active,
    Reactive,
    Resulting,
}

impl HouseGroup {
    pub fn for_house(house: usize) -> Self {
        match house % 3 {
            1 => Self::Active,
            2 => Self::Reactive,
            _ => Self::Resulting,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BodyFacts {
    /// 0 = Aries … 11 = Pisces.
    pub sign: usize,
    pub degree_in_sign: f64,
    pub element: String,
    pub modality: String,
    pub house: Option<usize>,
    pub house_group: Option<HouseGroup>,
    /// `None` when the engine returned no speed for this body.
    pub motion: Option<BodyMotion>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StelliumKind {
    /// Consecutive conjunctions (each neighbour within the conjunction orb), may cross sign and
    /// house boundaries.
    Chain,
    Sign,
    House,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Stellium {
    pub kind: StelliumKind,
    pub members: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sign: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub house: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AngularPlanet {
    pub body: String,
    pub axis: String,
    pub orb: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DistributionCounts {
    pub east: usize,
    pub west: usize,
    pub upper: usize,
    pub lower: usize,
    /// Quadrants I–IV: houses 1–3, 4–6, 7–9, 10–12.
    pub quadrants: [usize; 4],
    /// Planets with a known house (the denominator for "all planets in one hemisphere").
    pub placed: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrientationBalance {
    Extroversion,
    Introversion,
    Balanced,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Orientation {
    /// Planets in fire + air (odd) signs.
    pub extroverted: usize,
    /// Planets in earth + water (even) signs.
    pub introverted: usize,
    pub balance: OrientationBalance,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChartRuler {
    pub traditional: String,
    pub modern: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum FinalDispositor {
    /// Every dispositor chain ends in this one planet in its own sign.
    Single { body: String },
    /// No single final dispositor: mutual reception / loop or several planets in domicile.
    None,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FinalDispositors {
    /// `None` when a required planet position is missing.
    pub traditional: Option<FinalDispositor>,
    pub modern: Option<FinalDispositor>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChartFacts {
    pub version: u32,
    pub bodies: BTreeMap<String, BodyFacts>,
    pub element_counts: BTreeMap<String, usize>,
    pub modality_counts: BTreeMap<String, usize>,
    pub house_group_counts: BTreeMap<String, usize>,
    pub distribution: DistributionCounts,
    pub orientation: Orientation,
    /// Ptolemaic aspects among the ten planets, by type, using the settings' orbs.
    pub aspect_counts: BTreeMap<String, usize>,
    /// Planets with no Ptolemaic aspect to any other of the ten planets.
    pub unaspected: Vec<String>,
    pub stelliums: Vec<Stellium>,
    pub angular_planets: Vec<AngularPlanet>,
    /// Eight 45° phases starting at each phase (new_moon 0–45°, crescent, first_quarter,
    /// gibbous, full_moon, disseminating, last_quarter, balsamic). The centred-sector phase
    /// stays in `moon_details.phase_id`.
    pub lunar_cycle_phase: Option<String>,
    /// `prometheus` (rises before the Sun) or `epimetheus` (sets after it).
    pub mercury_phase: Option<String>,
    /// `morning_star` or `evening_star`.
    pub venus_phase: Option<String>,
    /// `above` / `below` the horizon (ecliptic houses 7–12 = above).
    pub sun_horizon: Option<String>,
    pub moon_horizon: Option<String>,
    /// Ruler of the Ascendant's sign.
    pub chart_ruler: ChartRuler,
    pub final_dispositors: FinalDispositors,
}

pub struct ChartFactsInput<'a> {
    pub positions: &'a HashMap<String, f64>,
    /// Daily longitude speed per body id.
    pub speeds: &'a HashMap<String, f64>,
    pub house_cusps: &'a [f64],
    pub asc: f64,
    pub mc: f64,
    pub aspect_definitions: &'a [AspectDefinition],
    pub aspect_orbs: &'a HashMap<String, f64>,
    pub object_types: &'a HashMap<String, ObjectType>,
    pub object_orbs: &'a HashMap<String, f64>,
}

impl ChartFactsInput<'_> {
    /// Allowed orb for `aspect_id` between two bodies under the current settings, or `None`
    /// when that aspect is disabled or not allowed for the pair.
    fn orb_for(&self, aspect_id: &str, from: &str, to: &str) -> Option<(f64, f64)> {
        eligible_aspect_angle_and_orb(
            self.aspect_definitions,
            self.aspect_orbs,
            aspect_id,
            AspectContext::Chart,
            from,
            to,
            self.object_types.get(from),
            self.object_types.get(to),
            self.object_orbs,
        )
    }

    fn house_of(&self, longitude: f64) -> Option<usize> {
        house_for_longitude(longitude, self.house_cusps)
    }
}

pub fn compute_chart_facts(input: &ChartFactsInput) -> ChartFacts {
    let planets: Vec<(&str, f64)> = FACT_PLANET_IDS
        .iter()
        .filter_map(|id| {
            input
                .positions
                .get(*id)
                .map(|lon| (*id, normalize_deg(*lon)))
        })
        .collect();
    let (aspect_counts, unaspected) = ptolemaic_aspects(input, &planets);

    ChartFacts {
        version: CHART_FACTS_VERSION,
        bodies: body_facts(input),
        element_counts: count_by(&planets, |lon| element_for_sign(sign_index(lon))),
        modality_counts: count_by(&planets, |lon| modality_for_sign(sign_index(lon))),
        house_group_counts: house_group_counts(input, &planets),
        distribution: distribution(input, &planets),
        orientation: orientation(&planets),
        aspect_counts,
        unaspected,
        stelliums: stelliums(input, &planets),
        angular_planets: angular_planets(input, &planets),
        lunar_cycle_phase: lunar_cycle_phase(input.positions),
        mercury_phase: inner_planet_phase(input.positions, "mercury", "prometheus", "epimetheus"),
        venus_phase: inner_planet_phase(input.positions, "venus", "morning_star", "evening_star"),
        sun_horizon: horizon(input, "sun"),
        moon_horizon: horizon(input, "moon"),
        chart_ruler: chart_ruler(input.asc),
        final_dispositors: FinalDispositors {
            traditional: final_dispositor(
                input.positions,
                &TRADITIONAL_PLANET_IDS,
                &TRADITIONAL_RULERS,
            ),
            modern: final_dispositor(input.positions, &FACT_PLANET_IDS, &MODERN_RULERS),
        },
    }
}

fn body_facts(input: &ChartFactsInput) -> BTreeMap<String, BodyFacts> {
    input
        .positions
        .iter()
        .map(|(id, lon)| {
            let longitude = normalize_deg(*lon);
            let sign = sign_index(longitude);
            let house = input.house_of(longitude);
            let motion = if matches!(id.as_str(), "sun" | "moon") {
                Some(BodyMotion::Direct)
            } else {
                input.speeds.get(id).map(|speed| {
                    if speed.abs() < STATIONARY_SPEED_DEG_PER_DAY {
                        BodyMotion::Stationary
                    } else if *speed < 0.0 {
                        BodyMotion::Retrograde
                    } else {
                        BodyMotion::Direct
                    }
                })
            };
            (
                id.clone(),
                BodyFacts {
                    sign,
                    degree_in_sign: longitude - sign as f64 * 30.0,
                    element: element_for_sign(sign).to_string(),
                    modality: modality_for_sign(sign).to_string(),
                    house,
                    house_group: house.map(HouseGroup::for_house),
                    motion,
                },
            )
        })
        .collect()
}

fn count_by(planets: &[(&str, f64)], key: impl Fn(f64) -> &'static str) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::new();
    for (_, lon) in planets {
        *counts.entry(key(*lon).to_string()).or_insert(0) += 1;
    }
    counts
}

fn house_group_counts(input: &ChartFactsInput, planets: &[(&str, f64)]) -> BTreeMap<String, usize> {
    let mut counts: BTreeMap<String, usize> = ["active", "reactive", "resulting"]
        .into_iter()
        .map(|id| (id.to_string(), 0))
        .collect();
    for (_, lon) in planets {
        if let Some(house) = input.house_of(*lon) {
            let key = match HouseGroup::for_house(house) {
                HouseGroup::Active => "active",
                HouseGroup::Reactive => "reactive",
                HouseGroup::Resulting => "resulting",
            };
            *counts.get_mut(key).unwrap() += 1;
        }
    }
    counts
}

fn distribution(input: &ChartFactsInput, planets: &[(&str, f64)]) -> DistributionCounts {
    let mut result = DistributionCounts {
        east: 0,
        west: 0,
        upper: 0,
        lower: 0,
        quadrants: [0; 4],
        placed: 0,
    };
    for (_, lon) in planets {
        let Some(house) = input.house_of(*lon) else {
            continue;
        };
        result.placed += 1;
        if matches!(house, 10 | 11 | 12 | 1 | 2 | 3) {
            result.east += 1;
        } else {
            result.west += 1;
        }
        if house >= 7 {
            result.upper += 1;
        } else {
            result.lower += 1;
        }
        result.quadrants[(house - 1) / 3] += 1;
    }
    result
}

fn orientation(planets: &[(&str, f64)]) -> Orientation {
    let extroverted = planets
        .iter()
        .filter(|(_, lon)| sign_index(*lon).is_multiple_of(2))
        .count();
    let introverted = planets.len() - extroverted;
    let balance = match extroverted.cmp(&introverted) {
        std::cmp::Ordering::Greater => OrientationBalance::Extroversion,
        std::cmp::Ordering::Less => OrientationBalance::Introversion,
        std::cmp::Ordering::Equal => OrientationBalance::Balanced,
    };
    Orientation {
        extroverted,
        introverted,
        balance,
    }
}

/// Closest-fitting Ptolemaic aspect for every planet pair, counted by type, plus the planets
/// left without any.
fn ptolemaic_aspects(
    input: &ChartFactsInput,
    planets: &[(&str, f64)],
) -> (BTreeMap<String, usize>, Vec<String>) {
    let mut counts: BTreeMap<String, usize> = PTOLEMAIC_ASPECT_IDS
        .iter()
        .map(|id| (id.to_string(), 0))
        .collect();
    let mut aspected = vec![false; planets.len()];
    for (i, (from, from_lon)) in planets.iter().enumerate() {
        for (j, (to, to_lon)) in planets.iter().enumerate().skip(i + 1) {
            let angle = shortest_arc_deg(*from_lon, *to_lon);
            let best = PTOLEMAIC_ASPECT_IDS
                .iter()
                .filter_map(|id| {
                    let (exact, orb) = input.orb_for(id, from, to)?;
                    let deviation = (angle - exact.min(360.0 - exact)).abs();
                    (deviation <= orb).then_some((*id, deviation))
                })
                .min_by(|a, b| a.1.total_cmp(&b.1));
            if let Some((id, _)) = best {
                *counts.get_mut(id).unwrap() += 1;
                aspected[i] = true;
                aspected[j] = true;
            }
        }
    }
    let unaspected = planets
        .iter()
        .zip(aspected)
        .filter(|(_, has)| !has)
        .map(|((id, _), _)| id.to_string())
        .collect();
    (counts, unaspected)
}

fn stelliums(input: &ChartFactsInput, planets: &[(&str, f64)]) -> Vec<Stellium> {
    let mut result = Vec::new();

    let mut by_sign: BTreeMap<usize, Vec<String>> = BTreeMap::new();
    let mut by_house: BTreeMap<usize, Vec<String>> = BTreeMap::new();
    for (id, lon) in planets {
        by_sign
            .entry(sign_index(*lon))
            .or_default()
            .push(id.to_string());
        if let Some(house) = input.house_of(*lon) {
            by_house.entry(house).or_default().push(id.to_string());
        }
    }
    for (sign, members) in by_sign.into_iter().filter(|(_, m)| m.len() >= 3) {
        result.push(Stellium {
            kind: StelliumKind::Sign,
            members,
            sign: Some(sign),
            house: None,
        });
    }
    for (house, members) in by_house.into_iter().filter(|(_, m)| m.len() >= 3) {
        result.push(Stellium {
            kind: StelliumKind::House,
            members,
            sign: None,
            house: Some(house),
        });
    }

    // Chains: walk the planets in zodiac order and link neighbours that are within the
    // conjunction orb for that pair.
    let mut sorted: Vec<(&str, f64)> = planets.to_vec();
    sorted.sort_by(|a, b| a.1.total_cmp(&b.1));
    let n = sorted.len();
    if n >= 3 {
        let linked = |index: usize| {
            let (a, a_lon) = sorted[index];
            let (b, b_lon) = sorted[(index + 1) % n];
            input
                .orb_for("conjunction", a, b)
                .is_some_and(|(_, orb)| forward_arc(a_lon, b_lon) <= orb)
        };
        if let Some(break_at) = (0..n).find(|i| !linked(*i)) {
            let mut chain: Vec<String> = Vec::new();
            for step in 1..=n {
                let index = (break_at + step) % n;
                chain.push(sorted[index].0.to_string());
                if !linked(index) {
                    if chain.len() >= 3 {
                        result.push(Stellium {
                            kind: StelliumKind::Chain,
                            members: std::mem::take(&mut chain),
                            sign: None,
                            house: None,
                        });
                    }
                    chain.clear();
                }
            }
        }
    }
    result
}

fn angular_planets(input: &ChartFactsInput, planets: &[(&str, f64)]) -> Vec<AngularPlanet> {
    let axis_longitude = |axis: &str| match axis {
        "asc" => Some(input.asc),
        "desc" => Some(input.asc + 180.0),
        "mc" => Some(input.mc),
        "ic" => Some(input.mc + 180.0),
        other => input.positions.get(other).copied(),
    };
    let mut result = Vec::new();
    for (body, lon) in planets {
        for axis in AXIS_IDS {
            let Some(axis_lon) = axis_longitude(axis) else {
                continue;
            };
            let Some((_, allowed)) = input.orb_for("conjunction", body, axis) else {
                continue;
            };
            let orb = shortest_arc_deg(*lon, axis_lon);
            if orb <= allowed {
                result.push(AngularPlanet {
                    body: body.to_string(),
                    axis: axis.to_string(),
                    orb,
                });
            }
        }
    }
    result
}

fn lunar_cycle_phase(positions: &HashMap<String, f64>) -> Option<String> {
    const PHASES: [&str; 8] = [
        "new_moon",
        "crescent",
        "first_quarter",
        "gibbous",
        "full_moon",
        "disseminating",
        "last_quarter",
        "balsamic",
    ];
    let elongation = forward_arc(*positions.get("sun")?, *positions.get("moon")?);
    Some(PHASES[((elongation / 45.0).floor() as usize).min(7)].to_string())
}

/// Morning (west of the Sun, rises first) vs evening (east of the Sun) appearance.
fn inner_planet_phase(
    positions: &HashMap<String, f64>,
    body: &str,
    morning: &str,
    evening: &str,
) -> Option<String> {
    let elongation = forward_arc(*positions.get("sun")?, *positions.get(body)?);
    Some(if elongation > 180.0 { morning } else { evening }.to_string())
}

fn horizon(input: &ChartFactsInput, body: &str) -> Option<String> {
    let lon = *input.positions.get(body)?;
    Some(
        if super::parts::is_day_chart(input.asc, lon) {
            "above"
        } else {
            "below"
        }
        .to_string(),
    )
}

fn chart_ruler(asc: f64) -> ChartRuler {
    let sign = sign_index(asc);
    ChartRuler {
        traditional: TRADITIONAL_RULERS[sign].to_string(),
        modern: MODERN_RULERS[sign].to_string(),
    }
}

fn final_dispositor(
    positions: &HashMap<String, f64>,
    planets: &[&str],
    rulers: &[&str; 12],
) -> Option<FinalDispositor> {
    let dispositor: HashMap<&str, &str> = planets
        .iter()
        .map(|id| Some((*id, rulers[sign_index(*positions.get(*id)?)])))
        .collect::<Option<_>>()?;
    let in_domicile: Vec<&str> = planets
        .iter()
        .copied()
        .filter(|id| dispositor[id] == *id)
        .collect();
    if in_domicile.len() != 1 {
        return Some(FinalDispositor::None);
    }
    let terminal = in_domicile[0];
    let reaches_terminal = |start: &str| {
        let mut current = start;
        for _ in 0..=planets.len() {
            if current == terminal {
                return true;
            }
            current = dispositor[current];
        }
        false
    };
    Some(if planets.iter().all(|id| reaches_terminal(id)) {
        FinalDispositor::Single {
            body: terminal.to_string(),
        }
    } else {
        FinalDispositor::None
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn definition(id: &str, angle: f64, default_orb: f64) -> AspectDefinition {
        AspectDefinition {
            id: id.to_string(),
            aspect_type: "major".to_string(),
            enabled: true,
            glyph: String::new(),
            angle,
            harmonic: 1,
            default_orb,
            i18n: HashMap::new(),
            color: None,
            importance: None,
            line_style: None,
            line_width: None,
            show_label: None,
            valid_contexts: None,
            interpretation_weight: None,
            object_type_rule: None,
        }
    }

    fn definitions() -> Vec<AspectDefinition> {
        vec![
            definition("conjunction", 0.0, 8.0),
            definition("sextile", 60.0, 4.0),
            definition("square", 90.0, 6.0),
            definition("trine", 120.0, 6.0),
            definition("opposition", 180.0, 8.0),
        ]
    }

    fn positions(entries: &[(&str, f64)]) -> HashMap<String, f64> {
        entries
            .iter()
            .map(|(id, lon)| (id.to_string(), *lon))
            .collect()
    }

    /// Equal houses from 0° Aries, so house = sign + 1.
    fn equal_cusps() -> Vec<f64> {
        (0..12).map(|i| i as f64 * 30.0).collect()
    }

    fn facts_with(
        positions: &HashMap<String, f64>,
        aspect_orbs: &HashMap<String, f64>,
    ) -> ChartFacts {
        let definitions = definitions();
        let cusps = equal_cusps();
        let empty = HashMap::new();
        compute_chart_facts(&ChartFactsInput {
            positions,
            speeds: &empty,
            house_cusps: &cusps,
            asc: 0.0,
            mc: 270.0,
            aspect_definitions: &definitions,
            aspect_orbs,
            object_types: &HashMap::new(),
            object_orbs: &empty,
        })
    }

    #[test]
    fn house_groups_follow_angular_succedent_cadent() {
        assert_eq!(HouseGroup::for_house(1), HouseGroup::Active);
        assert_eq!(HouseGroup::for_house(10), HouseGroup::Active);
        assert_eq!(HouseGroup::for_house(5), HouseGroup::Reactive);
        assert_eq!(HouseGroup::for_house(12), HouseGroup::Resulting);
    }

    #[test]
    fn stellium_chain_uses_the_configured_conjunction_orb() {
        // Sun late Aries, Mercury and Venus in Taurus: neighbours 5° and 6° apart.
        let p = positions(&[
            ("sun", 28.0),
            ("mercury", 33.0),
            ("venus", 39.0),
            ("mars", 200.0),
        ]);
        let wide = facts_with(&p, &HashMap::new());
        assert!(wide
            .stelliums
            .iter()
            .any(|s| s.kind == StelliumKind::Chain && s.members == ["sun", "mercury", "venus"]));
        assert!(!wide.stelliums.iter().any(|s| s.kind == StelliumKind::Sign));

        let tight = facts_with(&p, &HashMap::from([("conjunction".to_string(), 4.0)]));
        assert!(!tight
            .stelliums
            .iter()
            .any(|s| s.kind == StelliumKind::Chain));
    }

    #[test]
    fn angular_planet_respects_orb_override() {
        let p = positions(&[("mars", 3.0)]);
        let default_orb = facts_with(&p, &HashMap::new());
        assert!(default_orb
            .angular_planets
            .iter()
            .any(|a| a.body == "mars" && a.axis == "asc"));

        let tight = facts_with(&p, &HashMap::from([("conjunction".to_string(), 2.0)]));
        assert!(tight.angular_planets.is_empty());
    }

    #[test]
    fn distribution_and_phases() {
        let p = positions(&[
            ("sun", 100.0),
            ("moon", 150.0),
            ("mercury", 90.0),
            ("venus", 120.0),
        ]);
        let facts = facts_with(&p, &HashMap::new());
        // Sun 100° → house 4, Moon 150° → house 6, Mercury house 4, Venus house 5.
        assert_eq!(facts.distribution.quadrants, [0, 4, 0, 0]);
        assert_eq!(facts.distribution.lower, 4);
        assert_eq!(facts.house_group_counts["active"], 2);
        assert_eq!(facts.lunar_cycle_phase.as_deref(), Some("crescent"));
        assert_eq!(facts.mercury_phase.as_deref(), Some("prometheus"));
        assert_eq!(facts.venus_phase.as_deref(), Some("evening_star"));
        assert_eq!(facts.sun_horizon.as_deref(), Some("below"));
        assert_eq!(facts.chart_ruler.modern, "mars");
    }

    #[test]
    fn unaspected_planet_has_no_ptolemaic_aspect() {
        // Sun–Moon trine; Mars 45° from both (no Ptolemaic aspect).
        let p = positions(&[("sun", 0.0), ("moon", 120.0), ("mars", 45.0)]);
        let facts = facts_with(&p, &HashMap::new());
        assert_eq!(facts.aspect_counts["trine"], 1);
        assert_eq!(facts.unaspected, vec!["mars"]);
    }

    #[test]
    fn final_dispositor_single_and_loop() {
        // Every traditional planet in Leo: the Sun rules them all and sits in its own sign.
        let leo: Vec<(&str, f64)> = TRADITIONAL_PLANET_IDS
            .iter()
            .map(|id| (*id, 130.0))
            .collect();
        let facts = facts_with(&positions(&leo), &HashMap::new());
        assert_eq!(
            facts.final_dispositors.traditional,
            Some(FinalDispositor::Single {
                body: "sun".to_string()
            })
        );
        // Modern needs all ten planets.
        assert_eq!(facts.final_dispositors.modern, None);

        // Mars in Taurus and Venus in Aries (mutual reception), everyone else disposed by them.
        let mut loop_positions: Vec<(&str, f64)> = TRADITIONAL_PLANET_IDS
            .iter()
            .map(|id| (*id, 10.0))
            .collect();
        loop_positions.retain(|(id, _)| *id != "mars");
        loop_positions.push(("mars", 40.0));
        let facts = facts_with(&positions(&loop_positions), &HashMap::new());
        assert_eq!(
            facts.final_dispositors.traditional,
            Some(FinalDispositor::None)
        );
    }
}
