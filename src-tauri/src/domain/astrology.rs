//! Backend-neutral astrological calculations.
//!
//! Astronomy adapters produce positions. This module applies model-defined
//! astrological rules to those positions without depending on Tauri, YAML, or a
//! specific ephemeris engine.
//!
//! Facade for the `astrology/` submodules: `body_selection` (canonical body-id
//! validation for an engine), `aspect_computation` (the core "which aspects form,
//! at what orb" algorithm — the biggest, most cohesive cluster), `midpoint_contacts`
//! (which aspects land on computed midpoints), `geometry` (small angle/arc math
//! shared by the above and by `patterns`), `patterns` (chart-snapshot shape/
//! configuration detection), and `parts` (Arabic Parts / day-night sect). Every
//! existing `crate::domain::astrology::X` import path keeps resolving unchanged
//! through the re-exports below.
//!
//! Some re-exports below are only ever reached through the shorter
//! `crate::domain::X` path, never through the fully-qualified `astrology::X` path
//! directly, so rustc's `unused_imports` lint can fire on them in isolation even
//! though they are load-bearing public API (same situation as
//! `workspace/models.rs` and `workspace/settings.rs`) — hence the blanket allow.
#![allow(unused_imports)]

mod aspect_computation;
mod body_selection;
mod geometry;
mod midpoint_contacts;
mod parts;
mod patterns;

#[cfg(test)]
mod tests;

pub use aspect_computation::{
    compute_chart_aspects, compute_cross_aspects, eligible_aspect_angle_and_orb,
    eligible_aspects_for_pair, is_structurally_locked_aspect_pair, ComputedAspect,
};
pub use body_selection::{object_type_map, resolve_body_selection, BodySelection};
pub use midpoint_contacts::{
    compute_midpoint_contacts, MidpointContact, MidpointContactPoint,
    MIDPOINT_CONTACT_ASPECT_IDS,
};
pub use parts::{arabic_part, day_night_parts, is_day_chart};
pub use patterns::{
    detect_chart_configurations, detect_chart_shapes,
    inject_shapes_and_configurations_into_chart_map,
};
