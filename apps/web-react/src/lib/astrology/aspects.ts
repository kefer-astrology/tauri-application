export const ASPECT_ROWS = [
	{ id: 'conjunction', labelKey: 'aspect_conjunction', defaultOrb: 8 },
	{ id: 'sextile', labelKey: 'aspect_sextile', defaultOrb: 6 },
	{ id: 'square', labelKey: 'aspect_square', defaultOrb: 8 },
	{ id: 'trine', labelKey: 'aspect_trine', defaultOrb: 8 },
	{ id: 'quincunx', labelKey: 'aspect_quincunx', defaultOrb: 3 },
	{ id: 'opposition', labelKey: 'aspect_opposition', defaultOrb: 8 }
] as const;

export type AspectRowId = (typeof ASPECT_ROWS)[number]['id'];

export const DEFAULT_ASPECT_ORBS: Record<AspectRowId, number> = Object.fromEntries(
	ASPECT_ROWS.map((aspect) => [aspect.id, aspect.defaultOrb])
) as Record<AspectRowId, number>;

export const DEFAULT_ASPECT_COLORS: Record<AspectRowId, string> = {
	conjunction: '#f59e0b',
	sextile: '#10b981',
	square: '#ef4444',
	trine: '#3b82f6',
	quincunx: '#8b5cf6',
	opposition: '#f97316'
};
