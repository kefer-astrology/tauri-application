import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from './utils';

export interface OverflowMenuItem {
	id: string;
	label: string;
	onSelect: () => void;
	disabled?: boolean;
}

/** The `⋯` menu: a click-opened list of actions (no right-click menus). Arrow keys move between
 *  items; choosing one closes the menu. */
function OverflowMenu({
	items,
	label,
	className
}: {
	items: readonly OverflowMenuItem[];
	/** Accessible name of the trigger. */
	label: string;
	className?: string;
}) {
	const [open, setOpen] = React.useState(false);
	const listRef = React.useRef<HTMLDivElement>(null);

	const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const buttons = [
			...(listRef.current?.querySelectorAll<HTMLButtonElement>(
				'[role="menuitem"]:not(:disabled)'
			) ?? [])
		];
		const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const step = event.key === 'ArrowDown' ? 1 : -1;
		buttons[(current + step + buttons.length) % buttons.length]?.focus();
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={label}
					aria-haspopup="menu"
					className={cn('rounded-lg hover:bg-[color:var(--token-hover-subtle)]', className)}
				>
					<MoreHorizontal className="h-4 w-4 text-[color:var(--theme-content-muted)]" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-56 p-1">
				<div ref={listRef} role="menu" aria-label={label} onKeyDown={moveFocus}>
					{items.map((item) => (
						<Button
							key={item.id}
							type="button"
							variant="ghost"
							role="menuitem"
							disabled={item.disabled}
							className="h-auto w-full justify-start px-3 py-2 text-left text-sm font-normal"
							onClick={() => {
								setOpen(false);
								item.onSelect();
							}}
						>
							{item.label}
						</Button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

export { OverflowMenu };
