import type { ReactNode } from 'react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import type { WheelFocus } from '@/lib/astrology/informationView';
import { useSpektrum } from '../spektrum-context';

/** A card row that previews its focus on the wheel while hovered or focused and locks it on
 *  click. */
export function FocusRow({
	id,
	focus,
	children,
	className
}: {
	id: string;
	focus: WheelFocus;
	children: ReactNode;
	className?: string;
}) {
	const { isActive, preview, toggleLock } = useSpektrum();
	const active = isActive(id);
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			aria-pressed={active}
			data-focus-row={id}
			className={cn(
				'h-auto w-full justify-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-normal whitespace-normal',
				active && 'bg-[color:var(--theme-soft-bg)]',
				className
			)}
			onMouseEnter={() => preview(id, focus)}
			onMouseLeave={() => preview(null)}
			onFocus={() => preview(id, focus)}
			onBlur={() => preview(null)}
			onClick={() => toggleLock(id, focus)}
		>
			{children}
		</Button>
	);
}
