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
  label: string;
  icon: string;
  category: ObservableObjectCategory;
}

// Keep these canonical IDs aligned with backend-python/module/workspace.py
// and Rust chart `observable_objects` handling.
export const OBSERVABLE_OBJECTS: ObservableObjectDefinition[] = [
  { id: 'sun', label: 'Sun', icon: '☉', category: 'luminaries' },
  { id: 'moon', label: 'Moon', icon: '☽', category: 'luminaries' },
  { id: 'mercury', label: 'Mercury', icon: '☿', category: 'personal_planets' },
  { id: 'venus', label: 'Venus', icon: '♀', category: 'personal_planets' },
  { id: 'mars', label: 'Mars', icon: '♂', category: 'personal_planets' },
  { id: 'jupiter', label: 'Jupiter', icon: '♃', category: 'social_outer_planets' },
  { id: 'saturn', label: 'Saturn', icon: '♄', category: 'social_outer_planets' },
  { id: 'uranus', label: 'Uranus', icon: '♅', category: 'social_outer_planets' },
  { id: 'neptune', label: 'Neptune', icon: '♆', category: 'social_outer_planets' },
  { id: 'pluto', label: 'Pluto', icon: '♇', category: 'social_outer_planets' },
  { id: 'asc', label: 'Asc', icon: 'Asc', category: 'angles' },
  { id: 'mc', label: 'MC', icon: 'MC', category: 'angles' },
  { id: 'desc', label: 'Dsc', icon: 'Dsc', category: 'angles' },
  { id: 'ic', label: 'IC', icon: 'IC', category: 'angles' },
  { id: 'north_node', label: 'North Node', icon: '☊', category: 'lunar_nodes' },
  { id: 'south_node', label: 'South Node', icon: '☋', category: 'lunar_nodes' },
  { id: 'true_north_node', label: 'True North Node', icon: '☊', category: 'lunar_nodes' },
  { id: 'true_south_node', label: 'True South Node', icon: '☋', category: 'lunar_nodes' },
  { id: 'lilith', label: 'Lilith', icon: '⚸', category: 'calculated_points' },
  { id: 'chiron', label: 'Chiron', icon: '⚷', category: 'calculated_points' },
  { id: 'ceres', label: 'Ceres', icon: 'Ce', category: 'asteroids' },
  { id: 'pallas', label: 'Pallas', icon: 'Pa', category: 'asteroids' },
  { id: 'juno', label: 'Juno', icon: 'Ju', category: 'asteroids' },
  { id: 'vesta', label: 'Vesta', icon: 'Ve', category: 'asteroids' }
];

export const DEFAULT_OBSERVABLE_OBJECT_IDS = OBSERVABLE_OBJECTS.map((item) => item.id);

export const OBSERVABLE_OBJECT_CATEGORY_LABELS: Record<ObservableObjectCategory, string> = {
  luminaries: 'Luminaries',
  personal_planets: 'Personal Planets',
  social_outer_planets: 'Social and Outer Planets',
  angles: 'Angles',
  lunar_nodes: 'Lunar Nodes',
  calculated_points: 'Calculated Points',
  asteroids: 'Asteroids'
};
