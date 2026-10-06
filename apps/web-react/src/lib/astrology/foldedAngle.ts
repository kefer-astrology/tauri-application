/**
 * Folds an ecliptic-longitude-style angle onto a 0°–180° scale.
 *
 * Coordinate system: geocentric ecliptic longitude (tropical zodiac), θ measured
 * eastward from 0° Aries (the vernal equinox) — the same convention already used
 * for `transit_positions` returned by `compute_transit_series`.
 *
 * θ is first normalized into [0°, 360°), then folded as f(θ) = min(θ, 360° − θ),
 * so a full revolution reads 0° → 180° → 0° with no discontinuity at the 0°/360°
 * wrap (both ends map to 0°). This preserves the actual rate of motion (including
 * retrograde loops and stations) — it is a reflection of the raw angle, not a
 * sinusoidal projection.
 */

export function normalizeDegrees(value: number): number {
	return ((value % 360) + 360) % 360;
}

export function foldTo180(thetaDegrees: number): number {
	const theta = normalizeDegrees(thetaDegrees);
	return Math.min(theta, 360 - theta);
}
