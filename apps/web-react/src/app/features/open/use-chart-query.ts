import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppChart } from '@/lib/tauri/chartPayload';
import { buildChartForest } from '@/lib/chartHierarchy';
import { chartTypeLabel } from '@/lib/chartTypes';
import { chartSearchMetadata } from '@/lib/astrology/chartSearch';
import { emptyChartQuery, filterChartTree, type ChartQuery } from '@/lib/astrology/chartQuery';
import {
	persistHiddenFilterGroups,
	readStoredHiddenFilterGroups
} from '@/lib/chartListPreferences';

/** Chart query state plus the filtered chart tree for a list of charts. */
export function useChartQuery(charts: AppChart[]) {
	const { t } = useTranslation();
	const [query, setQuery] = useState<ChartQuery>(emptyChartQuery);
	const forest = useMemo(() => buildChartForest(charts), [charts]);
	const metadataByChart = useMemo(
		() => new Map(charts.map((chart) => [chart.id, chartSearchMetadata(chart)])),
		[charts]
	);
	const { rows, autoExpanded } = useMemo(
		() =>
			filterChartTree(forest, query, {
				metadataFor: (chart) => metadataByChart.get(chart.id) ?? chartSearchMetadata(chart),
				typeLabel: (chart) => chartTypeLabel(chart, t)
			}),
		[forest, metadataByChart, query, t]
	);
	const resetQuery = useCallback(() => setQuery(emptyChartQuery()), []);
	return { query, setQuery, resetQuery, forest, rows, autoExpanded };
}

/** Which filter groups are shown, persisted as the hidden set so new groups start visible. */
export function useFilterGroupVisibility(allGroupIds: readonly string[]) {
	const [hidden, setHidden] = useState<string[]>(readStoredHiddenFilterGroups);
	useEffect(() => persistHiddenFilterGroups(hidden), [hidden]);
	const visible = useMemo(
		() => allGroupIds.filter((id) => !hidden.includes(id)),
		[allGroupIds, hidden]
	);
	const setGroupVisible = useCallback(
		(id: string, show: boolean) =>
			setHidden((current) =>
				show ? current.filter((existing) => existing !== id) : Array.from(new Set([...current, id]))
			),
		[]
	);
	return { visible, setGroupVisible };
}
