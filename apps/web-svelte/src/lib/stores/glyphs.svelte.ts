// Glyph management store
// - Supports switchable default glyph image sets
// - Allows per-glyph custom SVG overrides persisted in localStorage

export type GlyphSetId = 'kerykeion' | 'classic';

export interface GlyphDefinition {
  id: string;
  name: string;
  type: 'planet' | 'zodiac' | 'aspect' | 'custom';
  svg: string; // Unicode, inline SVG markup, or file path
  isCustom: boolean;
  customPath?: string; // Path/name of uploaded source
  size?: number; // Preferred render size in px
  fallback?: string; // Text fallback when file/markup cannot render
}

export interface GlyphSetOption {
  id: GlyphSetId;
  label: string;
  description: string;
}

export const glyphSetOptions: GlyphSetOption[] = [
  { id: 'kerykeion', label: 'Kerykeion', description: 'Vector astrology symbols.' },
  { id: 'classic', label: 'Classic', description: 'Compact textual glyph set.' },
];

const GLYPH_SET_STORAGE_KEY = 'glyph_set';
const CUSTOM_GLYPHS_STORAGE_KEY = 'custom_glyphs';

const glyphCatalog: Record<
  string,
  { name: string; type: 'planet' | 'zodiac'; fallback: string; size: number }
> = {
  // Planets
  sun: { name: 'Sun', type: 'planet', fallback: 'Su', size: 24 },
  moon: { name: 'Moon', type: 'planet', fallback: 'Mo', size: 24 },
  mercury: { name: 'Mercury', type: 'planet', fallback: 'Me', size: 24 },
  venus: { name: 'Venus', type: 'planet', fallback: 'Ve', size: 24 },
  mars: { name: 'Mars', type: 'planet', fallback: 'Ma', size: 24 },
  jupiter: { name: 'Jupiter', type: 'planet', fallback: 'Ju', size: 24 },
  saturn: { name: 'Saturn', type: 'planet', fallback: 'Sa', size: 24 },
  uranus: { name: 'Uranus', type: 'planet', fallback: 'Ur', size: 24 },
  neptune: { name: 'Neptune', type: 'planet', fallback: 'Ne', size: 24 },
  pluto: { name: 'Pluto', type: 'planet', fallback: 'Pl', size: 24 },

  // Zodiac
  aries: { name: 'Aries', type: 'zodiac', fallback: 'Ar', size: 24 },
  taurus: { name: 'Taurus', type: 'zodiac', fallback: 'Ta', size: 24 },
  gemini: { name: 'Gemini', type: 'zodiac', fallback: 'Ge', size: 24 },
  cancer: { name: 'Cancer', type: 'zodiac', fallback: 'Ca', size: 24 },
  leo: { name: 'Leo', type: 'zodiac', fallback: 'Le', size: 24 },
  virgo: { name: 'Virgo', type: 'zodiac', fallback: 'Vi', size: 24 },
  libra: { name: 'Libra', type: 'zodiac', fallback: 'Li', size: 24 },
  scorpio: { name: 'Scorpio', type: 'zodiac', fallback: 'Sc', size: 24 },
  sagittarius: { name: 'Sagittarius', type: 'zodiac', fallback: 'Sg', size: 24 },
  capricorn: { name: 'Capricorn', type: 'zodiac', fallback: 'Cp', size: 24 },
  aquarius: { name: 'Aquarius', type: 'zodiac', fallback: 'Aq', size: 24 },
  pisces: { name: 'Pisces', type: 'zodiac', fallback: 'Pi', size: 24 },
  asc: { name: 'Asc', type: 'planet', fallback: 'As', size: 24 },
  mc: { name: 'Mc', type: 'planet', fallback: 'Mc', size: 24 },
  ic: { name: 'Ic', type: 'planet', fallback: 'Ic', size: 24 },
  desc: { name: 'Desc', type: 'planet', fallback: 'Ds', size: 24 },
  north_node: { name: 'North Node', type: 'planet', fallback: 'NN', size: 24 },
  south_node: { name: 'South Node', type: 'planet', fallback: 'SN', size: 24 },
  lilith: { name: 'Lilith', type: 'planet', fallback: 'Li', size: 24 },
  chiron: { name: 'Chiron', type: 'planet', fallback: 'Ch', size: 24 },
};

