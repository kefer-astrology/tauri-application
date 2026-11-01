/** Derived data of computed transit results: aspect timelines against the transited anchors, the
 *  resonance chart's values and markers, layer groups, and the result warnings. */

import { DEFAULT_ASPECT_COLORS } from '@/lib/astrology/aspects';
import {
	buildAspectTimelines,
	type AspectExactHit,
	type AspectTimelineResult,
	type AspectTimelineSeries
} from '@/lib/astrology/aspectTimeline';
import { isPersonalPlanetId } from '@/lib/astrology/observableObjects';
import { normalizeLongitude } from '@/lib/astrology/transits';
import type { TransitSeriesEntry, TransitSeriesResult } from '@/lib/tauri/types';

/** Longitudes of `ids` that have a position, normalized to [0, 360). */
export function positionsForIds(
	positions: Record<string, unknown>,
	ids: readonly string[]
): Record<string, number> {
	const result: Record<string, number> = {};
	for (const id of new Set(ids)) {
		const longitude = normalizeLongitude(positions[id]);
		if (longitude !== null) result[id] = longitude;
	}
	return result;
}

/** Transiting body ids present in the series, or `fallback` while it has none. */
export function transitingBodyIdsInSeries(
	series: readonly TransitSeriesEntry[],
	fallback: string[]
): string[] {
	const ids = new Set<string>();
	for (const entry of series) {
		for (const id of Object.keys(entry.transit_positions ?? {})) ids.add(id);
	}
	return ids.size > 0 ? Array.from(ids) : fallback;
}

/**
 * Aspect timelines of the transiting bodies against the selected transited bodies. Aspects among
 * the transiting bodies themselves are dropped by the transited selection, not by kind: the two
 * lists may overlap, and only a `to` in `transitedBodies` is an anchor.
 */
export function anchoredAspectTimelines(
	series: TransitSeriesEntry[],
	transitingBodies: string[],
	fixedPositions: Record<string, unknown>,
	transitedBodies: readonly string[]
): AspectTimelineResult {
	const result = buildAspectTimelines(
		series,
		transitingBodyIdsInSeries(series, transitingBodies),
		fixedPositions
	);
	const transited = new Set(transitedBodies);
	return { ...result, series: result.series.filter((s) => transited.has(s.to)) };
}

/** The series to show: the sampled results (a single snapshot when the backend returned none),
 *  or nothing when the sampled series was not requested. */
export function sampledSeriesToShow(
	raw: TransitSeriesEntry[] | undefined,
	sampledRequested: boolean,
	snapshot: TransitSeriesEntry
): TransitSeriesEntry[] {
	if (!sampledRequested) return [];
	return raw && raw.length > 0 ? raw : [snapshot];
}

/** Backend warnings plus notes on a fallback backend and a suspiciously short custom range. */
export function transitResultWarnings(
	result: Pick<TransitSeriesResult, 'warnings' | 'fallback_used' | 'backend_used' | 'results'>,
	periodModeId: string,
	estimatedSampleCount: number
): string[] {
	const warnings = [...(result.warnings ?? [])];
	if (result.fallback_used) {
		warnings.push(
			`Fell back to the ${result.backend_used ?? 'alternate'} backend after the primary one failed.`
		);
	}
	const received = result.results?.length ?? 0;
	if (periodModeId === 'custom' && estimatedSampleCount > 1 && received <= 1) {
		warnings.push(
			`Expected ~${estimatedSampleCount} samples over the selected period but received only ${received}. The backend may have rejected the request and returned a single snapshot instead.`
		);
	}
	return warnings;
}

/** Resonance chart Y span in degrees: 0.5–6 in 0.1 steps. */
export function clampYZoomDegrees(value: number): number {
	return Math.min(6, Math.max(0.5, Math.round(value * 10) / 10));
}

/** X zoom presets as fixed spans (a month is 30 days, a year 365). */
export const X_ZOOM_PRESET_MS = {
	day: 24 * 60 * 60 * 1000,
	week: 7 * 24 * 60 * 60 * 1000,
	month: 30 * 24 * 60 * 60 * 1000,
	year: 365 * 24 * 60 * 60 * 1000
} as const;

export type XZoomPreset = keyof typeof X_ZOOM_PRESET_MS;

/** A window of the preset's span, centered on the current window (or ending at the data end) and
 *  kept inside the data range; `null` without data. */
export function xZoomWindow(
	preset: XZoomPreset,
	categories: readonly number[],
	current: [number, number] | null
): [number, number] | null {
	const dataMin = categories[0];
	const dataMax = categories[categories.length - 1];
	if (dataMin === undefined || dataMax === undefined) return null;
	const span = Math.min(X_ZOOM_PRESET_MS[preset], dataMax - dataMin || X_ZOOM_PRESET_MS[preset]);
	const center = current ? (current[0] + current[1]) / 2 : dataMax;
	let start = center - span / 2;
	let end = center + span / 2;
	if (start < dataMin) {
		start = dataMin;
		end = start + span;
	}
	if (end > dataMax) {
		end = dataMax;
		start = end - span;
	}
	return [start, end];
}

