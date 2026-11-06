/** What the Horoskop views draw from one chart: the bodies to show and their order, wheel
 *  longitudes, axes, position rows, aspects, and the transit overlay's bodies. */

import type { TimeStep } from '@/lib/chartDateTime';
import { parseComputedAspect, type ParsedAspect } from '@/lib/astrology/aspectParsing';
import { normalizeLongitude } from '@/lib/astrology/chartSearch';
import {
	DEFAULT_OBSERVABLE_OBJECT_IDS,
	OBSERVABLE_OBJECTS
} from '@/lib/astrology/observableObjects';
import type { TransitOverlay } from '@/lib/astrology/transits';
import type { AppChart } from '@/lib/tauri/chartPayload';

export interface PositionRow {
	id: string;
	longitude: number;
	retrograde: boolean;
}

export interface ChartViewData {
	/** Bodies and angles the chart shows, in order: the chart's own, else the defaults. */
	positionOrder: string[];
	/** Bodies on the wheel (angles excluded) and their longitudes. */
	wheelBodyOrder: string[];
	wheelBodyLongitudes: Partial<Record<string, number>>;
	/** Shown axes only (an axis left out of the chart's objects is undefined). */
	axisLongitudes: { asc?: number; dsc?: number; mc?: number; ic?: number };
	/** The ascendant whether or not it is shown (wheel orientation). */
	ascLongitude?: number;
	showAxisLines: boolean;
	positionRows: PositionRow[];
	radixAspects: ParsedAspect[];
	transitBodyOrder: string[];
	transitBodyLongitudes: Partial<Record<string, number>>;
}

const longitudesOf = (ids: readonly string[], positions: Record<string, unknown>) =>
	Object.fromEntries(
		ids.flatMap((id) => {
			const longitude = normalizeLongitude(positions[id]);
			return longitude === null ? [] : [[id, longitude]];
		})
	) as Partial<Record<string, number>>;

/** The data of `chart` for the Horoskop views; `transitOverlay` applies only when it belongs to
 *  this chart. Without a chart everything is empty. */
export function chartViewData(
	chart: AppChart | null | undefined,
	defaultBodies: readonly string[],
	transitOverlay: TransitOverlay | null | undefined
): ChartViewData {
	const positions = (chart?.computed?.positions ?? {}) as Record<string, unknown>;
	const motion = chart?.computed?.motion ?? {};
	const axes = chart?.computed?.axes;
	const positionOrder = Array.isArray(chart?.observableObjects)
		? chart.observableObjects
		: defaultBodies.length > 0
			? [...defaultBodies]
			: DEFAULT_OBSERVABLE_OBJECT_IDS;
	const shown = new Set(positionOrder);
	const axis = (key: 'asc' | 'desc' | 'mc' | 'ic') =>
		shown.has(key) ? (normalizeLongitude(axes?.[key] ?? positions[key]) ?? undefined) : undefined;
	const angleIds = new Set(
		OBSERVABLE_OBJECTS.filter((item) => item.category === 'angles').map((item) => item.id)
	);
	const wheelBodyOrder = positionOrder.filter((id) => !angleIds.has(id));
	const overlay =
		transitOverlay && transitOverlay.sourceChartId === chart?.id ? transitOverlay : null;
	const transitPositions = (overlay?.transitChart.computed?.positions ?? {}) as Record<
		string,
		unknown
	>;
	const transitBodyOrder = overlay?.transitingBodies ?? [];

	return {
		positionOrder,
		wheelBodyOrder,
		wheelBodyLongitudes: longitudesOf(wheelBodyOrder, positions),
		axisLongitudes: { asc: axis('asc'), dsc: axis('desc'), mc: axis('mc'), ic: axis('ic') },
		ascLongitude: normalizeLongitude(axes?.asc ?? positions.asc) ?? undefined,
		showAxisLines: ['asc', 'desc', 'mc', 'ic'].some((id) => shown.has(id)),
		positionRows: positionOrder.flatMap((id) => {
			const longitude = normalizeLongitude(positions[id]);
			return longitude === null
				? []
				: [{ id, longitude, retrograde: motion[id]?.retrograde ?? false }];
		}),
		radixAspects: (chart?.computed?.aspects ?? [])
			.map(parseComputedAspect)
			.filter((aspect): aspect is ParsedAspect => aspect !== null),
		transitBodyOrder,
		transitBodyLongitudes: longitudesOf(transitBodyOrder, transitPositions)
	};
}

export type AstrolabeUnit = TimeStep['unit'];

export const ASTROLABE_UNITS: readonly AstrolabeUnit[] = ['sec', 'min', 'hr', 'day', 'month', 'yr'];

/** Largest step amount offered for a unit. */
export function astrolabeMaxAmount(unit: AstrolabeUnit): number {
	if (unit === 'hr' || unit === 'month') return 12;
	if (unit === 'day') return 30;
	return 10;
}

/** `latitude, longitude` to four decimals, or `null` without both. */
export function formatCoordinates(latitude?: number, longitude?: number): string | null {
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
	return `${latitude!.toFixed(4)}, ${longitude!.toFixed(4)}`;
}
