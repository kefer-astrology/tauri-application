import { useMemo } from 'react';
import { cn } from './ui/utils';
import type { Theme } from '@/lib/theme';
import { DEFAULT_THEME_PALETTES, isLightPalette } from '@/lib/themePalettes';
import { useAppTheme } from '../providers/app-theme';
import { typographyVariants } from './ui/typography';

/**
 * Typography, page layout and chart-context styling. Form controls own their appearance through
 * component variants in `ui/form-variants.ts`.
 */
export function getAppFormFieldTheme(
	theme: Theme,
	dark = !isLightPalette(DEFAULT_THEME_PALETTES[theme])
) {
	const isTwilight = theme === 'twilight';
	const isSunrise = theme === 'sunrise';
	const isDark = dark;

	const title = 'text-[color:var(--theme-content-primary)]';
	const muted = 'text-[color:var(--theme-content-muted)]';

	const langBubbleActive =
		'border-[color:var(--theme-accent)] bg-[color:var(--theme-accent)] text-primary-foreground ring-2 ring-[color:var(--theme-accent)] shadow-sm';
	const langBubbleIdle =
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-secondary)] hover:bg-[color:var(--theme-hover-bg)]';

	const iconColor = 'text-[color:var(--theme-accent)]';

	/** Native checkbox accent color (Tailwind `text-*` tints the checkmark). Focus ring comes from the shared `Checkbox` primitive. */
	const checkboxAccent = 'text-[color:var(--theme-accent)]';

	const formPageBg =
		'bg-[linear-gradient(to_bottom_right,var(--theme-canvas-start),var(--theme-canvas-end))]';

	const textDisabled = 'text-[color:var(--theme-content-muted)]';

	const bodyText = 'text-[color:var(--theme-content-secondary)]';

	const contextTabGhost = cn(
		'h-8 min-h-8 max-w-[min(12rem,40vw)] justify-start truncate px-2 font-normal shadow-none',
		'text-[color:var(--theme-content-secondary)] hover:bg-[color:var(--theme-hover-bg)] hover:text-[color:var(--theme-content-primary)]'
	);

	const contextTabActive = cn(
		'block truncate font-semibold underline underline-offset-4 decoration-primary/60',
		title
	);

	const contextSeparator = '[&>svg]:text-[color:var(--theme-content-muted)]';

	return {
		isDark,
		isTwilight,
		isSunrise,
		title,
		sectionTitle: typographyVariants({ variant: 'sectionTitle', tone: 'primary' }),
		label: typographyVariants({ variant: 'label', tone: 'secondary' }),
		muted,
		iconColor,
		formPageBg,
		textDisabled,
		bodyText,
		checkboxAccent,
		langBubble: (active: boolean) =>
			cn(
				'min-h-12 min-w-[3.25rem] rounded-full border-2 px-5 py-2.5 text-base font-semibold transition-colors',
				active ? langBubbleActive : langBubbleIdle
			),
		contextTabGhost,
		contextTabActive,
		contextSeparator
	};
}

export type AppFormFieldTheme = ReturnType<typeof getAppFormFieldTheme>;

/** Form surface classes for the theme from `AppThemeProvider`. */
export function useAppFormFieldTheme(): AppFormFieldTheme {
	const { theme, dark } = useAppTheme();
	return useMemo(() => getAppFormFieldTheme(theme, dark), [theme, dark]);
}
