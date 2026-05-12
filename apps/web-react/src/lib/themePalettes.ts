import type { CSSProperties } from 'react';

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
	hoverBackground: string;
	selectedBackground: string;
};

export type ThemePalettes = Record<ThemePaletteId, ThemePalette>;

const STORAGE_KEY = 'kefer_theme_palettes_v1';

export const DEFAULT_THEME_PALETTES: ThemePalettes = {
	sunrise: {
		mainSidebarStart: '#0B1220',
		mainSidebarEnd: '#24324D',
		secondarySidebarStart: '#1E293B',
		secondarySidebarEnd: '#3E4C67',
		canvasStart: '#FFFFFF',
		canvasEnd: '#F7FAFF',
		navTextPrimary: '#E5E7EB',
		navTextSecondary: '#9CA3AF',
		contentTextPrimary: '#111827',
		contentTextSecondary: '#4B5563',
		contentMuted: '#6B7280',
		accent: '#2563EB',
		hoverBackground: 'rgba(255,255,255,0.10)',
		selectedBackground: 'rgba(37,99,235,0.16)'
	},
	noon: {
		mainSidebarStart: '#FFFFFF',
		mainSidebarEnd: '#F8FAFC',
		secondarySidebarStart: '#F8FAFC',
		secondarySidebarEnd: '#E5E7EB',
		canvasStart: '#FFFFFF',
		canvasEnd: '#F8FAFC',
		navTextPrimary: '#111827',
		navTextSecondary: '#4B5563',
		contentTextPrimary: '#111827',
		contentTextSecondary: '#4B5563',
		contentMuted: '#6B7280',
		accent: '#2563EB',
		hoverBackground: 'rgba(37,99,235,0.08)',
		selectedBackground: 'rgba(37,99,235,0.16)'
	},
	twilight: {
		mainSidebarStart: '#1E3A8A',
		mainSidebarEnd: '#2563EB',
		secondarySidebarStart: '#1D4ED8',
		secondarySidebarEnd: '#3B82F6',
		canvasStart: '#1E293B',
		canvasEnd: '#334155',
		navTextPrimary: '#FFFFFF',
		navTextSecondary: '#DBEAFE',
		contentTextPrimary: '#FFFFFF',
		contentTextSecondary: '#DBEAFE',
		contentMuted: '#BFDBFE',
		accent: '#6366F1',
		hoverBackground: 'rgba(255,255,255,0.10)',
		selectedBackground: 'rgba(99,102,241,0.28)'
	},
	midnight: {
		mainSidebarStart: '#0D1B2E',
		mainSidebarEnd: '#0B1729',
		secondarySidebarStart: '#0A1528',
		secondarySidebarEnd: '#0E1A2D',
		canvasStart: '#0D1B2E',
		canvasEnd: '#0E1A2D',
		navTextPrimary: '#E2E8F0',
		navTextSecondary: '#CBD5E1',
		contentTextPrimary: '#F8FAFC',
		contentTextSecondary: '#CBD5E1',
		contentMuted: '#94A3B8',
		accent: '#6366F1',
		hoverBackground: 'rgba(255,255,255,0.10)',
		selectedBackground: 'rgba(99,102,241,0.28)'
	}
};

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
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
		contentMuted: isNonEmptyString(partial?.contentMuted) ? partial.contentMuted : base.contentMuted,
		accent: isNonEmptyString(partial?.accent) ? partial.accent : base.accent,
		hoverBackground: isNonEmptyString(partial?.hoverBackground)
			? partial.hoverBackground
			: base.hoverBackground,
		selectedBackground: isNonEmptyString(partial?.selectedBackground)
			? partial.selectedBackground
			: base.selectedBackground
	};
}

