import type { CSSProperties } from 'react';

type SharedSvgIconProps = {
	src: string;
	className?: string;
	/** Pixel box; omit when `className` sets size (e.g. `size-7`) so Tailwind is not overridden. */
	size?: number;
	width?: number;
	height?: number;
	maskScale?: number;
	title?: string;
	/** Merged into the computed style below — `color` here sets `currentColor`, which the
	 *  mask-based icon's `backgroundColor: currentColor` then picks up. */
	style?: CSSProperties;
};

export function SharedSvgIcon({
	src,
	className = '',
	size,
	width,
	height,
	maskScale = 1,
	title,
	style
}: SharedSvgIconProps) {
	const resolvedWidth = width ?? size;
	const resolvedHeight = height ?? size;
	const hasExplicitPixelBox =
		typeof resolvedWidth === 'number' &&
		Number.isFinite(resolvedWidth) &&
		typeof resolvedHeight === 'number' &&
		Number.isFinite(resolvedHeight);
	const resolvedMaskScale = `${maskScale * 100}%`;

	return (
		<span
			className={className}
			title={title}
			aria-hidden={title ? undefined : true}
			role={title ? 'img' : 'presentation'}
			style={{
				...(hasExplicitPixelBox
					? { width: resolvedWidth, height: resolvedHeight }
					: {}),
				...style,
				display: 'block',
				flexShrink: 0,
				lineHeight: 0,
				verticalAlign: 'middle',
				backgroundColor: 'currentColor',
				maskImage: `url(${src})`,
				maskRepeat: 'no-repeat',
				maskPosition: 'center',
				maskSize: `${resolvedMaskScale} ${resolvedMaskScale}`,
				WebkitMaskImage: `url(${src})`,
				WebkitMaskRepeat: 'no-repeat',
				WebkitMaskPosition: 'center',
				WebkitMaskSize: `${resolvedMaskScale} ${resolvedMaskScale}`
			}}
		/>
	);
}
