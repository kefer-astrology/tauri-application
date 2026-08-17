import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
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
	options: readonly ModeSwitcherOption<T>[];
	ariaLabel: string;
	className?: string;
};

export function ModeSwitcherList<T extends string>({
	options,
	ariaLabel,
	className
}: ModeSwitcherListProps<T>) {
	return (
		<TabsList
			aria-label={ariaLabel}
			className={cn(
				'grid h-10 w-full border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-soft-bg)]',
				className
			)}
			style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
		>
			{options.map((option) => (
				<TabsTrigger key={option.value} value={option.value}>
					{option.label}
				</TabsTrigger>
			))}
		</TabsList>
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
		<Tabs value={value} onValueChange={(next) => onValueChange(next as T)} className={className}>
			<ModeSwitcherList options={options} ariaLabel={ariaLabel} className={listClassName} />
		</Tabs>
	);
}
