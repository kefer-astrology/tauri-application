import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

export const containerPaddingClassNames = {
	none: 'p-0',
	compact: 'p-3',
	default: 'p-4',
	relaxed: 'p-6'
} as const;

/** Surface appearance is independent of flex/grid layout and scrolling. */
export const surfaceVariants = cva('min-w-0 rounded-xl', {
	variants: {
		variant: {
			panel:
				'border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg-solid)] text-[color:var(--theme-content-primary)]',
			soft: 'border-0 bg-[color:var(--theme-soft-bg)] text-[color:var(--theme-content-primary)]',
			inset:
				'border border-[color:var(--theme-panel-border)] bg-[color:var(--token-surface-subtle)] text-[color:var(--theme-content-primary)]',
			plain: 'rounded-none border-0 bg-transparent text-inherit'
		},
		padding: containerPaddingClassNames,
		elevation: { flat: 'shadow-none', raised: 'shadow-sm' },
		divider: {
			none: '',
			top: 'border-t border-[color:var(--theme-panel-border)]',
			bottom: 'border-b border-[color:var(--theme-panel-border)]'
		}
	},
	defaultVariants: { variant: 'panel', padding: 'none', elevation: 'flat' }
});

type SurfaceProps = HTMLAttributes<HTMLElement> &
	VariantProps<typeof surfaceVariants> & {
		as?: 'div' | 'section' | 'aside' | 'p' | 'li';
	};

export function Surface({
	as: Tag = 'div',
	variant,
	padding,
	elevation,
	divider,
	className,
	...props
}: SurfaceProps) {
	return (
		<Tag
			data-slot="surface"
			className={cn(surfaceVariants({ variant, padding, elevation, divider }), className)}
			{...props}
		/>
	);
}

export const containerBarVariants = cva('flex shrink-0 items-center gap-3', {
	variants: {
		border: {
			none: 'border-0',
			top: 'border-t border-[color:var(--theme-panel-border)]',
			bottom: 'border-b border-[color:var(--theme-panel-border)]'
		},
		padding: { none: 'p-0', compact: 'px-3 py-2', default: 'px-4 py-3', relaxed: 'px-6 py-4' },
		align: {
			start: 'justify-start',
			between: 'justify-between',
			end: 'justify-end',
			center: 'justify-center'
		},
		wrap: { wrap: 'flex-wrap', nowrap: 'flex-nowrap' },
		layout: { row: '', responsive: 'flex-col items-stretch sm:flex-row sm:items-center' },
		surface: {
			plain: 'bg-transparent',
			panel: 'bg-[color:var(--theme-panel-bg-solid)] text-[color:var(--theme-content-primary)]',
			soft: 'bg-[color:var(--theme-soft-bg)] text-[color:var(--theme-content-primary)]'
		}
	},
	defaultVariants: {
		border: 'bottom',
		padding: 'default',
		align: 'between',
		wrap: 'wrap',
		surface: 'plain'
	}
});

type ContainerBarProps = HTMLAttributes<HTMLElement> &
	VariantProps<typeof containerBarVariants> & {
		as?: 'div' | 'header' | 'footer';
	};

/** Does not impose ARIA toolbar semantics or keyboard behavior on its contents. */
export function Toolbar({
	as: Tag = 'div',
	border,
	padding,
	align,
	wrap,
	layout,
	surface,
	className,
	...props
}: ContainerBarProps) {
	return (
		<Tag
			data-slot="toolbar"
			className={cn(
				containerBarVariants({ border, padding, align, wrap, layout, surface }),
				className
			)}
			{...props}
		/>
	);
}

export function ActionBar({
	as = 'div',
	border = 'top',
	padding = 'relaxed',
	align = 'end',
	...props
}: ContainerBarProps) {
	return (
		<Toolbar
			data-slot="action-bar"
			as={as}
			border={border}
			padding={padding}
			align={align}
			{...props}
		/>
	);
}

/** Sections keep Card's header/content/footer rhythm, with a compact rail option. */
export const cardSectionSpacing = {
	header: {
		default: 'px-6 pt-6',
		compact: 'px-3 pt-3',
		none: 'p-0'
	},
	content: {
		default: 'px-6 [&:last-child]:pb-6',
		compact: 'px-3 [&:last-child]:pb-3',
		none: 'p-0'
	},
	footer: {
		default: 'px-6 pb-6 [.border-t]:pt-6',
		compact: 'px-3 pb-3 [.border-t]:pt-3',
		none: 'p-0'
	}
} as const;
export type CardSectionDensity = keyof typeof cardSectionSpacing.content;
