import type { TransitSeriesEntry } from '@/lib/tauri/types';
import { normalizeDegrees } from './foldedAngle';
import { normalizeLongitude } from './transits';
import { parseComputedAspect } from './aspectParsing';
import { motionStateFromSpeed } from './objectDetail';
import { DEFAULT_ASPECT_ORBS, type AspectRowId } from './aspects';

export type AspectPairKind = 'moving-moving' | 'moving-fixed';

export interface AspectExactHit {
	timestampMs: number;
	/** Nearest sampled index this hit was derived from — the displayed position/speed come
	 *  from this sample (or its neighbor, interpolated), not a root-found exact instant. */
	sampleIndex: number;
	fromLongitude: number;
	toLongitude: number;
	fromSpeed?: number;
	fromRetrograde?: boolean;
	/** 1-based position of this hit among all hits detected for the same pair+aspect. */
	hitNumber: number;
	/** Total hits detected for the same pair+aspect across the whole series. */
	hitCount: number;
}

export interface AspectTimelineSeries {
	key: string;
	from: string;
	to: string;
	aspectType: string;
	kind: AspectPairKind;
	/** Aligned 1:1 with the shared `categories` timestamps; 0 at the orb boundary, 1 at exact
	 *  alignment, `null` while out of orb (so the chart line breaks instead of interpolating
	 *  across a gap it was never actually inside). */
	closeness: Array<number | null>;
	/** The same alignment, but the raw angular deviation in degrees (0 at exact) instead of a
	 *  fraction of the allowed orb — lets a consumer plot an absolute, aspect-independent scale. */
	orb: Array<number | null>;
	/** Orb trend at each sample — closing in on exact vs. moving away from it — `null` outside
	 *  the orb window or at the first sample of a run (no earlier point to compare against). */
	phase: Array<'applying' | 'separating' | null>;
	hits: AspectExactHit[];
}

export interface AspectTimelineResult {
	categories: number[];
	series: AspectTimelineSeries[];
}

/** Shortest signed angular difference `b - a`, in (-180, 180] — handles the 0°/360° wrap so a
 *  linear interpolation between two samples never jumps the long way around the circle. */
function signedAngleDiff(a: number, b: number): number {
	return ((b - a + 540) % 360) - 180;
}

function lerpAngleDeg(a: number, b: number, t: number): number {
	return normalizeDegrees(a + signedAngleDiff(a, b) * t);
}

/** Indices of local minima in a `(value | null)` series, treating `null` as a hard break.
 *  Adjacent candidate indices (a flat/near-flat bottom) collapse into a single hit, keeping
 *  whichever sample is strictly lowest. */
function findLocalMinimaIndices(values: Array<number | null>): number[] {
	const n = values.length;
	const raw: number[] = [];
	for (let i = 0; i < n; i += 1) {
		const v = values[i];
		if (v === null) continue;
		const prev = i > 0 ? values[i - 1] : null;
		const next = i < n - 1 ? values[i + 1] : null;
		const prevOk = prev === null || v <= prev;
		const nextOk = next === null || v <= next;
		if (prevOk && nextOk) raw.push(i);
	}
	const merged: number[] = [];
	for (const i of raw) {
		const last = merged[merged.length - 1];
		if (last !== undefined && i === last + 1) {
			if ((values[i] as number) < (values[last] as number)) merged[merged.length - 1] = i;
		} else {
			merged.push(i);
		}
	}
	return merged;
}

/** Sub-sample refinement of a local minimum via parabolic (3-point) vertex interpolation —
 *  returns a fractional offset in [-1, 1] from `index` toward its lower neighbor. 0 when the
 *  minimum sits at a run's edge (no interior neighbor on one side) or the points are collinear. */
function parabolicOffset(index: number, values: Array<number | null>): number {
	const y0 = index > 0 ? values[index - 1] : null;
	const y1 = values[index];
	const y2 = index < values.length - 1 ? values[index + 1] : null;
	if (y0 === null || y1 === null || y2 === null) return 0;
	const denom = y0 - 2 * y1 + y2;
	if (Math.abs(denom) < 1e-9) return 0;
	return Math.max(-1, Math.min(1, (0.5 * (y0 - y2)) / denom));
}

