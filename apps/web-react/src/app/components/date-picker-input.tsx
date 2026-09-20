import { useEffect, useMemo, useState } from 'react';
import { addMonths, format, isValid, parse, type Locale } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
				<PopoverContent
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
								<Label className="text-xs">{t('open_date_month')}</Label>
								<Select
									value={String(displayMonth.getMonth())}
									onValueChange={(nextMonth) => changeDisplayedMonth(Number(nextMonth))}
								>
									<SelectTrigger size="sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{months.map((month) => (
											<SelectItem key={month.value} value={String(month.value)}>
												{month.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="min-w-0 space-y-1">
								<Label className="text-xs">{t('open_date_year')}</Label>
								<Select
									value={String(displayMonth.getFullYear())}
									onValueChange={(nextYear) => changeDisplayedYear(Number(nextYear))}
								>
									<SelectTrigger size="sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{years.map((year) => (
											<SelectItem key={year} value={String(year)}>
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
