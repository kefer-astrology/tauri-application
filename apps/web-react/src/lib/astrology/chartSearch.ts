import type { AppChart } from '@/lib/tauri/chartPayload';

// Search-only classifiers. Distribution shapes use Jones-inspired occupied-arc/gap
// heuristics; configurations are derived from the chart's computed aspect graph.
// Keeping this separate makes the thresholds replaceable when the canonical
// astrology model gains first-class shape/configuration output.

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

function combinations<T>(items: readonly T[], size: number): T[][] {
	const result: T[][] = [];
	const walk = (start: number, selected: T[]) => {
		if (selected.length === size) {
			result.push(selected);
			return;
		}
		for (let index = start; index <= items.length - (size - selected.length); index += 1) {
			walk(index + 1, [...selected, items[index]]);
		}
	};
	walk(0, []);
	return result;
}

function pairKey(left: string, right: string): string {
	return left < right ? `${left}::${right}` : `${right}::${left}`;
}

const MODALITY_IDS = ['cardinal', 'fixed', 'mutable'] as const;
const ELEMENT_IDS = ['fire', 'earth', 'air', 'water'] as const;

function modalityForSign(index: number): (typeof MODALITY_IDS)[number] {
	return MODALITY_IDS[index % 3];
}

function elementForSign(index: number): (typeof ELEMENT_IDS)[number] {
	return ELEMENT_IDS[index % 4];
}

function detectConfigurations(
	positions: Partial<Record<SearchPlanetId, number>>,
	aspects: SearchAspect[]
): Set<string> {
	const result = new Set<string>();
	const bodies = SEARCH_PLANET_IDS.filter((id) => positions[id] !== undefined);
	const aspectMap = new Map(
		aspects.map((aspect) => [pairKey(aspect.from, aspect.to), aspect.type])
	);
	const is = (left: string, right: string, type: string) =>
		aspectMap.get(pairKey(left, right)) === type;
	const trines: SearchPlanetId[][] = [];

	for (const trio of combinations(bodies, 3)) {
		const [a, b, c] = trio;
		const pairTypes = [
			aspectMap.get(pairKey(a, b)),
			aspectMap.get(pairKey(a, c)),
			aspectMap.get(pairKey(b, c))
		];
		if (
			pairTypes.filter((type) => type === 'square').length === 2 &&
			pairTypes.includes('opposition')
		) {
			result.add('t_square');
			result.add(`t_square_${modalityForSign(signIndex(positions[a]!))}`);
		}
		if (pairTypes.every((type) => type === 'trine')) {
			result.add('grand_trine');
			result.add(`grand_trine_${elementForSign(signIndex(positions[a]!))}`);
			trines.push(trio);
		}
		if (
			pairTypes.filter((type) => type === 'quincunx').length === 2 &&
			pairTypes.includes('sextile')
		) {
			result.add('double_quincunx');
		}
		if (pairTypes.filter((type) => type === 'biquintile').length >= 2)
			result.add('double_biquintile');
	}

	for (const quartet of combinations(bodies, 4)) {
		const pairTypes = combinations(quartet, 2).map(([a, b]) => aspectMap.get(pairKey(a, b)));
		if (
			pairTypes.filter((type) => type === 'square').length === 4 &&
			pairTypes.filter((type) => type === 'opposition').length === 2
		) {
			result.add('grand_cross');
			result.add(`grand_cross_${modalityForSign(signIndex(positions[quartet[0]]!))}`);
		}
		if (
			pairTypes.filter((type) => type === 'opposition').length === 2 &&
			pairTypes.filter((type) => type === 'trine').length === 2 &&
			pairTypes.filter((type) => type === 'sextile').length === 2
		) {
			result.add('mystic_rectangle');
		}
	}

	for (const trine of trines) {
		for (const body of bodies.filter((candidate) => !trine.includes(candidate))) {
			for (const opposed of trine) {
				const others = trine.filter((candidate) => candidate !== opposed);
				if (
					is(body, opposed, 'opposition') &&
					others.every((candidate) => is(body, candidate, 'sextile'))
				) {
					result.add('kite');
					result.add(`kite_${elementForSign(signIndex(positions[opposed]!))}`);
				}
			}
		}
	}

	if (
		trines.length >= 2 &&
		trines.some((a, index) =>
			trines.slice(index + 1).some((b) => a.every((body) => !b.includes(body)))
		)
	) {
		result.add('hexagram');
	}
	if (
		combinations(bodies, 5).some(
			(group) =>
				combinations(group, 2).filter(([a, b]) =>
					['quintile', 'biquintile'].includes(aspectMap.get(pairKey(a, b)) ?? '')
				).length >= 5
		)
	) {
		result.add('pentagram');
	}
	return result;
}

