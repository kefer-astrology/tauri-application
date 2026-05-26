import * as React from 'react';

import { cn } from './utils';

function ColorInput({ className, type: _type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			type="color"
			data-slot="color-input"
			className={cn(
				'h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border/60 bg-background p-0 shadow-inner disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		/>
	);
}

export { ColorInput };
