import type { ComponentProps } from 'react';
import { cn } from './utils';

/** Themed native range slider. */
export function RangeInput({ className, style, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
	return (
		<input
			type="range"
			className={cn(
				'h-2 w-full cursor-pointer appearance-none rounded-full bg-[color:var(--theme-panel-border)]',
				className
			)}
			style={{ accentColor: 'var(--theme-accent)', ...style }}
			{...props}
		/>
	);
}
