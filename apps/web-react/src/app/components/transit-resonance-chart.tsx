import { useMemo } from 'react';
import {
	TimeSeriesChart,
	type TimeSeriesDef,
	type TimeSeriesMarker
} from '../views/data/time-series-chart';

export type TransitResonanceSeriesDef = TimeSeriesDef;
export type TransitResonanceMarker = TimeSeriesMarker;

export interface TransitResonanceChartProps {
	/** X values shared across all series (epoch ms), ascending. */
	categories: number[];
	series: TransitResonanceSeriesDef[];
	/** series.id -> degrees-from-exact aligned 1:1 with `categories`; `null` = out of orb (breaks
	 *  the line — a narrower-orb aspect's wave only appears once inside its own orb). */
	values: Record<string, Array<number | null>>;
	markers?: TransitResonanceMarker[];
	tooltipExtra?: (seriesId: string, index: number) => string | null | undefined;
	/** Y-axis span in degrees — `[0, yMaxDegrees]`, 0 at the top (exact). */
	yMaxDegrees: number;
	/** Visible X window (epoch ms); `null` shows the full `categories` span. */
	visibleRange: [number, number] | null;
	onVisibleRangeChange: (range: [number, number] | null) => void;
	highlightedKey: string | null;
	onHighlightChange: (key: string | null) => void;
	/** Fired instead of un-highlighting when the user clicks an already-highlighted series —
	 *  "second click opens the detail panel" (TR-07/TR-10). */
	onActivate?: (key: string) => void;
	formatX?: (x: number) => string;
	ariaLabel?: string;
	className?: string;
}

/** Degree gridline step for a given Y span — finer spacing once zoomed in, so gridlines stay
 *  legibly spaced rather than bunching up or thinning out (TR-06a). */
function gridStepForYMax(yMaxDegrees: number): number {
	if (yMaxDegrees <= 1) return 0.1;
	if (yMaxDegrees <= 2) return 0.25;
	if (yMaxDegrees <= 4) return 0.5;
	return 1;
}

const formatDegrees = (degrees: number) => `${Math.round(degrees * 100) / 100}°`;

/** Degrees-from-exact wave chart: 0° (exact) at the top, out-of-window values read as out of orb. */
export function TransitResonanceChart({
	yMaxDegrees,
	highlightedKey,
	ariaLabel,
	...rest
}: TransitResonanceChartProps) {
	const yTicks = useMemo(() => {
		const step = gridStepForYMax(yMaxDegrees);
		const ticks: number[] = [];
		for (let tick = 0; tick <= yMaxDegrees + 1e-9; tick += step) {
			ticks.push(Math.round(tick * 100) / 100);
		}
		return ticks;
	}, [yMaxDegrees]);

	return (
		<TimeSeriesChart
			{...rest}
			area
			invertY
			clipToYDomain
			yDomain={[0, yMaxDegrees]}
			yTicks={yTicks}
			formatY={formatDegrees}
			highlightedSeriesId={highlightedKey}
			ariaLabel={ariaLabel}
			emptyLabel={ariaLabel}
		/>
	);
}
