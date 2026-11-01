/** X-axis layout shared by `TimeSeriesChart` and `TimeTicker`, so strips stacked under a chart
 *  line up with it: the same horizontal margins and the same time ticks. */

export const TIME_CHART_MARGIN = { top: 12, right: 16, bottom: 34, left: 40 };

/** `count` evenly spaced values from `min` to `max` (just `min` for an empty span). */
export function evenTicks(min: number, max: number, count: number): number[] {
	if (max <= min) return [min];
	const step = (max - min) / Math.max(1, count - 1);
	return Array.from({ length: count }, (_, i) => min + step * i);
}

/** Time-axis ticks over the visible window: up to six, never more than there are samples. */
export function timeAxisTicks(
	categories: readonly number[],
	[xMin, xMax]: [number, number]
): number[] {
	return categories.length <= 1
		? [categories[0] ?? xMin]
		: evenTicks(xMin, xMax, Math.min(6, categories.length));
}

/** The window shown: `visibleRange`, else the whole `categories` span. */
export function timeWindow(
	categories: readonly number[],
	visibleRange: [number, number] | null
): [number, number] {
	return visibleRange ?? [categories[0] ?? 0, categories[categories.length - 1] ?? 1];
}
