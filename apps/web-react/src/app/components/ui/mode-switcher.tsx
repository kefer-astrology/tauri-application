import type { ReactNode } from 'react';
import { Switch } from './switch';
import { Button } from './button';
import { cn } from './utils';
import { Surface } from './container';

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
	surface?: 'plain' | 'soft';
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
			<Button
				type="button"
				variant="mode-label"
				size="inline"
				onClick={() => onValueChange(firstOption.value)}
				aria-pressed={!isSecondOption}
			>
				{firstOption.label}
			</Button>
			<Switch
				variant="prominent"
				checked={isSecondOption}
				onCheckedChange={(checked) =>
					onValueChange(checked ? secondOption.value : firstOption.value)
				}
				aria-label={ariaLabel}
			/>
			<Button
				type="button"
				variant="mode-label"
				size="inline"
				onClick={() => onValueChange(secondOption.value)}
				aria-pressed={isSecondOption}
			>
				{secondOption.label}
			</Button>
		</div>
	);
}

export function ModeSwitcherDetails({
	open,
	children,
	className,
	contentClassName,
	surface = 'plain'
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
			<div className="min-h-0 overflow-hidden p-1">
				<Surface
					variant={surface}
					padding={surface === 'soft' ? 'default' : 'none'}
					className={contentClassName}
				>
					{children}
				</Surface>
			</div>
		</div>
	);
}
