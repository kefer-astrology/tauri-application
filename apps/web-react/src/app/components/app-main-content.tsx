import type { CSSProperties, ReactNode } from 'react';
import { cn } from './ui/utils';

/**
 * Shared page padding for primary views (Nový horoskop, Tranzity, Nastavení, etc.):
 * top-aligned content, consistent horizontal rhythm with shadcn-style spacing scale.
 */
export const appMainContentPaddingClassName = 'px-4 py-6 sm:px-6 md:py-8 lg:px-8';
export const appMainContentEdgeToEdgeClassName = 'p-0';

const contentWidthClass = {
	compact: 'max-w-2xl',
	standard: 'max-w-3xl',
	relaxed: 'max-w-[52rem]',
	wide: 'max-w-4xl',
	full: 'max-w-none'
} as const;

export type AppMainContentWidth = keyof typeof contentWidthClass;

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
	/** Shared page width: compact forms, standard workflows, wide data/settings, or unrestricted. */
	width?: AppMainContentWidth;
};

/** Horizontally centered max-width wrapper (top-aligned). */
export function AppMainContentContainer({
	children,
	className,
	width = 'standard'
}: AppMainContentContainerProps) {
	return (
		<div className={cn('mx-auto w-full min-w-0', contentWidthClass[width], className)}>
			{children}
		</div>
	);
}