/** Zodiac sign glyph ids in order: Aries 0°, Taurus 30°, ... Pisces 330°. Use for lookups, never hardcoded symbols. */
export const ZODIAC_SIGN_IDS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'] as const;

export function signIdFromLongitude(longitude: number): string {
  const normalized = ((longitude % 360) + 360) % 360;
  const index = Math.floor(normalized / 30) % 12;
  return ZODIAC_SIGN_IDS[index] ?? 'aries';
}

const fileBackedIds = new Set([
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
]);

const glyphAliasMap: Record<string, string> = {
  ascendant: 'asc',
  descendant: 'desc',
  true_north_node: 'north_node',
  true_south_node: 'south_node',
  truenode: 'north_node',
  meannode: 'north_node',
  mean_node: 'north_node',
  true_node: 'north_node',
  black_moon: 'lilith',
  black_moon_lilith: 'lilith',
  black_moon_mean: 'lilith',
  black_moon_natural: 'lilith',
  black_moon_osculating: 'lilith',
  blackmoonmean: 'lilith',
  blackmoonnatural: 'lilith',
  blackmoonosculating: 'lilith',
};

function normalizeGlyphId(id: string): string {
  const base = String(id ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return glyphAliasMap[base] ?? base;
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function isGlyphSetId(value: string): value is GlyphSetId {
  return glyphSetOptions.some((option) => option.id === value);
}

function glyphPathForSet(setId: GlyphSetId, type: 'planet' | 'zodiac', id: string): string {
  const folder = type === 'planet' ? 'planets' : 'zodiac';
  return `/glyphs/sets/${setId}/${folder}/${id}.svg`;
}

function buildDefaultGlyphs(setId: GlyphSetId): Record<string, GlyphDefinition> {
  return Object.entries(glyphCatalog).reduce((acc, [id, meta]) => {
    const svg = fileBackedIds.has(id) ? glyphPathForSet(setId, meta.type, id) : meta.fallback;
    acc[id] = {
      id,
      name: meta.name,
      type: meta.type,
      svg,
      isCustom: false,
      size: meta.size,
      fallback: meta.fallback,
    };
    return acc;
  }, {} as Record<string, GlyphDefinition>);
}

function loadStoredGlyphSet(): GlyphSetId {
  if (!hasLocalStorage()) return 'kerykeion';
  try {
    const stored = localStorage.getItem(GLYPH_SET_STORAGE_KEY);
    return stored && isGlyphSetId(stored) ? stored : 'kerykeion';
  } catch {
    return 'kerykeion';
  }
}

function persistGlyphSet(setId: GlyphSetId) {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(GLYPH_SET_STORAGE_KEY, setId);
  } catch (e) {
    console.warn('Failed to persist glyph set:', e);
  }
}

function persistCustomGlyphs() {
  if (!hasLocalStorage()) return;
  try {
    const customGlyphs = Object.values(glyphs)
      .filter((glyph) => glyph.isCustom)
      .reduce((acc, glyph) => {
        acc[glyph.id] = glyph;
        return acc;
      }, {} as Record<string, GlyphDefinition>);
    localStorage.setItem(CUSTOM_GLYPHS_STORAGE_KEY, JSON.stringify(customGlyphs));
  } catch (e) {
    console.warn('Failed to save custom glyphs:', e);
  }
}

export const glyphSettings = $state<{ activeSet: GlyphSetId }>({
  activeSet: loadStoredGlyphSet(),
});
export const glyphs = $state<Record<string, GlyphDefinition>>({});

function applyDefaultGlyphsForSet(setId: GlyphSetId) {
  const defaults = buildDefaultGlyphs(setId);
  for (const [id, defaultGlyph] of Object.entries(defaults)) {
    if (!glyphs[id] || !glyphs[id].isCustom) {
      glyphs[id] = defaultGlyph;
    }
  }
}

export function setGlyphSet(setId: GlyphSetId) {
  if (!glyphSetOptions.some((option) => option.id === setId)) return;
  if (glyphSettings.activeSet === setId) return;
  glyphSettings.activeSet = setId;
  applyDefaultGlyphsForSet(setId);
  persistGlyphSet(setId);
}

export function getGlyph(id: string): GlyphDefinition | undefined {
  return glyphs[normalizeGlyphId(id)];
}

export function getGlyphSvg(id: string): string {
  const glyph = glyphs[normalizeGlyphId(id)];
  if (!glyph) return '';
  return glyph.svg;
}

function isSvgMarkup(content: string): boolean {
  const value = content.trim();
  return value.startsWith('<svg') || value.startsWith('<?xml');
}

function isSvgPath(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  return normalized.endsWith('.svg') || normalized.includes('.svg?');
}

function isLegacyDefaultGlyphPath(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  return normalized.startsWith('/glyphs/planets/') || normalized.startsWith('/glyphs/zodiac/');
}

export function getGlyphContent(
  id: string,
): { type: 'unicode' | 'svg' | 'file'; content: string; size: number; fallback: string } {
  const normalizedId = normalizeGlyphId(id);
  const glyph = glyphs[normalizedId];
  if (!glyph) {
    const fallback = normalizedId.slice(0, 2).toUpperCase() || '??';
    return { type: 'unicode', content: fallback, size: 20, fallback };
  }

  const svg = glyph.svg;
  const size = glyph.size ?? 20;
  const fallback = glyph.fallback ?? glyph.name.charAt(0).toUpperCase();
  if (isSvgMarkup(svg)) return { type: 'svg', content: svg, size, fallback };
  if (isSvgPath(svg)) return { type: 'file', content: svg, size, fallback };
  return { type: 'unicode', content: svg, size, fallback };
}

export function setCustomGlyph(
  id: string,
  name: string,
  svg: string,
  type: 'planet' | 'zodiac' | 'aspect' | 'custom' = 'custom',
  customPath?: string,
  size: number = 24,
) {
  const normalizedId = normalizeGlyphId(id);
  const current = glyphs[normalizedId];
  glyphs[normalizedId] = {
    id: normalizedId,
    name,
    type,
    svg,
    isCustom: true,
    customPath,
    size,
    fallback: current?.fallback ?? name.charAt(0).toUpperCase(),
  };
  persistCustomGlyphs();
}

export function resetGlyphToDefault(id: string) {
  const normalizedId = normalizeGlyphId(id);
  const defaults = buildDefaultGlyphs(glyphSettings.activeSet);
  const defaultGlyph = defaults[normalizedId];
  if (!defaultGlyph) return;
  glyphs[normalizedId] = defaultGlyph;
  persistCustomGlyphs();
}

export function hardResetGlyphStorage() {
  const defaults = buildDefaultGlyphs(glyphSettings.activeSet);
  for (const [id, glyph] of Object.entries(defaults)) {
    glyphs[id] = glyph;
  }
  if (hasLocalStorage()) {
    try {
      localStorage.removeItem(CUSTOM_GLYPHS_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear custom glyph storage:', e);
    }
  }
}

export function loadCustomGlyphs() {
  if (!hasLocalStorage()) return;
  try {
    const stored = localStorage.getItem(CUSTOM_GLYPHS_STORAGE_KEY);
    if (!stored) return;
    const customGlyphs = JSON.parse(stored) as Record<string, GlyphDefinition>;
    const cleaned: Record<string, GlyphDefinition> = {};
    for (const glyph of Object.values(customGlyphs)) {
      // Ignore invalid payloads and legacy path-only overrides from previous schema.
      if (!glyph || typeof glyph !== 'object') continue;
      if (typeof glyph.svg !== 'string' || glyph.svg.trim() === '') continue;
      if (isLegacyDefaultGlyphPath(glyph.svg)) continue;

      if (typeof glyph.size !== 'number') glyph.size = 24;
      if (!glyph.fallback) {
        const meta = glyphCatalog[glyph.id];
        glyph.fallback = meta?.fallback ?? glyph.name.charAt(0).toUpperCase();
      }
      const normalizedId = normalizeGlyphId(glyph.id);
      glyph.id = normalizedId;
      cleaned[normalizedId] = glyph;
    }
    Object.assign(glyphs, cleaned);

    // Persist sanitized custom glyphs so migration runs only once.
    localStorage.setItem(CUSTOM_GLYPHS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.warn('Failed to load custom glyphs:', e);
  }
}

// Initialize defaults for active set and then apply custom overrides.
applyDefaultGlyphsForSet(glyphSettings.activeSet);
loadCustomGlyphs();
