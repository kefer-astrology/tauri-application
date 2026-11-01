import type { ReactNode } from 'react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';

/** A setup select: label above, fixed options (some may be disabled). */
export function SetupSelect({
	label,
	value,
	onValueChange,
	options,
	dataTour
}: {
	label: ReactNode;
	value: string;
	onValueChange: (value: string) => void;
	options: readonly { value: string; label: ReactNode; disabled?: boolean }[];
	dataTour?: string;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<div data-tour={dataTour}>
			<Label className={cn('mb-2 block', ft.label)}>{label}</Label>
			<Select value={value} onValueChange={onValueChange}>
				<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner')}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent className={ft.selectContent}>
					{options.map((option) => (
						<SelectItem
							key={option.value}
							value={option.value}
							className={ft.selectItem}
							disabled={option.disabled}
						>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

/** A labelled checkbox with an optional hint below it. */
export function CheckOption({
	label,
	hint,
	checked,
	onCheckedChange,
	disabled = false
}: {
	label: ReactNode;
	hint?: ReactNode;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
}) {
	const ft = useAppFormFieldTheme();
	const option = (
		<Label
			className={cn('flex items-start gap-3', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
		>
			<Checkbox
				checked={checked}
				onCheckedChange={(next) => onCheckedChange(next === true)}
				className={cn('mt-0.5', disabled && 'disabled:cursor-not-allowed', ft.checkboxAccent)}
				disabled={disabled}
			/>
			<span className={cn('text-sm', disabled ? ft.textDisabled : ft.bodyText)}>{label}</span>
		</Label>
	);
	if (!hint) return option;
	return (
		<div className="space-y-1.5">
			{option}
			<p className={cn('pl-7 text-xs', ft.muted)}>{hint}</p>
		</div>
	);
}
