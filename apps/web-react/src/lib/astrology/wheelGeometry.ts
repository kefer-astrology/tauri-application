/** Geometry of the radix wheel: ecliptic longitude to screen position, house cusps, glyph
 *  decluttering, hemispheres, and aspect line weight by orb. Rules in the Radix render contract. */

import { ASPECT_ROWS } from '@/lib/astrology/aspects';
import { normalizeDegrees } from '@/lib/astrology/foldedAngle';
import type { AspectLineStyleId, AspectLineTierStyleState } from '@/lib/tauri/chartPayload';

/** Wheel axes (ecliptic longitudes in degrees). */
export interface WheelAxis {
	asc: number;
	dsc: number;
	mc: number;
	ic: number;
}

/** Screen angle (radians) of an ecliptic longitude: 0° at the left edge, counter-clockwise. */
export function longitudeToScreenRadians(eclipticDeg: number): number {
	return ((180 - eclipticDeg) * Math.PI) / 180;
}

/** Point at radius `r` around `(cx, cy)` for an ecliptic longitude. */
export function polar(cx: number, cy: number, r: number, eclipticDeg: number) {
	const rad = longitudeToScreenRadians(eclipticDeg);
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Longitude halfway from `startLon` forward to `endLon` (across 0° when needed). */
export function midpointLongitude(startLon: number, endLon: number): number {
	return normalizeDegrees(startLon + normalizeDegrees(endLon - startLon) / 2);
}

/** Twelve finite cusps normalized to [0, 360), or `[]` when the set is incomplete. */
export function normalizeHouseCusps(cusps?: readonly number[]): number[] {
	if (!cusps || cusps.length !== 12) return [];
	const normalized = cusps.map((cusp) => (Number.isFinite(cusp) ? normalizeDegrees(cusp) : null));
	return normalized.every((cusp): cusp is number => cusp !== null) ? normalized : [];
}

/** A half of the chart, as in the chart facts: `east` = houses 10–3, `west` = 4–9,
 *  `upper` = 7–12, `lower` = 1–6. */
export type ChartHalf = 'east' | 'west' | 'upper' | 'lower';

/** Half of the horizon (ASC–DSC line) a longitude falls in: houses 1–6 follow the ASC. */
export function horizonHalf(eclipticDeg: number, ascDeg: number): 'upper' | 'lower' {
	return Math.sin(((eclipticDeg - ascDeg) * Math.PI) / 180) > 0 ? 'lower' : 'upper';
}

/** Half of the meridian (MC–IC line) a longitude falls in: houses 10–3 follow the MC. */
export function meridianHalf(eclipticDeg: number, mcDeg: number): 'east' | 'west' {
	return Math.sin(((eclipticDeg - mcDeg) * Math.PI) / 180) > 0 ? 'east' : 'west';
}

/** Whether a longitude lies in `half` of a chart with these axes. */
export function isInChartHalf(
	eclipticDeg: number,
	half: ChartHalf,
	axis: { asc: number; mc: number }
): boolean {
	return half === 'east' || half === 'west'
		? meridianHalf(eclipticDeg, axis.mc) === half
		: horizonHalf(eclipticDeg, axis.asc) === half;
}

/** Longitude gap below which two glyphs are treated as overlapping and fanned apart. */
const PLANET_STACK_CONFLICT_DEG = 6;
/** Preferred radial gap between fan tiers; compressed when a cluster is larger than the band allows. */
const PLANET_FAN_RADIAL_STEP = 22;
/** Target on-screen arc length between adjacent fanned glyphs, a bit more than the ~22px glyph. */
const PLANET_FAN_PIXEL_GAP = 26;

export interface PlanetPlacement {
	radius: number;
	/** Longitude used only for on-wheel placement; the body's true longitude is used elsewhere
	 *  (aspects, hemispheres). */
	renderLon: number;
}

/**
 * Bodies within `PLANET_STACK_CONFLICT_DEG` of each other fan into a triangle instead of stacking:
 * the middle member (by longitude) stays at `outerRadius` as the apex, and each step away from it
 * moves one tier inward and one notch around, so a tight conjunction reads as a small triangle.
 * The angular step is sized at the innermost radius, keeping on-screen spacing roughly constant.
 */
export function resolveDeclutteredPlacements(
	entries: readonly { key: string; lon: number }[],
	outerRadius: number,
	floorRadius: number
): Map<string, PlanetPlacement> {
	const placements = new Map<string, PlanetPlacement>();
	const n = entries.length;
	if (n === 0) return placements;
	const ascending = [...entries].sort((a, b) => a.lon - b.lon);
	// Start the scan after a real gap, so a cluster across 0° (358°, 1°) is found as one.
	const start = Math.max(
		0,
		ascending.findIndex(
			(entry, i) =>
				normalizeDegrees(entry.lon - ascending[(i - 1 + n) % n]!.lon) > PLANET_STACK_CONFLICT_DEG
		)
	);
	const sorted = [...ascending.slice(start), ...ascending.slice(0, start)];
	const visited = new Array<boolean>(n).fill(false);
	for (let i = 0; i < n; i++) {
		if (visited[i]) continue;
		const cluster = [i];
		visited[i] = true;
		for (let step = 1; step < n; step++) {
			const cur = (i + step) % n;
			if (visited[cur]) break;
			const prev = cluster[cluster.length - 1]!;
			const gap = normalizeDegrees(sorted[cur]!.lon - sorted[prev]!.lon);
			if (gap > PLANET_STACK_CONFLICT_DEG) break;
			cluster.push(cur);
			visited[cur] = true;
		}
		const size = cluster.length;
		if (size === 1) {
			placements.set(sorted[cluster[0]!]!.key, {
				radius: outerRadius,
				renderLon: sorted[cluster[0]!]!.lon
			});
			continue;
		}
		const midRank = (size - 1) / 2;
		const maxAbsRank = Math.max(...cluster.map((_, k) => Math.abs(k - midRank)));
		const radialStep =
			maxAbsRank > 0
				? Math.min(PLANET_FAN_RADIAL_STEP, (outerRadius - floorRadius) / maxAbsRank)
				: 0;
		const innermostRadius = outerRadius - maxAbsRank * radialStep;
		const angleStepDeg =
			(PLANET_FAN_PIXEL_GAP / (2 * Math.PI * Math.max(innermostRadius, 1))) * 360;
		cluster.forEach((idx, k) => {
			const rank = k - midRank;
			placements.set(sorted[idx]!.key, {
				radius: outerRadius - Math.abs(rank) * radialStep,
				renderLon: normalizeDegrees(sorted[idx]!.lon + rank * angleStepDeg)
			});
		});
	}
	return placements;
}

function normalizeAspectPointId(id: string): string {
	const s = id.trim().toLowerCase();
	return s === 'desc' ? 'dsc' : s;
}

/** Longitude of an aspect endpoint: a body, or one of the axes (`desc` reads as `dsc`). */
export function longitudeForAspectPoint(
	id: string,
	bodyLongitudes: Partial<Record<string, number>>,
	axisLongitudes: Partial<WheelAxis>
): number | null {
	const norm = normalizeAspectPointId(id);
	if (Object.prototype.hasOwnProperty.call(bodyLongitudes, norm)) {
		const lon = bodyLongitudes[norm];
		return typeof lon === 'number' ? lon : null;
	}
	if (norm === 'asc' || norm === 'dsc' || norm === 'mc' || norm === 'ic') {
		const lon = axisLongitudes[norm];
		return typeof lon === 'number' ? lon : null;
	}
	return null;
}

/** Max orb of an aspect type: configured, else the catalog default, else 8°. */
export function maxOrbForAspectType(
	aspectType: string,
	aspectOrbs: Record<string, number>
): number {
	const configured = aspectOrbs[aspectType];
	if (typeof configured === 'number' && Number.isFinite(configured)) {
		return Math.max(configured, 1e-9);
	}
	const row = ASPECT_ROWS.find((r) => r.id === aspectType);
	if (row) return Math.max(row.defaultOrb, 1e-9);
	return 8;
}

export type AspectOrbTier = 'tight' | 'medium' | 'loose' | 'outer';

/** Tier of an orb as a share of the max orb, by the configured thresholds (in %). */
export function aspectOrbTier(
	orbDeg: number,
	maxOrbDeg: number,
	tier: AspectLineTierStyleState
): AspectOrbTier {
	const max = Math.max(maxOrbDeg, 1e-9);
	const pct = (Math.abs(orbDeg) / max) * 100;
	const t = tier.tightThresholdPct;
	const m = Math.max(tier.mediumThresholdPct, t);
	const l = Math.max(tier.looseThresholdPct, m);
	if (pct <= t) return 'tight';
	if (pct <= m) return 'medium';
	if (pct <= l) return 'loose';
	return 'outer';
}

export function strokeWidthForAspectTier(
	orbTier: AspectOrbTier,
	tier: AspectLineTierStyleState
): number {
	if (orbTier === 'tight') return tier.widthTight;
	if (orbTier === 'medium') return tier.widthMedium;
	if (orbTier === 'loose') return tier.widthLoose;
	return tier.widthOuter;
}

/** Only the outer (loosest) tier follows `outerLineStyle`; the others are always solid. */
export function strokeDasharrayForAspectTier(
	orbTier: AspectOrbTier,
	outerLineStyle: AspectLineStyleId,
	strokeWidthPx: number
): string | undefined {
	if (orbTier !== 'outer' || outerLineStyle === 'solid') return undefined;
	if (outerLineStyle === 'dotted') return `0.1 ${(strokeWidthPx * 2.4).toFixed(2)}`;
	return `${(strokeWidthPx * 3).toFixed(2)} ${(strokeWidthPx * 2).toFixed(2)}`;
}
