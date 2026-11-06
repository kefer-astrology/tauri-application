import type { CSSProperties } from 'react';
import { parseThemeColor } from './themeColors';

export type ThemePaletteId = 'sunrise' | 'noon' | 'twilight' | 'midnight';

export type ThemePalette = {
	mainSidebarStart: string;
	mainSidebarEnd: string;
	secondarySidebarStart: string;
	secondarySidebarEnd: string;
	canvasStart: string;
	canvasEnd: string;
	navTextPrimary: string;
	navTextSecondary: string;
	contentTextPrimary: string;
	contentTextSecondary: string;
	contentMuted: string;
	accent: string;
	/** Percentage (0–100) mapped to the blur behind modal popups. */
	popupBackgroundFuzziness: number;
	hoverBackground: string;
	selectedBackground: string;
};

export type ThemePalettes = Record<ThemePaletteId, ThemePalette>;

const STORAGE_KEY = 'kefer_theme_palettes_v1';

export const DEFAULT_THEME_PALETTES: ThemePalettes = {
	sunrise: {
		mainSidebarStart: '#FFFFFF',
		mainSidebarEnd: '#F8FAFD',
		secondarySidebarStart: '#FFFFFF',
		secondarySidebarEnd: '#F8FAFD',
		canvasStart: '#F0F4F9',
		canvasEnd: '#E9EEF6',
		navTextPrimary: '#1F1F1F',
		navTextSecondary: '#444746',
		contentTextPrimary: '#1F1F1F',
		contentTextSecondary: '#444746',
		contentMuted: '#747775',
		accent: '#1A73E8',
		popupBackgroundFuzziness: 0,
		hoverBackground: 'rgba(26,115,232,0.08)',
		selectedBackground: 'rgba(140,127,114,0.16)'
	},
	noon: {
		mainSidebarStart: '#FFFFFF',
		mainSidebarEnd: '#ffffff',
		secondarySidebarStart: '#ffffff',
		secondarySidebarEnd: '#ffffff',
		canvasStart: '#FAFAFA',
		canvasEnd: '#FAFAFA',
		navTextPrimary: '#26211C',
		navTextSecondary: '#594F45',
		contentTextPrimary: '#26211C',
		contentTextSecondary: '#594F45',
		contentMuted: '#8C7F72',
		accent: '#785dff',
		popupBackgroundFuzziness: 0,
		hoverBackground: 'rgba(140,127,114,0.1)',
		selectedBackground: '#d3e3fd'
	},
	twilight: {
		mainSidebarStart: '#1E1F20',
		mainSidebarEnd: '#1E1F20',
		secondarySidebarStart: '#1E1F20',
		secondarySidebarEnd: '#1E1F20',
		canvasStart: '#131314',
		canvasEnd: '#131314',
		navTextPrimary: '#E3E3E3',
		navTextSecondary: '#E3E3E3',
		contentTextPrimary: '#E3E3E3',
		contentTextSecondary: '#E3E3E3',
		contentMuted: '#8EA0B5',
		accent: '#38BDF8',
		popupBackgroundFuzziness: 0,
		hoverBackground: 'rgba(255,255,255,0.06)',
		selectedBackground: '#3d3f42'
	},
	midnight: {
		mainSidebarStart: '#131314',
		mainSidebarEnd: '#131314',
		secondarySidebarStart: '#131314',
		secondarySidebarEnd: '#131314',
		canvasStart: '#1E1F20',
		canvasEnd: '#1E1F20',
		navTextPrimary: '#E3E3E3',
		navTextSecondary: '#E3E3E3',
		contentTextPrimary: '#E3E3E3',
		contentTextSecondary: '#E3E3E3',
		contentMuted: '#8EA0B5',
		accent: '#8AB4F8',
		popupBackgroundFuzziness: 0,
		hoverBackground: 'rgba(255,255,255,0.06)',
		selectedBackground: '#3d3f42'
	}
};

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function clampPercentage(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value)
		? Math.min(100, Math.max(0, value))
		: fallback;
}

