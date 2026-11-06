//! Source-versioned Arabic Lots. Formula operands are a closed vocabulary, never executable code.
use super::parts::{day_night_parts, is_day_chart};
use crate::domain::houses::normalize_deg;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LotDefinition {
    pub id: String,
    pub number: usize,
    pub name: String,
    pub name_cs: String,
    pub group: String,
    pub reference: String,
    pub add: String,
    pub subtract: String,
    pub reverse_at_night: bool,
    pub note: String,
    pub supported: bool,
}
#[derive(Debug, Deserialize, Serialize)]
pub struct LotCatalog {
    pub schema_version: u32,
    pub tradition: String,
    pub version: String,
    pub source: String,
    pub reference_url: String,
    pub notes: String,
    pub lots: Vec<LotDefinition>,
}
pub fn lot_catalog() -> &'static LotCatalog {
    static CATALOG: OnceLock<LotCatalog> = OnceLock::new();
    CATALOG.get_or_init(|| {
        serde_json::from_str(include_str!(
            "../../../../contracts/points/arabic-lots.json"
        ))
        .expect("validated built-in Lot catalog")
    })
}

/// House cusps and input positions must use the same zodiac. Traditional domicile rulers only.
pub struct LotContext<'a> {
    pub positions: &'a HashMap<String, f64>,
    pub asc: f64,
    pub house_cusps: &'a [f64],
    /// Moon's longitude at the last New or Full Moon (inclusive).
    pub syzygy: Option<f64>,
}
impl LotContext<'_> {
    fn day(&self) -> Result<bool, String> {
        Ok(is_day_chart(self.asc, self.body("sun")?))
    }
    fn body(&self, id: &str) -> Result<f64, String> {
        self.positions
            .get(id)
            .copied()
            .filter(|v| v.is_finite())
            .ok_or_else(|| format!("requires {id}"))
    }
    fn operand(&self, operand: &str) -> Result<f64, String> {
        if operand == "asc" {
            return Ok(self.asc);
        }
        if operand == "syzygy" {
            return self
                .syzygy
                .ok_or_else(|| "requires previous lunation".to_string());
        }
        if operand == "sect_light" {
            return self.body(if self.day()? { "sun" } else { "moon" });
        }
        if operand == "exaltation:sect_light" {
            return Ok(if self.day()? { 19.0 } else { 33.0 });
        }
        if operand == "father_subtrahend" {
            let separation = normalize_deg(self.body("saturn")? - self.body("sun")?);
            return self.body(if separation.min(360.0 - separation) < 15.0 {
                "jupiter"
            } else {
                "sun"
            });
        }
        if let Some(value) = operand.strip_prefix("degree:") {
            return value
                .parse::<f64>()
                .ok()
                .filter(|v| v.is_finite())
                .ok_or_else(|| "invalid fixed degree".to_string());
        }
        if let Some(value) = operand.strip_prefix("house:") {
            return value
                .parse::<usize>()
                .ok()
                .filter(|n| (1..=12).contains(n))
                .and_then(|n| self.house_cusps.get(n - 1))
                .copied()
                .filter(|v| v.is_finite())
                .ok_or_else(|| format!("requires house cusp {value}"));
        }
        if let Some(value) = operand.strip_prefix("ruler:") {
            const RULERS: [&str; 12] = [
                "mars", "venus", "mercury", "moon", "sun", "mercury", "venus", "mars", "jupiter",
                "saturn", "saturn", "jupiter",
            ];
            let longitude = self.operand(value)?;
            return self.body(RULERS[(normalize_deg(longitude) / 30.0).floor() as usize]);
        }
        if operand == "part_of_fortune" || operand == "part_of_spirit" {
            let (fortune, spirit) =
                day_night_parts(self.asc, self.body("sun")?, self.body("moon")?);
            return Ok(if operand == "part_of_fortune" {
                fortune
            } else {
                spirit
            });
        }
        self.body(operand)
    }
    pub fn evaluate(&self, lot: &LotDefinition) -> Result<f64, String> {
        if [&lot.reference, &lot.add, &lot.subtract]
            .iter()
            .any(|operand| operand.len() > 128)
        {
            return Err("Lot operand exceeds 128 characters".into());
        }
        if !lot.supported {
            return Err(lot.note.clone());
        }
        let reference = self.operand(&lot.reference)?;
        let a = self.operand(&lot.add)?;
        let b = self.operand(&lot.subtract)?;
        Ok(normalize_deg(
            reference
                + if lot.reverse_at_night && !self.day()? {
                    b - a
                } else {
                    a - b
                },
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn inputs() -> HashMap<String, f64> {
        HashMap::from([
            ("sun".into(), 210.0),
            ("moon".into(), 80.0),
            ("mercury".into(), 225.0),
            ("venus".into(), 170.0),
            ("mars".into(), 290.0),
            ("jupiter".into(), 120.0),
            ("saturn".into(), 50.0),
        ])
    }
    #[test]
    fn catalog_is_unique_and_every_supported_operand_resolves() {
        let catalog = lot_catalog();
        assert_eq!(catalog.lots.len(), 97);
        let ids: std::collections::HashSet<_> = catalog.lots.iter().map(|l| &l.id).collect();
        assert_eq!(ids.len(), 97);
        let positions = inputs();
        let cusps: Vec<_> = (0..12).map(|n| n as f64 * 30.0).collect();
        for asc in [0.0, 180.0] {
            let context = LotContext {
                positions: &positions,
                asc,
                house_cusps: &cusps,
                syzygy: Some(270.0),
            };
            for lot in &catalog.lots {
                let result = context.evaluate(lot);
                if lot.supported {
                    assert!((0.0..360.0).contains(&result.unwrap()), "{}", lot.id);
                } else {
                    assert!(result.is_err());
                }
            }
        }
    }
    #[test]
    fn reversal_is_per_lot_and_non_ascendant_references_are_preserved() {
        let positions = inputs();
        let context = LotContext {
            positions: &positions,
            asc: 180.0,
            house_cusps: &[0.0; 12],
            syzygy: None,
        };
        let find = |id: &str| lot_catalog().lots.iter().find(|l| l.id == id).unwrap();
        assert_eq!(context.evaluate(find("part_of_fortune")).unwrap(), 310.0);
        assert_eq!(context.evaluate(find("lot_treasure")).unwrap(), 125.0);
        assert_eq!(context.evaluate(find("lot_death")).unwrap(), 330.0);
        assert!(context.evaluate(find("lot_hyleg")).is_err());
    }
}
