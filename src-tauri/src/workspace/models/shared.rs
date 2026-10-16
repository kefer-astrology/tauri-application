//! Small helpers shared by three or more sibling modules in `workspace::models`.
//! Kept separate (rather than duplicated or living in one arbitrary sibling)
//! because `default_true` is used by `chart::AnalysisInstance`-adjacent types,
//! `catalog::BodyDefinition`, `aspects::AspectDefinition`, and
//! `transit_setup::TransitSetup`/`ConfigurationSearchSetup`.

pub(super) fn default_true() -> bool {
    true
}
