import { ChoiceButton } from './choice';
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
					<ChoiceButton
						key={option.value}
						variant="segment"
						selected={active}
						className="flex-1"
						onClick={() =>
							onValueChange(
								active && allowDeselect && emptyValue !== undefined ? emptyValue : option.value
							)
						}
					>
						{option.label}
					</ChoiceButton>
				);
			})}
		</div>
	);
}
