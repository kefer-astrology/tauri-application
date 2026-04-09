import type { CSSProperties } from 'react';
import { cn } from './ui/utils';
import type { Theme } from './astrology-sidebar';
import { sidebarThemeStyles } from './astrology-sidebar';

export type SecondaryNavItem = {
	id: string;
	label: string;
};

type SecondaryNavPanelProps = {
	theme: Theme;
	title?: string;
	items: SecondaryNavItem[];
	activeId: string;
	onSelect: (id: string) => void;
	ariaLabel: string;
	/** Merged onto the aside (e.g. min-height when paired with a tall content card). */
	className?: string;
};

export function SecondaryNavPanel({
	theme,
	title,
	items,
	activeId,
	onSelect,
	ariaLabel,
	className
}: SecondaryNavPanelProps) {
	const st = sidebarThemeStyles[theme];

	const asideStyle: CSSProperties | undefined =
		theme === 'twilight' || theme === 'midnight' ? { ...st.customStyle } : undefined;

	return (
		<aside
			className={cn(
				'flex h-full min-h-0 w-full max-w-[14rem] shrink-0 flex-col border-r transition-all duration-300 ease-in-out',
				st.bg,
				st.border,
				className
			)}
			style={asideStyle}
		>
			{title ? (
				<div className={cn('border-b px-4 py-6', st.border)}>
					<h2 className={cn('text-sm font-semibold tracking-wide uppercase', st.text)}>{title}</h2>
				</div>
			) : null}

			<nav className="flex flex-1 flex-col gap-1 px-2 py-4" aria-label={ariaLabel}>
				<ul className="space-y-1">
					{items.map((item) => {
						const isActive = activeId === item.id;
						return (
							<li key={item.id}>
								<button
									type="button"
									onClick={() => onSelect(item.id)}
									className={cn(
										'w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-all duration-200',
										isActive ? st.active : cn(st.text, st.hover)
									)}
									aria-current={isActive ? 'page' : undefined}
								>
									{item.label}
								</button>
							</li>
						);
					})}
				</ul>
			</nav>
		</aside>
	);
}
