import { signPosition } from '@/lib/astrology/zodiac';
import { AstrologyGlyph } from '@/ui/astrology-glyph';

/** A longitude as sign glyph plus degrees and minutes within the sign (`♋ 22°30′`). */
export function ZodiacPosition({ longitude }: { longitude: number | null }) {
	if (longitude === null) return null;
	const { degrees, minutes, signZodiacId, signGlyphFallback } = signPosition(longitude, 'minutes');
	return (
		<span className="inline-flex items-center justify-end gap-1.5">
			<AstrologyGlyph
				glyphId={signZodiacId}
				domain="zodiac"
				fallback={signGlyphFallback}
				size={13}
			/>
			<span>{`${degrees}°${String(minutes).padStart(2, '0')}′`}</span>
		</span>
	);
}
