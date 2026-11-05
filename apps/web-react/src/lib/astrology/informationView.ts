/** The Information (Spektrum) widgets' data, derived from a chart's facts (`ChartFacts`; defined
 *  in the chart facts contract). Counts are of the ten planets, as in the facts. Every row also
 *  names the bodies it is about, so a widget can show them on the wheel. */

import type { ChartHalf } from '@/lib/astrology/wheelGeometry';
import type { ChartFacts } from '@/lib/tauri/types';

export const PLANET_IDS = [
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

export const ELEMENTS = ['fire', 'earth', 'air', 'water'] as const;
export const MODALITIES = ['cardinal', 'fixed', 'mutable'] as const;
export const HOUSE_GROUPS = ['active', 'reactive', 'resulting'] as const;
export const CHART_HALVES: readonly ChartHalf[] = ['east', 'west', 'upper', 'lower'];
/** The aspects the facts count (closest fit per planet pair). */
export const PTOLEMAIC_ASPECTS = [
	'conjunction',
	'sextile',
	'square',
	'trine',
	'opposition'
] as const;

/** What a widget row shows on the wheel: bodies to highlight, optionally a chart half. */
export interface WheelFocus {
	bodies: string[];
	half?: ChartHalf;
}

export interface CountRow<K extends string> {
	key: K;
	count: number;
	/** Share of all counted planets, 0–1. */
	share: number;
	bodies: string[];
}

type Facts = Pick<ChartFacts, 'bodies'>;

/** The planets the facts describe, in planet order. */
function planets(facts: Facts): [string, ChartFacts['bodies'][string]][] {
	return PLANET_IDS.flatMap((id) => (facts.bodies[id] ? [[id, facts.bodies[id]!]] : []));
}

function countRows<K extends string>(
	keys: readonly K[],
	counts: Partial<Record<string, number>>,
	bodiesOf: (key: K) => string[]
): CountRow<K>[] {
	const total = keys.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
	return keys.map((key) => {
		const count = counts[key] ?? 0;
		return { key, count, share: total > 0 ? count / total : 0, bodies: bodiesOf(key) };
	});
}

export function elementRows(facts: Pick<ChartFacts, 'bodies' | 'element_counts'>) {
	return countRows(ELEMENTS, facts.element_counts, (key) =>
		planets(facts).flatMap(([id, body]) => (body.element === key ? [id] : []))
	);
}

export function modalityRows(facts: Pick<ChartFacts, 'bodies' | 'modality_counts'>) {
	return countRows(MODALITIES, facts.modality_counts, (key) =>
		planets(facts).flatMap(([id, body]) => (body.modality === key ? [id] : []))
	);
}

export function houseGroupRows(facts: Pick<ChartFacts, 'bodies' | 'house_group_counts'>) {
	return countRows(HOUSE_GROUPS, facts.house_group_counts, (key) =>
		planets(facts).flatMap(([id, body]) => (body.house_group === key ? [id] : []))
	);
}

/** Planets per house, houses 1–12. */
export function houseCounts(facts: Facts): number[] {
	const counts = new Array<number>(12).fill(0);
	for (const [, body] of planets(facts)) {
		if (body.house !== null && body.house >= 1 && body.house <= 12) counts[body.house - 1]! += 1;
	}
	return counts;
}

/** The houses of each chart half, as in the facts. */
const HALF_HOUSES: Record<ChartHalf, readonly number[]> = {
	east: [10, 11, 12, 1, 2, 3],
	west: [4, 5, 6, 7, 8, 9],
	upper: [7, 8, 9, 10, 11, 12],
	lower: [1, 2, 3, 4, 5, 6]
};

const QUADRANT_HOUSES = [
	[1, 2, 3],
	[4, 5, 6],
	[7, 8, 9],
	[10, 11, 12]
] as const;

function planetsInHouses(facts: Facts, houses: readonly number[]): string[] {
	return planets(facts).flatMap(([id, body]) =>
		body.house !== null && houses.includes(body.house) ? [id] : []
	);
}

export function quadrantRows(facts: Pick<ChartFacts, 'bodies' | 'distribution'>) {
	const placed = facts.distribution.placed;
	return facts.distribution.quadrants.map((count, index) => ({
		quadrant: index + 1,
		count,
		share: placed > 0 ? count / placed : 0,
		bodies: planetsInHouses(facts, QUADRANT_HOUSES[index]!)
	}));
}

export function hemisphereRows(facts: Pick<ChartFacts, 'bodies' | 'distribution'>) {
	const placed = facts.distribution.placed;
	return CHART_HALVES.map((half) => {
		const count = facts.distribution[half];
		return {
			half,
			count,
			share: placed > 0 ? count / placed : 0,
			bodies: planetsInHouses(facts, HALF_HOUSES[half])
		};
	});
}

/** A planet alone in a chart half (the other planets all in the opposite one). */
export function singletons(facts: Pick<ChartFacts, 'bodies' | 'distribution'>) {
	return hemisphereRows(facts).flatMap((row) =>
		row.count === 1 && row.bodies.length === 1 && facts.distribution.placed > 1
			? [{ half: row.half, body: row.bodies[0]! }]
			: []
	);
}

/** Retrograde planets, and the chart halves whose planets are all retrograde. */
export function retrogradeSummary(facts: Pick<ChartFacts, 'bodies' | 'distribution'>) {
	const all = planets(facts);
	const retrograde = all.flatMap(([id, body]) => (body.motion === 'retrograde' ? [id] : []));
	const patterns = hemisphereRows(facts).flatMap((row) =>
		row.bodies.length > 0 && row.bodies.every((id) => retrograde.includes(id))
			? [{ half: row.half, bodies: row.bodies }]
			: []
	);
	return { retrograde, total: all.length, patterns };
}

export type FocalRole =
	| 'chart_ruler_traditional'
	| 'chart_ruler_modern'
	| 'final_dispositor_traditional'
	| 'final_dispositor_modern'
	| 'angular'
	| 'unaspected';

export interface FocalPlanet {
	body: string;
	roles: { role: FocalRole; detail?: string }[];
}

/** The chart's focal planets — chart ruler, final dispositor, angular and unaspected planets —
 *  one row per planet with all its roles, in planet order. */
export function focalPlanets(
	facts: Pick<ChartFacts, 'chart_ruler' | 'final_dispositors' | 'angular_planets' | 'unaspected'>
): FocalPlanet[] {
	const roles = new Map<string, FocalPlanet['roles']>();
	const add = (body: string | undefined, role: FocalRole, detail?: string) => {
		if (!body) return;
		roles.set(body, [...(roles.get(body) ?? []), detail ? { role, detail } : { role }]);
	};
	add(facts.chart_ruler.traditional, 'chart_ruler_traditional');
	if (facts.chart_ruler.modern !== facts.chart_ruler.traditional) {
		add(facts.chart_ruler.modern, 'chart_ruler_modern');
	}
	const traditional = facts.final_dispositors.traditional;
	const modern = facts.final_dispositors.modern;
	if (traditional?.status === 'single') add(traditional.body, 'final_dispositor_traditional');
	if (
		modern?.status === 'single' &&
		!(traditional?.status === 'single' && traditional.body === modern.body)
	) {
		add(modern.body, 'final_dispositor_modern');
	}
	for (const angular of facts.angular_planets) add(angular.body, 'angular', angular.axis);
	for (const body of facts.unaspected) add(body, 'unaspected');
	const order = (id: string) => {
		const index = (PLANET_IDS as readonly string[]).indexOf(id);
		return index === -1 ? PLANET_IDS.length : index;
	};
	return [...roles.entries()]
		.sort(([a], [b]) => order(a) - order(b))
		.map(([body, list]) => ({ body, roles: list }));
}

export function aspectRows(facts: Pick<ChartFacts, 'aspect_counts'>) {
	return countRows(PTOLEMAIC_ASPECTS, facts.aspect_counts, () => []);
}

/** Keys with the highest non-zero count (several on a tie), or none. */
export function dominantKeys<K extends string>(rows: readonly CountRow<K>[]): K[] {
	const max = Math.max(0, ...rows.map((row) => row.count));
	return max > 0 ? rows.filter((row) => row.count === max).map((row) => row.key) : [];
}

/** Keys counted zero. */
export function missingKeys<K extends string>(rows: readonly CountRow<K>[]): K[] {
	return rows.filter((row) => row.count === 0).map((row) => row.key);
}

export type HighlightKind =
	| 'element'
	| 'modality'
	| 'house_group'
	| 'aspect'
	| 'stellium'
	| 'singleton'
	| 'final_dispositor'
	| 'chart_ruler'
	| 'unaspected'
	| 'retrograde'
	| 'lunar_phase'
	| 'hemisphere'
	| 'quadrant';

export interface Highlight {
	id: string;
	kind: HighlightKind;
	/** What the chip names: a key (element, aspect, phase, half, …) or a body id. */
	value: string;
	/** A count or share where the chip shows one. */
	count?: number;
	share?: number;
	focus: WheelFocus;
}

/** The chart's headline facts as chips, in a fixed order; facts without a clear value (a tie,
 *  nothing found) are left out. */
export function highlights(facts: ChartFacts): Highlight[] {
	const list: Highlight[] = [];
	const dominant = <K extends string>(kind: HighlightKind, rows: CountRow<K>[]) => {
		const keys = dominantKeys(rows);
		if (keys.length !== 1) return;
		const row = rows.find((r) => r.key === keys[0])!;
		list.push({ id: kind, kind, value: row.key, count: row.count, focus: { bodies: row.bodies } });
	};
	dominant('element', elementRows(facts));
	dominant('modality', modalityRows(facts));
	dominant('house_group', houseGroupRows(facts));
	dominant('aspect', aspectRows(facts));
	facts.stelliums.forEach((stellium, index) =>
		list.push({
			id: `stellium-${index}`,
			kind: 'stellium',
			value: stellium.kind,
			count: stellium.house ?? stellium.sign,
			focus: { bodies: stellium.members }
		})
	);
	for (const single of singletons(facts)) {
		list.push({
			id: `singleton-${single.half}`,
			kind: 'singleton',
			value: single.body,
			focus: { bodies: [single.body], half: single.half }
		});
	}
	const dispositor = facts.final_dispositors.traditional ?? facts.final_dispositors.modern;
	if (dispositor?.status === 'single') {
		list.push({
			id: 'final-dispositor',
			kind: 'final_dispositor',
			value: dispositor.body,
			focus: { bodies: [dispositor.body] }
		});
	}
	const ruler = facts.chart_ruler.traditional || facts.chart_ruler.modern;
	if (ruler) {
		list.push({ id: 'chart-ruler', kind: 'chart_ruler', value: ruler, focus: { bodies: [ruler] } });
	}
	for (const body of facts.unaspected) {
		list.push({
			id: `unaspected-${body}`,
			kind: 'unaspected',
			value: body,
			focus: { bodies: [body] }
		});
	}
	const { retrograde } = retrogradeSummary(facts);
	if (retrograde.length > 0) {
		list.push({
			id: 'retrograde',
			kind: 'retrograde',
			value: 'retrograde',
			count: retrograde.length,
			focus: { bodies: retrograde }
		});
	}
	if (facts.lunar_cycle_phase) {
		list.push({
			id: 'lunar-phase',
			kind: 'lunar_phase',
			value: facts.lunar_cycle_phase,
			focus: { bodies: ['sun', 'moon'] }
		});
	}
	const halves = hemisphereRows(facts);
	const strongest = [...halves].sort((a, b) => b.share - a.share)[0];
	if (strongest && strongest.share > 0.5) {
		list.push({
			id: 'hemisphere',
			kind: 'hemisphere',
			value: strongest.half,
			share: strongest.share,
			focus: { bodies: strongest.bodies, half: strongest.half }
		});
	}
	const quadrants = quadrantRows(facts);
	const top = Math.max(...quadrants.map((q) => q.count));
	const leading = quadrants.filter((q) => q.count === top);
	if (top > 0 && leading.length === 1) {
		list.push({
			id: 'quadrant',
			kind: 'quadrant',
			value: String(leading[0]!.quadrant),
			share: leading[0]!.share,
			focus: { bodies: leading[0]!.bodies }
		});
	}
	return list;
}
