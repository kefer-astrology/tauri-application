import { cva } from 'class-variance-authority';

/** Shared selection colors. Hover never replaces a selected background. */
export const choiceStateVariants = cva('transition-colors', {
	variants: {
		state: {
			idle: 'bg-transparent text-[color:var(--theme-content-secondary)] hover:bg-[color:var(--theme-hover-bg)] hover:text-[color:var(--theme-content-primary)]',
			selected:
				'bg-[color:var(--theme-selected-bg)] text-[color:var(--theme-content-primary)] hover:bg-[color:var(--theme-selected-bg)]',
			preview: 'bg-[color:var(--theme-hover-bg)] text-[color:var(--theme-content-primary)]'
		},
		emphasis: { none: '', outline: '', inset: '' }
	},
	compoundVariants: [
		{
			state: 'selected',
			emphasis: 'outline',
			className:
				'border-[color:var(--theme-accent)] shadow-sm ring-2 ring-[color:var(--theme-accent)]/25'
		},
		{ state: 'preview', emphasis: 'outline', className: 'border-[color:var(--theme-accent)]/50' },
		{
			state: 'selected',
			emphasis: 'inset',
			className: 'ring-1 ring-[color:var(--theme-accent)] ring-inset'
		}
	],
	defaultVariants: { state: 'idle', emphasis: 'none' }
});

export const choiceShapeVariants = cva('', {
	variants: {
		variant: {
			chip: 'h-auto gap-1.5 rounded-full border border-[color:var(--theme-panel-border)] px-2.5 py-1 text-xs font-medium',
			row: 'h-auto w-full justify-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-normal whitespace-normal',
			segment: 'h-7 rounded-md px-2.5 py-1 text-xs font-medium',
			cell: 'h-auto rounded-none'
		}
	},
	defaultVariants: { variant: 'row' }
});
