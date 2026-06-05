export type ObservableObjectCategory =
	| 'luminaries'
	| 'personal_planets'
	| 'social_outer_planets'
	| 'angles'
	| 'lunar_nodes'
	| 'calculated_points'
	| 'asteroids';

export interface ObservableObjectDefinition {
	id: string;
	labelKey?: string;
	fallbackLabel: string;
	icon: string;
	category: ObservableObjectCategory;
}

type ObservableObjectCategoryLabel = {
	labelKey?: string;
	fallbackLabel: string;
};

// Keep these canonical IDs aligned with backend payloads and Rust chart
// `observable_objects` handling.
export const OBSERVABLE_OBJECTS: ObservableObjectDefinition[] = [
	{ id: 'sun', labelKey: 'planet_sun', fallbackLabel: 'Sun', icon: '☉', category: 'luminaries' },
	{ id: 'moon', labelKey: 'planet_moon', fallbackLabel: 'Moon', icon: '☽', category: 'luminaries' },
	{ id: 'mercury', labelKey: 'planet_mercury', fallbackLabel: 'Mercury', icon: '☿', category: 'personal_planets' },
	{ id: 'venus', labelKey: 'planet_venus', fallbackLabel: 'Venus', icon: '♀', category: 'personal_planets' },
	{ id: 'mars', labelKey: 'planet_mars', fallbackLabel: 'Mars', icon: '♂', category: 'personal_planets' },
	{ id: 'jupiter', labelKey: 'planet_jupiter', fallbackLabel: 'Jupiter', icon: '♃', category: 'social_outer_planets' },
	{ id: 'saturn', labelKey: 'planet_saturn', fallbackLabel: 'Saturn', icon: '♄', category: 'social_outer_planets' },
	{ id: 'uranus', labelKey: 'planet_uranus', fallbackLabel: 'Uranus', icon: '♅', category: 'social_outer_planets' },
	{ id: 'neptune', labelKey: 'planet_neptune', fallbackLabel: 'Neptune', icon: '♆', category: 'social_outer_planets' },
	{ id: 'pluto', labelKey: 'planet_pluto', fallbackLabel: 'Pluto', icon: '♇', category: 'social_outer_planets' },
	{ id: 'asc', labelKey: 'point_asc', fallbackLabel: 'ASC', icon: 'Asc', category: 'angles' },
	{ id: 'mc', labelKey: 'point_mc', fallbackLabel: 'MC', icon: 'MC', category: 'angles' },
	{ id: 'desc', labelKey: 'point_dsc', fallbackLabel: 'DSC', icon: 'Dsc', category: 'angles' },
	{ id: 'ic', labelKey: 'point_ic', fallbackLabel: 'IC', icon: 'IC', category: 'angles' },
	{ id: 'north_node', labelKey: 'point_north_node', fallbackLabel: 'North Node', icon: '☊', category: 'lunar_nodes' },
	{ id: 'south_node', labelKey: 'point_south_node', fallbackLabel: 'South Node', icon: '☋', category: 'lunar_nodes' },
	{ id: 'true_north_node', labelKey: 'point_true_north_node', fallbackLabel: 'True North Node', icon: '☊', category: 'lunar_nodes' },
	{ id: 'true_south_node', labelKey: 'point_true_south_node', fallbackLabel: 'True South Node', icon: '☋', category: 'lunar_nodes' },
	{ id: 'lilith', labelKey: 'point_lilith', fallbackLabel: 'Lilith', icon: '⚸', category: 'calculated_points' },
	{ id: 'chiron', labelKey: 'point_chiron', fallbackLabel: 'Chiron', icon: '⚷', category: 'calculated_points' },
	{ id: 'ceres', labelKey: 'point_ceres', fallbackLabel: 'Ceres', icon: 'Ce', category: 'asteroids' },
	{ id: 'pallas', labelKey: 'point_pallas', fallbackLabel: 'Pallas', icon: 'Pa', category: 'asteroids' },
	{ id: 'juno', labelKey: 'point_juno', fallbackLabel: 'Juno', icon: 'Ju', category: 'asteroids' },
	{ id: 'vesta', labelKey: 'point_vesta', fallbackLabel: 'Vesta', icon: 'Ve', category: 'asteroids' }
];

export const DEFAULT_OBSERVABLE_OBJECT_IDS = OBSERVABLE_OBJECTS.map((item) => item.id);
export const DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS = OBSERVABLE_OBJECTS.filter(
	(item) => item.category !== 'asteroids' && item.id !== 'true_north_node' && item.id !== 'true_south_node'
).map((item) => item.id);

export const OBSERVABLE_OBJECT_CATEGORY_LABELS: Record<
	ObservableObjectCategory,
	ObservableObjectCategoryLabel
> = {
	luminaries: { labelKey: 'transits_group_luminaries', fallbackLabel: 'Luminaries' },
	personal_planets: { labelKey: 'transits_group_personal_planets', fallbackLabel: 'Personal Planets' },
	social_outer_planets: { labelKey: 'transits_group_social', fallbackLabel: 'Social and Outer Planets' },
	angles: { labelKey: 'observable_category_angles', fallbackLabel: 'Angles' },
	lunar_nodes: { labelKey: 'transits_group_lunar_nodes', fallbackLabel: 'Lunar Nodes' },
	calculated_points: { labelKey: 'observable_category_calculated_points', fallbackLabel: 'Calculated Points' },
	asteroids: { labelKey: 'transits_group_asteroids', fallbackLabel: 'Asteroids' }
};

export function getObservableObjectLabel(
	item: ObservableObjectDefinition,
	t: (key: string, options?: Record<string, unknown>) => string
): string {
	return item.labelKey ? t(item.labelKey, { defaultValue: item.fallbackLabel }) : item.fallbackLabel;
}

export function getObservableCategoryLabel(
	category: ObservableObjectCategory,
	t: (key: string, options?: Record<string, unknown>) => string
): string {
	const meta = OBSERVABLE_OBJECT_CATEGORY_LABELS[category];
	return meta.labelKey ? t(meta.labelKey, { defaultValue: meta.fallbackLabel }) : meta.fallbackLabel;
}
