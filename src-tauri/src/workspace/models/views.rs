use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ViewModuleType {
    WheelView,
    TransitTimeline,
    AspectGrid,
    SummaryTable,
    InterpretationText,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LayoutStyle {
    Single,
    Biwheel,
    Triwheel,
    Grid,
    Timeline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewModule {
    #[serde(rename = "type")]
    pub module_type: ViewModuleType,
    #[serde(default)]
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewLayout {
    pub name: String,
    pub layout_style: LayoutStyle,
    #[serde(default)]
    pub chart_instances: Vec<String>,
    #[serde(default)]
    pub analyses: Vec<String>,
    #[serde(default)]
    pub modules: Vec<ViewModule>,
}
