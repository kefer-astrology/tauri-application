import type { ReactNode } from 'react';
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

/** A form field: label above its control. */
export function FormField({
	label,
	htmlFor,
	className,
	children
}: {
	label: ReactNode;
	htmlFor?: string;
	className?: string;
	children: ReactNode;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<div className={className}>
			<Label htmlFor={htmlFor} className={cn('mb-1.5 block', ft.label)}>
				{label}
			</Label>
			{children}
		</div>
	);
}

/** A form select over a fixed option list. */
export function FormSelect<T extends string>({
	id,
	value,
	onValueChange,
	options,
	placeholder,
	triggerClassName
}: {
	id?: string;
	value: T | '';
	onValueChange: (value: T) => void;
	options: readonly { value: T; label: ReactNode }[];
	placeholder?: string;
	triggerClassName?: string;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<Select value={value} onValueChange={(next) => onValueChange(next as T)}>
			<SelectTrigger id={id} className={cn(ft.selectTrigger, 'shadow-inner', triggerClassName)}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent className={ft.selectContent}>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value} className={ft.selectItem}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
