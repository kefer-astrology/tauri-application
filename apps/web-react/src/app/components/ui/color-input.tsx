import * as React from 'react';

import { cn } from './utils';

function ColorInput({ className, type: _type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			type="color"
			data-slot="color-input"
			className={cn(
				'h-9 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-background p-0 shadow-inner disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0 [&::-moz-color-swatch]:m-1 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-1',
				className
			)}
			{...props}
		/>
	);
}

export { ColorInput };
