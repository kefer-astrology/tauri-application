import type { ComponentProps, HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

/** Text roles use the shared rem scale; color always comes from the active palette. */
export const typographyVariants = cva('', {
	variants: {
		variant: {
			pageTitle: 'text-xl leading-tight font-semibold tracking-tight',
			sectionTitle: 'text-lg leading-snug font-semibold tracking-tight',
			panelTitle: 'text-sm leading-snug font-semibold',
			body: 'text-sm leading-normal',
			label: 'text-sm leading-snug font-medium',
			compactLabel: 'text-xs leading-snug font-medium',
			caption: 'text-xs leading-normal',
			eyebrow: 'text-xs leading-normal font-medium tracking-wide uppercase'
		},
		tone: {
			primary: 'text-[color:var(--theme-content-primary)]',
			secondary: 'text-[color:var(--theme-content-secondary)]',
			muted: 'text-[color:var(--theme-content-muted)]',
			inherit: ''
		}
	},
	defaultVariants: { variant: 'body', tone: 'inherit' }
});

export type TypographyTone = NonNullable<VariantProps<typeof typographyVariants>['tone']>;

type TextProps = HTMLAttributes<HTMLElement> &
	VariantProps<typeof typographyVariants> & {
		as?: 'p' | 'span' | 'div';
	};

export function Text({
	as: Tag = 'p',
	variant = 'body',
	tone = 'inherit',
	className,
	...props
}: TextProps) {
	return <Tag className={cn(typographyVariants({ variant, tone }), className)} {...props} />;
}

type HeadingProps = ComponentProps<'h2'> & {
	level?: 1 | 2 | 3 | 4 | 5 | 6;
	variant?: 'pageTitle' | 'sectionTitle' | 'panelTitle' | 'eyebrow';
	tone?: TypographyTone;
};

/** The semantic heading level is independent of its visual size. */
export function Heading({
	level = 2,
	variant = 'sectionTitle',
	tone = 'primary',
	className,
	...props
}: HeadingProps) {
	const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
	return <Tag className={cn(typographyVariants({ variant, tone }), className)} {...props} />;
}
