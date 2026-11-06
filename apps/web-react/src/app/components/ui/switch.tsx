'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from './utils';

type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
	variant?: 'default' | 'prominent';
};

function Switch({ className, variant = 'default', ...props }: SwitchProps) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				'peer inline-flex h-[22px] w-10 shrink-0 items-center rounded-full border border-transparent bg-[color:var(--theme-content-muted)]/35 p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--theme-accent)]/45 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[color:var(--theme-accent)]',
				variant === 'prominent' && 'data-[state=unchecked]:bg-[color:var(--theme-content-muted)]',
				className
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					'data-[state=checked]:bg-primary-foreground pointer-events-none block size-[18px] rounded-full bg-[color:var(--theme-control-thumb)] shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0',
					variant === 'prominent' && 'bg-[color:var(--theme-control-thumb-prominent)]'
				)}
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
