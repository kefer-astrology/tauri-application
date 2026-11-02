import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from './utils';
import { formButtonVariants, formButtonSpacingClassName } from './form-variants';

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
	{
		variants: {
			variant: {
				'form-primary': '',
				'form-secondary': '',
				default: 'bg-primary text-primary-foreground hover:bg-primary/90',
				destructive:
					'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
				outline:
					'border bg-background text-foreground hover:bg-[color:var(--theme-hover-bg)] hover:text-accent-foreground',
				secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
				ghost: 'hover:bg-[color:var(--theme-hover-bg)] hover:text-accent-foreground',
				link: 'text-primary underline-offset-4 hover:underline'
			},
			size: {
				form: cn('h-9', formButtonSpacingClassName),
				default: 'h-9 px-4 py-2 has-[>svg]:px-3',
				sm: 'h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5',
				lg: 'h-10 rounded-lg px-6 has-[>svg]:px-4',
				icon: 'size-9 rounded-lg'
			}
		},
		compoundVariants: [
			{ variant: 'form-primary', className: formButtonVariants({ intent: 'primary' }) },
			{ variant: 'form-secondary', className: formButtonVariants({ intent: 'secondary' }) }
		],
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	}
);

const Button = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<'button'> &
		VariantProps<typeof buttonVariants> & {
			asChild?: boolean;
		}
>(({ className, variant, size, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'button';

	return (
		<Comp
			ref={ref}
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
});

Button.displayName = 'Button';

export { Button, buttonVariants };
