// Glyph management store
// - Supports switchable default glyph image sets
// - Allows per-glyph custom SVG overrides persisted in localStorage

import { OBSERVABLE_OBJECTS } from '../astrology/observableObjects';
import { ASPECT_ROWS, ASPECT_GLYPHS } from '../astrology/aspects';

export type GlyphSetId = 'default' | 'modern';

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
  { id: 'default', label: 'Default', description: 'Current shared astrology glyph set.' },
  { id: 'modern', label: 'Modern', description: 'Alternate shared astrology glyph set.' },
];

const GLYPH_SET_STORAGE_KEY = 'glyph_set';
const CUSTOM_GLYPHS_STORAGE_KEY = 'custom_glyphs';
const ASSET_BASE_URL = import.meta.env.BASE_URL;
const SVELTE_GLYPH_SCALE = 0.9;

type GlyphCatalogType = 'planet' | 'zodiac' | 'aspect';

/** Zodiac signs aren't in `OBSERVABLE_OBJECTS` (that registry is bodies/points only), so
 *  their names + 2-letter fallbacks stay a small local table. */
const ZODIAC_META: Record<string, { name: string; fallback: string }> = {
  aries: { name: 'Aries', fallback: 'Ar' },
  taurus: { name: 'Taurus', fallback: 'Ta' },
  gemini: { name: 'Gemini', fallback: 'Ge' },
  cancer: { name: 'Cancer', fallback: 'Ca' },
  leo: { name: 'Leo', fallback: 'Le' },
  virgo: { name: 'Virgo', fallback: 'Vi' },
  libra: { name: 'Libra', fallback: 'Li' },
  scorpio: { name: 'Scorpio', fallback: 'Sc' },
  sagittarius: { name: 'Sagittarius', fallback: 'Sg' },
  capricorn: { name: 'Capricorn', fallback: 'Cp' },
  aquarius: { name: 'Aquarius', fallback: 'Aq' },
  pisces: { name: 'Pisces', fallback: 'Pi' },
};

function titleCase(id: string): string {
  return id
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Every id the UI can show — planets/angles/nodes/asteroids/TNOs/hypothetical points from
 * `OBSERVABLE_OBJECTS`, zodiac signs, and aspect types from `ASPECT_ROWS` — derived directly
 * from those registries so this catalog can't silently drift out of sync with them again.
 */
const glyphCatalog: Record<
  string,
  { name: string; type: GlyphCatalogType; fallback: string; size: number }
> = {
  ...Object.fromEntries(
    OBSERVABLE_OBJECTS.map((item) => [
      item.id,
      { name: item.label, type: 'planet' as const, fallback: item.icon, size: 24 }
    ])
  ),
  ...Object.fromEntries(
    Object.entries(ZODIAC_META).map(([id, meta]) => [
      id,
      { name: meta.name, type: 'zodiac' as const, fallback: meta.fallback, size: 24 }
    ])
  ),
  ...Object.fromEntries(
    ASPECT_ROWS.map((row) => [
      row.id,
      {
        name: titleCase(row.id),
        type: 'aspect' as const,
        fallback: ASPECT_GLYPHS[row.id] ?? row.id.slice(0, 3),
        size: 20
      }
    ])
  )
};

/** Zodiac sign glyph ids in order: Aries 0°, Taurus 30°, ... Pisces 330°. Use for lookups, never hardcoded symbols. */
export const ZODIAC_SIGN_IDS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'] as const;

export function signIdFromLongitude(longitude: number): string {
  const normalized = ((longitude % 360) + 360) % 360;
  const index = Math.floor(normalized / 30) % 12;
  return ZODIAC_SIGN_IDS[index] ?? 'aries';
}

/** Every catalog id now has a generated (or hand-drawn) static asset behind it. */
const fileBackedIds = new Set(Object.keys(glyphCatalog));

/** Fixed stars (`star_*`, no per-star art yet) share one generic placeholder asset. */
function planetAssetId(id: string): string {
  return id.startsWith('star_') ? 'fixed_star_generic' : id;
}

const glyphAliasMap: Record<string, string> = {
  ascendant: 'asc',
  descendant: 'desc',
  dsc: 'desc',
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

function normalizeGlyphSetId(value: string | null): GlyphSetId {
  if (value === 'kerykeion' || value === 'classic') return 'modern';
  if (value === 'default' || value === 'modern') return value;
  return 'default';
}

function glyphPathForSet(setId: GlyphSetId, type: GlyphCatalogType, id: string): string {
  const folder = type === 'zodiac' ? 'zodiac' : type === 'aspect' ? 'aspects' : 'planets';
  const normalizedBase = ASSET_BASE_URL.endsWith('/') ? ASSET_BASE_URL : `${ASSET_BASE_URL}/`;
  const assetId = type === 'planet' ? planetAssetId(id) : id;
  return `${normalizedBase}glyphs/${setId}/${folder}/${assetId}.svg`;
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
  if (!hasLocalStorage()) return 'default';
  try {
    const stored = localStorage.getItem(GLYPH_SET_STORAGE_KEY);
    return normalizeGlyphSetId(stored);
  } catch {
    return 'default';
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
    return {
      type: 'unicode',
      content: fallback,
      size: Math.round(20 * SVELTE_GLYPH_SCALE),
      fallback
    };
  }

  const svg = glyph.svg;
  const size = Math.round((glyph.size ?? 20) * SVELTE_GLYPH_SCALE);
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
