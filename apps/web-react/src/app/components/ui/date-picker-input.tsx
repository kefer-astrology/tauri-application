import { useEffect, useMemo, useState } from 'react';
import { addMonths, format, isValid, parse, type Locale } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { Calendar } from '@/app/components/ui/calendar';
import { InputGroup, InputGroupInput, InputGroupButton } from './input-group';
import { Label } from '@/app/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';
import { cn } from '@/app/components/ui/utils';

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
	disabled?: boolean;
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
	panelClassName,
	disabled = false
}: DatePickerInputProps) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const [draftValue, setDraftValue] = useState(() => format(value, 'P', { locale }));
	const [displayMonth, setDisplayMonth] = useState(
		() => new Date(value.getFullYear(), value.getMonth(), 1)
	);
	const currentYear = new Date().getFullYear();
	const selectedYear = value.getFullYear();
	const firstSelectableYear = Math.min(1600, selectedYear);
	const lastSelectableYear = Math.max(currentYear + 100, selectedYear);
	const years = useMemo(
		() =>
			Array.from(
				{ length: lastSelectableYear - firstSelectableYear + 1 },
				(_, index) => firstSelectableYear + index
			),
		[firstSelectableYear, lastSelectableYear]
	);
	const months = useMemo(
		() =>
			Array.from({ length: 12 }, (_, month) => ({
				value: month,
				label: format(new Date(2024, month, 1), 'LLLL', { locale })
			})),
		[locale]
	);

	useEffect(() => {
		setDraftValue(format(value, 'P', { locale }));
		setDisplayMonth(new Date(value.getFullYear(), value.getMonth(), 1));
	}, [value, locale]);

	const changeDisplayedMonth = (month: number) => {
		setDisplayMonth(new Date(displayMonth.getFullYear(), month, 1));
	};

	const changeDisplayedYear = (year: number) => {
		setDisplayMonth(new Date(year, displayMonth.getMonth(), 1));
	};

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
			<Popover open={open && !disabled} onOpenChange={(next) => setOpen(disabled ? false : next)}>
				<InputGroup disabled={disabled}>
					<InputGroupInput
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
						placeholder={format(new Date(), 'P', { locale })}
						aria-label={label}
					/>
					<PopoverTrigger asChild>
						<InputGroupButton type="button" aria-label={label}>
							<CalendarIcon className={cn('h-4 w-4 shrink-0', iconClassName)} />
						</InputGroupButton>
					</PopoverTrigger>
				</InputGroup>
				<PopoverContent
					variant="form"
					className={cn(panelClassName, 'w-[22rem] max-w-[calc(100vw-2rem)] p-0')}
					align="end"
				>
					<div className="w-full">
						<div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,0.7fr)_auto] items-end gap-2 px-3 pt-3">
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="size-8"
								onClick={() => setDisplayMonth(addMonths(displayMonth, -1))}
								disabled={
									displayMonth.getFullYear() === firstSelectableYear &&
									displayMonth.getMonth() === 0
								}
								aria-label={t('time_nav_previous')}
							>
								<ChevronLeft className="size-4" />
							</Button>
							<div className="min-w-0 space-y-1">
								<Label variant="compact">{t('open_date_month')}</Label>
								<Select
									value={String(displayMonth.getMonth())}
									onValueChange={(nextMonth) => changeDisplayedMonth(Number(nextMonth))}
								>
									<SelectTrigger variant="form" size="sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent variant="form">
										{months.map((month) => (
											<SelectItem variant="form" key={month.value} value={String(month.value)}>
												{month.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="min-w-0 space-y-1">
								<Label variant="compact">{t('open_date_year')}</Label>
								<Select
									value={String(displayMonth.getFullYear())}
									onValueChange={(nextYear) => changeDisplayedYear(Number(nextYear))}
								>
									<SelectTrigger variant="form" size="sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent variant="form">
										{years.map((year) => (
											<SelectItem variant="form" key={year} value={String(year)}>
												{year}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="size-8"
								onClick={() => setDisplayMonth(addMonths(displayMonth, 1))}
								disabled={
									displayMonth.getFullYear() === lastSelectableYear &&
									displayMonth.getMonth() === 11
								}
								aria-label={t('time_nav_next')}
							>
								<ChevronRight className="size-4" />
							</Button>
						</div>
						<Calendar
							mode="single"
							selected={value}
							onSelect={(date) => {
								if (date) onValueChange(mergeDatePart(value, date));
								setOpen(false);
							}}
							locale={locale}
							initialFocus
							month={displayMonth}
							onMonthChange={setDisplayMonth}
							fromYear={firstSelectableYear}
							toYear={lastSelectableYear}
							disableNavigation
							classNames={{ caption: 'hidden', nav: 'hidden' }}
							className="mx-auto"
						/>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
