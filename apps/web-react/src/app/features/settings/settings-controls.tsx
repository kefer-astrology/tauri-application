import { Text } from '@/app/components/ui/typography';
import type { ReactNode } from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/app/components/ui/accordion';
import { Label } from '@/app/components/ui/label';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';

/** A Settings select: optional label above, hint below, fixed option list. */
export function SettingSelect<T extends string>({
	label,
	hint,
	value,
	options,
	onValueChange,
	placeholder,
	ariaLabel,
	narrow = false,
	triggerClassName
}: {
	label?: ReactNode;
	hint?: ReactNode;
	value: T | '';
	options: readonly { value: T; label: string; disabled?: boolean }[];
	onValueChange: (value: T) => void;
	placeholder?: string;
	ariaLabel?: string;
	/** Limit the trigger to a short width (single-choice preferences). */
	narrow?: boolean;
	triggerClassName?: string;
}) {
	return (
		<div className="space-y-2">
			{label && (
				<Label variant="default" tone="secondary">
					{label}
				</Label>
			)}
			<Select value={value} onValueChange={(next) => onValueChange(next as T)}>
				<SelectTrigger
					variant="form"
					aria-label={ariaLabel}
					className={cn(narrow && 'max-w-[280px]', triggerClassName)}
				>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent variant="form">
					<SelectGroup>
						{options.map((option) => (
							<SelectItem
								variant="form"
								key={option.value}
								value={option.value}
								disabled={option.disabled}
							>
								{option.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
			{hint && (
				<Text variant="caption" tone="muted">
					{hint}
				</Text>
			)}
		</div>
	);
}

/** A collapsible group of settings inside an `Accordion`. */
export function SettingsGroup({
	value,
	title,
	className,
	children
}: {
	value: string;
	title: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<AccordionItem value={value}>
			<AccordionTrigger className={ft.title}>{title}</AccordionTrigger>
			<AccordionContent className={className}>{children}</AccordionContent>
		</AccordionItem>
	);
}
