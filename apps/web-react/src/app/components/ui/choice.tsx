import { forwardRef, type ComponentProps } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { Button } from './button';
import { Label } from './label';
import { choiceShapeVariants, choiceStateVariants } from './choice-variants';
import { cn } from './utils';

type ChoiceAppearance = VariantProps<typeof choiceShapeVariants> & {
	selected?: boolean;
	preview?: boolean;
	emphasis?: 'none' | 'outline' | 'inset';
};

type ChoiceButtonProps = Omit<ComponentProps<typeof Button>, 'variant'> & ChoiceAppearance;

/** Selection behavior stays with the caller; this supplies shared appearance and state semantics. */
export const ChoiceButton = forwardRef<HTMLButtonElement, ChoiceButtonProps>(function ChoiceButton(
	{ variant = 'row', selected, preview = false, emphasis = 'none', className, role, ...props },
	ref
) {
	const state = selected ? 'selected' : preview ? 'preview' : 'idle';
	const semantics =
		selected === undefined
			? {}
			: role === 'option'
				? { 'aria-selected': selected }
				: { 'aria-pressed': selected };
	return (
		<Button
			ref={ref}
			type="button"
			variant="ghost"
			role={role}
			{...semantics}
			className={cn(
				choiceShapeVariants({ variant }),
				choiceStateVariants({ state, emphasis }),
				className
			)}
			{...props}
		/>
	);
});

type ChoiceLabelProps = Omit<ComponentProps<typeof Label>, 'variant'> &
	Omit<ChoiceAppearance, 'variant'> & {
		variant?: 'row' | 'chip';
		disabled?: boolean;
		highlighted?: boolean;
	};

/** Keeps native label/checkbox association; the child checkbox owns its checked/disabled behavior. */
export function ChoiceLabel({
	variant = 'row',
	selected = false,
	preview = false,
	emphasis = 'none',
	disabled = false,
	highlighted = false,
	className,
	...props
}: ChoiceLabelProps) {
	return (
		<Label
			variant={variant === 'chip' ? 'compact' : 'default'}
			aria-disabled={disabled || undefined}
			className={cn(
				'flex items-center',
				choiceShapeVariants({ variant }),
				choiceStateVariants({
					state: selected ? 'selected' : preview ? 'preview' : 'idle',
					emphasis
				}),
				disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
				disabled &&
					!selected &&
					'hover:bg-transparent hover:text-[color:var(--theme-content-secondary)]',
				highlighted && 'ring-2 ring-[color:var(--theme-accent)]',
				className
			)}
			{...props}
		/>
	);
}

/** A passive chip may contain a separate remove button; it never nests buttons inside a toggle. */
export function Chip({
	selected = false,
	className,
	...props
}: ComponentProps<'span'> & { selected?: boolean }) {
	return (
		<span
			data-slot="chip"
			className={cn(
				'inline-flex items-center',
				choiceShapeVariants({ variant: 'chip' }),
				choiceStateVariants({ state: selected ? 'selected' : 'idle' }),
				className
			)}
			{...props}
		/>
	);
}
