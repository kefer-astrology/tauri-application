import { Switch } from './ui/switch';
import { cn } from './ui/utils';

export type ModeSwitcherOption<T extends string> = {
	value: T;
	label: string;
};

type ModeSwitcherProps<T extends string> = {
	value: T;
	options: readonly ModeSwitcherOption<T>[];
	onValueChange: (value: T) => void;
	ariaLabel: string;
	className?: string;
	listClassName?: string;
};

type ModeSwitcherListProps<T extends string> = {
	value: T;
	options: readonly ModeSwitcherOption<T>[];
	onValueChange: (value: T) => void;
	ariaLabel: string;
	className?: string;
};

export function ModeSwitcherList<T extends string>({
	value,
	options,
	onValueChange,
	ariaLabel,
	className
}: ModeSwitcherListProps<T>) {
	const [firstOption, secondOption] = options;
	if (!firstOption || !secondOption) return null;

	const isSecondOption = value === secondOption.value;

	return (
		<div
			role="group"
			aria-label={ariaLabel}
			className={cn(
				'flex min-h-8 items-center justify-center gap-2 text-xs font-medium',
				className
			)}
		>
			<button
				type="button"
				className={cn(
					'whitespace-nowrap transition-colors hover:text-[color:var(--theme-content-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--theme-accent)]/45',
					!isSecondOption
						? 'text-[color:var(--theme-accent)]'
						: 'text-[color:var(--theme-content-muted)]'
				)}
				onClick={() => onValueChange(firstOption.value)}
				aria-pressed={!isSecondOption}
			>
				{firstOption.label}
			</button>
			<Switch
				checked={isSecondOption}
				onCheckedChange={(checked) =>
					onValueChange(checked ? secondOption.value : firstOption.value)
				}
				aria-label={ariaLabel}
			/>
			<button
				type="button"
				className={cn(
					'whitespace-nowrap transition-colors hover:text-[color:var(--theme-content-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--theme-accent)]/45',
					isSecondOption
						? 'text-[color:var(--theme-accent)]'
						: 'text-[color:var(--theme-content-muted)]'
				)}
				onClick={() => onValueChange(secondOption.value)}
				aria-pressed={isSecondOption}
			>
				{secondOption.label}
			</button>
		</div>
	);
}

export function ModeSwitcher<T extends string>({
	value,
	options,
	onValueChange,
	ariaLabel,
	className,
	listClassName
}: ModeSwitcherProps<T>) {
	return (
		<div className={className}>
			<ModeSwitcherList
				value={value}
				options={options}
				onValueChange={onValueChange}
				ariaLabel={ariaLabel}
				className={listClassName}
			/>
		</div>
	);
}