export function buildAspectTimelines(
	entries: readonly TransitSeriesEntry[],
	transitingBodyIds: readonly string[],
	fixedPositions: Record<string, unknown>
): AspectTimelineResult {
	const categories = entries.map((entry) => Date.parse(entry.datetime));
	const transitingSet = new Set(transitingBodyIds);
	const seriesByKey = new Map<
		string,
		{ from: string; to: string; aspectType: string; closeness: Array<number | null>; orb: Array<number | null> }
	>();

	entries.forEach((entry, index) => {
		for (const raw of entry.aspects ?? []) {
			const parsed = parseComputedAspect(raw);
			if (!parsed) continue;
			// The Python-sidecar compute route doesn't serialize `allowed_orb` (Rust-only field) —
			// fall back to the same model-default orb table the setup UI uses, rather than
			// silently dropping every aspect from that route.
			const allowedOrb =
				parsed.allowedOrb ?? DEFAULT_ASPECT_ORBS[parsed.type as AspectRowId] ?? undefined;
			if (allowedOrb === undefined || allowedOrb <= 0) continue;
			const key = `${parsed.from}|${parsed.to}|${parsed.type}`;
			let series = seriesByKey.get(key);
			if (!series) {
				series = {
					from: parsed.from,
					to: parsed.to,
					aspectType: parsed.type,
					closeness: new Array(entries.length).fill(null),
					orb: new Array(entries.length).fill(null)
				};
				seriesByKey.set(key, series);
			}
			series.closeness[index] = Math.max(0, Math.min(1, 1 - parsed.orb / allowedOrb));
			series.orb[index] = parsed.orb;
		}
	});

	const series: AspectTimelineSeries[] = [];
	for (const [key, data] of seriesByKey) {
		const phase: Array<'applying' | 'separating' | null> = data.orb.map((orb, i) => {
			if (orb === null) return null;
			const previous = i > 0 ? data.orb[i - 1] : null;
			if (previous === null) return null;
			if (orb < previous) return 'applying';
			if (orb > previous) return 'separating';
			return null;
		});

		const minimaIndices = findLocalMinimaIndices(data.orb);
		const hits: AspectExactHit[] = minimaIndices.map((sampleIndex, hitPosition) => {
			const offset = parabolicOffset(sampleIndex, data.orb);
			const neighborIndex = offset >= 0 ? sampleIndex + 1 : sampleIndex - 1;
			const weight = Math.abs(offset);
			const hasNeighbor = neighborIndex >= 0 && neighborIndex < entries.length && weight > 0;

			const fromAt = (i: number) =>
				normalizeLongitude(entries[i]?.transit_positions?.[data.from]) ?? 0;
			const toAt = (i: number) =>
				transitingSet.has(data.to)
					? (normalizeLongitude(entries[i]?.transit_positions?.[data.to]) ?? 0)
					: (normalizeLongitude(fixedPositions[data.to]) ?? 0);
			const speedAt = (i: number) => entries[i]?.motion?.[data.from]?.speed;
			const retrogradeAt = (i: number) => entries[i]?.motion?.[data.from]?.retrograde;

			const timestampMs = hasNeighbor
				? categories[sampleIndex] + (categories[neighborIndex] - categories[sampleIndex]) * weight
				: categories[sampleIndex];
			const fromLongitude = hasNeighbor
				? lerpAngleDeg(fromAt(sampleIndex), fromAt(neighborIndex), weight)
				: fromAt(sampleIndex);
			const toLongitude = hasNeighbor
				? lerpAngleDeg(toAt(sampleIndex), toAt(neighborIndex), weight)
				: toAt(sampleIndex);
			const fromSpeed = speedAt(sampleIndex) ?? (hasNeighbor ? speedAt(neighborIndex) : undefined);
			const fromRetrograde =
				retrogradeAt(sampleIndex) ??
				(hasNeighbor ? retrogradeAt(neighborIndex) : undefined) ??
				(fromSpeed !== undefined ? motionStateFromSpeed(fromSpeed) === 'retrograde' : undefined);

			return {
				timestampMs,
				sampleIndex,
				fromLongitude,
				toLongitude,
				fromSpeed,
				fromRetrograde,
				hitNumber: hitPosition + 1,
				hitCount: minimaIndices.length
			};
		});

		series.push({
			key,
			from: data.from,
			to: data.to,
			aspectType: data.aspectType,
			kind: transitingSet.has(data.from) && transitingSet.has(data.to) ? 'moving-moving' : 'moving-fixed',
			closeness: data.closeness,
			orb: data.orb,
			phase,
			hits
		});
	}

	return { categories, series };
}
