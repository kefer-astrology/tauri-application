import type { CheckListItem, FilterOption } from '@/app/views/data/filter-controls';
import { DOMAIN_CATALOG } from '@/lib/astrology/domainCatalog';
import { FACT_PLANET_IDS } from '@/lib/astrology/factFilters';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Option lists shared by the chart filter sections. Values match `ChartQuery` / `FactFilters`. */

export const planetOptions = (
	t: Translate,
	ids: readonly string[] = FACT_PLANET_IDS
): FilterOption[] => ids.map((id) => ({ value: id, label: t(`planet_${id}`) }));

/** Sign index (`'0'` = Aries … `'11'` = Pisces) → localized sign name. */
export const signOptions = (t: Translate): FilterOption[] =>
	(DOMAIN_CATALOG?.model.signs ?? []).map((sign, index) => ({
		value: String(index),
		label: t(`open_sign_${sign.id}`)
	}));

export const houseOptions = (): FilterOption[] =>
	Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}.` }));

/** 1-based degree within a sign. */
export const degreeOptions = (): FilterOption[] =>
	Array.from({ length: 30 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}°` }));

export const motionOptions = (t: Translate, withStationary = true): FilterOption[] => [
	{ value: 'direct', label: t('open_motion_direct') },
	...(withStationary ? [{ value: 'stationary', label: t('open_motion_stationary') }] : []),
	{ value: 'retrograde', label: t('open_motion_retrograde') }
];

/** Planets, chart angles and lunar nodes available for aspect conditions. */
export const aspectObjectOptions = (t: Translate): FilterOption[] => [
	...planetOptions(t),
	...[
		['asc', 'point_asc'],
		['desc', 'point_dsc'],
		['mc', 'point_mc'],
		['ic', 'point_ic'],
		['north_node', 'point_north_node'],
		['south_node', 'point_south_node']
	].map(([value, key]) => ({ value: value!, label: t(key!) }))
];

/** Presentation order and nesting for the chart-shape checklist. Values remain Rust catalog IDs. */
export function shapeFilterOptions(t: Translate): CheckListItem[] {
	const definitions = new Map((DOMAIN_CATALOG?.shapes ?? []).map((item) => [item.id, item]));
	const layout: Array<{ id: string; indent: number; heading?: boolean; labelKey?: string }> = [
		{ id: 'bundle', indent: 0 },
		{ id: 'bowl', indent: 0 },
		...['east', 'west', 'day', 'night'].map((side) => ({ id: `bowl_${side}`, indent: 1 })),
		{ id: 'bowl_leader', indent: 1, heading: true },
		...FACT_PLANET_IDS.map((id) => ({ id: `bowl_leader_${id}`, indent: 2 })),
		{ id: 'bucket', indent: 0 },
		...['moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map((id) => ({
			id: `bucket_${id}`,
			indent: 1,
			labelKey: `open_shape_bucket_${id}`
		})),
		{ id: 'seesaw', indent: 0 },
		{ id: 'locomotive', indent: 0 },
		{ id: 'locomotive_leader', indent: 1, heading: true },
		...FACT_PLANET_IDS.map((id) => ({ id: `locomotive_leader_${id}`, indent: 2 })),
		{ id: 'splash', indent: 0 },
		{ id: 'shifted_center', indent: 0 }
	];
	return layout.flatMap((item) => {
		const definition = definitions.get(item.id);
		return definition
			? [
					{
						value: definition.id,
						label: t(item.labelKey ?? definition.translation_key),
						indent: item.indent,
						heading: item.heading
					}
				]
			: [];
	});
}

/** Configuration parents followed immediately by their selectable sign/element variants. */
export function configurationFilterOptions(t: Translate): CheckListItem[] {
	const definitions = DOMAIN_CATALOG?.configurations ?? [];
	return [
		't_square',
		'grand_cross',
		'grand_trine',
		'hexagram',
		'mystic_rectangle',
		'pentagram',
		'double_quincunx',
		'kite',
		'double_biquintile'
	].flatMap((id) => {
		const parent = definitions.find((item) => item.id === id);
		if (!parent) return [];
		return [parent, ...definitions.filter((item) => item.parent_id === id)].map((item) => ({
			value: item.id,
			label: t(
				item.id.startsWith('grand_trine_') || item.id.startsWith('kite_')
					? `open_configuration_${item.id}`
					: item.translation_key
			),
			indent: item.parent_id ? 1 : 0
		}));
	});
}
