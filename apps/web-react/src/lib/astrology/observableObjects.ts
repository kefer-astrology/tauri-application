export type ObservableObjectCategory =
	| 'luminaries'
	| 'personal_planets'
	| 'social_outer_planets'
	| 'angles'
	| 'lunar_nodes'
	| 'calculated_points'
	| 'asteroids'
	| 'sensitive_points'
	| 'geocentric_nodes'
	| 'trans_neptunian'
	| 'fixed_stars'
	| 'hypothetical';

export type ObservableObjectStatus = 'available' | 'planned';

export interface ObservableObjectDefinition {
	id: string;
	labelKey?: string;
	fallbackLabel: string;
	altName?: string;
	icon: string;
	category: ObservableObjectCategory;
	/**
	 * 'available' bodies have a working backend computation path (swisseph and/or anise/JPL).
	 * 'planned' bodies are defined for discoverability/selection UI only — no backend computes
	 * them yet. Consumers must filter to 'available' when building a selectable/request pool,
	 * but should still display 'planned' entries, disabled, for discoverability.
	 */
	status: ObservableObjectStatus;
}

type ObservableObjectCategoryLabel = {
	labelKey?: string;
	fallbackLabel: string;
};

function fixedStar(name: string, altName?: string): ObservableObjectDefinition {
	const slug = name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
	return {
		id: `star_${slug}`,
		fallbackLabel: name,
		altName,
		icon: name.charAt(0),
		category: 'fixed_stars',
		status: 'planned'
	};
}

