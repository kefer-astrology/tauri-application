import * as React from 'react';
import { surfaceVariants, cardSectionSpacing, type CardSectionDensity } from './container';

import { cn } from './utils';
import { typographyVariants } from './typography';

type CardProps = React.ComponentProps<'div'> & {
	variant?: 'default' | 'ghost' | 'soft' | 'inset';
	spacing?: 'default' | 'compact' | 'flush';
	elevation?: 'flat' | 'raised';
	/** Opt in only for content that must clip; otherwise focus rings remain visible. */
	clip?: boolean;
};

function Card({
	className,
	variant = 'default',
	spacing = 'default',
	elevation = 'flat',
	clip = false,
	...props
}: CardProps) {
	const surface = variant === 'default' ? 'panel' : variant === 'ghost' ? 'plain' : variant;
	return (
		<div
			data-slot="card"
			className={cn(
				'flex flex-col',
				surfaceVariants({ variant: surface, elevation }),
				spacing === 'flush' ? 'gap-0' : spacing === 'compact' ? 'gap-2' : 'gap-6',
				clip && 'overflow-hidden',
				className
			)}
			{...props}
		/>
	);
}

function CardHeader({
	className,
	density = 'default',
	...props
}: React.ComponentProps<'div'> & { density?: CardSectionDensity }) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				'@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
				cardSectionSpacing.header[density],
				className
			)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<h4
			data-slot="card-title"
			className={cn(typographyVariants({ variant: 'panelTitle', tone: 'primary' }), className)}
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<p
			data-slot="card-description"
			className={cn(typographyVariants({ variant: 'body', tone: 'muted' }), className)}
			{...props}
		/>
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

function CardContent({
	className,
	density = 'default',
	...props
}: React.ComponentProps<'div'> & { density?: CardSectionDensity }) {
	return (
		<div
			data-slot="card-content"
			className={cn(cardSectionSpacing.content[density], className)}
			{...props}
		/>
	);
}

function CardFooter({
	className,
	density = 'default',
	...props
}: React.ComponentProps<'div'> & { density?: CardSectionDensity }) {
	return (
		<div
			data-slot="card-footer"
			className={cn('flex items-center', cardSectionSpacing.footer[density], className)}
			{...props}
		/>
	);
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
