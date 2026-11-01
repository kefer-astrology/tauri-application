import { Button } from './button';
import { cn } from './utils';

export type SegmentedControlOption<T extends string> = { value: T; label: string };

/** A row of mutually exclusive options (e.g. `[ 3+ | 4+ | 5+ ]`). Clicking the active option
 *  again clears it when `allowDeselect` is set. */
export function SegmentedControl<T extends string>({
	value,
	options,
	onValueChange,
	ariaLabel,
	allowDeselect = false,
	emptyValue,
	className
}: {
	value: T;
	options: readonly SegmentedControlOption<T>[];
	onValueChange: (value: T) => void;
	ariaLabel: string;
	allowDeselect?: boolean;
	/** Value sent when an active option is deselected. */
	emptyValue?: T;
	className?: string;
}) {
	return (
		<div
			role="group"
			aria-label={ariaLabel}
			className={cn(
				'inline-flex rounded-lg border border-[color:var(--theme-panel-border)] p-0.5',
				className
			)}
		>
			{options.map((option) => {
				const active = option.value === value;
				return (
					<Button
						key={option.value}
						type="button"
						variant="ghost"
						aria-pressed={active}
						className={cn(
							'h-7 flex-1 rounded-md px-2.5 text-xs font-medium',
							active
								? 'bg-[color:var(--theme-selected-bg)] text-[color:var(--theme-content-primary)] hover:bg-[color:var(--theme-selected-bg)]'
								: 'text-[color:var(--theme-content-muted)] hover:bg-[color:var(--token-hover-subtle)]'
						)}
						onClick={() =>
							onValueChange(
								active && allowDeselect && emptyValue !== undefined ? emptyValue : option.value
							)
						}
					>
						{option.label}
					</Button>
				);
			})}
		</div>
	);
}
