import { SharedSvgIcon } from './shared-svg-icon';
import {
	getAspectGlyphSrc,
	getAstrologyGlyphSrc,
	getZodiacGlyphSrc,
	type AstrologyGlyphSetId
} from '@/lib/astrology/glyphs';
import { resolveCustomGlyphSrc, useCustomGlyphOverrides } from '@/lib/astrology/customGlyphs';
import { cn } from '@/app/components/ui/utils';

/** Glyphs were reading smaller than intended at their nominal pixel box; mirrors the
 *  boost applied via `SVELTE_GLYPH_SCALE` in the Svelte app's glyph store. */
const GLYPH_SIZE_SCALE = 1.2;

export function AstrologyGlyph({
	glyphId,
	glyphSet,
	domain = 'planet',
	fallback,
	className,
	size = 20,
	title
}: {
	glyphId: string;
	glyphSet: AstrologyGlyphSetId;
	/** `planet` → `static/glyphs/.../planets/`; `zodiac` → `.../zodiac/`; `aspect` → `.../aspects/`. */
	domain?: 'planet' | 'zodiac' | 'aspect';
	fallback: string;
	className?: string;
	size?: number;
	title?: string;
}) {
	const overrides = useCustomGlyphOverrides();
	const src =
		resolveCustomGlyphSrc(overrides, glyphId) ??
		(domain === 'zodiac'
			? getZodiacGlyphSrc(glyphSet, glyphId)
			: domain === 'aspect'
				? getAspectGlyphSrc(glyphSet, glyphId)
				: getAstrologyGlyphSrc(glyphSet, glyphId));
	const scaledSize = Math.round(size * GLYPH_SIZE_SCALE);
	if (src) {
		return <SharedSvgIcon src={src} className={className} size={scaledSize} title={title} />;
	}

	return (
		<span
			className={cn('inline-flex items-center justify-center leading-none', className)}
			style={{ width: scaledSize, height: scaledSize }}
			title={title}
			aria-hidden={title ? undefined : true}
			role={title ? 'img' : 'presentation'}
		>
			{fallback}
		</span>
	);
}
