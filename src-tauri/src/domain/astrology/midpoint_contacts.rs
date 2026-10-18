use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::workspace::models::{AspectDefinition, ObjectType, PER_OBJECT_ORB_TYPES};

use super::geometry::shortest_arc_deg;

/// Aspect ids eligible for midpoint-axis contacts: conjunction, opposition, square, and the two
/// 45°-family aspects already in the catalog under their classical names — `octile` (45°,
/// "semisquare") and `trioctile` (135°, "sesquisquare"). Reusing these exact catalog ids/angles/
/// default orbs rather than inventing a parallel five-aspect system.
pub const MIDPOINT_CONTACT_ASPECT_IDS: [&str; 5] =
    ["conjunction", "opposition", "square", "octile", "trioctile"];

/// Which end of a midpoint axis a contact fell near — see `compute_midpoint_contacts`'s doc
/// comment for why a single scan against `Midpoint::position` can report either end without a
/// second pass against `Midpoint::opposite`.
///
/// This file computes which *aspects* land on midpoints ("contacts"); the raw midpoint
/// longitudes themselves are computed by `domain::midpoints` (`compute_midpoint`/
/// `compute_midpoints`) — that module does not know about aspects at all, and this module
/// consumes its output (`crate::domain::midpoints::Midpoint`) without duplicating it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MidpointContactPoint {
    /// The contact fell near `Midpoint::position` (a conjunction or semisquare/octile to it).
    Position,
    /// The contact fell near `Midpoint::opposite` (an opposition or sesquisquare/trioctile to
    /// `position` — equivalently, a conjunction/semisquare to the antipode).
    Opposite,
    /// A square: exactly 90° from `position` is also exactly 90° from `opposite` (since
    /// 180−90=90), so it's equidistant from both ends of the axis.
    Both,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MidpointContact {
    pub contact_object: String,
    pub object_a: String,
    pub object_b: String,
    pub aspect_type: String,
    pub contact_point: MidpointContactPoint,
    /// Shortest-arc angular separation between `contact_object` and `Midpoint::position`
    /// (always measured against `position`, never `opposite` — see `compute_midpoint_contacts`).
    pub angle: f64,
    pub exact_angle: f64,
    /// Deviation from `exact_angle`: `(angle - exact_angle).abs()`.
    pub orb: f64,
    pub allowed_orb: f64,
}

fn midpoint_contact_point_for_aspect(aspect_id: &str) -> MidpointContactPoint {
    match aspect_id {
        "conjunction" | "octile" => MidpointContactPoint::Position,
        "opposition" | "trioctile" => MidpointContactPoint::Opposite,
        _ => MidpointContactPoint::Both,
    }
}

/// Detect which `contact_positions` form a hard aspect (conjunction/opposition/square/
/// semisquare/sesquisquare, per `aspect_types`) to any of the given midpoint axes.
///
/// Deliberately does **not** route through `detect_aspect`/`pair_allowed`/`object_type_rule`:
/// those encode planet-to-planet eligibility rules, including the "only conjunction forms for
/// non-physical points" rule (`NON_PHYSICAL_OBJECT_TYPES`, see `workspace::settings`) — a
/// midpoint is itself a non-physical, derived point, and that rule would silently suppress the
/// square/semisquare/sesquisquare contacts this function exists to find. Midpoint-axis contacts
/// are a distinct, well-established technique (Ebertin/Uranian) that deliberately uses hard
/// aspects to a non-physical point, so this reuses the catalog's angle/default-orb values
/// directly rather than the object-type-gated matching pipeline.
///
/// Only ever tests `midpoint.position` (never `midpoint.opposite`) — this is what structurally
/// prevents duplicate contacts from the axis's two ends: for any point `x`,
/// `shortest_arc(x, opposite) == 180 - shortest_arc(x, position)` always (opposite points on a
/// circle), so scanning `position` alone across {0°,45°,90°,135°,180°} already reaches every
/// contact a second `opposite` scan would find, just expressed as the complementary angle. A
/// contact equal to the midpoint's own `object_a`/`object_b` is skipped (a source object
/// trivially "contacting" its own pair's midpoint isn't a meaningful signal).
#[allow(clippy::too_many_arguments)]
pub fn compute_midpoint_contacts(
    midpoints: &[crate::domain::midpoints::Midpoint],
    contact_positions: &HashMap<String, f64>,
    aspect_definitions: &[AspectDefinition],
    aspect_orbs: &HashMap<String, f64>,
    aspect_types: &[String],
    contact_object_types: &HashMap<String, ObjectType>,
    object_orbs: &HashMap<String, f64>,
) -> Vec<MidpointContact> {
    let enabled: HashSet<&str> = aspect_types
        .iter()
        .map(String::as_str)
        .filter(|id| MIDPOINT_CONTACT_ASPECT_IDS.contains(id))
        .collect();
    let specs: Vec<(&str, f64, f64)> = aspect_definitions
        .iter()
        .filter(|definition| definition.enabled && enabled.contains(definition.id.as_str()))
        .map(|definition| {
            let orb = aspect_orbs
                .get(&definition.id)
                .copied()
                .unwrap_or(definition.default_orb);
            (definition.id.as_str(), definition.angle, orb)
        })
        .collect();

    let mut contact_ids: Vec<&String> = contact_positions.keys().collect();
    contact_ids.sort();

    let mut contacts = Vec::new();
    for midpoint in midpoints {
        for contact_id in &contact_ids {
            if **contact_id == midpoint.object_a || **contact_id == midpoint.object_b {
                continue;
            }
            let contact_lon = *contact_positions.get(contact_id.as_str()).unwrap_or(&0.0);
            let angle = shortest_arc_deg(contact_lon, midpoint.position);
            for (aspect_id, exact_angle, base_orb) in &specs {
                let override_orb = contact_object_types
                    .get(contact_id.as_str())
                    .filter(|object_type| PER_OBJECT_ORB_TYPES.contains(object_type))
                    .and_then(|_| object_orbs.get(contact_id.as_str()).copied());
                let allowed_orb = override_orb.map_or(*base_orb, |value| value.min(*base_orb));
                let orb = (angle - exact_angle).abs();
                if orb <= allowed_orb {
                    contacts.push(MidpointContact {
                        contact_object: (*contact_id).clone(),
                        object_a: midpoint.object_a.clone(),
                        object_b: midpoint.object_b.clone(),
                        aspect_type: aspect_id.to_string(),
                        contact_point: midpoint_contact_point_for_aspect(aspect_id),
                        angle,
                        exact_angle: *exact_angle,
                        orb,
                        allowed_orb,
                    });
                }
            }
        }
    }
    contacts
}