/** The fast bodies (Sun–Mars) of a selection, in its order. */
export function fastBodies(bodyIds: readonly string[]): string[] {
	return bodyIds.filter(isPersonalPlanetId);
}

/** Series aimed at one of `targets` (transited bodies) — the micro ticker's lanes. */
export function seriesToTargets(
	series: readonly AspectTimelineSeries[],
	targets: readonly string[]
): AspectTimelineSeries[] {
	const set = new Set(targets);
	return series.filter((s) => set.has(s.to));
}

/** Series color by aspect type, as everywhere else in the app. */
export function aspectColorByKey(
	series: readonly AspectTimelineSeries[],
	aspectColors: Record<string, string>
): Map<string, string> {
	return new Map(
		series.map((s) => [
			s.key,
			aspectColors[s.aspectType] ?? DEFAULT_ASPECT_COLORS[s.aspectType] ?? 'var(--theme-accent)'
		])
	);
}

/** Orb in degrees per series, `null` beyond the Y window (same as out of orb). */
export function clippedOrbValues(
	series: readonly AspectTimelineSeries[],
	yMaxDegrees: number
): Record<string, Array<number | null>> {
	return Object.fromEntries(
		series.map((s) => [
			s.key,
			s.orb.map((degrees) => (degrees === null || degrees > yMaxDegrees ? null : degrees))
		])
	);
}

/** First and last index of each contiguous non-null run — where a wave enters and leaves. */
export function runBoundaries(values: Array<number | null>): Array<{ start: number; end: number }> {
	const runs: Array<{ start: number; end: number }> = [];
	let start: number | null = null;
	for (let i = 0; i < values.length; i += 1) {
		if (values[i] !== null) {
			if (start === null) start = i;
		} else if (start !== null) {
			runs.push({ start, end: i - 1 });
			start = null;
		}
	}
	if (start !== null) runs.push({ start, end: values.length - 1 });
	return runs;
}

export interface ResonanceMarker {
	seriesId: string;
	index: number;
	kind: 'hit' | 'entry' | 'exit';
	title?: string;
}

/** Exact-hit markers inside the window, then entry/exit markers at run edges without a hit. */
export function resonanceMarkers(
	series: readonly AspectTimelineSeries[],
	values: Record<string, Array<number | null>>,
	hitTitle: (series: AspectTimelineSeries) => string
): ResonanceMarker[] {
	const list: ResonanceMarker[] = [];
	const seen = new Set<string>();
	for (const s of series) {
		const clipped = values[s.key] ?? [];
		for (const hit of s.hits) {
			if (clipped[hit.sampleIndex] === null) continue;
			seen.add(`${s.key}-${hit.sampleIndex}`);
			list.push({ seriesId: s.key, index: hit.sampleIndex, kind: 'hit', title: hitTitle(s) });
		}
		for (const run of runBoundaries(clipped)) {
			if (run.start === run.end) continue;
			if (!seen.has(`${s.key}-${run.start}`))
				list.push({ seriesId: s.key, index: run.start, kind: 'entry' });
			if (!seen.has(`${s.key}-${run.end}`))
				list.push({ seriesId: s.key, index: run.end, kind: 'exit' });
		}
	}
	return list;
}

export type HitRow = { series: AspectTimelineSeries; hit: AspectExactHit };

/** Every exact hit of the series, in time order. */
export function exactHitRows(series: readonly AspectTimelineSeries[]): HitRow[] {
	return series
		.flatMap((s) => s.hits.map((hit) => ({ series: s, hit })))
		.sort((a, b) => a.hit.timestampMs - b.hit.timestampMs);
}

export interface TransitingLayer {
	from: string;
	keys: string[];
}

/** Series keys grouped by transiting body, in `order` (the transiting selection); bodies outside
 *  it follow by id. */
export function transitingLayers(
	series: readonly AspectTimelineSeries[],
	order: readonly string[] = []
): TransitingLayer[] {
	const byFrom = new Map<string, string[]>();
	for (const s of series) byFrom.set(s.from, [...(byFrom.get(s.from) ?? []), s.key]);
	const rank = (id: string) => {
		const index = order.indexOf(id);
		return index === -1 ? order.length : index;
	};
	return Array.from(byFrom, ([from, keys]) => ({ from, keys })).sort(
		(a, b) => rank(a.from) - rank(b.from) || a.from.localeCompare(b.from)
	);
}

/** Checkbox state of a layer: all shown, none shown, or some. */
export function layerVisibility(
	keys: readonly string[],
	hidden: ReadonlySet<string>
): boolean | 'indeterminate' {
	const hiddenCount = keys.filter((key) => hidden.has(key)).length;
	if (hiddenCount === 0) return true;
	return hiddenCount === keys.length ? false : 'indeterminate';
}

/** `hidden` with `keys` shown or hidden. */
export function withKeysVisible(
	hidden: ReadonlySet<string>,
	keys: readonly string[],
	visible: boolean
): Set<string> {
	const next = new Set(hidden);
	for (const key of keys) {
		if (visible) next.delete(key);
		else next.add(key);
	}
	return next;
}