// Keep these canonical IDs aligned with backend payloads and Rust chart
// `observable_objects` handling.
export const OBSERVABLE_OBJECTS: ObservableObjectDefinition[] = [
	{
		id: 'sun',
		labelKey: 'planet_sun',
		fallbackLabel: 'Sun',
		icon: '☉',
		category: 'luminaries',
		status: 'available'
	},
	{
		id: 'moon',
		labelKey: 'planet_moon',
		fallbackLabel: 'Moon',
		icon: '☽',
		category: 'luminaries',
		status: 'available'
	},
	{
		id: 'mercury',
		labelKey: 'planet_mercury',
		fallbackLabel: 'Mercury',
		icon: '☿',
		category: 'personal_planets',
		status: 'available'
	},
	{
		id: 'venus',
		labelKey: 'planet_venus',
		fallbackLabel: 'Venus',
		icon: '♀',
		category: 'personal_planets',
		status: 'available'
	},
	{
		id: 'mars',
		labelKey: 'planet_mars',
		fallbackLabel: 'Mars',
		icon: '♂',
		category: 'personal_planets',
		status: 'available'
	},
	{
		id: 'jupiter',
		labelKey: 'planet_jupiter',
		fallbackLabel: 'Jupiter',
		icon: '♃',
		category: 'social_outer_planets',
		status: 'available'
	},
	{
		id: 'saturn',
		labelKey: 'planet_saturn',
		fallbackLabel: 'Saturn',
		icon: '♄',
		category: 'social_outer_planets',
		status: 'available'
	},
	{
		id: 'uranus',
		labelKey: 'planet_uranus',
		fallbackLabel: 'Uranus',
		icon: '♅',
		category: 'social_outer_planets',
		status: 'available'
	},
	{
		id: 'neptune',
		labelKey: 'planet_neptune',
		fallbackLabel: 'Neptune',
		icon: '♆',
		category: 'social_outer_planets',
		status: 'available'
	},
	{
		id: 'pluto',
		labelKey: 'planet_pluto',
		fallbackLabel: 'Pluto',
		icon: '♇',
		category: 'social_outer_planets',
		status: 'available'
	},
	{
		id: 'asc',
		labelKey: 'point_asc',
		fallbackLabel: 'ASC',
		icon: 'Asc',
		category: 'angles',
		status: 'available'
	},
	{
		id: 'mc',
		labelKey: 'point_mc',
		fallbackLabel: 'MC',
		icon: 'MC',
		category: 'angles',
		status: 'available'
	},
	{
		id: 'desc',
		labelKey: 'point_dsc',
		fallbackLabel: 'DSC',
		icon: 'Dsc',
		category: 'angles',
		status: 'available'
	},
	{
		id: 'ic',
		labelKey: 'point_ic',
		fallbackLabel: 'IC',
		icon: 'IC',
		category: 'angles',
		status: 'available'
	},
	{
		id: 'north_node',
		labelKey: 'point_north_node',
		fallbackLabel: 'North Node',
		icon: '☊',
		category: 'lunar_nodes',
		status: 'available'
	},
	{
		id: 'south_node',
		labelKey: 'point_south_node',
		fallbackLabel: 'South Node',
		icon: '☋',
		category: 'lunar_nodes',
		status: 'available'
	},
	{
		id: 'true_north_node',
		labelKey: 'point_true_north_node',
		fallbackLabel: 'True North Node',
		icon: '☊',
		category: 'lunar_nodes',
		status: 'available'
	},
	{
		id: 'true_south_node',
		labelKey: 'point_true_south_node',
		fallbackLabel: 'True South Node',
		icon: '☋',
		category: 'lunar_nodes',
		status: 'available'
	},
	{
		id: 'lilith',
		labelKey: 'point_lilith',
		fallbackLabel: 'Lilith',
		icon: '⚸',
		category: 'calculated_points',
		status: 'available'
	},
	{
		id: 'lilith_true',
		labelKey: 'point_lilith_true',
		fallbackLabel: 'True Lilith',
		icon: '⚸',
		category: 'calculated_points',
		status: 'planned'
	},
	{
		id: 'lilith_oscu',
		labelKey: 'point_lilith_oscu',
		fallbackLabel: 'Osculating Lilith',
		icon: '⚸',
		category: 'calculated_points',
		status: 'planned'
	},
	{
		id: 'chiron',
		labelKey: 'point_chiron',
		fallbackLabel: 'Chiron',
		icon: '⚷',
		category: 'calculated_points',
		status: 'available'
	},
	{
		id: 'ceres',
		labelKey: 'point_ceres',
		fallbackLabel: 'Ceres',
		icon: 'Ce',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'pallas',
		labelKey: 'point_pallas',
		fallbackLabel: 'Pallas',
		icon: 'Pa',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'juno',
		labelKey: 'point_juno',
		fallbackLabel: 'Juno',
		icon: 'Ju',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'vesta',
		labelKey: 'point_vesta',
		fallbackLabel: 'Vesta',
		icon: 'Ve',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'astraea',
		labelKey: 'point_astraea',
		fallbackLabel: 'Astraea',
		icon: 'As',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'hebe',
		labelKey: 'point_hebe',
		fallbackLabel: 'Hebe',
		icon: 'He',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'iris',
		labelKey: 'point_iris',
		fallbackLabel: 'Iris',
		icon: 'Ir',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'flora',
		labelKey: 'point_flora',
		fallbackLabel: 'Flora',
		icon: 'Fl',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'metis',
		labelKey: 'point_metis',
		fallbackLabel: 'Metis',
		icon: 'Mt',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'hygiea',
		labelKey: 'point_hygiea',
		fallbackLabel: 'Hygiea',
		icon: 'Hy',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'parthenope',
		labelKey: 'point_parthenope',
		fallbackLabel: 'Parthenope',
		icon: 'Pt',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'victoria',
		labelKey: 'point_victoria',
		fallbackLabel: 'Victoria',
		icon: 'Vc',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'egeria',
		labelKey: 'point_egeria',
		fallbackLabel: 'Egeria',
		icon: 'Eg',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'irene',
		labelKey: 'point_irene',
		fallbackLabel: 'Irene',
		icon: 'Ie',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'eunomia',
		labelKey: 'point_eunomia',
		fallbackLabel: 'Eunomia',
		icon: 'Eu',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'psyche',
		labelKey: 'point_psyche',
		fallbackLabel: 'Psyche',
		icon: 'Ps',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'thetis',
		labelKey: 'point_thetis',
		fallbackLabel: 'Thetis',
		icon: 'Th',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'melpomene',
		labelKey: 'point_melpomene',
		fallbackLabel: 'Melpomene',
		icon: 'Mp',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'fortuna',
		labelKey: 'point_fortuna',
		fallbackLabel: 'Fortuna',
		icon: 'Ft',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'massalia',
		labelKey: 'point_massalia',
		fallbackLabel: 'Massalia',
		icon: 'Ma',
		category: 'asteroids',
		status: 'available'
	},
	{
		id: 'vertex',
		labelKey: 'point_vertex',
		fallbackLabel: 'Vertex',
		icon: 'Vx',
		category: 'sensitive_points',
		status: 'planned'
	},
	{
		id: 'antivertex',
		labelKey: 'point_antivertex',
		fallbackLabel: 'Antivertex',
		icon: 'AVx',
		category: 'sensitive_points',
		status: 'planned'
	},
	{
		id: 'part_of_fortune',
		labelKey: 'point_part_of_fortune',
		fallbackLabel: 'Part of Fortune',
		icon: 'PF',
		category: 'sensitive_points',
		status: 'planned'
	},
	{
		id: 'part_of_spirit',
		labelKey: 'point_part_of_spirit',
		fallbackLabel: 'Part of Spirit',
		icon: 'PS',
		category: 'sensitive_points',
		status: 'planned'
	},
	{
		id: 'geo_node_mercury',
		labelKey: 'transits_geo_mercury',
		fallbackLabel: 'Mercury node',
		icon: 'GMe',
		category: 'geocentric_nodes',
		status: 'planned'
	},
	{
		id: 'geo_node_venus',
		labelKey: 'transits_geo_venus',
		fallbackLabel: 'Venus node',
		icon: 'GVe',
		category: 'geocentric_nodes',
		status: 'planned'
	},
	{
		id: 'geo_node_mars',
		labelKey: 'transits_geo_mars',
		fallbackLabel: 'Mars node',
		icon: 'GMa',
		category: 'geocentric_nodes',
		status: 'planned'
	},
	{
		id: 'geo_node_jupiter',
		labelKey: 'transits_geo_jupiter',
		fallbackLabel: 'Jupiter node',
		icon: 'GJu',
		category: 'geocentric_nodes',
		status: 'planned'
	},
	{
		id: 'geo_node_saturn',
		labelKey: 'transits_geo_saturn',
		fallbackLabel: 'Saturn node',
		icon: 'GSa',
		category: 'geocentric_nodes',
		status: 'planned'
	},
	{
		id: 'geo_node_uranus',
		labelKey: 'transits_geo_uranus',
		fallbackLabel: 'Uranus node',
		icon: 'GUr',
		category: 'geocentric_nodes',
		status: 'planned'
	},
	{
		id: 'geo_node_neptune',
		labelKey: 'transits_geo_neptune',
		fallbackLabel: 'Neptune node',
		icon: 'GNe',
		category: 'geocentric_nodes',
		status: 'planned'
	},
	{
		id: 'geo_node_pluto',
		labelKey: 'transits_geo_pluto',
		fallbackLabel: 'Pluto node',
		icon: 'GPl',
		category: 'geocentric_nodes',
		status: 'planned'
	},
	{
		id: 'eris',
		labelKey: 'point_eris',
		fallbackLabel: 'Eris',
		icon: 'Er',
		category: 'trans_neptunian',
		status: 'planned'
	},
	{
		id: 'sedna',
		labelKey: 'point_sedna',
		fallbackLabel: 'Sedna',
		icon: 'Se',
		category: 'trans_neptunian',
		status: 'planned'
	},
	{
		id: 'haumea',
		labelKey: 'point_haumea',
		fallbackLabel: 'Haumea',
		icon: 'Ha',
		category: 'trans_neptunian',
		status: 'planned'
	},
	{
		id: 'makemake',
		labelKey: 'point_makemake',
		fallbackLabel: 'Makemake',
		icon: 'Mk',
		category: 'trans_neptunian',
		status: 'planned'
	},
	{
		id: 'quaoar',
		labelKey: 'point_quaoar',
		fallbackLabel: 'Quaoar',
		icon: 'Qu',
		category: 'trans_neptunian',
		status: 'planned'
	},
	{
		id: 'orcus',
		labelKey: 'point_orcus',
		fallbackLabel: 'Orcus',
		icon: 'Or',
		category: 'trans_neptunian',
		status: 'planned'
	},
	{
		id: 'varuna',
		labelKey: 'point_varuna',
		fallbackLabel: 'Varuna',
		icon: 'Va',
		category: 'trans_neptunian',
		status: 'planned'
	},
	{
		id: 'cupido',
		labelKey: 'point_cupido',
		fallbackLabel: 'Cupido',
		icon: 'Cu',
		category: 'hypothetical',
		status: 'planned'
	},
	{
		id: 'hades',
		labelKey: 'point_hades',
		fallbackLabel: 'Hades',
		icon: 'Hd',
		category: 'hypothetical',
		status: 'planned'
	},
	{
		id: 'zeus',
		labelKey: 'point_zeus',
		fallbackLabel: 'Zeus',
		icon: 'Ze',
		category: 'hypothetical',
		status: 'planned'
	},
	{
		id: 'kronos',
		labelKey: 'point_kronos',
		fallbackLabel: 'Kronos',
		icon: 'Kr',
		category: 'hypothetical',
		status: 'planned'
	},
	{
		id: 'apollon',
		labelKey: 'point_apollon',
		fallbackLabel: 'Apollon',
		icon: 'Ap',
		category: 'hypothetical',
		status: 'planned'
	},
	{
		id: 'admetos',
		labelKey: 'point_admetos',
		fallbackLabel: 'Admetos',
		icon: 'Ad',
		category: 'hypothetical',
		status: 'planned'
	},
	{
		id: 'vulcanus',
		labelKey: 'point_vulcanus',
		fallbackLabel: 'Vulcanus',
		icon: 'Vu',
		category: 'hypothetical',
		status: 'planned'
	},
	{
		id: 'poseidon',
		labelKey: 'point_poseidon',
		fallbackLabel: 'Poseidon',
		icon: 'Po',
		category: 'hypothetical',
		status: 'planned'
	},
	fixedStar('Deneb Kaitos', 'Diphda'),
	fixedStar('Algenib'),
	fixedStar('Alpheratz', 'Sirra'),
	fixedStar('Baten Kaitos'),
	fixedStar('Mirach'),
	fixedStar('Sheratan'),
	fixedStar('Hamal'),
	fixedStar('Alamak'),
	fixedStar('Menkar'),
	fixedStar('Algol'),
	fixedStar('Alcyone'),
	fixedStar('Hyades'),
	fixedStar('Aldebaran'),
	fixedStar('Rigel'),
	fixedStar('Bellatrix'),
	fixedStar('Capella'),
	fixedStar('Mintaka'),
	fixedStar('Nath'),
	fixedStar('Alnilam'),
	fixedStar('Polaris'),
	fixedStar('Betelgeuse'),
	fixedStar('Alhena'),
	fixedStar('Sirius'),
	fixedStar('Canopus'),
	fixedStar('Propus'),
	fixedStar('Castor'),
	fixedStar('Pollux'),
	fixedStar('Procyon'),
	fixedStar('Praesepe'),
	fixedStar('Asellus Borealis'),
	fixedStar('Asellus Australis'),
	fixedStar('Alfard'),
	fixedStar('Regulus'),
	fixedStar('Zosma'),
	fixedStar('Denebola'),
	fixedStar('Vindemiatrix'),
	fixedStar('Algorab'),
	fixedStar('Spica', 'Arista'),
	fixedStar('Arcturus'),
	fixedStar('Acrux'),
	fixedStar('Alphecca', 'Gemma / Gnosia'),
	fixedStar('Kiffa Australis', 'Zuben Elgenubi'),
	fixedStar('Kiffa Borealis', 'Zuben Elschemali'),
	fixedStar('Unuk Elhaia'),
	fixedStar('Agena'),
	fixedStar('Bungula'),
	fixedStar('Acrab', 'Grafias'),
	fixedStar('Antares'),
	fixedStar('Rastaban'),
	fixedStar('Ras Alhague'),
	fixedStar('Lesath'),
	fixedStar('Sinistra'),
	fixedStar('Vega'),
	fixedStar('Altair'),
	fixedStar('Giedi', 'Gredi'),
	fixedStar('Dabih'),
	fixedStar('Deneb Algiedi'),
	fixedStar('Albireo'),
	fixedStar('Sadalmelek'),
	fixedStar('Fomalhaut'),
	fixedStar('Deneb Adige', 'Deneb Cygni'),
	fixedStar('Deneb'),
	fixedStar('Achernar'),
	fixedStar('Markeb'),
	fixedStar('Scheat')
];

export const DEFAULT_OBSERVABLE_OBJECT_IDS = OBSERVABLE_OBJECTS.map((item) => item.id);
export const DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS = OBSERVABLE_OBJECTS.filter(
	(item) =>
		item.status === 'available' &&
		item.category !== 'asteroids' &&
		item.id !== 'true_north_node' &&
		item.id !== 'true_south_node'
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
	asteroids: { labelKey: 'transits_group_asteroids', fallbackLabel: 'Asteroids' },
	sensitive_points: { labelKey: 'observable_category_sensitive_points', fallbackLabel: 'Sensitive Points' },
	geocentric_nodes: { labelKey: 'transits_group_geo_nodes', fallbackLabel: 'Geocentric Planetary Nodes' },
	trans_neptunian: { labelKey: 'transits_group_tno', fallbackLabel: 'Trans-Neptunian Objects' },
	fixed_stars: { labelKey: 'observable_category_fixed_stars', fallbackLabel: 'Fixed Stars' },
	hypothetical: { labelKey: 'transits_group_hypotheticals', fallbackLabel: 'Hypothetical Bodies' }
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
