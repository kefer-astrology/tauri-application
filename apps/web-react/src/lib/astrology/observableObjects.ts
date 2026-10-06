import type { BodyDefinitionDto, DomainCatalogDto } from '@/lib/tauri/types';

export type ObservableObjectCategory = 'luminaries' | 'personal_planets' | 'social_planets' | 'transpersonal_planets' | 'angles' | 'lunar_nodes' | 'calculated_points' | 'asteroids' | 'sensitive_points' | 'geocentric_nodes' | 'trans_neptunian' | 'fixed_stars' | 'hypothetical';
export type ObservableObjectStatus = 'available' | 'planned';
export interface ObservableObjectDefinition { id: string; labelKey?: string; fallbackLabel: string; altName?: string; icon: string; category: ObservableObjectCategory; status: ObservableObjectStatus; eclipticLatitude?: number; }
export type StarHemisphere = 'north' | 'south';
export function starHemisphere(item: ObservableObjectDefinition): StarHemisphere | undefined { return item.eclipticLatitude === undefined ? undefined : item.eclipticLatitude >= 0 ? 'north' : 'south'; }

function categoryForBody(body: BodyDefinitionDto): ObservableObjectCategory {
 if (body.object_type === 'angle') return 'angles';
 if (body.object_type === 'lunar_node') return 'lunar_nodes';
 if (body.object_type === 'asteroid') return body.id === 'chiron' ? 'calculated_points' : 'asteroids';
 if (body.object_type === 'calculated_point' || body.object_type === 'part') return 'calculated_points';
 if (body.id === 'sun' || body.id === 'moon') return 'luminaries';
 if (body.id === 'jupiter' || body.id === 'saturn') return 'social_planets';
 if (body.id === 'uranus' || body.id === 'neptune' || body.id === 'pluto') return 'transpersonal_planets';
 return 'personal_planets';
}
function labelKeyForBody(body: BodyDefinitionDto): string {
 if (body.object_type === 'angle') return `point_${body.id === 'desc' ? 'dsc' : body.id}`;
 if (body.object_type === 'lunar_node' || body.object_type === 'calculated_point' || body.object_type === 'part') return `point_${body.id}`;
 return `planet_${body.id}`;
}

export const OBSERVABLE_OBJECTS: ObservableObjectDefinition[] = [];
export const DEFAULT_OBSERVABLE_OBJECT_IDS: string[] = [];
export const DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS: string[] = [];
export function setObservableObjectCatalog(catalog: DomainCatalogDto): void {
 const objects = catalog.model.body_definitions.map((body) => ({ id: body.id, labelKey: labelKeyForBody(body), fallbackLabel: body.i18n.en ?? body.id, icon: body.glyph || body.id.slice(0, 2), category: categoryForBody(body), status: Object.values(body.computation_map).some(Boolean) ? 'available' as const : 'planned' as const }));
 OBSERVABLE_OBJECTS.splice(0, OBSERVABLE_OBJECTS.length, ...objects);
 DEFAULT_OBSERVABLE_OBJECT_IDS.splice(0, DEFAULT_OBSERVABLE_OBJECT_IDS.length, ...objects.map((item) => item.id));
 setObservableObjectDefaults(catalog.model.settings?.default_bodies);
}
export function setObservableObjectDefaults(ids?: string[]): void { DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS.splice(0, DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS.length, ...(ids?.length ? ids : DEFAULT_OBSERVABLE_OBJECT_IDS)); }

export const OBSERVABLE_OBJECT_CATEGORY_LABELS: Record<ObservableObjectCategory, { labelKey?: string; fallbackLabel: string }> = {
 luminaries: { labelKey: 'transits_group_luminaries', fallbackLabel: 'Luminaries' }, personal_planets: { labelKey: 'transits_group_personal_planets', fallbackLabel: 'Personal Planets' }, social_planets: { labelKey: 'transits_group_social', fallbackLabel: 'Social Planets' }, transpersonal_planets: { labelKey: 'transits_group_transpersonal', fallbackLabel: 'Transpersonal Planets' }, angles: { labelKey: 'observable_category_angles', fallbackLabel: 'Angles' }, lunar_nodes: { labelKey: 'transits_group_lunar_nodes', fallbackLabel: 'Lunar Nodes' }, calculated_points: { labelKey: 'observable_category_calculated_points', fallbackLabel: 'Calculated Points' }, asteroids: { labelKey: 'transits_group_asteroids', fallbackLabel: 'Asteroids' }, sensitive_points: { labelKey: 'observable_category_sensitive_points', fallbackLabel: 'Sensitive Points' }, geocentric_nodes: { labelKey: 'transits_group_geo_nodes', fallbackLabel: 'Geocentric Planetary Nodes' }, trans_neptunian: { labelKey: 'transits_group_tno', fallbackLabel: 'Trans-Neptunian Objects' }, fixed_stars: { labelKey: 'observable_category_fixed_stars', fallbackLabel: 'Fixed Stars' }, hypothetical: { labelKey: 'transits_group_hypotheticals', fallbackLabel: 'Hypothetical Bodies' }
};
export function getObservableObjectLabel(item: ObservableObjectDefinition, t: (key: string, options?: Record<string, unknown>) => string): string { return item.labelKey ? t(item.labelKey, { defaultValue: item.fallbackLabel }) : item.fallbackLabel; }
export function getObservableCategoryLabel(category: ObservableObjectCategory, t: (key: string, options?: Record<string, unknown>) => string): string { const meta = OBSERVABLE_OBJECT_CATEGORY_LABELS[category]; return meta.labelKey ? t(meta.labelKey, { defaultValue: meta.fallbackLabel }) : meta.fallbackLabel; }
