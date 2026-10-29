import type { ReactNode } from 'react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';

export type CheckChip = { id: string; label: string; leading?: ReactNode; disabled?: boolean };

/** Wrapping row of pill-shaped checkboxes, for picking a few items inline. */
export function CheckChips({
	idPrefix,
	items,
	selected,
	onToggle
}: {
	idPrefix: string;
	items: readonly CheckChip[];
	selected: readonly string[];
	onToggle: (id: string, checked: boolean) => void;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<div className="flex flex-wrap gap-2">
			{items.map((item) => {
				const checked = selected.includes(item.id);
				return (
					<Label
						key={item.id}
						htmlFor={`${idPrefix}-${item.id}`}
						className={cn(
							'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
							'border-[color:var(--theme-panel-border)]',
							item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
							checked && 'bg-[color:var(--theme-soft-bg)]'
						)}
					>
						<Checkbox
							id={`${idPrefix}-${item.id}`}
							checked={checked}
							disabled={item.disabled}
							onCheckedChange={(value) => onToggle(item.id, value === true)}
							className="h-3.5 w-3.5 shrink-0 rounded"
						/>
						{item.leading}
						<span className={ft.bodyText}>{item.label}</span>
					</Label>
				);
			})}
		</div>
	);
}
