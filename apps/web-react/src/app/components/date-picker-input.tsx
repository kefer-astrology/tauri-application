import { useEffect, useState } from 'react';
import { format, isValid, parse, type Locale } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';

type DatePickerInputProps = {
	id?: string;
	label: string;
	value: Date;
	onValueChange: (value: Date) => void;
	locale: Locale;
	showLabel?: boolean;
	labelClassName?: string;
	iconClassName?: string;
	panelClassName?: string;
};

function mergeDatePart(target: Date, pickedDate: Date): Date {
	const next = new Date(target);
	next.setFullYear(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate());
	return next;
}

export function DatePickerInput({
	id,
	label,
	value,
	onValueChange,
	locale,
	showLabel = true,
	labelClassName,
	iconClassName,
	panelClassName
}: DatePickerInputProps) {
	const [open, setOpen] = useState(false);
	const [draftValue, setDraftValue] = useState(() => format(value, 'P', { locale }));

	useEffect(() => {
		setDraftValue(format(value, 'P', { locale }));
	}, [value, locale]);

	const commitDraftValue = () => {
		const parsed = parse(draftValue.trim(), 'P', new Date(), { locale });
		if (!isValid(parsed)) {
			setDraftValue(format(value, 'P', { locale }));
			return;
		}
		onValueChange(mergeDatePart(value, parsed));
	};

	return (
		<div className="flex flex-col gap-2">
			{showLabel ? (
				<Label htmlFor={id} className={cn('mb-1.5 block', labelClassName)}>
					{label}
				</Label>
			) : null}
			<Popover open={open} onOpenChange={setOpen}>
				<div
					className={cn(
						'flex min-h-10 w-full items-stretch overflow-hidden rounded-xl border text-base shadow-inner transition-all md:text-sm',
						'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)] backdrop-blur-sm',
						'focus-within:border-transparent focus-within:ring-2 focus-within:ring-[var(--theme-accent)]'
					)}
				>
					<Input
						id={id}
						type="text"
						inputMode="numeric"
						value={draftValue}
						onChange={(event) => setDraftValue(event.target.value)}
						onBlur={commitDraftValue}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								commitDraftValue();
								setOpen(false);
							}
						}}
						className="h-full flex-1 rounded-none border-0 bg-transparent px-4 py-2.5 shadow-none focus-visible:ring-0"
						placeholder={format(new Date(), 'P', { locale })}
						aria-label={label}
					/>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							className="h-full rounded-none border-l border-[color:var(--theme-panel-border)] px-3 shadow-none hover:bg-[color:var(--theme-soft-bg)]"
							aria-label={label}
						>
							<CalendarIcon className={cn('h-4 w-4 shrink-0', iconClassName)} />
						</Button>
					</PopoverTrigger>
				</div>
				<PopoverContent className={cn('w-auto p-0', panelClassName)} align="end">
					<Calendar
						mode="single"
						selected={value}
						onSelect={(date) => {
							if (date) onValueChange(mergeDatePart(value, date));
							setOpen(false);
						}}
						locale={locale}
						initialFocus
						defaultMonth={value}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
