import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { objectIcon } from '@/lib/astrology/objectLabels';

/** Glyph of an observable object (planet, point, asteroid…) with the catalog's text fallback. */
export function ObjectGlyph({
	id,
	size = 16,
	className,
	title,
	color
}: {
	id: string;
	size?: number;
	className?: string;
	title?: string;
	/** Glyph color (e.g. the object's configured color). */
	color?: string;
}) {
	return (
		<AstrologyGlyph
			glyphId={id}
			fallback={objectIcon(id)}
			size={size}
			className={className}
			title={title}
			style={color ? { color } : undefined}
		/>
	);
}
