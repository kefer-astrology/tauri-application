use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::workspace::models::{
    Ayanamsa, ChartConfig, EngineType, HouseSystem, ModelOverrides, PositionMode, TimeSystem,
    ZodiacType,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SettingSource {
    Application,
    Model,
    Workspace,
    Preset,
    Chart,
    Operation,
}

/// Sparse settings supplied by a preset or a single compute operation.
///
/// `None` means inherit. Empty body/aspect lists are explicit values at these
/// scopes and therefore mean "select none".
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SettingsLayer {
    pub house_system: Option<HouseSystem>,
    pub bodies: Option<Vec<String>>,
    pub aspects: Option<Vec<String>>,
    pub aspect_orbs: HashMap<String, f64>,
    pub engine: Option<EngineType>,
    pub position_mode: Option<PositionMode>,
    pub zodiac_type: Option<ZodiacType>,
    pub ayanamsa: Option<Ayanamsa>,
    pub time_system: Option<TimeSystem>,
    pub model_overrides: Option<ModelOverrides>,
}

impl SettingsLayer {
    pub fn from_chart_config(config: &ChartConfig) -> Self {
        let bodies = config.observable_objects.clone();
        Self {
            house_system: config.house_system.clone(),
            bodies,
            aspects: config.selected_aspects.clone(),
            aspect_orbs: config.aspect_orbs.clone(),
            engine: config.engine.clone(),
            position_mode: config.position_mode,
            zodiac_type: Some(config.zodiac_type.clone()),
            ayanamsa: config.ayanamsa.clone(),
            time_system: config.time_system.clone(),
            model_overrides: config.model_overrides.clone(),
        }
    }
}
