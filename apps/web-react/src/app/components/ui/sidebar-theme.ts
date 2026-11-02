import type { CSSProperties } from 'react';
import type { Theme } from '@/lib/theme';

/** Navigation rail styling per theme, shared by the main sidebar and the secondary rails. */
export type SidebarThemeBlock = {
	bg: string;
	border: string;
	text: string;
	hover: string;
	active: string;
	separator: string;
	themeIconColor: string;
	customStyle?: CSSProperties;
};

// Navigation has its own text tokens, shared by all four palette-driven rails.
const paletteSidebarStyle: SidebarThemeBlock = {
	bg: '',
	border: 'border-[color:var(--theme-sidebar-border)]',
	text: 'text-[color:var(--theme-nav-text-secondary)]',
	hover: 'hover:bg-[color:var(--theme-hover-bg)] hover:text-[color:var(--theme-nav-text-primary)]',
	active:
		'bg-[color:var(--theme-selected-bg)] text-[color:var(--theme-nav-text-primary)] hover:bg-[color:var(--theme-selected-bg)]',
	separator: 'bg-[color:var(--theme-separator)]',
	themeIconColor: 'var(--theme-nav-text-primary)',
	customStyle: {
		background:
			'linear-gradient(to bottom, var(--theme-main-sidebar-start) 0%, var(--theme-main-sidebar-end) 100%)',
		borderColor: 'var(--theme-sidebar-border)'
	}
};

export const sidebarThemeStyles: Record<Theme, SidebarThemeBlock> = {
	sunrise: paletteSidebarStyle,
	noon: paletteSidebarStyle,
	twilight: paletteSidebarStyle,
	midnight: paletteSidebarStyle
};

/**
 * Hit area + type scale for sidebar menu rows. Shared by the main
 * sidebar and the secondary rails, so they match.
 */
export const sidebarNavMenuRowClassName =
	'h-11 rounded-md px-2.5 text-sm font-medium transition-all duration-200';
