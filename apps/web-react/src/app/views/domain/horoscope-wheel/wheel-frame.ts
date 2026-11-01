import { useId, type MouseEvent } from 'react';
import { normalizeDegrees } from '@/lib/astrology/foldedAngle';
import { getAstrologyGlyphSrc, getZodiacGlyphSrc } from '@/lib/astrology/glyphs';
import { resolveCustomGlyphSrc, useCustomGlyphOverrides } from '@/lib/astrology/customGlyphs';
import type { ElementColors } from '@/lib/astrology/elementColors';
import { useAppTheme } from '@/app/providers/app-theme';

const houseInnerRadius = 152;
const houseOuterRadius = houseInnerRadius + 20;
const innerRadius = 270;
const outerRadius = 320;
/** Small outward nudge from the mid-band radii (larger values crowd the layout). */
const glyphRadialOutset = 3;
/** Fraction of the way from the house band to the zodiac ring; above 0.5 biases glyphs outward,
 *  where they are easier to find and click. */
const planetBandOuterBias = 0.62;

/** Fixed radii and strokes of the 800 × 800 wheel. */
export const WHEEL = {
	size: 800,
	center: 400,
	outerRadius,
	innerRadius,
	/** Outer and inner boundary, sign dividers and bold degree ticks share one weight. */
	zodiacRingStrokeWidth: 2,
	innerCenterRing: 184,
	/** The house band sits flush against the innermost circle, so its inner edge is that circle. */
	innerCenterCore: houseInnerRadius,
	houseInnerRadius,
	houseOuterRadius,
	houseLabelRadius: (houseInnerRadius + houseOuterRadius) / 2,
	planetRadius:
		houseOuterRadius +
		(innerRadius - houseOuterRadius) * planetBandOuterBias -
		8 +
		glyphRadialOutset,
	/** Aspect chords stop at the first inner circle, keeping the band to the second circle clear. */
	aspectChordRadius: houseInnerRadius,
	zodiacRadius: (innerRadius + outerRadius) / 2 + glyphRadialOutset,
	transitRingInnerRadius: outerRadius + 18,
	transitRingOuterRadius: outerRadius + 58,
	transitGlyphRadius: outerRadius + 38,
	angleMarkerRadius: outerRadius + 22,
	strokeMain: 'var(--token-wheel-stroke-main)',
	strokeSoft: 'var(--token-wheel-stroke-soft)',
	fillBg: 'var(--token-wheel-bg)'
} as const;

export type WheelObjectLayer = 'radix' | 'transit';

/** What every layer needs from one render: theme, rotation, glyph sources and tint filters. */
export interface WheelFrame {
	isDark: boolean;
	hasGlyphSet: boolean;
	/** Screen longitude after rotating the chosen longitude to the left edge. */
	displayLon: (lon: number) => number;
	astrologyGlyphSrc: (id: string) => string | null;
	zodiacGlyphSrc: (id: string) => string | null;
	elementColors: ElementColors;
	bodyColors?: Record<string, string>;
	lightPlanetFill: string;
	filterUid: string;
	planetLightFilterId: string;
	planetDarkFilterId: string;
	transitFilterId: string;
	/** Glyph color of uncolored radix bodies (and house numbers). */
	planetGlyphColor: string;
	bodyGlyphFilterId: (id: string) => string;
	bodyGlyphFillColor: (id: string) => string;
	/** Transit bodies fall back to the accent tint, which marks the transit layer. */
	transitGlyphFilterId: (id: string) => string;
	transitGlyphFillColor: (id: string) => string;
	emitObjectClick: (event: MouseEvent<SVGElement>, bodyId: string, layer: WheelObjectLayer) => void;
}

/** The wheel's per-render frame. Call once, in the wheel itself, so its filter ids stay stable. */
export function useWheelFrame({
	leftEdgeLongitude,
	elementColors,
	bodyColors,
	lightPlanetFill,
	onObjectClick
}: {
	leftEdgeLongitude?: number;
	elementColors: ElementColors;
	bodyColors?: Record<string, string>;
	lightPlanetFill: string;
	onObjectClick?: (interaction: { bodyId: string; layer: WheelObjectLayer }) => void;
}): WheelFrame {
	const { theme, glyphSet } = useAppTheme();
	const isDark = theme === 'midnight' || theme === 'twilight';
	const customGlyphOverrides = useCustomGlyphOverrides();
	const filterUid = useId().replace(/:/g, '');
	const planetLightFilterId = `${filterUid}-pl`;
	const planetDarkFilterId = `${filterUid}-pd`;
	const transitFilterId = `${filterUid}-tr`;
	const rotationOffset =
		typeof leftEdgeLongitude === 'number' && Number.isFinite(leftEdgeLongitude)
			? -normalizeDegrees(leftEdgeLongitude)
			: 0;
	const planetGlyphColor = isDark ? 'var(--token-wheel-glyph)' : lightPlanetFill;

	return {
		isDark,
		hasGlyphSet: Boolean(glyphSet),
		displayLon: (lon) => normalizeDegrees(lon + rotationOffset),
		astrologyGlyphSrc: (id) =>
			resolveCustomGlyphSrc(customGlyphOverrides, id) ??
			(glyphSet ? getAstrologyGlyphSrc(glyphSet, id) : null),
		zodiacGlyphSrc: (id) =>
			resolveCustomGlyphSrc(customGlyphOverrides, id) ??
			(glyphSet ? getZodiacGlyphSrc(glyphSet, id) : null),
		elementColors,
		bodyColors,
		lightPlanetFill,
		filterUid,
		planetLightFilterId,
		planetDarkFilterId,
		transitFilterId,
		planetGlyphColor,
		bodyGlyphFilterId: (id) =>
			bodyColors?.[id] ? `${filterUid}-b-${id}` : isDark ? planetDarkFilterId : planetLightFilterId,
		bodyGlyphFillColor: (id) => bodyColors?.[id] ?? planetGlyphColor,
		transitGlyphFilterId: (id) => (bodyColors?.[id] ? `${filterUid}-b-${id}` : transitFilterId),
		transitGlyphFillColor: (id) => bodyColors?.[id] ?? 'var(--theme-accent)',
		emitObjectClick: (event, bodyId, layer) => {
			event.stopPropagation();
			onObjectClick?.({ bodyId, layer });
		}
	};
}
