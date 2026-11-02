/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
	contrastingTextColor,
	DEFAULT_THEME_PALETTES,
	isLightPalette,
	themePaletteVars
} from './themePalettes';

const themeCss = readFileSync('src/styles/theme.css', 'utf8');

function contrast(foreground: string, background: string) {
	const luminance = (hex: string) => {
		const channels = [1, 3, 5].map((offset) => {
			const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
			return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
	};
	const a = luminance(foreground);
	const b = luminance(background);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Follow aliases as a browser does: palette -> semantic component token.
function resolveToken(token: string, palette = DEFAULT_THEME_PALETTES.noon): string {
	const variables: Record<string, string | number | undefined> = Object.fromEntries(
		[...themeCss.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()])
	);
	Object.assign(variables, themePaletteVars(palette));
	const resolve = (key: string, seen: string[] = []): string => {
		if (seen.includes(key)) throw new Error(`Circular token: ${key}`);
		if (variables[key] === undefined) throw new Error(`Missing token: ${key}`);
		return String(variables[key]).replace(/var\((--[\w-]+)\)/g, (_, ref) =>
			resolve(ref, [...seen, key])
		);
	};
	return resolve(token);
}

describe('theme connections', () => {
	it.each(Object.entries(DEFAULT_THEME_PALETTES))('keeps %s accent text readable', (_, palette) => {
		expect(contrast(contrastingTextColor(palette.accent), palette.accent)).toBeGreaterThanOrEqual(
			4.5
		);
	});

	it('uses canvas brightness for custom light and dark palettes, including rgb colors', () => {
		expect(isLightPalette({ ...DEFAULT_THEME_PALETTES.noon, canvasStart: 'rgb(15, 20, 25)' })).toBe(
			false
		);
		expect(isLightPalette({ ...DEFAULT_THEME_PALETTES.midnight, canvasStart: '#ffffff' })).toBe(
			true
		);
	});

	it('propagates a custom palette to component and visualization aliases', () => {
		const palette = {
			...DEFAULT_THEME_PALETTES.noon,
			canvasStart: '#121212',
			canvasEnd: '#242424',
			contentTextPrimary: '#ededed',
			contentTextSecondary: '#bcbcbc',
			contentMuted: '#969696',
			accent: '#aaff00',
			mainSidebarStart: '#343434',
			navTextPrimary: '#fefefe',
			selectedBackground: '#565656',
			hoverBackground: 'rgba(150,150,150,0.12)'
		};
		for (const [token, expected] of Object.entries({
			'--background': palette.canvasStart,
			'--foreground': palette.contentTextPrimary,
			'--card': palette.canvasEnd,
			'--card-foreground': palette.contentTextPrimary,
			'--popover': palette.canvasEnd,
			'--popover-foreground': palette.contentTextPrimary,
			'--input-background': palette.canvasEnd,
			'--primary': palette.accent,
			'--primary-foreground': '#000000',
			'--muted-foreground': palette.contentMuted,
			'--secondary-foreground': palette.contentTextSecondary,
			'--accent': palette.selectedBackground,
			'--sidebar': palette.mainSidebarStart,
			'--sidebar-foreground': palette.navTextPrimary,
			'--sidebar-accent': palette.selectedBackground,
			'--ring': palette.accent,
			'--token-hover-subtle': palette.hoverBackground,
			'--token-hover-strong': palette.hoverBackground
		})) {
			expect(resolveToken(token, palette), token).toBe(expected);
		}
		expect(resolveToken('--chart-1', palette)).toContain(palette.accent);
		expect(resolveToken('--theme-panel-bg', palette)).toContain(palette.canvasEnd);
		expect(resolveToken('--theme-overlay-bg', palette)).toContain(palette.canvasStart);
	});

	it('resolves every semantic CSS alias without dangling references or cycles', () => {
		for (const match of themeCss.matchAll(/(--[\w-]+):\s*var\(/g)) {
			expect(() => resolveToken(match[1]), match[1]).not.toThrow();
		}
	});
});
