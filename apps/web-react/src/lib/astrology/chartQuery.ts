import type { AppChart } from '@/lib/tauri/chartPayload';
import { isBaseChart, type ChartForest } from '@/lib/chartHierarchy';
import { BASE_CHART_TYPE_IDS, chartTypeId } from '@/lib/chartTypes';
import { parsedChartDate } from '@/lib/chartDateTime';
import { degreeInSign, signIndex, type ChartSearchMetadata } from './chartSearch';
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
export type AspectFilter = { id: number; left: string; aspect: string; right: string };
export const DATE_PART_IDS = ['day', 'month', 'year', 'hour', 'minute', 'second'] as const;
export type DatePartId = (typeof DATE_PART_IDS)[number];

export interface ChartQuery {
	/** Chart type ids (see `CHART_TYPE_OPTIONS`); base and derived ids may be mixed. */
	types: string[];
	text: string;
	tag: string;
	location: string;
	date: Record<DatePartId, string>;
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
	right: ''
});

export function emptyChartQuery(): ChartQuery {
	return {
		types: [],
		text: '',
		tag: '',
		location: '',
		date: Object.fromEntries(DATE_PART_IDS.map((id) => [id, ''])) as Record<DatePartId, string>,
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
		query.text.trim() || query.tag.trim() || query.location.trim() || !isAnyRecord(query.date)
	);
}

export function astrologyQueryActive(query: ChartQuery): boolean {
	return (
		Object.values(query.planets).some((filter) => !isAnyRecord(filter)) ||
		query.aspects.some((filter) => filter.left || filter.aspect || filter.right) ||
		Object.values(query.houses).some((filter) => !isAnyRecord(filter)) ||
		query.shapes.length > 0 ||
		query.configurations.length > 0 ||
		factFiltersActive(query.facts)
	);
}

const includesFolded = (value: string | undefined, query: string) =>
	(value ?? '').toLocaleLowerCase().includes(query);

/** Archive metadata (full text, tags, location, date): applies to every chart. */
export function chartMetadataMatches(
	chart: AppChart,
	query: ChartQuery,
	typeLabel: (chart: AppChart) => string
): boolean {
	const tag = query.tag.trim().toLocaleLowerCase();
	if (tag && !(chart.tags ?? []).some((value) => value.toLocaleLowerCase().includes(tag)))
		return false;
	const location = query.location.trim().toLocaleLowerCase();
	if (location && !includesFolded(chart.location, location)) return false;
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
	if (!isAnyRecord(query.date)) {
		const date = parsedChartDate(chart.dateTime);
		if (!date) return false;
		const actual: Record<DatePartId, number> = {
			day: date.getDate(),
			month: date.getMonth() + 1,
			year: date.getFullYear(),
			hour: date.getHours(),
			minute: date.getMinutes(),
			second: date.getSeconds()
		};
		if (DATE_PART_IDS.some((id) => query.date[id] && actual[id] !== Number(query.date[id])))
			return false;
	}
	return true;
}

function aspectFilterMatches(metadata: ChartSearchMetadata, filter: AspectFilter): boolean {
	if (!filter.left && !filter.aspect && !filter.right) return true;
	return metadata.aspects.some((aspect) => {
		if (filter.aspect && aspect.type !== filter.aspect) return false;
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
		if (filter.sign && signIndex(cusp) !== Number(filter.sign)) return false;
		if (filter.degree && degreeInSign(cusp) !== Number(filter.degree)) return false;
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
 * - astrological filters and base types select parent (base) charts;
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
			if (!astrologyActive && baseTypes.length === 0 && childMatches(root))
				rows.push({ key: root.id, chart: root });
			continue;
		}
		if (baseTypes.length > 0 && !baseTypes.includes(chartTypeId(root) ?? '')) continue;
		if (astrologyActive && !chartAstrologyMatches(root, options.metadataFor(root), query)) continue;
		const children = forest.childrenByParent.get(root.id) ?? [];
		if (derivedTypes.length === 0 && !metadataActive) {
			rows.push({ key: root.id, chart: root, children: childRows(root, children) });
			continue;
		}
		const matching = children.filter(childMatches);
		if (matching.length > 0) {
			rows.push({ key: root.id, chart: root, children: childRows(root, matching) });
			autoExpanded[root.id] = true;
		} else if (derivedTypes.length === 0 && metadataOk(root)) {
			rows.push({ key: root.id, chart: root, children: childRows(root, children) });
		}
	}
	return { rows, autoExpanded };
}
