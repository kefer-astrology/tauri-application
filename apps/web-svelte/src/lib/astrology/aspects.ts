export type AspectType = 'major' | 'minor';

export const ASPECT_ROWS = [
  { id: 'conjunction', labelKey: 'aspect_conjunction', angle: 0, harmonic: 1, type: 'major', defaultOrb: 8 },
  { id: 'sextile', labelKey: 'aspect_sextile', angle: 60, harmonic: 6, type: 'major', defaultOrb: 6 },
  { id: 'square', labelKey: 'aspect_square', angle: 90, harmonic: 4, type: 'major', defaultOrb: 8 },
  { id: 'trine', labelKey: 'aspect_trine', angle: 120, harmonic: 3, type: 'major', defaultOrb: 8 },
  { id: 'opposition', labelKey: 'aspect_opposition', angle: 180, harmonic: 2, type: 'major', defaultOrb: 8 },
  { id: 'semisextile', labelKey: 'aspect_semisextile', angle: 30, harmonic: 12, type: 'minor', defaultOrb: 2 },
  { id: 'decile', labelKey: 'aspect_decile', angle: 36, harmonic: 10, type: 'minor', defaultOrb: 1 },
  { id: 'novile', labelKey: 'aspect_novile', angle: 40, harmonic: 9, type: 'minor', defaultOrb: 1 },
  { id: 'semisquare', labelKey: 'aspect_semisquare', angle: 45, harmonic: 8, type: 'minor', defaultOrb: 2 },
  { id: 'septile', labelKey: 'aspect_septile', angle: 360 / 7, harmonic: 7, type: 'minor', defaultOrb: 1 },
  { id: 'quintile', labelKey: 'aspect_quintile', angle: 72, harmonic: 5, type: 'minor', defaultOrb: 2 },
  { id: 'binovile', labelKey: 'aspect_binovile', angle: 80, harmonic: 9, type: 'minor', defaultOrb: 1 },
  { id: 'quincunx', labelKey: 'aspect_quincunx', angle: 150, harmonic: 12, type: 'minor', defaultOrb: 3 },
  { id: 'tridecile', labelKey: 'aspect_tridecile', angle: 108, harmonic: 10, type: 'minor', defaultOrb: 1 },
  {
    id: 'sesquiquadrate',
    labelKey: 'aspect_sesquiquadrate',
    angle: 135,
    harmonic: 8,
    type: 'minor',
    defaultOrb: 2
  },
  { id: 'biquintile', labelKey: 'aspect_biquintile', angle: 144, harmonic: 5, type: 'minor', defaultOrb: 2 },
  {
    id: 'quadrinovile',
    labelKey: 'aspect_quadrinovile',
    angle: 160,
    harmonic: 9,
    type: 'minor',
    defaultOrb: 1
  }
] as const satisfies readonly {
  id: string;
  labelKey: string;
  angle: number;
  harmonic: number;
  type: AspectType;
  defaultOrb: number;
}[];

export type AspectRowId = (typeof ASPECT_ROWS)[number]['id'];

/** Original 6 aspects — kept as the default-enabled set so extending the catalog with
 *  more minor aspects doesn't silently opt every workspace into all of them. */
export const DEFAULT_ENABLED_ASPECT_IDS: AspectRowId[] = [
  'conjunction',
  'sextile',
  'square',
  'trine',
  'quincunx',
  'opposition'
];

export const ASPECT_ANGLES: Record<AspectRowId, number> = Object.fromEntries(
  ASPECT_ROWS.map((aspect) => [aspect.id, aspect.angle])
) as Record<AspectRowId, number>;

export const DEFAULT_ASPECT_ORBS: Record<AspectRowId, number> = Object.fromEntries(
  ASPECT_ROWS.map((aspect) => [aspect.id, aspect.defaultOrb])
) as Record<AspectRowId, number>;

export const DEFAULT_ASPECT_COLORS: Record<AspectRowId, string> = {
  conjunction: '#f59e0b',
  sextile: '#10b981',
  square: '#ef4444',
  trine: '#3b82f6',
  opposition: '#f97316',
  semisextile: '#a855f7',
  decile: '#14b8a6',
  novile: '#06b6d4',
  semisquare: '#ec4899',
  septile: '#84cc16',
  quintile: '#6366f1',
  binovile: '#0ea5e9',
  quincunx: '#8b5cf6',
  tridecile: '#22c55e',
  sesquiquadrate: '#f43f5e',
  biquintile: '#d946ef',
  quadrinovile: '#0891b2'
};

export const ASPECT_GLYPHS: Record<string, string> = {
  conjunction: '☌',
  sextile: '⚹',
  square: '□',
  trine: '△',
  opposition: '☍',
  quincunx: '⚻',
  semisextile: 'SSx',
  decile: 'Dec',
  novile: 'Nov',
  semisquare: 'SSq',
  septile: 'Sep',
  quintile: 'Qui',
  binovile: 'bNv',
  tridecile: 'Tri',
  sesquiquadrate: 'SqQ',
  biquintile: 'bQi',
  quadrinovile: 'qNv'
};

export interface AspectLineTierStyleState {
  tightThresholdPct: number;
  mediumThresholdPct: number;
  looseThresholdPct: number;
  widthTight: number;
  widthMedium: number;
  widthLoose: number;
  widthOuter: number;
}

export const DEFAULT_ASPECT_LINE_TIER_STYLE: AspectLineTierStyleState = {
  tightThresholdPct: 1,
  mediumThresholdPct: 2,
  looseThresholdPct: 10,
  widthTight: 5,
  widthMedium: 2,
  widthLoose: 1,
  widthOuter: 1
};

export function normalizeAspectLineTierStyle(
  value: unknown
): AspectLineTierStyleState {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const numberOr = (key: string, fallback: number) => {
    const candidate = source[key];
    return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback;
  };

  return {
    tightThresholdPct: numberOr('tightThresholdPct', DEFAULT_ASPECT_LINE_TIER_STYLE.tightThresholdPct),
    mediumThresholdPct: numberOr('mediumThresholdPct', DEFAULT_ASPECT_LINE_TIER_STYLE.mediumThresholdPct),
    looseThresholdPct: numberOr('looseThresholdPct', DEFAULT_ASPECT_LINE_TIER_STYLE.looseThresholdPct),
    widthTight: numberOr('widthTight', DEFAULT_ASPECT_LINE_TIER_STYLE.widthTight),
    widthMedium: numberOr('widthMedium', DEFAULT_ASPECT_LINE_TIER_STYLE.widthMedium),
    widthLoose: numberOr('widthLoose', DEFAULT_ASPECT_LINE_TIER_STYLE.widthLoose),
    widthOuter: numberOr('widthOuter', DEFAULT_ASPECT_LINE_TIER_STYLE.widthOuter)
  };
}
