/** A computed aspect as the Rust backend serializes it (`domain::astrology::ComputedAspect`),
 *  parsed defensively since it arrives as `unknown` JSON. Shared by every view that reads
 *  `chart.computed.aspects` / a transit overlay's aspects, so they all show the same fields
 *  instead of each re-deriving a slightly different subset. */
export interface ParsedAspect {
	from: string;
	to: string;
	type: string;
	orb: number;
	angle?: number;
	exactAngle?: number;
	applying?: boolean;
	separating?: boolean;
}

export function parseComputedAspect(raw: unknown): ParsedAspect | null {
	if (!raw || typeof raw !== 'object') return null;
	const value = raw as Record<string, unknown>;
	const from = typeof value.from === 'string' ? value.from : null;
	const to = typeof value.to === 'string' ? value.to : null;
	const type = typeof value.type === 'string' ? value.type : null;
	const orbRaw = value.orb;
	const orb =
		typeof orbRaw === 'number' ? orbRaw : typeof orbRaw === 'string' ? Number(orbRaw) : NaN;
	if (!from || !to || !type || !Number.isFinite(orb)) return null;
	const angleRaw = value.angle;
	const exactAngleRaw = value.exact_angle;
	return {
		from,
		to,
		type,
		orb,
		angle: typeof angleRaw === 'number' && Number.isFinite(angleRaw) ? angleRaw : undefined,
		exactAngle:
			typeof exactAngleRaw === 'number' && Number.isFinite(exactAngleRaw)
				? exactAngleRaw
				: undefined,
		applying: value.applying === true,
		separating: value.separating === true
	};
}

/** `desc`/`dsc` alias handling so an aspect touching the descendant matches regardless of which
 *  spelling the caller (or the wheel's own body ids) uses. */
export function normalizePointId(id: string): string {
	const trimmed = id.trim().toLowerCase();
	return trimmed === 'desc' ? 'dsc' : trimmed;
}

/** Every aspect in `aspects` that touches `bodyId`, preserving order. */
export function aspectsTouchingBody(aspects: readonly ParsedAspect[], bodyId: string) {
	const normalizedBodyId = normalizePointId(bodyId);
	return aspects.filter(
		(aspect) =>
			normalizePointId(aspect.from) === normalizedBodyId ||
			normalizePointId(aspect.to) === normalizedBodyId
	);
}
