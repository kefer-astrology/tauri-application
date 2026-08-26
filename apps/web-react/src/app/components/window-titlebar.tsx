import { getCurrentWindow } from '@tauri-apps/api/window';
import { Maximize2, Minus, X } from 'lucide-react';
import { isTauriRuntime } from '@/lib/tauri/runtime';

const windowButtonClassName =
	'flex h-8 w-11 items-center justify-center text-[color:var(--theme-content-primary)] opacity-70 transition-colors hover:bg-white/10 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40';

export function WindowTitlebar() {
	if (!isTauriRuntime()) return null;

	const appWindow = getCurrentWindow();

	return (
		<header
			data-tauri-drag-region
			className="relative z-50 flex h-8 shrink-0 items-center border-b border-white/5 select-none"
		>
			<div data-tauri-drag-region className="flex h-full min-w-0 flex-1 items-center px-3">
				<span data-tauri-drag-region className="truncate text-xs font-medium opacity-65">
					Kefer
				</span>
			</div>
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
