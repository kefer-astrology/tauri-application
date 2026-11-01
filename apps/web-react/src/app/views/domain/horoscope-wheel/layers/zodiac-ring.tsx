import { elementForZodiacId, wheelZodiacFillOnDark } from '@/lib/astrology/elementColors';
import { catalogSigns } from '@/lib/astrology/domainCatalog';
import type { WheelStyleId } from '@/lib/astrology/wheelStyle';
import { longitudeToScreenRadians } from '@/lib/astrology/wheelGeometry';
import { WHEEL, type WheelFrame } from '../wheel-frame';
import { WheelTintedGlyphImage } from '../wheel-tinted-glyph';

const ZODIAC_PRESENTATION_GLYPHS: Record<string, string> = {
	aries: '♈',
	taurus: '♉',
	gemini: '♊',
	cancer: '♋',
	leo: '♌',
	virgo: '♍',
	libra: '♎',
	scorpio: '♏',
	sagittarius: '♐',
	capricorn: '♑',
	aquarius: '♒',
	pisces: '♓'
};

/** The twelve signs with their text glyph and start longitude. */
export const zodiacSigns = () =>
	catalogSigns().map((sign, index) => ({
		name: sign.name,
		id: sign.id,
		icon: ZODIAC_PRESENTATION_GLYPHS[sign.id] ?? sign.glyph,
		angle: index * 30
	}));

/** Zodiac ring: boundaries, sign dividers, the degree scale (technical style) and sign glyphs. */
export function ZodiacRing({ frame, wheelStyle }: { frame: WheelFrame; wheelStyle: WheelStyleId }) {
	const { center, outerRadius, innerRadius, zodiacRingStrokeWidth, zodiacRadius } = WHEEL;
	const { strokeMain, strokeSoft } = WHEEL;
	const { displayLon, isDark, elementColors } = frame;

	return (
		<>
			<circle
				cx={center}
				cy={center}
				r={outerRadius}
				fill="none"
				stroke={strokeMain}
				strokeWidth={zodiacRingStrokeWidth}
			/>
			<circle
				cx={center}
				cy={center}
				r={innerRadius}
				fill="none"
				stroke={strokeMain}
				strokeWidth={zodiacRingStrokeWidth}
			/>

			{zodiacSigns().map((sign, idx) => {
				const rad = longitudeToScreenRadians(displayLon(sign.angle));
				const x1 = center + innerRadius * Math.cos(rad);
				const y1 = center + innerRadius * Math.sin(rad);
				const x2 = center + outerRadius * Math.cos(rad);
				const y2 = center + outerRadius * Math.sin(rad);
				return (
					<line
						key={`cusp-${idx}`}
						x1={x1}
						y1={y1}
						x2={x2}
						y2={y2}
						stroke={strokeSoft}
						strokeWidth={zodiacRingStrokeWidth}
					/>
				);
			})}

			{wheelStyle === 'technical' && (
				<g>
					{Array.from({ length: 360 }, (_, i) => {
						const rad = longitudeToScreenRadians(displayLon(i));
						const is10Degree = i % 10 === 0;
						const is5Degree = i % 5 === 0 && !is10Degree;
						const ringWidth = outerRadius - innerRadius;
						/** 10° ticks read longer; 5° ticks stay 1°-length but bolder. */
						const tickLength = is10Degree ? ringWidth * 0.48 * 0.6 : ringWidth * 0.14;
						const tickWidth = is10Degree || is5Degree ? zodiacRingStrokeWidth : 0.6;
						const x1 = center + innerRadius * Math.cos(rad);
						const y1 = center + innerRadius * Math.sin(rad);
						const x2 = center + (innerRadius + tickLength) * Math.cos(rad);
						const y2 = center + (innerRadius + tickLength) * Math.sin(rad);
						return (
							<line
								key={`inner-tick-${i}`}
								x1={x1}
								y1={y1}
								x2={x2}
								y2={y2}
								stroke={strokeSoft}
								strokeWidth={tickWidth}
							/>
						);
					})}
				</g>
			)}

			{zodiacSigns().map((sign) => {
				const rad = longitudeToScreenRadians(displayLon(sign.angle + 15));
				const x = center + zodiacRadius * Math.cos(rad);
				const y = center + zodiacRadius * Math.sin(rad);
				const el = elementForZodiacId(sign.id);
				const base = elementColors[el];
				const fill = isDark ? wheelZodiacFillOnDark(base) : base;
				const zHref = frame.zodiacGlyphSrc(sign.id);
				return zHref ? (
					<WheelTintedGlyphImage
						key={sign.name}
						href={zHref}
						x={x}
						y={y}
						size={24}
						filterId={`${frame.filterUid}-z-${sign.id}`}
					/>
				) : (
					<text
						key={sign.name}
						x={x}
						y={y}
						textAnchor="middle"
						dominantBaseline="middle"
						fontSize="20"
						fontWeight="500"
						fill={fill}
					>
						{sign.icon}
					</text>
				);
			})}
		</>
	);
}
