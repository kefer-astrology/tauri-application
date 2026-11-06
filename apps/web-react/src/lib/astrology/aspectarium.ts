/** The aspectarium's data: which bodies form its rows and columns, which aspects pass the
 *  filters (bodies, aspect types, orb), and how they key into the matrix. With a transit overlay
 *  of the chart, rows are transiting bodies and columns radix bodies; otherwise it is the radix
 *  chart's own triangle. */

import { parseComputedAspect, type ParsedAspect } from '@/lib/astrology/aspectParsing';
import { normalizeLongitude } from '@/lib/astrology/chartSearch';
import { DEFAULT_OBSERVABLE_OBJECT_IDS } from '@/lib/astrology/observableObjects';
import type { TransitOverlay } from '@/lib/astrology/transits';
import type { AppChart } from '@/lib/tauri/chartPayload';

export type AspectLayer = 'radix' | 'transit';
export type OrbPreset = 'default' | 'tight' | 'normal' | 'wide' | 'custom';

export const ORB_PRESETS: readonly { id: OrbPreset; labelKey: string; maxOrb: number }[] = [
	{ id: 'default', labelKey: 'aspectarium_orb_default', maxOrb: 5 },
	{ id: 'tight', labelKey: 'aspectarium_orb_tight', maxOrb: 1 },
	{ id: 'normal', labelKey: 'aspectarium_orb_normal', maxOrb: 3 },
	{ id: 'wide', labelKey: 'aspectarium_orb_wide', maxOrb: 8 },
	{ id: 'custom', labelKey: 'aspectarium_orb_custom', maxOrb: 5 }
];

export function maxOrbForPreset(preset: OrbPreset): number {
	return ORB_PRESETS.find((entry) => entry.id === preset)?.maxOrb ?? 5;
}

export interface AspectEntry {
	/** Stable identity: layer, pair and aspect type. */
	id: string;
	aspect: ParsedAspect;
	fromLayer: AspectLayer;
	toLayer: AspectLayer;
}

export interface AspectariumFilters {
	bodyIds: ReadonlySet<string>;
	aspectTypes: ReadonlySet<string>;
	maxOrb: number;
}

export interface AspectariumData {
	/** Whether a transit overlay of this chart drives the matrix. */
	transit: boolean;
	/** Bodies with a position, before the body filter (for the filter's choices). */
	availableBodyIds: string[];
	rowIds: string[];
	columnIds: string[];
	/** Visible aspects, in order, and by matrix cell (`cellKey`). */
	entries: AspectEntry[];
	cells: ReadonlyMap<string, AspectEntry>;
	/** Column body index, for radix cell keys. */
	order: ReadonlyMap<string, number>;
	/** Every aspect of each layer, unfiltered (detail panels list all of a body's aspects). */
	allRadixAspects: ParsedAspect[];
	allTransitAspects: ParsedAspect[];
}

const parseAll = (raw: readonly unknown[] | undefined) =>
	(raw ?? []).map(parseComputedAspect).filter((a): a is ParsedAspect => a !== null);

/** Matrix cell key: radix pairs are unordered (by body order), transit pairs directional. */
export function cellKey(
	from: string,
	to: string,
	transit: boolean,
	order: ReadonlyMap<string, number>
): string {
	if (transit) return `${from}::${to}`;
	const a = order.get(from) ?? Number.MAX_SAFE_INTEGER;
	const b = order.get(to) ?? Number.MAX_SAFE_INTEGER;
	return a <= b ? `${from}::${to}` : `${to}::${from}`;
}

export function aspectariumData(
	chart: AppChart | null | undefined,
	transitOverlay: TransitOverlay | null | undefined,
	filters: AspectariumFilters
): AspectariumData {
	const overlay =
		transitOverlay && transitOverlay.sourceChartId === chart?.id ? transitOverlay : null;
	const positions = (chart?.computed?.positions ?? {}) as Record<string, unknown>;
	const transitPositions = (overlay?.transitChart.computed?.positions ?? {}) as Record<
		string,
		unknown
	>;
	const located = (ids: readonly string[], source: Record<string, unknown>) =>
		ids.filter((id) => normalizeLongitude(source[id]) !== null);
	const radixAvailable = located(
		overlay?.transitedBodies ?? DEFAULT_OBSERVABLE_OBJECT_IDS,
		positions
	);
	const transitAvailable = located(overlay?.transitingBodies ?? [], transitPositions);
	const columnIds = radixAvailable.filter((id) => filters.bodyIds.has(id));
	const transitIds = transitAvailable.filter((id) => filters.bodyIds.has(id));
	const columns = new Set(columnIds);
	const transitRows = new Set(transitIds);
	const order = new Map(columnIds.map((id, index) => [id, index] as const));
	const passes = (aspect: ParsedAspect, fromSet: ReadonlySet<string>) =>
		filters.aspectTypes.has(aspect.type) &&
		fromSet.has(aspect.from) &&
		columns.has(aspect.to) &&
		Math.abs(aspect.orb) <= filters.maxOrb;

	const allRadixAspects = parseAll(chart?.computed?.aspects);
	const allTransitAspects = parseAll(overlay?.aspects);
	const byCell = new Map<string, AspectEntry>();
	if (overlay) {
		for (const aspect of allTransitAspects.filter((a) => passes(a, transitRows))) {
			byCell.set(cellKey(aspect.from, aspect.to, true, order), {
				id: `transit::${aspect.from}::${aspect.to}::${aspect.type}`,
				aspect,
				fromLayer: 'transit',
				toLayer: 'radix'
			});
		}
	} else {
		for (const aspect of allRadixAspects.filter((a) => passes(a, columns))) {
			const key = cellKey(aspect.from, aspect.to, false, order);
			byCell.set(key, {
				id: `radix::${key}::${aspect.type}`,
				aspect,
				fromLayer: 'radix',
				toLayer: 'radix'
			});
		}
	}

	return {
		transit: overlay !== null,
		availableBodyIds: Array.from(new Set([...radixAvailable, ...transitAvailable])),
		rowIds: overlay ? transitIds : columnIds,
		columnIds,
		entries: Array.from(byCell.values()),
		cells: byCell,
		order,
		allRadixAspects,
		allTransitAspects
	};
}

export type MatrixCell =
	| { kind: 'blank' }
	| { kind: 'diagonal'; bodyId: string }
	| { kind: 'empty' }
	| { kind: 'aspect'; entry: AspectEntry };

/** What one matrix cell shows: in the radix triangle, nothing above the diagonal and the body on
 *  it; otherwise the pair's aspect, if any. */
export function matrixCell(
	data: Pick<AspectariumData, 'transit' | 'cells' | 'order'>,
	rowIndex: number,
	columnIndex: number,
	rowId: string,
	columnId: string
): MatrixCell {
	if (!data.transit && columnIndex > rowIndex) return { kind: 'blank' };
	if (!data.transit && columnIndex === rowIndex) return { kind: 'diagonal', bodyId: rowId };
	const entry = data.cells.get(cellKey(rowId, columnId, data.transit, data.order));
	return entry ? { kind: 'aspect', entry } : { kind: 'empty' };
}

/** `|orb|` to two decimals with a degree sign, or `null`. */
export function formatOrb(orb: number | undefined): string | null {
	if (!Number.isFinite(orb)) return null;
	return `${Math.abs(orb!).toFixed(2)}°`;
}
