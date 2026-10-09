import type { AspectDefinitionDto, ObjectTypeRuleDto } from '@/lib/tauri/types';

export type AspectType = 'major' | 'minor';

export type AspectRow = {
	id: string;
	labelKey: string;
	fallbackLabel: string;
	glyph: string;
	color: string;
	angle: number;
	harmonic: number;
	type: AspectType;
	defaultOrb: number;
	/** Raw catalog rule, once a workspace has configured this aspect's object scope. */
	objectTypeRule: ObjectTypeRuleDto | null;
};

/** Runtime projection of the Rust model catalog. */
export const ASPECT_ROWS: AspectRow[] = [];

export function setAspectDefinitions(definitions: AspectDefinitionDto[], defaultAspectIds?: string[]): void {
	ASPECT_ROWS.splice(
		0,
		ASPECT_ROWS.length,
		...definitions.map((definition) => ({
			id: definition.id,
			labelKey: `aspect_${definition.id}`,
			fallbackLabel: definition.i18n.en ?? humanizeId(definition.id),
			glyph: definition.glyph || ASPECT_GLYPHS[definition.id] || humanizeId(definition.id).slice(0, 3),
			color: definition.color || DEFAULT_ASPECT_COLORS[definition.id] || colorForId(definition.id),
			angle: definition.angle,
			harmonic: definition.harmonic,
			type: definition.type,
			defaultOrb: definition.default_orb,
			objectTypeRule: definition.object_type_rule ?? null
		}))
	);
	for (const key of Object.keys(ASPECT_ANGLES)) delete ASPECT_ANGLES[key];
	for (const row of ASPECT_ROWS) ASPECT_ANGLES[row.id] = row.angle;
	for (const key of Object.keys(DEFAULT_ASPECT_ORBS)) delete DEFAULT_ASPECT_ORBS[key];
	for (const row of ASPECT_ROWS) DEFAULT_ASPECT_ORBS[row.id] = row.defaultOrb;
	for (const definition of definitions) {
		ASPECT_GLYPHS[definition.id] = definition.glyph || ASPECT_GLYPHS[definition.id] || humanizeId(definition.id).slice(0, 3);
		DEFAULT_ASPECT_COLORS[definition.id] = definition.color || DEFAULT_ASPECT_COLORS[definition.id] || colorForId(definition.id);
	}
	if (defaultAspectIds) {
		DEFAULT_ENABLED_ASPECT_IDS.splice(0, DEFAULT_ENABLED_ASPECT_IDS.length, ...defaultAspectIds);
	}
}

function humanizeId(id: string): string {
	return id
		.replace(/[_-]+/g, ' ')
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function colorForId(id: string): string {
	let hash = 0;
	for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	return `hsl(${hash % 360} 65% 52%)`;
}

export type AspectRowId = string;

/** Original six defaults remain a product choice; the catalog itself comes from Rust. */
export const DEFAULT_ENABLED_ASPECT_IDS: AspectRowId[] = [
	'conjunction',
	'sextile',
	'square',
	'trine',
	'quincunx',
	'opposition'
];

export const ASPECT_ANGLES: Record<string, number> = {};
export const DEFAULT_ASPECT_ORBS: Record<string, number> = {};

/** Presentation-only colors; aspect identity and geometry come from Rust. */
export const DEFAULT_ASPECT_COLORS: Record<string, string> = {
	conjunction: '#f59e0b',
	sextile: '#10b981',
	square: '#ef4444',
	trine: '#3b82f6',
	opposition: '#f97316',
	semisextile: '#a855f7',
	undecile: '#f97316',
	decile: '#14b8a6',
	novile: '#06b6d4',
	octile: '#ec4899',
	septile: '#84cc16',
	biundecile: '#0ea5e9',
	quintile: '#6366f1',
	binovile: '#0ea5e9',
	triundecile: '#14b8a6',
	biseptile: '#84cc16',
	tridecile: '#22c55e',
	quadriundecile: '#0891b2',
	trioctile: '#f43f5e',
	biquintile: '#d946ef',
	quincunx: '#8b5cf6',
	triseptile: '#84cc16',
	quadrinovile: '#0891b2',
	quinundecile: '#0ea5e9'
};

export const ASPECT_GLYPHS: Record<string, string> = {
	conjunction: '☌',
	sextile: '⚹',
	square: '□',
	trine: '△',
	opposition: '☍',
	quincunx: '⚻',
	semisextile: 'SSx',
	undecile: 'Und',
	decile: 'Dec',
	novile: 'Nov',
	octile: 'Oct',
	septile: 'Sep',
	biundecile: 'bUnd',
	quintile: 'Qui',
	binovile: 'bNv',
	triundecile: 'TriUnd',
	biseptile: 'bSep',
	tridecile: 'TriDec',
	quadriundecile: 'qUnd',
	trioctile: 'TriOct',
	biquintile: 'bQi',
	triseptile: 'TriSep',
	quadrinovile: 'qNv',
	quinundecile: 'qUnd'
};

export type AspectLineStyleId = 'solid' | 'dashed' | 'dotted';

function isAspectLineStyleId(value: unknown): value is AspectLineStyleId {
	return value === 'solid' || value === 'dashed' || value === 'dotted';
}

export interface AspectLineTierStyleState {
	tightThresholdPct: number;
	mediumThresholdPct: number;
	looseThresholdPct: number;
	widthTight: number;
	widthMedium: number;
	widthLoose: number;
	widthOuter: number;
	outerLineStyle: AspectLineStyleId;
}

export const DEFAULT_ASPECT_LINE_TIER_STYLE: AspectLineTierStyleState = {
	tightThresholdPct: 1,
	mediumThresholdPct: 2,
	looseThresholdPct: 10,
	widthTight: 5,
	widthMedium: 2,
	widthLoose: 1,
	widthOuter: 1,
	outerLineStyle: 'dotted'
};

export function normalizeAspectLineTierStyle(value: unknown): AspectLineTierStyleState {
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
		widthOuter: numberOr('widthOuter', DEFAULT_ASPECT_LINE_TIER_STYLE.widthOuter),
		outerLineStyle: isAspectLineStyleId(source.outerLineStyle)
			? source.outerLineStyle
			: DEFAULT_ASPECT_LINE_TIER_STYLE.outerLineStyle
	};
}
