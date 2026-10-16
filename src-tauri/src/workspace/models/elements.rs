use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum Element {
    Fire,
    Earth,
    Air,
    Water,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sign {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub glyph: String,
    pub abbreviation: String,
    pub element: Element,
    #[serde(default)]
    pub i18n: HashMap<String, String>,
}
