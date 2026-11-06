import type { ChartFacts } from '@/lib/tauri/types';

/** Open-view filters evaluated against Rust `ChartFacts` (see the Chart facts contract). Empty
 *  string means "any" throughout, matching the `—` option in the selects. */

export const FACT_PLANET_IDS = [
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
export type FactPlanetId = (typeof FACT_PLANET_IDS)[number];
export const TRADITIONAL_PLANET_IDS = FACT_PLANET_IDS.slice(0, 7);
export const MODALITY_IDS = ['cardinal', 'fixed', 'mutable'] as const;
export const ELEMENT_IDS = ['fire', 'earth', 'air', 'water'] as const;
export const HOUSE_GROUP_IDS = ['active', 'reactive', 'resulting'] as const;
export const PTOLEMAIC_ASPECT_IDS = [
	'conjunction',
	'opposition',
	'trine',
	'square',
	'sextile'
] as const;
export const HEMISPHERE_IDS = ['east', 'west', 'upper', 'lower'] as const;
export const LUNAR_CYCLE_PHASE_IDS = [
	'new_moon',
	'crescent',
	'first_quarter',
	'gibbous',
	'full_moon',
	'disseminating',
	'last_quarter',
	'balsamic'
] as const;
export const AXIS_IDS = ['asc', 'desc', 'mc', 'ic', 'vertex', 'antivertex'] as const;
export const HORIZON_OPTIONS = [
	'both_above',
	'sun_above_moon_below',
	'both_below',
	'sun_below_moon_above'
] as const;

/** Count condition: `''` any, `'0'`…`'15'` exact count (or at least with `orMore`), `'dominant'`
 *  at least twice every other counted category. */
export type CountFilter = { value: string; orMore: boolean };
export type StelliumKind = 'chain' | 'sign' | 'house';
export type StelliumFilter = {
	id: number;
	size: '' | '3' | '4' | '5';
	kind: StelliumKind;
	sign: string;
	house: string;
	required: string[];
};
export type AngularPlanetFilter = { id: number; planet: string; axis: string };
export const emptyAngularPlanetFilter = (id: number): AngularPlanetFilter => ({
	id,
	planet: '',
	axis: ''
});

export type InnerPlanetFilter = { phase: string; motion: string };

export interface FactFilters {
	stelliums: StelliumFilter[];
	hemispheres: string[];
	quadrants: CountFilter[];
	modality: Record<(typeof MODALITY_IDS)[number], CountFilter>;
	elements: Record<(typeof ELEMENT_IDS)[number], CountFilter>;
	houseGroups: Record<(typeof HOUSE_GROUP_IDS)[number], CountFilter>;
	aspects: Record<(typeof PTOLEMAIC_ASPECT_IDS)[number], CountFilter>;
	mercury: InnerPlanetFilter;
	venus: InnerPlanetFilter;
	lunarPhases: string[];
	orientation: string;
	horizon: string;
	angular: AngularPlanetFilter[];
	unaspected: string[];
	ruler: { system: 'modern' | 'traditional'; planet: string; sign: string; house: string };
	dispositorTraditional: string;
	dispositorModern: string;
}

const anyCount = (): CountFilter => ({ value: '', orMore: false });
const countRecord = <K extends string>(ids: readonly K[]) =>
	Object.fromEntries(ids.map((id) => [id, anyCount()])) as Record<K, CountFilter>;

export const emptyStelliumFilter = (id: number): StelliumFilter => ({
	id,
	size: '',
	kind: 'chain',
	sign: '',
	house: '',
	required: []
});

export function emptyFactFilters(): FactFilters {
	return {
		stelliums: [emptyStelliumFilter(1)],
		hemispheres: [],
		quadrants: [anyCount(), anyCount(), anyCount(), anyCount()],
		modality: countRecord(MODALITY_IDS),
		elements: countRecord(ELEMENT_IDS),
		houseGroups: countRecord(HOUSE_GROUP_IDS),
		aspects: countRecord(PTOLEMAIC_ASPECT_IDS),
		mercury: { phase: '', motion: '' },
		venus: { phase: '', motion: '' },
		lunarPhases: [],
		orientation: '',
		horizon: '',
		angular: [emptyAngularPlanetFilter(1)],
		unaspected: [],
		ruler: { system: 'modern', planet: '', sign: '', house: '' },
		dispositorTraditional: '',
		dispositorModern: ''
	};
}

const countActive = (filter: CountFilter) => filter.value !== '';
const recordActive = (record: Record<string, CountFilter>) =>
	Object.values(record).some(countActive);

export function factFiltersActive(filters: FactFilters): boolean {
	return (
		filters.stelliums.some((stellium) => stellium.size !== '') ||
		filters.hemispheres.length > 0 ||
		filters.quadrants.some(countActive) ||
		recordActive(filters.modality) ||
		recordActive(filters.elements) ||
		recordActive(filters.houseGroups) ||
		recordActive(filters.aspects) ||
		Boolean(filters.mercury.phase || filters.mercury.motion) ||
		Boolean(filters.venus.phase || filters.venus.motion) ||
		filters.lunarPhases.length > 0 ||
		filters.orientation !== '' ||
		filters.horizon !== '' ||
		filters.angular.some((filter) => filter.planet || filter.axis) ||
		filters.unaspected.length > 0 ||
		Boolean(filters.ruler.planet || filters.ruler.sign || filters.ruler.house) ||
		filters.dispositorTraditional !== '' ||
		filters.dispositorModern !== ''
	);
}

export function countMatches(count: number, filter: CountFilter, others: number[] = []): boolean {
	if (filter.value === '') return true;
	if (filter.value === 'dominant') return count > 0 && others.every((other) => count >= 2 * other);
	const expected = Number(filter.value);
	return filter.orMore ? count >= expected : count === expected;
}

function recordMatches(counts: Record<string, number>, filters: Record<string, CountFilter>) {
	return Object.entries(filters).every(([id, filter]) =>
		countMatches(
			counts[id] ?? 0,
			filter,
			Object.entries(counts)
				.filter(([other]) => other !== id)
				.map(([, value]) => value)
		)
	);
}

function stelliumMatches(facts: ChartFacts, filter: StelliumFilter): boolean {
	if (filter.size === '') return true;
	return facts.stelliums.some(
		(stellium) =>
			stellium.kind === filter.kind &&
			stellium.members.length >= Number(filter.size) &&
			(filter.kind !== 'sign' || filter.sign === '' || stellium.sign === Number(filter.sign)) &&
			(filter.kind !== 'house' || filter.house === '' || stellium.house === Number(filter.house)) &&
			filter.required.every((planet) => stellium.members.includes(planet))
	);
}

function innerPlanetMatches(
	facts: ChartFacts,
	body: 'mercury' | 'venus',
	phase: string | null,
	filter: InnerPlanetFilter
): boolean {
	if (filter.phase && phase !== filter.phase) return false;
	if (filter.motion && facts.bodies[body]?.motion !== filter.motion) return false;
	return true;
}

function horizonMatches(facts: ChartFacts, option: string): boolean {
	if (!option) return true;
	const sunAbove = facts.sun_horizon === 'above';
	const moonAbove = facts.moon_horizon === 'above';
	if (facts.sun_horizon === null || facts.moon_horizon === null) return false;
	switch (option) {
		case 'both_above':
			return sunAbove && moonAbove;
		case 'sun_above_moon_below':
			return sunAbove && !moonAbove;
		case 'both_below':
			return !sunAbove && !moonAbove;
		case 'sun_below_moon_above':
			return !sunAbove && moonAbove;
		default:
			return true;
	}
}

function angularMatches(facts: ChartFacts, filter: AngularPlanetFilter): boolean {
	if (!filter.planet && !filter.axis) return true;
	return facts.angular_planets.some(
		(entry) =>
			(!filter.planet || entry.body === filter.planet) &&
			(!filter.axis || entry.axis === filter.axis)
	);
}

function rulerMatches(facts: ChartFacts, filter: FactFilters['ruler']): boolean {
	if (!filter.planet && !filter.sign && !filter.house) return true;
	const ruler = facts.chart_ruler[filter.system];
	if (filter.planet && ruler !== filter.planet) return false;
	const body = facts.bodies[ruler];
	if (filter.sign && body?.sign !== Number(filter.sign)) return false;
	if (filter.house && body?.house !== Number(filter.house)) return false;
	return true;
}

function dispositorMatches(
	outcome: ChartFacts['final_dispositors']['modern'],
	filter: string
): boolean {
	if (!filter) return true;
	if (!outcome) return false;
	if (filter === 'none') return outcome.status === 'none';
	return outcome.status === 'single' && outcome.body === filter;
}

/** Whether a chart's facts satisfy every active fact filter. Charts without facts only pass
 *  when no fact filter is active. */
export function factFiltersMatch(
	facts: ChartFacts | null | undefined,
	filters: FactFilters
): boolean {
	if (!factFiltersActive(filters)) return true;
	if (!facts) return false;
	const { distribution } = facts;
	return (
		filters.stelliums.every((filter) => stelliumMatches(facts, filter)) &&
		filters.hemispheres.every(
			(id) =>
				distribution.placed > 0 &&
				distribution[id as (typeof HEMISPHERE_IDS)[number]] === distribution.placed
		) &&
		filters.quadrants.every((filter, index) =>
			countMatches(distribution.quadrants[index] ?? 0, filter)
		) &&
		recordMatches(facts.modality_counts, filters.modality) &&
		recordMatches(facts.element_counts, filters.elements) &&
		recordMatches(facts.house_group_counts, filters.houseGroups) &&
		recordMatches(facts.aspect_counts, filters.aspects) &&
		innerPlanetMatches(facts, 'mercury', facts.mercury_phase, filters.mercury) &&
		innerPlanetMatches(facts, 'venus', facts.venus_phase, filters.venus) &&
		(filters.lunarPhases.length === 0 ||
			filters.lunarPhases.includes(facts.lunar_cycle_phase ?? '')) &&
		(!filters.orientation || facts.orientation.balance === filters.orientation) &&
		horizonMatches(facts, filters.horizon) &&
		filters.angular.every((filter) => angularMatches(facts, filter)) &&
		filters.unaspected.every((planet) => facts.unaspected.includes(planet)) &&
		rulerMatches(facts, filters.ruler) &&
		dispositorMatches(facts.final_dispositors.traditional, filters.dispositorTraditional) &&
		dispositorMatches(facts.final_dispositors.modern, filters.dispositorModern)
	);
}
