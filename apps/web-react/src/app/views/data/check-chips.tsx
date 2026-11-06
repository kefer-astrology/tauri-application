import { ChoiceLabel } from '@/app/components/ui/choice';
import type { ReactNode } from 'react';
import { Checkbox } from '@/app/components/ui/checkbox';

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
	return (
		<div className="flex flex-wrap gap-2">
			{items.map((item) => {
				const checked = selected.includes(item.id);
				return (
					<ChoiceLabel
						disabled={item.disabled}
						selected={checked}
						variant="chip"
						key={item.id}
						htmlFor={`${idPrefix}-${item.id}`}
					>
						<Checkbox
							id={`${idPrefix}-${item.id}`}
							checked={checked}
							disabled={item.disabled}
							onCheckedChange={(value) => onToggle(item.id, value === true)}
							className="h-3.5 w-3.5 shrink-0 rounded"
						/>
						{item.leading}
						<span>{item.label}</span>
					</ChoiceLabel>
				);
			})}
		</div>
	);
}
