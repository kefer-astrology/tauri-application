import type { CSSProperties, ReactNode } from 'react';
import { cn } from './ui/utils';

/**
 * Shared page padding for primary views (Nový horoskop, Tranzity, Nastavení, etc.):
 * top-aligned content, consistent horizontal rhythm with shadcn-style spacing scale.
 */
export const appMainContentPaddingClassName = 'px-4 py-6 sm:px-6 md:py-8 lg:px-8';
export const appMainContentEdgeToEdgeClassName = 'p-0';

const maxWidthClass = {
	'2xl': 'max-w-2xl',
	'3xl': 'max-w-3xl',
	'4xl': 'max-w-4xl',
	'6xl': 'max-w-6xl',
	full: 'max-w-none'
} as const;

export type AppMainContentMaxWidth = keyof typeof maxWidthClass;

type AppMainContentRootProps = {
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
	layout?: 'padded' | 'edge-to-edge';
};

/** Full-width column inside `<main>`: same outer padding everywhere, content starts at the top. */
export function AppMainContentRoot({
	children,
	className,
	style,
	layout = 'padded'
}: AppMainContentRootProps) {
	return (
		<div
			className={cn(
				'flex min-h-full w-full min-w-0 flex-col',
				layout === 'edge-to-edge'
					? appMainContentEdgeToEdgeClassName
					: appMainContentPaddingClassName,
				className
			)}
			style={style}
		>
			{children}
		</div>
	);
}

type AppMainContentContainerProps = {
	children: ReactNode;
	className?: string;
	/** Default `4xl`: centered column; use `6xl` for wide grids, `2xl` for narrow forms. */
	maxWidth?: AppMainContentMaxWidth;
	layout?: 'centered' | 'center-column';
};

/** Horizontally centered max-width wrapper (top-aligned). */
export function AppMainContentContainer({
	children,
	className,
	maxWidth = '4xl',
	layout = 'centered'
}: AppMainContentContainerProps) {
	if (layout === 'center-column') {
		return (
			<div
				className={cn(
					'mx-auto w-full min-w-0 md:w-[88%] lg:w-[76%] xl:w-[64%]',
					className
				)}
			>
				{children}
			</div>
		);
	}

	return (
		<div className={cn('mx-auto w-full', maxWidthClass[maxWidth], className)}>{children}</div>
	);
}
