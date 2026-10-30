/** A theme palette color split into an opaque hex value and its alpha (for color pickers, which
 *  only handle opaque `#rrggbb`). */
export type ParsedThemeColor = { hex: string; alpha: number };

/** `#rrggbb`, `#rrggbbaa`, `rgb()` or `rgba()`; anything else reads as opaque black. */
export function parseThemeColor(value: string): ParsedThemeColor {
	const hex = value.trim().match(/^#([\da-f]{6})([\da-f]{2})?$/i);
	if (hex) {
		return {
			hex: `#${hex[1]}`,
			alpha: hex[2] ? Number.parseInt(hex[2], 16) / 255 : 1
		};
	}

	const rgb = value
		.trim()
		.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
	if (!rgb) return { hex: '#000000', alpha: 1 };

	const channels = rgb
		.slice(1, 4)
		.map((channel) => Math.min(255, Math.max(0, Math.round(Number(channel)))));
	return {
		hex: `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`,
		alpha: Math.min(1, Math.max(0, rgb[4] === undefined ? 1 : Number(rgb[4])))
	};
}

/** `hex` when opaque, otherwise `rgba(r,g,b,alpha)`. */
export function formatThemeColor(hex: string, alpha: number): string {
	if (alpha >= 1) return hex;
	const normalized = hex.replace('#', '');
	const channels = [0, 2, 4].map((offset) =>
		Number.parseInt(normalized.slice(offset, offset + 2), 16)
	);
	return `rgba(${channels.join(',')},${Number(alpha.toFixed(2))})`;
}
