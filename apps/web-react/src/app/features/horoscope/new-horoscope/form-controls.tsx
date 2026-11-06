import type { ReactNode } from 'react';
import { Label } from '@/app/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';

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
	return (
		<div className={className}>
			<Label htmlFor={htmlFor} className="mb-1.5 block">
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
	return (
		<Select value={value} onValueChange={(next) => onValueChange(next as T)}>
			<SelectTrigger variant="form" id={id} className={triggerClassName}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent variant="form">
				{options.map((option) => (
					<SelectItem variant="form" key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
