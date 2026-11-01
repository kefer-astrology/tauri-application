import { elementForZodiacId, wheelZodiacFillOnDark } from '@/lib/astrology/elementColors';
import type { WheelFrame } from '../wheel-frame';
import { zodiacSigns } from './zodiac-ring';

/** A filter that paints a glyph image in one solid color. */
function TintFilter({ id, color, suffix }: { id: string; color: string; suffix: string }) {
	return (
		<filter id={id} colorInterpolationFilters="sRGB" x="-50%" y="-50%" width="200%" height="200%">
			<feFlood floodColor={color} floodOpacity="1" result={`${suffix}c`} />
			<feComposite in={`${suffix}c`} in2="SourceGraphic" operator="in" result={`${suffix}r`} />
			<feMerge>
				<feMergeNode in={`${suffix}r`} />
			</feMerge>
		</filter>
	);
}

/** `<defs>`: the selection halo and the tint filters for glyph images (planets, signs, colored
 *  bodies, the transit ring). */
export function WheelFilters({ frame }: { frame: WheelFrame }) {
	const { isDark, hasGlyphSet, lightPlanetFill, bodyColors } = frame;
	return (
		<defs>
			<filter id="hw-planet-halo" x="-100%" y="-100%" width="300%" height="300%">
				<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
				<feMerge>
					<feMergeNode in="blur" />
					<feMergeNode in="SourceGraphic" />
				</feMerge>
			</filter>
			{hasGlyphSet ? (
				<>
					{!isDark && (
						<TintFilter id={frame.planetLightFilterId} color={lightPlanetFill} suffix="" />
					)}
					{isDark && <TintFilter id={frame.planetDarkFilterId} color={lightPlanetFill} suffix="" />}
				</>
			) : null}
			{hasGlyphSet
				? zodiacSigns().map((sign) => {
						const href = frame.zodiacGlyphSrc(sign.id);
						if (!href) return null;
						const base = frame.elementColors[elementForZodiacId(sign.id)];
						const tint = isDark ? wheelZodiacFillOnDark(base) : base;
						return (
							<TintFilter
								key={`zf-${sign.id}`}
								id={`${frame.filterUid}-z-${sign.id}`}
								color={tint}
								suffix="z"
							/>
						);
					})
				: null}
			{hasGlyphSet && bodyColors
				? Object.entries(bodyColors).map(([id, color]) => (
						<TintFilter
							key={`bf-${id}`}
							id={`${frame.filterUid}-b-${id}`}
							color={color}
							suffix="b"
						/>
					))
				: null}
			<TintFilter id={frame.transitFilterId} color="var(--theme-accent)" suffix="t" />
		</defs>
	);
}
