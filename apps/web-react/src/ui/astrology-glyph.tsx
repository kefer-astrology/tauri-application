import { SharedSvgIcon } from './shared-svg-icon';
import {
	getAspectGlyphSrc,
	getAstrologyGlyphSrc,
	getZodiacGlyphSrc,
	type AstrologyGlyphSetId
} from '@/lib/astrology/glyphs';
import { resolveCustomGlyphSrc, useCustomGlyphOverrides } from '@/lib/astrology/customGlyphs';
import { cn } from '@/app/components/ui/utils';

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
	if (src) {
		return <SharedSvgIcon src={src} className={className} size={size} title={title} />;
	}

	return (
		<span
			className={cn('inline-flex items-center justify-center leading-none', className)}
			style={{ width: size, height: size }}
			title={title}
			aria-hidden={title ? undefined : true}
			role={title ? 'img' : 'presentation'}
		>
			{fallback}
		</span>
	);
}
