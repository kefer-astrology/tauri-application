'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from './utils';
import { typographyVariants, type TypographyTone } from './typography';

function Label({
	className,
	variant = 'default',
	tone = 'secondary',
	...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
	variant?: 'default' | 'compact' | 'eyebrow';
	tone?: TypographyTone;
}) {
	return (
		<LabelPrimitive.Root
			data-slot="label"
			className={cn(
				'flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
				typographyVariants({
					variant:
						variant === 'default' ? 'label' : variant === 'compact' ? 'compactLabel' : 'eyebrow',
					tone
				}),
				className
			)}
			{...props}
		/>
	);
}

export { Label };
