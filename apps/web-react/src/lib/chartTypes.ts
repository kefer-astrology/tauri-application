import type { AppChart } from '@/lib/tauri/chartPayload';

/** One selectable chart type in filters and labels. */
export interface ChartTypeOption {
	id: string;
	section: 'base' | 'derived';
	/** `AppChart.chartType` values (upper case) that map to this option. */
	values: readonly string[];
	labelKey: string;
	/** When set, also requires `chart.synastry?.method` to match — distinguishes the
	 *  synastry-family sub-types, which all share the same `SYNASTRY` chart type string. */
	method?: string;
}

export const CHART_TYPE_OPTIONS: readonly ChartTypeOption[] = [
	{ id: 'natal', section: 'base', values: ['NATAL'], labelKey: 'new_type_radix' },
	{ id: 'event', section: 'base', values: ['EVENT'], labelKey: 'new_type_event' },
	{ id: 'horary', section: 'base', values: ['HORARY'], labelKey: 'new_type_horary' },
	{ id: 'transit', section: 'derived', values: ['TRANSIT'], labelKey: 'open_type_transit' },
	{
		id: 'primary_direction',
		section: 'derived',
		values: ['PRIMARY_DIRECTION', 'PRIMARY_DIRECTIONS'],
		labelKey: 'open_type_primary_direction'
	},
	{
		id: 'secondary_direction',
		section: 'derived',
		values: ['SECONDARY_DIRECTION', 'SECONDARY_DIRECTIONS'],
		labelKey: 'open_type_secondary_direction'
	},
	{
		id: 'solar',
		section: 'derived',
		values: ['SOLAR', 'SOLAR_RETURN'],
		labelKey: 'open_type_solar'
	},
	{
		id: 'lunar',
		section: 'derived',
		values: ['LUNAR', 'LUNAR_RETURN'],
		labelKey: 'open_type_lunar'
	},
	{
		id: 'relative',
		section: 'derived',
		values: ['RELATIVE', 'RELATIVE_RETURN', 'RELATIV'],
		labelKey: 'revolution_kind_relative'
	},
	...(
		[
			['synastry', 'synastry'],
			['composite', 'composite'],
			['davison', 'davison'],
			['coalescent', 'coalescent']
		] as const
	).map(([id, method]) => ({
		id: id === 'synastry' ? 'synastry' : `synastry_${id}`,
		section: 'derived' as const,
		values: ['SYNASTRY'],
		labelKey: `synastry_type_${method}`,
		method
	})),
	...(['progressed-synastry', 'progressed-composite', 'draconic-synastry'] as const).map(
		(method) => ({
			id: `synastry_${method.replace('-synastry', '').replace('-', '_')}`,
			section: 'derived' as const,
			values: ['SYNASTRY'],
			labelKey: `synastry_type_${method}`,
			method
		})
	)
];

/** Base chart type ids; every other type id is a derived chart or analysis. */
export const BASE_CHART_TYPE_IDS: ReadonlySet<string> = new Set(['natal', 'event', 'horary']);

export function chartTypeId(chart: AppChart): string | null {
	const value = chart.chartType?.trim().toUpperCase();
	return (
		CHART_TYPE_OPTIONS.find((option) => {
			if (!option.values.includes(value)) return false;
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
