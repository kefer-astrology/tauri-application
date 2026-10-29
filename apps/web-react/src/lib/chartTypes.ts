import type { AppChart } from '@/lib/tauri/chartPayload';

/** One selectable chart type in filters and labels. `group` entries are headings only. */
export interface ChartTypeOption {
	id: string;
	/** `AppChart.chartType` values (upper case) that map to this option. */
	values: readonly string[];
	labelKey: string;
	/** When set, also requires `chart.synastry?.method` to match — distinguishes the
	 *  synastry-family sub-types, which all share the same `SYNASTRY` chart type string. */
	method?: string;
	indent?: number;
	group?: boolean;
}

export const CHART_TYPE_OPTIONS: readonly ChartTypeOption[] = [
	{ id: 'base_group', values: [], labelKey: 'open_type_group_base', group: true },
	{ id: 'natal', values: ['NATAL'], labelKey: 'new_type_radix' },
	{ id: 'event', values: ['EVENT'], labelKey: 'new_type_event' },
	{ id: 'horary', values: ['HORARY'], labelKey: 'new_type_horary' },
	{ id: 'derived_group', values: [], labelKey: 'open_type_group_derived', group: true },
	{ id: 'transit', values: ['TRANSIT'], labelKey: 'open_type_transit' },
	{
		id: 'primary_direction',
		values: ['PRIMARY_DIRECTION', 'PRIMARY_DIRECTIONS'],
		labelKey: 'open_type_primary_direction'
	},
	{
		id: 'secondary_direction',
		values: ['SECONDARY_DIRECTION', 'SECONDARY_DIRECTIONS'],
		labelKey: 'open_type_secondary_direction'
	},
	{ id: 'solar', values: ['SOLAR', 'SOLAR_RETURN'], labelKey: 'open_type_solar' },
	{
		id: 'relative',
		values: ['RELATIVE', 'RELATIVE_RETURN', 'RELATIV'],
		labelKey: 'revolution_kind_relative'
	},
	{ id: 'lunar', values: ['LUNAR', 'LUNAR_RETURN'], labelKey: 'open_type_lunar' },
	{ id: 'synastry_group', values: [], labelKey: 'open_type_synastry', group: true },
	{
		id: 'synastry',
		values: ['SYNASTRY'],
		labelKey: 'synastry_type_synastry',
		method: 'synastry',
		indent: 1
	},
	{
		id: 'synastry_progressed',
		values: ['SYNASTRY'],
		labelKey: 'synastry_type_progressed-synastry',
		method: 'progressed-synastry',
		indent: 1
	},
	{
		id: 'synastry_draconic',
		values: ['SYNASTRY'],
		labelKey: 'synastry_type_draconic-synastry',
		method: 'draconic-synastry',
		indent: 1
	}
];

/** Base chart type ids; every other type id is a derived chart or analysis. */
export const BASE_CHART_TYPE_IDS: ReadonlySet<string> = new Set(['natal', 'event', 'horary']);

export function chartTypeId(chart: AppChart): string | null {
	const value = chart.chartType?.trim().toUpperCase();
	return (
		CHART_TYPE_OPTIONS.find((option) => {
			if (option.group || !option.values.includes(value)) return false;
			if (option.method) return chart.synastry?.method === option.method;
			return true;
		})?.id ?? null
	);
}

export function chartTypeLabel(chart: AppChart, t: (key: string) => string): string {
	const id = chartTypeId(chart);
	const option = CHART_TYPE_OPTIONS.find((candidate) => candidate.id === id);
	return option ? t(option.labelKey) : chart.chartType;
}
