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
  label: string;
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

function fixedStar(name: string): ObservableObjectDefinition {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return {
    id: `star_${slug}`,
    label: name,
    icon: name.charAt(0),
    category: 'fixed_stars',
    status: 'planned'
  };
}

// Keep these canonical IDs aligned with backend-python/module/workspace.py
// and Rust chart `observable_objects` handling.
export const OBSERVABLE_OBJECTS: ObservableObjectDefinition[] = [
  { id: 'sun', label: 'Sun', icon: '☉', category: 'luminaries', status: 'available' },
  { id: 'moon', label: 'Moon', icon: '☽', category: 'luminaries', status: 'available' },
  { id: 'mercury', label: 'Mercury', icon: '☿', category: 'personal_planets', status: 'available' },
  { id: 'venus', label: 'Venus', icon: '♀', category: 'personal_planets', status: 'available' },
  { id: 'mars', label: 'Mars', icon: '♂', category: 'personal_planets', status: 'available' },
  { id: 'jupiter', label: 'Jupiter', icon: '♃', category: 'social_outer_planets', status: 'available' },
  { id: 'saturn', label: 'Saturn', icon: '♄', category: 'social_outer_planets', status: 'available' },
  { id: 'uranus', label: 'Uranus', icon: '♅', category: 'social_outer_planets', status: 'available' },
  { id: 'neptune', label: 'Neptune', icon: '♆', category: 'social_outer_planets', status: 'available' },
  { id: 'pluto', label: 'Pluto', icon: '♇', category: 'social_outer_planets', status: 'available' },
  { id: 'asc', label: 'Asc', icon: 'Asc', category: 'angles', status: 'available' },
  { id: 'mc', label: 'MC', icon: 'MC', category: 'angles', status: 'available' },
  { id: 'desc', label: 'Dsc', icon: 'Dsc', category: 'angles', status: 'available' },
  { id: 'ic', label: 'IC', icon: 'IC', category: 'angles', status: 'available' },
  { id: 'north_node', label: 'North Node', icon: '☊', category: 'lunar_nodes', status: 'available' },
  { id: 'south_node', label: 'South Node', icon: '☋', category: 'lunar_nodes', status: 'available' },
  {
    id: 'true_north_node',
    label: 'True North Node',
    icon: '☊',
    category: 'lunar_nodes',
    status: 'available'
  },
  {
    id: 'true_south_node',
    label: 'True South Node',
    icon: '☋',
    category: 'lunar_nodes',
    status: 'available'
  },
  { id: 'lilith', label: 'Lilith', icon: '⚸', category: 'calculated_points', status: 'available' },
  {
    id: 'lilith_true',
    label: 'True Lilith',
    icon: '⚸',
    category: 'calculated_points',
    status: 'planned'
  },
  {
    id: 'lilith_oscu',
    label: 'Osculating Lilith',
    icon: '⚸',
    category: 'calculated_points',
    status: 'planned'
  },
  { id: 'chiron', label: 'Chiron', icon: '⚷', category: 'calculated_points', status: 'available' },
  { id: 'ceres', label: 'Ceres', icon: 'Ce', category: 'asteroids', status: 'available' },
  { id: 'pallas', label: 'Pallas', icon: 'Pa', category: 'asteroids', status: 'available' },
  { id: 'juno', label: 'Juno', icon: 'Ju', category: 'asteroids', status: 'available' },
  { id: 'vesta', label: 'Vesta', icon: 'Ve', category: 'asteroids', status: 'available' },
  { id: 'astraea', label: 'Astraea', icon: 'As', category: 'asteroids', status: 'available' },
  { id: 'hebe', label: 'Hebe', icon: 'He', category: 'asteroids', status: 'available' },
  { id: 'iris', label: 'Iris', icon: 'Ir', category: 'asteroids', status: 'available' },
  { id: 'flora', label: 'Flora', icon: 'Fl', category: 'asteroids', status: 'available' },
  { id: 'metis', label: 'Metis', icon: 'Mt', category: 'asteroids', status: 'available' },
  { id: 'hygiea', label: 'Hygiea', icon: 'Hy', category: 'asteroids', status: 'available' },
  { id: 'parthenope', label: 'Parthenope', icon: 'Pt', category: 'asteroids', status: 'available' },
  { id: 'victoria', label: 'Victoria', icon: 'Vc', category: 'asteroids', status: 'available' },
  { id: 'egeria', label: 'Egeria', icon: 'Eg', category: 'asteroids', status: 'available' },
  { id: 'irene', label: 'Irene', icon: 'Ie', category: 'asteroids', status: 'available' },
  { id: 'eunomia', label: 'Eunomia', icon: 'Eu', category: 'asteroids', status: 'available' },
  { id: 'psyche', label: 'Psyche', icon: 'Ps', category: 'asteroids', status: 'available' },
  { id: 'thetis', label: 'Thetis', icon: 'Th', category: 'asteroids', status: 'available' },
  { id: 'melpomene', label: 'Melpomene', icon: 'Mp', category: 'asteroids', status: 'available' },
  { id: 'fortuna', label: 'Fortuna', icon: 'Ft', category: 'asteroids', status: 'available' },
  { id: 'massalia', label: 'Massalia', icon: 'Ma', category: 'asteroids', status: 'available' },
  { id: 'vertex', label: 'Vertex', icon: 'Vx', category: 'sensitive_points', status: 'planned' },
  {
    id: 'antivertex',
    label: 'Antivertex',
    icon: 'AVx',
    category: 'sensitive_points',
    status: 'planned'
  },
  {
    id: 'part_of_fortune',
    label: 'Part of Fortune',
    icon: 'PF',
    category: 'sensitive_points',
    status: 'planned'
  },
  {
    id: 'part_of_spirit',
    label: 'Part of Spirit',
    icon: 'PS',
    category: 'sensitive_points',
    status: 'planned'
  },
  {
    id: 'geo_node_mercury',
    label: 'Mercury node',
    icon: 'GMe',
    category: 'geocentric_nodes',
    status: 'planned'
  },
  {
    id: 'geo_node_venus',
    label: 'Venus node',
    icon: 'GVe',
    category: 'geocentric_nodes',
    status: 'planned'
  },
  {
    id: 'geo_node_mars',
    label: 'Mars node',
    icon: 'GMa',
    category: 'geocentric_nodes',
    status: 'planned'
  },
  {
    id: 'geo_node_jupiter',
    label: 'Jupiter node',
    icon: 'GJu',
    category: 'geocentric_nodes',
    status: 'planned'
  },
  {
    id: 'geo_node_saturn',
    label: 'Saturn node',
    icon: 'GSa',
    category: 'geocentric_nodes',
    status: 'planned'
  },
  {
    id: 'geo_node_uranus',
    label: 'Uranus node',
    icon: 'GUr',
    category: 'geocentric_nodes',
    status: 'planned'
  },
  {
    id: 'geo_node_neptune',
    label: 'Neptune node',
    icon: 'GNe',
    category: 'geocentric_nodes',
    status: 'planned'
  },
  {
    id: 'geo_node_pluto',
    label: 'Pluto node',
    icon: 'GPl',
    category: 'geocentric_nodes',
    status: 'planned'
  },
  { id: 'eris', label: 'Eris', icon: 'Er', category: 'trans_neptunian', status: 'planned' },
  { id: 'sedna', label: 'Sedna', icon: 'Se', category: 'trans_neptunian', status: 'planned' },
  { id: 'haumea', label: 'Haumea', icon: 'Ha', category: 'trans_neptunian', status: 'planned' },
  { id: 'makemake', label: 'Makemake', icon: 'Mk', category: 'trans_neptunian', status: 'planned' },
  { id: 'quaoar', label: 'Quaoar', icon: 'Qu', category: 'trans_neptunian', status: 'planned' },
  { id: 'orcus', label: 'Orcus', icon: 'Or', category: 'trans_neptunian', status: 'planned' },
  { id: 'varuna', label: 'Varuna', icon: 'Va', category: 'trans_neptunian', status: 'planned' },
  { id: 'cupido', label: 'Cupido', icon: 'Cu', category: 'hypothetical', status: 'planned' },
  { id: 'hades', label: 'Hades', icon: 'Hd', category: 'hypothetical', status: 'planned' },
  { id: 'zeus', label: 'Zeus', icon: 'Ze', category: 'hypothetical', status: 'planned' },
  { id: 'kronos', label: 'Kronos', icon: 'Kr', category: 'hypothetical', status: 'planned' },
  { id: 'apollon', label: 'Apollon', icon: 'Ap', category: 'hypothetical', status: 'planned' },
  { id: 'admetos', label: 'Admetos', icon: 'Ad', category: 'hypothetical', status: 'planned' },
  { id: 'vulcanus', label: 'Vulcanus', icon: 'Vu', category: 'hypothetical', status: 'planned' },
  { id: 'poseidon', label: 'Poseidon', icon: 'Po', category: 'hypothetical', status: 'planned' },
  fixedStar('Deneb Kaitos'),
  fixedStar('Algenib'),
  fixedStar('Alpheratz'),
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
  fixedStar('Spica'),
  fixedStar('Arcturus'),
  fixedStar('Acrux'),
  fixedStar('Alphecca'),
  fixedStar('Kiffa Australis'),
  fixedStar('Kiffa Borealis'),
  fixedStar('Unuk Elhaia'),
  fixedStar('Agena'),
  fixedStar('Bungula'),
  fixedStar('Acrab'),
  fixedStar('Antares'),
  fixedStar('Rastaban'),
  fixedStar('Ras Alhague'),
  fixedStar('Lesath'),
  fixedStar('Sinistra'),
  fixedStar('Vega'),
  fixedStar('Altair'),
  fixedStar('Giedi'),
  fixedStar('Dabih'),
  fixedStar('Deneb Algiedi'),
  fixedStar('Albireo'),
  fixedStar('Sadalmelek'),
  fixedStar('Fomalhaut'),
  fixedStar('Deneb Adige'),
  fixedStar('Deneb'),
  fixedStar('Achernar'),
  fixedStar('Markeb'),
  fixedStar('Scheat')
];

export const DEFAULT_OBSERVABLE_OBJECT_IDS = OBSERVABLE_OBJECTS.map((item) => item.id);
export const DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS = OBSERVABLE_OBJECTS.filter(
  (item) => item.status === 'available' && item.category !== 'asteroids'
).map((item) => item.id);

export const OBSERVABLE_OBJECT_CATEGORY_LABELS: Record<ObservableObjectCategory, string> = {
  luminaries: 'Luminaries',
  personal_planets: 'Personal Planets',
  social_outer_planets: 'Social and Outer Planets',
  angles: 'Angles',
  lunar_nodes: 'Lunar Nodes',
  calculated_points: 'Calculated Points',
  asteroids: 'Asteroids',
  sensitive_points: 'Sensitive Points',
  geocentric_nodes: 'Geocentric Planetary Nodes',
  trans_neptunian: 'Trans-Neptunian Objects',
  fixed_stars: 'Fixed Stars',
  hypothetical: 'Hypothetical Bodies'
};
