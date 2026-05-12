import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from './utils';

export type CardTheme = 'sunrise' | 'noon' | 'twilight' | 'midnight';

const themedCardClasses: Record<CardTheme, string> = {
	sunrise:
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)] shadow-sm backdrop-blur-sm',
	noon:
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)] shadow-sm backdrop-blur-sm',
	twilight:
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)] shadow-sm backdrop-blur-md',
	midnight:
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)] shadow-sm backdrop-blur-md'
};

const cardVariants = cva('flex flex-col gap-6 rounded-2xl', {
	variants: {
		variant: {
			default: 'bg-card text-card-foreground border',
			ghost: 'border-0 bg-transparent text-inherit shadow-none',
			themed: 'overflow-hidden border shadow-lg'
		},
		theme: {
			default: '',
			sunrise: '',
			noon: '',
			twilight: '',
			midnight: ''
		}
	},
	compoundVariants: [
		{ variant: 'themed', theme: 'sunrise', className: themedCardClasses.sunrise },
		{ variant: 'themed', theme: 'noon', className: themedCardClasses.noon },
		{ variant: 'themed', theme: 'twilight', className: themedCardClasses.twilight },
		{ variant: 'themed', theme: 'midnight', className: themedCardClasses.midnight }
	],
	defaultVariants: {
		variant: 'default',
		theme: 'default'
	}
});

function Card({
	className,
	variant,
	theme,
	...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
	return (
		<div
			data-slot="card"
			className={cn(cardVariants({ variant, theme }), className)}
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				'@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 pt-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
				className
			)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return <h4 data-slot="card-title" className={cn('leading-none', className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<p data-slot="card-description" className={cn('text-muted-foreground', className)} {...props} />
	);
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-action"
			className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-content"
			className={cn('px-6 [&:last-child]:pb-6', className)}
			{...props}
		/>
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-footer"
			className={cn('flex items-center px-6 pb-6 [.border-t]:pt-6', className)}
			{...props}
		/>
	);
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
