import { useMemo } from 'react';
import { cn } from './ui/utils';
import type { Theme } from './astrology-sidebar';

/**
 * Shared field styling aligned with **New Horoscope** (`new-horoscope.tsx`) so settings and
 * other forms match the same glass / border / focus treatment across `sunrise` | `noon` | `twilight` | `midnight`.
 * `sunrise` uses a dark-nav / bright-canvas palette with blue accents.
 */
export function getAppFormFieldTheme(theme: Theme) {
	const isMidnight = theme === 'midnight';
	const isTwilight = theme === 'twilight';
	const isSunrise = theme === 'sunrise';
	/** Legacy: true only for midnight (charts / icons that distinguish blue night). */
	const isDark = isMidnight;

	const title = 'text-[color:var(--theme-content-primary)]';
	const label = 'text-[color:var(--theme-content-secondary)]';
	const muted = 'text-[color:var(--theme-content-muted)]';

	const input = cn(
		'w-full rounded-xl border px-4 py-2.5 text-base transition-all md:text-sm',
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)]',
		'placeholder:text-[color:var(--theme-content-muted)] shadow-inner backdrop-blur-sm',
		'focus:border-transparent focus:ring-2 focus:ring-[var(--theme-accent)] focus:outline-none'
	);

	const inputCompact = cn(
		'h-9 rounded-xl border px-3 py-1 text-sm transition-all',
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)]',
		'backdrop-blur-sm focus:border-transparent focus:ring-2 focus:ring-[var(--theme-accent)] focus:outline-none'
	);

	const selectTrigger = cn(
		'flex h-auto min-h-10 w-full items-center justify-between rounded-xl border px-4 py-2.5 text-base transition-all md:text-sm [&>svg]:opacity-70',
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)] shadow-inner backdrop-blur-sm',
		'focus:border-transparent focus:ring-2 focus:ring-[var(--theme-accent)] focus:outline-none'
	);

	const selectContent = cn(
		'rounded-xl border shadow-lg',
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg-solid)] text-[color:var(--theme-content-primary)]'
	);

	const selectItem =
		'focus:bg-[color:var(--theme-soft-bg)] focus:text-[color:var(--theme-content-primary)] data-[highlighted]:bg-[color:var(--theme-soft-bg)] data-[highlighted]:text-[color:var(--theme-content-primary)]';

	const footerBorder = 'border-[color:var(--theme-panel-border)]';

	const footerCancel = cn(
		'flex-1 rounded-xl border px-6 py-2.5 font-medium transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none',
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-secondary)] backdrop-blur-sm shadow-inner',
		'hover:bg-[color:var(--theme-soft-bg)] focus:ring-[var(--theme-accent)]'
	);

	const footerPrimary = cn(
		'flex-1 rounded-xl px-6 py-2.5 font-medium text-white shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50',
		'bg-[color:var(--theme-accent)] hover:brightness-95 focus:ring-[var(--theme-accent)] shadow-lg shadow-black/20'
	);

	const langBubbleActive =
		'border-[color:var(--theme-accent)] bg-[color:var(--theme-accent)] text-white ring-2 ring-[color:var(--theme-accent)] shadow-sm';
	const langBubbleIdle =
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-secondary)] hover:bg-[color:var(--theme-soft-bg)]';

	const inputDisabled = cn(
		'cursor-not-allowed border text-base md:text-sm',
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-soft-bg)] text-[color:var(--theme-content-muted)] backdrop-blur-sm'
	);

	const dropdown = selectContent;

	const dropdownHover = 'hover:bg-[color:var(--theme-soft-bg)]';

	const dropdownActive = 'bg-[color:var(--theme-selected-bg)] text-[color:var(--theme-content-primary)]';

	const advancedPanel = 'rounded-xl border-0 bg-[color:var(--theme-soft-bg)] p-4 backdrop-blur-sm';

	const iconColor = 'text-[color:var(--theme-accent)]';

	const datePicker = cn(
		'w-80 rounded-xl border p-4 shadow-xl ring-1 ring-black/5 dark:ring-white/10',
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg-solid)]'
	);

	const datePickerHeader = 'text-[color:var(--theme-content-secondary)]';

	const datePickerButton = 'hover:bg-[color:var(--theme-soft-bg)]';

	const datePickerDay = 'hover:bg-[color:var(--theme-soft-bg)] text-[color:var(--theme-content-primary)]';

	const datePickerDayActive =
		'bg-[color:var(--theme-accent)] text-white hover:brightness-95';

	/** Native checkbox accent color (Tailwind `text-*` tints the checkmark). */
	const checkboxAccent = 'text-[color:var(--theme-accent)] focus:ring-[var(--theme-accent)]';

	const formPageBg =
		'bg-[linear-gradient(to_bottom_right,var(--theme-canvas-start),var(--theme-canvas-end))]';

	const switchUnchecked = 'data-[state=unchecked]:bg-[color:var(--theme-content-muted)]';

	const textDisabled = 'text-[color:var(--theme-content-muted)]';

	const bodyText = 'text-[color:var(--theme-content-secondary)]';

	/** Bottom horoscope strip: workspace chart “tabs” — shadcn surfaces + app glass (matches settings cards). */
	const contextRail = cn(
		'flex min-h-11 w-full items-center justify-center gap-2 overflow-x-auto overflow-y-hidden border-t px-3 py-1.5',
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)]',
		'backdrop-blur-md supports-[backdrop-filter]:bg-[color:var(--theme-panel-bg-strong)]'
	);

	const contextTabGhost = cn(
		'h-8 min-h-8 max-w-[min(12rem,40vw)] justify-start truncate px-2 font-normal shadow-none',
		'text-[color:var(--theme-content-secondary)] hover:bg-[color:var(--theme-soft-bg)] hover:text-[color:var(--theme-content-primary)]'
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
		sectionTitle: cn('text-lg font-semibold tracking-tight', title),
		label: cn('text-sm font-medium', label),
		muted,
		input,
		inputCompact,
		inputDisabled,
		selectTrigger,
		selectContent,
		selectItem,
		footerBorder,
		footerCancel,
		footerPrimary,
		/** Popover / menu surface (same palette as `selectContent`). */
		dropdown,
		dropdownHover,
		dropdownActive,
		advancedPanel,
		iconColor,
		datePicker,
		datePickerHeader,
		datePickerButton,
		datePickerDay,
		datePickerDayActive,
		formPageBg,
		switchUnchecked,
		textDisabled,
		bodyText,
		checkboxAccent,
		langBubble: (active: boolean) =>
			cn(
				'min-h-12 min-w-[3.25rem] rounded-full border-2 px-5 py-2.5 text-base font-semibold transition-colors',
				active ? langBubbleActive : langBubbleIdle
			),
		contextRail,
		contextTabGhost,
		contextTabActive,
		contextSeparator
	};
}

export type AppFormFieldTheme = ReturnType<typeof getAppFormFieldTheme>;

export function useAppFormFieldTheme(theme: Theme): AppFormFieldTheme {
	return useMemo(() => getAppFormFieldTheme(theme), [theme]);
}
