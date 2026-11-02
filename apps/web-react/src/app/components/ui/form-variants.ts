import { cva } from 'class-variance-authority';
import { cn } from './utils';

// Appearance recipes shared by form components. Layout stays with their callers.
const formSurface =
	'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg-solid)] text-[color:var(--theme-content-primary)]';

export const formControlDisabledClassName =
	'disabled:cursor-not-allowed disabled:bg-[color:var(--theme-soft-bg)] disabled:text-[color:var(--theme-content-muted)]';

export const formInputVariants = cva(
	cn('rounded-xl border transition-all', formSurface, formControlDisabledClassName),
	{
		variants: {
			density: {
				default:
					'w-full px-4 py-2.5 text-base placeholder:text-[color:var(--theme-content-muted)] shadow-inner md:text-sm',
				compact: 'h-9 px-3 py-1 text-sm'
			}
		},
		defaultVariants: { density: 'default' }
	}
);

export const formSelectTriggerVariants = cva(
	cn(
		'flex w-full items-center justify-between rounded-xl border transition-all [&>svg]:opacity-70',
		formSurface,
		formControlDisabledClassName
	),
	{
		variants: {
			density: {
				default: 'h-auto min-h-10 px-4 py-2.5 text-base shadow-inner md:text-sm',
				compact: 'h-9 min-h-9 px-3 py-1 text-sm'
			}
		},
		defaultVariants: { density: 'default' }
	}
);

export const formInputGroupClassName = cn(
	'flex min-h-10 w-full items-stretch overflow-hidden rounded-xl border text-base shadow-inner transition-all focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 md:text-sm',
	formSurface
);

export const formSelectContentClassName = cn('rounded-xl border shadow-lg', formSurface);

export const formSelectItemClassName =
	'focus:bg-[color:var(--theme-hover-bg)] focus:text-[color:var(--theme-content-primary)] data-[highlighted]:bg-[color:var(--theme-hover-bg)] data-[highlighted]:text-[color:var(--theme-content-primary)]';

export const formButtonSpacingClassName = 'px-6 py-2.5';

export const formButtonVariants = cva(
	'rounded-xl font-medium transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none',
	{
		variants: {
			intent: {
				primary:
					'bg-[color:var(--theme-accent)] text-primary-foreground shadow-lg shadow-[color:var(--theme-shadow-color)]/20 hover:brightness-95 focus:ring-[var(--theme-accent)] disabled:opacity-50',
				secondary: cn(
					formSurface,
					'border text-[color:var(--theme-content-secondary)] shadow-inner hover:bg-[color:var(--theme-hover-bg)] focus:ring-[var(--theme-accent)]'
				)
			}
		},
		defaultVariants: { intent: 'primary' }
	}
);
