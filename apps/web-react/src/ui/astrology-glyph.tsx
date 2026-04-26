import { SharedSvgIcon } from './shared-svg-icon';
import {
	getAstrologyGlyphSrc,
	getZodiacGlyphSrc,
	type AstrologyGlyphSetId
} from '@/lib/astrology/glyphs';
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
	/** `planet` → `static/glyphs/.../planets/`; `zodiac` → `.../zodiac/`. */
	domain?: 'planet' | 'zodiac';
	fallback: string;
	className?: string;
	size?: number;
	title?: string;
}) {
	const src =
		domain === 'zodiac'
			? getZodiacGlyphSrc(glyphSet, glyphId)
			: getAstrologyGlyphSrc(glyphSet, glyphId);
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
