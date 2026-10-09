import type { BodyDefinitionDto, DomainCatalogDto, ObjectTypeId } from '@/lib/tauri/types';

export type ObservableObjectCategory = 'luminaries' | 'personal_planets' | 'social_planets' | 'transpersonal_planets' | 'angles' | 'lunar_nodes' | 'black_luna' | 'asteroids' | 'sensitive_points' | 'geocentric_nodes' | 'trans_neptunian' | 'fixed_stars' | 'hypothetical';
export type ObservableObjectStatus = 'available' | 'planned';
export type FixedStarSignificance = 'royal' | 'behenian' | 'notable';
export interface ObservableObjectDefinition { id: string; labelKey?: string; fallbackLabel: string; altName?: string; icon: string; category: ObservableObjectCategory; status: ObservableObjectStatus; eclipticLatitude?: number; zodiacSign?: string; significance?: FixedStarSignificance; objectType: ObjectTypeId | null; }
export type StarHemisphere = 'north' | 'south';
export function starHemisphere(item: ObservableObjectDefinition): StarHemisphere | undefined { return item.eclipticLatitude === undefined ? undefined : item.eclipticLatitude >= 0 ? 'north' : 'south'; }

/** Lilith-family ids that make up the "Black Luna" group — the other `calculated_point` ids
 *  (vertex/antivertex) are Sensitive points instead. See `categoryForBody`. */
const BLACK_LUNA_IDS = new Set(['lilith', 'true_lilith', 'lilith_oscu']);

function categoryForBody(body: BodyDefinitionDto): ObservableObjectCategory {
 if (body.object_type === 'angle') return 'angles';
 if (body.object_type === 'lunar_node') return 'lunar_nodes';
 if (body.object_type === 'asteroid') return 'asteroids';
 if (body.object_type === 'calculated_point') return BLACK_LUNA_IDS.has(body.id) ? 'black_luna' : 'sensitive_points';
 if (body.object_type === 'part') return 'sensitive_points';
 if (body.object_type === 'geocentric_node') return 'geocentric_nodes';
 if (body.object_type === 'trans_neptunian') return 'trans_neptunian';
 if (body.object_type === 'hypothetical_planet') return 'hypothetical';
 if (body.object_type === 'fixed_star') return 'fixed_stars';
 if (body.id === 'sun' || body.id === 'moon') return 'luminaries';
 if (body.id === 'jupiter' || body.id === 'saturn') return 'social_planets';
 if (body.id === 'uranus' || body.id === 'neptune' || body.id === 'pluto') return 'transpersonal_planets';
 return 'personal_planets';
}
function labelKeyForBody(body: BodyDefinitionDto): string {
 if (body.object_type === 'angle') return `point_${body.id === 'desc' ? 'dsc' : body.id}`;
 if (body.object_type === 'geocentric_node') return `transits_geo_${body.id.replace('geo_node_', '')}`;
 if (
 	body.object_type === 'lunar_node' ||
 	body.object_type === 'calculated_point' ||
 	body.object_type === 'part' ||
 	body.object_type === 'trans_neptunian' ||
 	body.object_type === 'hypothetical_planet' ||
 	body.object_type === 'fixed_star'
 )
 	return `point_${body.id}`;
 return `planet_${body.id}`;
}

