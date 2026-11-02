import { createContext, useContext, forwardRef, type ComponentProps } from 'react';
import { Button } from './button';
import { Input } from './input';
import { formInputGroupClassName } from './form-variants';
import { cn } from './utils';

const InputGroupDisabledContext = createContext(false);

/** One themed surface and focus ring for an input with an attached action. */
export function InputGroup({
	className,
	disabled = false,
	children,
	...props
}: ComponentProps<'div'> & { disabled?: boolean }) {
	return (
		<InputGroupDisabledContext.Provider value={disabled}>
			<div
				data-slot="input-group"
				data-disabled={disabled}
				className={cn(formInputGroupClassName, className)}
				{...props}
			>
				{children}
			</div>
		</InputGroupDisabledContext.Provider>
	);
}

export function InputGroupInput({ className, disabled, ...props }: ComponentProps<typeof Input>) {
	const groupDisabled = useContext(InputGroupDisabledContext);
	return (
		<Input
			{...props}
			disabled={groupDisabled || disabled}
			className={cn(
				'h-full flex-1 rounded-none border-0 bg-transparent px-4 py-2.5 shadow-none focus:ring-0 disabled:bg-transparent disabled:opacity-100',
				className
			)}
		/>
	);
}

export const InputGroupButton = forwardRef<HTMLButtonElement, ComponentProps<typeof Button>>(
	function InputGroupButton({ className, disabled, ...props }, ref) {
		const groupDisabled = useContext(InputGroupDisabledContext);
		return (
			<Button
				ref={ref}
				type="button"
				variant="ghost"
				{...props}
				disabled={groupDisabled || disabled}
				className={cn(
					'h-full rounded-none border-l border-[color:var(--theme-panel-border)] px-3 shadow-none disabled:opacity-100',
					className
				)}
			/>
		);
	}
);
