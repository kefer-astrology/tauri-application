import { cn } from './ui/utils';
import type { Theme } from './astrology-sidebar';

/**
 * Shared field styling aligned with **New Horoscope** (`new-horoscope.tsx`) so settings and
 * other forms match the same glass / border / focus treatment across `sunrise` | `noon` | `twilight` | `midnight`.
 */
export function getAppFormFieldTheme(theme: Theme) {
	const isDark = theme === 'midnight';
	const isTwilight = theme === 'twilight';

	const title = isDark || isTwilight ? 'text-white' : 'text-gray-900';
	const label = isDark || isTwilight ? 'text-blue-100' : 'text-gray-700';
	const muted = isDark
		? 'text-blue-200/80'
		: isTwilight
			? 'text-blue-200/90'
			: 'text-muted-foreground';

	const input = cn(
		'w-full rounded-lg border px-4 py-2.5 text-base transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none md:text-sm',
		isDark
			? 'border-blue-900/40 bg-blue-950/40 text-slate-100 placeholder:text-slate-600 backdrop-blur-sm shadow-inner'
			: isTwilight
				? 'border-blue-700/40 bg-blue-900/30 text-white placeholder:text-blue-300 backdrop-blur-sm shadow-inner'
				: 'border-gray-200 bg-white text-gray-900'
	);

	const inputCompact = cn(
		'h-9 rounded-lg border px-3 py-1 text-sm transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none',
		isDark
			? 'border-blue-900/40 bg-blue-950/40 text-slate-100 backdrop-blur-sm'
			: isTwilight
				? 'border-blue-700/40 bg-blue-900/30 text-white backdrop-blur-sm'
				: 'border-gray-200 bg-white text-gray-900'
	);

	const selectTrigger = cn(
		'flex h-auto min-h-10 w-full items-center justify-between rounded-lg border px-4 py-2.5 text-base transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none md:text-sm [&>svg]:opacity-70',
		isDark
			? 'border-blue-900/40 bg-blue-950/40 text-slate-100 backdrop-blur-sm shadow-inner'
			: isTwilight
				? 'border-blue-700/40 bg-blue-900/30 text-white backdrop-blur-sm shadow-inner'
				: 'border-gray-200 bg-white text-gray-900'
	);

	const selectContent = cn(
		'rounded-lg border shadow-lg',
		isDark
			? 'border-blue-900/40 bg-blue-950/95 text-slate-100 backdrop-blur-lg'
			: isTwilight
				? 'border-blue-700/40 bg-blue-900/95 text-white backdrop-blur-lg'
				: 'border-gray-200 bg-white text-popover-foreground'
	);

	const selectItem =
		isDark || isTwilight
			? 'focus:bg-blue-900/70 focus:text-white data-[highlighted]:bg-blue-900/70 data-[highlighted]:text-white'
			: '';

	const settingsCard = cn(
		'overflow-hidden border shadow-lg',
		isDark
			? 'border-blue-900/50 bg-blue-950/50 text-slate-100 backdrop-blur-md'
			: isTwilight
				? 'border-blue-700/50 bg-blue-900/35 text-white backdrop-blur-md'
				: 'border-gray-200 bg-white/95 text-gray-900 shadow-sm'
	);

	const footerBorder = isDark
		? 'border-blue-900/40'
		: isTwilight
			? 'border-blue-800/40'
			: 'border-gray-200';

	const footerCancel = cn(
		'flex-1 rounded-lg border px-6 py-2.5 font-medium transition-all focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none',
		isDark
			? 'border-blue-900/40 bg-blue-950/40 text-slate-200 hover:bg-blue-900/60 backdrop-blur-sm shadow-inner'
			: isTwilight
				? 'border-blue-700/40 bg-blue-900/30 text-white hover:bg-blue-800/50 backdrop-blur-sm shadow-inner'
				: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
	);

	const footerPrimary = cn(
		'flex-1 rounded-lg px-6 py-2.5 font-medium text-white shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50',
		isDark || isTwilight
			? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/50'
			: 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30'
	);

	const langBubbleActive =
		'border-indigo-500 bg-indigo-600 text-white ring-2 ring-indigo-400/50 shadow-sm';
	const langBubbleIdle = isDark
		? 'border-blue-800/50 bg-blue-950/50 text-slate-200 hover:bg-blue-900/50'
		: isTwilight
			? 'border-blue-700/50 bg-blue-900/40 text-white hover:bg-blue-800/50'
			: 'border-gray-300 bg-white text-gray-900 hover:border-indigo-300 hover:bg-indigo-50';

	const inputDisabled = cn(
		'cursor-not-allowed border text-base md:text-sm',
		isDark
			? 'border-blue-950/40 bg-blue-950/60 text-slate-700 backdrop-blur-sm'
			: isTwilight
				? 'border-blue-900/40 bg-blue-950/40 text-blue-400 backdrop-blur-sm'
				: 'border-gray-200 bg-white text-gray-400'
	);

	const dropdown = selectContent;

	const dropdownHover = isDark
		? 'hover:bg-blue-900/60'
		: isTwilight
			? 'hover:bg-blue-800/60'
			: 'hover:bg-gray-50';

	const dropdownActive =
		isDark || isTwilight ? 'bg-indigo-600/90 text-white' : 'bg-blue-50 text-blue-600';

	const advancedPanel = cn(
		'rounded-lg border p-4',
		isDark
			? 'border-blue-900/30 bg-blue-950/30 backdrop-blur-sm'
			: isTwilight
				? 'border-blue-700/30 bg-blue-900/25 backdrop-blur-sm'
				: 'border-blue-100 bg-blue-50'
	);

	const iconColor = isDark ? 'text-blue-400' : isTwilight ? 'text-blue-300' : 'text-gray-400';

	const datePicker = cn(
		'w-80 rounded-lg border p-4 shadow-xl',
		isDark
			? 'border-blue-900/40 bg-blue-950/95 backdrop-blur-lg'
			: isTwilight
				? 'border-blue-700/40 bg-blue-900/95 backdrop-blur-lg'
				: 'border-gray-200 bg-white'
	);

	const datePickerHeader = isDark
		? 'text-blue-400'
		: isTwilight
			? 'text-blue-300'
			: 'text-gray-500';

	const datePickerButton = isDark
		? 'hover:bg-blue-900/60'
		: isTwilight
			? 'hover:bg-blue-800/60'
			: 'hover:bg-gray-100';

	const datePickerDay = isDark
		? 'hover:bg-blue-900/60 text-slate-300'
		: isTwilight
			? 'hover:bg-blue-800/60 text-white'
			: 'hover:bg-blue-50';

	const datePickerDayActive =
		isDark || isTwilight
			? 'bg-indigo-600/90 text-white hover:bg-indigo-600'
			: 'bg-blue-600 text-white hover:bg-blue-700';

	/** Light themes: subtle page tint behind the form. Dark themes use `App` / inline bg instead. */
	const formPageBg = isDark || isTwilight ? '' : 'bg-gradient-to-b from-gray-50 to-white';

	const switchUnchecked = isDark
		? 'data-[state=unchecked]:bg-slate-700'
		: 'data-[state=unchecked]:bg-gray-300';

	const textDisabled = isDark ? 'text-slate-500' : 'text-gray-400';

	const bodyText = isDark || isTwilight ? 'text-slate-200' : 'text-gray-600';

	/** Bottom horoscope strip: workspace chart “tabs” — shadcn surfaces + app glass (matches settings cards). */
	const contextRail = cn(
		'flex min-h-11 w-full items-center justify-center gap-2 overflow-x-auto overflow-y-hidden border-t px-3 py-1.5',
		isDark
			? 'border-blue-900/40 bg-blue-950/45 text-slate-100 backdrop-blur-md'
			: isTwilight
				? 'border-blue-800/40 bg-blue-950/30 text-white backdrop-blur-md'
				: 'border-border bg-muted/50 text-foreground backdrop-blur-sm supports-[backdrop-filter]:bg-background/70'
	);

	const contextTabGhost = cn(
		'h-8 min-h-8 max-w-[min(12rem,40vw)] justify-start truncate px-2 font-normal shadow-none',
		isDark
			? 'text-slate-300 hover:bg-white/10 hover:text-white'
			: isTwilight
				? 'text-blue-100/90 hover:bg-white/10 hover:text-white'
				: 'text-muted-foreground hover:bg-muted hover:text-foreground'
	);

	const contextTabActive = cn(
		'block truncate font-semibold underline underline-offset-4 decoration-primary/60',
		title
	);

	const contextSeparator = isDark
		? '[&>svg]:text-slate-500'
		: isTwilight
			? '[&>svg]:text-blue-200/50'
			: '[&>svg]:text-muted-foreground/60';

	return {
		isDark,
		isTwilight,
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
		settingsCard,
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