function smallestOccupiedArc(entries: Array<[SearchPlanetId, number]>) {
	const sorted = [...entries].sort((left, right) => left[1] - right[1]);
	let largestGap = -1;
	let gapIndex = 0;
	for (let index = 0; index < sorted.length; index += 1) {
		const gap = forwardArc(sorted[index][1], sorted[(index + 1) % sorted.length][1]);
		if (gap > largestGap) {
			largestGap = gap;
			gapIndex = index;
		}
	}
	return {
		arc: 360 - largestGap,
		largestGap,
		leader: sorted[(gapIndex + 1) % sorted.length]?.[0],
		sorted
	};
}

function detectShapes(
	positions: Partial<Record<SearchPlanetId, number>>,
	houseCusps: readonly number[]
): Set<string> {
	const result = new Set<string>();
	const entries = SEARCH_PLANET_IDS.flatMap((id) =>
		positions[id] === undefined ? [] : [[id, positions[id]!] as [SearchPlanetId, number]]
	);
	if (entries.length < 7) return result;

	const full = smallestOccupiedArc(entries);
	if (full.arc <= 120) result.add('bundle');
	else if (full.arc <= 180) {
		result.add('bowl');
		if (full.leader) result.add(`bowl_leader_${full.leader}`);
		const houses = entries
			.map(([, longitude]) => houseForLongitude(longitude, houseCusps))
			.filter((house): house is number => house !== null);
		if (houses.length === entries.length) {
			if (houses.every((house) => [10, 11, 12, 1, 2, 3].includes(house))) result.add('bowl_east');
			if (houses.every((house) => [4, 5, 6, 7, 8, 9].includes(house))) result.add('bowl_west');
			if (houses.every((house) => house >= 7)) result.add('bowl_day');
			if (houses.every((house) => house <= 6)) result.add('bowl_night');
		}
	} else if (full.arc <= 240) {
		result.add('locomotive');
		if (full.leader) result.add(`locomotive_leader_${full.leader}`);
	}

	for (const [handle, longitude] of entries) {
		const remainder = entries.filter(([id]) => id !== handle);
		if (
			smallestOccupiedArc(remainder).arc <= 180 &&
			remainder.every(
				([, other]) => Math.min(forwardArc(longitude, other), forwardArc(other, longitude)) >= 30
			)
		) {
			result.add('bucket');
			result.add(`bucket_${handle}`);
			break;
		}
	}

	const gaps = full.sorted.map((entry, index) =>
		forwardArc(entry[1], full.sorted[(index + 1) % full.sorted.length][1])
	);
	const largeGaps = gaps.filter((gap) => gap >= 60).length;
	if (largeGaps >= 2) result.add('seesaw');
	if (full.largestGap < 60) result.add('splash');
	if (largeGaps === 1 && full.arc > 240) result.add('splay');

	const centroid = entries.reduce(
		(acc, [, longitude]) => {
			const radians = (longitude * Math.PI) / 180;
			return { x: acc.x + Math.cos(radians), y: acc.y + Math.sin(radians) };
		},
		{ x: 0, y: 0 }
	);
	if (Math.hypot(centroid.x, centroid.y) / entries.length >= 0.35) result.add('shifted_center');

	const signCounts = new Map<number, number>();
	for (const [, longitude] of entries)
		signCounts.set(signIndex(longitude), (signCounts.get(signIndex(longitude)) ?? 0) + 1);
	if ([...signCounts.values()].some((count) => count >= 3)) result.add('stellium');
	return result;
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
		shapes: detectShapes(positions, houseCusps),
		configurations: detectConfigurations(positions, aspects)
	};
}
