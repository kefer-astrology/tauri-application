import type { AppChart } from '@/lib/tauri/chartPayload';

// Chart-search filter helpers. Distribution shapes and aspect-pattern configurations
// (bundle/bowl/t-square/grand-trine/etc.) are computed in Rust (`astrology.rs`) and
// arrive pre-populated on `chart.computed.shapes`/`chart.computed.configurations`;
// this module only reads them. Per-planet sign/degree/house filtering below is still
// derived client-side from already-computed positions/house cusps.

export const SEARCH_PLANET_IDS = [
	'sun',
	'moon',
	'mercury',
	'venus',
	'mars',
	'jupiter',
	'saturn',
	'uranus',
	'neptune',
	'pluto'
] as const;

export type SearchPlanetId = (typeof SEARCH_PLANET_IDS)[number];

export interface SearchAspect {
	from: string;
	to: string;
	type: string;
}

export interface ChartSearchMetadata {
	positions: Partial<Record<SearchPlanetId, number>>;
	aspects: SearchAspect[];
	houseCusps: number[];
	shapes: Set<string>;
	configurations: Set<string>;
}

export function normalizeLongitude(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return ((value % 360) + 360) % 360;
	if (value && typeof value === 'object') {
		const longitude = (value as { longitude?: unknown }).longitude;
		if (typeof longitude === 'number' && Number.isFinite(longitude)) {
			return ((longitude % 360) + 360) % 360;
		}
	}
	return null;
}

export function signIndex(longitude: number): number {
	return Math.floor(normalizeLongitude(longitude)! / 30) % 12;
}

export function degreeInSign(longitude: number): number {
	return Math.floor(normalizeLongitude(longitude)! % 30) + 1;
}

function forwardArc(from: number, to: number): number {
	return (((to - from) % 360) + 360) % 360;
}

export function houseForLongitude(longitude: number, cusps: readonly number[]): number | null {
	if (cusps.length !== 12) return null;
	for (let index = 0; index < 12; index += 1) {
		const start = normalizeLongitude(cusps[index]);
		const end = normalizeLongitude(cusps[(index + 1) % 12]);
		if (start === null || end === null) return null;
		if (forwardArc(start, longitude) < forwardArc(start, end)) return index + 1;
	}
	return 12;
}

function parseAspect(raw: unknown): SearchAspect | null {
	if (!raw || typeof raw !== 'object') return null;
	const value = raw as Record<string, unknown>;
	if (
		typeof value.from !== 'string' ||
		typeof value.to !== 'string' ||
		typeof value.type !== 'string'
	) {
		return null;
	}
	return { from: value.from, to: value.to, type: value.type.toLowerCase().replaceAll('-', '_') };
}

export function chartSearchMetadata(chart: AppChart): ChartSearchMetadata {
	const rawPositions = chart.computed?.positions ?? {};
	const positions = Object.fromEntries(
		SEARCH_PLANET_IDS.flatMap((id) => {
			const longitude = normalizeLongitude(rawPositions[id]);
			return longitude === null ? [] : [[id, longitude]];
		})
	) as Partial<Record<SearchPlanetId, number>>;
	const aspects = (chart.computed?.aspects ?? [])
		.map(parseAspect)
		.filter((aspect): aspect is SearchAspect => aspect !== null);
	const houseCusps = (
		chart.computed?.houseCusps ??
		Array.from({ length: 12 }, (_, index) => normalizeLongitude(rawPositions[`house_${index + 1}`]))
	).filter((cusp): cusp is number => typeof cusp === 'number' && Number.isFinite(cusp));
	return {
		positions,
		aspects,
		houseCusps,
		shapes: new Set(chart.computed?.shapes ?? []),
		configurations: new Set(chart.computed?.configurations ?? [])
	};
}
