/** Mirrors `src-tauri/src/domain/midpoints.rs`'s `Midpoint` struct — field names match the Rust
 *  struct's own (snake_case) serialization verbatim, same convention as `TransitAspect`. */
export interface Midpoint {
	object_a: string;
	object_b: string;
	chart_id: string | null;
	/** The midpoint on the shorter arc between `object_a` and `object_b`, normalized [0, 360). */
	position: number;
	/** The antipode, `position + 180`, normalized [0, 360). */
	opposite: number;
	/** True when `object_a`/`object_b` are ~180° apart — both arcs are equal length, so "the
	 *  shorter arc" isn't well-defined; `position`/`opposite` are still both populated. */
	ambiguous: boolean;
}

/** Mirrors `src-tauri/src/domain/astrology.rs`'s `MidpointContactPoint` enum. */
export type MidpointContactPoint = 'position' | 'opposite' | 'both';

/** Mirrors `src-tauri/src/domain/astrology.rs`'s `MidpointContact` struct. */
export interface MidpointContact {
	contact_object: string;
	object_a: string;
	object_b: string;
	aspect_type: string;
	contact_point: MidpointContactPoint;
	angle: number;
	exact_angle: number;
	orb: number;
	allowed_orb: number;
}

/** Aspect ids eligible for midpoint-axis contacts — mirrors
 *  `src-tauri/src/domain/astrology.rs`'s `MIDPOINT_CONTACT_ASPECT_IDS`. `octile`/`trioctile` are
 *  the existing catalog's names for semisquare (45°) and sesquisquare (135°). */
export const MIDPOINT_CONTACT_ASPECT_IDS = [
	'conjunction',
	'opposition',
	'square',
	'octile',
	'trioctile'
] as const;
