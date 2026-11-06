import type { AppChart } from '@/lib/tauri/chartPayload';
import { isBaseChart, type ChartForest } from '@/lib/chartHierarchy';
import { BASE_CHART_TYPE_IDS, chartTypeId } from '@/lib/chartTypes';
import { chartLocalParts, chartTimeZone } from '@/lib/chartDateTime';
import type { ChartSearchMetadata } from './chartSearch';
import { degreeOrdinalInSign, signIndexOf } from './zodiac';
import {
	emptyFactFilters,
	factFiltersActive,
	factFiltersMatch,
	FACT_PLANET_IDS,
	type FactFilters,
	type FactPlanetId
} from './factFilters';

/** Chart search state shared by every chart list that filters (the Open view today). Empty
 *  string means "any" throughout. Pure: no React, no Tauri. */

export type PlanetFilter = { sign: string; degree: string; house: string; motion: string };
export type HouseFilter = { sign: string; degree: string };
export type AspectFilter = {
	id: number;
	left: string;
	aspect: string;
	right: string;
	dynamics: '' | 'applying' | 'exact' | 'separating';
	phase: '' | 'waxing' | 'waning';
};
export const DATE_PART_IDS = ['day', 'month', 'year', 'hour', 'minute', 'second'] as const;
export type DatePartId = (typeof DATE_PART_IDS)[number];
export type DateParts = Record<DatePartId, string>;
const emptyDateParts = (): DateParts =>
	Object.fromEntries(DATE_PART_IDS.map((id) => [id, ''])) as DateParts;

export interface ChartQuery {
	/** Chart type ids (see `CHART_TYPE_OPTIONS`); base and derived ids may be mixed. */
	types: string[];
	text: string;
	tag: string;
	location: string;
	date: DateParts;
	dateMode: 'fixed' | 'range';
	dateEnd: DateParts;
	planets: Record<FactPlanetId, PlanetFilter>;
	aspects: AspectFilter[];
	houses: Record<number, HouseFilter>;
	shapes: string[];
	configurations: string[];
	facts: FactFilters;
}

export const emptyPlanetFilter = (): PlanetFilter => ({
	sign: '',
	degree: '',
	house: '',
	motion: ''
});
export const emptyHouseFilter = (): HouseFilter => ({ sign: '', degree: '' });
export const emptyAspectFilter = (id: number): AspectFilter => ({
	id,
	left: '',
	aspect: '',
	right: '',
	dynamics: '',
	phase: ''
});

export function emptyChartQuery(): ChartQuery {
	return {
		types: [],
		text: '',
		tag: '',
		location: '',
		date: emptyDateParts(),
		dateMode: 'fixed',
		dateEnd: emptyDateParts(),
		planets: Object.fromEntries(FACT_PLANET_IDS.map((id) => [id, emptyPlanetFilter()])) as Record<
			FactPlanetId,
			PlanetFilter
		>,
		aspects: [emptyAspectFilter(1)],
		houses: Object.fromEntries(
			Array.from({ length: 12 }, (_, index) => [index + 1, emptyHouseFilter()])
		) as Record<number, HouseFilter>,
		shapes: [],
		configurations: [],
		facts: emptyFactFilters()
	};
}

const isAnyRecord = (record: Record<string, string>) => Object.values(record).every((v) => !v);

export function metadataQueryActive(query: ChartQuery): boolean {
	return Boolean(
		query.text.trim() ||
		splitListQuery(query.tag).length ||
		splitListQuery(query.location).length ||
		dateQueryActive(query)
	);
}

export function astrologyQueryActive(query: ChartQuery): boolean {
	return (
		Object.values(query.planets).some((filter) => !isAnyRecord(filter)) ||
		query.aspects.some(
			(filter) => filter.left || filter.aspect || filter.right || filter.dynamics || filter.phase
		) ||
		Object.values(query.houses).some((filter) => !isAnyRecord(filter)) ||
		query.shapes.length > 0 ||
		query.configurations.length > 0 ||
		factFiltersActive(query.facts)
	);
}

/** Nonempty comma-separated terms, preserving the user's spelling. */
export function splitListQuery(query: string): string[] {
	return query
		.split(',')
		.map((term) => term.trim())
		.filter(Boolean);
}

export function toggleTagInQuery(query: string, tag: string): string {
	const terms = splitListQuery(query);
	const same = (term: string) => term.toLocaleLowerCase() === tag.toLocaleLowerCase();
	return (terms.some(same) ? terms.filter((term) => !same(term)) : [...terms, tag]).join(', ');
}

