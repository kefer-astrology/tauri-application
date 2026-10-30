import type { AppChart } from '@/lib/tauri/chartPayload';
import { chartTimeZone, parseChartDateTime } from '@/lib/chartDateTime';

/** Charts a derived chart or an analysis was built from: `definition.inputs` for derived charts
 *  (returns, progressions, composites…), the participant charts for synastry. */
export function chartParentIds(chart: AppChart): string[] {
	if (chart.definition?.kind === 'derived') return chart.definition.inputs;
	if (chart.synastry) {
		return [chart.synastry.personA?.chartId, chart.synastry.personB?.chartId].filter(
			(id): id is string => Boolean(id)
		);
	}
	return [];
}

/** Base charts (natal, event, horary…) exist on their own; derived charts and analyses belong
 *  to the chart(s) they were computed from. */
export function isBaseChart(chart: AppChart): boolean {
	return chart.entityKind !== 'analysis' && chart.definition?.kind !== 'derived';
}

function chartTime(chart: AppChart): number {
	return (
		parseChartDateTime(chart.dateTime, chartTimeZone(chart))?.getTime() ?? Number.POSITIVE_INFINITY
	);
}

export interface ChartForest {
	/** Base charts plus any derived chart/analysis whose parents are not in the list. */
	roots: AppChart[];
	/** Parent chart id → its derived charts and analyses, oldest first. A two-parent analysis
	 *  (e.g. synastry) is listed under both parents. */
	childrenByParent: Map<string, AppChart[]>;
}

export function buildChartForest(charts: AppChart[]): ChartForest {
	const ids = new Set(charts.map((chart) => chart.id));
	const roots: AppChart[] = [];
	const childrenByParent = new Map<string, AppChart[]>();
	for (const chart of charts) {
		const parents = Array.from(new Set(chartParentIds(chart))).filter(
			(id) => id !== chart.id && ids.has(id)
		);
		if (parents.length === 0) {
			roots.push(chart);
			continue;
		}
		for (const parent of parents) {
			const children = childrenByParent.get(parent) ?? [];
			children.push(chart);
			childrenByParent.set(parent, children);
		}
	}
	for (const children of childrenByParent.values()) {
		children.sort((a, b) => chartTime(a) - chartTime(b));
	}
	return { roots, childrenByParent };
}