function humanizeId(id: string): string {
	return id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Presentation-only star data (sign/hemisphere/significance) for the curated, disabled fixed-star
 *  prototype catalog — same split as `DEFAULT_BODY_COLORS`: Rust only establishes catalog
 *  membership (id + `NotYetSupported`), React owns this non-computed display metadata. Positions
 *  are approximate tropical longitudes (epoch ~2000) from standard astrological references —
 *  adequate for a disabled/prototype catalog, not a computed one. Keyed by body id. */
const FIXED_STAR_METADATA: Record<string, { eclipticLatitude: number; zodiacSign: string; significance: FixedStarSignificance }> = {
	star_alpheratz: { eclipticLatitude: 25.6, zodiacSign: 'aries', significance: 'notable' },
	star_algenib: { eclipticLatitude: 12.2, zodiacSign: 'aries', significance: 'notable' },
	star_hamal: { eclipticLatitude: 9.9, zodiacSign: 'taurus', significance: 'notable' },
	star_algol: { eclipticLatitude: 22.4, zodiacSign: 'taurus', significance: 'behenian' },
	star_alcyone: { eclipticLatitude: 4.0, zodiacSign: 'taurus', significance: 'behenian' },
	star_aldebaran: { eclipticLatitude: -5.5, zodiacSign: 'gemini', significance: 'royal' },
	star_rigel: { eclipticLatitude: -31.1, zodiacSign: 'gemini', significance: 'notable' },
	star_capella: { eclipticLatitude: 22.9, zodiacSign: 'gemini', significance: 'behenian' },
	star_bellatrix: { eclipticLatitude: -16.8, zodiacSign: 'gemini', significance: 'notable' },
	star_betelgeuse: { eclipticLatitude: -16.0, zodiacSign: 'gemini', significance: 'notable' },
	star_sirius: { eclipticLatitude: -39.6, zodiacSign: 'cancer', significance: 'behenian' },
	star_canopus: { eclipticLatitude: -75.8, zodiacSign: 'gemini', significance: 'notable' },
	star_procyon: { eclipticLatitude: -16.0, zodiacSign: 'cancer', significance: 'behenian' },
	star_pollux: { eclipticLatitude: 6.7, zodiacSign: 'cancer', significance: 'notable' },
	star_regulus: { eclipticLatitude: 0.46, zodiacSign: 'virgo', significance: 'royal' },
	star_denebola: { eclipticLatitude: 12.3, zodiacSign: 'virgo', significance: 'notable' },
	star_zosma: { eclipticLatitude: 14.2, zodiacSign: 'virgo', significance: 'notable' },
	star_vindemiatrix: { eclipticLatitude: 16.2, zodiacSign: 'libra', significance: 'notable' },
	star_spica: { eclipticLatitude: -2.0, zodiacSign: 'libra', significance: 'behenian' },
	star_arcturus: { eclipticLatitude: 30.8, zodiacSign: 'libra', significance: 'behenian' },
	star_alphecca: { eclipticLatitude: 44.3, zodiacSign: 'scorpio', significance: 'behenian' },
	star_zuben_elgenubi: { eclipticLatitude: 0.4, zodiacSign: 'scorpio', significance: 'notable' },
	star_zuben_eschamali: { eclipticLatitude: 8.2, zodiacSign: 'scorpio', significance: 'notable' },
	star_antares: { eclipticLatitude: -4.6, zodiacSign: 'sagittarius', significance: 'royal' },
	star_vega: { eclipticLatitude: 61.7, zodiacSign: 'capricorn', significance: 'behenian' },
	star_altair: { eclipticLatitude: 29.3, zodiacSign: 'aquarius', significance: 'notable' },
	star_deneb: { eclipticLatitude: 59.9, zodiacSign: 'pisces', significance: 'behenian' },
	star_fomalhaut: { eclipticLatitude: -21.1, zodiacSign: 'pisces', significance: 'royal' },
	star_deneb_algedi: { eclipticLatitude: -4.3, zodiacSign: 'aquarius', significance: 'behenian' },
	star_scheat: { eclipticLatitude: 31.1, zodiacSign: 'pisces', significance: 'notable' },
	star_markab: { eclipticLatitude: 19.4, zodiacSign: 'pisces', significance: 'notable' },
	star_achernar: { eclipticLatitude: -59.6, zodiacSign: 'taurus', significance: 'notable' }
};

export const OBSERVABLE_OBJECTS: ObservableObjectDefinition[] = [];
export const DEFAULT_OBSERVABLE_OBJECT_IDS: string[] = [];
export const DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS: string[] = [];
export function setObservableObjectCatalog(catalog: DomainCatalogDto): void {
 const objects = catalog.model.body_definitions.map((body) => ({ id: body.id, labelKey: labelKeyForBody(body), fallbackLabel: body.i18n.en ?? humanizeId(body.id), icon: body.glyph || humanizeId(body.id).slice(0, 2), category: categoryForBody(body), status: Object.values(body.computation_map).some(Boolean) ? 'available' as const : 'planned' as const, objectType: body.object_type ?? null, ...FIXED_STAR_METADATA[body.id] }));
 OBSERVABLE_OBJECTS.splice(0, OBSERVABLE_OBJECTS.length, ...objects);
 DEFAULT_OBSERVABLE_OBJECT_IDS.splice(0, DEFAULT_OBSERVABLE_OBJECT_IDS.length, ...objects.map((item) => item.id));
 setObservableObjectDefaults(catalog.model.settings?.default_bodies);
}
export function setObservableObjectDefaults(ids?: string[]): void { DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS.splice(0, DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS.length, ...(ids?.length ? ids : DEFAULT_OBSERVABLE_OBJECT_IDS)); }

/** The 5 classical "personal planets" (Sun, Moon, Mercury, Venus, Mars) — derived from the
 *  catalog's own `luminaries`/`personal_planets` categories rather than a hardcoded id list, so
 *  it stays correct if the catalog ever changes. Used by the transits micro ticker to split fast,
 *  brief aspects out of the main resonance chart. */
export function isPersonalPlanetId(id: string): boolean {
	const category = OBSERVABLE_OBJECTS.find((item) => item.id === id)?.category;
	return category === 'luminaries' || category === 'personal_planets';
}

export const OBSERVABLE_OBJECT_CATEGORY_LABELS: Record<ObservableObjectCategory, { labelKey?: string; fallbackLabel: string }> = {
 luminaries: { labelKey: 'transits_group_luminaries', fallbackLabel: 'Luminaries' }, personal_planets: { labelKey: 'transits_group_personal_planets', fallbackLabel: 'Personal Planets' }, social_planets: { labelKey: 'transits_group_social', fallbackLabel: 'Social Planets' }, transpersonal_planets: { labelKey: 'transits_group_transpersonal', fallbackLabel: 'Transpersonal Planets' }, angles: { labelKey: 'observable_category_angles', fallbackLabel: 'Angles' }, lunar_nodes: { labelKey: 'transits_group_lunar_nodes', fallbackLabel: 'Lunar Nodes' }, black_luna: { labelKey: 'observable_category_black_luna', fallbackLabel: 'Black Luna' }, asteroids: { labelKey: 'transits_group_asteroids', fallbackLabel: 'Asteroids' }, sensitive_points: { labelKey: 'observable_category_sensitive_points', fallbackLabel: 'Sensitive Points' }, geocentric_nodes: { labelKey: 'transits_group_geo_nodes', fallbackLabel: 'Geocentric Planetary Nodes' }, trans_neptunian: { labelKey: 'transits_group_tno', fallbackLabel: 'Trans-Neptunian Objects' }, fixed_stars: { labelKey: 'observable_category_fixed_stars', fallbackLabel: 'Fixed Stars' }, hypothetical: { labelKey: 'transits_group_hypotheticals', fallbackLabel: 'Hypothetical Bodies' }
};
export function getObservableObjectLabel(item: ObservableObjectDefinition, t: (key: string, options?: Record<string, unknown>) => string): string { return item.labelKey ? t(item.labelKey, { defaultValue: item.fallbackLabel }) : item.fallbackLabel; }
export function getObservableCategoryLabel(category: ObservableObjectCategory, t: (key: string, options?: Record<string, unknown>) => string): string { const meta = OBSERVABLE_OBJECT_CATEGORY_LABELS[category]; return meta.labelKey ? t(meta.labelKey, { defaultValue: meta.fallbackLabel }) : meta.fallbackLabel; }

/** Presentation-only colors; object identity and geometry come from Rust — same
 *  split as `DEFAULT_ASPECT_COLORS` in `aspects.ts`. Hand-picked for the
 *  classical/well-known bodies; everything else (asteroids, the restored
 *  placeholder categories, future catalog growth) falls back to a stable
 *  per-id pick from the same 4-token categorical palette `transits-results-
 *  dashboard.tsx` uses for series, via `getDefaultBodyColor`. */
export const DEFAULT_BODY_COLORS: Record<string, string> = {
	sun: '#f59e0b', moon: '#94a3b8', mercury: '#06b6d4', venus: '#ec4899', mars: '#ef4444',
	jupiter: '#f97316', saturn: '#78716c', uranus: '#14b8a6', neptune: '#3b82f6', pluto: '#7c3aed',
	north_node: '#22c55e', south_node: '#84cc16', true_north_node: '#22c55e', true_south_node: '#84cc16',
	chiron: '#a855f7', lilith: '#581c87', true_lilith: '#581c87',
	asc: '#f43f5e', mc: '#0ea5e9', desc: '#f43f5e', ic: '#0ea5e9'
};

/** Same 4 theme tokens as `categoricalPaletteForTheme` (`lib/dataviz/categoricalPalette.ts`)
 *  — inlined rather than imported to keep `lib/astrology` free of a `lib/dataviz` dependency;
 *  that function is itself theme-independent today (ignores its `_theme` argument). */
const FALLBACK_BODY_COLOR_TOKENS = ['var(--token-viz-1)', 'var(--token-viz-2)', 'var(--token-viz-3)', 'var(--token-viz-4)'];

function hashStringToIndex(id: string, modulus: number): number {
	let hash = 0;
	for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
	return hash % modulus;
}

export function getDefaultBodyColor(id: string): string {
	return DEFAULT_BODY_COLORS[id] ?? FALLBACK_BODY_COLOR_TOKENS[hashStringToIndex(id, FALLBACK_BODY_COLOR_TOKENS.length)]!;
}
