use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementColorSettings {
    #[serde(default = "default_element_fire")]
    pub fire: String,
    #[serde(default = "default_element_earth")]
    pub earth: String,
    #[serde(default = "default_element_air")]
    pub air: String,
    #[serde(default = "default_element_water")]
    pub water: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RadixPointColorSettings {
    #[serde(default)]
    pub colors: HashMap<String, String>,
}

fn default_element_fire() -> String {
    "#C00000".to_string()
}

fn default_element_earth() -> String {
    "#909030".to_string()
}

fn default_element_air() -> String {
    "#8000FF".to_string()
}

fn default_element_water() -> String {
    "#0000A0".to_string()
}
