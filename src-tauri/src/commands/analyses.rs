use std::path::Path;

use crate::workspace::writer::{
    sanitize_chart_filename, write_analysis_yaml, write_workspace_manifest,
};
use crate::workspace::{
    load_all_analyses, load_all_charts, load_workspace_manifest, AnalysisInstance,
};

/// Persist a comparison independently from the charts it consumes.
#[tauri::command]
pub async fn create_analysis(
    workspace_path: String,
    analysis: serde_json::Value,
) -> Result<String, String> {
    let parsed: AnalysisInstance = serde_json::from_value(analysis)
        .map_err(|error| format!("Invalid analysis payload: {error}"))?;
    validate_analysis_payload(&parsed)?;

    let base = Path::new(&workspace_path);
    let mut manifest = load_workspace_manifest(base)?;
    if load_all_analyses(base, &manifest)?
        .iter()
        .any(|candidate| candidate.id == parsed.id)
    {
        return Err(format!("Analysis id already exists: {}", parsed.id));
    }
    let intended_path = format!(
        "analyses/{}.yml",
        sanitize_chart_filename(parsed.id.as_str())
    );
    if manifest.analyses.contains(&intended_path) {
        return Err(format!(
            "Analysis id maps to an existing file: {}",
            parsed.id
        ));
    }

    let chart_ids: std::collections::HashSet<String> = load_all_charts(base, &manifest)?
        .into_iter()
        .map(|chart| chart.id)
        .collect();
    if chart_ids.contains(&parsed.id) {
        return Err(format!("Workspace entity id already exists: {}", parsed.id));
    }
    for input in &parsed.inputs {
        if let Some(chart_id) = input.chart_id.as_ref() {
            if !chart_ids.contains(chart_id) {
                return Err(format!("Analysis references missing chart: {chart_id}"));
            }
        }
    }

    let relative_path = write_analysis_yaml(base, &parsed)?;
    manifest.analyses.push(relative_path);
    write_workspace_manifest(base, &manifest)?;
    Ok(parsed.id)
}

fn validate_analysis_payload(analysis: &AnalysisInstance) -> Result<(), String> {
    if analysis.version != 1 {
        return Err(format!(
            "Unsupported analysis schema version: {}",
            analysis.version
        ));
    }
    if analysis.id.trim().is_empty() || analysis.name.trim().is_empty() {
        return Err("Analysis id and name are required".to_string());
    }
    if analysis.inputs.len() < 2 {
        return Err("An analysis requires at least two chart inputs".to_string());
    }
    for input in &analysis.inputs {
        match (input.chart_id.as_ref(), input.inline_subject.as_ref()) {
            (Some(chart_id), None) if !chart_id.trim().is_empty() => {}
            (None, Some(subject)) => {
                if subject.name.trim().is_empty() || subject.event_time.is_none() {
                    return Err(
                        "Inline analysis subjects require a name and event_time".to_string()
                    );
                }
                crate::workspace::models::validate_location(&subject.location)?;
            }
            _ => {
                return Err(
                    "Each analysis input requires exactly one of chart_id or inline_subject"
                        .to_string(),
                )
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::charts::create_chart;
    use crate::commands::workspace::{create_workspace, load_workspace};
    use crate::test_support::{sample_chart_payload, TestWorkspaceDir};

    #[test]
    fn progressed_synastry_is_persisted_as_analysis_with_operand_derivations() {
        let temp = TestWorkspaceDir::new("analysis-create");
        let workspace_path = temp.path.join("project");
        let path = workspace_path.to_string_lossy().into_owned();
        tauri::async_runtime::block_on(create_workspace(path.clone(), "Tester".to_string()))
            .expect("workspace should be created");
        for id in ["person-a", "person-b"] {
            tauri::async_runtime::block_on(create_chart(path.clone(), sample_chart_payload(id)))
                .expect("source chart should be created");
        }

        let payload = serde_json::json!({
            "version": 1,
            "id": "a-b-progressed",
            "name": "A and B",
            "method": "synastry",
            "inputs": [
                { "role": "person_a", "chart_id": "person-a", "derivations": [
                    { "method": "progression", "parameters": { "target_date": "2026-09-25" } }
                ] },
                { "role": "person_b", "chart_id": "person-b", "derivations": [
                    { "method": "progression", "parameters": { "target_date": "2026-09-25" } }
                ] }
            ],
            "parameters": {},
            "tags": []
        });
        tauri::async_runtime::block_on(create_analysis(path.clone(), payload))
            .expect("analysis should be created");

        let manifest = load_workspace_manifest(&workspace_path).expect("manifest should load");
        assert_eq!(manifest.analyses, vec!["analyses/a-b-progressed.yml"]);
        let info = tauri::async_runtime::block_on(load_workspace(path))
            .expect("workspace summary should load");
        let persisted = info
            .analyses
            .iter()
            .find(|entry| entry.id == "a-b-progressed")
            .expect("analysis should be returned separately");
        assert_eq!(persisted.method, crate::workspace::AnalysisMethod::Synastry);
        assert_eq!(
            persisted.inputs[0].derivations[0].method,
            crate::workspace::DerivedChartMethod::Progression
        );
    }
}
