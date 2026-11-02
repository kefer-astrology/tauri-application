import { Heading } from '@/app/components/ui/typography';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { sidebarNavMenuRowClassName, sidebarThemeStyles } from '@/app/components/ui/sidebar-theme';
import { useAppTheme } from '@/app/providers/app-theme';

export type SecondaryNavItem = {
	id: string;
	label: string;
};

type SecondaryNavPanelProps = {
	title?: string;
	items: SecondaryNavItem[];
	activeId: string;
	onSelect: (id: string) => void;
	ariaLabel: string;
	/** Merged onto the aside (e.g. min-height when paired with a tall content card). */
	className?: string;
	/** Rendered below the scrollable nav list, pinned to the bottom of the aside. */
	footer?: ReactNode;
};

export function SecondaryNavPanel({
	title,
	items,
	activeId,
	onSelect,
	ariaLabel,
	className,
	footer
}: SecondaryNavPanelProps) {
	const { theme } = useAppTheme();
	const st = sidebarThemeStyles[theme];

	const asideStyle: CSSProperties | undefined = {
		background:
			'linear-gradient(to bottom, var(--theme-secondary-sidebar-start) 0%, var(--theme-secondary-sidebar-end) 100%)',
		borderColor: 'var(--theme-sidebar-border)'
	};

	return (
		<aside
			data-tour="secondary-navigation"
			data-titlebar-secondary-rail="responsive"
			className={cn(
				'flex min-h-0 w-full shrink-0 flex-wrap items-center border-b px-3 py-2 transition-all duration-300 ease-in-out xl:h-full xl:w-[220px] xl:flex-col xl:items-stretch xl:border-r xl:border-b-0 xl:px-0 xl:pt-2 xl:pb-0',
				st.bg,
				st.border,
				className
			)}
			style={asideStyle}
		>
			{title ? (
				<div className="min-w-0 flex-1 px-1 py-2 xl:flex-none xl:px-3 xl:py-4">
					<Heading variant="eyebrow" level={2} className={st.text}>
						{title}
					</Heading>
				</div>
			) : null}

			<nav
				className="scrollbar-hide order-last flex min-h-0 w-full gap-1 overflow-x-auto p-1 xl:order-none xl:w-auto xl:flex-1 xl:flex-col xl:gap-0.5 xl:overflow-x-hidden xl:overflow-y-auto xl:px-3 xl:py-3"
				aria-label={ariaLabel}
			>
				{items.map((item) => {
					const isActive = activeId === item.id;
					return (
						<Button
							key={item.id}
							data-tour={`secondary-nav-${item.id}`}
							type="button"
							variant="ghost"
							onClick={() => onSelect(item.id)}
							className={cn(
								'w-auto shrink-0 text-left xl:w-full',
								sidebarNavMenuRowClassName,
								isActive ? st.active : cn(st.text, st.hover)
							)}
							aria-current={isActive ? 'page' : undefined}
						>
							{item.label}
						</Button>
					);
				})}
			</nav>

			{footer ? (
				<div className={cn('shrink-0 px-1 xl:border-t xl:px-3 xl:py-3', st.border)}>{footer}</div>
			) : null}
		</aside>
	);
}
