import type { BodyDefinitionDto, DomainCatalogDto } from '$lib/tauri/types';

export type ObservableObjectCategory = 'luminaries' | 'personal_planets' | 'social_outer_planets' | 'angles' | 'lunar_nodes' | 'calculated_points' | 'asteroids' | 'sensitive_points' | 'geocentric_nodes' | 'trans_neptunian' | 'fixed_stars' | 'hypothetical';
export type ObservableObjectStatus = 'available' | 'planned';
export interface ObservableObjectDefinition { id: string; label: string; icon: string; category: ObservableObjectCategory; status: ObservableObjectStatus; }

function categoryForBody(body: BodyDefinitionDto): ObservableObjectCategory {
 if (body.object_type === 'angle') return 'angles';
 if (body.object_type === 'lunar_node') return 'lunar_nodes';
 if (body.object_type === 'asteroid') return body.id === 'chiron' ? 'calculated_points' : 'asteroids';
 if (body.object_type === 'calculated_point' || body.object_type === 'part') return 'calculated_points';
 if (body.id === 'sun' || body.id === 'moon') return 'luminaries';
 if (['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].includes(body.id)) return 'social_outer_planets';
 return 'personal_planets';
}
function labelForBody(body: BodyDefinitionDto): string {
 return body.i18n.en ?? body.id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const OBSERVABLE_OBJECTS: ObservableObjectDefinition[] = [];
export const DEFAULT_OBSERVABLE_OBJECT_IDS: string[] = [];
export const DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS: string[] = [];
export function setObservableObjectCatalog(catalog: DomainCatalogDto): void {
 const objects = catalog.model.body_definitions.map((body) => ({ id: body.id, label: labelForBody(body), icon: body.glyph || labelForBody(body).slice(0, 2), category: categoryForBody(body), status: Object.values(body.computation_map).some(Boolean) ? 'available' as const : 'planned' as const }));
 OBSERVABLE_OBJECTS.splice(0, OBSERVABLE_OBJECTS.length, ...objects);
 DEFAULT_OBSERVABLE_OBJECT_IDS.splice(0, DEFAULT_OBSERVABLE_OBJECT_IDS.length, ...objects.map((item) => item.id));
 setObservableObjectDefaults(catalog.model.settings?.default_bodies);
}
export function setObservableObjectDefaults(ids?: string[]): void { DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS.splice(0, DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS.length, ...(ids?.length ? ids : DEFAULT_OBSERVABLE_OBJECT_IDS)); }

export const OBSERVABLE_OBJECT_CATEGORY_LABELS: Record<ObservableObjectCategory, string> = { luminaries: 'Luminaries', personal_planets: 'Personal Planets', social_outer_planets: 'Social and Outer Planets', angles: 'Angles', lunar_nodes: 'Lunar Nodes', calculated_points: 'Calculated Points', asteroids: 'Asteroids', sensitive_points: 'Sensitive Points', geocentric_nodes: 'Geocentric Planetary Nodes', trans_neptunian: 'Trans-Neptunian Objects', fixed_stars: 'Fixed Stars', hypothetical: 'Hypothetical Bodies' };