export function mergeThemePalettes(partial: Partial<ThemePalettes> | null | undefined): ThemePalettes {
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

function hexToRgb(hex: string): [number, number, number] | null {
	const normalized = hex.trim().replace('#', '');
	if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
	const value = Number.parseInt(normalized, 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function alpha(hex: string, opacity: number, fallback: string): string {
	const rgb = hexToRgb(hex);
	if (!rgb) return fallback;
	return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
}

function luminance(hex: string): number {
	const rgb = hexToRgb(hex);
	if (!rgb) return 1;
	const [r, g, b] = rgb.map((channel) => {
		const normalized = channel / 255;
		return normalized <= 0.03928
			? normalized / 12.92
			: ((normalized + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLightPalette(palette: ThemePalette): boolean {
	return luminance(palette.canvasStart) >= 0.55;
}

export function themePaletteVars(palette: ThemePalette): CSSProperties {
	const light = isLightPalette(palette);
	const wheelStrokeMain = light ? alpha(palette.contentTextPrimary, 0.6, 'rgba(0,0,0,0.6)') : 'rgba(255,255,255,0.5)';
	const wheelStrokeSoft = light ? alpha(palette.contentTextPrimary, 0.45, 'rgba(0,0,0,0.45)') : 'rgba(255,255,255,0.4)';
	const wheelAxis = light ? alpha(palette.accent, 0.75, 'rgba(37,99,235,0.75)') : alpha(palette.accent, 0.85, 'rgba(96,165,250,0.85)');
	const vizOne = alpha(palette.accent, 0.85, '#2563eb');
	const vizTwo = alpha(palette.contentTextSecondary, 0.85, '#64748b');
	const vizThree = alpha(palette.navTextSecondary, light ? 0.95 : 0.8, '#94a3b8');
	const vizFour = alpha(palette.contentMuted, light ? 0.95 : 0.85, '#6b7280');
	return {
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
		['--theme-hover-bg' as string]: palette.hoverBackground,
		['--theme-selected-bg' as string]: palette.selectedBackground,
		['--theme-sidebar-border' as string]: alpha(palette.navTextPrimary, 0.08, 'rgba(255,255,255,0.08)'),
		['--theme-separator' as string]: alpha(palette.navTextPrimary, 0.1, 'rgba(255,255,255,0.10)'),
		['--theme-panel-bg' as string]: light ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.36)',
		['--theme-panel-bg-strong' as string]: light ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.55)',
		['--theme-panel-bg-solid' as string]: light ? '#ffffff' : '#0f172a',
		['--theme-panel-border' as string]: light
			? alpha(palette.contentTextSecondary, 0.18, 'rgba(75,85,99,0.18)')
			: alpha(palette.navTextPrimary, 0.18, 'rgba(255,255,255,0.18)'),
		['--theme-soft-bg' as string]: light
			? alpha(palette.accent, 0.06, 'rgba(37,99,235,0.06)')
			: 'rgba(255,255,255,0.06)',
		['--theme-soft-bg-strong' as string]: light
			? alpha(palette.accent, 0.1, 'rgba(37,99,235,0.10)')
			: 'rgba(255,255,255,0.10)',
		['--theme-overlay-bg' as string]: light ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.72)',
		['--token-border-subtle' as string]: light
			? alpha(palette.contentTextSecondary, 0.12, 'rgba(75,85,99,0.12)')
			: alpha(palette.navTextPrimary, 0.12, 'rgba(255,255,255,0.12)'),
		['--token-surface-subtle' as string]: light
			? alpha(palette.contentTextPrimary, 0.04, 'rgba(17,24,39,0.04)')
			: alpha(palette.navTextPrimary, 0.06, 'rgba(255,255,255,0.06)'),
		['--token-hover-subtle' as string]: light
			? alpha(palette.contentTextPrimary, 0.06, 'rgba(17,24,39,0.06)')
			: alpha(palette.navTextPrimary, 0.1, 'rgba(255,255,255,0.10)'),
		['--token-hover-strong' as string]: light
			? alpha(palette.contentTextPrimary, 0.12, 'rgba(17,24,39,0.12)')
			: alpha(palette.navTextPrimary, 0.18, 'rgba(255,255,255,0.18)'),
		['--token-wheel-stroke-main' as string]: wheelStrokeMain,
		['--token-wheel-stroke-soft' as string]: wheelStrokeSoft,
		['--token-wheel-bg' as string]: light ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.03)',
		['--token-wheel-glyph' as string]: palette.contentTextSecondary,
		['--token-wheel-axis' as string]: wheelAxis,
		['--token-wheel-overlay-primary' as string]: alpha(palette.accent, light ? 0.14 : 0.18, 'rgba(37,99,235,0.14)'),
		['--token-wheel-overlay-secondary' as string]: alpha(palette.contentMuted, light ? 0.16 : 0.2, 'rgba(244,63,94,0.16)'),
		['--token-wheel-highlight' as string]: alpha(palette.accent, light ? 0.34 : 0.26, 'rgba(250,204,21,0.30)'),
		['--token-viz-1' as string]: vizOne,
		['--token-viz-2' as string]: vizTwo,
		['--token-viz-3' as string]: vizThree,
		['--token-viz-4' as string]: vizFour
	};
}
