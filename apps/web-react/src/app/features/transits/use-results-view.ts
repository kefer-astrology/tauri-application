import { useCallback, useState } from 'react';
import { clampYZoomDegrees, withKeysVisible } from '@/lib/astrology/transitResults';

export type TransitsResultsViewMode = 'chart' | 'table';

/** How the results are viewed: chart or hit table, hidden series, and the chart's zoom. */
export function useResultsView() {
	const [viewMode, setViewMode] = useState<TransitsResultsViewMode>('chart');
	/** Series keys hidden from the chart (the layers panel checkboxes). */
	const [hiddenSeriesKeys, setHiddenSeriesKeys] = useState<ReadonlySet<string>>(() => new Set());
	/** Y span in degrees (0.5–6). */
	const [yZoomDegrees, setYZoom] = useState(6);
	/** Visible X window (epoch ms); `null` shows the whole computed range. */
	const [visibleRange, setVisibleRange] = useState<[number, number] | null>(null);

	const setSeriesGroupVisible = useCallback(
		(keys: string[], visible: boolean) =>
			setHiddenSeriesKeys((prev) => withKeysVisible(prev, keys, visible)),
		[]
	);
	const setYZoomDegrees = useCallback((value: number) => setYZoom(clampYZoomDegrees(value)), []);
	/** Back to the chart with every series shown and the full range (the Y zoom is kept). */
	const clear = useCallback(() => {
		setViewMode('chart');
		setHiddenSeriesKeys(new Set());
		setVisibleRange(null);
	}, []);

	return {
		viewMode,
		setViewMode,
		hiddenSeriesKeys,
		setSeriesGroupVisible,
		yZoomDegrees,
		setYZoomDegrees,
		visibleRange,
		setVisibleRange,
		clear
	};
}

export type ResultsView = ReturnType<typeof useResultsView>;
