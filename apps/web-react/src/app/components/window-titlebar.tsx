import { useLayoutEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Maximize2, Minus, X } from 'lucide-react';
import { isTauriRuntime } from '@/lib/tauri/runtime';
import { cn } from './ui/utils';

const windowButtonClassName =
	'flex h-8 w-11 items-center justify-center text-[color:var(--theme-content-primary)] opacity-70 transition-colors hover:bg-[color:var(--theme-soft-bg)] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--theme-accent)]/45';

interface WindowTitlebarProps {
	isSidebarExpanded: boolean;
	showSecondarySidebar: boolean;
}

export function WindowTitlebar({
	isSidebarExpanded,
	showSecondarySidebar
}: WindowTitlebarProps) {
	const [secondarySidebarWidth, setSecondarySidebarWidth] = useState(0);

	useLayoutEffect(() => {
		if (!showSecondarySidebar) {
			setSecondarySidebarWidth(0);
			return;
		}

		const rail = document.querySelector<HTMLElement>('[data-titlebar-secondary-rail]');
		if (!rail) return;

		const desktopMedia = window.matchMedia('(min-width: 1280px)');
		const syncWidth = () => {
			const isResponsiveRail = rail.dataset.titlebarSecondaryRail === 'responsive';
			setSecondarySidebarWidth(
				isResponsiveRail && !desktopMedia.matches ? 0 : rail.getBoundingClientRect().width
			);
		};
		const observer = new ResizeObserver(syncWidth);
		observer.observe(rail);
		desktopMedia.addEventListener('change', syncWidth);
		syncWidth();

		return () => {
			observer.disconnect();
			desktopMedia.removeEventListener('change', syncWidth);
		};
	}, [showSecondarySidebar]);

	if (!isTauriRuntime()) return null;

	const appWindow = getCurrentWindow();

	return (
		<header
			data-tauri-drag-region
			className="relative z-50 flex h-8 shrink-0 items-center select-none"
		>
			<div
				data-tauri-drag-region
				className={cn(
					'h-full shrink-0 border-r border-[color:var(--theme-sidebar-border)] transition-[width] duration-300 ease-in-out',
					isSidebarExpanded ? 'w-[220px]' : 'w-16'
				)}
				style={{ background: 'var(--theme-main-sidebar-start)' }}
			/>
			{secondarySidebarWidth > 0 && (
				<div
					data-tauri-drag-region
					className="h-full shrink-0 border-r border-[color:var(--theme-sidebar-border)]"
					style={{
						width: secondarySidebarWidth,
						background: 'var(--theme-secondary-sidebar-start)'
					}}
				/>
			)}
			<div data-tauri-drag-region className="h-full min-w-0 flex-1" />
			<nav className="flex h-full shrink-0" aria-label="Window controls">
				<button
					type="button"
					className={windowButtonClassName}
					onClick={() => void appWindow.minimize()}
					aria-label="Minimize window"
				>
					<Minus aria-hidden="true" size={15} strokeWidth={1.75} />
				</button>
				<button
					type="button"
					className={windowButtonClassName}
					onClick={() => void appWindow.toggleMaximize()}
					aria-label="Maximize or restore window"
				>
					<Maximize2 aria-hidden="true" size={13} strokeWidth={1.75} />
				</button>
				<button
					type="button"
					className={`${windowButtonClassName} hover:bg-red-500 hover:text-white`}
					onClick={() => void appWindow.close()}
					aria-label="Close window"
				>
					<X aria-hidden="true" size={16} strokeWidth={1.75} />
				</button>
			</nav>
		</header>
	);
}
