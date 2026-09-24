import type { ReactNode } from 'react';
import { Switch } from './switch';
import { cn } from './utils';

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
};

type ModeSwitcherDetailsProps = {
	open: boolean;
	children: ReactNode;
	className?: string;
	contentClassName?: string;
};

export function ModeSwitcher<T extends string>({
	value,
	options,
	onValueChange,
	ariaLabel,
	className
}: ModeSwitcherProps<T>) {
	const [firstOption, secondOption] = options;
	if (!firstOption || !secondOption) return null;

	const isSecondOption = value === secondOption.value;

	return (
		<div
			role="group"
			aria-label={ariaLabel}
			className={cn(
				'flex h-11 min-w-[11rem] items-center justify-center gap-2 text-xs font-medium',
				className
			)}
		>
			<button
				type="button"
				className={cn(
					'whitespace-nowrap transition-colors [font:inherit] hover:text-[color:var(--theme-content-primary)] focus-visible:ring-2 focus-visible:ring-[color:var(--theme-accent)]/45 focus-visible:outline-none',
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
				variant="prominent"
				checked={isSecondOption}
				onCheckedChange={(checked) =>
					onValueChange(checked ? secondOption.value : firstOption.value)
				}
				aria-label={ariaLabel}
			/>
			<button
				type="button"
				className={cn(
					'whitespace-nowrap transition-colors [font:inherit] hover:text-[color:var(--theme-content-primary)] focus-visible:ring-2 focus-visible:ring-[color:var(--theme-accent)]/45 focus-visible:outline-none',
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

export function ModeSwitcherDetails({
	open,
	children,
	className,
	contentClassName
}: ModeSwitcherDetailsProps) {
	return (
		<div
			className={cn(
				'grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none',
				open
					? 'translate-y-0 grid-rows-[1fr] opacity-100'
					: '-translate-y-1 grid-rows-[0fr] opacity-0',
				className
			)}
			aria-hidden={!open}
			{...(!open ? { inert: '' } : {})}
		>
			<div className="min-h-0 overflow-hidden">
				<div className={contentClassName}>{children}</div>
			</div>
		</div>
	);
}
