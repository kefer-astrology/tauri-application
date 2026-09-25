export type ObservableObjectCategory =
	| 'luminaries'
	| 'personal_planets'
	| 'social_planets'
	| 'transpersonal_planets'
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
	/**
	 * Geocentric ecliptic latitude in degrees (J2000), only set for fixed stars. Positive is
	 * north of the ecliptic, negative is south. Derived from the Swiss Ephemeris fixed-star
	 * catalog (equatorial RA/Dec converted to ecliptic coordinates) — ecliptic latitude barely
	 * moves over centuries, unlike RA/Dec, which makes it a stable basis for a north/south
	 * quick-filter over ~2000 years of precession. Used to power the "northern/southern sky"
	 * quick filter in the fixed-stars picker, not for chart computation.
	 */
	eclipticLatitude?: number;
}

export type StarHemisphere = 'north' | 'south';

export function starHemisphere(item: ObservableObjectDefinition): StarHemisphere | undefined {
	if (item.eclipticLatitude === undefined) return undefined;
	return item.eclipticLatitude >= 0 ? 'north' : 'south';
}

type ObservableObjectCategoryLabel = {
	labelKey?: string;
	fallbackLabel: string;
};

function fixedStar(
	name: string,
	eclipticLatitude: number,
	altName?: string
): ObservableObjectDefinition {
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
		status: 'planned',
		eclipticLatitude
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
		category: 'social_planets',
		status: 'available'
	},
	{
		id: 'saturn',
		labelKey: 'planet_saturn',
		fallbackLabel: 'Saturn',
		icon: '♄',
		category: 'social_planets',
		status: 'available'
	},
	{
		id: 'uranus',
		labelKey: 'planet_uranus',
		fallbackLabel: 'Uranus',
		icon: '♅',
		category: 'transpersonal_planets',
		status: 'available'
	},
	{
		id: 'neptune',
		labelKey: 'planet_neptune',
		fallbackLabel: 'Neptune',
		icon: '♆',
		category: 'transpersonal_planets',
		status: 'available'
	},
	{
		id: 'pluto',
		labelKey: 'planet_pluto',
		fallbackLabel: 'Pluto',
		icon: '♇',
		category: 'transpersonal_planets',
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
		id: 'true_lilith',
		labelKey: 'point_lilith_true',
		fallbackLabel: 'True Lilith',
		icon: '⚸',
		category: 'calculated_points',
		status: 'available'
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
		status: 'available'
	},
	{
		id: 'antivertex',
		labelKey: 'point_antivertex',
		fallbackLabel: 'Antivertex',
		icon: 'AVx',
		category: 'sensitive_points',
		status: 'available'
	},
	{
		id: 'part_of_fortune',
		labelKey: 'point_part_of_fortune',
		fallbackLabel: 'Part of Fortune',
		icon: 'PF',
		category: 'sensitive_points',
		status: 'available'
	},
	{
		id: 'part_of_spirit',
		labelKey: 'point_part_of_spirit',
		fallbackLabel: 'Part of Spirit',
		icon: 'PS',
		category: 'sensitive_points',
		status: 'available'
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
	fixedStar('Deneb Kaitos', -10.0, 'Diphda'),
	fixedStar('Algenib', 12.6),
	fixedStar('Alpheratz', 25.7, 'Sirra'),
	fixedStar('Baten Kaitos', -20.3),
	fixedStar('Mirach', 25.9),
	fixedStar('Sheratan', 8.5),
	fixedStar('Hamal', 10.0),
	fixedStar('Alamak', 27.8),
	fixedStar('Menkar', -12.6),
	fixedStar('Algol', 22.4),
	fixedStar('Alcyone', 4.1),
	fixedStar('Hyades', -5.8),
	fixedStar('Aldebaran', -5.5),
	fixedStar('Rigel', -31.1),
	fixedStar('Bellatrix', -16.8),
	fixedStar('Capella', 22.9),
	fixedStar('Mintaka', -23.6),
	fixedStar('Nath', 5.4),
	fixedStar('Alnilam', -24.5),
	fixedStar('Polaris', 66.1),
	fixedStar('Betelgeuse', -16.0),
	fixedStar('Alhena', -6.7),
	fixedStar('Sirius', -39.6),
	fixedStar('Canopus', -75.8),
	fixedStar('Propus', -0.9),
	fixedStar('Castor', 10.1),
	fixedStar('Pollux', 6.7),
	fixedStar('Procyon', -16.0),
	fixedStar('Praesepe', 1.6),
	fixedStar('Asellus Borealis', 3.2),
	fixedStar('Asellus Australis', 0.1),
	fixedStar('Alfard', -22.4),
	fixedStar('Regulus', 0.5),
	fixedStar('Zosma', 14.3),
	fixedStar('Denebola', 12.3),
	fixedStar('Vindemiatrix', 16.2),
	fixedStar('Algorab', -12.2),
	fixedStar('Spica', -2.1, 'Arista'),
	fixedStar('Arcturus', 30.7),
	fixedStar('Acrux', -52.9),
	fixedStar('Alphecca', 44.3, 'Gemma / Gnosia'),
	fixedStar('Kiffa Australis', 0.3, 'Zuben Elgenubi'),
	fixedStar('Kiffa Borealis', 8.5, 'Zuben Elschemali'),
	fixedStar('Unuk Elhaia', 25.5),
	fixedStar('Agena', -44.1),
	fixedStar('Bungula', -42.6),
	fixedStar('Acrab', 1.0, 'Grafias'),
	fixedStar('Antares', -4.6),
	fixedStar('Rastaban', 75.3),
	fixedStar('Ras Alhague', 35.8),
	fixedStar('Lesath', -14.0),
	fixedStar('Sinistra', 13.7),
	fixedStar('Vega', 61.7),
	fixedStar('Altair', 29.3),
	fixedStar('Giedi', 7.0, 'Gredi'),
	fixedStar('Dabih', 4.6),
	fixedStar('Deneb Algiedi', -2.6),
	fixedStar('Albireo', 49.0),
	fixedStar('Sadalmelek', 10.7),
	fixedStar('Fomalhaut', -21.1),
	fixedStar('Deneb Adige', 59.9, 'Deneb Cygni'),
	fixedStar('Deneb', 59.9),
	fixedStar('Achernar', -59.4),
	fixedStar('Markeb', -63.7),
	fixedStar('Scheat', 31.1),
	// Extended set — additional bright, traditionally named fixed stars (ecliptic latitude and
	// magnitude sourced the same way as the set above, via the Swiss Ephemeris fixed-star
	// catalog). Still 'planned': no backend computes fixed-star positions yet.
	fixedStar('Rigil Kentaurus', -42.6),
	fixedStar('Mimosa', -48.6),
	fixedStar('Adhara', -51.4),
	fixedStar('Shaula', -13.8),
	fixedStar('Gacrux', -47.8),
	fixedStar('Miaplacidus', -72.2),
	fixedStar('Alnair', -32.9),
	fixedStar('Alioth', 54.3),
	fixedStar('Alnitak', -25.3),
	fixedStar('Mirfak', 30.1),
	fixedStar('Dubhe', 49.7),
	fixedStar('Regor', -64.5),
	fixedStar('Wezen', -48.5),
	fixedStar('Kaus Australis', -11.1),
	fixedStar('Alkaid', 54.4),
	fixedStar('Sargas', -19.6),
	fixedStar('Menkalinan', 21.5),
	fixedStar('Peacock', -36.3),
	fixedStar('Atria', -46.2),
	fixedStar('Avior', -72.7),
	fixedStar('Alsephina', -67.2),
	fixedStar('Mirzam', -41.3),
	fixedStar('Algieba', 8.8),
	fixedStar('Menkent', -22.1),
	fixedStar('Saiph', -33.1),
	fixedStar('Nunki', -3.4),
	fixedStar('Kochab', 73.0),
	fixedStar('Gruid', -35.4),
	fixedStar('Muhlifain', -40.2),
	fixedStar('Suhail', -55.9),
	fixedStar('Schedar', 46.6),
	fixedStar('Sadr', 57.1),
	fixedStar('Eltanin', 74.9),
	fixedStar('Naos', -58.3),
	fixedStar('Aspidiske', -67.1),
	fixedStar('Caph', 51.2),
	fixedStar('Mizar', 56.4),
	fixedStar('Girtab', -15.6),
	fixedStar('Dschubba', -2.0),
	fixedStar('Ankaa', -40.6),
	fixedStar('Merak', 45.1),
	fixedStar('Izar', 40.6),
	fixedStar('Ruchbah', 46.4),
	fixedStar('Enif', 22.1),
	fixedStar('Sabik', 7.2),
	fixedStar('Phecda', 47.1),
	fixedStar('Aludra', -50.6),
	fixedStar('Alderamin', 68.9),
	fixedStar('Gienah Cygni', 49.4),
	fixedStar('Markab', 19.4),
	fixedStar('Arneb', -41.1),
	fixedStar('Ascella', -7.2),
	fixedStar('Kraz', -18.0),
	fixedStar('Phact', -57.4),
	fixedStar('Kaus Media', -6.5),
	fixedStar('Muphrid', 28.1),
	fixedStar('Hassaleh', 10.5),
	fixedStar('Tarazed', 31.2),
	fixedStar('Athebyne', 78.4),
	fixedStar('Porrima', 2.8),
	fixedStar('Cebalrai', 27.9),
	fixedStar('Yed Prior', 17.2),
	fixedStar('Kornephoros', 42.7),
	fixedStar('Cursa', -27.9),
	fixedStar('Kaus Borealis', -2.1),
	fixedStar('Cor Caroli', 40.1),
	fixedStar('Sadalsuud', 8.6),
	fixedStar('Gomeisa', -13.5),
	fixedStar('Zaurak', -33.2),
	fixedStar('Gienah Corvi', -14.5)
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
	personal_planets: {
		labelKey: 'transits_group_personal_planets',
		fallbackLabel: 'Personal Planets'
	},
	social_planets: { labelKey: 'transits_group_social', fallbackLabel: 'Social Planets' },
	transpersonal_planets: {
		labelKey: 'transits_group_transpersonal',
		fallbackLabel: 'Transpersonal Planets'
	},
	angles: { labelKey: 'observable_category_angles', fallbackLabel: 'Angles' },
	lunar_nodes: { labelKey: 'transits_group_lunar_nodes', fallbackLabel: 'Lunar Nodes' },
	calculated_points: {
		labelKey: 'observable_category_calculated_points',
		fallbackLabel: 'Calculated Points'
	},
	asteroids: { labelKey: 'transits_group_asteroids', fallbackLabel: 'Asteroids' },
	sensitive_points: {
		labelKey: 'observable_category_sensitive_points',
		fallbackLabel: 'Sensitive Points'
	},
	geocentric_nodes: {
		labelKey: 'transits_group_geo_nodes',
		fallbackLabel: 'Geocentric Planetary Nodes'
	},
	trans_neptunian: { labelKey: 'transits_group_tno', fallbackLabel: 'Trans-Neptunian Objects' },
	fixed_stars: { labelKey: 'observable_category_fixed_stars', fallbackLabel: 'Fixed Stars' },
	hypothetical: { labelKey: 'transits_group_hypotheticals', fallbackLabel: 'Hypothetical Bodies' }
};

export function getObservableObjectLabel(
	item: ObservableObjectDefinition,
	t: (key: string, options?: Record<string, unknown>) => string
): string {
	return item.labelKey
		? t(item.labelKey, { defaultValue: item.fallbackLabel })
		: item.fallbackLabel;
}

export function getObservableCategoryLabel(
	category: ObservableObjectCategory,
	t: (key: string, options?: Record<string, unknown>) => string
): string {
	const meta = OBSERVABLE_OBJECT_CATEGORY_LABELS[category];
	return meta.labelKey
		? t(meta.labelKey, { defaultValue: meta.fallbackLabel })
		: meta.fallbackLabel;
}
