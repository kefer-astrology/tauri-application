/** Tint a raster SVG glyph to a solid color via `url(#filterId)` (`feFlood` + `feComposite` in defs). */
export function WheelTintedGlyphImage({
	href,
	x,
	y,
	size,
	filterId
}: {
	href: string;
	x: number;
	y: number;
	size: number;
	filterId: string;
}) {
	const half = size / 2;
	return (
		<image
			href={href}
			x={x - half}
			y={y - half}
			width={size}
			height={size}
			preserveAspectRatio="xMidYMid meet"
			style={{
				pointerEvents: 'none',
				filter: `url(#${filterId})`
			}}
		/>
	);
}