function mergeThemePalette(
	base: ThemePalette,
	partial: Partial<ThemePalette> | null | undefined
): ThemePalette {
	return {
		mainSidebarStart: isNonEmptyString(partial?.mainSidebarStart)
			? partial.mainSidebarStart
			: base.mainSidebarStart,
		mainSidebarEnd: isNonEmptyString(partial?.mainSidebarEnd)
			? partial.mainSidebarEnd
			: base.mainSidebarEnd,
		secondarySidebarStart: isNonEmptyString(partial?.secondarySidebarStart)
			? partial.secondarySidebarStart
			: base.secondarySidebarStart,
		secondarySidebarEnd: isNonEmptyString(partial?.secondarySidebarEnd)
			? partial.secondarySidebarEnd
			: base.secondarySidebarEnd,
		canvasStart: isNonEmptyString(partial?.canvasStart) ? partial.canvasStart : base.canvasStart,
		canvasEnd: isNonEmptyString(partial?.canvasEnd) ? partial.canvasEnd : base.canvasEnd,
		navTextPrimary: isNonEmptyString(partial?.navTextPrimary)
			? partial.navTextPrimary
			: base.navTextPrimary,
		navTextSecondary: isNonEmptyString(partial?.navTextSecondary)
			? partial.navTextSecondary
			: base.navTextSecondary,
		contentTextPrimary: isNonEmptyString(partial?.contentTextPrimary)
			? partial.contentTextPrimary
			: base.contentTextPrimary,
		contentTextSecondary: isNonEmptyString(partial?.contentTextSecondary)
			? partial.contentTextSecondary
			: base.contentTextSecondary,
		contentMuted: isNonEmptyString(partial?.contentMuted)
			? partial.contentMuted
			: base.contentMuted,
		accent: isNonEmptyString(partial?.accent) ? partial.accent : base.accent,
		popupBackgroundFuzziness: clampPercentage(
			partial?.popupBackgroundFuzziness,
			base.popupBackgroundFuzziness
		),
		hoverBackground: isNonEmptyString(partial?.hoverBackground)
			? partial.hoverBackground
			: base.hoverBackground,
		selectedBackground: isNonEmptyString(partial?.selectedBackground)
			? partial.selectedBackground
			: base.selectedBackground
	};
}

export function mergeThemePalettes(
	partial: Partial<ThemePalettes> | null | undefined
): ThemePalettes {
	return {
		sunrise: mergeThemePalette(DEFAULT_THEME_PALETTES.sunrise, partial?.sunrise),
		noon: mergeThemePalette(DEFAULT_THEME_PALETTES.noon, partial?.noon),
		twilight: mergeThemePalette(DEFAULT_THEME_PALETTES.twilight, partial?.twilight),
		midnight: mergeThemePalette(DEFAULT_THEME_PALETTES.midnight, partial?.midnight)
	};
}

export function readStoredThemePalettes(): ThemePalettes {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return mergeThemePalettes(undefined);
		return mergeThemePalettes(JSON.parse(raw) as Partial<ThemePalettes>);
	} catch {
		return mergeThemePalettes(undefined);
	}
}

export function persistThemePalettes(palettes: ThemePalettes) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeThemePalettes(palettes)));
	} catch {
		/* ignore */
	}
}

/** CSS mixing keeps derived colors connected even when settings use rgb() or other CSS colors. */
function alpha(color: string, opacity: number): string {
	return `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`;
}

