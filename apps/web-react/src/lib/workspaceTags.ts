import type { AppChart } from '@/lib/tauri/chartPayload';
import type { WorkspaceTagDefinition } from '@/lib/tauri/types';

/** Workspace tag catalog plus any tag used by a chart but missing from it. */
export function mergeWorkspaceTagCatalog(
	catalog: WorkspaceTagDefinition[],
	charts: AppChart[]
): WorkspaceTagDefinition[] {
	const merged = new Map<string, WorkspaceTagDefinition>();
	for (const tag of catalog) {
		const name = tag.name.trim();
		if (name) merged.set(name, { name, color: tag.color ?? undefined });
	}
	for (const chart of charts) {
		for (const name of chart.tags ?? []) {
			const normalized = name.trim();
			if (!normalized || merged.has(normalized)) continue;
			merged.set(normalized, {
				name: normalized,
				color: chart.tagColors?.[normalized]
			});
		}
	}
	return [...merged.values()];
}

/** Charts with each tag's color taken from the catalog (falling back to the chart's own). */
export function applyWorkspaceTagColors(
	charts: AppChart[],
	catalog: WorkspaceTagDefinition[]
): AppChart[] {
	const colors = new Map(
		catalog.flatMap((tag) => (tag.color ? ([[tag.name, tag.color]] as const) : []))
	);
	return charts.map((chart) => ({
		...chart,
		tagColors: Object.fromEntries(
			(chart.tags ?? []).flatMap((tag) => {
				const color = colors.get(tag) ?? chart.tagColors?.[tag];
				return color ? [[tag, color]] : [];
			})
		)
	}));
}
