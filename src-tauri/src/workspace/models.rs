//! Facade for the workspace data model. The actual definitions live in the
//! `models/` submodules, grouped by concern (chart taxonomy, calculation
//! settings, aspects, the domain catalog, views, location, the workspace
//! manifest, presentation colors, and transit setup). Every item is
//! re-exported here by name so existing `crate::workspace::models::X` import
//! paths keep resolving unchanged.
//!
//! Some re-exports below are only ever reached through the shorter
//! `crate::workspace::X` path (via `workspace::mod`'s further `pub use
//! models::*;`), never through the fully-qualified `models::X` path directly,
//! so rustc's `unused_imports` lint fires on them in isolation even though
//! they are load-bearing public API — hence the blanket allow.
#![allow(unused_imports)]

mod aspects;
mod calculation;
mod catalog;
mod chart;
mod colors;
mod elements;
mod location;
mod manifest;
mod shared;
mod transit_setup;
mod views;

pub use aspects::{
    AspectContext, AspectDefinition, AspectLineTierStyle, ObjectType, ObjectTypeRule,
    NON_PHYSICAL_OBJECT_TYPES, PER_OBJECT_ORB_TYPES,
};
pub use calculation::{Ayanamsa, EngineType, HouseSystem, PositionMode, TimeSystem, ZodiacType};
pub use catalog::{
    AstroModel, BodyDefinition, DomainCatalog, DomainDefinition, GeneratedVariantRule,
    HouseSystemDefinition, ModelOverrides, ModelSettings, OverrideEntry,
};
pub use chart::{
    AnalysisInput, AnalysisInstance, AnalysisMethod, Annotation, BaseChartPurpose, ChartConfig,
    ChartDefinition, ChartInstance, ChartPreset, ChartSubject, ChartSummary, DerivedChartMethod,
    DerivedChartStep,
};
pub use colors::{ElementColorSettings, RadixPointColorSettings};
pub use elements::{Element, Sign};
pub use location::{
    validate_location, validate_timezone_identifier, validate_utc_offset, InputMode, Location,
};
pub use manifest::{
    AspectTradition, AstrologySchool, AstrologySchoolId, WorkspaceDefaults,
    WorkspaceInfo, WorkspaceManifest, WorkspacePresentation, WorkspaceTagDefinition,
};
pub use transit_setup::{ConfigurationSearchSetup, TransitSetup};
pub use views::{LayoutStyle, ViewLayout, ViewModule, ViewModuleType};