function luminance(color: string): number {
	const { hex } = parseThemeColor(color);
	const [r, g, b] = [1, 3, 5].map((offset) => {
		const normalized = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
		return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Choose the black/white foreground with the higher contrast against an opaque accent. */
export function contrastingTextColor(background: string): string {
	return luminance(background) > 0.179 ? '#000000' : '#ffffff';
}

export function isLightPalette(palette: ThemePalette): boolean {
	return luminance(palette.canvasStart) >= 0.179;
}

export function themePaletteVars(palette: ThemePalette): CSSProperties {
	const light = isLightPalette(palette);
	// Content surfaces are opaque. Transparency belongs to the configured hover/selected states.
	// Their color follows the canvas, independently of navigation colors.
	const panel = palette.canvasEnd;
	const panelBorder = alpha(palette.contentTextSecondary, 0.18);
	const vizOne = alpha(palette.accent, 0.85);
	const vizTwo = alpha(palette.contentTextSecondary, 0.85);
	const vizThree = alpha(palette.navTextSecondary, light ? 0.95 : 0.8);
	const vizFour = alpha(palette.contentMuted, light ? 0.95 : 0.85);
	return {
		colorScheme: light ? 'light' : 'dark',
		['--theme-main-sidebar-start' as string]: palette.mainSidebarStart,
		['--theme-main-sidebar-end' as string]: palette.mainSidebarEnd,
		['--theme-secondary-sidebar-start' as string]: palette.secondarySidebarStart,
		['--theme-secondary-sidebar-end' as string]: palette.secondarySidebarEnd,
		['--theme-canvas-start' as string]: palette.canvasStart,
		['--theme-canvas-end' as string]: palette.canvasEnd,
		['--theme-nav-text-primary' as string]: palette.navTextPrimary,
		['--theme-nav-text-secondary' as string]: palette.navTextSecondary,
		['--theme-content-primary' as string]: palette.contentTextPrimary,
		['--theme-content-secondary' as string]: palette.contentTextSecondary,
		['--theme-content-muted' as string]: palette.contentMuted,
		['--theme-accent' as string]: palette.accent,
		['--theme-accent-foreground' as string]: contrastingTextColor(palette.accent),
		['--theme-control-thumb' as string]: contrastingTextColor(palette.canvasStart),
		['--theme-control-thumb-prominent' as string]: contrastingTextColor(palette.contentMuted),
		['--theme-popup-backdrop-blur' as string]: `${(palette.popupBackgroundFuzziness * 0.2).toFixed(1)}px`,
		['--theme-hover-bg' as string]: palette.hoverBackground,
		['--theme-selected-bg' as string]: palette.selectedBackground,
		['--theme-sidebar-border' as string]: alpha(palette.navTextPrimary, 0.08),
		['--theme-separator' as string]: alpha(palette.navTextPrimary, 0.1),
		['--theme-panel-bg' as string]: panel,
		['--theme-panel-bg-strong' as string]: panel,
		['--theme-panel-bg-solid' as string]: panel,
		['--theme-panel-border' as string]: panelBorder,
		['--theme-soft-bg' as string]: alpha(palette.contentTextPrimary, light ? 0.04 : 0.06),
		['--theme-soft-bg-strong' as string]: alpha(palette.contentTextPrimary, 0.1),
		['--theme-overlay-bg' as string]: alpha(palette.canvasStart, 0.72),
		['--token-border-subtle' as string]: alpha(palette.contentTextSecondary, 0.12),
		['--token-surface-subtle' as string]: alpha(palette.contentTextPrimary, light ? 0.04 : 0.06),
		['--token-hover-subtle' as string]: palette.hoverBackground,
		['--token-hover-strong' as string]: palette.hoverBackground,
		['--token-wheel-stroke-main' as string]: alpha(palette.contentTextPrimary, light ? 0.6 : 0.5),
		['--token-wheel-stroke-soft' as string]: alpha(palette.contentTextPrimary, light ? 0.45 : 0.4),
		['--token-wheel-bg' as string]: alpha(panel, light ? 0.55 : 0.03),
		['--token-wheel-glyph' as string]: palette.contentTextSecondary,
		['--token-wheel-axis' as string]: alpha(palette.accent, light ? 0.75 : 0.85),
		['--token-wheel-overlay-primary' as string]: alpha(palette.accent, light ? 0.14 : 0.18),
		['--token-wheel-overlay-secondary' as string]: alpha(palette.contentMuted, light ? 0.16 : 0.2),
		['--token-wheel-highlight' as string]: alpha(palette.accent, light ? 0.34 : 0.26),
		['--token-viz-1' as string]: vizOne,
		['--token-viz-2' as string]: vizTwo,
		['--token-viz-3' as string]: vizThree,
		['--token-viz-4' as string]: vizFour
	};
}
