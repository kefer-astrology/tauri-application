import type { ReactNode } from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/app/components/ui/accordion';
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

/** Building blocks for filter panels: collapsible sections and compact "any"-able fields. Every
 *  value is a string; `''` means "any". Copy comes from the caller. */

export type FilterOption = { value: string; label: string };

/** A collapsible filter group; place inside an `Accordion type="multiple"`. */
export function FilterSection({
	id,
	title,
	children,
	className
}: {
	id: string;
	title: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<AccordionItem value={id} className="border-none">
			<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">{title}</AccordionTrigger>
			<AccordionContent className={cn('space-y-3 px-4 sm:px-6', className)}>
				{children}
			</AccordionContent>
		</AccordionItem>
	);
}

export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
	const ft = useAppFormFieldTheme();
	return <Label className={cn('text-xs font-medium', ft.muted, className)}>{children}</Label>;
}

const ANY = '__any__';

/** Compact select with a leading "any" option (`anyLabel`, default `—`). */
export function OptionSelect({
	value,
	options,
	onValueChange,
	anyLabel = '—',
	ariaLabel,
	className
}: {
	value: string;
	options: readonly FilterOption[];
	onValueChange: (value: string) => void;
	anyLabel?: string;
	ariaLabel?: string;
	className?: string;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<Select value={value || ANY} onValueChange={(next) => onValueChange(next === ANY ? '' : next)}>
			<SelectTrigger
				aria-label={ariaLabel}
				className={cn(ft.inputCompact, 'w-full min-w-0 px-2 text-xs', className)}
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent className={ft.selectContent}>
				<SelectItem value={ANY} className={ft.selectItem}>
					{anyLabel}
				</SelectItem>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value} className={ft.selectItem}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function CheckRow({
	id,
	checked,
	onCheckedChange,
	children,
	indent = 0
}: {
	id: string;
	checked: boolean;
	onCheckedChange: () => void;
	children: ReactNode;
	indent?: number;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<div className="flex items-center gap-2" style={{ paddingLeft: `${indent * 16}px` }}>
			<Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
			<Label htmlFor={id} className={cn('cursor-pointer text-sm', ft.bodyText)}>
				{children}
			</Label>
		</div>
	);
}

export type CheckListItem = { value: string; label: string; indent?: number; heading?: boolean };

/** Multi-select checkbox list; `heading` items render as non-selectable sub-headings. */
export function CheckList({
	idPrefix,
	items,
	selected,
	onSelectedChange,
	columns = 1
}: {
	idPrefix: string;
	items: readonly CheckListItem[];
	selected: readonly string[];
	onSelectedChange: (selected: string[]) => void;
	columns?: 1 | 2;
}) {
	const ft = useAppFormFieldTheme();
	const toggle = (value: string) =>
		onSelectedChange(
			selected.includes(value) ? selected.filter((id) => id !== value) : [...selected, value]
		);
	return (
		<div className={cn(columns === 2 ? 'grid grid-cols-2 gap-1.5' : 'space-y-2')}>
			{items.map((item) =>
				item.heading ? (
					<p
						key={item.value}
						className={cn('pt-1 text-xs font-medium', ft.muted)}
						style={{ paddingLeft: `${(item.indent ?? 0) * 16}px` }}
					>
						{item.label}
					</p>
				) : (
					<CheckRow
						key={item.value}
						id={`${idPrefix}-${item.value}`}
						checked={selected.includes(item.value)}
						onCheckedChange={() => toggle(item.value)}
						indent={item.indent}
					>
						{item.label}
					</CheckRow>
				)
			)}
		</div>
	);
}

/** Count condition: `''` any, `'0'`…`max` exact (or at least with `orMore`), optional extra
 *  leading options (e.g. "dominant"). */
export type CountValue = { value: string; orMore: boolean };

export function CountField({
	id,
	label,
	value,
	onValueChange,
	orMoreLabel,
	max = 10,
	extraOptions = []
}: {
	id: string;
	label: string;
	/** Label of the "or more" checkbox. */
	orMoreLabel: string;
	value: CountValue;
	onValueChange: (value: CountValue) => void;
	max?: number;
	extraOptions?: readonly FilterOption[];
}) {
	const ft = useAppFormFieldTheme();
	const options: FilterOption[] = [
		...extraOptions,
		...Array.from({ length: max + 1 }, (_, n) => ({ value: String(n), label: String(n) }))
	];
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-center gap-2">
			<span className={cn('truncate text-sm', ft.bodyText)}>{label}</span>
			<OptionSelect
				value={value.value}
				options={options}
				ariaLabel={label}
				onValueChange={(next) => onValueChange({ ...value, value: next })}
			/>
			<CheckRow
				id={`${id}-or-more`}
				checked={value.orMore}
				onCheckedChange={() => onValueChange({ ...value, orMore: !value.orMore })}
			>
				<span className="text-xs">{orMoreLabel}</span>
			</CheckRow>
		</div>
	);
}