function dateQueryActive(query: ChartQuery): boolean {
	return query.dateMode === 'range'
		? Boolean(query.date.year || query.dateEnd.year)
		: !isAnyRecord(query.date);
}

// Compare wall-clock fields in UTC so the device's zone and DST never affect the range.
function wallTimestamp(parts: Record<DatePartId, number>): number {
	const date = new Date(0);
	date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
	date.setUTCHours(parts.hour, parts.minute, parts.second, 0);
	return date.getTime();
}

function dateBound(parts: DateParts, edge: 'start' | 'end'): number | null {
	if (!parts.year) return null;
	const end = edge === 'end';
	const year = Number(parts.year);
	const month = parts.month ? Number(parts.month) : end ? 12 : 1;
	const last = new Date(0);
	last.setUTCFullYear(year, month, 0);
	const lastDay = last.getUTCDate();
	return wallTimestamp({
		year,
		month,
		day: parts.day ? Math.min(Number(parts.day), lastDay) : end ? lastDay : 1,
		hour: parts.hour ? Number(parts.hour) : end ? 23 : 0,
		minute: parts.minute ? Number(parts.minute) : end ? 59 : 0,
		second: parts.second ? Number(parts.second) : end ? 59 : 0
	});
}

/** Archive metadata (full text, tags, location, date): applies to every chart. */
export function chartMetadataMatches(
	chart: AppChart,
	query: ChartQuery,
	typeLabel: (chart: AppChart) => string
): boolean {
	const tags = splitListQuery(query.tag).map((term) => term.toLocaleLowerCase());
	if (
		tags.length &&
		!(chart.tags ?? []).some((value) =>
			tags.some((term) => value.toLocaleLowerCase().includes(term))
		)
	)
		return false;
	const locations = splitListQuery(query.location).map((term) => term.toLocaleLowerCase());
	if (
		locations.length &&
		!locations.some((term) => (chart.location ?? '').toLocaleLowerCase().includes(term))
	)
		return false;
	const text = query.text.trim().toLocaleLowerCase();
	if (text) {
		const searchable = [
			chart.name,
			chart.location,
			chart.dateTime,
			typeLabel(chart),
			...(chart.tags ?? [])
		]
			.join(' ')
			.toLocaleLowerCase();
		if (!searchable.includes(text)) return false;
	}
	if (dateQueryActive(query)) {
		// Compared as local time at the event's place.
		const local = chartLocalParts(chart.dateTime, chartTimeZone(chart));
		if (!local) return false;
		const actual: Record<DatePartId, number> = {
			day: local.day,
			month: local.month + 1,
			year: local.year,
			hour: local.hour,
			minute: local.minute,
			second: local.second
		};
		if (query.dateMode === 'range') {
			const timestamp = wallTimestamp(actual);
			const from = dateBound(query.date, 'start');
			const to = dateBound(query.dateEnd, 'end');
			if ((from !== null && timestamp < from) || (to !== null && timestamp > to)) return false;
		} else if (DATE_PART_IDS.some((id) => query.date[id] && actual[id] !== Number(query.date[id])))
			return false;
	}
	return true;
}

function aspectFilterMatches(metadata: ChartSearchMetadata, filter: AspectFilter): boolean {
	if (!filter.left && !filter.aspect && !filter.right && !filter.dynamics && !filter.phase)
		return true;
	return metadata.aspects.some((aspect) => {
		if (filter.aspect && aspect.type !== filter.aspect) return false;
		if (filter.dynamics && aspect[filter.dynamics] !== true) return false;
		if (filter.phase && aspect.phase !== filter.phase) return false;
		const direct =
			(!filter.left || aspect.from === filter.left) &&
			(!filter.right || aspect.to === filter.right);
		const reverse =
			(!filter.left || aspect.to === filter.left) &&
			(!filter.right || aspect.from === filter.right);
		return direct || reverse;
	});
}

/** Astrological filters, evaluated within one chart (meaningful for base charts only). */
export function chartAstrologyMatches(
	chart: AppChart,
	metadata: ChartSearchMetadata,
	query: ChartQuery
): boolean {
	for (const planet of FACT_PLANET_IDS) {
		const filter = query.planets[planet];
		if (isAnyRecord(filter)) continue;
		const body = chart.computed?.facts?.bodies[planet];
		if (!body) return false;
		if (filter.sign && body.sign !== Number(filter.sign)) return false;
		// Degree options are 1-based (1st … 30th degree of the sign).
		if (filter.degree && Math.floor(body.degree_in_sign) + 1 !== Number(filter.degree))
			return false;
		if (filter.house && body.house !== Number(filter.house)) return false;
		if (filter.motion && body.motion !== filter.motion) return false;
	}
	if (!query.aspects.every((filter) => aspectFilterMatches(metadata, filter))) return false;
	for (let house = 1; house <= 12; house += 1) {
		const filter = query.houses[house];
		if (!filter || isAnyRecord(filter)) continue;
		const cusp = metadata.houseCusps[house - 1];
		if (cusp === undefined) return false;
		if (filter.sign && signIndexOf(cusp) !== Number(filter.sign)) return false;
		if (filter.degree && degreeOrdinalInSign(cusp) !== Number(filter.degree)) return false;
	}
	if (query.shapes.length > 0 && !query.shapes.some((shape) => metadata.shapes.has(shape)))
		return false;
	if (
		query.configurations.length > 0 &&
		!query.configurations.some((configuration) => metadata.configurations.has(configuration))
	)
		return false;
	return factFiltersMatch(chart.computed?.facts, query.facts);
}

/** One row of a chart tree: a base chart with its derived charts/analyses, or one of those
 *  children (keyed by parent, since a two-parent analysis appears under both). */
export type ChartTreeRow = { key: string; chart: AppChart; children?: ChartTreeRow[] };

export interface ChartTreeFilterResult {
	rows: ChartTreeRow[];
	/** Row keys of parents opened because a child-level filter matched their children. */
	autoExpanded: Record<string, boolean>;
}

/**
 * Filter a chart forest:
 * - astrological filters select parent (base) charts; base and derived types form a union;
 * - derived types and metadata filters select children — only matching children are shown and
 *   their parents are opened; a parent whose own metadata matches keeps all children, closed;
 * - derived charts whose parents are missing are listed at the top level, metadata only.
 */
export function filterChartTree(
	forest: ChartForest,
	query: ChartQuery,
	options: {
		metadataFor: (chart: AppChart) => ChartSearchMetadata;
		typeLabel: (chart: AppChart) => string;
	}
): ChartTreeFilterResult {
	const baseTypes = query.types.filter((id) => BASE_CHART_TYPE_IDS.has(id));
	const derivedTypes = query.types.filter((id) => !BASE_CHART_TYPE_IDS.has(id));
	const astrologyActive = astrologyQueryActive(query);
	const metadataActive = metadataQueryActive(query);
	const metadataOk = (chart: AppChart) => chartMetadataMatches(chart, query, options.typeLabel);
	const childMatches = (child: AppChart) =>
		(derivedTypes.length === 0 || derivedTypes.includes(chartTypeId(child) ?? '')) &&
		metadataOk(child);
	const childRows = (parent: AppChart, children: AppChart[]) =>
		children.map((child) => ({ key: `${parent.id}/${child.id}`, chart: child }));

	const rows: ChartTreeRow[] = [];
	const autoExpanded: Record<string, boolean> = {};
	for (const root of forest.roots) {
		if (!isBaseChart(root)) {
			if (
				!astrologyActive &&
				(baseTypes.length === 0 || derivedTypes.length > 0) &&
				childMatches(root)
			)
				rows.push({ key: root.id, chart: root });
			continue;
		}
		const baseTypeMatches = baseTypes.includes(chartTypeId(root) ?? '');
		if (baseTypes.length > 0 && derivedTypes.length === 0 && !baseTypeMatches) continue;
		if (astrologyActive && !chartAstrologyMatches(root, options.metadataFor(root), query)) continue;
		const children = forest.childrenByParent.get(root.id) ?? [];
		if ((derivedTypes.length === 0 || baseTypeMatches) && !metadataActive) {
			rows.push({ key: root.id, chart: root, children: childRows(root, children) });
			continue;
		}
		const matching = children.filter(childMatches);
		if (matching.length > 0) {
			rows.push({ key: root.id, chart: root, children: childRows(root, matching) });
			autoExpanded[root.id] = true;
		} else if ((derivedTypes.length === 0 || baseTypeMatches) && metadataOk(root)) {
			rows.push({ key: root.id, chart: root, children: childRows(root, children) });
		}
	}
	return { rows, autoExpanded };
}
